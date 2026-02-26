from rest_framework import serializers
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
        kwh_increment = power * INTERVAL / 3_600_000

        last_reading = ElectricalReading.objects.first()
        total_kwh = (last_reading.kwh_consumption if last_reading else 0) + kwh_increment

        return ElectricalReading.objects.create(
            voltage=voltage,
            current=current,
            power=power,
            kwh_consumption=total_kwh
        )