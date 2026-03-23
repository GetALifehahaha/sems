from rest_framework import serializers
from django.utils import timezone
from .models import ElectricalReading

from backend.settings import INTERVAL

class ElectricalReadingSerializer(serializers.ModelSerializer):
    class Meta:
        model = ElectricalReading
        fields = ['voltage', 'current', 'power', 'kwh_consumption', 'timestamp']
        read_only_fields = ['power', 'kwh_consumption', 'timestamp']

    def create(self, validated_data):
        voltage = validated_data['voltage'] 
        current = validated_data['current'] 

        power = voltage * current

        last_reading = ElectricalReading.objects.first()

        # Use real elapsed time between readings to avoid overcounting when input cadence changes.
        elapsed_ms = INTERVAL
        if last_reading is not None:
            elapsed_ms = max(
                1,
                int((timezone.now() - last_reading.timestamp).total_seconds() * 1000),
            )

            # Prevent unrealistic jumps if telemetry pauses for a long time.
            elapsed_ms = min(elapsed_ms, INTERVAL * 5)

        # Convert Watts to kW and milliseconds to hours.
        kwh_increment = (power / 1000) * (elapsed_ms / 3600000)

        total_kwh = (last_reading.kwh_consumption if last_reading else 0) + kwh_increment

        return ElectricalReading.objects.create(
            voltage=voltage,
            current=current,
            power=power,
            kwh_consumption=total_kwh
        )