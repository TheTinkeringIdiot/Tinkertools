"""
API Integration tests for perk system.

Tests the perk API endpoints to ensure:
- All filter parameter combinations work correctly
- Backward compatibility is maintained
- Performance is acceptable with complex queries
- Series grouping endpoint functions properly
- Error handling is robust
"""

import pytest
import json
from typing import Dict, Any, List
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch, MagicMock

from app.main import app
from app.api.schemas.perk import PerkResponse, PerkSeriesResponse, PerkStatsResponse


# Test client for API calls
client = TestClient(app)


class TestPerkAPIFiltering:
    """Test all filter parameter combinations for the main perks endpoint."""

    def test_get_perks_no_filters(self):
        """Test basic GET /perks without any filters."""
        response = client.get("/perks")

        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "pages" in data
        assert "has_next" in data
        assert "has_prev" in data

        # Verify pagination defaults
        assert data["page"] == 1
        assert data["page_size"] == 50
        assert data["has_prev"] is False

    def test_profession_filtering_by_name(self):
        """Test filtering perks by profession name."""
        response = client.get("/perks?profession=Agent")

        assert response.status_code == 200
        data = response.json()

        # If there are results, verify they match the profession filter
        if data["items"]:
            for perk in data["items"]:
                # Empty professions array means "all professions allowed"
                if perk["professions"]:
                    assert "Agent" in perk["professions"]

    def test_profession_filtering_by_id(self):
        """Test filtering perks by profession ID."""
        response = client.get("/perks?profession=5")  # Agent ID

        assert response.status_code == 200
        data = response.json()

        # Results should be the same as filtering by name
        if data["items"]:
            for perk in data["items"]:
                if perk["professions"]:
                    assert "Agent" in perk["professions"]

    def test_breed_filtering_by_name(self):
        """Test filtering perks by breed name."""
        response = client.get("/perks?breed=Atrox")

        assert response.status_code == 200
        data = response.json()

        if data["items"]:
            for perk in data["items"]:
                # Empty breeds array means "all breeds allowed"
                if perk["breeds"]:
                    assert "Atrox" in perk["breeds"]

    def test_breed_filtering_by_id(self):
        """Test filtering perks by breed ID."""
        response = client.get("/perks?breed=2")  # Atrox ID

        assert response.status_code == 200
        data = response.json()

        if data["items"]:
            for perk in data["items"]:
                if perk["breeds"]:
                    assert "Atrox" in perk["breeds"]

    def test_type_filtering(self):
        """Test filtering perks by type (SL/AI/LE)."""
        for perk_type in ["SL", "AI", "LE"]:
            response = client.get(f"/perks?type={perk_type}")

            assert response.status_code == 200
            data = response.json()

            if data["items"]:
                for perk in data["items"]:
                    assert perk["type"] == perk_type

    def test_level_filtering(self):
        """Test filtering perks by level requirements."""
        # Test min_level
        response = client.get("/perks?min_level=50")
        assert response.status_code == 200
        data = response.json()

        if data["items"]:
            for perk in data["items"]:
                assert perk["level"] >= 50

        # Test max_level
        response = client.get("/perks?max_level=100")
        assert response.status_code == 200
        data = response.json()

        if data["items"]:
            for perk in data["items"]:
                assert perk["level"] <= 100

        # Test level range
        response = client.get("/perks?min_level=50&max_level=100")
        assert response.status_code == 200
        data = response.json()

        if data["items"]:
            for perk in data["items"]:
                assert 50 <= perk["level"] <= 100

    def test_ai_level_filtering(self):
        """Test filtering perks by AI title level requirement."""
        response = client.get("/perks?ai_level=15")

        assert response.status_code == 200
        data = response.json()

        if data["items"]:
            for perk in data["items"]:
                # Only perks with AI title requirements should be returned
                # and they should be <= 15
                if perk["ai_title"] is not None:
                    assert perk["ai_title"] <= 15

    def test_series_filtering(self):
        """Test filtering perks by series name."""
        response = client.get("/perks?series=Aimed Shot")

        assert response.status_code == 200
        data = response.json()

        if data["items"]:
            for perk in data["items"]:
                assert perk["perk_series"] == "Aimed Shot"

    def test_search_filtering(self):
        """Test filtering perks by search query."""
        response = client.get("/perks?search=accuracy")

        assert response.status_code == 200
        data = response.json()

        if data["items"]:
            for perk in data["items"]:
                # Case-insensitive search in perk name
                assert "accuracy" in perk["name"].lower()

    def test_combined_filters(self):
        """Test multiple filters applied together."""
        params = {
            "type": "SL",
            "profession": "Agent",
            "min_level": 10,
            "max_level": 50
        }

        response = client.get("/perks", params=params)

        assert response.status_code == 200
        data = response.json()

        if data["items"]:
            for perk in data["items"]:
                assert perk["type"] == "SL"
                assert 10 <= perk["level"] <= 50
                if perk["professions"]:
                    assert "Agent" in perk["professions"]

    def test_character_compatibility_filtering(self):
        """Test character-specific filtering parameters."""
        params = {
            "character_level": 100,
            "character_profession": "Agent",
            "character_breed": "Solitus",
            "ai_title_level": 15,
            "available_sl_points": 20,
            "available_ai_points": 10
        }

        response = client.get("/perks", params=params)

        assert response.status_code == 200
        data = response.json()

        # Character filtering is applied in the service layer
        # Just verify the request succeeds and follows expected structure
        if data["items"]:
            for perk in data["items"]:
                # Perks should be compatible with character constraints
                assert perk["level"] <= 100
                if perk["ai_title"] is not None:
                    assert perk["ai_title"] <= 15

    @pytest.mark.parametrize("sort_by,sort_desc", [
        ("name", False),
        ("name", True),
        ("level", False),
        ("level", True),
        ("type", False),
        ("type", True),
        ("counter", False),
        ("counter", True)
    ])
    def test_sorting_options(self, sort_by: str, sort_desc: bool):
        """Test different sorting options."""
        params = {
            "sort_by": sort_by,
            "sort_desc": sort_desc
        }

        response = client.get("/perks", params=params)

        assert response.status_code == 200
        data = response.json()

        if len(data["items"]) >= 2:
            # Verify sorting is applied correctly
            items = data["items"]
            for i in range(len(items) - 1):
                current = items[i]
                next_item = items[i + 1]

                if sort_by == "name":
                    if sort_desc:
                        assert current["name"] >= next_item["name"]
                    else:
                        assert current["name"] <= next_item["name"]
                elif sort_by == "level":
                    if sort_desc:
                        assert current["level"] >= next_item["level"]
                    else:
                        assert current["level"] <= next_item["level"]
                elif sort_by == "type":
                    if sort_desc:
                        assert current["type"] >= next_item["type"]
                    else:
                        assert current["type"] <= next_item["type"]
                elif sort_by == "counter":
                    if sort_desc:
                        assert current["counter"] >= next_item["counter"]
                    else:
                        assert current["counter"] <= next_item["counter"]

    def test_pagination(self):
        """Test pagination parameters."""
        # Test first page
        response = client.get("/perks?page=1&page_size=10")
        assert response.status_code == 200
        page1_data = response.json()

        assert page1_data["page"] == 1
        assert page1_data["page_size"] == 10
        assert len(page1_data["items"]) <= 10

        # If there are more than 10 items total, test second page
        if page1_data["total"] > 10:
            response = client.get("/perks?page=2&page_size=10")
            assert response.status_code == 200
            page2_data = response.json()

            assert page2_data["page"] == 2
            assert page2_data["page_size"] == 10

            # Verify pages don't contain same items
            page1_ids = {item["id"] for item in page1_data["items"]}
            page2_ids = {item["id"] for item in page2_data["items"]}
            assert page1_ids.isdisjoint(page2_ids)

    def test_invalid_pagination(self):
        """Test invalid pagination parameters."""
        # Test page 0
        response = client.get("/perks?page=0")
        assert response.status_code == 422  # Validation error

        # Test negative page size
        response = client.get("/perks?page_size=-1")
        assert response.status_code == 422  # Validation error

        # Test excessive page size
        response = client.get("/perks?page_size=1000")
        assert response.status_code == 422  # Validation error


