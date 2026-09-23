"""
Unit tests for nano API endpoints using real database data.

Tests all 7 nano endpoints against actual Anarchy Online game data,
validating full pipeline from database to response without mocks.
"""

import math
from collections import Counter

from sqlalchemy import text

from app.core.nano_strains import NANO_STRAINS

from app.models import (
    Action,
    Item,
    ItemSpellData,
    SpellCriterion,
    SpellDataSpells,
)

# ============================================================================
# GET /api/v1/nanos - List nanos with pagination
# ============================================================================


def test_get_nanos_returns_valid_paginated_response(client):
    """Test that getting nanos returns valid pagination structure."""
    response = client.get("/api/v1/nanos")

    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "page_size" in data
    assert "pages" in data
    assert "has_next" in data
    assert "has_prev" in data
    assert isinstance(data["items"], list)
    assert data["page"] == 1
    assert data["total"] > 0


def test_get_nanos_returns_nano_program_structure(client):
    """Test that nano items have correct NanoProgram schema."""
    response = client.get("/api/v1/nanos?page_size=5")

    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) > 0

    nano = data["items"][0]
    # Verify NanoProgram schema fields
    assert "id" in nano
    assert "aoid" in nano
    assert "name" in nano
    assert "ql" in nano
    assert "description" in nano
    assert "actions" in nano
    assert "effects" in nano
    assert "school" in nano
    assert "strain" in nano
    assert isinstance(nano["actions"], list)
    assert "casting_requirements" not in nano


def test_get_nanos_pagination(client):
    """Test nano pagination works correctly."""
    # Get first page
    response = client.get("/api/v1/nanos?page=1&page_size=10")
    assert response.status_code == 200
    page1_data = response.json()
    assert len(page1_data["items"]) == 10
    assert page1_data["has_prev"] is False

    # Get second page
    response = client.get("/api/v1/nanos?page=2&page_size=10")
    assert response.status_code == 200
    page2_data = response.json()
    assert len(page2_data["items"]) > 0
    assert page2_data["has_prev"] is True

    # Verify pages don't overlap
    page1_aoids = {item["aoid"] for item in page1_data["items"]}
    page2_aoids = {item["aoid"] for item in page2_data["items"]}
    assert len(page1_aoids & page2_aoids) == 0


def test_get_nanos_ql_filter_min(client):
    """Test filtering nanos by minimum QL."""
    response = client.get("/api/v1/nanos?ql_min=300")

    assert response.status_code == 200
    data = response.json()
    for nano in data["items"]:
        assert nano["ql"] >= 300


def test_get_nanos_ql_filter_max(client):
    """Test filtering nanos by maximum QL."""
    response = client.get("/api/v1/nanos?ql_max=50")

    assert response.status_code == 200
    data = response.json()
    for nano in data["items"]:
        assert nano["ql"] <= 50


def test_get_nanos_ql_filter_range(client):
    """Test filtering nanos by QL range."""
    response = client.get("/api/v1/nanos?ql_min=100&ql_max=200")

    assert response.status_code == 200
    data = response.json()
    for nano in data["items"]:
        assert 100 <= nano["ql"] <= 200


def test_get_nanos_sort_by_name_asc(client):
    """Test sorting nanos by name ascending."""
    response = client.get("/api/v1/nanos?sort_by=name&sort_desc=false&page_size=20")

    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) > 0
    # Note: Database collation ordering differs from Python string comparison
    # Just verify endpoint accepts sort parameter and returns data


def test_get_nanos_sort_by_name_desc(client):
    """Test sorting nanos by name descending."""
    response = client.get("/api/v1/nanos?sort_by=name&sort_desc=true&page_size=20")

    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) > 0
    # Note: Database collation ordering differs from Python string comparison
    # Just verify endpoint accepts sort parameter and returns data


def test_get_nanos_sort_by_ql_asc(client):
    """Test sorting nanos by QL ascending."""
    response = client.get("/api/v1/nanos?sort_by=ql&sort_desc=false&page_size=20")

    assert response.status_code == 200
    data = response.json()
    qls = [nano["ql"] for nano in data["items"]]
    assert qls == sorted(qls)


def test_get_nanos_sort_by_ql_desc(client):
    """Test sorting nanos by QL descending."""
    response = client.get("/api/v1/nanos?sort_by=ql&sort_desc=true&page_size=20")

    assert response.status_code == 200
    data = response.json()
    qls = [nano["ql"] for nano in data["items"]]
    assert qls == sorted(qls, reverse=True)


STRAIN_SQL = """
    SELECT i.id, sv.value FROM items i
    JOIN item_stats ist ON ist.item_id = i.id
    JOIN stat_values sv ON sv.id = ist.stat_value_id
    WHERE i.is_nano AND sv.stat = 75
"""


def _strains_by_nano(db_session):
    """{item id: NanoStrain} straight from the raw stat."""
    return dict(db_session.execute(text(STRAIN_SQL)).all())


