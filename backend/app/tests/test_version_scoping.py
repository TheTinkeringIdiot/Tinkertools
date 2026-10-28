"""
Spell and stat-value listings return only rows reachable from the current
version's items.

When content tables are shared across versions (design.md section 12), the
spells and stat_values tables hold every version's rows; only ``items`` is
filtered by version. These tests stand in for "another version's row" with a
row no item of this version references, inside the per-test transaction, and
check each listing hides it until an item of this version references it.
"""

import pytest

from app.models import (
    Item,
    ItemSpellData,
    ItemStats,
    Spell,
    SpellData,
    SpellDataSpells,
    StatValue,
)
from app.tests.db_test_constants import ITEM_CELL_SCANNER

UNUSED_TARGET = 987654  # no real spell has this target
UNUSED_SPELL_ID = 987655  # no real spell has this spell type
UNUSED_FORMAT = "Zzqx version scoping probe"


@pytest.fixture(autouse=True)
def clear_response_cache(client):
    """Listings are cached per query; start and end each test with a cold cache."""
    client.post("/api/v1/cache/clear")
    yield
    client.post("/api/v1/cache/clear")


@pytest.fixture
def unlinked_spell(db_session):
    """A spell no item of this version reaches, like another version's spell."""
    spell = Spell(
        target=UNUSED_TARGET,
        tick_count=1,
        tick_interval=0,
        spell_id=UNUSED_SPELL_ID,
        spell_format=UNUSED_FORMAT,
        spell_params={},
    )
    db_session.add(spell)
    db_session.flush()
    return spell


def _link_spell_to_item(db_session, spell):
    """Attach the spell to a real item of this version."""
    item = db_session.query(Item).filter(Item.aoid == ITEM_CELL_SCANNER).one()
    spell_data = SpellData(event=14)
    db_session.add(spell_data)
    db_session.flush()
    db_session.add(ItemSpellData(item_id=item.id, spell_data_id=spell_data.id))
    db_session.add(SpellDataSpells(spell_data_id=spell_data.id, spell_id=spell.id))
    db_session.flush()


def _spell_endpoints_find(client, spell):
    """Which spell endpoints return the spell."""
    client.post("/api/v1/cache/clear")
    by_target = client.get(f"/api/v1/spells?target={UNUSED_TARGET}").json()
    by_criteria = client.get(
        f"/api/v1/spells/with-criteria?spell_id={UNUSED_SPELL_ID}"
    ).json()
    by_search = client.get(f"/api/v1/spells/search?q={UNUSED_FORMAT}").json()
    detail = client.get(f"/api/v1/spells/{spell.id}")
    return {
        "list": [row["id"] for row in by_target["items"]] == [spell.id]
        and by_target["total"] == 1,
        "with-criteria": [row["id"] for row in by_criteria["items"]] == [spell.id]
        and by_criteria["total"] == 1,
        "search": [row["id"] for row in by_search["items"]] == [spell.id]
        and by_search["total"] == 1,
        "detail": detail.status_code == 200,
    }


def test_spell_endpoints_hide_a_spell_no_item_reaches(
    client, db_session, unlinked_spell
):
    found = _spell_endpoints_find(client, unlinked_spell)

    assert found == {
        "list": False,
        "with-criteria": False,
        "search": False,
        "detail": False,
    }
    assert client.get(f"/api/v1/spells/{unlinked_spell.id}").status_code == 404


def test_spell_endpoints_show_the_spell_once_an_item_reaches_it(
    client, db_session, unlinked_spell
):
    _link_spell_to_item(db_session, unlinked_spell)

    found = _spell_endpoints_find(client, unlinked_spell)

    assert found == {
        "list": True,
        "with-criteria": True,
        "search": True,
        "detail": True,
    }


def _listed_stat_value_ids(client):
    response = client.get("/api/v1/stat-values?skip=0&limit=1000000")
    assert response.status_code == 200
    return {row["id"] for row in response.json()}


def test_stat_values_listing_is_scoped_to_values_items_use(client, db_session):
    unused = StatValue(stat=987654, value=987654)
    db_session.add(unused)
    db_session.flush()

    assert unused.id not in _listed_stat_value_ids(client)

    item = db_session.query(Item).filter(Item.aoid == ITEM_CELL_SCANNER).one()
    db_session.add(ItemStats(item_id=item.id, stat_value_id=unused.id))
    db_session.flush()
    client.post("/api/v1/cache/clear")

    assert unused.id in _listed_stat_value_ids(client)


def test_stat_values_listing_keeps_attack_and_defense_values(client, db_session):
    """Values reached only through a weapon's attack/defense stats still list."""
    from app.models import AttackDefenseAttack

    used_only_in_attack = (
        db_session.query(StatValue.id)
        .join(AttackDefenseAttack, AttackDefenseAttack.stat_value_id == StatValue.id)
        .filter(
            ~db_session.query(ItemStats)
            .filter(ItemStats.stat_value_id == StatValue.id)
            .exists()
        )
        .first()
    )
    assert used_only_in_attack is not None

    assert used_only_in_attack[0] in _listed_stat_value_ids(client)
