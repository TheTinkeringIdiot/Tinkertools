"""
Page-walk tests for paginated endpoints.

Each test requests every page of a small real result set and checks that the
pages partition it: no row appears twice and none goes missing. That only
holds when the endpoint sorts on a unique key, so these tests pin the id
tiebreakers added to each endpoint's ORDER BY.
Symbiant pages are walked in test_search_functionality's family test.
"""

from app.models import Item, Mob


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

    ids, total = _walk(client, f"/api/v1/nanos?ql_min={ql}&ql_max={ql}", page_size=20)

    assert total == len(expected)
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
