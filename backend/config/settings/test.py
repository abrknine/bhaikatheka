"""Settings used by pytest: in-memory DB, fast hashing, no throttling."""

from .base import *  # noqa: F403
from .base import REST_FRAMEWORK

DEBUG = False

DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

# Throttling off entirely: rate limits make tests flaky and slow.
REST_FRAMEWORK = {**REST_FRAMEWORK, "DEFAULT_THROTTLE_CLASSES": (), "DEFAULT_THROTTLE_RATES": {}}

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}
