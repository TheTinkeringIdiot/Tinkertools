"""
Helper functions for querying real test data from the database.

These functions replace fixture creation by querying actual database records
using known AOIDs and IDs. All functions use proper relationship loading to
avoid N+1 query problems.

Usage:
    from app.tests.db_helpers import get_item_by_aoid
    from app.tests.db_test_constants import ITEM_PISTOL_MASTERY

    item = await get_item_by_aoid(session, ITEM_PISTOL_MASTERY)
"""

from typing import Optional, List
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Item,
    ItemStats,
    ItemSource,
    Perk,
    Spell,
    SpellCriterion,
    Mob,
    Source,
    SourceType,
    StatValue,
)


# =============================================================================
# Item Helpers
# =============================================================================


async def get_item_by_aoid(session: AsyncSession, aoid: int) -> Item:
    """
    Get item by AOID with all stats loaded.

    Args:
        session: Database session
        aoid: Anarchy Online ID of the item

    Returns:
        Item with item_stats and stat_value relationships loaded

    Example:
        item = await get_item_by_aoid(session, 29246)  # Pistol Mastery
        assert len(item.item_stats) == 26
    """
    result = await session.execute(
        select(Item)
        .options(selectinload(Item.item_stats).selectinload(ItemStats.stat_value))
        .where(Item.aoid == aoid)
    )
    return result.scalar_one()


async def get_item_with_sources(session: AsyncSession, aoid: int) -> Item:
    """
    Get item by AOID with all sources loaded.

    Args:
        session: Database session
        aoid: Anarchy Online ID of the item

    Returns:
        Item with stats, item_sources, sources, and source_types loaded

    Example:
        item = await get_item_with_sources(session, 29246)
        assert len(item.item_sources) == 29
        for item_source in item.item_sources:
            print(item_source.source.source_type.name)
    """
    result = await session.execute(
        select(Item)
        .options(
            selectinload(Item.item_stats).selectinload(ItemStats.stat_value),
            selectinload(Item.item_sources)
            .selectinload(ItemSource.source)
            .selectinload(Source.source_type),
        )
        .where(Item.aoid == aoid)
    )
    return result.scalar_one()


async def get_items_by_aoid_batch(
    session: AsyncSession, aoids: List[int]
) -> List[Item]:
    """
    Load multiple items efficiently by AOID.

    Args:
        session: Database session
        aoids: List of Anarchy Online IDs

    Returns:
        List of items with stats loaded

    Example:
        items = await get_items_by_aoid_batch(session, [29246, 220345, 210789])
        assert len(items) == 3
    """
    result = await session.execute(
        select(Item)
        .options(selectinload(Item.item_stats).selectinload(ItemStats.stat_value))
        .where(Item.aoid.in_(aoids))
    )
    return list(result.scalars().all())


async def get_item_by_id(session: AsyncSession, item_id: int) -> Item:
    """
    Get item by internal database ID.

    Args:
        session: Database session
        item_id: Internal database ID

    Returns:
        Item with stats loaded

    Note:
        Prefer get_item_by_aoid() when possible, as AOIDs are more stable
    """
    result = await session.execute(
        select(Item)
        .options(selectinload(Item.item_stats).selectinload(ItemStats.stat_value))
        .where(Item.id == item_id)
    )
    return result.scalar_one()


# =============================================================================
# Perk Helpers
# =============================================================================


async def get_perk_by_item_id(session: AsyncSession, item_id: int) -> Perk:
    """
    Get perk by item_id with item loaded.

    Args:
        session: Database session
        item_id: Item ID (perks.item_id is the primary key)

    Returns:
        Perk with item relationship loaded

    Example:
        perk = await get_perk_by_item_id(session, 82832)  # Accumulator 1
        assert perk.counter == 1
        assert perk.type == "SL"
        assert perk.item.aoid == 210830
    """
    result = await session.execute(
        select(Perk).options(selectinload(Perk.item)).where(Perk.item_id == item_id)
    )
    return result.scalar_one()


async def get_perk_series(
    session: AsyncSession, series_name: str
) -> List[tuple[Perk, Item]]:
    """
    Get all perks in a series, ordered by counter.

    Args:
        session: Database session
        series_name: Name of the perk series (e.g., "Accumulator")

    Returns:
        List of (Perk, Item) tuples ordered by counter

    Example:
        perks = await get_perk_series(session, "Accumulator")
        assert len(perks) == 5
        for perk, item in perks:
            print(f"{perk.name} counter {perk.counter}")
    """
    result = await session.execute(
        select(Perk, Item)
        .join(Item, Perk.item_id == Item.id)
        .where(Perk.perk_series == series_name)
        .order_by(Perk.counter)
    )
    return list(result.all())


