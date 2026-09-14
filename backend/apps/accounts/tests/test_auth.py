import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse

User = get_user_model()
pytestmark = pytest.mark.django_db


def test_register_returns_tokens_and_creates_user(api_client):
    response = api_client.post(
        reverse("v1:accounts:register"),
        {"email": "New@Theka.test", "password": "thandi-beer-123"},
    )
    assert response.status_code == 201
    assert response.data["access"] and response.data["refresh"]
    assert response.data["user"]["email"] == "new@theka.test"
    assert response.data["user"]["display_name"] == "new"
    assert User.objects.filter(email="new@theka.test").exists()


def test_register_rejects_weak_password(api_client):
    response = api_client.post(reverse("v1:accounts:register"), {"email": "a@b.test", "password": "123"})
    assert response.status_code == 400
    assert response.data["error"]["details"]["password"]


def test_register_rejects_duplicate_email(api_client, user):
    response = api_client.post(reverse("v1:accounts:register"), {"email": user.email, "password": "thandi-beer-123"})
    assert response.status_code == 400


def test_login_and_me(api_client, user):
    login = api_client.post(reverse("v1:accounts:login"), {"email": user.email, "password": "thandi-beer-123"})
    assert login.status_code == 200
    assert login.data["user"]["email"] == user.email

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
    me = api_client.get(reverse("v1:accounts:me"))
    assert me.status_code == 200
    assert me.data["email"] == user.email


def test_me_requires_authentication(api_client):
    assert api_client.get(reverse("v1:accounts:me")).status_code == 401


def test_me_can_update_display_name(auth_client, user):
    response = auth_client.patch(reverse("v1:accounts:me"), {"display_name": "Bunty Bhai"})
    assert response.status_code == 200
    user.refresh_from_db()
    assert user.display_name == "Bunty Bhai"


def test_logout_blacklists_refresh_token(api_client, user):
    login = api_client.post(reverse("v1:accounts:login"), {"email": user.email, "password": "thandi-beer-123"})
    refresh = login.data["refresh"]
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

    assert api_client.post(reverse("v1:accounts:logout"), {"refresh": refresh}).status_code == 204
    # the blacklisted token can no longer be exchanged
    assert api_client.post(reverse("v1:accounts:refresh"), {"refresh": refresh}).status_code == 401
