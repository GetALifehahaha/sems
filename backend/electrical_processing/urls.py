from django.urls import path

from .views import (
    ElectricReadingCreateView,
    ElectricalPeriodicReadingView, 
    ElectricalReadingView
)

urlpatterns = [
    path("readings-create/", ElectricReadingCreateView.as_view(), name="create-reading"),
    path("readings-periodic/", ElectricalPeriodicReadingView.as_view(), name="periodic-reading"),
    path("readings/", ElectricalReadingView.as_view(), name="daily-usage"),
]
