"""
Shared item filtering logic.

These helpers were previously duplicated (nearly verbatim) between
`get_items`, `search_items`, and other item endpoints in
`app.api.routes.items`. Centralizing them ensures that a fix to one
filter (e.g. profession handling for stat 368) applies everywhere.

Stat ID reference for the filters below:
- 0   ITEM_NONE_FLAG (bit 16384 = NODROP)
- 4   Breed
- 33  Faction
- 59  Gender
- 60  Profession / 368 VisualProfession
- 75  NanoStrain
- 298 EquippedIn (bitmask of equipment slots)
- 389 Expansion requirement (used for froob filtering)

Every child-table filter is an EXISTS / NOT EXISTS correlated on the outer
``items`` row rather than ``items.id IN (SELECT item_id FROM <child> ...)``.
The IN form is planned child-first: it collects every matching child row in
the database and then probes items. Anchored on ``items``, the planner can
drive from the (version-filtered) item set, so the cost follows the size of
one version rather than of every revision in a shared store. NOT EXISTS is
also planned as an anti-join, where NOT IN can only be a hashed subplan.
"""

import logging
from typing import List, Optional

from sqlalchemy import or_, and_, Integer, select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    Item,
    ItemStats,
    StatValue,
    AttackDefense,
    AttackDefenseAttack,
    AttackDefenseDefense,
    ItemSpellData,
    SpellData,
    SpellDataSpells,
    Spell,
    SpellCriterion,
    Action,
    ActionCriteria,
    Criterion,
    ItemSource,
    Source,
)

logger = logging.getLogger(__name__)

# Spell IDs that modify stats and their parameter field names
# 53045: "Modify Stat" - permanent stat modification, uses 'Stat' field
# 53012: "Modify Stat" - variant, uses 'Stat' field
# 53014: "Modify Stat for Duration" - temporary buff, uses 'Stat' field
# 53026: "Set Skill" - sets stat to value, uses 'Skill' field
STAT_MODIFY_SPELLS = [
    (53045, "Stat"),
    (53012, "Stat"),
    (53014, "Stat"),
    (53026, "Skill"),
]

NODROP_FLAG = 16384  # bit within stat 0 (ITEM_NONE_FLAG)


def _compare(column, operator: str, value: int):
    """``column <operator> value`` for the operators the stat filters accept."""
    if operator == ">=":
        return column >= value
    if operator == "<=":
        return column <= value
    if operator == "==":
        return column == value
    if operator == "!=":
        return column != value
    raise ValueError(f"Unsupported operator: {operator}")


def item_has_stat(*conditions):
    """EXISTS clause: the outer items row has a stat matching ``conditions``.

    ``conditions`` are expressions over ``StatValue``. Correlated on
    ``Item.id``, so it must be used in a query selecting from ``Item``.
    """
    return (
        select(1)
        .select_from(ItemStats)
        .join(StatValue, ItemStats.stat_value_id == StatValue.id)
        .where(ItemStats.item_id == Item.id, *conditions)
        .correlate(Item)
        .exists()
    )


def item_has_criterion(*conditions):
    """EXISTS clause: an action of the outer items row has a matching criterion.

    ``conditions`` are expressions over ``Action`` and ``Criterion``.
    """
    return (
        select(1)
        .select_from(Action)
        .join(ActionCriteria, Action.id == ActionCriteria.action_id)
        .join(Criterion, ActionCriteria.criterion_id == Criterion.id)
        .where(Action.item_id == Item.id, *conditions)
        .correlate(Item)
        .exists()
    )


def item_modifies_stat(stat_ids: list, operator: str = None, value: int = None):
    """
    EXISTS clause: the outer items row has a spell that modifies one of ``stat_ids``.

    Handles multiple spell types that can modify stats:
    - 53045/53012/53014: Modify Stat spells (param: 'Stat')
    - 53026: Set Skill spells (param: 'Skill')

    Args:
        stat_ids: List of stat IDs to search for
        operator: Optional operator for value comparison ('>=', '<=', '==', '!=')
        value: Optional value to compare against (requires operator)

    Returns:
        A boolean clause correlated on ``Item.id``.
    """
    spell_matches = [
        and_(
            Spell.spell_id == spell_id,
            Spell.spell_params.op("->>")(param_field).cast(Integer).in_(stat_ids),
        )
        for spell_id, param_field in STAT_MODIFY_SPELLS
    ]
    conditions = [ItemSpellData.item_id == Item.id, or_(*spell_matches)]

    # Apply value comparison if specified
    if operator and value is not None:
        amount_accessor = Spell.spell_params.op("->>")("Amount").cast(Integer)
        conditions.append(_compare(amount_accessor, operator, value))

    return (
        select(1)
        .select_from(ItemSpellData)
        .join(SpellData, ItemSpellData.spell_data_id == SpellData.id)
        .join(SpellDataSpells, SpellData.id == SpellDataSpells.spell_data_id)
        .join(Spell, SpellDataSpells.spell_id == Spell.id)
        .where(*conditions)
        .correlate(Item)
        .exists()
    )