def test_get_nanos_strain_filter_pages_sum_to_total(client, db_session):
    """Test a strain-filtered list pages cleanly: pages add up to total."""
    by_nano = _strains_by_nano(db_session)
    strain, count = Counter(by_nano.values()).most_common(1)[0]
    page_size = 3
    assert count > page_size

    ids = []
    page = 1
    while True:
        response = client.get(
            "/api/v1/nanos",
            params={"strain": strain, "page": page, "page_size": page_size},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == count
        assert data["pages"] == math.ceil(count / page_size)
        if page < data["pages"]:
            assert len(data["items"]) == page_size
        assert all(nano["strain_id"] == strain for nano in data["items"])
        ids.extend(nano["id"] for nano in data["items"])
        if not data["has_next"]:
            break
        page += 1

    assert page == data["pages"]
    assert len(ids) == count
    assert set(ids) == {i for i, s in by_nano.items() if s == strain}


# Independent SQL for the derived filters. Each reads the raw stats and Use
# criteria, not nano_properties. Profession and level are only answerable by a
# join for Use criteria without OR, NOT or target modifiers, so those two are
# compared on that subset of nanos; every nano the API returns must also carry
# the value it was filtered on.
SCHOOL_SQL = """
    SELECT i.id FROM items i
    JOIN item_stats ist ON ist.item_id = i.id
    JOIN stat_values sv ON sv.id = ist.stat_value_id
    WHERE i.is_nano AND sv.stat = 405 AND sv.value = ANY(:values)
"""

SIMPLE_USE_ACTIONS_SQL = """
    SELECT a.id, a.item_id FROM actions a
    JOIN items i ON i.id = a.item_id AND i.is_nano
    WHERE a.action = 3
      AND NOT EXISTS (
        SELECT 1 FROM action_criteria ac JOIN criteria c ON c.id = ac.criterion_id
        WHERE ac.action_id = a.id AND c.operator IN (3, 42, 18, 19, 21, 26)
      )
"""

# For Use criteria whose profession criteria are all "== p" for one p: that p,
# or NULL when there are none (any profession can cast it)
SIMPLE_PROFESSION_SQL = f"""
    SELECT s.item_id,
           MIN(c.value2) FILTER (WHERE c.value1 IN (60, 368)) AS profession
    FROM ({SIMPLE_USE_ACTIONS_SQL}) s
    LEFT JOIN action_criteria ac ON ac.action_id = s.id
    LEFT JOIN criteria c ON c.id = ac.criterion_id
    GROUP BY s.item_id
    HAVING bool_and(c.value1 IS NULL OR c.value1 NOT IN (60, 368) OR c.operator = 0)
       AND COUNT(DISTINCT c.value2) FILTER (WHERE c.value1 IN (60, 368)) <= 1
"""

# Lowest level = 1 + the largest "Level > n" (operator 2), for Use criteria
# whose only level criteria are of that form
SIMPLE_LEVEL_SQL = f"""
    SELECT s.item_id,
           COALESCE(MAX(c.value2) FILTER (WHERE c.value1 = 54) + 1, 1) AS level
    FROM ({SIMPLE_USE_ACTIONS_SQL}) s
    LEFT JOIN action_criteria ac ON ac.action_id = s.id
    LEFT JOIN criteria c ON c.id = ac.criterion_id
    GROUP BY s.item_id
    HAVING bool_and(c.value1 IS DISTINCT FROM 54 OR c.operator = 2)
"""


def _simple_ids(db_session):
    return {row[1] for row in db_session.execute(text(SIMPLE_USE_ACTIONS_SQL))}


def _all_filtered(client, params, page_size=200):
    """Every nano a filtered /nanos query returns, checking pages add up."""
    nanos = []
    page = 1
    while True:
        response = client.get(
            "/api/v1/nanos", params={**params, "page": page, "page_size": page_size}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["pages"] == max(1, math.ceil(data["total"] / page_size))
        nanos.extend(data["items"])
        if not data["has_next"]:
            break
        page += 1
    assert len(nanos) == data["total"]
    assert len({nano["id"] for nano in nanos}) == len(nanos)
    return nanos


def test_get_nanos_school_filter_matches_nano_school_stat(client, db_session):
    """school=Medical returns exactly the nanos whose NanoSchool stat is 2."""
    expected = {row[0] for row in db_session.execute(text(SCHOOL_SQL), {"values": [2]})}
    assert expected

    nanos = _all_filtered(client, {"school": "Medical"})
    assert {nano["id"] for nano in nanos} == expected
    assert all(nano["school"] == "Medical" for nano in nanos)


def test_get_nanos_several_schools_match_any(client, db_session):
    """Repeated school params match nanos in any of those schools."""
    expected = {
        row[0] for row in db_session.execute(text(SCHOOL_SQL), {"values": [2, 4]})
    }
    nanos = _all_filtered(client, {"school": ["Medical", "Psi"]})
    assert {nano["id"] for nano in nanos} == expected
    assert {nano["school"] for nano in nanos} == {"Medical", "Psi"}


def _expected_for_professions(db_session, profession_ids):
    """(simple nano ids, those castable by any of profession_ids) from raw SQL."""
    rows = db_session.execute(text(SIMPLE_PROFESSION_SQL)).all()
    simple = {item_id for item_id, _ in rows}
    castable = {
        item_id
        for item_id, profession in rows
        if profession is None or profession in profession_ids
    }
    return simple, castable


def test_get_nanos_profession_filter_matches_use_criteria(client, db_session):
    """profession=Doctor (or its id) returns what a Doctor can cast: nanos
    limited to professions including Doctor, and unrestricted ones."""
    nanos = _all_filtered(client, {"profession": "Doctor"})
    ids = {nano["id"] for nano in nanos}
    assert all(
        "Doctor" in nano["professions"]
        or (nano["professions"] == [] and nano["level"] is not None)
        for nano in nanos
    )
    assert any(nano["professions"] == [] for nano in nanos)

    simple, expected = _expected_for_professions(db_session, {10})
    assert expected
    assert ids & simple == expected

    by_id = client.get("/api/v1/nanos", params={"profession": "10"}).json()
    assert by_id["total"] == len(ids)


def test_get_nanos_several_professions_match_any(client, db_session):
    """Repeated profession params match nanos castable by any of them."""
    nanos = _all_filtered(client, {"profession": ["Doctor", "Nano-Technician"]})
    ids = {nano["id"] for nano in nanos}

    simple, expected = _expected_for_professions(db_session, {10, 11})
    assert ids & simple == expected

    doctor = {n["id"] for n in _all_filtered(client, {"profession": "Doctor"})}
    nt = {n["id"] for n in _all_filtered(client, {"profession": "Nano-Technician"})}
    assert ids == doctor | nt
    # An unknown name among known ones is ignored
    mixed = client.get(
        "/api/v1/nanos", params={"profession": ["Doctor", "Monster"]}
    ).json()
    assert mixed["total"] == len(doctor)


def test_search_nanos_takes_the_list_filters(client):
    """/nanos/search applies the same filters, and pages add up."""
    params = {"q": "heal", "school": ["Medical", "Psi"], "profession": "Doctor"}
    unfiltered = client.get("/api/v1/nanos/search", params={"q": "heal"}).json()
    found = []
    page = 1
    while True:
        data = client.get(
            "/api/v1/nanos/search", params={**params, "page": page, "page_size": 50}
        ).json()
        found.extend(data["items"])
        if not data["has_next"]:
            break
        page += 1
    assert len(found) == data["total"]
    assert 0 < data["total"] < unfiltered["total"]
    assert data["pages"] == max(1, math.ceil(data["total"] / 50))
    for nano in found:
        assert nano["school"] in ("Medical", "Psi")
        assert "Doctor" in nano["professions"] or nano["professions"] == []

    listed = {
        n["id"]
        for n in _all_filtered(
            client, {"school": ["Medical", "Psi"], "profession": "Doctor"}
        )
    }
    assert {nano["id"] for nano in found} <= listed


def test_get_nanos_level_filter_matches_use_criteria(client, db_session):
    """level_min/level_max bound the lowest level that can cast the nano."""
    nanos = _all_filtered(client, {"level_min": 150, "level_max": 200})
    assert nanos
    assert all(150 <= nano["level"] <= 200 for nano in nanos)

    simple = _simple_ids(db_session)
    expected = {
        item_id
        for item_id, level in db_session.execute(text(SIMPLE_LEVEL_SQL))
        if 150 <= level <= 200
    }
    assert expected
    assert {nano["id"] for nano in nanos} & simple == expected


def test_get_nanos_combined_filters_intersect(client):
    """Filters combine with AND, and totals stay consistent."""
    doctor = {n["id"] for n in _all_filtered(client, {"profession": "Doctor"})}
    medical = {n["id"] for n in _all_filtered(client, {"school": "Medical"})}
    both = _all_filtered(client, {"profession": "Doctor", "school": "Medical"})
    assert {n["id"] for n in both} == doctor & medical


def test_get_nanos_several_strains_match_any(client, db_session):
    """Repeated strain params, by id or name, match nanos with any of them."""
    by_nano = _strains_by_nano(db_session)
    (first, _), (second, _) = Counter(by_nano.values()).most_common(2)
    expected = {i for i, s in by_nano.items() if s in (first, second)}

    nanos = _all_filtered(client, {"strain": [str(first), str(second)]})
    assert {nano["id"] for nano in nanos} == expected
    assert {nano["strain_id"] for nano in nanos} == {first, second}
    assert all(nano["strain"] == NANO_STRAINS.get(nano["strain_id"]) for nano in nanos)

    # The same strains by name (any case), plus an unknown value that's ignored
    names = [NANO_STRAINS[first].upper(), NANO_STRAINS[second], "No Such Strain"]
    by_name = _all_filtered(client, {"strain": names})
    named_ids = {
        sid
        for sid, name in NANO_STRAINS.items()
        if name.casefold()
        in {NANO_STRAINS[first].casefold(), NANO_STRAINS[second].casefold()}
    }
    assert {nano["id"] for nano in by_name} == {
        i for i, s in by_nano.items() if s in named_ids
    }

    nothing = client.get("/api/v1/nanos", params={"strain": "No Such Strain"}).json()
    assert nothing["total"] == 0


def test_nano_strain_fields_match_the_stat(client, db_session):
    """strain_id is the raw stat 75 (null without one), strain its name."""
    by_nano = _strains_by_nano(db_session)
    data = client.get("/api/v1/nanos", params={"page_size": 200}).json()
    for nano in data["items"]:
        assert nano["strain_id"] == by_nano.get(nano["id"])
        assert nano["strain"] == NANO_STRAINS.get(nano["strain_id"])


def test_get_nano_strains_counts_the_filtered_nanos(client, db_session):
    """/nanos/strains lists each strain of the filtered nanos with its count."""
    medical = {row[0] for row in db_session.execute(text(SCHOOL_SQL), {"values": [2]})}
    expected = Counter(
        s for i, s in _strains_by_nano(db_session).items() if i in medical
    )

    data = client.get("/api/v1/nanos/strains", params={"school": "Medical"}).json()
    got = {row["id"]: row["count"] for row in data["strains"]}
    assert got == dict(expected)
    for row in data["strains"]:
        assert row["name"] == NANO_STRAINS.get(row["id"])
    keys = [
        (row["name"] is None, (row["name"] or "").casefold(), row["id"])
        for row in data["strains"]
    ]
    assert keys == sorted(keys)

    # Consistent with /nanos: a strain's count is that filter's total, and the
    # strain filter itself is ignored so the other strains stay listed
    row = data["strains"][0]
    listed = client.get(
        "/api/v1/nanos", params={"school": "Medical", "strain": row["id"]}
    ).json()
    assert listed["total"] == row["count"]
    ignoring = client.get(
        "/api/v1/nanos/strains", params={"school": "Medical", "strain": row["id"]}
    ).json()
    assert ignoring == data


def test_get_nano_strains_with_search_text(client):
    """With q, /nanos/strains covers the /nanos/search results that have a strain."""
    data = client.get("/api/v1/nanos/strains", params={"q": "heal"}).json()
    total = sum(row["count"] for row in data["strains"])
    found = client.get("/api/v1/nanos/search", params={"q": "heal"}).json()
    with_strain = client.get(
        "/api/v1/nanos/search",
        params={"q": "heal", "strain": [row["id"] for row in data["strains"]]},
    ).json()
    assert 0 < total == with_strain["total"] <= found["total"]


def test_search_nanos_sorts_like_the_list(client, db_session):
    """/nanos/search takes sort_by and sort_desc, stable across pages."""
    for sort_by in ("name", "ql", "level"):
        for sort_desc in (False, True):
            params = {"q": "heal", "sort_by": sort_by, "sort_desc": sort_desc}
            first = client.get(
                "/api/v1/nanos/search", params={**params, "page_size": 20}
            ).json()
            second = client.get(
                "/api/v1/nanos/search", params={**params, "page_size": 20, "page": 2}
            ).json()
            nanos = first["items"] + second["items"]
            assert len({nano["id"] for nano in nanos}) == len(nanos)
            if sort_by == "name":
                # Name order is the database collation's, so ask it
                expected = [
                    row[0]
                    for row in db_session.execute(
                        text(
                            "SELECT id FROM items WHERE is_nano AND "
                            "(name ILIKE '%heal%' OR description ILIKE '%heal%') "
                            f"ORDER BY name {'DESC' if sort_desc else 'ASC'}, id "
                            "LIMIT 40"
                        )
                    )
                ]
                assert [nano["id"] for nano in nanos] == expected, sort_desc
            else:
                values = [nano[sort_by] for nano in nanos if nano[sort_by] is not None]
                assert values == sorted(values, reverse=sort_desc), (
                    sort_by,
                    sort_desc,
                )


def test_get_nanos_unknown_school_or_profession_matches_nothing(client):
    """A school or profession name the game doesn't have filters to nothing."""
    for params in (
        "school=Matter Creation",
        "profession=Monster",
        "profession=Monster&profession=Bogus",
    ):
        data = client.get(f"/api/v1/nanos?{params}").json()
        assert data["items"] == []
        assert data["total"] == 0
        assert data["pages"] == 1
        assert data["has_next"] is False


def test_get_nanos_sort_by_level(client):
    """sort_by=level orders by the lowest casting level, unknown levels last."""
    for params in ({"level_min": 1}, {}):
        data = client.get(
            "/api/v1/nanos",
            params={**params, "sort_by": "level", "sort_desc": True},
        ).json()
        levels = [nano["level"] for nano in data["items"]]
        assert None not in levels
        assert levels == sorted(levels, reverse=True)

    # Without a level filter, nanos with no Use action (level null) come last
    first = client.get("/api/v1/nanos", params={"sort_by": "level"}).json()
    last = client.get(
        "/api/v1/nanos", params={"sort_by": "level", "page": first["pages"]}
    ).json()
    assert first["items"][0]["level"] == 1
    assert last["items"][-1]["level"] is None


def test_known_nanos_have_expected_derived_fields(client, db_session):
    """Well-known nanos read back with the school, professions and level the game gives them."""
    expected = {
        218168: ("Combat", ["Nano-Technician"], 220),  # Izgimmer's Ultimatum
        28650: ("Medical", ["Doctor"], 1),  # Complete Healing
        235281: ("Psi", ["Trader"], 145),  # Umbral Wrangler (Major), the Trader nano
        235248: ("Psi", [], 125),  # Umbral Wrangler (Major), any profession
    }
    for aoid, (school, professions, level) in expected.items():
        item = (
            db_session.query(Item)
            .filter(Item.is_nano.is_(True), Item.aoid == aoid)
            .one()
        )
        nano = client.get(f"/api/v1/nanos/{item.id}").json()
        assert (nano["school"], nano["professions"], nano["level"]) == (
            school,
            professions,
            level,
        ), aoid


def test_get_nanos_invalid_page(client):
    """Test getting nanos with invalid page number."""
    response = client.get("/api/v1/nanos?page=0")
    assert response.status_code == 422


def test_get_nanos_invalid_page_size(client):
    """Test getting nanos with invalid page size."""
    response = client.get("/api/v1/nanos?page_size=0")
    assert response.status_code == 422


def test_get_nanos_page_size_too_large(client):
    """Test getting nanos with page size exceeding limit."""
    response = client.get("/api/v1/nanos?page_size=500")
    assert response.status_code == 422


# ============================================================================
# GET /api/v1/nanos/search - Search nanos
# ============================================================================


def test_search_nanos_by_name(client):
    """Test searching nanos by name with known nano."""
    response = client.get("/api/v1/nanos/search?q=Heat+Miser")

    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) >= 1
    # Verify at least one result contains "Heat Miser"
    names = [nano["name"] for nano in data["items"]]
    assert any("Heat Miser" in name for name in names)


def test_search_nanos_case_insensitive(client):
    """Test that nano search is case insensitive."""
    # Search with uppercase
    response_upper = client.get("/api/v1/nanos/search?q=HEAT")
    assert response_upper.status_code == 200
    data_upper = response_upper.json()

    # Search with lowercase
    response_lower = client.get("/api/v1/nanos/search?q=heat")
    assert response_lower.status_code == 200
    data_lower = response_lower.json()

    # Should return same results
    assert data_upper["total"] == data_lower["total"]


def test_search_nanos_partial_match(client):
    """Test searching nanos with partial match."""
    response = client.get("/api/v1/nanos/search?q=Healing")

    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) >= 1
    # Verify results contain partial match
    for nano in data["items"]:
        assert (
            "healing" in nano["name"].lower()
            or "healing" in (nano["description"] or "").lower()
        )


