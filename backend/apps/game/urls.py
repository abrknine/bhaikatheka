from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import GameSessionViewSet, LeaderboardView

app_name = "game"

router = DefaultRouter()
router.register("sessions", GameSessionViewSet, basename="session")

urlpatterns = [
    path("leaderboard/", LeaderboardView.as_view(), name="leaderboard"),
    path("", include(router.urls)),
]
