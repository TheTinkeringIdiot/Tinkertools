"""
Page-walk tests for paginated endpoints.

Each test requests every page of a small real result set and checks that the
pages partition it: no row appears twice and none goes missing. That only
holds when the endpoint sorts on a unique key. That key is the AOID (the mob
id for mobs), never an internal row id, so the order of a list does not depend
on how the data is stored; the last tests pin that.
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


def _rows(client, url):
    response = client.get(url)
    assert response.status_code == 200
    return response.json()["items"]


def _assert_ties_ascend_on_aoid(rows, key):
    ties = 0
    for previous, current in zip(rows, rows[1:]):
        if previous[key] == current[key]:
            ties += 1
            assert previous["aoid"] < current["aoid"], (previous, current)
    assert ties > 0, "the result has no ties, so it proves nothing"


def test_items_are_listed_in_aoid_order(client):
    rows = _rows(client, "/api/v1/items?min_ql=200&max_ql=200&page_size=200")

    aoids = [row["aoid"] for row in rows]
    assert len(aoids) > 50
    assert aoids == sorted(aoids)


def test_items_with_the_same_name_are_ordered_by_aoid(client):
    rows = _rows(client, "/api/v1/items/search?q=implant&page_size=300")

    _assert_ties_ascend_on_aoid(rows, "name")


def test_fuzzy_search_ties_are_ordered_by_aoid(client):
    """Full-text rank ties are common: every row here matches the one word once."""
    rows = _rows(
        client,
        "/api/v1/items/search?q=sword&exact_match=false&search_fields=name&page_size=300",
    )
    same_name = [(a, b) for a, b in zip(rows, rows[1:]) if a["name"] == b["name"]]

    assert len(same_name) > 0
    assert all(a["aoid"] < b["aoid"] for a, b in same_name)


def test_nanos_with_the_same_ql_are_ordered_by_aoid(client):
    rows = _rows(client, "/api/v1/nanos?sort_by=ql&ql_min=100&ql_max=101&page_size=200")

    _assert_ties_ascend_on_aoid(rows, "ql")


def test_profession_nanos_with_the_same_ql_are_ordered_by_aoid(client):
    rows = _rows(client, "/api/v1/nanos/profession/10?page_size=300")

    _assert_ties_ascend_on_aoid(rows, "ql")


def test_symbiants_with_the_same_family_ql_and_name_position_are_ordered_by_aoid(
    client,
):
    rows = _rows(client, "/api/v1/symbiants?page_size=200")

    keys = [(row["family"], row["ql"], row["name"], row["aoid"]) for row in rows]
    assert len(keys) > 50
    assert keys == sorted(keys)