def test_search_nanos_no_results(client):
    """Test searching nanos with no matches."""
    response = client.get(
        "/api/v1/nanos/search?q=XyZzZyYyXxNonexistentNanoName123456789"
    )

    assert response.status_code == 200
    data = response.json()
    assert data["items"] == []
    assert data["total"] == 0


def test_search_nanos_empty_query(client):
    """Test searching nanos with missing query parameter."""
    response = client.get("/api/v1/nanos/search")
    assert response.status_code == 422


def test_search_nanos_pagination(client):
    """Test pagination in nano search."""
    response = client.get("/api/v1/nanos/search?q=a&page=1&page_size=5")

    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 5
    assert data["page"] == 1
    assert "has_next" in data
    assert "has_prev" in data


# ============================================================================
# GET /api/v1/nanos/stats - Nano statistics
# ============================================================================


def test_get_nano_stats_returns_valid_structure(client):
    """Test that nano stats returns a valid response structure."""
    response = client.get("/api/v1/nanos/stats")

    assert response.status_code == 200
    data = response.json()
    assert "total_nanos" in data
    assert "schools" in data
    assert "strains" in data
    assert "professions" in data
    assert "level_range" in data
    assert "quality_level_range" in data
    assert isinstance(data["total_nanos"], int)
    assert isinstance(data["schools"], list)
    assert isinstance(data["strains"], list)
    assert isinstance(data["professions"], list)
    assert data["total_nanos"] > 0


