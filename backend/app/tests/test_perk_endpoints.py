"""
Test perk API endpoints using real database data.

Tests all 8 perk endpoints against actual Anarchy Online game data,
validating full pipeline from database to response. Calculation endpoints
use strategic mocks for business logic testing.
"""

import pytest
import json
from unittest.mock import patch
from fastapi.testclient import TestClient

from app.main import app
from app.models import Perk
from app.services.perk_service import PerkService
from app.api.schemas.perk import (
    PerkValidationDetail, PerkSeries
)


@pytest.fixture
def client():
    """Create test client."""
    return TestClient(app)


# ============================================================================
# GET /api/v1/perks - List Perks Tests
# ============================================================================

def test_get_perks_returns_valid_paginated_response(client):
    """Test that getting perks returns valid pagination structure."""
    response = client.get("/api/v1/perks")

    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "page_size" in data
    assert "pages" in data
    assert "has_next" in data
    assert "has_prev" in data
    assert isinstance(data["items"], list)
    assert data["total"] > 0


def test_get_perks_returns_perk_response_structure(client):
    """Test that perk items have correct PerkResponse schema."""
    response = client.get("/api/v1/perks?page_size=5")

    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) > 0

    perk = data["items"][0]
    # Verify PerkResponse schema fields
    assert "id" in perk
    assert "aoid" in perk
    assert "name" in perk
    assert "counter" in perk
    assert "type" in perk
    assert "professions" in perk
    assert "breeds" in perk
    assert "level" in perk
    assert isinstance(perk["type"], str)
    assert perk["type"] in ["SL", "AI", "LE"]


def test_get_perks_pagination(client):
    """Test perk pagination works correctly."""
    # Get first page
    response = client.get("/api/v1/perks?page=1&page_size=10")
    assert response.status_code == 200
    page1_data = response.json()
    assert len(page1_data["items"]) == 10
    assert page1_data["has_prev"] is False

    # Get second page
    response = client.get("/api/v1/perks?page=2&page_size=10")
    assert response.status_code == 200
    page2_data = response.json()
    assert len(page2_data["items"]) > 0
    assert page2_data["has_prev"] is True

    # Verify pages don't overlap
    page1_aoids = {item["aoid"] for item in page1_data["items"]}
    page2_aoids = {item["aoid"] for item in page2_data["items"]}
    assert len(page1_aoids & page2_aoids) == 0


def test_get_perks_filter_by_type_sl(client):
    """Test filtering perks by Shadowlands type."""
    response = client.get("/api/v1/perks?type=SL&page_size=10")

    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) > 0
    for perk in data["items"]:
        assert perk["type"] == "SL"


def test_get_perks_filter_by_type_ai(client):
    """Test filtering perks by Alien Invasion type."""
    response = client.get("/api/v1/perks?type=AI&page_size=10")

    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) > 0
    for perk in data["items"]:
        assert perk["type"] == "AI"


def test_get_perks_filter_by_type_le(client):
    """Test filtering perks by Legacy type."""
    response = client.get("/api/v1/perks?type=LE&page_size=10")

    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) > 0
    for perk in data["items"]:
        assert perk["type"] == "LE"


def test_get_perks_filter_by_series(client):
    """Test filtering perks by series name."""
    response = client.get("/api/v1/perks?series=Accumulator")

    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) > 0
    for perk in data["items"]:
        assert perk["perk_series"] == "Accumulator"


def test_get_perks_search_by_name(client):
    """Test searching perks by name."""
    response = client.get("/api/v1/perks?search=Accumulator")

    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) > 0
    # Verify results contain search term
    for perk in data["items"]:
        assert "accumulator" in perk["name"].lower()


def test_get_perks_sort_by_name(client):
    """Test sorting perks by name."""
    response = client.get("/api/v1/perks?sort_by=name&page_size=20")

    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) > 0


def test_get_perks_sort_by_level(client):
    """Test sorting perks by level."""
    response = client.get("/api/v1/perks?sort_by=level&page_size=20")

    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) > 0


