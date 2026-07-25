"""
Tests for explicit interpolation chains (name-changing item lines).

Covers the ``interpolation_chains`` registry helpers and the routing logic in
``InterpolationService._find_item_variants`` that uses them: an item registered
in a chain must be grouped by the chain's AOIDs, while any other item must fall
back to name+description grouping.
"""

from unittest.mock import Mock, MagicMock, patch

import pytest
from sqlalchemy.orm import Session

from app.services import interpolation_chains as ic
from app.services.interpolation import InterpolationService
from app.models.item import Item


class TestInterpolationChainRegistry:
    """Unit tests for the registry helpers."""

    def test_build_index_maps_every_aoid_to_its_chain(self):
        chains = [[10, 20, 30], [40, 50]]
        index = ic._build_index(chains)

        assert index[10] == [10, 20, 30]
        assert index[30] == [10, 20, 30]
        assert index[40] == [40, 50]
        assert len(index) == 5

    def test_get_chain_for_unregistered_aoid_returns_none(self):
        # A negative AOID can never be a real item, so it is guaranteed absent
        # regardless of what real chains are registered.
        assert ic.get_chain_for_aoid(-1) is None

    def test_registered_chains_round_trip(self):
        """Every AOID in every registered chain resolves back to that chain."""
        for chain in ic.ITEM_CHAINS:
            for aoid in chain:
                assert ic.get_chain_for_aoid(aoid) == chain

    def test_no_aoid_belongs_to_two_chains(self):
        """An AOID must not be listed in more than one chain."""
        seen = set()
        for chain in ic.ITEM_CHAINS:
            for aoid in chain:
                assert aoid not in seen, f"AOID {aoid} appears in multiple chains"
                seen.add(aoid)


class TestFindItemVariantsRouting:
    """Tests that _find_item_variants picks the right grouping strategy."""

    @pytest.fixture
    def service(self):
        return InterpolationService(Mock(spec=Session))

    def _base_item(self):
        item = Mock(spec=Item)
        item.aoid = 111
        item.name = "Belt Component Platform"
        item.description = "A low-QL description"
        return item

    def _capturing_query(self):
        """A fake variant query that records the filter expression it receives."""
        captured = {}
        fake_query = MagicMock()

        def capture_filter(expr):
            captured["expr"] = expr
            return fake_query

        fake_query.filter.side_effect = capture_filter
        fake_query.order_by.return_value.all.return_value = ["variants-sentinel"]
        return fake_query, captured

    def test_uses_chain_filter_when_item_is_registered(self, service):
        base = self._base_item()
        fake_query, captured = self._capturing_query()

        with patch.object(service, "_variant_query", return_value=fake_query), \
             patch("app.services.interpolation.get_chain_for_aoid",
                   return_value=[111, 222, 333]):
            result = service._find_item_variants(base)

        assert result == ["variants-sentinel"]
        sql = str(captured["expr"])
        # Grouped by the chain's AOIDs, not by name/description.
        assert "aoid" in sql.lower()
        assert "in" in sql.lower()
        assert "name" not in sql.lower()
        assert "description" not in sql.lower()

    def test_falls_back_to_name_description_when_not_registered(self, service):
        base = self._base_item()
        fake_query, captured = self._capturing_query()

        with patch.object(service, "_variant_query", return_value=fake_query), \
             patch("app.services.interpolation.get_chain_for_aoid",
                   return_value=None):
            result = service._find_item_variants(base)

        assert result == ["variants-sentinel"]
        sql = str(captured["expr"])
        # Grouped by name AND description, not by an AOID set.
        assert "name" in sql.lower()
        assert "description" in sql.lower()
