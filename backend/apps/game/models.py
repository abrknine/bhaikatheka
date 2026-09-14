"""Example domain app — the pattern to copy for anything else you add.

A GameSession is one round played in the theka: how many jars went down,
how much was drunk, how much ended up on the table.
"""

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from apps.common.models import BaseModel


class GameSession(BaseModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sessions")
    jars = models.PositiveIntegerField(default=0)
    litres_drunk = models.DecimalField(max_digits=6, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    litres_spilled = models.DecimalField(max_digits=6, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    bottles_opened = models.PositiveIntegerField(default=0)
    peak_drunk = models.DecimalField(
        max_digits=4, decimal_places=2, default=0, validators=[MinValueValidator(0)],
        help_text="Highest talli-meter value reached (0–1.3).",
    )
    duration_seconds = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["-jars"]),
        ]

    def __str__(self) -> str:
        return f"{self.user.display_name}: {self.jars} jars"
