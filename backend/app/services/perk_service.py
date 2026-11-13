"""
Perk Service for TinkerTools.

Handles perk lookup by AOID.
Perks are items with spell_data that provide stat modifications following
three distinct type systems: SL (Shadowlands), AI (Alien Invasion), and LE (Lost Eden).
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session, joinedload
import logging

from app.models.item import Item, ItemSpellData, ItemStats
from app.models.perk import Perk
from app.models.spell_data import SpellData, SpellDataSpells
from app.models.spell import Spell, SpellCriterion
from app.models.action import Action, ActionCriteria

logger = logging.getLogger(__name__)

# Game data mappings for ID to name conversion
PROFESSION_NAMES = {
    1: "Soldier",
    2: "MartialArtist",
    3: "Engineer",
    4: "Fixer",
    5: "Agent",
    6: "Adventurer",
    7: "Trader",
    8: "Bureaucrat",
    9: "Enforcer",
    10: "Doctor",
    11: "NanoTechnician",
    12: "MetaPhysicist",
    13: "Monster",
    14: "Keeper",
    15: "Shade",
}

BREED_NAMES = {1: "Solitus", 2: "Opifex", 3: "Nanomage", 4: "Atrox", 7: "HumanMonster"}


class PerkService:
    """Service for perk-related operations."""

    def __init__(self, db: Session):
        self.db = db

    def _build_perk_info_dict(self, perk_item: Item) -> Optional[Dict[str, Any]]:
        """
        Build a complete perk info dictionary from a loaded perk Item.

        Expects perk_item to have perk, item_stats, item_spell_data, actions,
        and attack_defense relationships already loaded.

        Returns:
            Dictionary with complete perk item information or None if no perk relationship
        """
        perk = perk_item.perk
        if not perk:
            logger.warning(f"Item {perk_item.id} has no perk relationship")
            return None

        # Handle empty arrays as "all professions/breeds allowed"
        professions = self._profession_ids_to_names(perk.professions or [])
        breeds = self._breed_ids_to_names(perk.breeds or [])

        if not perk.professions or len(perk.professions) == 0:
            professions = []
        if not perk.breeds or len(perk.breeds) == 0:
            breeds = []

        # Build the complete perk item response with all item details
        perk_info = {
            # Item base information
            "id": perk_item.id,
            "aoid": perk_item.aoid,
            "name": perk_item.name,
            "ql": perk_item.ql,
            "item_class": perk_item.item_class,
            "description": perk_item.description,
            "is_nano": perk_item.is_nano,
            # Item stats
            "stats": (
                [
                    {
                        "stat": sv.stat_value.stat,
                        "value": sv.stat_value.value,
                        "stat_name": (
                            self._get_stat_name(sv.stat_value.stat)
                            if hasattr(self, "_get_stat_name")
                            else None
                        ),
                    }
                    for sv in perk_item.item_stats
                ]
                if perk_item.item_stats
                else []
            ),
            # Spell data (perk effects)
            "spell_data": (
                [
                    {
                        "id": sd.spell_data.id,
                        "event": sd.spell_data.event,
                        "spells": (
                            [
                                {
                                    "id": spell.id,
                                    "target": spell.target,
                                    "tick_count": spell.tick_count,
                                    "tick_interval": spell.tick_interval,
                                    "spell_id": spell.spell_id,
                                    "spell_format": spell.spell_format,
                                    "spell_params": spell.spell_params or [],
                                }
                                for spell in sd.spell_data.spells
                            ]
                            if hasattr(sd.spell_data, "spells")
                            else []
                        ),
                    }
                    for sd in perk_item.item_spell_data
                ]
                if perk_item.item_spell_data
                else []
            ),
            # Attack/Defense stats
            "attack_stats": [],
            "defense_stats": [],
            # Actions
            "actions": (
                [
                    {
                        "id": action.id,
                        "action": action.action,
                        "criteria": (
                            [
                                {
                                    "value1": ac.criterion.value1,
                                    "value2": ac.criterion.value2,
                                    "operator": ac.criterion.operator,
                                    "order_index": ac.order_index,
                                }
                                for ac in sorted(
                                    action.action_criteria, key=lambda x: x.order_index
                                )
                            ]
                            if action.action_criteria
                            else []
                        ),
                    }
                    for action in perk_item.actions
                ]
                if perk_item.actions
                else []
            ),
            # Perk-specific metadata
            "perk_name": perk.name,
            "perk_counter": perk.counter,
            "perk_type": perk.type,
            "perk_series": perk.perk_series,
            "perk_professions": professions,
            "perk_breeds": breeds,
            "perk_level_required": perk.level_required,
            "perk_ai_level_required": (
                perk.ai_level_required if perk.ai_level_required > 0 else None
            ),
            # Legacy fields for backwards compatibility
            "counter": perk.counter,
            "type": perk.type,
            "level": perk.level_required,
            "ai_title": perk.ai_level_required if perk.ai_level_required > 0 else None,
            "formatted_name": f"{perk.name} {perk.counter}",
        }

        # Add attack/defense stats if available
        if perk_item.attack_defense:
            atkdef = perk_item.attack_defense
            if hasattr(atkdef, "attack_defense_attack"):
                perk_info["attack_stats"] = [
                    {
                        "stat": atk.stat_value.stat,
                        "value": atk.stat_value.value,
                        "stat_name": (
                            self._get_stat_name(atk.stat_value.stat)
                            if hasattr(self, "_get_stat_name")
                            else None
                        ),
                    }
                    for atk in atkdef.attack_defense_attack
                ]
            if hasattr(atkdef, "attack_defense_defense"):
                perk_info["defense_stats"] = [
                    {
                        "stat": def_.stat_value.stat,
                        "value": def_.stat_value.value,
                        "stat_name": (
                            self._get_stat_name(def_.stat_value.stat)
                            if hasattr(self, "_get_stat_name")
                            else None
                        ),
                    }
                    for def_ in atkdef.attack_defense_defense
                ]

        return perk_info

    def batch_get_perk_info_by_aoids(
        self, aoids: List[int]
    ) -> Dict[int, Optional[Dict[str, Any]]]:
        """
        Batch lookup multiple perks by their AOIDs in a single query.

        Args:
            aoids: List of AOIDs to look up

        Returns:
            Dict mapping AOID to perk info dict (or None if not found)
        """
        if not aoids:
            return {}

        from sqlalchemy.orm import selectinload

        perk_items = (
            self.db.query(Item)
            .join(Perk, Item.id == Perk.item_id)
            .filter(Item.aoid.in_(aoids))
            .options(
                joinedload(Item.perk),
                selectinload(Item.item_stats).selectinload(ItemStats.stat_value),
                selectinload(Item.item_spell_data)
                .selectinload(ItemSpellData.spell_data)
                .selectinload(SpellData.spell_data_spells)
                .selectinload(SpellDataSpells.spell)
                .selectinload(Spell.spell_criteria)
                .selectinload(SpellCriterion.criterion),
                selectinload(Item.actions)
                .selectinload(Action.action_criteria)
                .selectinload(ActionCriteria.criterion),
                joinedload(Item.attack_defense),
            )
            .all()
        )

        # Build lookup by AOID
        results = {}
        for perk_item in perk_items:
            perk_info = self._build_perk_info_dict(perk_item)
            results[perk_item.aoid] = perk_info

        logger.info(f"Batch perk lookup: {len(aoids)} requested, {len(results)} found")
        return results

    # Helper methods for ID/name conversion

    def _profession_ids_to_names(self, profession_ids: List[int]) -> List[str]:
        """Convert profession IDs to names."""
        return [
            PROFESSION_NAMES.get(prof_id, f"Unknown({prof_id})")
            for prof_id in profession_ids
            if prof_id in PROFESSION_NAMES
        ]

    def _breed_ids_to_names(self, breed_ids: List[int]) -> List[str]:
        """Convert breed IDs to names."""
        return [
            BREED_NAMES.get(breed_id, f"Unknown({breed_id})")
            for breed_id in breed_ids
            if breed_id in BREED_NAMES
        ]