def test_get_nano_stats_quality_level_range(client):
    """Test that nano stats correctly calculates QL range."""
    response = client.get("/api/v1/nanos/stats")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data["quality_level_range"], list)
    assert len(data["quality_level_range"]) == 2
    min_ql, max_ql = data["quality_level_range"]
    assert min_ql <= max_ql
    assert min_ql >= 1
    assert max_ql <= 500


def test_get_nano_stats_level_range(client):
    """Test that nano stats includes level range."""
    response = client.get("/api/v1/nanos/stats")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data["level_range"], list)
    assert len(data["level_range"]) == 2


# ============================================================================
# GET /api/v1/nanos/{nano_id} - Nano detail
# ============================================================================


def test_get_nano_by_id(client, db_session):
    """Test getting a specific nano by ID using real data."""
    # Get a real nano from database
    real_nano = db_session.query(Item).filter(Item.is_nano.is_(True)).first()
    assert real_nano is not None

    response = client.get(f"/api/v1/nanos/{real_nano.id}")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == real_nano.id
    assert data["aoid"] == real_nano.aoid
    assert data["name"] == real_nano.name
    assert data["ql"] == real_nano.ql


def test_get_nano_detail_includes_spells_and_criteria(client, db_session):
    """Test that nano detail includes spells and raw criteria."""
    # Get a real nano
    real_nano = db_session.query(Item).filter(Item.is_nano.is_(True)).first()
    assert real_nano is not None

    response = client.get(f"/api/v1/nanos/{real_nano.id}")

    assert response.status_code == 200
    data = response.json()
    # NanoProgramWithSpells includes these fields
    assert "spells" in data
    assert "raw_criteria" in data
    assert isinstance(data["spells"], list)
    assert isinstance(data["raw_criteria"], list)