def apply_stat_filters(query, stat_filters: str, db: Session):
    """
    Apply stat filters to the query.
    Format: 'function:stat:operator:value' separated by commas
    Example: 'requires:16:>=:500,modifies:124:>=:20'
    """
    if not stat_filters:
        return query

    try:
        filters = []
        for filter_str in stat_filters.split(","):
            parts = filter_str.strip().split(":")
            if len(parts) != 4:
                logger.warning(f"Invalid stat filter format: {filter_str}")
                continue

            function, stat_str, operator, value_str = parts

            # Validate function
            if function not in ["requires", "modifies"]:
                logger.warning(f"Invalid stat filter function: {function}")
                continue

            # Validate operator
            if operator not in ["==", "<=", ">=", "!="]:
                logger.warning(f"Invalid stat filter operator: {operator}")
                continue

            try:
                stat_id = int(stat_str)
                value = int(value_str)
            except ValueError:
                logger.warning(f"Invalid stat ID or value in filter: {filter_str}")
                continue

            filters.append((function, stat_id, operator, value))

        if not filters:
            return query

        # Apply each filter
        for function, stat_id, operator, value in filters:
            if function == "requires":
                # Look for requirement criteria in actions
                query = query.filter(
                    item_has_criterion(
                        Criterion.value1 == stat_id,
                        _compare(Criterion.value2, operator, value),
                    )
                )

            elif function == "modifies":
                # Look for stat modification spells (handles multiple spell types)
                query = query.filter(item_modifies_stat([stat_id], operator, value))

        # Use distinct to avoid duplicates from joins
        query = query.distinct()

    except Exception as e:
        logger.error(f"Error applying stat filters: {e}")
        # Return original query if there's an error parsing filters
        return query

    return query


def apply_common_item_filters(
    query,
    db: Session,
    *,
    slot: Optional[int] = None,
    breed: Optional[int] = None,
    gender: Optional[int] = None,
    faction: Optional[int] = None,
    profession: Optional[int] = None,
    froob_friendly: Optional[bool] = None,
    nodrop: Optional[bool] = None,
    stat_bonuses: Optional[str] = None,
    stat_filters: Optional[str] = None,
    strain: Optional[int] = None,
):
    """
    Apply the advanced filters shared by the item list/search endpoints.

    Behavior is identical to the blocks formerly inlined in `get_items`
    and `search_items`. Endpoint-specific filters (ql range, item_class,
    is_nano, text search) remain in the route handlers because their
    semantics differ between endpoints.
    """
    # Equipment slot filter (stat 298 - EquippedIn, bitmask)
    if slot is not None and slot > 0:
        query = query.filter(
            item_has_stat(StatValue.stat == 298, StatValue.value.op("&")(1 << slot) > 0)
        )

    # Requirement filters
    if breed is not None and breed > 0:
        query = query.filter(
            item_has_criterion(Criterion.value1 == 4, Criterion.value2 == breed)
        )

    if gender is not None and gender > 0:
        query = query.filter(
            item_has_criterion(Criterion.value1 == 59, Criterion.value2 == gender)
        )

    if faction is not None and faction > 0:
        query = query.filter(
            item_has_criterion(Criterion.value1 == 33, Criterion.value2 == faction)
        )

    # Profession: both Profession (stat 60) and VisualProfession (stat 368)
    # are valid, and only on wear/use actions (action == 3)
    if profession is not None and profession > 0:
        query = query.filter(
            item_has_criterion(
                Action.action == 3,
                Criterion.value1.in_((60, 368)),
                Criterion.value2 == profession,
            )
        )

    # Froob friendly filter (exclude items with expansion requirements).
    # NOT EXISTS rather than NOT IN: same result here (item_stats.item_id is
    # NOT NULL and no action has a NULL item_id), and it plans as an anti-join.
    if froob_friendly is True:
        query = query.filter(
            ~item_has_stat(StatValue.stat == 389),
            ~item_has_criterion(Criterion.value1 == 389),
        )

    # NoDrop filter (stat 0 - ITEM_NONE_FLAG, bit 16384)
    if nodrop is not None:
        has_nodrop = item_has_stat(
            StatValue.stat == 0, StatValue.value.op("&")(NODROP_FLAG) > 0
        )
        query = query.filter(has_nodrop if nodrop else ~has_nodrop)

    # Stat bonus filters - find items that modify specific stats
    if stat_bonuses:
        try:
            bonus_stat_ids = [
                int(stat_id.strip())
                for stat_id in stat_bonuses.split(",")
                if stat_id.strip()
            ]
            if bonus_stat_ids:
                query = query.filter(item_modifies_stat(bonus_stat_ids))
        except ValueError:
            logger.warning(f"Invalid stat_bonuses parameter: {stat_bonuses}")

    # Stat filters ('function:stat:operator:value' syntax)
    query = apply_stat_filters(query, stat_filters, db)

    # Strain filter (stat 75 - NanoStrain)
    if strain is not None and strain > 0:
        query = query.filter(
            item_has_stat(StatValue.stat == 75, StatValue.value == strain)
        )

    return query


def item_detail_load_options() -> List:
    """
    Eager-loading options for building full ItemDetail responses.

    Apply to a paginated query *after* counting, so the count runs on a
    lightweight query and relationships load only for the page returned.
    """
    return [
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
        selectinload(Item.item_sources)
        .selectinload(ItemSource.source)
        .selectinload(Source.source_type),
        selectinload(Item.attack_defense)
        .selectinload(AttackDefense.attack_stats)
        .selectinload(AttackDefenseAttack.stat_value),
        selectinload(Item.attack_defense)
        .selectinload(AttackDefense.defense_stats)
        .selectinload(AttackDefenseDefense.stat_value),
    ]
