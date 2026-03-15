from datetime import timedelta
from django.shortcuts import render
from django.utils import timezone #type: ignore
from rest_framework import generics, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models.functions import TruncDay, TruncWeek, TruncMonth, TruncDate #type: ignore
from django.db.models import Min, Max, Avg #type: ignore

from .models import ElectricalReading
from .serializers import ElectricalReadingSerializer
from backend.settings import LOOKBACK_PERIOD

# --- ESP32 POST ENDPOINT ---
class ElectricReadingCreateView(generics.CreateAPIView):
    queryset = ElectricalReading.objects.all()
    serializer_class = ElectricalReadingSerializer
    # Allow the ESP32 to bypass security to post data
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

# --- REACT CHART ENDPOINT ---
class ElectricalPeriodicReadingView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        # Default to "daily" if nothing is provided
        period = self.request.query_params.get("period", "daily") 
        now = timezone.now()

        # FIXED: Now strictly matches the words React is sending
        if period == "daily":
            start = now - timedelta(days=LOOKBACK_PERIOD)
            trunc = TruncDay('timestamp')
        elif period == "weekly":
            start = now - timedelta(weeks=LOOKBACK_PERIOD) 
            trunc = TruncWeek('timestamp')
        elif period == "monthly":
            start = now - timedelta(days=30 * LOOKBACK_PERIOD)
            trunc = TruncMonth('timestamp')
        else:
            return Response(
                {
                    'label': 'Invalid Period',
                    'detail': f'Your period set ({period}) is invalid. Try daily, weekly, or monthly.',
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
                # Added safety fallback for 'None' values
                "kwh_consumption": (r["last_kwh"] or 0) - (r["first_kwh"] or 0)
            } for r in readings
        ]

        return Response(data, status=status.HTTP_200_OK)

# --- REACT HISTORY ENDPOINT ---
class ElectricalReadingView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get_queryset(self):
        return (
            ElectricalReading.objects
            .annotate(date=TruncDate('timestamp'))
            .values('date')
            .annotate(
                first_kwh=Min("kwh_consumption"),
                last_kwh=Max("kwh_consumption"),
                avg_power=Avg("power"),    
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

# --- REACT DASHBOARD LIVE ENDPOINT ---
class LatestElectricalReadingView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        latest_reading = ElectricalReading.objects.order_by('-timestamp').first()
        if latest_reading:
            serializer = ElectricalReadingSerializer(latest_reading)
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        return Response(
            {"voltage": 0, "current": 0, "power": 0, "kwh_consumption": 0}, 
            status=status.HTTP_200_OK
        )