async def get_perks_by_type(session: AsyncSession, perk_type: str) -> List[Perk]:
    """
    Get all perks of a specific type (SL/AI/LE).

    Args:
        session: Database session
        perk_type: Type of perk ("SL", "AI", or "LE")

    Returns:
        List of perks with items loaded

    Example:
        sl_perks = await get_perks_by_type(session, "SL")
        ai_perks = await get_perks_by_type(session, "AI")
    """
    result = await session.execute(
        select(Perk)
        .options(selectinload(Perk.item))
        .where(Perk.type == perk_type)
    )
    return list(result.scalars().all())


# =============================================================================
# Spell Helpers
# =============================================================================


async def get_spell_by_id(session: AsyncSession, spell_id: int) -> Spell:
    """
    Get spell with all criteria loaded.

    Args:
        session: Database session
        spell_id: Spell ID

    Returns:
        Spell with spell_criteria and criterion relationships loaded

    Example:
        spell = await get_spell_by_id(session, 234997)
        assert len(spell.spell_criteria) == 34
        for sc in spell.spell_criteria:
            print(sc.criterion)
    """
    result = await session.execute(
        select(Spell)
        .options(
            selectinload(Spell.spell_criteria).selectinload(SpellCriterion.criterion)
        )
        .where(Spell.id == spell_id)
    )
    return result.scalar_one()


async def get_spells_with_criteria_count(
    session: AsyncSession, min_count: int
) -> List[tuple[Spell, int]]:
    """
    Get spells with at least min_count criteria.

    Args:
        session: Database session
        min_count: Minimum number of criteria

    Returns:
        List of (Spell, count) tuples ordered by criteria count descending

    Example:
        spells = await get_spells_with_criteria_count(session, 25)
        for spell, count in spells[:5]:  # Top 5 most complex
            print(f"Spell {spell.id} has {count} criteria")
    """
    result = await session.execute(
        select(Spell, func.count(SpellCriterion.criterion_id).label("count"))
        .join(SpellCriterion, Spell.id == SpellCriterion.spell_id)
        .group_by(Spell.id)
        .having(func.count(SpellCriterion.criterion_id) >= min_count)
        .order_by(func.count(SpellCriterion.criterion_id).desc())
    )
    return list(result.all())


# =============================================================================
# Mob Helpers
# =============================================================================


async def get_mob_by_id(session: AsyncSession, mob_id: int) -> Mob:
    """
    Get mob by ID.

    Args:
        session: Database session
        mob_id: Mob ID

    Returns:
        Mob instance

    Example:
        mob = await get_mob_by_id(session, 1171)  # Adobe Suzerain
        assert mob.name == "Adobe Suzerain"
        assert mob.level == 125
        assert mob.is_pocket_boss is True
    """
    result = await session.execute(select(Mob).where(Mob.id == mob_id))
    return result.scalar_one()


async def get_mob_with_drops(session: AsyncSession, mob_id: int) -> Mob:
    """
    Get mob with all dropped items loaded via sources system.

    Args:
        session: Database session
        mob_id: Mob ID

    Returns:
        Mob with a cached list of dropped items in mob.dropped_items_cached

    Example:
        mob = await get_mob_with_drops(session, 1171)
        for item in mob.dropped_items_cached:
            print(f"{mob.name} drops {item.name}")

    Note:
        This uses a custom cached attribute rather than the property
        to avoid lazy loading issues in tests.
    """
    mob = await get_mob_by_id(session, mob_id)

    # Get source_type_id for 'mob'
    source_type_result = await session.execute(
        select(SourceType).where(SourceType.name == "mob")
    )
    source_type = source_type_result.scalar_one()

    # Get items dropped by this mob
    result = await session.execute(
        select(Item)
        .join(ItemSource, Item.id == ItemSource.item_id)
        .join(Source, ItemSource.source_id == Source.id)
        .where(Source.source_id == mob.id)
        .where(Source.source_type_id == source_type.id)
    )
    mob.dropped_items_cached = list(result.scalars().all())

    return mob


async def get_pocket_boss_mobs(session: AsyncSession) -> List[Mob]:
    """
    Get all pocket boss mobs.

    Args:
        session: Database session

    Returns:
        List of mobs where is_pocket_boss is True

    Example:
        pocket_bosses = await get_pocket_boss_mobs(session)
        for mob in pocket_bosses:
            print(f"{mob.name} (Level {mob.level})")
    """
    result = await session.execute(
        select(Mob).where(Mob.is_pocket_boss == True).order_by(Mob.level)
    )
    return list(result.scalars().all())


