import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def user(db):
    return get_user_model().objects.create_user(email="bunty@theka.test", password="thandi-beer-123")


@pytest.fixture
def other_user(db):
    return get_user_model().objects.create_user(email="chhotu@theka.test", password="thandi-beer-123")


@pytest.fixture
def auth_client(api_client, user) -> APIClient:
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")
    return api_client
