"""
Service for filtering weapons based on character stats and requirements.
"""

import logging
from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_

from app.models import (
    Item, ItemStats, StatValue, AttackDefense, AttackDefenseAttack, AttackDefenseDefense,
    Action, ActionCriteria, Criterion, ItemSpellData, SpellData,
    SpellDataSpells, Spell, SpellCriterion, ItemSource, Source, SourceType
)
from app.api.schemas import ItemDetail
from app.api.schemas.weapon_analysis import WeaponAnalyzeRequest
from app.api.routes.items import build_item_detail

logger = logging.getLogger(__name__)


class WeaponFilterService:
    """Service for filtering weapons based on character requirements."""

    # Weapon item class constant
    WEAPON_ITEM_CLASS = 1

    # NPC family requirement constant (should be excluded)
    NPC_FAMILY_STAT = 455  # Stat ID for NPCFamily requirement

    # Faction stat
    FACTION_STAT = 33

    def __init__(self, db: Session):
        self.db = db

    def filter_weapons(self, request: WeaponAnalyzeRequest) -> List[ItemDetail]:
        """
        Filter weapons based on character stats and requirements.

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

        # Start with base query for weapons with attack/defense data
        # No QL filtering - return all QL variants for proper interpolation
        query = self.db.query(Item).options(
            joinedload(Item.item_stats).joinedload(ItemStats.stat_value),
            joinedload(Item.attack_defense).joinedload(AttackDefense.attack_stats).joinedload(AttackDefenseAttack.stat_value),
            joinedload(Item.attack_defense).joinedload(AttackDefense.defense_stats).joinedload(AttackDefenseDefense.stat_value),
            joinedload(Item.item_spell_data).joinedload(ItemSpellData.spell_data).joinedload(SpellData.spell_data_spells).joinedload(SpellDataSpells.spell).joinedload(Spell.spell_criteria).joinedload(SpellCriterion.criterion),
            joinedload(Item.actions).joinedload(Action.action_criteria).joinedload(ActionCriteria.criterion),
            joinedload(Item.item_sources).joinedload(ItemSource.source).joinedload(Source.source_type)
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
        # Optimize: Use JOIN instead of subquery
        query = query.join(
            Action, Item.id == Action.item_id
        ).join(
            ActionCriteria, Action.id == ActionCriteria.action_id
        )

        # Exclude items with NPC family requirements (NPC-only weapons)
        # Note: Must use subquery for exclusion to avoid false positives
        npc_family_subquery = self.db.query(Item.id).join(
            Action, Item.id == Action.item_id
        ).join(
            ActionCriteria, Action.id == ActionCriteria.action_id
        ).join(
            Criterion, ActionCriteria.criterion_id == Criterion.id
        ).filter(
            Criterion.value1 == self.NPC_FAMILY_STAT
        )
        query = query.filter(~Item.id.in_(npc_family_subquery))

        # Apply faction filter if needed (side 0 = neutral can use all)
        if request.side > 0:
            # Include items with no faction requirement OR matching faction requirement
            faction_subquery = self.db.query(Item.id).join(
                ItemStats, Item.id == ItemStats.item_id
            ).join(
                StatValue, ItemStats.stat_value_id == StatValue.id
            ).filter(
                StatValue.stat == self.FACTION_STAT,
                StatValue.value != request.side,
                StatValue.value != 0  # 0 = no faction requirement
            )
            query = query.filter(~Item.id.in_(faction_subquery))

        # Apply breed filter
        # Breed requirements are stored in actions/criteria with stat 4
        # Only exclude if breed requirement exists and doesn't match
        breed_subquery = self.db.query(Item.id).join(
            Action, Item.id == Action.item_id
        ).join(
            ActionCriteria, Action.id == ActionCriteria.action_id
        ).join(
            Criterion, ActionCriteria.criterion_id == Criterion.id
        ).filter(
            Criterion.value1 == 4,  # Stat 4 = Breed
            Criterion.value2 != request.breed_id,
            Criterion.value2 != 0  # 0 = no breed requirement
        )
        query = query.filter(~Item.id.in_(breed_subquery))

        # Apply profession filter
        # Profession requirements are in stat 60 or 368
        # Only exclude if profession requirement exists and doesn't match
        # Profession 0 = "Any" can use all items
        if request.profession_id > 0:
            profession_subquery = self.db.query(Item.id).join(
                Action, Item.id == Action.item_id
            ).join(
                ActionCriteria, Action.id == ActionCriteria.action_id
            ).join(
                Criterion, ActionCriteria.criterion_id == Criterion.id
            ).filter(
                Action.action == 3,  # Action type 3 = Use/Equip
                or_(
                    Criterion.value1 == 60,   # Stat 60 = Profession
                    Criterion.value1 == 368   # Stat 368 = VisualProfession
                ),
                Criterion.value2 != request.profession_id,
                Criterion.value2 != 0  # 0 = any profession
            )
            query = query.filter(~Item.id.in_(profession_subquery))

        # Use distinct to avoid duplicates
        query = query.distinct()

        # Execute query and get results
        items = query.all()

        logger.info(f"Found {len(items)} weapons matching criteria")

        # Build detailed item responses
        detailed_items = [build_item_detail(item, self.db) for item in items]

        return detailed_items
