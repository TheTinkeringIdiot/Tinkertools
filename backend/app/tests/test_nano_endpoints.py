"""
Unit tests for nano API endpoints using real database data.

Tests all 7 nano endpoints against actual Anarchy Online game data,
validating full pipeline from database to response without mocks. Expected
values come from the store the endpoints read: the nanos' raw stats and the
criteria of their Use actions, not the derived ``nano_properties`` columns the
filters use.
"""

import math
from collections import Counter

from sqlalchemy import or_, select

from app.core.nano_strains import NANO_STRAINS
from app.store import tables as t
from app.store.items import load_records
from app.store.presence import has_stat, nano_policy, revisions

USE_ACTION = 3
STAT_LEVEL = 54
STAT_NANO_SCHOOL = 405
PROFESSION_STATS = (60, 368)
OPERATOR_EQUAL, OPERATOR_GREATER = 0, 2
# OR, NOT and the modifiers that turn a criterion to something else than the
# caster: a Use action with one of them is not answerable criterion by criterion
COMPOUND_OPERATORS = {3, 42, 18, 19, 21, 26}

_nano_records = {}


def _nanos(store_db, build):
    """Every nano of the build as the store serves it, read once per run."""
    if build.slug not in _nano_records:
        rev_ids = store_db.execute(
            revisions(build).where(t.item_revision.c.is_nano)
        ).scalars()
        _nano_records[build.slug] = load_records(store_db, build, rev_ids=list(rev_ids))
    return _nano_records[build.slug]


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


def _strains_by_nano(store_db, build):
    """{AOID: NanoStrain} of the build's nanos that have one: the effective
    strain of the build's strain policy, as the store derives it."""
    properties = t.nano_properties
    return dict(
        store_db.execute(
            revisions(build, t.item_revision.c.aoid, properties.c.strain)
            .join(properties, nano_policy(build))
            .where(t.item_revision.c.is_nano, properties.c.strain.isnot(None))
        ).all()
    )


def test_get_nanos_strain_filter_pages_sum_to_total(client, store_db, build):
    """Test a strain-filtered list pages cleanly: pages add up to total."""
    by_nano = _strains_by_nano(store_db, build)
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
        ids.extend(nano["aoid"] for nano in data["items"])
        if not data["has_next"]:
            break
        page += 1

    assert page == data["pages"]
    assert len(ids) == count
    assert set(ids) == {i for i, s in by_nano.items() if s == strain}


# Independent answers for the derived filters. Each reads the raw stats and
# Use criteria, not nano_properties. Profession and level are only answerable
# criterion by criterion for Use criteria without OR, NOT or target modifiers,
# so those two are compared on that subset of nanos; every nano the API returns
# must also carry the value it was filtered on.
def _in_schools(store_db, build, schools):
    """AOIDs of the nanos whose NanoSchool stat is one of ``schools``."""
    return set(
        store_db.execute(
            revisions(build, t.item_revision.c.aoid).where(
                t.item_revision.c.is_nano,
                has_stat(
                    t.stat_entry.c.stat == STAT_NANO_SCHOOL,
                    t.stat_entry.c.value.in_(schools),
                ),
            )
        ).scalars()
    )


def _simple_use_criteria(store_db, build):
    """{AOID: criteria of the Use action} of the nanos whose Use action has
    no OR, NOT or target modifier."""
    simple = {}
    for record in _nanos(store_db, build):
        for action in record.actions:
            operators = {operator for _, _, operator in action["criteria"]}
            if action["action"] == USE_ACTION and not operators & COMPOUND_OPERATORS:
                simple[record.aoid] = action["criteria"]
    return simple


def _simple_ids(store_db, build):
    return set(_simple_use_criteria(store_db, build))


def _simple_professions(store_db, build):
    """{AOID: profession} for Use criteria whose profession criteria are all
    "== p" for one p: that p, or None when there are none (any profession can
    cast it)."""
    professions = {}
    for aoid, criteria in _simple_use_criteria(store_db, build).items():
        named = [c for c in criteria if c[0] in PROFESSION_STATS]
        values = {value for _, value, _ in named}
        if all(c[2] == OPERATOR_EQUAL for c in named) and len(values) <= 1:
            professions[aoid] = min(values, default=None)
    return professions


def _simple_levels(store_db, build):
    """{AOID: lowest level} = 1 + the largest "Level > n", for Use criteria
    whose only level criteria are of that form."""
    levels = {}
    for aoid, criteria in _simple_use_criteria(store_db, build).items():
        on_level = [c for c in criteria if c[0] == STAT_LEVEL]
        if all(c[2] == OPERATOR_GREATER for c in on_level):
            levels[aoid] = max((value + 1 for _, value, _ in on_level), default=1)
    return levels


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
    assert len({nano["aoid"] for nano in nanos}) == len(nanos)
    return nanos


