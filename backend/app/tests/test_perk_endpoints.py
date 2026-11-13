"""
Test perk API endpoints using real database data.

Tests the perk lookup endpoint against actual Anarchy Online game data,
validating the full pipeline from database to response.
"""

# ============================================================================
# GET /api/v1/perks/lookup/{aoid} - Perk Lookup Tests
# ============================================================================


def test_lookup_perk_by_aoid_accumulator(client):
    """Test successful perk lookup by AOID for Accumulator."""
    # AOID 210830 = Accumulator counter 1
    response = client.get("/api/v1/perks/lookup/210830")

    assert response.status_code == 200
    data = response.json()
    assert data is not None
    assert data["name"] == "Accumulator"
    assert data["counter"] == 1
    assert data["type"] == "SL"


def test_lookup_perk_by_aoid_not_found(client):
    """Test lookup of non-existent AOID."""
    response = client.get("/api/v1/perks/lookup/999999999")

    assert response.status_code == 200
    # Returns null body for easier handling in frontend
    assert response.json() is None


def test_lookup_perk_invalid_aoid(client):
    """Test lookup with invalid AOID."""
    response = client.get("/api/v1/perks/lookup/invalid")
    assert response.status_code == 422


def test_lookup_perk_multiple_aoids(client):
    """Test lookup for multiple known AOIDs."""
    # Test Accumulator series
    aoids = [210830, 210831, 210832]  # Counter 1, 2, 3

    for i, aoid in enumerate(aoids, start=1):
        response = client.get(f"/api/v1/perks/lookup/{aoid}")
        assert response.status_code == 200
        data = response.json()
        assert data is not None
        assert data["name"] == "Accumulator"
        assert data["counter"] == i
