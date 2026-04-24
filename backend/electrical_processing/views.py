from datetime import datetime, timedelta
import csv
import os
from django.utils import timezone  # type: ignore
from django.db.models import Avg, Max, Min  # type: ignore
from django.db.models.functions import ExtractHour, TruncDate, TruncDay, TruncMonth, TruncWeek  # type: ignore
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import DashboardPreference, ElectricalReading
from .serializers import DashboardPreferenceSerializer, ElectricalReadingSerializer
from backend.settings import LOOKBACK_PERIOD
from django.core.cache import cache


MONTHLY_TARGET_KWH = 150.0


def _get_dashboard_preferences():
    pref = cache.get("dashboard_pref")

    if pref is None:
        pref = DashboardPreference.objects.order_by("id").first()

        if pref is None:
            pref = DashboardPreference.objects.create()

        cache.set("dashboard_pref", pref, timeout=60)

    return pref

def _to_float(value, default=0.0):
    try:
        if value is None or value == "":
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _to_int(value, default=0):
    try:
        if value is None or value == "":
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


def _to_bool(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"1", "true", "yes", "y", "on"}:
            return True
        if normalized in {"0", "false", "no", "n", "off"}:
            return False
    if isinstance(value, (int, float)):
        return value != 0
    return default


def _usage_between(start_dt, end_dt):
    qs = ElectricalReading.objects.filter(
        timestamp__gte=start_dt,
        timestamp__lte=end_dt
    )

    if not qs.exists():
        return 0.0

    agg = qs.aggregate(
        first_kwh=Min("kwh_consumption"),
        last_kwh=Max("kwh_consumption")
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


def _normalize_cycle_start_day(value, default=1):
    return min(28, max(1, _to_int(value, default=default)))


def _cycle_bounds(now, cycle_start_day):
    cycle_day = _normalize_cycle_start_day(cycle_start_day, default=1)
    month_anchor = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    this_month_cycle_start = month_anchor.replace(day=cycle_day)

    if now < this_month_cycle_start:
        if this_month_cycle_start.month == 1:
            cycle_start = this_month_cycle_start.replace(
                year=this_month_cycle_start.year - 1,
                month=12,
            )
        else:
            cycle_start = this_month_cycle_start.replace(month=this_month_cycle_start.month - 1)
    else:
        cycle_start = this_month_cycle_start

    if cycle_start.month == 12:
        cycle_end = cycle_start.replace(year=cycle_start.year + 1, month=1)
    else:
        cycle_end = cycle_start.replace(month=cycle_start.month + 1)

    return cycle_start, cycle_end


def _query_param(request, key):
    query_params = getattr(request, "query_params", None)
    if query_params is None:
        return None
    return query_params.get(key)


def _resolve_dashboard_settings(request, now):
    pref = _get_dashboard_preferences()

    target_kwh = _to_float(_query_param(request, "target_kwh"), default=pref.target_kwh)
    if target_kwh <= 0:
        target_kwh = pref.target_kwh

    payment_rate = _to_float(_query_param(request, "payment_rate"), default=pref.cost_rate)
    if payment_rate < 0:
        payment_rate = pref.cost_rate

    cycle_start_day = _normalize_cycle_start_day(
        _query_param(request, "cycle_start_day"),
        default=pref.cycle_start_day,
    )

    cycle_start, cycle_end = _cycle_bounds(now, cycle_start_day)

    return {
        "target_kwh": target_kwh,
        "payment_rate": payment_rate,
        "cycle_start_day": cycle_start_day,
        "cycle_start": cycle_start,
        "cycle_end": cycle_end,
    }


def _build_notifications(
    now,
    *,
    target_kwh,
    payment_rate,
    cycle_start,
    cycle_end,
    power,
    current,
):
    cycle_usage = _usage_between(cycle_start, min(now, cycle_end))
    budget_usage_percent = (cycle_usage / target_kwh) * 100 if target_kwh > 0 else 0.0

    elapsed_days = max(1, (now.date() - cycle_start.date()).days + 1)
    days_in_cycle = max(1, (cycle_end.date() - cycle_start.date()).days)
    projected_cycle_usage = (cycle_usage / elapsed_days) * days_in_cycle
    projected_cost = projected_cycle_usage * payment_rate

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

    return notifications


def _nilp_dataset_path():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(current_dir, "..", "ml_pipeline", "my_appliances_dataset.csv")


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


class DashboardPreferenceView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        pref = _get_dashboard_preferences()
        serializer = DashboardPreferenceSerializer(pref)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        pref = _get_dashboard_preferences()
        serializer = DashboardPreferenceSerializer(pref, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

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

        latest = (
            ElectricalReading.objects
            .only("voltage", "current", "power", "kwh_consumption", "timestamp")
            .order_by('-timestamp')
            .first()
        )

        if not latest:
            return Response({
                "voltage": 0,
                "current": 0,
                "power": 0,
                "kwh_consumption": 0,
                "today_kwh_usage": 0,
                "month_kwh_usage": 0,
            })

        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        month_start, month_end = _month_bounds(now)

        today_kwh_usage = _usage_between(day_start, now)
        month_kwh_usage = _usage_between(month_start, min(now, month_end))

        return Response({
            "voltage": latest.voltage,
            "current": latest.current,
            "power": latest.power,
            "kwh_consumption": latest.kwh_consumption,
            "today_kwh_usage": round(today_kwh_usage, 4),
            "month_kwh_usage": round(month_kwh_usage, 4),
        })

class DashboardQuickStatsView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        now = timezone.localtime(timezone.now())
        settings = _resolve_dashboard_settings(request, now)
        payment_rate = settings["payment_rate"]
        target_kwh = settings["target_kwh"]
        cycle_start = settings["cycle_start"]
        cycle_end = settings["cycle_end"]
        cycle_start_day = settings["cycle_start_day"]

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

        cycle_usage = _usage_between(cycle_start, min(now, cycle_end))
        elapsed_days = max(1, (now.date() - cycle_start.date()).days + 1)
        days_in_cycle = max(1, (cycle_end.date() - cycle_start.date()).days)
        projected_cycle_usage = (cycle_usage / elapsed_days) * days_in_cycle
        projected_cost = projected_cycle_usage * payment_rate
        budget_usage_percent = (cycle_usage / target_kwh) * 100 if target_kwh > 0 else 0.0

        return Response(
            {
                "peak_usage_today": round(peak_usage_today, 4),
                "average_usage": round(average_usage, 4),
                "projected_cost": round(projected_cost, 2),
                "budget_usage_percent": round(budget_usage_percent, 2),
                "monthly_usage": round(cycle_usage, 4),
                "monthly_target_kwh": round(target_kwh, 4),
                "cycle_start_day": cycle_start_day,
            },
            status=status.HTTP_200_OK,
        )


class DashboardGoalTrackerView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        now = timezone.localtime(timezone.now())
        settings = _resolve_dashboard_settings(request, now)
        payment_rate = settings["payment_rate"]
        target_kwh = settings["target_kwh"]
        cycle_start = settings["cycle_start"]
        cycle_end = settings["cycle_end"]
        cycle_start_day = settings["cycle_start_day"]

        kwh_used = _usage_between(cycle_start, min(now, cycle_end))
        remaining_kwh = max(0.0, target_kwh - kwh_used)

        days_remaining = max(1, (cycle_end.date() - now.date()).days)
        daily_allowance = remaining_kwh / days_remaining

        cost_used = kwh_used * payment_rate
        cost_remaining = remaining_kwh * payment_rate

        percentage_used = (kwh_used / target_kwh) * 100 if target_kwh > 0 else 0.0
        if percentage_used >= 100:
            status_key = "exceeded"
        elif percentage_used >= 85:
            status_key = "at-risk"
        else:
            status_key = "on-track"

        return Response(
            {
                "kwh_used": round(kwh_used, 4),
                "monthly_target_kwh": round(target_kwh, 4),
                "percentage_used": round(min(percentage_used, 100.0), 2),
                "remaining": round(remaining_kwh, 4),
                "days_remaining": days_remaining,
                "daily_allowance": round(daily_allowance, 4),
                "cost_used": round(cost_used, 2),
                "cost_remaining": round(cost_remaining, 2),
                "status": status_key,
                "cycle_start_day": cycle_start_day,
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
        settings = _resolve_dashboard_settings(request, now)
        payment_rate = settings["payment_rate"]
        target_kwh = settings["target_kwh"]
        cycle_start = settings["cycle_start"]
        cycle_end = settings["cycle_end"]

        latest = ElectricalReading.objects.order_by("-timestamp").first()
        if latest:
            power = latest.power
            current = latest.current
        else:
            power = _to_float(request.query_params.get("power"), default=0.0)
            current = _to_float(request.query_params.get("current"), default=0.0)

        notifications = _build_notifications(
            now,
            target_kwh=target_kwh,
            payment_rate=payment_rate,
            cycle_start=cycle_start,
            cycle_end=cycle_end,
            power=power,
            current=current,
        )

        return Response(notifications, status=status.HTTP_200_OK)


class NilpFeedbackView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        appliance_name = str(request.data.get("appliance_name", "")).strip()
        power_jump_raw = request.data.get("power_jump_watts", request.data.get("power_jump"))
        current_jump_raw = request.data.get("current_jump_amps", request.data.get("current_jump"))
        retrain_now = _to_bool(request.data.get("retrain_now"), default=True)

        if not appliance_name:
            return Response(
                {"detail": "appliance_name is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            power_jump = float(power_jump_raw)
            current_jump = float(current_jump_raw)
        except (TypeError, ValueError):
            return Response(
                {"detail": "power_jump and current_jump must be numeric."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        dataset_path = _nilp_dataset_path()
        file_exists = os.path.exists(dataset_path)
        dataset_columns = []

        if file_exists and os.path.getsize(dataset_path) > 0:
            try:
                with open(dataset_path, "r", newline="", encoding="utf-8") as csvfile:
                    reader = csv.reader(csvfile)
                    dataset_columns = [str(column).strip() for column in next(reader, []) if str(column).strip()]
            except OSError:
                dataset_columns = []

        extended_header = [
            "Power_Jump_Watts",
            "Current_Jump_Amps",
            "Appliance_Name",
            "Event_Type",
            "Source",
            "Rated_Watts_Ref",
        ]

        try:
            with open(dataset_path, "a", newline="", encoding="utf-8") as csvfile:
                writer = csv.writer(csvfile)

                if not file_exists or os.path.getsize(dataset_path) == 0:
                    writer.writerow(extended_header)
                    dataset_columns = list(extended_header)

                normalized_columns = [column.lower() for column in dataset_columns]
                if "event_type" not in normalized_columns or "source" not in normalized_columns:
                    writer.writerow([power_jump, current_jump, appliance_name])
                else:
                    row_by_column = {
                        "power_jump_watts": power_jump,
                        "current_jump_amps": current_jump,
                        "appliance_name": appliance_name,
                        "event_type": "ON",
                        "source": "feedback_correction",
                        "rated_watts_ref": "",
                    }
                    writer.writerow([row_by_column.get(column.lower(), "") for column in dataset_columns])
        except OSError as error:
            return Response(
                {"detail": f"Failed to save NILP feedback: {error}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        retrained = False
        model_reloaded = False
        training_error = None

        if retrain_now:
            try:
                from ml_pipeline.train_model import train_and_save_model
                from .ml_service import appliance_ai

                train_and_save_model()
                retrained = True
                model_reloaded = bool(appliance_ai.reload_model())
            except Exception as error:
                training_error = str(error)

        return Response(
            {
                "status": "saved",
                "row": {
                    "Power_Jump_Watts": power_jump,
                    "Current_Jump_Amps": current_jump,
                    "Appliance_Name": appliance_name,
                    "Event_Type": "ON",
                    "Source": "feedback_correction",
                },
                "retrain_requested": retrain_now,
                "retrained": retrained,
                "model_reloaded": model_reloaded,
                "training_error": training_error,
            },
            status=status.HTTP_201_CREATED,
        )
    
from django.http import JsonResponse

def discover(request):
    host = request.get_host()

    forwarded_proto = request.META.get("HTTP_X_FORWARDED_PROTO", "")
    is_secure_request = request.is_secure() or forwarded_proto == "https"
    ws_scheme = "wss" if is_secure_request else "ws"
    ws_url = f"{ws_scheme}://{host}/ws/electrical/"

    return JsonResponse({
        "ws_url": ws_url
    })
    

from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.views.decorators.csrf import csrf_exempt
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .models import ElectricalReading


@csrf_exempt
@api_view(['POST'])
def ingest_reading(request):
    data = request.data

    # ================= SAVE TO DB =================
    ElectricalReading.objects.create(
        voltage=data.get("voltage", 0),
        current=data.get("current", 0),
        power=data.get("power", 0),
        kwh_consumption=data.get("kwh_consumption", 0),
    )

    # ================= PUSH TO CONSUMER =================
    channel_layer = get_channel_layer()

    async_to_sync(channel_layer.group_send)(
        "electrical_data_group",
        {
            "type": "receive_data",
            "data": data
        }
    )

    return Response({"status": "ok"})