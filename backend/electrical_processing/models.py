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


class DashboardPreference(models.Model):
    target_kwh = models.FloatField(default=150.0)
    cost_rate = models.FloatField(default=12.0)
    cycle_start_day = models.PositiveSmallIntegerField(default=1)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['id']