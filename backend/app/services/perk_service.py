"""
Perk Service for TinkerTools.

Handles perk lookup, validation, effect calculation, and business logic.
Perks are items with spell_data that provide stat modifications following
three distinct type systems: SL (Shadowlands), AI (Alien Invasion), and LE (Lost Eden).
"""

from typing import List, Optional, Dict, Tuple, Any
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, func, text, Integer, or_, distinct
import logging

from app.models.item import Item, ItemSpellData, ItemStats
from app.models.perk import Perk
from app.models.spell_data import SpellData, SpellDataSpells
from app.models.spell import Spell, SpellCriterion
from app.models.action import Action, ActionCriteria
from app.api.schemas.perk import (
    PerkResponse, PerkDetail, PerkSeries, PerkValidationResponse,
    PerkCalculationResponse, PerkRequirement, PerkEffect, PerkPointCost
)
from app.api.schemas.spell import SpellDataResponse

logger = logging.getLogger(__name__)

# Game data mappings for ID to name conversion
PROFESSION_NAMES = {
    1: 'Soldier',
    2: 'MartialArtist',
    3: 'Engineer',
    4: 'Fixer',
    5: 'Agent',
    6: 'Adventurer',
    7: 'Trader',
    8: 'Bureaucrat',
    9: 'Enforcer',
    10: 'Doctor',
    11: 'NanoTechnician',
    12: 'MetaPhysicist',
    13: 'Monster',
    14: 'Keeper',
    15: 'Shade'
}

BREED_NAMES = {
    1: 'Solitus',
    2: 'Opifex',
    3: 'Nanomage',
    4: 'Atrox',
    7: 'HumanMonster'
}


