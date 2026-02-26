from django.db import models

# Create your models here.
class ElectricalReading(models.Model):
    power = models.FloatField()
    current = models.FloatField()
    voltage = models.FloatField()
    kwh_consumption = models.FloatField()

    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-timestamp']