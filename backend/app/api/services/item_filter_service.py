"""
Stat filter of the ORM routes that still read the old store (the nano routes).

The item list and item search read the content-addressed store: their filters
are in ``app.api.services.item_search``.
"""

from sqlalchemy import select

from app.models import Item, ItemStats, StatValue


def item_has_stat(*conditions):
    """EXISTS clause: the outer items row has a stat matching ``conditions``.

    ``conditions`` are expressions over ``StatValue``. Correlated on
    ``Item.id``, so it must be used in a query selecting from ``Item``:
    anchored on ``items``, the planner drives from the item set rather than
    from every matching stat row.
    """
    return (
        select(1)
        .select_from(ItemStats)
        .join(StatValue, ItemStats.stat_value_id == StatValue.id)
        .where(ItemStats.item_id == Item.id, *conditions)
        .correlate(Item)
        .exists()
    )
