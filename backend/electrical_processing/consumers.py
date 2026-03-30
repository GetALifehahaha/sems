# backend/electrical_processing/consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from django.utils import timezone
from .models import ElectricalReading

class ElectricalConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Join a shared "room" called electrical_data
        self.group_name = 'electrical_data'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        # Leave the room when the connection drops
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        # This triggers when the ESP32 sends us data
        data = json.loads(text_data)
        
        # If the ESP32 sent actual sensor readings...
        if 'voltage' in data:
            # 1. Save it to our SQLite database
            await self.save_reading(data)
            
            # 2. Shout the data out to everyone in the room (React)
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'sensor_data', # This tells it which function to run below
                    'data': data
                }
            )

    async def sensor_data(self, event):
        # This pushes the message down the pipe to React
        await self.send(text_data=json.dumps(event['data']))

    # Django's database isn't built for async speed by default, 
    # so we wrap the save function in sync_to_async
    @sync_to_async
    def save_reading(self, data):
        ElectricalReading.objects.create(
            voltage=data.get('voltage', 0),
            current=data.get('current', 0),
            power=data.get('power', 0),
            kwh_consumption=data.get('kwh_consumption', 0),
            timestamp=timezone.now()
        )