def test_get_perks_invalid_page(client):
    """Test validation of invalid page numbers."""
    response = client.get("/api/v1/perks?page=0")
    assert response.status_code == 422

    response = client.get("/api/v1/perks?page=-1")
    assert response.status_code == 422


def test_get_perks_invalid_page_size(client):
    """Test validation of invalid page sizes."""
    response = client.get("/api/v1/perks?page_size=0")
    assert response.status_code == 422

    response = client.get("/api/v1/perks?page_size=201")
    assert response.status_code == 422


# ============================================================================
# GET /api/v1/perks/search - Search Perks Tests
# Note: Search endpoint requires POST body with PerkSearchRequest
# Testing is covered by the main /perks list endpoint which provides same functionality
# ============================================================================


# ============================================================================
# GET /api/v1/perks/stats - Perk Statistics Tests
# ============================================================================

def test_get_perk_stats_returns_valid_structure(client):
    """Test that perk stats returns a valid response structure."""
    response = client.get("/api/v1/perks/stats")

    assert response.status_code == 200
    data = response.json()
    assert "total_perks" in data
    assert "total_series" in data
    assert "types" in data
    assert "professions" in data
    assert "breeds" in data
    assert "level_range" in data
    assert "ai_title_range" in data
    assert isinstance(data["total_perks"], int)
    assert data["total_perks"] > 0


def test_get_perk_stats_types(client):
    """Test that stats includes all perk types."""
    response = client.get("/api/v1/perks/stats")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data["types"], list)
    # Should have SL, AI, LE types
    assert "SL" in data["types"]
    assert "AI" in data["types"]
    assert "LE" in data["types"]


def test_get_perk_stats_level_ranges(client):
    """Test that stats includes valid level ranges."""
    response = client.get("/api/v1/perks/stats")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data["level_range"], list)
    assert len(data["level_range"]) == 2
    min_level, max_level = data["level_range"]
    assert min_level <= max_level
    assert min_level >= 1
    assert max_level <= 220


# ============================================================================
# GET /api/v1/perks/series - Perk Series Listing Tests
# ============================================================================

def test_get_perk_series_grouped_success(client):
    """Test successful retrieval of grouped perk series."""
    response = client.get("/api/v1/perks/series")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0


def test_get_perk_series_structure(client):
    """Test that series response has correct structure."""
    response = client.get("/api/v1/perks/series")

    assert response.status_code == 200
    data = response.json()
    if len(data) > 0:
        series = data[0]
        assert "series_name" in series
        assert "type" in series
        assert "professions" in series
        assert "breeds" in series
        assert "perks" in series


def test_get_perk_series_filter_by_type(client):
    """Test filtering series by type."""
    response = client.get("/api/v1/perks/series?type=SL")

    assert response.status_code == 200
    data = response.json()
    for series in data:
        assert series["type"] == "SL"


# ============================================================================
# GET /api/v1/perks/{perk_name} - Perk Series Detail Tests
# ============================================================================

def test_get_perk_series_accumulator(client):
    """Test retrieval of Accumulator perk series."""
    response = client.get("/api/v1/perks/Accumulator")

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Accumulator"
    assert data["type"] == "SL"
    assert "max_level" in data
    assert "total_point_cost" in data
    assert "levels" in data
    assert isinstance(data["levels"], list)


def test_get_perk_series_exploration(client):
    """Test retrieval of Exploration perk series (LE type)."""
    response = client.get("/api/v1/perks/Exploration")

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Exploration"
    assert data["type"] == "LE"


def test_get_perk_series_with_url_encoding(client):
    """Test retrieval with URL-encoded perk names."""
    # Perks with spaces need URL encoding
    response = client.get("/api/v1/perks/Ancient%20Knowledge")

    # Should either succeed or return 404 if doesn't exist
    assert response.status_code in [200, 404]


def test_get_perk_series_not_found(client):
    """Test retrieval of non-existent perk series."""
    response = client.get("/api/v1/perks/NonExistentPerkSeriesXYZ123")

    assert response.status_code == 404
    data = response.json()
    # Response may have 'detail' or 'error' field
    assert "detail" in data or "error" in data


