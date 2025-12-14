"""
Service for filtering weapons based on character stats and requirements.
"""

import logging
from typing import List, Optional
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import and_, or_, select, BigInteger, Integer, func

from app.models import (
    Item, ItemStats, StatValue, AttackDefense, AttackDefenseAttack, AttackDefenseDefense,
    Action, ActionCriteria, Criterion, ItemSpellData, SpellData,
    SpellDataSpells, Spell, SpellCriterion, ItemSource, Source, SourceType
)
from app.api.schemas import ItemDetail
from app.api.schemas.weapon_analysis import WeaponAnalyzeRequest
from app.api.routes.items import build_item_details_bulk

logger = logging.getLogger(__name__)


class WeaponFilterService:
    """Service for filtering weapons based on character requirements."""

    # Weapon item class constant
    WEAPON_ITEM_CLASS = 1

    # NPC family requirement constant (should be excluded)
    NPC_FAMILY_STAT = 455  # Stat ID for NPCFamily requirement

    # Faction stat
    FACTION_STAT = 33

    # Expansion stat
    EXPANSION_STAT = 389

    def __init__(self, db: Session):
        self.db = db

    def filter_weapons(self, request: WeaponAnalyzeRequest) -> List[ItemDetail]:
        """
        Filter weapons based on character stats and requirements.

        Uses two-stage loading to prevent timeout:
        1. Filter with minimal loading (only attack stats for filtering)
        2. Load full details for filtered results only

        Args:
            request: WeaponAnalyzeRequest containing character data

        Returns:
            List of ItemDetail objects for equipable weapons
        """
        logger.info(
            f"Filtering weapons for level={request.level}, breed={request.breed_id}, "
            f"profession={request.profession_id}, side={request.side}, "
            f"skills={[s.skill_id for s in request.top_weapon_skills]}"
        )

        # STAGE 1: Filter with minimal loading (only what's needed for filtering)
        # No QL filtering - return all QL variants for proper interpolation
        query = self.db.query(Item).options(
            # Only load attack stats (needed for weapon skill filtering)
            joinedload(Item.attack_defense)
                .joinedload(AttackDefense.attack_stats)
                .joinedload(AttackDefenseAttack.stat_value)
        ).filter(
            Item.atkdef_id.isnot(None),
            Item.item_class == self.WEAPON_ITEM_CLASS
        )

        # Filter by weapon skill matching
        # Include weapons where any of the top 3 skills is:
        # - The highest attack stat contributor (primary skill)
        # - OR contributes >= 50% to attack rating (50/50 split)
        if request.top_weapon_skills:
            # Optimize: Use single JOIN instead of 3 separate subqueries
            query = query.join(
                AttackDefense, Item.atkdef_id == AttackDefense.id
            ).join(
                AttackDefenseAttack, AttackDefense.id == AttackDefenseAttack.attack_defense_id
            ).join(
                StatValue, AttackDefenseAttack.stat_value_id == StatValue.id
            ).filter(
                or_(*[
                    and_(StatValue.stat == skill.skill_id, StatValue.value >= 50)
                    for skill in request.top_weapon_skills
                ])
            )

        # Only include items with at least one requirement (excludes unequippable items)
        query = query.join(
            Action, Item.id == Action.item_id
        ).join(
            ActionCriteria, Action.id == ActionCriteria.action_id
        )

        # OPTIMIZED: Use subqueries materialized once + NOT IN for exclusions
        # Much faster than multiple correlated NOT EXISTS subqueries that scan tables repeatedly

        # Exclude items with NPC family requirements (NPC-only weapons)
        npc_weapon_ids = select(Item.id).select_from(Item).join(
            Action, Item.id == Action.item_id
        ).join(
            ActionCriteria, Action.id == ActionCriteria.action_id
        ).join(
            Criterion, ActionCriteria.criterion_id == Criterion.id
        ).where(
            Action.action == 8,  # Action type 8 = WIELD
            Criterion.value1 == self.NPC_FAMILY_STAT
        ).scalar_subquery()

        query = query.filter(Item.id.not_in(npc_weapon_ids))

        # Apply faction filter if needed (side 0 = neutral can use all)
        if request.side > 0:
            faction_restricted_ids = select(Item.id).select_from(Item).join(
                ItemStats, ItemStats.item_id == Item.id
            ).join(
                StatValue, StatValue.id == ItemStats.stat_value_id
            ).where(
                StatValue.stat == self.FACTION_STAT,
                StatValue.value != request.side,
                StatValue.value != 0
            ).scalar_subquery()

            query = query.filter(Item.id.not_in(faction_restricted_ids))

        # Apply breed filter
        breed_restricted_ids = select(Item.id).select_from(Item).join(
            Action, Item.id == Action.item_id
        ).join(
            ActionCriteria, Action.id == ActionCriteria.action_id
        ).join(
            Criterion, ActionCriteria.criterion_id == Criterion.id
        ).where(
            Action.action == 8,  # Action type 8 = WIELD
            Criterion.value1 == 4,  # Stat 4 = Breed
            Criterion.value2 != request.breed_id,
            Criterion.value2 != 0
        ).scalar_subquery()

        query = query.filter(Item.id.not_in(breed_restricted_ids))

        # Apply profession filter
        # Include items where: no profession requirement OR profession matches (handles OR logic correctly)
        if request.profession_id > 0:
            # Items with profession requirements
            items_with_prof_req = select(Item.id).select_from(Item).join(
                Action, Item.id == Action.item_id
            ).join(
                ActionCriteria, Action.id == ActionCriteria.action_id
            ).join(
                Criterion, ActionCriteria.criterion_id == Criterion.id
            ).where(
                Action.action == 8,
                or_(
                    Criterion.value1 == 60,   # Stat 60 = Profession
                    Criterion.value1 == 368   # Stat 368 = VisualProfession
                )
            ).scalar_subquery()

            # Items where profession matches (includes items with value2=0 for "any profession")
            items_prof_match = select(Item.id).select_from(Item).join(
                Action, Item.id == Action.item_id
            ).join(
                ActionCriteria, Action.id == ActionCriteria.action_id
            ).join(
                Criterion, ActionCriteria.criterion_id == Criterion.id
            ).where(
                Action.action == 8,
                or_(
                    Criterion.value1 == 60,
                    Criterion.value1 == 368
                ),
                or_(
                    Criterion.value2 == request.profession_id,
                    Criterion.value2 == 0
                )
            ).scalar_subquery()

            # Include items without profession requirements OR with matching profession
            query = query.filter(
                or_(
                    Item.id.not_in(items_with_prof_req),  # No profession requirement
                    Item.id.in_(items_prof_match)          # Has matching profession
                )
            )

        # Apply expansion filter - Operator 22 (StatBitSet)
        # Exclude items requiring expansions character doesn't have
        expansion_required_not_met = select(Item.id).select_from(Item).join(
            Action, Item.id == Action.item_id
        ).join(
            ActionCriteria, Action.id == ActionCriteria.action_id
        ).join(
            Criterion, ActionCriteria.criterion_id == Criterion.id
        ).where(
            Action.action == 8,
            Criterion.value1 == self.EXPANSION_STAT,
            Criterion.operator == 22,
            func.cast(
                func.cast(request.expansion_bitflag, BigInteger).op('&')(
                    func.cast(Criterion.value2, BigInteger)
                ),
                Integer
            ) != Criterion.value2
        ).scalar_subquery()

        query = query.filter(Item.id.not_in(expansion_required_not_met))

        # Apply expansion filter - Operator 107 (StatBitNotSet)
        # Exclude items forbidden for character's expansions
        expansion_forbidden = select(Item.id).select_from(Item).join(
            Action, Item.id == Action.item_id
        ).join(
            ActionCriteria, Action.id == ActionCriteria.action_id
        ).join(
            Criterion, ActionCriteria.criterion_id == Criterion.id
        ).where(
            Action.action == 8,
            Criterion.value1 == self.EXPANSION_STAT,
            Criterion.operator == 107,
            func.cast(
                func.cast(request.expansion_bitflag, BigInteger).op('&')(
                    func.cast(Criterion.value2, BigInteger)
                ),
                Integer
            ) != 0
        ).scalar_subquery()

        query = query.filter(Item.id.not_in(expansion_forbidden))

        # Use distinct to avoid duplicates
        query = query.distinct()

        # Execute filtering query (Stage 1)
        items = query.all()

        logger.info(f"Found {len(items)} weapons matching criteria")

        # STAGE 2: Load full details for filtered results only
        # This prevents timeout by only loading deep relationships for filtered items
        if not items:
            return []

        item_ids = [item.id for item in items]

        # Stage 2: Load item details with all relationships
        # Use selectinload for large result sets (200-1000 weapons) to avoid Cartesian products
        # For smaller result sets or single-item lookups, joinedload would be more efficient
        detailed_query = self.db.query(Item).options(
            selectinload(Item.item_stats).selectinload(ItemStats.stat_value),
            selectinload(Item.item_spell_data).selectinload(ItemSpellData.spell_data)
                .selectinload(SpellData.spell_data_spells).selectinload(SpellDataSpells.spell)
                .selectinload(Spell.spell_criteria).selectinload(SpellCriterion.criterion),
            selectinload(Item.actions).selectinload(Action.action_criteria)
                .selectinload(ActionCriteria.criterion),
            selectinload(Item.attack_defense)
                .selectinload(AttackDefense.attack_stats)
                .selectinload(AttackDefenseAttack.stat_value),
            selectinload(Item.attack_defense)
                .selectinload(AttackDefense.defense_stats)
                .selectinload(AttackDefenseDefense.stat_value),
            selectinload(Item.item_sources)
                .selectinload(ItemSource.source)
                .selectinload(Source.source_type)
        ).filter(Item.id.in_(item_ids))

        detailed_items_objs = detailed_query.all()

        logger.info(f"Loaded full details for {len(detailed_items_objs)} weapons")

        # Build detailed item responses using bulk transformation
        detailed_items = build_item_details_bulk(detailed_items_objs, self.db)

        return detailed_items
