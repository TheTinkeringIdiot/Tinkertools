"""
Tests for the interpolation endpoints:

    GET  /items/{aoid}/interpolate
    GET  /items/{aoid}/interpolation-info
    POST /items/batch/interpolate

They read the content-addressed store; each test serves a build of a
throwaway store (the ``store`` fixture). What interpolation computes is
covered in test_interpolation_service.py.
"""

import os

import pytest

from app.services.interpolation import InterpolationService
from app.tests.fixtures.store_fixtures import item, modify

pytestmark = pytest.mark.skipif(
    not os.getenv("DATABASE_URL", "").startswith("postgres"), reason="needs PostgreSQL"
)

STAMINA = 17


def rifle(aoid, ql, name="Rifle"):
    return item(
        aoid,
        name=name,
        ql=ql,
        stats=[(STAMINA, ql * 2)],
        SpellData=[{"Event": 14, "Items": [modify(124, ql)]}],
    )


@pytest.fixture
def client(store):
    store.add_build(
        "b1",
        1,
        items=[rifle(201, 1), rifle(202, 101), rifle(203, 201), rifle(300, 50, "Lamp")],
    )
    with store.client("b1") as test_client:
        yield test_client


def stats_of(item_json):
    return {entry["stat"]: entry["value"] for entry in item_json["stats"]}


# ---------------------------------------------------------------------------
# GET /items/{aoid}/interpolate
# ---------------------------------------------------------------------------


def test_interpolate_returns_the_item_at_the_target_ql(client):
    response = client.get("/api/v1/items/201/interpolate?target_ql=51")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/json"
    data = response.json()
    assert (data["success"], data["error"]) == (True, None)
    assert data["interpolation_range"] == {"min_ql": 1, "max_ql": 201}
    interpolated = data["item"]
    assert (interpolated["aoid"], interpolated["id"]) == (201, 201)
    assert (interpolated["name"], interpolated["ql"]) == ("Rifle", 51)
    assert (interpolated["interpolating"], interpolated["target_ql"]) == (True, 51)
    assert (interpolated["low_ql"], interpolated["high_ql"]) == (1, 101)
    assert (interpolated["ql_delta"], interpolated["ql_delta_full"]) == (50, 100)
    assert stats_of(interpolated)[STAMINA] == 102
    assert interpolated["actions"] == []
    assert interpolated["spell_data"] == [
        {
            "event": 14,
            "spells": [
                {
                    "target": 2,
                    "tick_count": 1,
                    "tick_interval": 0,
                    "spell_id": 53045,
                    "spell_format": "Modify {Stat} {Amount}",
                    "spell_params": {
                        "Stat": 124,
                        "Amount": 51,
                        "SpellDescription": "Modify 124 1",
                    },
                    "criteria": [],
                }
            ],
        }
    ]


def test_interpolate_an_item_with_one_variant(client):
    data = client.get("/api/v1/items/300/interpolate?target_ql=120").json()

    assert data["success"] is True
    assert (data["item"]["ql"], data["item"]["interpolating"]) == (120, False)
    assert data["interpolation_range"] == {"min_ql": 50, "max_ql": 50}


def test_interpolate_an_unknown_item_reports_failure_in_the_body(client):
    response = client.get("/api/v1/items/99999/interpolate?target_ql=150")

    assert response.status_code == 200
    data = response.json()
    assert (data["success"], data["item"]) == (False, None)
    assert "Item with AOID 99999 not found" in data["error"]


def test_interpolate_reports_an_unexpected_failure_in_the_body(client, monkeypatch):
    def fail(self, aoid, target_ql):
        raise RuntimeError("Database error")

    monkeypatch.setattr(InterpolationService, "interpolate_item", fail)

    response = client.get("/api/v1/items/201/interpolate?target_ql=150")

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert data["error"] == "Failed to interpolate item: Database error"


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/items/201/interpolate?target_ql=0",
        "/api/v1/items/201/interpolate?target_ql=501",
        "/api/v1/items/201/interpolate",
        "/api/v1/items/invalid/interpolate?target_ql=150",
    ],
)
def test_interpolate_rejects_invalid_input(client, path):
    assert client.get(path).status_code == 422


@pytest.mark.parametrize("target_ql", [1, 500])
def test_interpolate_accepts_the_limits_of_the_ql_range(client, target_ql):
    response = client.get(f"/api/v1/items/201/interpolate?target_ql={target_ql}")

    assert response.status_code == 200
    assert response.json()["item"]["ql"] == target_ql


# ---------------------------------------------------------------------------
# GET /items/{aoid}/interpolation-info
# ---------------------------------------------------------------------------