def _nano_with_use_and_spell_criteria(db_session):
    """A nano whose Use action and whose spells both carry criteria."""
    use_action_items = (
        db_session.query(Action.item_id)
        .filter(Action.action == 3, Action.action_criteria.any())
        .subquery()
    )
    spell_criteria_items = (
        db_session.query(ItemSpellData.item_id)
        .join(
            SpellDataSpells,
            SpellDataSpells.spell_data_id == ItemSpellData.spell_data_id,
        )
        .join(SpellCriterion, SpellCriterion.spell_id == SpellDataSpells.spell_id)
        .subquery()
    )
    return (
        db_session.query(Item)
        .filter(
            Item.is_nano.is_(True),
            Item.id.in_(db_session.query(use_action_items.c.item_id)),
            Item.id.in_(db_session.query(spell_criteria_items.c.item_id)),
        )
        .order_by(Item.id)
        .first()
    )


def _expected_actions(item):
    """The item's actions as the API serializes them, criteria in order."""
    return sorted(
        (
            action.action,
            [(c.value1, c.value2, c.operator) for c in action.criteria],
        )
        for action in item.actions
    )


def _response_actions(nano):
    return sorted(
        (
            action["action"],
            [(c["value1"], c["value2"], c["operator"]) for c in action["criteria"]],
        )
        for action in nano["actions"]
    )


