"""Root URL config. All API routes are versioned under /api/v1/."""

from django.contrib import admin
from django.urls import include, path

from apps.common.views import health

api_v1 = [
    path("health/", health, name="health"),
    path("auth/", include("apps.accounts.urls")),
    path("game/", include("apps.game.urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include((api_v1, "v1"))),
]
