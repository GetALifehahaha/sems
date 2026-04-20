import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import ElectricalReading
from .ml_service import appliance_ai

class ElectricalConsumer(AsyncWebsocketConsumer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.last_power = 0.0
        self.last_current = 0.0
        # 1. We changed this to a dictionary so we can store detailed stats!
        self.active_appliances = {}
        self.base_threshold = 2.5  

    async def connect(self):
        self.room_group_name = "electrical_data_group"
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()
        print(f"🟢 Client connected to group: {self.room_group_name}")

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        data = json.loads(text_data)

        power = data.get('power', 0.0)
        current = data.get('current', 0.0)
        voltage = data.get('voltage', 0.0)

        delta_power = power - self.last_power
        delta_current = current - self.last_current

        dynamic_threshold = self.base_threshold
        if power > 20.0:
            dynamic_threshold = 12.0 

        # 2. Master Reset
        if power < 2.0:
            self.active_appliances = {}
            
        # 3. Turn ON Logic: Save the exact jump stats!
        elif delta_power > dynamic_threshold:
            try:
                predicted = appliance_ai.predict(power_jump=delta_power, current_jump=delta_current)
                if predicted and predicted != "Unknown":
                    # We save the exact power and current jump that caused this prediction
                    self.active_appliances[predicted] = {
                        "name": predicted,
                        "power": round(abs(delta_power), 1),
                        "current": round(abs(delta_current), 3),
                        "voltage": round(voltage, 1)
                    }
            except Exception as e:
                print(f"⚠️ ML Predict Error (ON): {e}")

        # 4. Turn OFF Logic: Delete the appliance from the dictionary
        elif delta_power < -dynamic_threshold:
            try:
                predicted = appliance_ai.predict(power_jump=abs(delta_power), current_jump=abs(delta_current))
                if predicted in self.active_appliances:
                    del self.active_appliances[predicted]
            except Exception as e:
                print(f"⚠️ ML Predict Error (OFF): {e}")

        # 5. THE FAILSAFE: If starting mid-stream, use absolute power
        if power > 2.5 and len(self.active_appliances) == 0:
            try:
                predicted = appliance_ai.predict(power_jump=power, current_jump=current)
                if predicted and predicted != "Unknown":
                    self.active_appliances[predicted] = {
                        "name": predicted,
                        "power": round(power, 1),
                        "current": round(current, 3),
                        "voltage": round(voltage, 1)
                    }
            except Exception as e:
                pass

        self.last_power = power
        self.last_current = current

        # 6. Convert our dictionary into a neat list for React
        data["active_appliances"] = list(self.active_appliances.values())

        await self.save_reading(data)

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "broadcast_data",
                "message": data
            }
        )

    async def broadcast_data(self, event):
        message = event["message"]
        await self.send(text_data=json.dumps(message))

    @database_sync_to_async
    def save_reading(self, data):
        try:
            ElectricalReading.objects.create(
                voltage=data.get('voltage', 0.0),
                current=data.get('current', 0.0),
                power=data.get('power', 0.0),
                kwh_consumption=data.get('kwh_consumption', 0.0)
            )
        except Exception as e:
            print(f"⚠️ Failed to save reading: {e}")