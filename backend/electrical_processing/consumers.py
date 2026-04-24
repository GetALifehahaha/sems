import json
import time
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from .models import ElectricalReading
from .ml_service import appliance_ai
from .views import _build_notifications, _resolve_dashboard_settings

class ElectricalConsumer(AsyncWebsocketConsumer):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.last_power = 0.0
        self.last_current = 0.0

        self.active_appliances = []
        self.appliance_counter = 0

        self.base_threshold = 2.5
        self.min_prediction_confidence = 0.50
        self.off_confidence_floor = 0.50

        self.last_event_time = 0
        self.debounce_ms = 500

        self.cached_notifications = []
        self.last_notification_refresh = 0
        self.notification_refresh_ms = 10000

        self.last_db_save_time = 0
        self.db_save_interval_ms = 60000

    async def connect(self):
        # ALWAYS ACCEPT FIRST to prevent early disconnects
        await self.accept()

        self.room_group_name = "electrical_data_group"
        
        # Safely attempt Redis connection
        try:
            await self.channel_layer.group_add(self.room_group_name, self.channel_name)
            print("🟢 WebSocket client connected & Redis joined")
        except Exception as e:
            print(f"⚠️ REDIS CRASH DURING CONNECT: {e}")

        self.last_power = 0.0
        self.last_current = 0.0
        self.active_appliances = []
        self.appliance_counter = 0
        self.cached_notifications = []
        self.last_notification_refresh = 0

    async def disconnect(self, close_code):
        try:
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
        except Exception:
            pass
        print("🔴 WebSocket client disconnected")
        
    # This allows HTTP → consumer pipeline reuse
    async def receive_data(self, event):
        data = event["data"]
        # reuse full ML pipeline
        await self.receive(text_data=json.dumps(data))

    def _to_float(self, value, default=0.0):
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    def _find_similar_active_index(self, name, target_power, target_current):
        normalized_name = str(name or "").strip().lower()
        if not normalized_name:
            return None

        best_index = None
        best_score = None

        for idx, appliance in enumerate(self.active_appliances):
            appliance_name = str(appliance.get("name", "")).strip().lower()
            if appliance_name != normalized_name:
                continue

            power_gap = abs(float(appliance.get("power", 0.0)) - abs(target_power))
            current_gap = abs(float(appliance.get("current", 0.0)) - abs(target_current))
            score = power_gap + (current_gap * 100)

            if power_gap > 8.0 or current_gap > 0.08:
                continue

            if best_score is None or score < best_score:
                best_score = score
                best_index = idx

        return best_index

    def _active_counts(self):
        active_device_count = len(self.active_appliances)
        active_type_count = len(
            {
                str(appliance.get("name", "")).strip().lower()
                for appliance in self.active_appliances
                if str(appliance.get("name", "")).strip()
            }
        )
        return active_device_count, active_type_count

    def _add_active_appliance(self, name, power, current, voltage, confidence, top_candidates):
        existing_index = self._find_similar_active_index(name, power, current)

        if existing_index is not None:
            existing_id = self.active_appliances[existing_index].get("id", f"appliance_{existing_index + 1}")
            self.active_appliances[existing_index] = {
                "id": existing_id,
                "name": name,
                "power": round(abs(power), 1),
                "current": round(abs(current), 3),
                "voltage": round(voltage, 1),
                "confidence": round(confidence, 4),
                "candidates": top_candidates,
            }
            return

        self.appliance_counter += 1
        self.active_appliances.append(
            {
                "id": f"appliance_{self.appliance_counter}",
                "name": name,
                "power": round(abs(power), 1),
                "current": round(abs(current), 3),
                "voltage": round(voltage, 1),
                "confidence": round(confidence, 4),
                "candidates": top_candidates,
            }
        )

    def _closest_appliance_index(self, candidates, target_power, target_current):
        best_index = None
        best_score = None

        for idx, appliance in candidates:
            score = abs(appliance["power"] - target_power) + (
                abs(appliance["current"] - target_current) * 100
            )
            if best_score is None or score < best_score:
                best_score = score
                best_index = idx

        return best_index

    def _remove_matching_appliance(self, predicted_label, target_power, target_current):
        if not self.active_appliances:
            return False

        same_label_candidates = []
        if predicted_label:
            same_label_candidates = [
                (idx, appliance)
                for idx, appliance in enumerate(self.active_appliances)
                if appliance.get("name") == predicted_label
            ]

        candidate_pool = same_label_candidates or [
            (idx, appliance)
            for idx, appliance in enumerate(self.active_appliances)
        ]

        best_index = self._closest_appliance_index(
            candidate_pool,
            target_power,
            target_current,
        )

        if best_index is None:
            return False

        selected = self.active_appliances[best_index]
        power_tolerance = max(5.0, target_power * 0.7)
        current_tolerance = max(0.05, target_current * 0.7)

        if (
            abs(selected["power"] - target_power) > power_tolerance
            or abs(selected["current"] - target_current) > current_tolerance
        ):
            return False

        self.active_appliances.pop(best_index)
        return True

    async def receive(self, text_data):
        if text_data == "ping":
            await self.send(text_data="pong")
            return

        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            print(f"⚠️ Ignored invalid JSON: {text_data}")
            return

        power = self._to_float(data.get("power", 0.0))
        current = self._to_float(data.get("current", 0.0))
        voltage = self._to_float(data.get("voltage", 0.0))

        now = int(time.time() * 1000)
        can_detect_event = (now - self.last_event_time) >= self.debounce_ms

        delta_power = power - self.last_power
        delta_current = current - self.last_current

        dynamic_threshold = self.base_threshold
        if power > 20:
            dynamic_threshold = 12

        if power < 2.0:
            self.active_appliances = []
            if can_detect_event:
                self.last_event_time = now

        elif can_detect_event and delta_power > dynamic_threshold:
            try:
                prediction = appliance_ai.predict_with_confidence(
                    power_jump=delta_power,
                    current_jump=delta_current,
                    event_type="ON",
                )

                predicted_label = prediction.get("label")
                confidence = float(prediction.get("confidence", 0.0))

                if (
                    predicted_label
                    and predicted_label != "Unknown"
                    and confidence >= self.min_prediction_confidence
                ):
                    top_candidates = prediction.get("top_candidates", [])
                    self._add_active_appliance(
                        name=predicted_label,
                        power=delta_power,
                        current=delta_current,
                        voltage=voltage,
                        confidence=confidence,
                        top_candidates=top_candidates,
                    )

                    self.last_event_time = now

            except Exception as e:
                print("⚠️ ML ON error:", e)

        elif can_detect_event and delta_power < -dynamic_threshold:
            try:
                prediction = appliance_ai.predict_with_confidence(
                    power_jump=abs(delta_power),
                    current_jump=abs(delta_current),
                    event_type="OFF",
                )

                predicted_label = None
                if float(prediction.get("confidence", 0.0)) >= self.off_confidence_floor:
                    predicted_label = prediction.get("label")

                removed = self._remove_matching_appliance(
                    predicted_label=predicted_label,
                    target_power=abs(delta_power),
                    target_current=abs(delta_current),
                )

                if removed:
                    self.last_event_time = now

            except Exception as e:
                print("⚠️ ML OFF error:", e)

        if self.last_power == 0.0 and power > 2.5 and not self.active_appliances:
            try:
                prediction = appliance_ai.predict_with_confidence(power, current, event_type="ON")
                predicted_label = prediction.get("label")
                confidence = float(prediction.get("confidence", 0.0))

                if (
                    predicted_label
                    and predicted_label != "Unknown"
                    and confidence >= (self.min_prediction_confidence + 0.05)
                ):
                    self._add_active_appliance(
                        name=predicted_label,
                        power=power,
                        current=current,
                        voltage=voltage,
                        confidence=confidence,
                        top_candidates=prediction.get("top_candidates", []),
                    )

            except Exception:
                pass

        self.last_power = power
        self.last_current = current

        data["active_appliances"] = list(self.active_appliances)
        active_device_count, active_type_count = self._active_counts()
        data["active_device_count"] = active_device_count
        data["active_type_count"] = active_type_count
        
        # Safely fetches notifications using your sync_to_async wrapper
        data["notifications"] = await self.get_live_notifications(power, current)

        now_ms = int(time.time() * 1000)
        if (now_ms - getattr(self, 'last_db_save_time', 0) >= self.db_save_interval_ms) or abs(delta_power) > 50:
            await self.save_reading(data)
            self.last_db_save_time = now_ms

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "broadcast_data",
                "message": data,
            }
        )

    async def get_live_notifications(self, power, current):
        now_ms = int(time.time() * 1000)
        should_refresh = (
            not self.cached_notifications
            or (now_ms - self.last_notification_refresh) >= self.notification_refresh_ms
        )

        if should_refresh:
            self.cached_notifications = await self.build_notifications_snapshot(power, current)
            self.last_notification_refresh = now_ms

        return list(self.cached_notifications)

    @database_sync_to_async
    def build_notifications_snapshot(self, power, current):
        now = timezone.localtime(timezone.now())
        settings = _resolve_dashboard_settings(request=None, now=now)

        return _build_notifications(
            now,
            target_kwh=settings["target_kwh"],
            payment_rate=settings["payment_rate"],
            cycle_start=settings["cycle_start"],
            cycle_end=settings["cycle_end"],
            power=power,
            current=current,
        )

    # Class method for broadcasting out to connected WebSocket clients
    async def broadcast_data(self, event):
        await self.send(text_data=json.dumps(event["message"]))

    @database_sync_to_async
    def save_reading(self, data):
        ElectricalReading.objects.create(
            voltage=data.get('voltage', 0.0),
            current=data.get('current', 0.0),
            power=data.get('power', 0.0),
            kwh_consumption=data.get('kwh_consumption', 0.0)
        )