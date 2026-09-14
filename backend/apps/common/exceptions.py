"""One consistent error shape for the whole API, so clients parse one thing:

    {"error": {"code": "validation_error", "message": "...", "details": {...}}}
"""

import logging

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def api_exception_handler(exc, context):
    if isinstance(exc, DjangoValidationError):
        return _error("validation_error", "Invalid input.", status.HTTP_400_BAD_REQUEST, exc.message_dict if hasattr(exc, "message_dict") else exc.messages)
    if isinstance(exc, IntegrityError):
        logger.warning("IntegrityError in %s: %s", context.get("view"), exc)
        return _error("conflict", "That conflicts with existing data.", status.HTTP_409_CONFLICT)

    response = exception_handler(exc, context)
    if response is None:
        return None  # unhandled -> Django's 500 handling (and your error tracker)

    detail = response.data
    code = getattr(exc, "default_code", "error")
    if isinstance(detail, dict) and "detail" in detail:
        message, details = str(detail["detail"]), None
    elif isinstance(detail, dict):
        message, details = "Invalid input.", detail
    else:
        message, details = "Request failed.", detail
    response.data = {"error": {"code": code, "message": message, "details": details}}
    return response


def _error(code, message, status_code, details=None):
    return Response({"error": {"code": code, "message": message, "details": details}}, status=status_code)
