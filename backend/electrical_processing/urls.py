from django.urls import path #type: ignore

from .views import (
    DashboardPreferenceView,
    ElectricReadingCreateView,
    ElectricalPeriodicReadingView,
    ElectricalReadingView,
    LatestElectricalReadingView,
    DashboardQuickStatsView,
    DashboardGoalTrackerView,
    DashboardHourlyBreakdownView,
    DashboardHistoricalComparisonView,
    ElectricalNotificationsView,
    NilpFeedbackView,
    discover,
)

urlpatterns = [
    # Reading ingestion and retrieval
    path("readings-create/", ElectricReadingCreateView.as_view(), name="create-reading"),
    path("readings/", ElectricalReadingView.as_view(), name="daily-usage"),
    path("readings/latest/", LatestElectricalReadingView.as_view(), name="latest-reading-rest"),
    path("readings/periodic/", ElectricalPeriodicReadingView.as_view(), name="periodic-reading-rest"),

    # Backward-compatible legacy routes
    path("readings-periodic/", ElectricalPeriodicReadingView.as_view(), name="periodic-reading"),
    path("readings-latest/", LatestElectricalReadingView.as_view(), name="latest-reading"),

    # Dashboard endpoints
    path("dashboard/quick-stats/", DashboardQuickStatsView.as_view(), name="dashboard-quick-stats"),
    path("dashboard/goal-tracker/", DashboardGoalTrackerView.as_view(), name="dashboard-goal-tracker"),
    path("dashboard/hourly-breakdown/", DashboardHourlyBreakdownView.as_view(), name="dashboard-hourly-breakdown"),
    path("dashboard/historical-comparison/", DashboardHistoricalComparisonView.as_view(), name="dashboard-historical-comparison"),
    path("preferences/", DashboardPreferenceView.as_view(), name="dashboard-preferences"),

    # Alerts
    path("notifications/", ElectricalNotificationsView.as_view(), name="notifications"),
    path("nilp-feedback/", NilpFeedbackView.as_view(), name="nilp-feedback"),
    path("discover/", discover),
]