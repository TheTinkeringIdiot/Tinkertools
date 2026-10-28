"""
The item-anchored EXISTS / NOT EXISTS filters return exactly the items the
former ``items.id IN / NOT IN (SELECT item_id FROM <child table> ...)``
subqueries returned.

The legacy formulations are rebuilt here as the reference. The rewrite only
changes how the planner drives the query (from items instead of from every
matching child row), so on the real data both must select the same ids.
"""

import pytest
from sqlalchemy import Integer, and_, or_
from sqlalchemy.orm import aliased

from app.api.routes.nanos import _has_profession_requirement, _has_valid_strain
from app.api.services.item_filter_service import (
    STAT_MODIFY_SPELLS,
    apply_common_item_filters,
)
from app.models import (
    Action,
    ActionCriteria,
    Criterion,
    Item,
    ItemSpellData,
    ItemStats,
    Spell,
    SpellData,
    SpellDataSpells,
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


def _legacy_criterion_items(db, *conditions):
    return (
        db.query(Action.item_id)
        .join(ActionCriteria, Action.id == ActionCriteria.action_id)
        .join(Criterion, ActionCriteria.criterion_id == Criterion.id)
        .filter(*conditions)
    )


def _legacy_modifier_items(db, stat_ids, operator=None, value=None):
    subqueries = []
    for spell_id, param_field in STAT_MODIFY_SPELLS:
        stat_accessor = Spell.spell_params.op("->>")(param_field).cast(Integer)
        amount_accessor = Spell.spell_params.op("->>")("Amount").cast(Integer)
        subq = (
            db.query(Item.id.distinct())
            .join(ItemSpellData, Item.id == ItemSpellData.item_id)
            .join(SpellData, ItemSpellData.spell_data_id == SpellData.id)
            .join(SpellDataSpells, SpellData.id == SpellDataSpells.spell_data_id)
            .join(Spell, SpellDataSpells.spell_id == Spell.id)
            .filter(Spell.spell_id == spell_id)
            .filter(stat_accessor.in_(stat_ids))
        )
        if operator == ">=":
            subq = subq.filter(amount_accessor >= value)
        subqueries.append(subq)
    return subqueries[0].union(*subqueries[1:])


def _ids(query):
    return {row[0] for row in query.all()}


def _base(db):
    # A few thousand items: big enough to exercise every filter, cheap to run.
    return db.query(Item.id).filter(Item.ql.between(200, 220))


# --------------------------------------------------------------------------
# apply_common_item_filters
# --------------------------------------------------------------------------

CASES = {
    "slot": (
        {"slot": 6},
        lambda db: [
            Item.id.in_(
                _legacy_stat_items(
                    db, StatValue.stat == 298, StatValue.value.op("&")(1 << 6) > 0
                )
            )
        ],
    ),
    "breed": (
        {"breed": 1},
        lambda db: [
            Item.id.in_(
                _legacy_criterion_items(
                    db, Criterion.value1 == 4, Criterion.value2 == 1
                )
            )
        ],
    ),
    "faction": (
        {"faction": 1},
        lambda db: [
            Item.id.in_(
                _legacy_criterion_items(
                    db, Criterion.value1 == 33, Criterion.value2 == 1
                )
            )
        ],
    ),
    "profession": (
        {"profession": 11},
        lambda db: [
            Item.id.in_(
                _legacy_criterion_items(
                    db,
                    Action.action == 3,
                    or_(
                        and_(Criterion.value1 == 60, Criterion.value2 == 11),
                        and_(Criterion.value1 == 368, Criterion.value2 == 11),
                    ),
                )
            )
        ],
    ),
    "froob_friendly": (
        {"froob_friendly": True},
        lambda db: [
            ~Item.id.in_(_legacy_stat_items(db, StatValue.stat == 389)),
            ~Item.id.in_(_legacy_criterion_items(db, Criterion.value1 == 389)),
        ],
    ),
    "nodrop": (
        {"nodrop": True},
        lambda db: [
            Item.id.in_(
                _legacy_stat_items(
                    db, StatValue.stat == 0, StatValue.value.op("&")(16384) > 0
                )
            )
        ],
    ),
    "not_nodrop": (
        {"nodrop": False},
        lambda db: [
            ~Item.id.in_(
                _legacy_stat_items(
                    db, StatValue.stat == 0, StatValue.value.op("&")(16384) > 0
                )
            )
        ],
    ),
    "strain": (
        {"strain": 1},
        lambda db: [
            Item.id.in_(
                _legacy_stat_items(db, StatValue.stat == 75, StatValue.value == 1)
            )
        ],
    ),
    "stat_bonuses": (
        {"stat_bonuses": "16,17,124"},
        lambda db: [Item.id.in_(_legacy_modifier_items(db, [16, 17, 124]))],
    ),
    "requires": (
        {"stat_filters": "requires:16:>=:300"},
        lambda db: [
            Item.id.in_(
                _legacy_criterion_items(
                    db, Criterion.value1 == 16, Criterion.value2 >= 300
                )
            )
        ],
    ),
    "modifies": (
        {"stat_filters": "modifies:124:>=:20"},
        lambda db: [Item.id.in_(_legacy_modifier_items(db, [124], ">=", 20))],
    ),
}


@pytest.mark.parametrize("case", sorted(CASES))
def test_filter_selects_the_same_items_as_the_legacy_subquery(db_session, case):
    kwargs, legacy_conditions = CASES[case]

    rewritten = _ids(apply_common_item_filters(_base(db_session), db_session, **kwargs))
    legacy = _ids(_base(db_session).filter(*legacy_conditions(db_session)))

    assert rewritten == legacy
    # Every case must select something and drop something, or it proves nothing.
    assert 0 < len(rewritten) < len(_ids(_base(db_session)))


def test_combined_filters_select_the_same_items(db_session):
    """Several filters stacked, as in a stat + requirement search."""
    kwargs = {
        "froob_friendly": True,
        "nodrop": False,
        "stat_filters": "requires:16:>=:300,modifies:124:>=:20",
    }
    legacy_conditions = [
        cond
        for case in ("froob_friendly", "not_nodrop", "requires", "modifies")
        for cond in CASES[case][1](db_session)
    ]
    base = db_session.query(Item.id).filter(Item.ql.between(100, 300))

    rewritten = _ids(apply_common_item_filters(base, db_session, **kwargs))
    legacy = _ids(base.filter(*legacy_conditions))

    assert rewritten == legacy
    assert rewritten


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