class PerkService:
    """Service for perk-related operations."""

    # Perk type constants
    PERK_TYPES = ['SL', 'AI', 'LE']

    def __init__(self, db: Session):
        self.db = db

    def get_available_perks(
        self,
        character_level: Optional[int] = None,
        character_profession: Optional[str] = None,
        character_breed: Optional[str] = None,
        ai_title_level: Optional[int] = None,
        perk_types: Optional[List[str]] = None,
        available_sl_points: Optional[int] = None,
        available_ai_points: Optional[int] = None,
        owned_perks: Optional[Dict[str, int]] = None
    ) -> List[PerkResponse]:
        """
        Get available perks filtered by character constraints.

        Args:
            character_level: Character level for requirement filtering
            character_profession: Character profession for filtering
            character_breed: Character breed for filtering
            ai_title_level: AI title level for AI perk requirements
            perk_types: Filter by perk types (SL, AI, LE)
            available_sl_points: Available SL points for affordability check
            available_ai_points: Available AI points for affordability check
            owned_perks: Currently owned perks {name: level} for progression validation

        Returns:
            List of PerkResponse objects that meet the criteria
        """
        logger.info(f"Getting available perks for character level {character_level}, profession {character_profession}")

        # Start with base query joining items with perks table
        query = self.db.query(Item)\
            .join(Perk, Item.id == Perk.item_id)\
            .join(ItemSpellData, Item.id == ItemSpellData.item_id)

        # Apply character level requirement filtering
        if character_level is not None:
            query = query.filter(Perk.level_required <= character_level)

        # Apply profession filtering
        if character_profession is not None:
            profession_id = self._profession_name_to_id(character_profession)
            if profession_id is not None:
                # Use PostgreSQL array contains operator - empty array means all professions
                query = query.filter(
                    or_(
                        func.array_length(Perk.professions, 1).is_(None),  # NULL array
                        func.array_length(Perk.professions, 1) == 0,      # Empty array
                        Perk.professions.contains([profession_id])         # Contains profession
                    )
                )

        # Apply breed filtering
        if character_breed is not None:
            breed_id = self._breed_name_to_id(character_breed)
            if breed_id is not None:
                # Use PostgreSQL array contains operator - empty array means all breeds
                query = query.filter(
                    or_(
                        func.array_length(Perk.breeds, 1).is_(None),       # NULL array
                        func.array_length(Perk.breeds, 1) == 0,           # Empty array
                        Perk.breeds.contains([breed_id])                   # Contains breed
                    )
                )

        # Apply AI title level filtering
        if ai_title_level is not None:
            query = query.filter(Perk.ai_level_required <= ai_title_level)

        # Apply perk type filtering
        if perk_types is not None:
            query = query.filter(Perk.type.in_(perk_types))

        # Execute query with proper loading of relationships
        results = query.options(
            joinedload(Item.perk),
            joinedload(Item.item_spell_data).joinedload(ItemSpellData.spell_data).joinedload(SpellData.spell_data_spells).joinedload(SpellDataSpells.spell).joinedload(Spell.spell_criteria).joinedload(SpellCriterion.criterion)
        ).distinct().all()

        # Convert to response objects
        perk_responses = []
        for item in results:
            # Get perk metadata from perks table
            perk = item.perk
            if not perk:
                logger.warning(f"Item {item.id} has no perk relationship")
                continue

            # Validate ownership progression
            if owned_perks and not self._can_purchase_level(perk.name, perk.counter, owned_perks):
                continue

            # Check point affordability
            if not self._is_affordable(perk.type, perk.counter, available_sl_points, available_ai_points, owned_perks, perk.name):
                continue

            # Handle empty arrays as "all professions/breeds allowed" according to task requirements
            professions = self._profession_ids_to_names(perk.professions or [])
            breeds = self._breed_ids_to_names(perk.breeds or [])

            # If arrays are empty or None, it means all professions/breeds are allowed
            if not perk.professions or len(perk.professions) == 0:
                professions = []  # Empty list indicates "all allowed"
            if not perk.breeds or len(perk.breeds) == 0:
                breeds = []  # Empty list indicates "all allowed"

            perk_response = PerkResponse(
                id=item.id,
                aoid=item.aoid,
                name=perk.name,
                counter=perk.counter,
                type=perk.type,
                professions=professions,
                breeds=breeds,
                level=perk.level_required,
                ai_title=perk.ai_level_required if perk.ai_level_required > 0 else None,
                description=item.description,
                ql=item.ql,
                perk_series=perk.perk_series,  # Add perk_series for grouping
                formatted_name=f"{perk.name} {perk.counter}"  # Add formatted name with counter
            )
            perk_responses.append(perk_response)

        logger.info(f"Found {len(perk_responses)} available perks")
        return perk_responses

    def get_perk_series(self, perk_name: str) -> Optional[PerkSeries]:
        """
        Get all levels of a perk series (levels 1-10).

        Args:
            perk_name: Base name of the perk series

        Returns:
            PerkSeries with all available levels or None if not found
        """
        logger.info(f"Getting perk series for '{perk_name}'")

        # Query all levels of the perk by perk series
        query = self.db.query(Item)\
            .join(Perk, Item.id == Perk.item_id)\
            .join(ItemSpellData, Item.id == ItemSpellData.item_id)\
            .filter(Perk.perk_series == perk_name)\
            .options(
                joinedload(Item.perk),
                joinedload(Item.item_spell_data).joinedload(ItemSpellData.spell_data).joinedload(SpellData.spell_data_spells).joinedload(SpellDataSpells.spell).joinedload(Spell.spell_criteria).joinedload(SpellCriterion.criterion)
            )\
            .order_by(Perk.counter)

        perk_items = query.all()

        if not perk_items:
            logger.info(f"No perk series found for '{perk_name}'")
            return None

        # Convert to PerkDetail objects
        perk_levels = []
        total_cost = 0
        perk_type = None
        professions = []
        breeds = []

        for item in perk_items:
            perk = item.perk
            if not perk:
                logger.warning(f"Item {item.id} has no perk relationship")
                continue

            counter = perk.counter
            if perk_type is None:
                perk_type = perk.type
                # Handle empty arrays as "all professions/breeds allowed"
                professions = self._profession_ids_to_names(perk.professions or [])
                breeds = self._breed_ids_to_names(perk.breeds or [])

                # If arrays are empty or None, it means all professions/breeds are allowed
                if not perk.professions or len(perk.professions) == 0:
                    professions = []  # Empty list indicates "all allowed"
                if not perk.breeds or len(perk.breeds) == 0:
                    breeds = []  # Empty list indicates "all allowed"

            # Calculate point cost for this level
            cost = 1 if perk_type in ['SL', 'AI'] else 0  # LE research is free
            cumulative_cost = counter * cost if perk_type in ['SL', 'AI'] else 0
            if counter > total_cost:
                total_cost = cumulative_cost

            point_cost = PerkPointCost(
                level=counter,
                cost=cost,
                cumulative_cost=cumulative_cost
            )

            # Get spell data and effects
            spell_data_responses = self._get_spell_data_responses(item)
            effects = self._extract_perk_effects(item)
            requirements = self._extract_perk_requirements(item)

            perk_detail = PerkDetail(
                id=item.id,
                aoid=item.aoid,
                name=perk.name,
                counter=counter,
                type=perk_type,
                professions=professions,
                breeds=breeds,
                level=perk.level_required,
                ai_title=perk.ai_level_required if perk.ai_level_required > 0 else None,
                description=item.description,
                ql=item.ql,
                requirements=requirements,
                effects=effects,
                spell_data=spell_data_responses,
                point_cost=point_cost,
                perk_series=perk.perk_series,  # Add perk_series for grouping
                formatted_name=f"{perk.name} {counter}"  # Add formatted name with counter
            )
            perk_levels.append(perk_detail)

        # Sort by counter level
        perk_levels.sort(key=lambda p: p.counter)

        perk_series = PerkSeries(
            name=perk_name,
            type=perk_type or 'SL',
            professions=professions,
            breeds=breeds,
            levels=perk_levels,
            max_level=len(perk_levels),
            total_point_cost=total_cost
        )

        logger.info(f"Found perk series '{perk_name}' with {len(perk_levels)} levels")
        return perk_series

    def calculate_perk_effects(self, owned_perks: Dict[str, int]) -> Dict[str, int]:
        """
        Calculate aggregate spell_data effects from owned perks.

        Args:
            owned_perks: Dictionary mapping perk names to owned levels

        Returns:
            Dictionary mapping stat names to aggregated values
        """
        logger.info(f"Calculating effects for {len(owned_perks)} owned perks")

        total_effects = {}

        for perk_name, owned_level in owned_perks.items():
            # Get all levels from 1 to owned_level
            for level in range(1, owned_level + 1):
                # Find the perk item for this level
                perk_item = self.db.query(Item)\
                    .join(Perk, Item.id == Perk.item_id)\
                    .filter(Perk.perk_series == perk_name)\
                    .filter(Perk.counter == level)\
                    .options(\
                        joinedload(Item.perk),\
                        joinedload(Item.item_spell_data).joinedload(ItemSpellData.spell_data).joinedload(SpellData.spell_data_spells).joinedload(SpellDataSpells.spell).joinedload(Spell.spell_criteria).joinedload(SpellCriterion.criterion)\
                    )\
                    .first()

                if not perk_item:
                    logger.warning(f"Perk level not found: {perk_name} level {level}")
                    continue

                # Extract effects from spell data
                effects = self._extract_perk_effects(perk_item)

                # Aggregate effects
                for effect in effects:
                    stat_name = effect.stat_id
                    if stat_name not in total_effects:
                        total_effects[stat_name] = 0

                    # Apply effect based on modifier type
                    if effect.modifier == 'add':
                        total_effects[stat_name] += effect.value
                    elif effect.modifier == 'multiply':
                        # For multiplicative effects, we'd need a more complex system
                        # For now, treat as additive
                        total_effects[stat_name] += effect.value
                    elif effect.modifier == 'set':
                        # Set effects override previous values
                        total_effects[stat_name] = effect.value

        logger.info(f"Calculated effects for {len(total_effects)} stats")
        return total_effects

    def get_perk_info_by_aoid(self, aoid: int) -> Optional[Dict[str, Any]]:
        """
        Get complete perk item with full item details and perk metadata.

        Args:
            aoid: The AOID of the perk item

        Returns:
            Dictionary with complete perk item information or None if not found
        """
        logger.info(f"Looking up perk info by AOID: {aoid}")

        # Query the perk item by AOID with all relationships loaded
        from sqlalchemy.orm import selectinload

        perk_item = self.db.query(Item)\
            .join(Perk, Item.id == Perk.item_id)\
            .filter(Item.aoid == aoid)\
            .options(
                joinedload(Item.perk),
                selectinload(Item.item_stats).selectinload(ItemStats.stat_value),
                selectinload(Item.item_spell_data).selectinload(ItemSpellData.spell_data).selectinload(SpellData.spell_data_spells).selectinload(SpellDataSpells.spell).selectinload(Spell.spell_criteria).selectinload(SpellCriterion.criterion),
                selectinload(Item.actions).selectinload(Action.action_criteria).selectinload(ActionCriteria.criterion),
                joinedload(Item.attack_defense)
            )\
            .first()

        if not perk_item:
            logger.info(f"No perk found with AOID {aoid}")
            return None

        # Extract perk metadata
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
            "stats": [
                {
                    "stat": sv.stat_value.stat,
                    "value": sv.stat_value.value,
                    "stat_name": self._get_stat_name(sv.stat_value.stat) if hasattr(self, '_get_stat_name') else None
                }
                for sv in perk_item.item_stats
            ] if perk_item.item_stats else [],

            # Spell data (perk effects)
            "spell_data": [
                {
                    "id": sd.spell_data.id,
                    "event": sd.spell_data.event,
                    "spells": [
                        {
                            "id": spell.id,
                            "target": spell.target,
                            "tick_count": spell.tick_count,
                            "tick_interval": spell.tick_interval,
                            "spell_id": spell.spell_id,
                            "spell_format": spell.spell_format,
                            "spell_params": spell.spell_params or []
                        }
                        for spell in sd.spell_data.spells
                    ] if hasattr(sd.spell_data, 'spells') else []
                }
                for sd in perk_item.item_spell_data
            ] if perk_item.item_spell_data else [],

            # Attack/Defense stats
            "attack_stats": [],
            "defense_stats": [],

            # Actions
            "actions": [
                {
                    "id": action.id,
                    "action": action.action,
                    "criteria": [
                        {
                            "value1": ac.criterion.value1,
                            "value2": ac.criterion.value2,
                            "operator": ac.criterion.operator,
                            "order_index": ac.order_index
                        }
                        for ac in sorted(action.action_criteria, key=lambda x: x.order_index)
                    ] if action.action_criteria else []
                }
                for action in perk_item.actions
            ] if perk_item.actions else [],

            # Perk-specific metadata
            "perk_name": perk.name,
            "perk_counter": perk.counter,
            "perk_type": perk.type,
            "perk_series": perk.perk_series,
            "perk_professions": professions,
            "perk_breeds": breeds,
            "perk_level_required": perk.level_required,
            "perk_ai_level_required": perk.ai_level_required if perk.ai_level_required > 0 else None,

            # Legacy fields for backwards compatibility
            "counter": perk.counter,
            "type": perk.type,
            "level": perk.level_required,
            "ai_title": perk.ai_level_required if perk.ai_level_required > 0 else None,
            "formatted_name": f"{perk.name} {perk.counter}"
        }

        # Add attack/defense stats if available
        if perk_item.attack_defense:
            atkdef = perk_item.attack_defense
            if hasattr(atkdef, 'attack_defense_attack'):
                perk_info["attack_stats"] = [
                    {
                        "stat": atk.stat_value.stat,
                        "value": atk.stat_value.value,
                        "stat_name": self._get_stat_name(atk.stat_value.stat) if hasattr(self, '_get_stat_name') else None
                    }
                    for atk in atkdef.attack_defense_attack
                ]
            if hasattr(atkdef, 'attack_defense_defense'):
                perk_info["defense_stats"] = [
                    {
                        "stat": def_.stat_value.stat,
                        "value": def_.stat_value.value,
                        "stat_name": self._get_stat_name(def_.stat_value.stat) if hasattr(self, '_get_stat_name') else None
                    }
                    for def_ in atkdef.attack_defense_defense
                ]

        logger.info(f"Found complete perk item: {perk.name} (type: {perk.type}, level: {perk.counter})")
        return perk_info

    def get_perk_by_aoid(self, aoid: int) -> Optional[PerkDetail]:
        """
        Get a perk by its AOID (Anarchy Online ID).

        Args:
            aoid: The AOID of the perk item

        Returns:
            PerkDetail with full perk information or None if not found
        """
        logger.info(f"Looking up perk by AOID: {aoid}")

        # Query the perk item by AOID
        perk_item = self.db.query(Item)\
            .join(Perk, Item.id == Perk.item_id)\
            .filter(Item.aoid == aoid)\
            .options(
                joinedload(Item.perk),
                joinedload(Item.item_spell_data).joinedload(ItemSpellData.spell_data).joinedload(SpellData.spell_data_spells).joinedload(SpellDataSpells.spell).joinedload(Spell.spell_criteria).joinedload(SpellCriterion.criterion)
            )\
            .first()

        if not perk_item:
            logger.info(f"No perk found with AOID {aoid}")
            return None

        # Extract perk information from perk table
        perk = perk_item.perk
        if not perk:
            logger.warning(f"Item {perk_item.id} has no perk relationship")
            return None

        # Calculate point cost
        cost = 1 if perk.type in ['SL', 'AI'] else 0
        cumulative_cost = perk.counter * cost if perk.type in ['SL', 'AI'] else 0

        point_cost = PerkPointCost(
            level=perk.counter,
            cost=cost,
            cumulative_cost=cumulative_cost
        )

        # Get spell data and effects
        spell_data_responses = self._get_spell_data_responses(perk_item)
        effects = self._extract_perk_effects(perk_item)
        requirements = self._extract_perk_requirements(perk_item)

        # Handle empty arrays as "all professions/breeds allowed"
        professions = self._profession_ids_to_names(perk.professions or [])
        breeds = self._breed_ids_to_names(perk.breeds or [])

        # If arrays are empty or None, it means all professions/breeds are allowed
        if not perk.professions or len(perk.professions) == 0:
            professions = []  # Empty list indicates "all allowed"
        if not perk.breeds or len(perk.breeds) == 0:
            breeds = []  # Empty list indicates "all allowed"

        perk_detail = PerkDetail(
            id=perk_item.id,
            aoid=perk_item.aoid,
            name=perk.name,
            counter=perk.counter,
            type=perk.type,
            professions=professions,
            breeds=breeds,
            level=perk.level_required,
            ai_title=perk.ai_level_required if perk.ai_level_required > 0 else None,
            description=perk_item.description,
            ql=perk_item.ql,
            requirements=requirements,
            effects=effects,
            spell_data=spell_data_responses,
            point_cost=point_cost,
            perk_series=perk.perk_series,  # Add perk_series for grouping
            formatted_name=f"{perk.name} {perk.counter}"  # Add formatted name with counter
        )

        logger.info(f"Found perk: {perk.name} (type: {perk.type}, level: {perk.counter})")
        return perk_detail

    def validate_perk_requirements(
        self,
        perk_name: str,
        target_level: int,
        character_level: int,
        character_profession: str,
        character_breed: str,
        ai_title_level: Optional[int] = None,
        owned_perks: Optional[Dict[str, int]] = None
    ) -> PerkValidationResponse:
        """
        Validate if a character can purchase a specific perk level.

        Args:
            perk_name: Name of the perk to validate
            target_level: Target perk level to purchase
            character_level: Character's level
            character_profession: Character's profession
            character_breed: Character's breed
            ai_title_level: Character's AI title level
            owned_perks: Currently owned perks {name: level}

        Returns:
            PerkValidationResponse with validation results
        """
        logger.info(f"Validating perk '{perk_name}' level {target_level}")

        errors = []
        warnings = []
        owned_perks = owned_perks or {}

        # Find the target perk item
        perk_item = self.db.query(Item)\
            .join(Perk, Item.id == Perk.item_id)\
            .filter(Perk.perk_series == perk_name)\
            .filter(Perk.counter == target_level)\
            .options(joinedload(Item.perk))\
            .first()

        if not perk_item:
            errors.append(f"Perk '{perk_name}' level {target_level} not found")
            return PerkValidationResponse(
                valid=False,
                errors=errors,
                warnings=warnings
            )

        # Extract requirements from perk table
        perk = perk_item.perk
        if not perk:
            errors.append(f"Perk '{perk_name}' level {target_level} has no perk data")
            return PerkValidationResponse(
                valid=False,
                errors=errors,
                warnings=warnings
            )

        required_level = perk.level_required
        required_ai_title = perk.ai_level_required if perk.ai_level_required > 0 else None
        # Handle empty arrays as "all professions/breeds allowed"
        required_professions = self._profession_ids_to_names(perk.professions or [])
        required_breeds = self._breed_ids_to_names(perk.breeds or [])

        # If arrays are empty or None, it means all professions/breeds are allowed
        if not perk.professions or len(perk.professions) == 0:
            required_professions = []  # Empty list indicates "all allowed"
        if not perk.breeds or len(perk.breeds) == 0:
            required_breeds = []  # Empty list indicates "all allowed"

        # Validate character level
        if character_level < required_level:
            errors.append(f"Requires character level {required_level} (current: {character_level})")

        # Validate AI title level for AI perks
        if required_ai_title and (not ai_title_level or ai_title_level < required_ai_title):
            current_ai = ai_title_level or 0
            errors.append(f"Requires AI title level {required_ai_title} (current: {current_ai})")

        # Validate profession restriction - only check if there are specific requirements
        if required_professions and character_profession not in required_professions:
            errors.append(f"Not available for {character_profession} (requires: {', '.join(required_professions)})")

        # Validate breed restriction - only check if there are specific requirements
        if required_breeds and character_breed not in required_breeds:
            errors.append(f"Not available for {character_breed} (requires: {', '.join(required_breeds)})")

        # Validate sequential purchase requirement
        current_level = owned_perks.get(perk_name, 0)
        if target_level > current_level + 1:
            errors.append(f"Must purchase level {current_level + 1} first (sequential purchase required)")

        # Get prerequisites
        prerequisite_perks = []
        if current_level < target_level - 1:
            for level in range(current_level + 1, target_level):
                prerequisite_perks.append(f"{perk_name} level {level}")

        return PerkValidationResponse(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            required_level=required_level,
            required_ai_title=required_ai_title,
            required_professions=required_professions,
            required_breeds=required_breeds,
            prerequisite_perks=prerequisite_perks
        )

    # Helper methods for ID/name conversion

    def _profession_ids_to_names(self, profession_ids: List[int]) -> List[str]:
        """Convert profession IDs to names."""
        return [PROFESSION_NAMES.get(prof_id, f'Unknown({prof_id})') for prof_id in profession_ids if prof_id in PROFESSION_NAMES]

    def _breed_ids_to_names(self, breed_ids: List[int]) -> List[str]:
        """Convert breed IDs to names."""
        return [BREED_NAMES.get(breed_id, f'Unknown({breed_id})') for breed_id in breed_ids if breed_id in BREED_NAMES]

    def _profession_name_to_id(self, profession_name: str) -> Optional[int]:
        """Convert profession name to ID."""
        for prof_id, name in PROFESSION_NAMES.items():
            if name == profession_name:
                return prof_id
        return None

    def _breed_name_to_id(self, breed_name: str) -> Optional[int]:
        """Convert breed name to ID."""
        for breed_id, name in BREED_NAMES.items():
            if name == breed_name:
                return breed_id
        return None

    # Helper methods