def test_interpolation_info_lists_the_ranges_between_variants(client):
    response = client.get("/api/v1/items/202/interpolation-info")

    assert response.status_code == 200
    assert response.json() == {
        "aoid": 202,
        "interpolatable": True,
        "ranges": [
            {"min_ql": 1, "max_ql": 101, "interpolatable": True, "base_aoid": 201},
            {"min_ql": 101, "max_ql": 201, "interpolatable": True, "base_aoid": 202},
            {"min_ql": 201, "max_ql": 201, "interpolatable": False, "base_aoid": 203},
        ],
        "min_ql": 1,
        "max_ql": 201,
        "ql_range": 201,
    }


def test_interpolation_info_of_an_item_with_one_variant(client):
    response = client.get("/api/v1/items/300/interpolation-info")

    assert response.status_code == 200
    assert response.json() == {
        "aoid": 300,
        "interpolatable": False,
        "ranges": [
            {"min_ql": 50, "max_ql": 50, "interpolatable": False, "base_aoid": 300}
        ],
        "min_ql": 50,
        "max_ql": 50,
        "ql_range": 1,
    }


def test_interpolation_info_of_an_unknown_item_is_not_found(client):
    response = client.get("/api/v1/items/99999/interpolation-info")

    assert response.status_code == 404
    assert response.json() == {
        "error": "Item with AOID 99999 not found",
        "code": "HTTP_404",
    }


def test_interpolation_info_answers_500_on_an_unexpected_failure(client, monkeypatch):
    def fail(self, aoid):
        raise RuntimeError("Database error")

    monkeypatch.setattr(InterpolationService, "get_interpolation_ranges", fail)

    response = client.get("/api/v1/items/201/interpolation-info")

    assert response.status_code == 500
    assert "Failed to get interpolation info: Database error" in str(response.json())


# ---------------------------------------------------------------------------
# POST /items/batch/interpolate
# ---------------------------------------------------------------------------


def batch(client, *requests):
    return client.post(
        "/api/v1/items/batch/interpolate",
        json={"items": [{"aoid": a, "target_ql": q} for a, q in requests]},
    )


def test_batch_results_come_back_in_request_order(client):
    response = batch(client, (300, 10), (201, 51), (203, 151), (201, 300))

    assert response.status_code == 200
    data = response.json()
    assert (data["success"], data["errors"]) == (True, [])
    assert [(r["aoid"], r["target_ql"], r["success"]) for r in data["results"]] == [
        (300, 10, True),
        (201, 51, True),
        (203, 151, True),
        (201, 300, True),
    ]
    items = [result["item"] for result in data["results"]]
    assert [(i["aoid"], i["ql"], i["interpolating"]) for i in items] == [
        (300, 10, False),
        (201, 51, True),
        (202, 151, True),
        (203, 300, False),
    ]


def test_batch_results_equal_the_single_endpoint(client):
    requests = [(201, 51), (202, 150), (300, 70), (203, 1)]

    results = batch(client, *requests).json()["results"]

    for (aoid, target_ql), result in zip(requests, results):
        single = client.get(
            f"/api/v1/items/{aoid}/interpolate", params={"target_ql": target_ql}
        ).json()
        assert result["item"] == single["item"]


def test_batch_reports_unknown_items_without_failing_the_others(client):
    data = batch(client, (201, 51), (99999, 100)).json()

    assert data["success"] is False
    assert data["errors"] == ["Item with AOID 99999 not found"]
    found, missing = data["results"]
    assert (found["success"], found["item"]["aoid"]) == (True, 201)
    assert missing == {
        "aoid": 99999,
        "target_ql": 100,
        "success": False,
        "item": None,
        "error": "Item with AOID 99999 not found",
    }


def test_an_empty_batch_succeeds(client):
    assert batch(client).json() == {"success": True, "results": [], "errors": []}


def test_batch_rejects_more_than_100_items_and_invalid_qls(client):
    assert batch(client, *[(201, 50)] * 101).status_code == 422
    assert batch(client, (201, 0)).status_code == 422


def test_a_batch_costs_as_many_queries_as_one_item(store):
    families = [
        rifle(aoid, ql, name=f"Rifle {family}")
        for family in range(30)
        for aoid, ql in ((1000 + family, 1), (2000 + family, 200))
    ]
    store.add_build("b1", 1, items=families)

    with store.client("b1") as client:
        with store.counting_queries() as one:
            batch(client, (1000, 100))
        with store.counting_queries() as many:
            response = batch(client, *[(1000 + n, 100) for n in range(30)])

    assert all(result["item"]["interpolating"] for result in response.json()["results"])
    assert 0 < len(many) == len(one) <= 3
