"""
URL configuration for backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.http import HttpResponse, JsonResponse
from django.urls import path, include #type: ignore


def root_status(request):
    return JsonResponse({
        "status": "ok",
        "service": "sems-backend",
    })


def websocket_upgrade_required(request):
    return JsonResponse(
        {
            "detail": "Use a WebSocket client with wss://<host>/ws/electrical/ (HTTP GET is not supported on this path).",
            "path": "/ws/electrical/",
            "protocol": "websocket",
        },
        status=426,
    )


def favicon_placeholder(request):
    return HttpResponse(status=204)

urlpatterns = [
    path('', root_status, name='root-status'),
    path('favicon.ico', favicon_placeholder, name='favicon-placeholder'),
    path('ws/electrical/', websocket_upgrade_required, name='ws-upgrade-required'),
    path('admin/', admin.site.urls),
    path('electrical/', include('electrical_processing.urls')),
    path('api/electrical/', include('electrical_processing.urls'))
]
