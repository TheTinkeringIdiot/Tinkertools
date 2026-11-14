"""
The item-anchored EXISTS filters of the nano routes return exactly the items
the former ``items.id IN (SELECT item_id FROM <child table> ...)`` subqueries
returned.

The legacy formulations are rebuilt here as the reference. The rewrite only
changes how the planner drives the query (from items instead of from every
matching child row), so on the real data both must select the same ids.

The filters of the item list and search are tested in test_item_search.
"""

import pytest
from sqlalchemy import and_, or_
from sqlalchemy.orm import aliased

from app.api.routes.nanos import _has_profession_requirement, _has_valid_strain
from app.models import (
    Action,
    ActionCriteria,
    Criterion,
    Item,
    ItemStats,
    StatValue,
)

# --------------------------------------------------------------------------
# Legacy (child-first) subqueries, as they were before the rewrite
# --------------------------------------------------------------------------


def _legacy_stat_items(db, *conditions):
    return (
        db.query(ItemStats.item_id)
        .join(StatValue, ItemStats.stat_value_id == StatValue.id)
        .filter(*conditions)
    )


def _ids(query):
    return {row[0] for row in query.all()}


# --------------------------------------------------------------------------
# Nano profession / strain filters
# --------------------------------------------------------------------------


def _legacy_nano_profession_items(db, profession_id):
    ac_current = aliased(ActionCriteria)
    c_current = aliased(Criterion)
    ac_prev = aliased(ActionCriteria)
    c_prev = aliased(Criterion)
    return (
        db.query(Action.item_id)
        .join(ac_current, Action.id == ac_current.action_id)
        .join(c_current, ac_current.criterion_id == c_current.id)
        .outerjoin(
            ac_prev,
            and_(
                ac_prev.action_id == Action.id,
                ac_prev.order_index == ac_current.order_index - 1,
            ),
        )
        .outerjoin(c_prev, ac_prev.criterion_id == c_prev.id)
        .filter(
            Action.action == 3,
            or_(
                and_(c_current.value1 == 60, c_current.value2 == profession_id),
                and_(c_current.value1 == 368, c_current.value2 == profession_id),
            ),
            or_(c_prev.id.is_(None), c_prev.operator != 18),
        )
    )


@pytest.mark.parametrize("profession_id", [11, 6])
def test_nano_profession_filter_matches_legacy_subquery(db_session, profession_id):
    nanos = db_session.query(Item.id).filter(Item.is_nano.is_(True))
    legacy_strain = Item.id.in_(
        _legacy_stat_items(
            db_session,
            StatValue.stat == 75,
            StatValue.value > 0,
            StatValue.value != 99999,
        )
    )

    rewritten = _ids(
        nanos.filter(_has_valid_strain(), _has_profession_requirement(profession_id))
    )
    legacy = _ids(
        nanos.filter(
            legacy_strain,
            Item.id.in_(_legacy_nano_profession_items(db_session, profession_id)),
        )
    )

    assert rewritten == legacy
    assert len(rewritten) > 100