def test_get_nanos_school_filter_matches_nano_school_stat(client, store_db, build):
    """school=Medical returns exactly the nanos whose NanoSchool stat is 2."""
    expected = _in_schools(store_db, build, [2])
    assert expected

    nanos = _all_filtered(client, {"school": "Medical"})
    assert {nano["aoid"] for nano in nanos} == expected
    assert all(nano["school"] == "Medical" for nano in nanos)


def test_get_nanos_several_schools_match_any(client, store_db, build):
    """Repeated school params match nanos in any of those schools."""
    expected = _in_schools(store_db, build, [2, 4])
    nanos = _all_filtered(client, {"school": ["Medical", "Psi"]})
    assert {nano["aoid"] for nano in nanos} == expected
    assert {nano["school"] for nano in nanos} == {"Medical", "Psi"}


def _expected_for_professions(store_db, build, profession_ids):
    """(simple nano ids, those castable by any of profession_ids)."""
    professions = _simple_professions(store_db, build)
    castable = {
        aoid
        for aoid, profession in professions.items()
        if profession is None or profession in profession_ids
    }
    return set(professions), castable


def test_get_nanos_profession_filter_matches_use_criteria(client, store_db, build):
    """profession=Doctor (or its id) returns what a Doctor can cast: nanos
    limited to professions including Doctor, and unrestricted ones."""
    nanos = _all_filtered(client, {"profession": "Doctor"})
    ids = {nano["aoid"] for nano in nanos}
    assert all(
        "Doctor" in nano["professions"]
        or (nano["professions"] == [] and nano["level"] is not None)
        for nano in nanos
    )
    assert any(nano["professions"] == [] for nano in nanos)

    simple, expected = _expected_for_professions(store_db, build, {10})
    assert expected
    assert ids & simple == expected

    by_id = client.get("/api/v1/nanos", params={"profession": "10"}).json()
    assert by_id["total"] == len(ids)


def test_get_nanos_several_professions_match_any(client, store_db, build):
    """Repeated profession params match nanos castable by any of them."""
    nanos = _all_filtered(client, {"profession": ["Doctor", "Nano-Technician"]})
    ids = {nano["aoid"] for nano in nanos}

    simple, expected = _expected_for_professions(store_db, build, {10, 11})
    assert ids & simple == expected

    doctor = {n["aoid"] for n in _all_filtered(client, {"profession": "Doctor"})}
    nt = {n["aoid"] for n in _all_filtered(client, {"profession": "Nano-Technician"})}
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
        n["aoid"]
        for n in _all_filtered(
            client, {"school": ["Medical", "Psi"], "profession": "Doctor"}
        )
    }
    assert {nano["aoid"] for nano in found} <= listed


def test_get_nanos_level_filter_matches_use_criteria(client, store_db, build):
    """level_min/level_max bound the lowest level that can cast the nano."""
    nanos = _all_filtered(client, {"level_min": 150, "level_max": 200})
    assert nanos
    assert all(150 <= nano["level"] <= 200 for nano in nanos)

    simple = _simple_ids(store_db, build)
    expected = {
        aoid
        for aoid, level in _simple_levels(store_db, build).items()
        if 150 <= level <= 200
    }
    assert expected
    assert {nano["aoid"] for nano in nanos} & simple == expected


def test_get_nanos_combined_filters_intersect(client):
    """Filters combine with AND, and totals stay consistent."""
    doctor = {n["aoid"] for n in _all_filtered(client, {"profession": "Doctor"})}
    medical = {n["aoid"] for n in _all_filtered(client, {"school": "Medical"})}
    both = _all_filtered(client, {"profession": "Doctor", "school": "Medical"})
    assert {n["aoid"] for n in both} == doctor & medical


def test_get_nanos_several_strains_match_any(client, store_db, build):
    """Repeated strain params, by id or name, match nanos with any of them."""
    by_nano = _strains_by_nano(store_db, build)
    (first, _), (second, _) = Counter(by_nano.values()).most_common(2)
    expected = {i for i, s in by_nano.items() if s in (first, second)}

    nanos = _all_filtered(client, {"strain": [str(first), str(second)]})
    assert {nano["aoid"] for nano in nanos} == expected
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
    assert {nano["aoid"] for nano in by_name} == {
        i for i, s in by_nano.items() if s in named_ids
    }

    nothing = client.get("/api/v1/nanos", params={"strain": "No Such Strain"}).json()
    assert nothing["total"] == 0


def test_nano_strain_fields_match_the_stat(client, store_db, build):
    """strain_id is the raw stat 75 (null without one), strain its name."""
    by_nano = _strains_by_nano(store_db, build)
    data = client.get("/api/v1/nanos", params={"page_size": 200}).json()
    for nano in data["items"]:
        assert nano["strain_id"] == by_nano.get(nano["aoid"])
        assert nano["strain"] == NANO_STRAINS.get(nano["strain_id"])


