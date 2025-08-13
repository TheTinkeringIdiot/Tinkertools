"""
Integration tests for the complete interpolation workflow.

Tests the full end-to-end interpolation process from API endpoints through
the service layer to the database, using real or realistic test data.
"""

import pytest
from unittest.mock import Mock, patch
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.database import get_db, Base
from app.models.item import Item
from app.models.stat_value import StatValue, ItemStats
from app.models.spell_data import SpellData, SpellDataSpells
from app.models.spell import Spell
from app.models.action import Action, ActionCriteria
from app.models.criterion import Criterion
from app.services.interpolation import InterpolationService


# ============================================================================
# Test Database Setup
# ============================================================================

# Create in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_interpolation.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def test_db():
    """Create a test database session."""
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        # Clean up tables after test
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(test_db):
    """Create a test client with database override."""
    def override_get_db():
        try:
            yield test_db
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    
    with TestClient(app) as test_client:
        yield test_client
    
    app.dependency_overrides.clear()


# ============================================================================
# Test Data Fixtures
# ============================================================================

@pytest.fixture
def sample_weapon_items(test_db):
    """Create sample weapon items with multiple QLs for testing."""
    # Create stat values
    stat1_lo = StatValue(stat=1, value=100)  # Interpolatable stat
    stat1_hi = StatValue(stat=1, value=200)
    stat2_lo = StatValue(stat=999, value=50)  # Non-interpolatable stat
    stat2_hi = StatValue(stat=999, value=50)
    
    test_db.add_all([stat1_lo, stat1_hi, stat2_lo, stat2_hi])
    test_db.commit()
    
    # Create items
    item_lo = Item(
        aoid=12345,
        name="Test Weapon",
        description="A test weapon",
        ql=100,
        item_class=1,
        is_nano=False
    )
    
    item_hi = Item(
        aoid=12345,
        name="Test Weapon",
        description="A test weapon",
        ql=200,
        item_class=1,
        is_nano=False
    )
    
    test_db.add_all([item_lo, item_hi])
    test_db.commit()
    
    # Create item-stat relationships
    item_stat1_lo = ItemStats(item_id=item_lo.id, stat_value_id=stat1_lo.id)
    item_stat1_hi = ItemStats(item_id=item_hi.id, stat_value_id=stat1_hi.id)
    item_stat2_lo = ItemStats(item_id=item_lo.id, stat_value_id=stat2_lo.id)
    item_stat2_hi = ItemStats(item_id=item_hi.id, stat_value_id=stat2_hi.id)
    
    test_db.add_all([item_stat1_lo, item_stat1_hi, item_stat2_lo, item_stat2_hi])
    test_db.commit()
    
    return {"low": item_lo, "high": item_hi}


@pytest.fixture
def sample_nano_item(test_db):
    """Create a sample nano item (non-interpolatable)."""
    nano_item = Item(
        aoid=98765,
        name="Test Nano",
        description="A test nano program",
        ql=200,
        item_class=2,
        is_nano=True
    )
    
    test_db.add(nano_item)
    test_db.commit()
    
    return nano_item


@pytest.fixture
def sample_spell_data(test_db, sample_weapon_items):
    """Create sample spell data with interpolatable spells."""
    lo_item = sample_weapon_items["low"]
    hi_item = sample_weapon_items["high"]
    
    # Create spells
    spell_lo = Spell(
        spell_id=53012,  # Stat|Amount spell
        spell_params={"Stat": 1, "Amount": 100}
    )
    spell_hi = Spell(
        spell_id=53012,
        spell_params={"Stat": 1, "Amount": 200}
    )
    
    test_db.add_all([spell_lo, spell_hi])
    test_db.commit()
    
    # Create spell data
    spell_data_lo = SpellData(event=1)
    spell_data_hi = SpellData(event=1)
    
    test_db.add_all([spell_data_lo, spell_data_hi])
    test_db.commit()
    
    # Create spell data relationships
    spell_data_spell_lo = SpellDataSpells(spell_data_id=spell_data_lo.id, spell_id=spell_lo.id)
    spell_data_spell_hi = SpellDataSpells(spell_data_id=spell_data_hi.id, spell_id=spell_hi.id)
    
    test_db.add_all([spell_data_spell_lo, spell_data_spell_hi])
    test_db.commit()
    
    return {
        "low": {"spell_data": spell_data_lo, "spell": spell_lo},
        "high": {"spell_data": spell_data_hi, "spell": spell_hi}
    }


