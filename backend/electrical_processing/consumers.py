import json
import time
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import ElectricalReading
from .ml_service import appliance_ai


class ElectricalConsumer(AsyncWebsocketConsumer):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # tracking previous readings
        self.last_power = 0.0
        self.last_current = 0.0

        # detected appliances state
        self.active_appliances = {}

        # thresholds
        self.base_threshold = 2.5

        # debounce control (prevents spam detection)
        self.last_event_time = 0
        self.debounce_ms = 500

    async def connect(self):
        await self.accept()

        # IMPORTANT: reset state per connection
        self.last_power = 0.0
        self.last_current = 0.0
        self.active_appliances = {}

        print("🟢 ESP32 Connected")

    async def disconnect(self, close_code):
        print("🔴 ESP32 Disconnected")

    async def receive(self, text_data):
        data = json.loads(text_data)

        power = float(data.get('power', 0.0))
        current = float(data.get('current', 0.0))
        voltage = float(data.get('voltage', 0.0))

        now = int(time.time() * 1000)

        # debounce protection (prevents rapid flicker detection)
        if now - self.last_event_time < self.debounce_ms:
            return

        delta_power = power - self.last_power
        delta_current = current - self.last_current

        dynamic_threshold = self.base_threshold
        if power > 20:
            dynamic_threshold = 12

        # =========================
        # RESET CONDITION
        # =========================
        if power < 2.0:
            self.active_appliances = {}

        # =========================
        # TURN ON DETECTION
        # =========================
        elif delta_power > dynamic_threshold:
            try:
                predicted = appliance_ai.predict(
                    power_jump=delta_power,
                    current_jump=delta_current
                )

                if predicted and predicted != "Unknown":
                    self.active_appliances[predicted] = {
                        "name": predicted,
                        "power": round(abs(delta_power), 1),
                        "current": round(abs(delta_current), 3),
                        "voltage": round(voltage, 1)
                    }

                    self.last_event_time = now

            except Exception as e:
                print("⚠️ ML ON error:", e)

        # =========================
        # TURN OFF DETECTION
        # =========================
        elif delta_power < -dynamic_threshold:
            try:
                predicted = appliance_ai.predict(
                    power_jump=abs(delta_power),
                    current_jump=abs(delta_current)
                )

                self.active_appliances.pop(predicted, None)

                self.last_event_time = now

            except Exception as e:
                print("⚠️ ML OFF error:", e)

        # =========================
        # FALLBACK (ONLY FIRST CONNECT STATE)
        # =========================
        if self.last_power == 0.0 and power > 2.5:
            try:
                predicted = appliance_ai.predict(power, current)

                if predicted and predicted != "Unknown":
                    self.active_appliances[predicted] = {
                        "name": predicted,
                        "power": power,
                        "current": current,
                        "voltage": voltage
                    }

            except Exception:
                pass

        # update state
        self.last_power = power
        self.last_current = current

        # attach appliance list
        data["active_appliances"] = list(self.active_appliances.values())

        # save to DB
        await self.save_reading(data)

        # send back to ESP32
        await self.send(text_data=json.dumps(data))

    @database_sync_to_async
    def save_reading(self, data):
        ElectricalReading.objects.create(
            voltage=data.get('voltage', 0.0),
            current=data.get('current', 0.0),
            power=data.get('power', 0.0),
            kwh_consumption=data.get('kwh_consumption', 0.0)
        )