class TestPerkAPIBackwardCompatibility:
    """Test that API changes maintain backward compatibility."""

    def test_response_schema_compatibility(self):
        """Test that response schema contains all expected legacy fields."""
        response = client.get("/perks")

        assert response.status_code == 200
        data = response.json()

        if data["items"]:
            perk = data["items"][0]

            # Verify all essential fields are present
            required_fields = ["id", "aoid", "name", "counter", "type", "professions", "breeds", "level"]
            for field in required_fields:
                assert field in perk, f"Required field '{field}' missing from response"

            # Verify optional fields have correct defaults
            assert "ai_title" in perk  # Should be present but may be null
            assert "description" in perk
            assert "ql" in perk

            # Verify new fields are present and additive only
            assert "perk_series" in perk
            assert "formatted_name" in perk

    def test_existing_query_parameters(self):
        """Test that all existing query parameters still work."""
        legacy_params = {
            "page": 1,
            "page_size": 20,
            "type": "SL",
            "profession": "Agent",
            "breed": "Solitus",
            "search": "accuracy"
        }

        response = client.get("/perks", params=legacy_params)

        assert response.status_code == 200
        data = response.json()

        # Legacy parameters should work without modification
        assert data["page"] == 1
        assert data["page_size"] == 20

    def test_profession_breed_empty_arrays(self):
        """Test that empty profession/breed arrays are handled correctly."""
        response = client.get("/perks")

        assert response.status_code == 200
        data = response.json()

        if data["items"]:
            for perk in data["items"]:
                # Empty arrays should be valid (meaning "all allowed")
                assert isinstance(perk["professions"], list)
                assert isinstance(perk["breeds"], list)