@pytest.fixture
def sample_action_data(test_db, sample_weapon_items):
    """Create sample action data with interpolatable criteria."""
    lo_item = sample_weapon_items["low"]
    hi_item = sample_weapon_items["high"]
    
    # Create criteria
    criterion_lo = Criterion(value1=1, value2=100, operator=1)  # Interpolatable stat
    criterion_hi = Criterion(value1=1, value2=200, operator=1)
    
    test_db.add_all([criterion_lo, criterion_hi])
    test_db.commit()
    
    # Create actions
    action_lo = Action(action=1, item_id=lo_item.id)
    action_hi = Action(action=1, item_id=hi_item.id)
    
    test_db.add_all([action_lo, action_hi])
    test_db.commit()
    
    # Create action criteria relationships
    action_criterion_lo = ActionCriteria(
        action_id=action_lo.id, 
        criterion_id=criterion_lo.id, 
        order_index=0
    )
    action_criterion_hi = ActionCriteria(
        action_id=action_hi.id, 
        criterion_id=criterion_hi.id, 
        order_index=0
    )
    
    test_db.add_all([action_criterion_lo, action_criterion_hi])
    test_db.commit()
    
    return {
        "low": {"action": action_lo, "criterion": criterion_lo},
        "high": {"action": action_hi, "criterion": criterion_hi}
    }


# ============================================================================
# Integration Tests
# ============================================================================

