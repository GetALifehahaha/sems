from django.urls import path #type: ignore

from .views import (
    ElectricReadingCreateView,
    ElectricalPeriodicReadingView, 
    ElectricalReadingView,
    LatestElectricalReadingView
)

urlpatterns = [
    path("readings-create/", ElectricReadingCreateView.as_view(), name="create-reading"),
    path("readings-periodic/", ElectricalPeriodicReadingView.as_view(), name="periodic-reading"),
    path("readings/", ElectricalReadingView.as_view(), name="daily-usage"),
    path("readings-latest/", LatestElectricalReadingView.as_view(), name="latest-reading"),
]