class TestPerkAPIPerformance:
    """Test API performance with complex queries."""

    def test_complex_query_performance(self):
        """Test performance with multiple filters applied."""
        import time

        params = {
            "type": "SL",
            "profession": "Agent",
            "breed": "Solitus",
            "min_level": 10,
            "max_level": 200,
            "ai_level": 30,
            "search": "a",  # Broad search
            "sort_by": "level",
            "page_size": 100
        }

        start_time = time.time()
        response = client.get("/perks", params=params)
        end_time = time.time()

        assert response.status_code == 200

        # Performance requirement: complex queries should complete in < 500ms
        query_time = end_time - start_time
        assert query_time < 0.5, f"Complex query took {query_time:.3f}s, expected < 0.5s"

    def test_large_result_set_performance(self):
        """Test performance with large result sets."""
        import time

        # Query for all perks with large page size
        params = {
            "page_size": 200
        }

        start_time = time.time()
        response = client.get("/perks", params=params)
        end_time = time.time()

        assert response.status_code == 200

        # Should handle large result sets efficiently
        query_time = end_time - start_time
        assert query_time < 1.0, f"Large result query took {query_time:.3f}s, expected < 1.0s"

    def test_series_endpoint_performance(self):
        """Test performance of the series grouping endpoint."""
        import time

        start_time = time.time()
        response = client.get("/perks/series")
        end_time = time.time()

        assert response.status_code == 200

        # Series grouping should be reasonably fast
        query_time = end_time - start_time
        assert query_time < 1.0, f"Series grouping took {query_time:.3f}s, expected < 1.0s"


class TestPerkSeriesGroupingEndpoint:
    """Test the /perks/series endpoint for grouping functionality."""

    def test_get_perk_series_basic(self):
        """Test basic GET /perks/series functionality."""
        response = client.get("/perks/series")

        assert response.status_code == 200
        data = response.json()

        # Should return list of series
        assert isinstance(data, list)

        if data:
            series = data[0]

            # Verify series structure
            required_fields = ["series_name", "type", "professions", "breeds", "perks"]
            for field in required_fields:
                assert field in series, f"Required field '{field}' missing from series response"

            # Verify perks structure within series
            assert isinstance(series["perks"], list)
            if series["perks"]:
                perk = series["perks"][0]
                perk_fields = ["counter", "aoid", "level_required", "ai_level_required"]
                for field in perk_fields:
                    assert field in perk, f"Required field '{field}' missing from series perk"

    def test_series_filtering_by_profession(self):
        """Test filtering series by profession."""
        response = client.get("/perks/series?profession=Agent")

        assert response.status_code == 200
        data = response.json()

        if data:
            for series in data:
                # Empty professions means "all allowed", otherwise should contain Agent
                if series["professions"]:
                    assert "Agent" in series["professions"]

    def test_series_filtering_by_breed(self):
        """Test filtering series by breed."""
        response = client.get("/perks/series?breed=Atrox")

        assert response.status_code == 200
        data = response.json()

        if data:
            for series in data:
                # Empty breeds means "all allowed", otherwise should contain Atrox
                if series["breeds"]:
                    assert "Atrox" in series["breeds"]

    def test_series_filtering_by_type(self):
        """Test filtering series by type."""
        for perk_type in ["SL", "AI", "LE"]:
            response = client.get(f"/perks/series?type={perk_type}")

            assert response.status_code == 200
            data = response.json()

            if data:
                for series in data:
                    assert series["type"] == perk_type

    def test_series_counter_ordering(self):
        """Test that perks within series are ordered by counter."""
        response = client.get("/perks/series")

        assert response.status_code == 200
        data = response.json()

        if data:
            for series in data:
                if len(series["perks"]) > 1:
                    # Verify perks are sorted by counter
                    counters = [perk["counter"] for perk in series["perks"]]
                    assert counters == sorted(counters), f"Counters not sorted: {counters}"

    def test_series_combined_filters(self):
        """Test multiple filters on series endpoint."""
        params = {
            "profession": "Agent",
            "type": "SL"
        }

        response = client.get("/perks/series", params=params)

        assert response.status_code == 200
        data = response.json()

        if data:
            for series in data:
                assert series["type"] == "SL"
                if series["professions"]:
                    assert "Agent" in series["professions"]