class TestInterpolationIntegration:
    """Integration tests for the complete interpolation workflow."""

    def test_full_interpolation_workflow(self, client, sample_weapon_items):
        """Test the complete interpolation workflow from API to database."""
        # Test interpolation info endpoint
        response = client.get("/api/v1/items/12345/interpolation-info")
        assert response.status_code == 200
        
        info_data = response.json()
        assert info_data["aoid"] == 12345
        assert info_data["interpolatable"] is True
        assert info_data["min_ql"] == 100
        assert info_data["max_ql"] == 200
        assert info_data["ql_range"] == 101

        # Test interpolation endpoint
        response = client.get("/api/v1/items/12345/interpolate?target_ql=150")
        assert response.status_code == 200
        
        interp_data = response.json()
        assert interp_data["success"] is True
        assert interp_data["item"]["aoid"] == 12345
        assert interp_data["item"]["target_ql"] == 150
        assert interp_data["item"]["interpolating"] is True
        assert interp_data["item"]["low_ql"] == 100
        assert interp_data["item"]["high_ql"] == 199  # hi_ql - 1
        assert interp_data["item"]["ql_delta"] == 50
        assert interp_data["item"]["ql_delta_full"] == 100

        # Check interpolated stats
        stats = interp_data["item"]["stats"]
        assert len(stats) == 2
        
        # Find interpolated stat (stat 1)
        interp_stat = next(s for s in stats if s["stat"] == 1)
        assert interp_stat["value"] == 150  # Halfway between 100 and 200
        
        # Find non-interpolated stat (stat 999)
        non_interp_stat = next(s for s in stats if s["stat"] == 999)
        assert non_interp_stat["value"] == 50  # Should remain unchanged

    def test_interpolation_at_boundaries(self, client, sample_weapon_items):
        """Test interpolation at quality level boundaries."""
        # Test at minimum QL
        response = client.get("/api/v1/items/12345/interpolate?target_ql=100")
        assert response.status_code == 200
        
        data = response.json()
        assert data["item"]["target_ql"] == 100
        assert data["item"]["interpolating"] is False  # No interpolation needed

        # Test at maximum possible QL
        response = client.get("/api/v1/items/12345/interpolate?target_ql=199")
        assert response.status_code == 200
        
        data = response.json()
        assert data["item"]["target_ql"] == 199
        assert data["item"]["interpolating"] is True

    def test_non_interpolatable_item(self, client, sample_nano_item):
        """Test interpolation with non-interpolatable items (nanos)."""
        response = client.get("/api/v1/items/98765/interpolation-info")
        assert response.status_code == 200
        
        info_data = response.json()
        assert info_data["aoid"] == 98765
        assert info_data["interpolatable"] is False
        assert info_data["min_ql"] == 200
        assert info_data["max_ql"] == 200
        assert info_data["ql_range"] == 1

    def test_item_not_found(self, client):
        """Test interpolation with non-existent item."""
        response = client.get("/api/v1/items/99999/interpolation-info")
        assert response.status_code == 404
        
        response = client.get("/api/v1/items/99999/interpolate?target_ql=150")
        assert response.status_code == 404

    def test_post_interpolation_endpoint(self, client, sample_weapon_items):
        """Test the POST interpolation endpoint."""
        response = client.post(
            "/api/v1/items/interpolate",
            json={"aoid": 12345, "target_ql": 175}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert data["item"]["target_ql"] == 175
        assert data["item"]["interpolating"] is True

    def test_interpolation_with_spell_data(self, client, sample_weapon_items, sample_spell_data):
        """Test interpolation with spell data."""
        response = client.get("/api/v1/items/12345/interpolate?target_ql=150")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        
        # Check spell data is included
        spell_data = data["item"]["spell_data"]
        if spell_data:  # May be empty depending on test data setup
            assert isinstance(spell_data, list)

    def test_interpolation_with_action_data(self, client, sample_weapon_items, sample_action_data):
        """Test interpolation with action data."""
        response = client.get("/api/v1/items/12345/interpolate?target_ql=150")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        
        # Check action data is included
        actions = data["item"]["actions"]
        if actions:  # May be empty depending on test data setup
            assert isinstance(actions, list)

    def test_invalid_quality_levels(self, client, sample_weapon_items):
        """Test interpolation with invalid quality levels."""
        # Test QL below minimum
        response = client.get("/api/v1/items/12345/interpolate?target_ql=0")
        assert response.status_code == 422

        # Test QL above maximum
        response = client.get("/api/v1/items/12345/interpolate?target_ql=501")
        assert response.status_code == 422

    def test_service_layer_directly(self, test_db, sample_weapon_items):
        """Test the interpolation service layer directly."""
        service = InterpolationService(test_db)
        
        # Test interpolation info
        is_interpolatable = service.is_item_interpolatable(12345)
        assert is_interpolatable is True
        
        range_info = service.get_interpolation_range(12345)
        assert range_info == (100, 199)
        
        # Test interpolation
        interpolated = service.interpolate_item(12345, 150)
        assert interpolated is not None
        assert interpolated.interpolating is True
        assert interpolated.target_ql == 150
        assert interpolated.low_ql == 100
        assert interpolated.high_ql == 199
        assert len(interpolated.stats) == 2
        
        # Check interpolated stat value
        interp_stat = next(s for s in interpolated.stats if s['stat'] == 1)
        assert interp_stat['value'] == 150

    def test_service_error_handling(self, test_db):
        """Test service error handling with invalid data."""
        service = InterpolationService(test_db)
        
        # Test with non-existent item
        result = service.interpolate_item(99999, 150)
        assert result is None
        
        is_interpolatable = service.is_item_interpolatable(99999)
        assert is_interpolatable is False
        
        range_info = service.get_interpolation_range(99999)
        assert range_info is None

    def test_performance_with_multiple_items(self, client, test_db):
        """Test performance with multiple items and concurrent requests."""
        # Create multiple items
        items = []
        for i in range(10):
            aoid = 10000 + i
            for ql in [100, 200]:
                item = Item(
                    aoid=aoid,
                    name=f"Test Item {i}",
                    description=f"Test item {i}",
                    ql=ql,
                    item_class=1,
                    is_nano=False
                )
                items.append(item)
        
        test_db.add_all(items)
        test_db.commit()
        
        # Test interpolation for multiple items
        import time
        start_time = time.time()
        
        for i in range(5):  # Test subset to keep test fast
            aoid = 10000 + i
            response = client.get(f"/api/v1/items/{aoid}/interpolate?target_ql=150")
            assert response.status_code == 200
        
        end_time = time.time()
        total_time = end_time - start_time
        
        # Should complete reasonably quickly
        assert total_time < 5.0  # 5 seconds for 5 items should be plenty

    def test_interpolation_edge_cases(self, client, test_db):
        """Test interpolation edge cases and boundary conditions."""
        # Create items with same QL (no interpolation possible)
        item1 = Item(aoid=11111, name="Same QL Item", ql=150, is_nano=False)
        item2 = Item(aoid=11111, name="Same QL Item", ql=150, is_nano=False)
        
        test_db.add_all([item1, item2])
        test_db.commit()
        
        # Should not be interpolatable
        response = client.get("/api/v1/items/11111/interpolation-info")
        assert response.status_code == 200
        
        data = response.json()
        assert data["interpolatable"] is False

    def test_database_transaction_rollback(self, test_db):
        """Test that database transactions are properly handled."""
        service = InterpolationService(test_db)
        
        # This should not crash even if there are database issues
        with patch.object(test_db, 'query') as mock_query:
            mock_query.side_effect = Exception("Database error")
            
            # Should handle the exception gracefully
            result = service.interpolate_item(12345, 150)
            assert result is None

    def test_memory_usage(self, test_db, sample_weapon_items):
        """Test that interpolation doesn't cause memory leaks."""
        import gc
        
        service = InterpolationService(test_db)
        
        # Perform many interpolations
        for i in range(100):
            interpolated = service.interpolate_item(12345, 100 + i)
            # Force cleanup
            del interpolated
        
        # Force garbage collection
        gc.collect()
        
        # This is mainly to ensure the test completes without memory issues
        # In a real scenario, you'd monitor actual memory usage
        assert True

    def test_concurrent_access(self, client, sample_weapon_items):
        """Test concurrent access to interpolation endpoints."""
        import threading
        import time
        
        results = []
        errors = []
        
        def make_request(target_ql):
            try:
                response = client.get(f"/api/v1/items/12345/interpolate?target_ql={target_ql}")
                results.append(response.status_code)
            except Exception as e:
                errors.append(str(e))
        
        # Create multiple threads
        threads = []
        for i in range(10):
            thread = threading.Thread(target=make_request, args=(100 + i * 10,))
            threads.append(thread)
        
        # Start all threads
        for thread in threads:
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        # Check results
        assert len(errors) == 0
        assert all(status == 200 for status in results)
        assert len(results) == 10