# Old helper methods removed - now using Perk table data directly

    def _can_purchase_level(self, perk_name: str, target_level: int, owned_perks: Dict[str, int]) -> bool:
        """Check if character can purchase the target perk level (sequential validation)."""
        current_level = owned_perks.get(perk_name, 0)
        return target_level <= current_level + 1

    def _is_affordable(
        self,
        perk_type: str,
        perk_level: int,
        available_sl_points: Optional[int],
        available_ai_points: Optional[int],
        owned_perks: Optional[Dict[str, int]],
        perk_name: str
    ) -> bool:
        """Check if character has enough points to purchase the perk."""
        if perk_type == 'LE':
            return True  # LE research is free

        # Calculate cost (1 point per level)
        current_level = owned_perks.get(perk_name, 0) if owned_perks else 0
        cost = perk_level - current_level

        if perk_type == 'SL' and available_sl_points is not None:
            return available_sl_points >= cost
        elif perk_type == 'AI' and available_ai_points is not None:
            return available_ai_points >= cost

        return True  # If no point limits specified, assume affordable

    def _get_spell_data_responses(self, item: Item) -> List[SpellDataResponse]:
        """Convert item spell data to response format following the pattern from items endpoint."""
        from app.api.schemas.spell import SpellWithCriteria
        from app.api.schemas.criterion import CriterionResponse

        spell_data_list = []

        try:
            # Extract spell data from item's item_spell_data relationship
            if not hasattr(item, 'item_spell_data') or not item.item_spell_data:
                logger.debug(f"Item {item.id} has no spell data")
                return spell_data_list

            for isd in item.item_spell_data:
                if not isd.spell_data:
                    logger.warning(f"ItemSpellData {isd} has no spell_data relationship")
                    continue

                spell_data = isd.spell_data

                # Get spells for this spell_data with criteria
                spells_with_criteria = []
                if hasattr(spell_data, 'spell_data_spells') and spell_data.spell_data_spells:
                    for sds in spell_data.spell_data_spells:
                        if not sds.spell:
                            logger.warning(f"SpellDataSpells {sds} has no spell relationship")
                            continue

                        spell = sds.spell

                        # Get criteria for this spell - handle missing relationships gracefully
                        criteria = []
                        if hasattr(spell, 'spell_criteria') and spell.spell_criteria:
                            for sc in spell.spell_criteria:
                                if sc.criterion:
                                    criteria.append(CriterionResponse(
                                        id=sc.criterion.id,
                                        value1=sc.criterion.value1,
                                        value2=sc.criterion.value2,
                                        operator=sc.criterion.operator
                                    ))

                        spells_with_criteria.append(SpellWithCriteria(
                            id=spell.id,
                            target=spell.target,
                            tick_count=spell.tick_count,
                            tick_interval=spell.tick_interval,
                            spell_id=spell.spell_id,
                            spell_format=spell.spell_format,
                            spell_params=spell.spell_params or {},
                            criteria=criteria
                        ))

                spell_data_list.append(SpellDataResponse(
                    id=spell_data.id,
                    event=spell_data.event,
                    spells=spells_with_criteria
                ))

        except Exception as e:
            logger.error(f"Error extracting spell data for item {item.id}: {e}")
            # Return partial results instead of failing completely

        return spell_data_list

    def _extract_perk_effects(self, item: Item) -> List[PerkEffect]:
        """Extract stat effects from item spell data."""
        effects = []

        # Query spell data for this item
        spell_data_query = self.db.query(SpellData)\
            .join(ItemSpellData, SpellData.id == ItemSpellData.spell_data_id)\
            .filter(ItemSpellData.item_id == item.id)

        for spell_data in spell_data_query.all():
            # Query spells in this spell data
            spells_query = self.db.query(Spell)\
                .join(SpellDataSpells, Spell.id == SpellDataSpells.spell_id)\
                .filter(SpellDataSpells.spell_data_id == spell_data.id)

            for spell in spells_query.all():
                # Extract stat modifications from spell parameters
                if spell.spell_params and isinstance(spell.spell_params, dict):
                    stat_id = spell.spell_params.get('Stat')
                    value = spell.spell_params.get('Value', 0)

                    if stat_id:
                        effect = PerkEffect(
                            stat_id=str(stat_id),
                            value=int(value) if isinstance(value, (int, float)) else 0,
                            modifier='add',  # Default modifier
                            conditions=[]
                        )
                        effects.append(effect)

        return effects

    def _extract_perk_requirements(self, item: Item) -> List[PerkRequirement]:
        """Extract all requirements from perk data."""
        requirements = []
        perk = item.perk
        if not perk:
            return requirements

        # Extract level requirement
        if perk.level_required > 1:
            requirements.append(PerkRequirement(
                type='level',
                requirement='character_level',
                value=perk.level_required
            ))

        # Extract AI title requirement
        if perk.ai_level_required > 0:
            requirements.append(PerkRequirement(
                type='ai_title',
                requirement='ai_title_level',
                value=perk.ai_level_required
            ))

        # Extract profession requirements - handle empty arrays as "all allowed"
        if perk.professions and len(perk.professions) > 0:
            for profession in self._profession_ids_to_names(perk.professions):
                requirements.append(PerkRequirement(
                    type='profession',
                    requirement=profession
                ))

        # Extract breed requirements - handle empty arrays as "all allowed"
        if perk.breeds and len(perk.breeds) > 0:
            for breed in self._breed_ids_to_names(perk.breeds):
                requirements.append(PerkRequirement(
                    type='breed',
                    requirement=breed
                ))

        return requirements