from rest_framework import serializers
from django.utils import timezone
from .models import DashboardPreference, ElectricalReading

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


class DashboardPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = DashboardPreference
        fields = ["target_kwh", "cost_rate", "cycle_start_day", "updated_at"]
        read_only_fields = ["updated_at"]

    def validate_target_kwh(self, value):
        if value < 1 or value > 10000:
            raise serializers.ValidationError("target_kwh must be between 1 and 10000.")
        return value

    def validate_cost_rate(self, value):
        if value < 0.01 or value > 1000:
            raise serializers.ValidationError("cost_rate must be between 0.01 and 1000.")
        return value

    def validate_cycle_start_day(self, value):
        if value < 1 or value > 28:
            raise serializers.ValidationError("cycle_start_day must be between 1 and 28.")
        return value