class TestPerkAPIErrorHandling:
    """Test error handling for various invalid scenarios."""

    def test_invalid_profession_name(self):
        """Test filtering with invalid profession name."""
        response = client.get("/perks?profession=InvalidProfession")

        # Should still return 200 but with no results or handle gracefully
        assert response.status_code == 200
        data = response.json()

        # Should return empty results for non-existent profession
        # (The service layer should handle this gracefully)

    def test_invalid_breed_name(self):
        """Test filtering with invalid breed name."""
        response = client.get("/perks?breed=InvalidBreed")

        assert response.status_code == 200
        data = response.json()

        # Should handle gracefully with empty results

    def test_invalid_type_value(self):
        """Test filtering with invalid type value."""
        response = client.get("/perks?type=INVALID")

        assert response.status_code == 200
        data = response.json()

        # Should return empty results for invalid type

    def test_invalid_level_parameters(self):
        """Test with invalid level parameters."""
        # Test negative level
        response = client.get("/perks?min_level=-1")
        assert response.status_code == 200  # Should handle gracefully

        # Test impossible level range
        response = client.get("/perks?min_level=1000&max_level=10")
        assert response.status_code == 200
        data = response.json()
        # Should return empty results for impossible range
        assert len(data["items"]) == 0

    def test_invalid_ai_level(self):
        """Test with invalid AI level parameters."""
        response = client.get("/perks?ai_level=-1")

        assert response.status_code == 200
        # Should handle gracefully

    def test_malformed_search_query(self):
        """Test with potentially problematic search queries."""
        problematic_queries = [
            "' OR 1=1 --",  # SQL injection attempt
            "%",            # SQL wildcard
            "\\",           # Escape character
            "",             # Empty string
        ]

        for query in problematic_queries:
            response = client.get(f"/perks?search={query}")

            # Should handle all queries safely
            assert response.status_code == 200

    def test_non_existent_series(self):
        """Test filtering by non-existent series."""
        response = client.get("/perks?series=NonExistentSeries")

        assert response.status_code == 200
        data = response.json()

        # Should return empty results
        assert len(data["items"]) == 0

    def test_perk_lookup_invalid_aoid(self):
        """Test perk lookup with invalid AOID."""
        response = client.get("/perks/lookup/999999999")

        # Should return None/null for non-existent AOID
        assert response.status_code == 200
        data = response.json()
        assert data is None

    def test_perk_series_not_found(self):
        """Test GET /perks/{perk_name} with non-existent perk."""
        response = client.get("/perks/NonExistentPerkName")

        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
        assert "not found" in data["detail"].lower()

    def test_validation_endpoint_errors(self):
        """Test perk validation endpoint with missing required parameters."""
        # Missing required parameters should return 422
        response = client.get("/perks/SomePerk/validate")

        assert response.status_code == 422  # Validation error

    def test_malformed_json_in_validation(self):
        """Test validation endpoint with malformed JSON."""
        params = {
            "target_level": 5,
            "character_level": 100,
            "character_profession": "Agent",
            "character_breed": "Solitus",
            "owned_perks": "invalid json"  # Malformed JSON
        }

        response = client.get("/perks/SomePerk/validate", params=params)

        # Should handle malformed JSON gracefully
        assert response.status_code in [200, 422]


