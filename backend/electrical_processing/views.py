from datetime import timedelta
from django.shortcuts import render
from django.utils import timezone
from rest_framework.viewsets import views
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import (
    ElectricalReading
)

from .serializers import (
    ElectricalReadingSerializer
)

# Create your views here.

class ElectricReadingCreateView(generics.CreateAPIView):
    queryset = ElectricalReading.objects.all()
    serializer_class = ElectricalReadingSerializer


from backend.settings import LOOKBACK_PERIOD
from django.db.models.functions import TruncDay, TruncWeek, TruncMonth
from django.db.models import Min, Max

class ElectricalPeriodicReadingView(APIView):

    def get(self):
        period = self.request.query_params.get("period", None)

        now = timezone.now()

        if not period:
            start = now - timedelta(days=LOOKBACK_PERIOD)
            trunc = TruncDay('timestamp')
        elif period == "week":
            start = now - timedelta(weeks=LOOKBACK_PERIOD) 
            trunc = TruncWeek('timestamp')
        elif period == "month":
            start = now - timedelta(days=30 * LOOKBACK_PERIOD)
            trunc = TruncMonth('timestamp')

        else:
            return Response(
                {
                    'label': 'Invalid Period',
                    'detail': 'Your period set is invalid. Try another one.',
                    'type': 'error'
                }, status=status.HTTP_400_BAD_REQUEST
            )
        
        readings = (
            ElectricalReading.objects
            .filter(timestamp__gte=start)
            .annotate(group=trunc)
            .values('group')
            .annotate(
                first_kwh=Min('kwh_consumption'),
                last_kwh=Max('kwh_consumption'),
            )
            .order_by('group')
        )

        data = [
            {
                "period": r["group"],
                "kwh_consumption": r["last_kwh"] - r["first_kwh"]
            } for r in readings
        ]

        return Response(data, status=status.HTTP_200_OK)
    

from django.db.models.functions import TruncDate
from django.db.models import Sum, Avg, F, ExpressionWrapper, FloatField
    
class ElectricalReadingView(generics.ListAPIView):
    def get_queryset(self):
        return (
            ElectricalReading.objects
            .annotate(date=TruncDate('timestamp'))
            .values('date')
            .annotate(
                kwh_consumption=ExpressionWrapper(
                    Max("kwh_consumption") - Min("kwh_consumption"),
                    output_field=FloatField()
                ),
                avg_power = Avg("power"),    
                avg_voltage=Avg("voltage"), 
                avg_current=Avg("current"),
            )
            .order_by('-date')
        )

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()

        results = []

        for item in queryset:
            kwh_consumption = (
                item["last_kwh"] - item["first_kwh"]
                if item["last_kwh"] is not None and item["first_kwh"] is not None
                else 0
            )

            results.append({
                "date": item["date"],
                "kwh_consumption": kwh_consumption,
                "avg_power": item["avg_power"],
                "avg_voltage": item["avg_voltage"],
                "avg_current": item["avg_current"],
            })

        return Response(results, status=status.HTTP_200_OK)