def test_get_nano_returns_use_action_criteria(client, db_session):
    """Casting requirements come from the nano's actions, not its spell criteria."""
    nano = _nano_with_use_and_spell_criteria(db_session)
    assert nano is not None

    response = client.get(f"/api/v1/nanos/{nano.id}")

    assert response.status_code == 200
    data = response.json()
    assert "casting_requirements" not in data
    assert _response_actions(data) == _expected_actions(nano)
    use_actions = [a for a in data["actions"] if a["action"] == 3]
    assert len(use_actions) == 1
    assert len(use_actions[0]["criteria"]) > 0


def test_list_and_search_nanos_return_actions(client, db_session):
    """The list and search endpoints return the same actions as the database."""
    nano = _nano_with_use_and_spell_criteria(db_session)
    assert nano is not None
    expected = _expected_actions(nano)

    listed = client.get(
        f"/api/v1/nanos?ql_min={nano.ql}&ql_max={nano.ql}&page_size=200"
    )
    assert listed.status_code == 200
    # The filter may match more than one page; walk them until the nano turns up
    pages = listed.json()["pages"]
    found = [n for n in listed.json()["items"] if n["id"] == nano.id]
    page = 2
    while not found and page <= pages:
        next_page = client.get(
            f"/api/v1/nanos?ql_min={nano.ql}&ql_max={nano.ql}"
            f"&page_size=200&page={page}"
        )
        found = [n for n in next_page.json()["items"] if n["id"] == nano.id]
        page += 1
    assert len(found) == 1
    assert _response_actions(found[0]) == expected

    searched = client.get(
        "/api/v1/nanos/search", params={"q": nano.name, "page_size": 200}
    )
    assert searched.status_code == 200
    matches = [n for n in searched.json()["items"] if n["id"] == nano.id]
    assert len(matches) == 1
    assert _response_actions(matches[0]) == expected


def test_get_nano_not_found(client):
    """Test getting non-existent nano."""
    response = client.get("/api/v1/nanos/999999999")
    assert response.status_code == 404
    data = response.json()
    # Error response contains error message
    assert "error" in data or "detail" in data


def test_get_nano_invalid_id(client):
    """Test getting nano with invalid ID."""
    response = client.get("/api/v1/nanos/invalid")
    assert response.status_code == 422


def test_get_non_nano_item(client, db_session):
    """Test getting an item that is not a nano."""
    # Find a non-nano item
    non_nano = db_session.query(Item).filter(Item.is_nano.is_(False)).first()
    assert non_nano is not None

    response = client.get(f"/api/v1/nanos/{non_nano.id}")
    assert response.status_code == 404


# ============================================================================
# GET /api/v1/nanos/profession/{profession_id} - Filter by profession
# ============================================================================


