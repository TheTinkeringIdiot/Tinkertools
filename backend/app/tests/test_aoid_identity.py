"""
AOID is the only item identity the API takes, and item content carries no row ids.

Runs against the real game data of the development store.
"""

from sqlalchemy import select

from app.store import tables as t
from app.store.presence import present, revisions
from app.tests.db_test_constants import (
    ITEM_SYMBIANT_ADOBE_ARTILLERY_OCULAR,
    MOB_ADOBE_SUZERAIN,
)

ROW_ID_KEYS = {"id", "item_id"}


def _symbiants(build, *conditions):
    """SELECT over the rows of ``symbiant_items`` the build carries."""
    return (
        select(t.symbiant_items)
        .select_from(
            t.symbiant_items.join(
                t.item_presence,
                (t.item_presence.c.rev_id == t.symbiant_items.c.rev_id)
                & present(build),
            )
        )
        .where(*conditions)
    )


def _symbiant(store_db, build, aoid):
    return store_db.execute(_symbiants(build, t.symbiant_items.c.aoid == aoid)).one()


def _mob_id(store_db, name):
    return store_db.execute(
        select(t.mob.c.mob_id).where(t.mob.c.name == name, ~t.mob.c.retired)
    ).scalar_one()


def _weapons(store_db, build, count):
    """AOIDs of the first ``count`` QL 100 weapons of the build."""
    revision = t.item_revision
    return list(
        store_db.execute(
            revisions(build, revision.c.aoid)
            .where(
                revision.c.atkdef_id.isnot(None),
                revision.c.item_class == 1,
                revision.c.ql == 100,
            )
            .order_by(revision.c.aoid)
            .limit(count)
        ).scalars()
    )


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


def test_symbiant_detail_is_addressed_by_aoid(client, store_db, build):
    symbiant = _symbiant(store_db, build, ITEM_SYMBIANT_ADOBE_ARTILLERY_OCULAR)

    response = client.get(f"/api/v1/symbiants/{symbiant.aoid}")

    assert response.status_code == 200
    data = response.json()
    assert data["aoid"] == symbiant.aoid
    assert data["name"] == symbiant.name
    assert data["actions"], "a symbiant has requirements"
    assert data["spell_data"], "a symbiant has effects"
    _assert_no_nested_row_ids(data)


def test_symbiant_detail_does_not_accept_an_internal_id(client, store_db, build):
    symbiant = _symbiant(store_db, build, ITEM_SYMBIANT_ADOBE_ARTILLERY_OCULAR)
    assert symbiant.rev_id != symbiant.aoid
    id_is_some_symbiants_aoid = store_db.execute(
        _symbiants(build, t.symbiant_items.c.aoid == symbiant.rev_id)
    ).first()

    response = client.get(f"/api/v1/symbiants/{symbiant.rev_id}")

    if id_is_some_symbiants_aoid is None:
        assert response.status_code == 404
    else:
        assert response.json()["aoid"] == symbiant.rev_id


def test_symbiant_dropped_by_is_addressed_by_aoid(client, store_db, build):
    symbiant = _symbiant(store_db, build, ITEM_SYMBIANT_ADOBE_ARTILLERY_OCULAR)
    boss_id = _mob_id(store_db, MOB_ADOBE_SUZERAIN)

    response = client.get(f"/api/v1/symbiants/{symbiant.aoid}/dropped-by")

    assert response.status_code == 200
    assert (boss_id, MOB_ADOBE_SUZERAIN) in [
        (mob["id"], mob["name"]) for mob in response.json()
    ]


def test_symbiant_dropped_by_unknown_aoid_is_404(client):
    response = client.get("/api/v1/symbiants/999999999/dropped-by")

    assert response.status_code == 404


# ============================================================================
# Item content carries no row ids
# ============================================================================


def test_item_detail_has_no_nested_row_ids(client):
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


def test_symbiant_list_and_mob_drops_have_no_nested_row_ids(client, store_db):
    boss_id = _mob_id(store_db, MOB_ADOBE_SUZERAIN)

    listed = client.get("/api/v1/symbiants?page_size=20").json()["items"]
    drops = client.get(f"/api/v1/mobs/{boss_id}/drops").json()

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


def test_implant_lookup_returns_an_implant_without_row_ids(client):
    """The lookup the implant planner uses answers, for clustered and basic implants."""
    for clusters in ({"Shiny": 100, "Bright": 102, "Faded": 150}, {}):
        response = client.post(
            "/api/v1/implants/lookup",
            json={"slot": 1024, "ql": 200, "clusters": clusters},
        )

        assert response.status_code == 200, response.text
        body = response.json()
        assert body["success"] is True
        assert body["item"]["aoid"]
        _assert_no_nested_row_ids(body["item"])


