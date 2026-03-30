# backend/electrical_processing/routing.py
from django.urls import path
from . import consumers

websocket_urlpatterns = [
    # The URL our ESP32 and React will connect to
    path('ws/electrical/', consumers.ElectricalConsumer.as_asgi()),
]