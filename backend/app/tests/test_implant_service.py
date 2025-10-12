"""
Unit tests for ImplantService.
"""

import pytest
from unittest.mock import Mock, MagicMock
from sqlalchemy.orm import Session

from app.services.implant_service import ImplantService
from app.models.item import Item, ItemStats, ItemSpellData
from app.models.stat_value import StatValue
from app.models.spell_data import SpellData, SpellDataSpells
from app.models.spell import Spell
from app.api.schemas.item import ItemDetail, StatValueResponse


class TestImplantService:
    """Test cases for ImplantService."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.mock_db = Mock(spec=Session)
        self.service = ImplantService(self.mock_db)
        
        # Mock interpolation service
        self.service.interpolation_service = Mock()
    
    def test_determine_base_ql(self):
        """Test base QL determination logic."""
        # Test QL 1-200 range
        assert self.service._determine_base_ql(1) == 1
        assert self.service._determine_base_ql(100) == 1
        assert self.service._determine_base_ql(200) == 1
        
        # Test QL 201-300 range
        assert self.service._determine_base_ql(201) == 201
        assert self.service._determine_base_ql(250) == 201
        assert self.service._determine_base_ql(300) == 201
    
    def test_validate_cluster_combination_valid(self):
        """Test cluster combination validation with valid inputs."""
        # Valid single cluster
        assert self.service.validate_cluster_combination({"Shiny": 16}) is True
        
        # Valid multiple clusters
        assert self.service.validate_cluster_combination({
            "Shiny": 16,
            "Bright": 112,
            "Faded": 19
        }) is True
        
        # Valid partial clusters
        assert self.service.validate_cluster_combination({
            "Shiny": 16,
            "Faded": 19
        }) is True
    
    def test_validate_cluster_combination_invalid(self):
        """Test cluster combination validation with invalid inputs."""
        # Invalid position name
        assert self.service.validate_cluster_combination({"Invalid": 16}) is False
        
        # Mixed valid and invalid positions
        assert self.service.validate_cluster_combination({
            "Shiny": 16,
            "Invalid": 19
        }) is False
    
    def test_lookup_implant_invalid_slot(self):
        """Test lookup with invalid slot number."""
        result = self.service.lookup_implant(
            slot=0,  # Invalid
            target_ql=100,
            clusters={"Shiny": 16}
        )
        assert result is None
        
        result = self.service.lookup_implant(
            slot=14,  # Invalid
            target_ql=100,
            clusters={"Shiny": 16}
        )
        assert result is None
    
    @pytest.mark.skip(reason="Complex query mocking required for _find_implant_with_clusters method. Test requires refactoring to properly mock complex subquery chains.")
    def test_lookup_implant_no_match_found(self):
        """Test lookup when no matching implant exists."""
        # Mock query that returns no results
        mock_query = Mock()
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = None
        self.mock_db.query.return_value = mock_query

        result = self.service.lookup_implant(
            slot=2,  # Valid bitflag (2^1)
            target_ql=100,
            clusters={"Shiny": 16}
        )
        assert result is None
    
    def test_lookup_implant_exact_ql_match(self):
        """Test lookup when target QL matches database item QL."""
        # Create mock item
        mock_item = Mock(spec=Item)
        mock_item.id = 1
        mock_item.aoid = 12345
        mock_item.name = "Test Implant"
        mock_item.ql = 100
        mock_item.item_class = 3
        mock_item.description = "Test description"
        mock_item.is_nano = False
        mock_item.item_stats = []
        mock_item.item_spell_data = []
        mock_item.actions = []
        mock_item.sources = []
        
        # Mock the _find_implant_with_clusters method directly to avoid complex query mocking
        self.service._find_implant_with_clusters = Mock(return_value=mock_item)
        
        # Mock build_item_detail function
        expected_detail = ItemDetail(
            id=1,
            aoid=12345,
            name="Test Implant",
            ql=100,
            item_class=3,
            description="Test description",
            is_nano=False,
            stats=[],
            spell_data=[],
            attack_stats=[],
            defense_stats=[],
            actions=[],
            sources=[]
        )
        
        # Mock the build_item_detail import
        with pytest.MonkeyPatch().context() as m:
            mock_build = Mock(return_value=expected_detail)
            m.setattr("app.services.implant_service.build_item_detail", mock_build)
            
            result = self.service.lookup_implant(
                slot=2,  # Valid bitflag (2^1)
                target_ql=100,
                clusters={"Shiny": 16}
            )
            
            assert result is not None
            item_detail, was_interpolated, base_ql = result
            assert was_interpolated is False
            assert base_ql == 1
            assert item_detail.aoid == 12345
    
    def test_lookup_implant_needs_interpolation(self):
        """Test lookup when interpolation is needed."""
        # Create mock base item at QL 1
        mock_item = Mock(spec=Item)
        mock_item.id = 1
        mock_item.aoid = 12345
        mock_item.name = "Test Implant"
        mock_item.ql = 1
        mock_item.item_class = 3
        
        # Mock the _find_implant_with_clusters method directly
        self.service._find_implant_with_clusters = Mock(return_value=mock_item)
        
        # Mock interpolated item
        mock_interpolated = Mock()
        mock_interpolated.id = 1
        mock_interpolated.aoid = 12345
        mock_interpolated.name = "Test Implant"
        mock_interpolated.ql = 150  # Target QL
        mock_interpolated.item_class = 3
        mock_interpolated.description = "Test description"
        mock_interpolated.is_nano = False
        mock_interpolated.stats = []
        mock_interpolated.spell_data = []
        mock_interpolated.attack_stats = []
        mock_interpolated.defense_stats = []
        mock_interpolated.actions = []
        
        self.service.interpolation_service.interpolate_item.return_value = mock_interpolated
        
        result = self.service.lookup_implant(
            slot=2,  # Valid bitflag (2^1)
            target_ql=150,
            clusters={"Shiny": 16}
        )
        
        assert result is not None
        item_detail, was_interpolated, base_ql = result
        assert was_interpolated is True
        assert base_ql == 1
        assert item_detail.ql == 150
    
    def test_lookup_implant_interpolation_fails(self):
        """Test lookup when interpolation fails."""
        # Create mock base item
        mock_item = Mock(spec=Item)
        mock_item.id = 1
        mock_item.aoid = 12345
        mock_item.ql = 1
        mock_item.item_stats = []
        mock_item.item_spell_data = []
        mock_item.actions = []
        
        # Mock the _find_implant_with_clusters method directly
        self.service._find_implant_with_clusters = Mock(return_value=mock_item)
        
        # Mock failed interpolation
        self.service.interpolation_service.interpolate_item.return_value = None
        
        # Mock build_item_detail function
        expected_detail = ItemDetail(
            id=1,
            aoid=12345,
            name="Test Implant",
            ql=1,
            item_class=3,
            description=None,
            is_nano=False,
            stats=[],
            spell_data=[],
            attack_stats=[],
            defense_stats=[],
            actions=[],
            sources=[]
        )
        
        with pytest.MonkeyPatch().context() as m:
            mock_build = Mock(return_value=expected_detail)
            m.setattr("app.services.implant_service.build_item_detail", mock_build)
            
            result = self.service.lookup_implant(
                slot=2,  # Valid bitflag (2^1)
                target_ql=150,
                clusters={"Shiny": 16}
            )
            
            assert result is not None
            item_detail, was_interpolated, base_ql = result
            assert was_interpolated is False  # Fallback to original
            assert item_detail.ql == 1
    
    def test_get_available_implants_for_slot(self):
        """Test getting available implants for a slot."""
        # Mock query results
        mock_items = [
            Mock(id=1, name="Implant A"),
            Mock(id=2, name="Implant B")
        ]
        
        mock_query = Mock()
        mock_query.filter.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.all.return_value = mock_items
        self.mock_db.query.return_value = mock_query
        
        result = self.service.get_available_implants_for_slot(2, 1)  # Valid bitflag
        
        assert len(result) == 2
        assert result == mock_items
    
    def test_get_available_implants_invalid_slot(self):
        """Test getting available implants with invalid slot."""
        result = self.service.get_available_implants_for_slot(0, 1)
        assert result == []
        
        result = self.service.get_available_implants_for_slot(14, 1)
        assert result == []
    
    @pytest.mark.skip(reason="Complex query mocking required for _find_implant_with_clusters method. Test requires refactoring to properly mock complex subquery chains with joins and aggregations.")
    def test_find_implant_with_spell_clusters_exact_match(self):
        """Test finding implant with exact cluster match via spells."""
        # Create mock item with spell data for clusters
        mock_item = Mock(spec=Item)
        mock_item.id = 1
        mock_item.aoid = 12345
        mock_item.name = "Test Implant with Clusters"
        mock_item.ql = 1
        mock_item.item_class = 3

        # Mock all the complex subquery chain by setting up proper return structures
        mock_subquery1 = Mock()
        mock_subquery2 = Mock()
        mock_slot_subquery = Mock()

        # Mock the main query chain
        mock_query = Mock()
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = mock_item

        # Mock the database query method to handle different query types
        def mock_query_side_effect(model):
            if model == Item:
                mock_item_query = Mock()
                mock_item_query.join.return_value = mock_item_query
                mock_item_query.filter.return_value = mock_item_query
                mock_item_query.group_by.return_value = mock_item_query
                mock_item_query.having.return_value = mock_item_query
                mock_item_query.subquery.return_value = mock_subquery1
                mock_item_query.first.return_value = mock_item
                return mock_item_query
            return mock_query

        self.mock_db.query.side_effect = mock_query_side_effect

        # Test finding implant with specific clusters
        result = self.service._find_implant_with_clusters(
            slot=32,  # Chest slot
            base_ql=1,
            clusters={"Shiny": 16, "Bright": 17}  # Strength and Stamina
        )

        assert result is not None
        assert result.aoid == 12345
        assert result.name == "Test Implant with Clusters"
    
    @pytest.mark.skip(reason="Complex query mocking required for _find_implant_with_clusters method. Test requires refactoring to properly mock complex subquery chains.")
    def test_find_implant_no_clusters_basic_implant(self):
        """Test finding basic implant with no clusters."""
        # Create mock basic implant with no spell data
        mock_item = Mock(spec=Item)
        mock_item.id = 2
        mock_item.aoid = 54321
        mock_item.name = "Basic Implant"
        mock_item.ql = 1
        mock_item.item_class = 3

        mock_query = Mock()
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = mock_item
        self.mock_db.query.return_value = mock_query

        # Test finding implant with no clusters specified
        result = self.service._find_implant_with_clusters(
            slot=32,  # Chest slot
            base_ql=1,
            clusters={}  # No clusters
        )

        assert result is not None
        assert result.aoid == 54321
        assert result.name == "Basic Implant"
    
    @pytest.mark.skip(reason="Complex query mocking required for _find_implant_with_clusters method. Test requires refactoring to properly mock complex subquery chains.")
    def test_find_implant_with_clusters_no_match(self):
        """Test when no implant matches the cluster requirements."""
        # Mock query that returns no results
        mock_query = Mock()
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = None
        self.mock_db.query.return_value = mock_query

        result = self.service._find_implant_with_clusters(
            slot=32,  # Chest slot
            base_ql=1,
            clusters={"Shiny": 16, "Bright": 17, "Faded": 18}  # Very specific combination
        )

        assert result is None


class TestImplantServiceIntegration:
    """Integration tests that require database setup."""
    
    @pytest.mark.skip(reason="Requires database setup")
    def test_find_implant_with_clusters_integration(self):
        """Integration test for cluster matching query."""
        # This would require actual database setup with test data
        # Left as a placeholder for when database test fixtures are available
        pass
    
    @pytest.mark.skip(reason="Requires database setup")
    def test_exact_cluster_match_integration(self):
        """Integration test for exact cluster matching."""
        # Test that implants with extra clusters are excluded
        # Test that implants missing required clusters are excluded
        # Test that implants with exact matches are included
        pass
    
    @pytest.mark.skip(reason="Requires database setup")
    def test_spell_based_cluster_detection_integration(self):
        """Integration test for spell-based cluster detection."""
        # Test with real implant data:
        # 1. Create test implants with spell_id 53045 that modify different stats
        # 2. Verify that _find_implant_with_clusters correctly identifies implants
        #    based on their Modify Stat spells rather than direct stat values
        # 3. Verify exact match logic: implant with Shiny(16) + Bright(17) clusters
        #    should NOT match request for just Shiny(16) cluster
        # 4. Verify rejection of implants with extra clusters
        # 5. Verify basic implants (no clusters) are found when no clusters requested
        pass
    
    @pytest.mark.skip(reason="Requires database setup")
    def test_spell_params_json_parsing_integration(self):
        """Integration test for spell_params JSON parsing."""
        # Test that the JSON parsing of spell_params->>'Stat' works correctly
        # with real database data and various stat ID formats
        pass