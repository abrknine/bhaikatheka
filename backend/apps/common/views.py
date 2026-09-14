from django.db import connection
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    """Liveness + DB check. Point your host's health check at /api/v1/health/."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            database = "ok"
    except Exception:  # noqa: BLE001 - report any DB failure as unhealthy
        database = "error"
    return Response({"status": "ok" if database == "ok" else "degraded", "database": database, "time": timezone.now()})
