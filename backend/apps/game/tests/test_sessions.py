import pytest
from django.urls import reverse

from apps.game.models import GameSession

pytestmark = pytest.mark.django_db

PAYLOAD = {
    "jars": 3,
    "litres_drunk": "2.40",
    "litres_spilled": "0.35",
    "bottles_opened": 4,
    "peak_drunk": "0.90",
    "duration_seconds": 420,
}


def test_create_session_is_attached_to_the_caller(auth_client, user):
    response = auth_client.post(reverse("v1:game:session-list"), PAYLOAD)
    assert response.status_code == 201
    session = GameSession.objects.get()
    assert session.user == user
    assert session.jars == 3
    assert response.data["display_name"] == user.display_name


def test_create_requires_authentication(api_client):
    assert api_client.post(reverse("v1:game:session-list"), PAYLOAD).status_code == 401


def test_client_cannot_spoof_the_owner(auth_client, user, other_user):
    auth_client.post(reverse("v1:game:session-list"), {**PAYLOAD, "user": str(other_user.id)})
    assert GameSession.objects.get().user == user


def test_list_only_returns_your_own_sessions(auth_client, user, other_user):
    GameSession.objects.create(user=user, jars=2)
    GameSession.objects.create(user=other_user, jars=9)

    response = auth_client.get(reverse("v1:game:session-list"))
    assert response.status_code == 200
    assert response.data["count"] == 1
    assert response.data["results"][0]["jars"] == 2


def test_cannot_read_someone_elses_session(auth_client, other_user):
    theirs = GameSession.objects.create(user=other_user, jars=9)
    assert auth_client.get(reverse("v1:game:session-detail", args=[theirs.id])).status_code == 404


def test_leaderboard_is_public_and_aggregates_per_user(api_client, user, other_user):
    GameSession.objects.create(user=user, jars=2, litres_drunk="1.50")
    GameSession.objects.create(user=user, jars=3, litres_drunk="2.00")
    GameSession.objects.create(user=other_user, jars=9, litres_drunk="7.00")

    response = api_client.get(reverse("v1:game:leaderboard"))
    assert response.status_code == 200
    assert [row["display_name"] for row in response.data] == [other_user.display_name, user.display_name]
    assert response.data[1]["jars"] == 5
    assert response.data[1]["sessions"] == 2