def test_get_nano_strains_counts_the_filtered_nanos(client, store_db, build):
    """/nanos/strains lists each strain of the filtered nanos with its count."""
    medical = _in_schools(store_db, build, [2])
    expected = Counter(
        s for i, s in _strains_by_nano(store_db, build).items() if i in medical
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


def test_search_nanos_sorts_like_the_list(client, store_db, build):
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
            assert len({nano["aoid"] for nano in nanos}) == len(nanos)
            if sort_by == "name":
                # Name order is the database collation's, so ask it
                name = t.part_text.c.name
                expected = list(
                    store_db.execute(
                        revisions(build, t.item_revision.c.aoid)
                        .join(
                            t.part_text,
                            t.part_text.c.text_id == t.item_revision.c.text_id,
                        )
                        .where(
                            t.item_revision.c.is_nano,
                            or_(
                                name.ilike("%heal%"),
                                t.part_text.c.description.ilike("%heal%"),
                            ),
                        )
                        .order_by(
                            name.desc() if sort_desc else name.asc(),
                            t.item_revision.c.aoid,
                        )
                        .limit(40)
                    ).scalars()
                )
                assert [nano["aoid"] for nano in nanos] == expected, sort_desc
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


def test_known_nanos_have_expected_derived_fields(client, store_db, build):
    """Well-known nanos read back with the school, professions and level the game gives them."""
    expected = {
        218168: ("Combat", ["Nano-Technician"], 220),  # Izgimmer's Ultimatum
        28650: ("Medical", ["Doctor"], 1),  # Complete Healing
        235281: ("Psi", ["Trader"], 145),  # Umbral Wrangler (Major), the Trader nano
        235248: ("Psi", [], 125),  # Umbral Wrangler (Major), any profession
    }
    for aoid, (school, professions, level) in expected.items():
        (item,) = load_records(store_db, build, aoids=[aoid])
        assert item.is_nano
        found = client.get(
            "/api/v1/nanos/search", params={"q": item.name, "page_size": 200}
        ).json()["items"]
        (nano,) = [n for n in found if n["aoid"] == aoid]
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
# Actions on list and search results
# ============================================================================


def _nano_with_use_and_spell_criteria(store_db, build):
    """A nano whose Use action and whose spells both carry criteria."""
    for record in sorted(_nanos(store_db, build), key=lambda nano: nano.aoid):
        use_criteria = any(
            action["action"] == USE_ACTION and action["criteria"]
            for action in record.actions
        )
        spell_criteria = any(
            effect["criteria"]
            for event in record.effects
            for effect in event["effects"]
        )
        if use_criteria and spell_criteria:
            return record
    return None


def _expected_actions(record):
    """The nano's actions as the store holds them, criteria in order."""
    return sorted(
        (action["action"], [tuple(criterion) for criterion in action["criteria"]])
        for action in record.actions
    )


def _response_actions(nano):
    return sorted(
        (
            action["action"],
            [(c["value1"], c["value2"], c["operator"]) for c in action["criteria"]],
        )
        for action in nano["actions"]
    )


def test_list_and_search_nanos_return_actions(client, store_db, build):
    """The list and search endpoints return the same actions as the store."""
    nano = _nano_with_use_and_spell_criteria(store_db, build)
    assert nano is not None
    expected = _expected_actions(nano)

    listed = client.get(
        f"/api/v1/nanos?ql_min={nano.ql}&ql_max={nano.ql}&page_size=200"
    )
    assert listed.status_code == 200
    # The filter may match more than one page; walk them until the nano turns up
    pages = listed.json()["pages"]
    found = [n for n in listed.json()["items"] if n["aoid"] == nano.aoid]
    page = 2
    while not found and page <= pages:
        next_page = client.get(
            f"/api/v1/nanos?ql_min={nano.ql}&ql_max={nano.ql}"
            f"&page_size=200&page={page}"
        )
        found = [n for n in next_page.json()["items"] if n["aoid"] == nano.aoid]
        page += 1
    assert len(found) == 1
    assert _response_actions(found[0]) == expected

    searched = client.get(
        "/api/v1/nanos/search", params={"q": nano.name, "page_size": 200}
    )
    assert searched.status_code == 200
    matches = [n for n in searched.json()["items"] if n["aoid"] == nano.aoid]
    assert len(matches) == 1
    assert _response_actions(matches[0]) == expected


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


def test_profession_and_search_endpoints_return_derived_fields(client, store_db, build):
    """/nanos/profession/{id} and /nanos/search carry school, professions, level."""
    items = client.get("/api/v1/nanos/profession/11").json()["items"]
    assert items
    for item in items:
        assert {"school", "professions", "level"} <= item.keys()
    # That endpoint matches any caster Profession == NT criterion; the derived
    # list agrees wherever the Use criteria have no OR, NOT or target modifier
    simple = _simple_ids(store_db, build)
    assert all(
        "Nano-Technician" in item["professions"]
        for item in items
        if item["aoid"] in simple
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
# Edge Cases and Integration Tests
# ============================================================================


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
