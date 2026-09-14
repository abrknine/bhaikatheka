from rest_framework import serializers

from .models import GameSession


class GameSessionSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(source="user.display_name", read_only=True)

    class Meta:
        model = GameSession
        fields = [
            "id",
            "display_name",
            "jars",
            "litres_drunk",
            "litres_spilled",
            "bottles_opened",
            "peak_drunk",
            "duration_seconds",
            "created_at",
        ]
        read_only_fields = ["id", "display_name", "created_at"]


class LeaderboardEntrySerializer(serializers.Serializer):
    """Read-only view over an aggregate query, not a model."""

    display_name = serializers.CharField(source="user__display_name")
    jars = serializers.IntegerField()
    litres = serializers.DecimalField(max_digits=10, decimal_places=2)
    sessions = serializers.IntegerField()
