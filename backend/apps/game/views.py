from django.db.models import Count, Sum
from rest_framework import generics, mixins, permissions, viewsets

from apps.common.permissions import IsOwner

from .models import GameSession
from .serializers import GameSessionSerializer, LeaderboardEntrySerializer


class GameSessionViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Your own sessions. Sessions are immutable once recorded."""

    serializer_class = GameSessionSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]
    ordering_fields = ["created_at", "jars", "litres_drunk"]
    ordering = ["-created_at"]

    def get_queryset(self):
        return GameSession.objects.filter(user=self.request.user).select_related("user")

    def perform_create(self, serializer):
        # Never trust a client-supplied user id.
        serializer.save(user=self.request.user)


class LeaderboardView(generics.ListAPIView):
    """Public top-20 by total jars."""

    serializer_class = LeaderboardEntrySerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):
        return (
            GameSession.objects.values("user__display_name")
            .annotate(jars=Sum("jars"), litres=Sum("litres_drunk"), sessions=Count("id"))
            .order_by("-jars", "-litres")[:20]
        )