class TestPerkStatsEndpoint:
    """Test the /perks/stats endpoint."""

    def test_get_perk_stats(self):
        """Test basic perk statistics endpoint."""
        response = client.get("/perks/stats")

        assert response.status_code == 200
        data = response.json()

        # Verify stats structure
        required_fields = [
            "total_perks", "total_series", "types", "professions",
            "breeds", "level_range", "ai_title_range"
        ]

        for field in required_fields:
            assert field in data, f"Required field '{field}' missing from stats response"

        # Verify data types
        assert isinstance(data["total_perks"], int)
        assert isinstance(data["total_series"], int)
        assert isinstance(data["types"], list)
        assert isinstance(data["professions"], list)
        assert isinstance(data["breeds"], list)
        assert isinstance(data["level_range"], list) and len(data["level_range"]) == 2
        assert isinstance(data["ai_title_range"], list) and len(data["ai_title_range"]) == 2

    def test_stats_data_validity(self):
        """Test that stats data is reasonable."""
        response = client.get("/perks/stats")

        assert response.status_code == 200
        data = response.json()

        # Verify reasonable values
        assert data["total_perks"] >= 0
        assert data["total_series"] >= 0

        # Verify expected types are present
        expected_types = ["SL", "AI", "LE"]
        for perk_type in expected_types:
            if data["types"]:  # Only check if there are types
                assert any(t == perk_type for t in data["types"])

        # Verify level ranges are reasonable
        if data["level_range"]:
            assert 1 <= data["level_range"][0] <= data["level_range"][1] <= 220


class TestPerkCalculationEndpoint:
    """Test the /perks/calculate endpoint."""

    def test_calculate_perk_effects_basic(self):
        """Test basic perk calculation functionality."""
        request_data = {
            "character_level": 100,
            "ai_title_level": 15,
            "owned_perks": {},
            "target_perks": {"Aimed Shot": 5}
        }

        response = client.post("/perks/calculate", json=request_data)

        assert response.status_code == 200
        data = response.json()

        # Verify calculation response structure
        required_fields = [
            "total_sl_cost", "total_ai_cost", "available_sl_points", "available_ai_points",
            "sl_points_remaining", "ai_points_remaining", "affordable", "requirements_met",
            "blocking_requirements", "perk_effects"
        ]

        for field in required_fields:
            assert field in data, f"Required field '{field}' missing from calculation response"

    def test_calculation_point_logic(self):
        """Test that point calculations follow correct formulas."""
        request_data = {
            "character_level": 100,  # Should give (100-14)*2 = 172 SL points, capped at 40
            "ai_title_level": 20,    # Should give 20 AI points
            "owned_perks": {},
            "target_perks": {}
        }

        response = client.post("/perks/calculate", json=request_data)

        assert response.status_code == 200
        data = response.json()

        # Verify point calculations
        assert data["available_sl_points"] == 40  # Capped at 40
        assert data["available_ai_points"] == 20

    def test_calculation_validation_errors(self):
        """Test calculation with invalid request data."""
        # Missing required fields
        response = client.post("/perks/calculate", json={})
        assert response.status_code == 422  # Validation error

        # Invalid character level
        invalid_data = {
            "character_level": 0,  # Invalid level
            "owned_perks": {},
            "target_perks": {}
        }

        response = client.post("/perks/calculate", json=invalid_data)
        assert response.status_code == 422  # Validation error


# Performance and integration test utilities
def measure_response_time(func, *args, **kwargs):
    """Utility to measure response time of API calls."""
    import time
    start = time.time()
    result = func(*args, **kwargs)
    end = time.time()
    return result, end - start


@pytest.mark.slow
class TestPerkAPIIntegration:
    """Full integration tests with real-world scenarios."""

    def test_full_perk_workflow(self):
        """Test a complete workflow using multiple endpoints."""
        # 1. Get perk statistics
        stats_response = client.get("/perks/stats")
        assert stats_response.status_code == 200

        # 2. Get perk series
        series_response = client.get("/perks/series")
        assert series_response.status_code == 200

        # 3. Filter perks by various criteria
        filter_response = client.get("/perks?type=SL&profession=Agent&min_level=10")
        assert filter_response.status_code == 200

        # 4. If we have results, test individual perk lookup
        filter_data = filter_response.json()
        if filter_data["items"]:
            first_perk = filter_data["items"][0]
            lookup_response = client.get(f"/perks/lookup/{first_perk['aoid']}")
            assert lookup_response.status_code == 200

    def test_concurrent_requests(self):
        """Test handling of concurrent requests."""
        import threading
        import time

        results = []
        errors = []

        def make_request():
            try:
                response = client.get("/perks?page_size=50")
                results.append(response.status_code)
            except Exception as e:
                errors.append(str(e))

        # Make 10 concurrent requests
        threads = []
        for i in range(10):
            thread = threading.Thread(target=make_request)
            threads.append(thread)
            thread.start()

        # Wait for all requests to complete
        for thread in threads:
            thread.join()

        # Verify all requests succeeded
        assert len(errors) == 0, f"Errors in concurrent requests: {errors}"
        assert all(status == 200 for status in results), f"Failed status codes: {results}"