# ============================================================================
# Every route that embeds item content
# ============================================================================

CONTENT_LISTS = (
    "stats",
    "attack_stats",
    "defense_stats",
    "spell_data",
    "spells",
    "criteria",
    "actions",
)


def _row_ids_in_content(value, inside_content=False, path=""):
    """Paths of row ids found on entries of an item's content lists, at any depth."""
    found = []
    if isinstance(value, dict):
        if inside_content:
            found += [f"{path}.{key}" for key in ROW_ID_KEYS & value.keys()]
        for key, child in value.items():
            found += _row_ids_in_content(child, key in CONTENT_LISTS, f"{path}.{key}")
    elif isinstance(value, list):
        for child in value:
            found += _row_ids_in_content(child, inside_content, path)
    return found


def _content_entries(value, wanted):
    """How many entries the named content lists hold, at any depth."""
    if isinstance(value, dict):
        return sum(
            (len(child) if key in wanted and isinstance(child, list) else 0)
            + _content_entries(child, wanted)
            for key, child in value.items()
        )
    if isinstance(value, list):
        return sum(_content_entries(child, wanted) for child in value)
    return 0


WEAPON_REQUEST = {
    "level": 220,
    "breed_id": 1,
    "profession_id": 11,
    "side": 1,
    "expansion_bitflag": 127,
    "top_weapon_skills": [{"skill_id": 112, "value": 2500}],
}


def _content_routes(client, store_db, build):
    weapons = _weapons(store_db, build, 5)
    perks = list(
        store_db.execute(
            revisions(build, t.item_revision.c.aoid)
            .join(t.perk, t.perk.c.aoid == t.item_revision.c.aoid)
            .order_by(t.item_revision.c.aoid)
            .limit(5)
        ).scalars()
    )
    assert weapons and perks
    return {
        "item search": client.get("/api/v1/items/search?q=pistol&page_size=30"),
        "nano list": client.get("/api/v1/nanos?page_size=30"),
        "nano search": client.get("/api/v1/nanos/search?q=heal&page_size=30"),
        "profession nanos": client.get("/api/v1/nanos/profession/10?page_size=30"),
        "offensive nanos": client.get("/api/v1/nanos/offensive/11?page_size=30"),
        "weapon analysis": client.post("/api/v1/weapons/analyze", json=WEAPON_REQUEST),
        "batch interpolation": client.post(
            "/api/v1/items/batch/interpolate",
            json={"items": [{"aoid": aoid, "target_ql": 120} for aoid in weapons]},
        ),
        "perk lookup": client.post("/api/v1/perks/batch/lookup", json={"aoids": perks}),
        "implant lookup": client.post(
            "/api/v1/implants/lookup",
            json={
                "slot": 1024,
                "ql": 200,
                "clusters": {"Shiny": 100, "Bright": 102, "Faded": 150},
            },
        ),
    }


def test_no_route_exposes_row_ids_inside_item_content(client, store_db, build):
    for name, response in _content_routes(client, store_db, build).items():
        assert response.status_code == 200, (name, response.text[:200])
        body = response.json()
        # The response really carries content, so the check below is not vacuous
        assert _content_entries(body, {"actions", "spells", "stats"}) > 0, name
        assert _row_ids_in_content(body) == [], name


def test_the_row_id_check_sees_a_leak():
    leaking = {"items": [{"aoid": 1, "id": 7, "actions": [{"id": 3, "criteria": []}]}]}
    nested = {"item": {"spell_data": [{"spells": [{"criteria": [{"item_id": 9}]}]}]}}

    assert _row_ids_in_content(leaking) == [".items.actions.id"]
    assert _row_ids_in_content(nested) == [".item.spell_data.spells.criteria.item_id"]


def test_weapon_analysis_returns_weapons_the_character_can_use(client):
    response = client.post("/api/v1/weapons/analyze", json=WEAPON_REQUEST)

    assert response.status_code == 200
    weapons = response.json()
    assert len(weapons) > 50
    assert all(weapon["attack_stats"] for weapon in weapons)
    assert len({weapon["aoid"] for weapon in weapons}) == len(weapons)


def test_batch_interpolation_matches_single_interpolation(client, store_db, build):
    aoids = _weapons(store_db, build, 3)
    assert aoids

    batch = client.post(
        "/api/v1/items/batch/interpolate",
        json={"items": [{"aoid": aoid, "target_ql": 120} for aoid in aoids]},
    )

    assert batch.status_code == 200
    results = batch.json()["results"]
    assert [result["item"]["aoid"] for result in results if result.get("item")]
    for aoid, result in zip(aoids, results):
        single = client.get(
            f"/api/v1/items/{aoid}/interpolate", params={"target_ql": 120}
        )
        assert result["item"] == single.json()["item"], aoid
