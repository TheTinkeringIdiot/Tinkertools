"""
Unit tests for the InterpolationService.

Tests the core interpolation logic, including stat interpolation, spell parameter
interpolation, criteria interpolation, and quality level range handling.
"""

import pytest
from unittest.mock import Mock, MagicMock, patch
from sqlalchemy.orm import Session

from app.services.interpolation import InterpolationService
from app.models.interpolated_item import InterpolatedItem, InterpolatedSpell, InterpolatedSpellData, InterpolatedAction
from app.models.item import Item
from app.models.stat_value import StatValue
from app.models.criterion import Criterion
from app.models.spell import Spell
from app.models.spell_data import SpellData
from app.models.action import Action


class TestInterpolationService:
    """Test cases for the InterpolationService class."""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session."""
        return Mock(spec=Session)

    @pytest.fixture
    def service(self, mock_db):
        """Create an InterpolationService instance with mock database."""
        return InterpolationService(mock_db)

    @pytest.fixture
    def mock_item_lo(self):
        """Create a mock low QL item."""
        item = Mock(spec=Item)
        item.id = 1
        item.aoid = 12345
        item.name = "Test Weapon"
        item.description = "A test weapon"
        item.ql = 100
        item.is_nano = False
        item.item_class = 1
        return item

    @pytest.fixture
    def mock_item_hi(self):
        """Create a mock high QL item."""
        item = Mock(spec=Item)
        item.id = 2
        item.aoid = 12345
        item.name = "Test Weapon"
        item.description = "A test weapon"
        item.ql = 200
        item.is_nano = False
        item.item_class = 1
        return item

    @pytest.fixture
    def mock_stats_lo(self):
        """Create mock low QL stats."""
        return [
            {'id': 1, 'stat': 1, 'value': 100},  # Interpolatable stat
            {'id': 2, 'stat': 999, 'value': 50}  # Non-interpolatable stat
        ]

    @pytest.fixture
    def mock_stats_hi(self):
        """Create mock high QL stats."""
        return [
            {'id': 3, 'stat': 1, 'value': 200},  # Interpolatable stat
            {'id': 4, 'stat': 999, 'value': 50}  # Non-interpolatable stat (same value)
        ]

    # ============================================================================
    # Core Interpolation Tests
    # ============================================================================

    def test_interpolation_constants(self, service):
        """Test that interpolation constants are properly defined."""
        assert hasattr(service, 'INTERP_STATS')
        assert hasattr(service, 'INTERPOLATABLE_SPELLS')
        assert isinstance(service.INTERP_STATS, set)
        assert isinstance(service.INTERPOLATABLE_SPELLS, set)
        assert len(service.INTERP_STATS) > 0
        assert len(service.INTERPOLATABLE_SPELLS) > 0

    def test_interpolate_value_calculation(self, service):
        """Test the core interpolate_value method."""
        # Create an interpolated item with known deltas
        interpolated = InterpolatedItem(
            id=1, name="Test", is_nano=False, interpolating=True,
            ql_delta=50, ql_delta_full=100
        )
        
        # Test interpolation: halfway between 100 and 200 should be 150
        result = interpolated.interpolate_value(100, 200)
        assert result == 150
        
        # Test edge cases
        interpolated.ql_delta = 0
        result = interpolated.interpolate_value(100, 200)
        assert result == 100  # Should return low value when delta is 0
        
        interpolated.ql_delta = 100
        result = interpolated.interpolate_value(100, 200)
        assert result == 200  # Should return high value when delta equals delta_full

    def test_interpolate_value_rounding(self, service):
        """Test that interpolated values are properly rounded."""
        interpolated = InterpolatedItem(
            id=1, name="Test", is_nano=False, interpolating=True,
            ql_delta=33, ql_delta_full=100
        )
        
        # Test rounding: 33% between 100 and 200 = 133
        result = interpolated.interpolate_value(100, 200)
        assert result == 133

    def test_find_item_variants(self, service, mock_db):
        """Test finding item variants by name and description."""
        # Mock database query
        mock_query = Mock()
        mock_filter = Mock()
        mock_order = Mock()
        
        mock_db.query.return_value = mock_query
        mock_query.filter.return_value = mock_filter
        mock_filter.order_by.return_value = mock_order
        mock_order.all.return_value = ['item1', 'item2', 'item3']
        
        result = service._find_item_variants("Test Weapon", "A test weapon")
        
        assert result == ['item1', 'item2', 'item3']
        mock_db.query.assert_called_once()
        mock_query.filter.assert_called_once()
        mock_filter.order_by.assert_called_once()

    def test_find_interpolation_bounds(self, service):
        """Test finding the correct low and high items for interpolation."""
        # Create mock items with different QLs
        items = []
        for ql in [100, 150, 200, 250]:
            item = Mock()
            item.ql = ql
            items.append(item)
        
        # Test target QL within range
        lo, hi = service._find_interpolation_bounds(items, 175)
        assert lo.ql == 150
        assert hi.ql == 200
        
        # Test target QL at lower bound
        lo, hi = service._find_interpolation_bounds(items, 100)
        assert lo.ql == 100
        assert hi is None
        
        # Test target QL above highest
        lo, hi = service._find_interpolation_bounds(items, 300)
        assert lo.ql == 250
        assert hi is None

    # ============================================================================
    # Stat Interpolation Tests
    # ============================================================================

    def test_interpolate_stats_basic(self, service, mock_item_lo, mock_item_hi, mock_stats_lo, mock_stats_hi):
        """Test basic stat interpolation."""
        with patch.object(service, '_load_item_stats') as mock_load:
            mock_load.side_effect = [mock_stats_lo, mock_stats_hi]
            
            interpolated = InterpolatedItem(
                id=1, name="Test", is_nano=False, interpolating=True,
                ql_delta=50, ql_delta_full=100
            )
            
            result = service._interpolate_stats(mock_item_lo, mock_item_hi, interpolated)
            
            # Should have interpolated the interpolatable stat (stat 1)
            assert len(result) == 2
            
            # Find the interpolated stat
            interp_stat = next(s for s in result if s['stat'] == 1)
            assert interp_stat['value'] == 150  # Halfway between 100 and 200
            
            # Find the non-interpolated stat
            non_interp_stat = next(s for s in result if s['stat'] == 999)
            assert non_interp_stat['value'] == 50  # Should remain unchanged

    def test_interpolate_stats_no_interpolation(self, service, mock_item_lo, mock_stats_lo):
        """Test stat loading when no interpolation is needed."""
        with patch.object(service, '_load_item_stats') as mock_load:
            mock_load.return_value = mock_stats_lo
            
            interpolated = InterpolatedItem(
                id=1, name="Test", is_nano=False, interpolating=False
            )
            
            result = service._interpolate_stats(mock_item_lo, None, interpolated)
            
            assert result == mock_stats_lo
            mock_load.assert_called_once_with(mock_item_lo)

    def test_interpolate_stats_same_values(self, service, mock_item_lo, mock_item_hi):
        """Test stat interpolation when low and high values are the same."""
        same_stats_lo = [{'id': 1, 'stat': 1, 'value': 100}]
        same_stats_hi = [{'id': 2, 'stat': 1, 'value': 100}]
        
        with patch.object(service, '_load_item_stats') as mock_load:
            mock_load.side_effect = [same_stats_lo, same_stats_hi]
            
            interpolated = InterpolatedItem(
                id=1, name="Test", is_nano=False, interpolating=True,
                ql_delta=50, ql_delta_full=100
            )
            
            result = service._interpolate_stats(mock_item_lo, mock_item_hi, interpolated)
            
            # Should return the low stat unchanged
            assert len(result) == 1
            assert result[0]['value'] == 100

    # ============================================================================
    # Spell Interpolation Tests
    # ============================================================================

    def test_interpolate_single_spell_stat_amount(self, service):
        """Test interpolation of Stat|Amount spell parameters."""
        lo_spell = InterpolatedSpell(
            spell_id=53012,  # Stat|Amount spell
            spell_params={'Stat': 1, 'Amount': 100}
        )
        hi_spell = InterpolatedSpell(
            spell_id=53012,
            spell_params={'Stat': 1, 'Amount': 200}
        )
        
        interpolated = InterpolatedItem(
            id=1, name="Test", is_nano=False, interpolating=True,
            ql_delta=50, ql_delta_full=100
        )
        
        result = service._interpolate_single_spell(lo_spell, hi_spell, interpolated)
        
        assert result.spell_params['Stat'] == 1
        assert result.spell_params['Amount'] == 150  # Interpolated value

    def test_interpolate_single_spell_skill_amount(self, service):
        """Test interpolation of Skill|Amount spell parameters."""
        lo_spell = InterpolatedSpell(
            spell_id=53026,  # Skill|Amount spell
            spell_params={'Skill': 100, 'Amount': 50}
        )
        hi_spell = InterpolatedSpell(
            spell_id=53026,
            spell_params={'Skill': 100, 'Amount': 150}
        )
        
        interpolated = InterpolatedItem(
            id=1, name="Test", is_nano=False, interpolating=True,
            ql_delta=25, ql_delta_full=100
        )
        
        result = service._interpolate_single_spell(lo_spell, hi_spell, interpolated)
        
        assert result.spell_params['Skill'] == 100
        assert result.spell_params['Amount'] == 75  # 25% between 50 and 150

    def test_interpolate_single_spell_stat_percent(self, service):
        """Test interpolation of Stat|Percent spell parameters."""
        lo_spell = InterpolatedSpell(
            spell_id=53184,  # Stat|Percent spell
            spell_params={'Stat': 2, 'Percent': 10}
        )
        hi_spell = InterpolatedSpell(
            spell_id=53184,
            spell_params={'Stat': 2, 'Percent': 30}
        )
        
        interpolated = InterpolatedItem(
            id=1, name="Test", is_nano=False, interpolating=True,
            ql_delta=50, ql_delta_full=100
        )
        
        result = service._interpolate_single_spell(lo_spell, hi_spell, interpolated)
        
        assert result.spell_params['Stat'] == 2
        assert result.spell_params['Percent'] == 20  # Halfway between 10 and 30

    def test_interpolate_single_spell_no_interpolation(self, service):
        """Test spell with non-interpolatable spell ID."""
        lo_spell = InterpolatedSpell(
            spell_id=99999,  # Non-interpolatable spell
            spell_params={'Something': 100}
        )
        hi_spell = InterpolatedSpell(
            spell_id=99999,
            spell_params={'Something': 200}
        )
        
        interpolated = InterpolatedItem(
            id=1, name="Test", is_nano=False, interpolating=True,
            ql_delta=50, ql_delta_full=100
        )
        
        result = service._interpolate_single_spell(lo_spell, hi_spell, interpolated)
        
        # Should return the low spell unchanged
        assert result.spell_params == lo_spell.spell_params

    # ============================================================================
    # Criteria Interpolation Tests
    # ============================================================================

    def test_interpolate_criteria_basic(self, service):
        """Test basic criteria interpolation."""
        lo_criteria = [
            {'id': 1, 'value1': 1, 'value2': 100, 'operator': 1}  # Interpolatable stat
        ]
        hi_criteria = [
            {'id': 2, 'value1': 1, 'value2': 200, 'operator': 1}  # Same stat, higher value
        ]
        
        interpolated = InterpolatedItem(
            id=1, name="Test", is_nano=False, interpolating=True,
            ql_delta=50, ql_delta_full=100
        )
        
        result = service._interpolate_criteria(lo_criteria, hi_criteria, interpolated)
        
        assert len(result) == 1
        assert result[0]['value1'] == 1
        assert result[0]['value2'] == 150  # Interpolated value
        assert result[0]['operator'] == 1

    def test_interpolate_criteria_non_interpolatable_stat(self, service):
        """Test criteria interpolation with non-interpolatable stat."""
        lo_criteria = [
            {'id': 1, 'value1': 999, 'value2': 100, 'operator': 1}  # Non-interpolatable stat
        ]
        hi_criteria = [
            {'id': 2, 'value1': 999, 'value2': 200, 'operator': 1}
        ]
        
        interpolated = InterpolatedItem(
            id=1, name="Test", is_nano=False, interpolating=True,
            ql_delta=50, ql_delta_full=100
        )
        
        result = service._interpolate_criteria(lo_criteria, hi_criteria, interpolated)
        
        # Should return the low criteria unchanged
        assert len(result) == 1
        assert result[0] == lo_criteria[0]

    def test_interpolate_criteria_mismatched_operators(self, service):
        """Test criteria interpolation with mismatched operators."""
        lo_criteria = [
            {'id': 1, 'value1': 1, 'value2': 100, 'operator': 1}
        ]
        hi_criteria = [
            {'id': 2, 'value1': 1, 'value2': 200, 'operator': 2}  # Different operator
        ]
        
        interpolated = InterpolatedItem(
            id=1, name="Test", is_nano=False, interpolating=True,
            ql_delta=50, ql_delta_full=100
        )
        
        result = service._interpolate_criteria(lo_criteria, hi_criteria, interpolated)
        
        # Should return the low criteria unchanged due to operator mismatch
        assert len(result) == 1
        assert result[0] == lo_criteria[0]

    # ============================================================================
    # Integration Tests
    # ============================================================================

    def test_is_item_interpolatable_nano(self, service, mock_db):
        """Test that nano items are not interpolatable."""
        # Mock finding a nano item
        mock_item = Mock()
        mock_item.is_nano = True
        mock_item.name = "Test Nano"
        
        mock_db.query.return_value.filter.return_value.first.return_value = mock_item
        
        result = service.is_item_interpolatable(12345)
        assert result is False

    def test_is_item_interpolatable_control_point(self, service, mock_db):
        """Test that Control Point items are not interpolatable."""
        # Mock finding a control point item
        mock_item = Mock()
        mock_item.is_nano = False
        mock_item.name = "Control Point Alpha"
        
        mock_db.query.return_value.filter.return_value.first.return_value = mock_item
        
        result = service.is_item_interpolatable(12345)
        assert result is False

    def test_is_item_interpolatable_multiple_variants(self, service, mock_db):
        """Test that items with multiple QL variants are interpolatable."""
        # Mock finding a regular item
        mock_item = Mock()
        mock_item.is_nano = False
        mock_item.name = "Test Weapon"
        mock_item.description = "A test weapon"
        
        # Mock finding multiple variants
        mock_variants = [Mock(), Mock(), Mock()]  # 3 variants
        
        with patch.object(service, '_find_item_variants') as mock_find:
            mock_db.query.return_value.filter.return_value.first.return_value = mock_item
            mock_find.return_value = mock_variants
            
            result = service.is_item_interpolatable(12345)
            assert result is True

    def test_is_item_interpolatable_single_variant(self, service, mock_db):
        """Test that items with single QL variant are not interpolatable."""
        # Mock finding a regular item
        mock_item = Mock()
        mock_item.is_nano = False
        mock_item.name = "Test Weapon"
        mock_item.description = "A test weapon"
        
        # Mock finding single variant
        mock_variants = [Mock()]  # Only 1 variant
        
        with patch.object(service, '_find_item_variants') as mock_find:
            mock_db.query.return_value.filter.return_value.first.return_value = mock_item
            mock_find.return_value = mock_variants
            
            result = service.is_item_interpolatable(12345)
            assert result is False

    def test_get_interpolation_range(self, service, mock_db):
        """Test getting interpolation range for an item."""
        # Mock finding an item
        mock_item = Mock()
        mock_item.name = "Test Weapon"
        mock_item.description = "A test weapon"
        
        # Mock variants with different QLs
        mock_variants = []
        for ql in [100, 150, 200]:
            variant = Mock()
            variant.ql = ql
            mock_variants.append(variant)
        
        with patch.object(service, '_find_item_variants') as mock_find:
            mock_db.query.return_value.filter.return_value.first.return_value = mock_item
            mock_find.return_value = mock_variants
            
            result = service.get_interpolation_range(12345)
            
            assert result == (100, 199)  # max QL - 1 following legacy logic

    def test_get_interpolation_range_no_item(self, service, mock_db):
        """Test getting interpolation range for non-existent item."""
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        result = service.get_interpolation_range(99999)
        assert result is None

    # ============================================================================
    # Error Handling Tests
    # ============================================================================

    def test_interpolate_item_not_found(self, service, mock_db):
        """Test interpolation when item is not found."""
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        result = service.interpolate_item(99999, 150)
        assert result is None

    def test_interpolate_item_no_variants(self, service, mock_db):
        """Test interpolation when item has no variants."""
        mock_item = Mock()
        mock_item.name = "Test"
        mock_item.description = "Test"
        
        with patch.object(service, '_find_item_variants') as mock_find:
            mock_db.query.return_value.filter.return_value.first.return_value = mock_item
            mock_find.return_value = []
            
            result = service.interpolate_item(12345, 150)
            assert result is None

    # ============================================================================
    # Edge Cases
    # ============================================================================

    def test_interpolation_metadata_setting(self, service):
        """Test that interpolation metadata is set correctly."""
        interpolated = InterpolatedItem(id=1, name="Test", is_nano=False)
        
        lo_item = Mock()
        lo_item.ql = 100
        hi_item = Mock()
        hi_item.ql = 200
        target_ql = 150
        
        interpolated.set_interpolation_metadata(lo_item, hi_item, target_ql)
        
        assert interpolated.interpolating is True
        assert interpolated.low_ql == 100
        assert interpolated.high_ql == 199  # hi_item.ql - 1
        assert interpolated.target_ql == 150
        assert interpolated.ql_delta == 50  # target_ql - lo_item.ql
        assert interpolated.ql_delta_full == 100  # hi_item.ql - lo_item.ql

    def test_interpolation_metadata_no_hi_item(self, service):
        """Test interpolation metadata when no high item is available."""
        interpolated = InterpolatedItem(id=1, name="Test", is_nano=False)
        
        lo_item = Mock()
        lo_item.ql = 100
        target_ql = 100
        
        interpolated.set_interpolation_metadata(lo_item, None, target_ql)
        
        assert interpolated.interpolating is False
        assert interpolated.low_ql == 100
        assert interpolated.high_ql == 100
        assert interpolated.target_ql == 100
        assert interpolated.ql_delta == 0
        assert interpolated.ql_delta_full == 0


# ============================================================================
# Parametrized Tests
# ============================================================================

@pytest.mark.parametrize("stat_id,expected_interpolatable", [
    (1, True),    # Known interpolatable stat
    (2, True),    # Known interpolatable stat
    (999, False), # Unknown stat (not in INTERP_STATS)
    (0, False),   # Edge case
])
def test_interp_stats_membership(stat_id, expected_interpolatable):
    """Test that INTERP_STATS set contains expected values."""
    service = InterpolationService(Mock())
    assert (stat_id in service.INTERP_STATS) == expected_interpolatable


@pytest.mark.parametrize("spell_id,expected_interpolatable", [
    (53012, True),  # Stat|Amount
    (53014, True),  # Stat|Amount
    (53026, True),  # Skill|Amount
    (53184, True),  # Stat|Percent
    (99999, False), # Unknown spell
])
def test_interpolatable_spells_membership(spell_id, expected_interpolatable):
    """Test that INTERPOLATABLE_SPELLS set contains expected values."""
    service = InterpolationService(Mock())
    assert (spell_id in service.INTERPOLATABLE_SPELLS) == expected_interpolatable


@pytest.mark.parametrize("ql_delta,ql_delta_full,lo_val,hi_val,expected", [
    (0, 100, 100, 200, 100),    # No interpolation
    (50, 100, 100, 200, 150),   # Halfway
    (25, 100, 100, 200, 125),   # Quarter way
    (75, 100, 100, 200, 175),   # Three quarters
    (100, 100, 100, 200, 200),  # Full interpolation
    (33, 100, 100, 200, 133),   # Test rounding
])
def test_interpolate_value_parametrized(ql_delta, ql_delta_full, lo_val, hi_val, expected):
    """Parametrized test for interpolate_value method."""
    interpolated = InterpolatedItem(
        id=1, name="Test", is_nano=False, interpolating=True,
        ql_delta=ql_delta, ql_delta_full=ql_delta_full
    )
    
    result = interpolated.interpolate_value(lo_val, hi_val)
    assert result == expected


class TestInterpolationRangesSimplified:
    """Test cases for the simplified interpolation ranges logic."""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session."""
        return Mock(spec=Session)

    @pytest.fixture
    def service(self, mock_db):
        """Create an InterpolationService instance with mock database."""
        return InterpolationService(mock_db)

    def test_get_interpolation_ranges_two_variants(self, service, mock_db):
        """Test interpolation ranges with two variants (like item 231123)."""
        # Mock base item
        mock_item = Mock(spec=Item)
        mock_item.name = "Apprentice Sword of Sir Tristram"
        mock_item.description = "Test description"
        
        # Mock the query to return the base item
        mock_db.query.return_value.filter.return_value.first.return_value = mock_item
        
        # Mock variants - QL 1 and QL 19
        variant1 = Mock(spec=Item)
        variant1.ql = 1
        variant1.aoid = 231123
        
        variant2 = Mock(spec=Item)
        variant2.ql = 19
        variant2.aoid = 231124
        
        variants = [variant1, variant2]
        
        with patch.object(service, '_find_item_variants') as mock_find:
            mock_find.return_value = variants
            
            result = service.get_interpolation_ranges(231123)
            
            assert result is not None
            assert len(result) == 1  # One interpolatable range
            assert result[0]["min_ql"] == 1
            assert result[0]["max_ql"] == 19
            assert result[0]["interpolatable"] is True
            assert result[0]["base_aoid"] == 231123

    def test_get_interpolation_ranges_single_variant(self, service, mock_db):
        """Test interpolation ranges with single variant (not interpolatable)."""
        # Mock base item
        mock_item = Mock(spec=Item)
        mock_item.name = "Single Item"
        mock_item.description = "Test description"
        
        # Mock the query to return the base item
        mock_db.query.return_value.filter.return_value.first.return_value = mock_item
        
        # Mock single variant
        variant1 = Mock(spec=Item)
        variant1.ql = 100
        variant1.aoid = 12345
        
        variants = [variant1]
        
        with patch.object(service, '_find_item_variants') as mock_find:
            mock_find.return_value = variants
            
            result = service.get_interpolation_ranges(12345)
            
            assert result is not None
            assert len(result) == 1
            assert result[0]["min_ql"] == 100
            assert result[0]["max_ql"] == 100
            assert result[0]["interpolatable"] is False
            assert result[0]["base_aoid"] == 12345

    def test_get_interpolation_ranges_multiple_variants(self, service, mock_db):
        """Test interpolation ranges with multiple variants."""
        # Mock base item
        mock_item = Mock(spec=Item)
        mock_item.name = "Multi Weapon"
        mock_item.description = "Test description"
        
        # Mock the query to return the base item
        mock_db.query.return_value.filter.return_value.first.return_value = mock_item
        
        # Mock variants - QL 1, 50, 100, 200
        variants = []
        for i, (ql, aoid) in enumerate([(1, 1001), (50, 1002), (100, 1003), (200, 1004)]):
            variant = Mock(spec=Item)
            variant.ql = ql
            variant.aoid = aoid
            variants.append(variant)
        
        with patch.object(service, '_find_item_variants') as mock_find:
            mock_find.return_value = variants
            
            result = service.get_interpolation_ranges(1001)
            
            assert result is not None
            assert len(result) == 3  # 1-50, 50-100, 100-200
            
            # Check first range: 1-50
            assert result[0]["min_ql"] == 1
            assert result[0]["max_ql"] == 50
            assert result[0]["interpolatable"] is True
            assert result[0]["base_aoid"] == 1001
            
            # Check second range: 50-100
            assert result[1]["min_ql"] == 50
            assert result[1]["max_ql"] == 100
            assert result[1]["interpolatable"] is True
            assert result[1]["base_aoid"] == 1002
            
            # Check third range: 100-200
            assert result[2]["min_ql"] == 100
            assert result[2]["max_ql"] == 200
            assert result[2]["interpolatable"] is True
            assert result[2]["base_aoid"] == 1003

    def test_get_interpolation_ranges_item_not_found(self, service, mock_db):
        """Test interpolation ranges when item is not found."""
        # Mock the query to return None
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        result = service.get_interpolation_ranges(99999)
        
        assert result is None

    def test_is_item_interpolatable_two_variants(self, service, mock_db):
        """Test is_item_interpolatable with two variants."""
        # Mock base item (not nano, not control point)
        mock_item = Mock(spec=Item)
        mock_item.name = "Test Item"
        mock_item.description = "Test description"
        mock_item.is_nano = False
        
        # Mock the query to return the base item
        mock_db.query.return_value.filter.return_value.first.return_value = mock_item
        
        # Mock two variants
        variant1 = Mock(spec=Item)
        variant1.ql = 1
        variant2 = Mock(spec=Item)
        variant2.ql = 19
        variants = [variant1, variant2]
        
        with patch.object(service, '_find_item_variants') as mock_find:
            mock_find.return_value = variants
            
            result = service.is_item_interpolatable(231123)
            
            assert result is True

    def test_is_item_interpolatable_nano_item(self, service, mock_db):
        """Test is_item_interpolatable with nano item (should be false)."""
        # Mock nano item
        mock_item = Mock(spec=Item)
        mock_item.name = "Test Nano"
        mock_item.description = "Test description"
        mock_item.is_nano = True
        
        # Mock the query to return the nano item
        mock_db.query.return_value.filter.return_value.first.return_value = mock_item
        
        result = service.is_item_interpolatable(12345)
        
        assert result is False

    def test_is_item_interpolatable_control_point(self, service, mock_db):
        """Test is_item_interpolatable with control point item (should be false)."""
        # Mock control point item
        mock_item = Mock(spec=Item)
        mock_item.name = "Control Point Tower"
        mock_item.description = "Test description"
        mock_item.is_nano = False
        
        # Mock the query to return the control point item
        mock_db.query.return_value.filter.return_value.first.return_value = mock_item
        
        result = service.is_item_interpolatable(12345)
        
        assert result is False

    def test_is_item_interpolatable_single_variant(self, service, mock_db):
        """Test is_item_interpolatable with single variant (should be false)."""
        # Mock base item
        mock_item = Mock(spec=Item)
        mock_item.name = "Single Item"
        mock_item.description = "Test description"
        mock_item.is_nano = False
        
        # Mock the query to return the base item
        mock_db.query.return_value.filter.return_value.first.return_value = mock_item
        
        # Mock single variant
        variant1 = Mock(spec=Item)
        variants = [variant1]
        
        with patch.object(service, '_find_item_variants') as mock_find:
            mock_find.return_value = variants
            
            result = service.is_item_interpolatable(12345)
            
            assert result is False