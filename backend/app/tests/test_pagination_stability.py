"""
Page-walk tests for paginated endpoints.

Each test requests every page of a small real result set and checks that the
pages partition it: no row appears twice and none goes missing. That only
holds when the endpoint sorts on a unique key, so these tests pin the id
tiebreakers added to each endpoint's ORDER BY (or Python sort key).
Symbiant pages are walked in test_search_functionality's family test.
"""

from app.models import Item, Mob, Spell, StatValue


def _walk(client, url, page_size):
    """Fetch every page of a paginated endpoint; return (ids, reported total)."""
    separator = "&" if "?" in url else "?"
    ids = []
    page = 1
    while True:
        response = client.get(f"{url}{separator}page={page}&page_size={page_size}")
        assert response.status_code == 200
        data = response.json()
        ids.extend(row["id"] for row in data["items"])
        if page >= data["pages"]:
            return ids, data["total"]
        page += 1


def _assert_partition(ids, expected_ids):
    assert len(ids) == len(set(ids)), "a row appeared on more than one page"
    assert set(ids) == set(expected_ids)


def test_mobs_pages_partition(client, db_session):
    """Mobs sort by level then name; many mobs share a level."""
    expected = [mob_id for (mob_id,) in db_session.query(Mob.id)]

    ids, total = _walk(client, "/api/v1/mobs", page_size=25)

    assert total == len(expected)
    _assert_partition(ids, expected)


def test_spells_list_pages_partition(client, db_session):
    """The spell list had no ORDER BY at all."""
    target = 14  # a few hundred spells: several pages, still cheap
    expected = [
        spell_id
        for (spell_id,) in db_session.query(Spell.id).filter(Spell.target == target)
    ]
    assert len(expected) > 200

    ids, total = _walk(client, f"/api/v1/spells?target={target}", page_size=200)

    assert total == len(expected)
    _assert_partition(ids, expected)


def test_spell_search_pages_partition(client, db_session):
    """Spell search sorts by spell_id, the spell type, which repeats heavily."""
    term = "Teleport"
    expected = [
        spell_id
        for (spell_id,) in db_session.query(Spell.id).filter(
            Spell.spell_format.ilike(f"%{term}%")
        )
    ]
    assert len(expected) > 200

    ids, total = _walk(client, f"/api/v1/spells/search?q={term}", page_size=200)

    assert total == len(expected)
    _assert_partition(ids, expected)


def test_nanos_list_pages_partition(client, db_session):
    """Nanos sort by name by default; nano names repeat across QLs."""
    ql = 100
    expected = [
        item_id
        for (item_id,) in db_session.query(Item.id).filter(
            Item.is_nano.is_(True), Item.ql == ql
        )
    ]
    assert len(expected) > 20

    # The list reports its post-filter page size as total, so only the page
    # partition is checked here
    ids, _total = _walk(client, f"/api/v1/nanos?ql_min={ql}&ql_max={ql}", page_size=20)

    _assert_partition(ids, expected)


def test_nano_search_pages_partition(client, db_session):
    """Nano search had no ORDER BY at all."""
    term = "Mongo"
    expected = [
        item_id
        for (item_id,) in db_session.query(Item.id).filter(
            Item.is_nano.is_(True),
            Item.name.ilike(f"%{term}%") | Item.description.ilike(f"%{term}%"),
        )
    ]
    assert len(expected) > 7

    ids, total = _walk(client, f"/api/v1/nanos/search?q={term}", page_size=7)

    assert total == len(expected)
    _assert_partition(ids, expected)


def test_perks_pages_partition(client):
    """Perks are sorted in Python; many AI perks share a level."""
    ids, total = _walk(client, "/api/v1/perks?type=AI&sort_by=level", page_size=50)

    assert total > 50
    assert len(ids) == total
    assert len(set(ids)) == total, "a perk appeared on more than one page"


def test_stat_values_pages_partition(client, db_session):
    """stat-values pages with skip/limit and had no ORDER BY."""
    limit = 100
    expected = [
        stat_value_id
        for (stat_value_id,) in db_session.query(StatValue.id)
        .order_by(StatValue.id)
        .limit(3 * limit)
    ]

    ids = []
    for skip in range(0, 3 * limit, limit):
        response = client.get(f"/api/v1/stat-values?skip={skip}&limit={limit}")
        assert response.status_code == 200
        ids.extend(row["id"] for row in response.json())

    assert ids == expected
