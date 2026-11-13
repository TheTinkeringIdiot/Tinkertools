"""
AOID is the only item identity the API takes, and item content carries no row ids.

Runs against the real database inside a rolled-back transaction.
"""

from app.models import Mob, SymbiantItem
from app.tests.db_test_constants import (
    ITEM_SYMBIANT_ADOBE_ARTILLERY_OCULAR,
    MOB_ADOBE_SUZERAIN,
)

ROW_ID_KEYS = {"id", "item_id"}


def _symbiant(db_session, aoid):
    return db_session.query(SymbiantItem).filter(SymbiantItem.aoid == aoid).one()


def _assert_no_nested_row_ids(item):
    """Stats, effects, actions and criteria are content: none carries a row id."""
    for stat in item.get("stats", []) + item.get("attack_stats", []):
        assert not ROW_ID_KEYS & stat.keys(), stat
    for stat in item.get("defense_stats", []):
        assert not ROW_ID_KEYS & stat.keys(), stat
    for spell_data in item.get("spell_data", []):
        assert not ROW_ID_KEYS & spell_data.keys(), spell_data
        for spell in spell_data["spells"]:
            assert not ROW_ID_KEYS & spell.keys(), spell
            # The game's effect type is content, not a row id
            assert "spell_id" in spell
            for criterion in spell["criteria"]:
                assert not ROW_ID_KEYS & criterion.keys(), criterion
    for action in item.get("actions", []):
        assert not ROW_ID_KEYS & action.keys(), action
        for criterion in action["criteria"]:
            assert not ROW_ID_KEYS & criterion.keys(), criterion


# ============================================================================
# Symbiants are addressed by AOID
# ============================================================================


def test_symbiant_detail_is_addressed_by_aoid(client, db_session):
    symbiant = _symbiant(db_session, ITEM_SYMBIANT_ADOBE_ARTILLERY_OCULAR)

    response = client.get(f"/api/v1/symbiants/{symbiant.aoid}")

    assert response.status_code == 200
    data = response.json()
    assert data["aoid"] == symbiant.aoid
    assert data["name"] == symbiant.name
    assert data["actions"], "a symbiant has requirements"
    assert data["spell_data"], "a symbiant has effects"
    _assert_no_nested_row_ids(data)


def test_symbiant_detail_does_not_accept_an_internal_id(client, db_session):
    symbiant = _symbiant(db_session, ITEM_SYMBIANT_ADOBE_ARTILLERY_OCULAR)
    assert symbiant.id != symbiant.aoid
    id_is_some_symbiants_aoid = (
        db_session.query(SymbiantItem).filter(SymbiantItem.aoid == symbiant.id).first()
    )

    response = client.get(f"/api/v1/symbiants/{symbiant.id}")

    if id_is_some_symbiants_aoid is None:
        assert response.status_code == 404
    else:
        assert response.json()["aoid"] == symbiant.id


def test_symbiant_dropped_by_is_addressed_by_aoid(client, db_session):
    symbiant = _symbiant(db_session, ITEM_SYMBIANT_ADOBE_ARTILLERY_OCULAR)
    boss = db_session.query(Mob).filter(Mob.name == MOB_ADOBE_SUZERAIN).one()

    response = client.get(f"/api/v1/symbiants/{symbiant.aoid}/dropped-by")

    assert response.status_code == 200
    assert boss.name in [mob["name"] for mob in response.json()]


def test_symbiant_dropped_by_unknown_aoid_is_404(client):
    response = client.get("/api/v1/symbiants/999999999/dropped-by")

    assert response.status_code == 404


# ============================================================================
# Item content carries no row ids
# ============================================================================


def test_item_detail_has_no_nested_row_ids(client, db_session):
    response = client.get(f"/api/v1/items/{ITEM_SYMBIANT_ADOBE_ARTILLERY_OCULAR}")

    assert response.status_code == 200
    data = response.json()
    assert data["stats"] and data["spell_data"] and data["actions"]
    _assert_no_nested_row_ids(data)


def test_item_list_has_no_nested_row_ids(client):
    response = client.get("/api/v1/items?page_size=20")

    assert response.status_code == 200
    items = response.json()["items"]
    assert items
    for item in items:
        _assert_no_nested_row_ids(item)


def test_symbiant_list_and_mob_drops_have_no_nested_row_ids(client, db_session):
    boss = db_session.query(Mob).filter(Mob.name == MOB_ADOBE_SUZERAIN).one()

    listed = client.get("/api/v1/symbiants?page_size=20").json()["items"]
    drops = client.get(f"/api/v1/mobs/{boss.id}/drops").json()

    assert listed and drops
    for symbiant in listed + drops:
        _assert_no_nested_row_ids(symbiant)


def test_interpolated_item_has_no_nested_row_ids(client):
    response = client.get(
        f"/api/v1/items/{ITEM_SYMBIANT_ADOBE_ARTILLERY_OCULAR}/interpolate",
        params={"target_ql": 170},
    )

    assert response.status_code == 200
    item = response.json()["item"]
    assert item["stats"]
    _assert_no_nested_row_ids(item)
    assert "attack_defense_id" not in item
    assert "animation_mesh_id" not in item
