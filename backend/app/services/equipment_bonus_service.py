"""
Equipment Bonus Service for TinkerTools.

Handles extraction and aggregation of stat bonuses from equipped items.
"""

from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, text, Integer, and_, select, case, literal_column
import logging
import time
from collections import defaultdict
from functools import lru_cache

from app.models.item import Item, ItemSpellData
from app.models.spell_data import SpellData, SpellDataSpells
from app.models.spell import Spell

logger = logging.getLogger(__name__)


class EquipmentBonusService:
    """Service for extracting stat bonuses from equipped items."""

    # Spell ID for stat modifications
    MODIFY_STAT_SPELL_ID = 53045

    # Additional spell IDs that may provide bonuses
    ADDITIONAL_BONUS_SPELL_IDS = [53012, 53014, 53175]

    # Events that represent equipment bonuses
    EQUIPMENT_EVENTS = [14, 2]  # Wear=14, Wield=2

    # Cache for frequently equipped items (item_id -> {stat_id: amount})
    _item_bonus_cache: Dict[int, Dict[int, int]] = {}
    _cache_timestamps: Dict[int, float] = {}

    # Cache TTL in seconds (5 minutes for equipment bonuses)
    CACHE_TTL = 300

    def __init__(self, db: Session):
        self.db = db

    def calculate_equipment_bonuses(self, item_ids: List[int]) -> Dict[int, int]:
        """
        Calculate aggregated stat bonuses from a list of equipped items.

        Args:
            item_ids: List of item IDs for equipped items

        Returns:
            Dict mapping STAT IDs to total bonus amounts
        """
        if not item_ids:
            return {}

        logger.info(f"Calculating equipment bonuses for {len(item_ids)} items")

        # Split items into cached and uncached
        cached_items = []
        uncached_items = []
        current_time = time.time()

        for item_id in item_ids:
            if (item_id in self._item_bonus_cache and
                item_id in self._cache_timestamps and
                current_time - self._cache_timestamps[item_id] < self.CACHE_TTL):
                cached_items.append(item_id)
            else:
                uncached_items.append(item_id)

        # Get bonuses from cache for cached items
        aggregated_bonuses = defaultdict(int)
        for item_id in cached_items:
            item_bonuses = self._item_bonus_cache[item_id]
            for stat_id, amount in item_bonuses.items():
                aggregated_bonuses[stat_id] += amount

        # Fetch bonuses for uncached items using optimized batch query
        if uncached_items:
            item_bonuses_dict = self._get_item_bonuses_with_item_id(uncached_items)

            # Cache individual item bonuses for future use
            current_time = time.time()
            for item_id, bonuses in item_bonuses_dict.items():
                self._item_bonus_cache[item_id] = bonuses
                self._cache_timestamps[item_id] = current_time

            # Aggregate uncached bonuses
            for item_id, bonuses in item_bonuses_dict.items():
                for stat_id, amount in bonuses.items():
                    aggregated_bonuses[stat_id] += amount

        result = dict(aggregated_bonuses)
        logger.info(f"Found bonuses for {len(result)} stats ({len(cached_items)} cached, {len(uncached_items)} fetched)")
        return result

    def calculate_implant_cluster_bonuses(self, implant_clusters: Dict[str, Dict[str, int]]) -> Dict[int, int]:
        """
        Calculate stat bonuses from implant clusters separately from base items.

        Args:
            implant_clusters: Dict mapping slot names to cluster data {stat_name: stat_id}

        Returns:
            Dict mapping STAT IDs to total bonus amounts from implant clusters
        """
        logger.info(f"Calculating implant cluster bonuses for {len(implant_clusters)} slots")

        # For implant clusters, we already have the stat mappings
        # This method would be used if clusters provide additional bonuses
        # beyond the base stat modifications
        cluster_bonuses = {}

        # Process cluster data directly since implant clusters
        # represent direct stat modifications
        for slot_name, cluster_data in implant_clusters.items():
            for stat_name, stat_id in cluster_data.items():
                # For implant clusters, the "bonus" is typically the base cluster value
                # This would need to be integrated with actual cluster value calculation
                # For now, we'll return empty dict as clusters are handled differently
                pass

        return cluster_bonuses

    def _extract_stat_bonuses_optimized(self, item_ids: List[int]) -> List[Tuple[int, int]]:
        """
        Extract stat ID and amount pairs from equipped items' spell data using optimized single query.

        Args:
            item_ids: List of item IDs to process

        Returns:
            List of (stat_id, amount) tuples
        """
        if not item_ids:
            return []

        # Optimized single query that leverages proper indexing:
        # - Uses indexed spell_id column for efficient filtering
        # - Uses indexed event column for equipment events
        # - Performs JSONB extraction at database level
        # - Aggregates all spell data in single query
        query = self.db.query(
            Item.id.label('item_id'),
            func.cast(Spell.spell_params.op('->>')(text("'Stat'")), Integer).label('stat_id'),
            func.cast(Spell.spell_params.op('->>')(text("'Amount'")), Integer).label('amount'),
            Spell.spell_id.label('spell_type')
        ).select_from(Item)\
         .join(ItemSpellData, Item.id == ItemSpellData.item_id)\
         .join(SpellData, ItemSpellData.spell_data_id == SpellData.id)\
         .join(SpellDataSpells, SpellData.id == SpellDataSpells.spell_data_id)\
         .join(Spell, and_(
             SpellDataSpells.spell_id == Spell.id,
             Spell.spell_id.in_([self.MODIFY_STAT_SPELL_ID] + self.ADDITIONAL_BONUS_SPELL_IDS)
         ))\
         .filter(Item.id.in_(item_ids))\
         .filter(SpellData.event.in_(self.EQUIPMENT_EVENTS))\
         .filter(and_(
             Spell.spell_params.op('->')(text("'Stat'")).isnot(None),
             Spell.spell_params.op('->')(text("'Amount'")).isnot(None)
         ))

        results = query.all()

        # Convert results to list of tuples, filtering out None values
        stat_bonuses = []
        for result in results:
            if result.stat_id is not None and result.amount is not None:
                stat_bonuses.append((result.stat_id, result.amount))

        logger.debug(f"Extracted {len(stat_bonuses)} stat bonuses from {len(item_ids)} items")
        return stat_bonuses

    def _extract_stat_bonuses(self, item_ids: List[int]) -> List[tuple]:
        """
        Legacy method - kept for backward compatibility.
        Use _extract_stat_bonuses_optimized for new code.
        """
        return self._extract_stat_bonuses_optimized(item_ids)

    def get_item_bonus_breakdown(self, item_id: int) -> Dict[int, int]:
        """
        Get detailed stat bonus breakdown for a single item.

        Args:
            item_id: ID of the item to analyze

        Returns:
            Dict mapping STAT IDs to bonus amounts for this item
        """
        # Check cache first
        current_time = time.time()
        if (item_id in self._item_bonus_cache and
            item_id in self._cache_timestamps and
            current_time - self._cache_timestamps[item_id] < self.CACHE_TTL):
            return self._item_bonus_cache[item_id].copy()

        stat_bonuses = self._extract_stat_bonuses_optimized([item_id])

        item_bonuses = {}
        for stat_id, amount in stat_bonuses:
            if stat_id in item_bonuses:
                item_bonuses[stat_id] += amount
            else:
                item_bonuses[stat_id] = amount

        # Cache the result
        self._item_bonus_cache[item_id] = item_bonuses.copy()
        self._cache_timestamps[item_id] = current_time

        return item_bonuses


    def _get_item_bonuses_with_item_id(self, item_ids: List[int]) -> Dict[int, Dict[int, int]]:
        """
        Get bonuses grouped by item ID for caching purposes.

        Args:
            item_ids: List of item IDs to process

        Returns:
            Dict mapping item_id to dict of {stat_id: amount}
        """
        if not item_ids:
            return {}

        # Query that includes item_id in results for proper caching
        query = self.db.query(
            Item.id.label('item_id'),
            func.cast(Spell.spell_params.op('->>')(text("'Stat'")), Integer).label('stat_id'),
            func.cast(Spell.spell_params.op('->>')(text("'Amount'")), Integer).label('amount')
        ).select_from(Item)\
         .join(ItemSpellData, Item.id == ItemSpellData.item_id)\
         .join(SpellData, ItemSpellData.spell_data_id == SpellData.id)\
         .join(SpellDataSpells, SpellData.id == SpellDataSpells.spell_data_id)\
         .join(Spell, and_(
             SpellDataSpells.spell_id == Spell.id,
             Spell.spell_id.in_([self.MODIFY_STAT_SPELL_ID] + self.ADDITIONAL_BONUS_SPELL_IDS)
         ))\
         .filter(Item.id.in_(item_ids))\
         .filter(SpellData.event.in_(self.EQUIPMENT_EVENTS))\
         .filter(and_(
             Spell.spell_params.op('->')(text("'Stat'")).isnot(None),
             Spell.spell_params.op('->')(text("'Amount'")).isnot(None)
         ))

        results = query.all()

        # Group results by item_id
        item_bonuses = defaultdict(lambda: defaultdict(int))
        for result in results:
            if result.stat_id is not None and result.amount is not None:
                item_bonuses[result.item_id][result.stat_id] += result.amount

        # Convert defaultdict to regular dict and ensure all items are represented
        final_result = {}
        for item_id in item_ids:
            final_result[item_id] = dict(item_bonuses.get(item_id, {}))

        return final_result

    def clear_cache(self) -> None:
        """Clear the item bonus cache."""
        self._item_bonus_cache.clear()
        self._cache_timestamps.clear()
        logger.info("Equipment bonus cache cleared")

    def get_cache_stats(self) -> Dict[str, int]:
        """Get cache statistics for monitoring."""
        current_time = time.time()
        valid_entries = sum(1 for item_id, timestamp in self._cache_timestamps.items()
                          if current_time - timestamp < self.CACHE_TTL)

        return {
            "total_cached_items": len(self._item_bonus_cache),
            "valid_cached_items": valid_entries,
            "expired_cached_items": len(self._item_bonus_cache) - valid_entries
        }