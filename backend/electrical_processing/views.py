from datetime import datetime, timedelta
from django.utils import timezone  # type: ignore
from django.db.models import Avg, Max, Min  # type: ignore
from django.db.models.functions import ExtractHour, TruncDate, TruncDay, TruncMonth, TruncWeek  # type: ignore
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import ElectricalReading
from .serializers import ElectricalReadingSerializer
from backend.settings import LOOKBACK_PERIOD


MONTHLY_TARGET_KWH = 150.0


def _to_float(value, default=0.0):
    try:
        if value is None or value == "":
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _usage_between(start_dt, end_dt):
    agg = (
        ElectricalReading.objects
        .filter(timestamp__gte=start_dt, timestamp__lte=end_dt)
        .aggregate(first_kwh=Min("kwh_consumption"), last_kwh=Max("kwh_consumption"))
    )
    first_kwh = agg["first_kwh"]
    last_kwh = agg["last_kwh"]
    if first_kwh is None or last_kwh is None:
        return 0.0
    return max(0.0, last_kwh - first_kwh)


def _month_bounds(now):
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if start.month == 12:
        next_month = start.replace(year=start.year + 1, month=1)
    else:
        next_month = start.replace(month=start.month + 1)
    return start, next_month


def _to_period_datetime(date_str, is_end):
    if not date_str:
        return None

    parsed = datetime.fromisoformat(date_str)
    local_tz = timezone.get_current_timezone()
    if is_end:
        parsed = parsed.replace(hour=23, minute=59, second=59, microsecond=999999)
    else:
        parsed = parsed.replace(hour=0, minute=0, second=0, microsecond=0)
    return timezone.make_aware(parsed, local_tz)


def _historical_ranges(filter_key, this_start, this_end, last_start, last_end):
    now = timezone.localtime(timezone.now())

    if filter_key == "week":
        start_this = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        end_this = now
        start_last = start_this - timedelta(days=7)
        end_last = end_this - timedelta(days=7)
        label_this = f"{start_this.strftime('%b %d')} - {end_this.strftime('%b %d')}"
        label_last = f"{start_last.strftime('%b %d')} - {end_last.strftime('%b %d')}"
        period = "Week-to-Week"
    elif filter_key == "month":
        start_this = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end_this = now
        start_last = (start_this - timedelta(days=1)).replace(day=1)
        end_last = start_this - timedelta(microseconds=1)
        label_this = start_this.strftime("%B %Y")
        label_last = start_last.strftime("%B %Y")
        period = "Month-to-Month"
    elif filter_key == "year":
        start_this = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        end_this = now
        start_last = start_this.replace(year=start_this.year - 1)
        end_last = end_this.replace(year=end_this.year - 1)
        label_this = f"{start_this.year} (YTD)"
        label_last = f"{start_last.year} (YTD)"
        period = "Year-to-Year"
    elif filter_key == "custom":
        start_this = _to_period_datetime(this_start, is_end=False)
        end_this = _to_period_datetime(this_end, is_end=True)
        start_last = _to_period_datetime(last_start, is_end=False)
        end_last = _to_period_datetime(last_end, is_end=True)

        if not all([start_this, end_this, start_last, end_last]):
            return None

        label_this = f"{start_this.strftime('%Y-%m-%d')} to {end_this.strftime('%Y-%m-%d')}"
        label_last = f"{start_last.strftime('%Y-%m-%d')} to {end_last.strftime('%Y-%m-%d')}"
        period = "Custom Comparison"
    else:
        return None

    return {
        "start_this": start_this,
        "end_this": end_this,
        "start_last": start_last,
        "end_last": end_last,
        "label_this": label_this,
        "label_last": label_last,
        "period": period,
    }

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
        now = timezone.localtime(timezone.now())
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        month_start, month_end = _month_bounds(now)

        today_kwh_usage = _usage_between(day_start, now)
        month_kwh_usage = _usage_between(month_start, min(now, month_end))

        latest_reading = ElectricalReading.objects.order_by('-timestamp').first()
        if latest_reading:
            serializer = ElectricalReadingSerializer(latest_reading)
            response_data = {
                **serializer.data,
                "today_kwh_usage": round(today_kwh_usage, 4),
                "month_kwh_usage": round(month_kwh_usage, 4),
            }
            return Response(response_data, status=status.HTTP_200_OK)
        
        return Response(
            {
                "voltage": 0,
                "current": 0,
                "power": 0,
                "kwh_consumption": 0,
                "today_kwh_usage": 0,
                "month_kwh_usage": 0,
            }, 
            status=status.HTTP_200_OK
        )


