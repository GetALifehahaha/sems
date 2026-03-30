import json
from channels.generic.websocket import AsyncWebsocketConsumer

class ElectricalConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_group_name = "electrical_data_group"

        # 1. Join the "Radio Station" group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()
        print(f"🟢 Client connected to group: {self.room_group_name}")

    async def disconnect(self, close_code):
        # 2. Leave the group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        """
        When the ESP32 sends data, we catch it here 
        and broadcast it to everyone in the group.
        """
        data = json.loads(text_data)

        # 3. Broadcast to the group
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "broadcast_data",
                "message": data
            }
        )

    async def broadcast_data(self, event):
        """
        This helper function actually sends the 
        broadcasted message to the specific client.
        """
        message = event["message"]
        await self.send(text_data=json.dumps(message))