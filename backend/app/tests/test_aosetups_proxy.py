"""
Tests for GET /aosetups/profile/{profile_id}, the proxy to the AO Setups site.

The route forwards one request and reads no game data. The outbound request
is stubbed: nothing here reaches the site.
"""

import httpx
import pytest
from fastapi.testclient import TestClient

from app.api.routes import aosetups
from app.main import app
from app.store.context import get_store

PROFILE_ID = "5f1a2b3c4d5e6f7a8b9c0d1e"
PROFILE = {"name": "Tester", "implants": [{"slot": "eye", "clusters": {}}]}


class Outbound:
    """Stands in for ``httpx.AsyncClient``; records the requests made."""

    def __init__(self, respond):
        self.respond = respond
        self.requests = []

    def __call__(self, **kwargs):
        return self

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def get(self, url, headers=None):
        self.requests.append(url)
        return self.respond(httpx.Request("GET", url))


@pytest.fixture
def proxy(monkeypatch):
    """``proxy(respond)`` -> (API client, outbound stub). Any use of a
    database session by the route fails the test."""

    def no_database():
        raise AssertionError("the AO Setups proxy must not read the database")

    def make(respond):
        outbound = Outbound(respond)
        monkeypatch.setattr(aosetups.httpx, "AsyncClient", outbound)
        return TestClient(app), outbound

    app.dependency_overrides[get_store] = no_database
    yield make
    app.dependency_overrides.pop(get_store, None)


def test_the_profile_is_passed_through_as_the_site_returns_it(proxy):
    client, outbound = proxy(lambda request: httpx.Response(200, json=PROFILE))

    response = client.get(f"/api/v1/aosetups/profile/{PROFILE_ID}")

    assert (response.status_code, response.json()) == (200, PROFILE)
    assert outbound.requests == [f"https://www.aosetups.com/api/equip/{PROFILE_ID}"]


def test_the_profile_is_the_same_under_every_game_version(proxy):
    client, outbound = proxy(lambda request: httpx.Response(200, json=PROFILE))

    response = client.get(f"/api/v1/prk/aosetups/profile/{PROFILE_ID}")

    assert (response.status_code, response.json()) == (200, PROFILE)
    assert len(outbound.requests) == 1


def test_a_malformed_profile_id_is_rejected_without_asking_the_site(proxy):
    client, outbound = proxy(lambda request: httpx.Response(200, json=PROFILE))

    for profile_id in ("abc", PROFILE_ID.upper(), PROFILE_ID + "0", "g" * 24):
        assert client.get(f"/api/v1/aosetups/profile/{profile_id}").status_code == 400
    assert outbound.requests == []


def test_a_site_that_cannot_be_reached_is_a_gateway_error(proxy):
    def unreachable(request):
        raise httpx.ConnectError("no route", request=request)

    def too_slow(request):
        raise httpx.ReadTimeout("slow", request=request)

    client, _ = proxy(unreachable)
    assert client.get(f"/api/v1/aosetups/profile/{PROFILE_ID}").status_code == 502
    client, _ = proxy(too_slow)
    assert client.get(f"/api/v1/aosetups/profile/{PROFILE_ID}").status_code == 504


def test_a_profile_the_site_does_not_have_is_not_found(proxy):
    client, outbound = proxy(lambda request: httpx.Response(404, text="Not Found"))

    response = client.get(f"/api/v1/aosetups/profile/{PROFILE_ID}")

    assert response.status_code == 404
    assert PROFILE_ID in response.json()["error"]
    assert len(outbound.requests) == 1


@pytest.mark.parametrize("status", [403, 429, 500, 503])
def test_another_status_of_the_site_is_passed_on(proxy, status):
    client, _ = proxy(lambda request: httpx.Response(status, text="site says no"))

    response = client.get(f"/api/v1/aosetups/profile/{PROFILE_ID}")

    assert response.status_code == status
    assert f"status {status}" in response.json()["error"]
    assert "site says no" in response.json()["error"]


def test_an_answer_that_is_not_json_is_a_server_error(proxy):
    client, _ = proxy(lambda request: httpx.Response(200, text="<html>"))

    assert client.get(f"/api/v1/aosetups/profile/{PROFILE_ID}").status_code == 500