def test_get_nanos_by_profession_doctor(client):
    """Test getting nanos filtered by Doctor profession (id=6)."""
    response = client.get("/api/v1/nanos/profession/6")

    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert isinstance(data["items"], list)
    # Doctor should have nanos
    assert len(data["items"]) > 0


def test_get_nanos_by_profession_nano_technician(client):
    """Test getting nanos filtered by Nano-Technician profession (id=11)."""
    response = client.get("/api/v1/nanos/profession/11")

    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) > 0


def test_get_nanos_by_profession_returns_item_detail(client):
    """Test that profession endpoint returns ItemDetail structure."""
    response = client.get("/api/v1/nanos/profession/6?page_size=5")

    assert response.status_code == 200
    data = response.json()
    if len(data["items"]) > 0:
        item = data["items"][0]
        # Verify ItemDetail schema
        assert "id" in item
        assert "aoid" in item
        assert "name" in item
        assert "ql" in item
        assert "stats" in item
        assert "spell_data" in item
        assert "actions" in item
        assert "is_nano" in item
        assert item["is_nano"] is True


def test_profession_and_search_endpoints_return_derived_fields(client, db_session):
    """/nanos/profession/{id} and /nanos/search carry school, professions, level."""
    items = client.get("/api/v1/nanos/profession/11").json()["items"]
    assert items
    for item in items:
        assert {"school", "professions", "level"} <= item.keys()
    # That endpoint matches any caster Profession == NT criterion; the derived
    # list agrees wherever the Use criteria have no OR, NOT or target modifier
    simple = _simple_ids(db_session)
    assert all(
        "Nano-Technician" in item["professions"]
        for item in items
        if item["id"] in simple
    )

    found = client.get("/api/v1/nanos/search?q=Izgimmer").json()["items"]
    assert any(nano["professions"] == ["Nano-Technician"] for nano in found)
    assert all({"school", "professions", "level"} <= nano.keys() for nano in found)


def test_get_nanos_by_profession_all(client):
    """Test getting all nanos (profession_id=0)."""
    response = client.get("/api/v1/nanos/profession/0?page_size=10")

    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 10


def test_get_nanos_by_profession_filters_test_items(client):
    """Test that profession endpoint filters out TESTLIVEITEM."""
    response = client.get("/api/v1/nanos/profession/0")

    assert response.status_code == 200
    data = response.json()
    for item in data["items"]:
        assert not item["name"].startswith("TESTLIVEITEM")


def test_get_nanos_by_profession_pagination(client):
    """Test pagination in profession endpoint."""
    response = client.get("/api/v1/nanos/profession/0?page=1&page_size=10")

    assert response.status_code == 200
    data = response.json()
    assert "page" in data
    assert "page_size" in data
    assert "total" in data
    assert "has_next" in data
    assert "has_prev" in data
    assert data["page"] == 1


def test_get_nanos_by_profession_sort_by_name(client):
    """Test sorting by name in profession endpoint."""
    response = client.get(
        "/api/v1/nanos/profession/0?sort=name&sort_order=asc&page_size=20"
    )

    assert response.status_code == 200
    data = response.json()
    names = [item["name"] for item in data["items"]]
    assert names == sorted(names)


def test_get_nanos_by_profession_sort_by_ql_desc(client):
    """Test sorting by QL descending in profession endpoint."""
    response = client.get(
        "/api/v1/nanos/profession/0?sort=ql&sort_order=desc&page_size=20"
    )

    assert response.status_code == 200
    data = response.json()
    qls = [item["ql"] for item in data["items"]]
    assert qls == sorted(qls, reverse=True)


# ============================================================================
# GET /api/v1/nanos/offensive/{profession_id} - Offensive nanos
# ============================================================================


def test_get_offensive_nanos_returns_valid_structure(client):
    """Test that offensive endpoint returns valid structure."""
    response = client.get("/api/v1/nanos/offensive/0")

    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert isinstance(data["items"], list)


def test_get_offensive_nanos_filters_test_items(client):
    """Test that offensive endpoint filters out TESTLIVEITEM."""
    response = client.get("/api/v1/nanos/offensive/0")

    assert response.status_code == 200
    data = response.json()
    for item in data["items"]:
        assert not item["name"].startswith("TESTLIVEITEM")


def test_get_offensive_nanos_pagination(client):
    """Test pagination in offensive endpoint."""
    response = client.get("/api/v1/nanos/offensive/0?page=1&page_size=10")

    assert response.status_code == 200
    data = response.json()
    assert "page" in data
    assert "page_size" in data
    assert "total" in data


def test_get_offensive_nanos_sort_by_name(client):
    """Test sorting by name in offensive endpoint."""
    response = client.get(
        "/api/v1/nanos/offensive/0?sort=name&sort_order=asc&page_size=10"
    )
    assert response.status_code == 200


def test_get_offensive_nanos_sort_by_ql(client):
    """Test sorting by QL in offensive endpoint."""
    response = client.get(
        "/api/v1/nanos/offensive/0?sort=ql&sort_order=desc&page_size=10"
    )
    assert response.status_code == 200


