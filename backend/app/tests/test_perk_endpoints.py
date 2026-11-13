"""
Test perk API endpoints using real database data.

Tests the batch perk lookup endpoint against actual Anarchy Online game data,
validating the full pipeline from database to response.
"""

# ============================================================================
# POST /api/v1/perks/batch/lookup - Perk Lookup Tests
# ============================================================================


def test_batch_lookup_returns_perks_in_request_order(client):
    """The Accumulator series is looked up by AOID, one result per AOID."""
    aoids = [210830, 210831, 210832]  # Accumulator counter 1, 2, 3

    response = client.post("/api/v1/perks/batch/lookup", json={"aoids": aoids})

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["errors"] == []
    assert [result["aoid"] for result in data["results"]] == aoids
    for counter, result in enumerate(data["results"], start=1):
        assert result["success"] is True
        assert result["perk"]["name"] == "Accumulator"
        assert result["perk"]["counter"] == counter
        assert result["perk"]["type"] == "SL"


def test_batch_lookup_reports_an_unknown_aoid(client):
    """An AOID that is not a perk fails on its own; the rest still resolve."""
    response = client.post(
        "/api/v1/perks/batch/lookup", json={"aoids": [210830, 999999999]}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    found, missing = data["results"]
    assert found["success"] is True
    assert found["perk"]["name"] == "Accumulator"
    assert missing == {
        "aoid": 999999999,
        "success": False,
        "perk": None,
        "error": "Perk with AOID 999999999 not found",
    }
    assert data["errors"] == ["Perk 999999999 not found"]


def test_batch_lookup_rejects_invalid_aoids(client):
    """AOIDs must be integers."""
    response = client.post("/api/v1/perks/batch/lookup", json={"aoids": ["invalid"]})
    assert response.status_code == 422