class DashboardQuickStatsView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        now = timezone.localtime(timezone.now())
        payment_rate = _to_float(request.query_params.get("payment_rate"), default=12.0)

        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        peak_usage_today = _usage_between(day_start, now)

        start_lookback = day_start - timedelta(days=LOOKBACK_PERIOD)
        daily_usage_rows = (
            ElectricalReading.objects
            .filter(timestamp__gte=start_lookback, timestamp__lte=now)
            .annotate(day=TruncDate("timestamp"))
            .values("day")
            .annotate(first_kwh=Min("kwh_consumption"), last_kwh=Max("kwh_consumption"))
        )
        daily_values = [
            max(0.0, (row["last_kwh"] or 0) - (row["first_kwh"] or 0))
            for row in daily_usage_rows
        ]
        average_usage = sum(daily_values) / len(daily_values) if daily_values else 0.0

        month_start, month_end = _month_bounds(now)
        month_usage = _usage_between(month_start, min(now, month_end))

        elapsed_days = max(1, now.day)
        days_in_month = max(1, (month_end - month_start).days)
        projected_month_usage = (month_usage / elapsed_days) * days_in_month
        projected_cost = projected_month_usage * payment_rate
        budget_usage_percent = (month_usage / MONTHLY_TARGET_KWH) * 100

        return Response(
            {
                "peak_usage_today": round(peak_usage_today, 4),
                "average_usage": round(average_usage, 4),
                "projected_cost": round(projected_cost, 2),
                "budget_usage_percent": round(budget_usage_percent, 2),
                "monthly_usage": round(month_usage, 4),
            },
            status=status.HTTP_200_OK,
        )


class DashboardGoalTrackerView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        now = timezone.localtime(timezone.now())
        payment_rate = _to_float(request.query_params.get("payment_rate"), default=12.0)
        month_start, month_end = _month_bounds(now)

        kwh_used = _usage_between(month_start, min(now, month_end))
        remaining_kwh = max(0.0, MONTHLY_TARGET_KWH - kwh_used)

        days_in_month = max(1, (month_end - month_start).days)
        days_remaining = max(1, days_in_month - now.day)
        daily_allowance = remaining_kwh / days_remaining

        cost_used = kwh_used * payment_rate
        cost_remaining = remaining_kwh * payment_rate

        percentage_used = (kwh_used / MONTHLY_TARGET_KWH) * 100
        if percentage_used >= 100:
            status_key = "exceeded"
        elif percentage_used >= 85:
            status_key = "at-risk"
        else:
            status_key = "on-track"

        return Response(
            {
                "kwh_used": round(kwh_used, 4),
                "monthly_target_kwh": MONTHLY_TARGET_KWH,
                "percentage_used": round(min(percentage_used, 100.0), 2),
                "remaining": round(remaining_kwh, 4),
                "days_remaining": days_remaining,
                "daily_allowance": round(daily_allowance, 4),
                "cost_used": round(cost_used, 2),
                "cost_remaining": round(cost_remaining, 2),
                "status": status_key,
            },
            status=status.HTTP_200_OK,
        )


class DashboardHourlyBreakdownView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        now = timezone.localtime(timezone.now())
        start = now - timedelta(hours=23)

        hourly_rows = (
            ElectricalReading.objects
            .filter(timestamp__gte=start, timestamp__lte=now)
            .annotate(hour=ExtractHour("timestamp"))
            .values("hour")
            .annotate(first_kwh=Min("kwh_consumption"), last_kwh=Max("kwh_consumption"))
        )
        consumption_by_hour = {
            int(row["hour"]): max(0.0, (row["last_kwh"] or 0) - (row["first_kwh"] or 0))
            for row in hourly_rows
            if row["hour"] is not None
        }

        data = []
        for i in range(24):
            dt = start + timedelta(hours=i)
            hour_int = dt.hour
            data.append(
                {
                    "hour": f"{hour_int:02d}",
                    "consumption": round(consumption_by_hour.get(hour_int, 0.0), 4),
                }
            )

        return Response(data, status=status.HTTP_200_OK)