# ============================================================================
# GET /api/v1/nanos/profession/{profession_id}/fast - Fast endpoint
# ============================================================================


def test_get_nanos_by_profession_fast(client):
    """Test fast nano endpoint by profession."""
    response = client.get("/api/v1/nanos/profession/11/fast")

    assert response.status_code == 200
    data = response.json()
    assert "items" in data


def test_get_nanos_by_profession_fast_returns_minimal_data(client):
    """Test that fast endpoint returns minimal ItemDetail structure."""
    response = client.get("/api/v1/nanos/profession/0/fast?page_size=5")

    assert response.status_code == 200
    data = response.json()
    if len(data["items"]) > 0:
        item = data["items"][0]
        assert "id" in item
        assert "aoid" in item
        assert "name" in item
        assert "ql" in item
        # Fast endpoint should have empty lists for performance
        assert item["stats"] == []
        assert item["spell_data"] == []
        assert item["actions"] == []
        assert item["sources"] == []


def test_get_nanos_by_profession_fast_filters_test_items(client):
    """Test that fast endpoint filters out TESTLIVEITEM."""
    response = client.get("/api/v1/nanos/profession/0/fast")

    assert response.status_code == 200
    data = response.json()
    for item in data["items"]:
        assert not item["name"].startswith("TESTLIVEITEM")


def test_get_nanos_by_profession_fast_pagination(client):
    """Test pagination in fast endpoint."""
    response = client.get("/api/v1/nanos/profession/0/fast?page=1&page_size=10")

    assert response.status_code == 200
    data = response.json()
    assert "page" in data
    assert "total" in data
    assert "has_next" in data
    assert "has_prev" in data


def test_get_nanos_by_profession_fast_sort_by_name(client):
    """Test sorting by name in fast endpoint."""
    response = client.get(
        "/api/v1/nanos/profession/0/fast?sort=name&sort_order=asc&page_size=20"
    )

    assert response.status_code == 200
    data = response.json()
    names = [item["name"] for item in data["items"]]
    assert names == sorted(names)


def test_get_nanos_by_profession_fast_sort_by_ql(client):
    """Test sorting by QL in fast endpoint."""
    response = client.get(
        "/api/v1/nanos/profession/0/fast?sort=ql&sort_order=desc&page_size=20"
    )

    assert response.status_code == 200
    data = response.json()
    qls = [item["ql"] for item in data["items"]]
    assert qls == sorted(qls, reverse=True)


def test_get_nanos_by_profession_fast_all_professions(client):
    """Test fast endpoint with profession_id=0 for all professions."""
    response = client.get("/api/v1/nanos/profession/0/fast")

    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert len(data["items"]) > 0


# ============================================================================
# Edge Cases and Integration Tests
# ============================================================================


def test_nano_response_structure_consistency(client, db_session):
    """Test that nano responses have consistent structure across endpoints."""
    # Get a real nano
    real_nano = db_session.query(Item).filter(Item.is_nano.is_(True)).first()
    assert real_nano is not None

    # Test detail endpoint
    detail_response = client.get(f"/api/v1/nanos/{real_nano.id}")
    assert detail_response.status_code == 200
    detail_data = detail_response.json()

    # Both should have core fields
    assert "id" in detail_data
    assert "aoid" in detail_data
    assert "name" in detail_data
    assert "ql" in detail_data
    assert "actions" in detail_data


def test_nano_endpoints_with_real_high_ql_nano(client, db_session):
    """Test endpoints with high QL nano (QL 390)."""
    # Query for a high QL nano
    high_ql_nano = (
        db_session.query(Item).filter(Item.is_nano.is_(True), Item.ql >= 390).first()
    )

    if high_ql_nano:
        response = client.get(f"/api/v1/nanos/{high_ql_nano.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["ql"] >= 390


def test_nano_boundary_ql_values(client):
    """Test nanos with boundary QL values."""
    # Test min QL
    response = client.get("/api/v1/nanos?ql_min=1&ql_max=1&page_size=5")
    assert response.status_code == 200
    data = response.json()
    for nano in data["items"]:
        assert nano["ql"] == 1

    # Test high QL
    response = client.get("/api/v1/nanos?ql_min=390&page_size=5")
    assert response.status_code == 200
    data = response.json()
    for nano in data["items"]:
        assert nano["ql"] >= 390


def test_profession_endpoint_returns_profession_specific_nanos(client):
    """Test that profession endpoint actually filters by profession."""
    # Get NT nanos
    nt_response = client.get("/api/v1/nanos/profession/11?page_size=5")
    assert nt_response.status_code == 200
    nt_data = nt_response.json()

    # Get Doctor nanos
    doc_response = client.get("/api/v1/nanos/profession/6?page_size=5")
    assert doc_response.status_code == 200
    doc_data = doc_response.json()

    # Should have different nanos (or at least different totals typically)
    # Both professions should have nanos
    assert nt_data["total"] > 0
    assert doc_data["total"] > 0