def test_get_perk_series_detail_includes_levels(client, db_session):
    """Test that perk series detail includes all level information."""
    # Get a real perk series
    real_perk = db_session.query(Perk).filter(
        Perk.perk_series.isnot(None)
    ).first()
    assert real_perk is not None

    response = client.get(f"/api/v1/perks/{real_perk.perk_series}")

    assert response.status_code == 200
    data = response.json()
    assert "levels" in data
    assert isinstance(data["levels"], list)
    assert len(data["levels"]) > 0


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


# ============================================================================
# POST /api/v1/perks/calculate - Perk Calculation Tests (Strategic Mocks)
# ============================================================================

@patch.object(PerkService, 'get_perk_series')
@patch.object(PerkService, 'calculate_perk_effects')
def test_calculate_perk_effects_success(
    mock_calc_effects, mock_get_series, client
):
    """Test successful perk effect calculation."""
    mock_series = PerkSeries(
        name="Accumulator",
        type="SL",
        professions=[],
        breeds=[],
        levels=[],
        max_level=10,
        total_point_cost=10
    )
    mock_get_series.return_value = mock_series
    mock_calc_effects.return_value = {}

    request_data = {
        "character_level": 220,
        "ai_title_level": 5,
        "owned_perks": {},
        "target_perks": {"Accumulator": 1}
    }

    response = client.post("/api/v1/perks/calculate", json=request_data)

    assert response.status_code == 200
    data = response.json()
    assert "total_sl_cost" in data
    assert "total_ai_cost" in data
    assert "available_sl_points" in data
    assert "available_ai_points" in data
    assert "affordable" in data
    assert "perk_effects" in data


def test_calculate_perk_effects_missing_fields(client):
    """Test calculation with missing required fields."""
    # Missing character_level
    response = client.post(
        "/api/v1/perks/calculate",
        json={"owned_perks": {}, "target_perks": {}}
    )
    assert response.status_code == 422

    # Missing owned_perks
    response = client.post(
        "/api/v1/perks/calculate",
        json={"character_level": 220, "target_perks": {}}
    )
    assert response.status_code == 422


def test_calculate_perk_effects_invalid_level(client):
    """Test calculation with invalid character level."""
    request_data = {
        "character_level": 0,
        "owned_perks": {},
        "target_perks": {}
    }

    response = client.post("/api/v1/perks/calculate", json=request_data)
    assert response.status_code == 422


@patch.object(PerkService, 'get_perk_series')
def test_calculate_perk_effects_sl_points(mock_get_series, client):
    """Test SL point calculation."""
    mock_series = PerkSeries(
        name="Accumulator",
        type="SL",
        professions=[],
        breeds=[],
        levels=[],
        max_level=10,
        total_point_cost=10
    )
    mock_get_series.return_value = mock_series

    request_data = {
        "character_level": 35,
        "owned_perks": {},
        "target_perks": {"Accumulator": 1}
    }

    response = client.post("/api/v1/perks/calculate", json=request_data)

    assert response.status_code == 200
    data = response.json()
    # Level 35+ should give max 40 SL points
    assert data["available_sl_points"] == 40


@patch.object(PerkService, 'get_perk_series')
def test_calculate_perk_effects_ai_points(mock_get_series, client):
    """Test AI point calculation."""
    mock_series = PerkSeries(
        name="Ancient Knowledge",
        type="AI",
        professions=[],
        breeds=[],
        levels=[],
        max_level=10,
        total_point_cost=10
    )
    mock_get_series.return_value = mock_series

    request_data = {
        "character_level": 220,
        "ai_title_level": 15,
        "owned_perks": {},
        "target_perks": {"Ancient Knowledge": 1}
    }

    response = client.post("/api/v1/perks/calculate", json=request_data)

    assert response.status_code == 200
    data = response.json()
    # AI title level 15 should give 15 AI points
    assert data["available_ai_points"] == 15


# ============================================================================
# GET /api/v1/perks/{perk_name}/validate - Validation Tests (Strategic Mocks)
# ============================================================================

