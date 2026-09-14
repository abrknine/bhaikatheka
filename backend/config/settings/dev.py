"""Local development settings. Never use these in production."""

from .base import *  # noqa: F403
from .base import REST_FRAMEWORK, env

DEBUG = True
ALLOWED_HOSTS = ["*"]

# Browsable API is handy while poking at endpoints by hand.
REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] = (
    "rest_framework.renderers.JSONRenderer",
    "rest_framework.renderers.BrowsableAPIRenderer",
)

# No manifest hashing in dev (avoids needing collectstatic).
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}

# Any localhost port may call the API while developing.
CORS_ALLOW_ALL_ORIGINS = env.bool("CORS_ALLOW_ALL_ORIGINS", default=True)

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