async def get_mobs_by_level_range(
    session: AsyncSession, min_level: int, max_level: int
) -> List[Mob]:
    """
    Get mobs within a level range.

    Args:
        session: Database session
        min_level: Minimum level (inclusive)
        max_level: Maximum level (inclusive)

    Returns:
        List of mobs in level range

    Example:
        mid_level_bosses = await get_mobs_by_level_range(session, 100, 200)
    """
    result = await session.execute(
        select(Mob)
        .where(Mob.level >= min_level)
        .where(Mob.level <= max_level)
        .order_by(Mob.level)
    )
    return list(result.scalars().all())


# =============================================================================
# Source Helpers
# =============================================================================


async def get_source_by_id(session: AsyncSession, source_id: int) -> Source:
    """
    Get source by ID with source_type loaded.

    Args:
        session: Database session
        source_id: Source ID

    Returns:
        Source with source_type relationship loaded

    Example:
        source = await get_source_by_id(session, 1)  # Adobe Suzerain mob source
        assert source.source_type.name == "mob"
    """
    result = await session.execute(
        select(Source)
        .options(selectinload(Source.source_type))
        .where(Source.id == source_id)
    )
    return result.scalar_one()


async def get_source_with_items(session: AsyncSession, source_id: int) -> Source:
    """
    Get source with all items that come from it.

    Args:
        session: Database session
        source_id: Source ID

    Returns:
        Source with item_sources and items loaded

    Example:
        source = await get_source_with_items(session, 1)
        assert len(source.item_sources) == 7
        for item_source in source.item_sources:
            print(f"Drops {item_source.item.name}")
    """
    result = await session.execute(
        select(Source)
        .options(
            selectinload(Source.source_type),
            selectinload(Source.item_sources).selectinload(ItemSource.item),
        )
        .where(Source.id == source_id)
    )
    return result.scalar_one()


async def get_sources_by_type(
    session: AsyncSession, source_type_id: int
) -> List[Source]:
    """
    Get all sources of a specific type.

    Args:
        session: Database session
        source_type_id: Source type ID (1=item, 2=npc, 3=mob, 4=mission, 5=vendor)

    Returns:
        List of sources of the specified type

    Example:
        mob_sources = await get_sources_by_type(session, 3)  # All mob sources
        for source in mob_sources:
            print(source.name)
    """
    result = await session.execute(
        select(Source)
        .options(selectinload(Source.source_type))
        .where(Source.source_type_id == source_type_id)
    )
    return list(result.scalars().all())


async def get_item_sources(
    session: AsyncSession, item_id: int
) -> List[ItemSource]:
    """
    Get all sources for a specific item.

    Args:
        session: Database session
        item_id: Item ID

    Returns:
        List of ItemSource junction records with source and source_type loaded

    Example:
        sources = await get_item_sources(session, 121201)  # Pistol Mastery
        for item_source in sources:
            source = item_source.source
            print(f"{source.source_type.name}: {source.name}")
    """
    result = await session.execute(
        select(ItemSource)
        .options(
            selectinload(ItemSource.source).selectinload(Source.source_type)
        )
        .where(ItemSource.item_id == item_id)
    )
    return list(result.scalars().all())


# =============================================================================
# Stat Value Helpers
# =============================================================================


async def get_stat_value_by_id(session: AsyncSession, stat_id: int) -> StatValue:
    """
    Get stat value by ID.

    Args:
        session: Database session
        stat_id: Stat value ID

    Returns:
        StatValue instance

    Example:
        stat = await get_stat_value_by_id(session, 103)
        print(f"Stat {stat.stat}: {stat.value}")
    """
    return await session.get(StatValue, stat_id)


async def get_stats_by_stat_type(
    session: AsyncSession, stat_type: int, limit: Optional[int] = None
) -> List[StatValue]:
    """
    Get all stat values of a specific stat type.

    Args:
        session: Database session
        stat_type: Stat type number (e.g., 0, 1, 6, 23, etc.)
        limit: Optional limit on results

    Returns:
        List of StatValue instances

    Example:
        # Get all stat values for stat type 6
        stats = await get_stats_by_stat_type(session, 6)
        for stat in stats:
            print(f"Stat ID {stat.id}: value={stat.value}")
    """
    query = select(StatValue).where(StatValue.stat == stat_type)
    if limit:
        query = query.limit(limit)

    result = await session.execute(query)
    return list(result.scalars().all())


async def count_item_sources(session: AsyncSession, aoid: int) -> int:
    """
    Count sources for an item efficiently without loading them all.

    Args:
        session: Database session
        aoid: Item AOID

    Returns:
        Number of sources

    Example:
        count = await count_item_sources(session, 29246)
        assert count == 29
    """
    result = await session.execute(
        select(func.count(ItemSource.source_id))
        .join(Item, ItemSource.item_id == Item.id)
        .where(Item.aoid == aoid)
    )
    return result.scalar()