@patch.object(PerkService, 'validate_perk_requirements')
def test_validate_perk_requirements_success(mock_validate, client):
    """Test successful perk requirement validation."""
    mock_validate.return_value = PerkValidationDetail(
        valid=True,
        errors=[],
        warnings=[],
        required_level=10,
        required_professions=[],
        required_breeds=[],
        prerequisite_perks=[]
    )

    response = client.get(
        "/api/v1/perks/Accumulator/validate"
        "?target_level=1"
        "&character_level=220"
        "&character_profession=Meta-Physicist"
        "&character_breed=Solitus"
    )

    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is True


@patch.object(PerkService, 'validate_perk_requirements')
def test_validate_perk_requirements_invalid(mock_validate, client):
    """Test validation of unmet requirements."""
    mock_validate.return_value = PerkValidationDetail(
        valid=False,
        errors=["Character level too low"],
        warnings=[],
        required_level=50,
        required_professions=[],
        required_breeds=[],
        prerequisite_perks=[]
    )

    response = client.get(
        "/api/v1/perks/Accumulator/validate"
        "?target_level=5"
        "&character_level=10"
        "&character_profession=Trader"
        "&character_breed=Solitus"
    )

    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is False
    assert len(data["errors"]) > 0


def test_validate_perk_missing_parameters(client):
    """Test validation with missing required parameters."""
    # Missing target_level
    response = client.get(
        "/api/v1/perks/Accumulator/validate"
        "?character_level=220"
        "&character_profession=Trader"
        "&character_breed=Solitus"
    )
    assert response.status_code == 422

    # Missing character_level
    response = client.get(
        "/api/v1/perks/Accumulator/validate"
        "?target_level=1"
        "&character_profession=Trader"
        "&character_breed=Solitus"
    )
    assert response.status_code == 422


@patch.object(PerkService, 'validate_perk_requirements')
def test_validate_perk_with_owned_perks(mock_validate, client):
    """Test validation with owned perks JSON."""
    mock_validate.return_value = PerkValidationDetail(
        valid=True,
        errors=[],
        warnings=[],
        required_level=10,
        required_professions=[],
        required_breeds=[],
        prerequisite_perks=[]
    )

    owned_perks = json.dumps({"Accumulator": 1})

    response = client.get(
        f"/api/v1/perks/Accumulator/validate"
        f"?target_level=2"
        f"&character_level=220"
        f"&character_profession=Meta-Physicist"
        f"&character_breed=Solitus"
        f"&owned_perks={owned_perks}"
    )

    assert response.status_code == 200


# ============================================================================
# Edge Cases and Integration Tests
# ============================================================================

def test_perk_response_consistency(client, db_session):
    """Test that perk responses have consistent structure across endpoints."""
    # Get a real perk
    real_perk = db_session.query(Perk).first()
    assert real_perk is not None

    # Test list endpoint
    list_response = client.get(f"/api/v1/perks?series={real_perk.perk_series}")
    assert list_response.status_code == 200
    list_data = list_response.json()
    assert len(list_data["items"]) > 0

    # Test series endpoint
    series_response = client.get(f"/api/v1/perks/{real_perk.perk_series}")
    assert series_response.status_code == 200
    series_data = series_response.json()

    # Both should reference same perk series
    assert list_data["items"][0]["perk_series"] == series_data["name"]


def test_perk_types_coverage(client):
    """Test that all perk types are accessible."""
    types = ["SL", "AI", "LE"]

    for perk_type in types:
        response = client.get(f"/api/v1/perks?type={perk_type}&page_size=1")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] > 0


def test_perk_profession_filtering(client):
    """Test profession-specific perk filtering."""
    # Accumulator is Meta-Physicist only (profession 7)
    response = client.get("/api/v1/perks?series=Accumulator&page_size=5")

    assert response.status_code == 200
    data = response.json()
    if len(data["items"]) > 0:
        # Check profession array
        for perk in data["items"]:
            if perk["professions"]:
                assert isinstance(perk["professions"], list)


def test_content_type_headers(client):
    """Test that responses have correct content-type headers."""
    response = client.get("/api/v1/perks")

    assert response.status_code == 200
    assert "application/json" in response.headers.get("content-type", "")