class DashboardHistoricalComparisonView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        selected_filter = request.query_params.get("filter", "month")
        payment_rate = _to_float(request.query_params.get("payment_rate"), default=12.0)

        try:
            ranges = _historical_ranges(
                selected_filter,
                request.query_params.get("this_start"),
                request.query_params.get("this_end"),
                request.query_params.get("last_start"),
                request.query_params.get("last_end"),
            )
        except ValueError:
            return Response(
                {
                    "detail": "Invalid date format. Use YYYY-MM-DD.",
                    "type": "error",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not ranges:
            return Response(
                {
                    "detail": "Invalid filter. Use week, month, year, or custom.",
                    "type": "error",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        this_value = _usage_between(ranges["start_this"], ranges["end_this"])
        last_value = _usage_between(ranges["start_last"], ranges["end_last"])

        difference = abs(this_value - last_value)
        percentage = abs(((this_value - last_value) / last_value) * 100) if last_value > 0 else 0.0
        cost_savings = max(0.0, (last_value - this_value) * payment_rate)

        return Response(
            {
                "period": ranges["period"],
                "this_label": ranges["label_this"],
                "last_label": ranges["label_last"],
                "this_value": round(this_value, 4),
                "last_value": round(last_value, 4),
                "difference": round(difference, 4),
                "percentage": round(percentage, 2),
                "is_increase": this_value > last_value,
                "unit": "kWh",
                "cost_savings": round(cost_savings, 2),
            },
            status=status.HTTP_200_OK,
        )


class ElectricalNotificationsView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        now = timezone.localtime(timezone.now())
        payment_rate = _to_float(request.query_params.get("payment_rate"), default=12.0)

        latest = ElectricalReading.objects.order_by("-timestamp").first()
        if latest:
            power = latest.power
            current = latest.current
        else:
            power = _to_float(request.query_params.get("power"), default=0.0)
            current = _to_float(request.query_params.get("current"), default=0.0)

        month_start, month_end = _month_bounds(now)
        month_usage = _usage_between(month_start, min(now, month_end))
        budget_usage_percent = (month_usage / MONTHLY_TARGET_KWH) * 100
        projected_cost = month_usage * payment_rate

        notifications = []

        if budget_usage_percent >= 100:
            notifications.append(
                {
                    "id": "budget_exceeded",
                    "type": "error",
                    "severity": "critical",
                    "title": "Budget Exceeded",
                    "message": f"You've used {budget_usage_percent:.0f}% of your monthly limit",
                    "timestamp": now.isoformat(),
                }
            )
        elif budget_usage_percent >= 85:
            notifications.append(
                {
                    "id": "budget_warning",
                    "type": "warning",
                    "severity": "high",
                    "title": "Budget Alert",
                    "message": f"You're at {budget_usage_percent:.0f}% of monthly limit",
                    "timestamp": now.isoformat(),
                }
            )

        if power > 2500:
            notifications.append(
                {
                    "id": "high_consumption",
                    "type": "warning",
                    "severity": "high",
                    "title": "High Consumption",
                    "message": f"High power usage: {power:.1f}W detected",
                    "timestamp": now.isoformat(),
                }
            )

        if current > 15:
            notifications.append(
                {
                    "id": "high_current",
                    "type": "warning",
                    "severity": "medium",
                    "title": "High Current",
                    "message": f"Current load: {current:.2f}A (monitor appliances)",
                    "timestamp": now.isoformat(),
                }
            )

        if projected_cost > 1800:
            notifications.append(
                {
                    "id": "cost_high",
                    "type": "warning",
                    "severity": "high",
                    "title": "Cost Projection",
                    "message": f"Projected cost: PHP {projected_cost:.2f} (higher than usual)",
                    "timestamp": now.isoformat(),
                }
            )

        if not notifications:
            notifications.append(
                {
                    "id": "system_ok",
                    "type": "success",
                    "severity": "low",
                    "title": "System Status",
                    "message": "All systems operating normally",
                    "timestamp": now.isoformat(),
                }
            )

        return Response(notifications, status=status.HTTP_200_OK)