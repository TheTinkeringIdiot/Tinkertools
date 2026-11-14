"""
The /nanos routes on a throwaway store: the rules they depend on that the
real game data cannot show in isolation (strain policy per build, curated QL,
presence in a build, tie-breaks, which criteria name a caster's profession).
"""

import os

import pytest

from app.tests.fixtures.store_fixtures import criterion, item

pytestmark = pytest.mark.skipif(
    not os.getenv("DATABASE_URL", "").startswith("postgres"), reason="needs PostgreSQL"
)

SOLDIER, DOCTOR, NT = 1, 10, 11
AND, ON_TARGET = 4, 18


def damage(stat=27, target=3, spell_id=53002):
    return {
        "SpellID": spell_id,
        "Target": target,
        "TickCount": 1,
        "TickInterval": 0,
        "Stat": stat,
        "Amount": -100,
        "Criteria": [],
        "SpellFormat": "Hit {Stat} {Amount}",
        "SpellDescription": f"Hit {stat} -100",
    }


def program(
    aoid, name=None, strain=5, use=None, school=1, stats=(), effects=(), description=""
):
    """A raw nano record. ``use`` is the Use action's criteria (None: no Use
    action), ``effects`` the effects of its Use event."""
    record = item(
        aoid,
        name=name or f"Nano {aoid}",
        ql=1,
        stats=[(405, school), *([(75, strain)] if strain is not None else []), *stats],
    )
    record["Description"] = description
    if use is not None:
        record["ActionData"] = {"Actions": [{"Action": 3, "Criteria": use}]}
    if effects:
        record["SpellData"] = [{"Event": 0, "Items": list(effects)}]
    return record


def cast_by(profession, level=None, stat=60):
    criteria = [criterion(stat, profession, 0)]
    if level is not None:
        criteria += [criterion(54, level - 1, 2), criterion(0, 0, AND)]
    return criteria


def overlay(*rows):
    """Rows of the nano CSV: ``(aoid, ql, strain, substrain)``."""
    return "".join(
        f"{aoid},{ql},,Name,{strain},{sub}\n" for aoid, ql, strain, sub in rows
    )


def aoids(response):
    assert response.status_code == 200, response.text
    return [row["aoid"] for row in response.json()["items"]]


def strain_stats(row):
    return sorted(
        (stat["stat"], stat["value"])
        for stat in row["stats"]
        if stat["stat"] in (75, 1003)
    )


# ---------------------------------------------------------------------------
# Strain policy
# ---------------------------------------------------------------------------


@pytest.fixture
def two_policies(store):
    """Nano 10 has strain 7 of its own and 9 in the overlay; nano 11 has no
    usable strain of its own and 9 in the overlay; nano 12 has only its own.
    ``old`` keeps a usable own strain, ``live`` takes the overlay."""
    nanos = [
        program(10, strain=7, use=cast_by(DOCTOR)),
        program(11, strain=0, use=cast_by(DOCTOR)),
        program(12, strain=3, use=cast_by(DOCTOR)),
    ]
    store.add_build("old", 1, nanos=nanos)
    store.add_build("live", 2, nanos=nanos)
    store.curate(nanos=overlay((10, 100, 9, 4), (11, 50, 9, 0)))
    return store


def test_the_strain_filter_reads_the_effective_strain_of_the_build(two_policies):
    with two_policies.client("old") as client:
        assert aoids(client.get("/api/v1/nanos?strain=7")) == [10]
        assert aoids(client.get("/api/v1/nanos?strain=9")) == [11]
    with two_policies.client("live") as client:
        assert aoids(client.get("/api/v1/nanos?strain=7")) == []
        assert aoids(client.get("/api/v1/nanos?strain=9")) == [10, 11]
        assert aoids(client.get("/api/v1/nanos?strain=3&strain=9")) == [10, 11, 12]


def test_a_nano_reports_the_effective_strain_of_the_build(two_policies):
    def strain_ids(client):
        rows = client.get("/api/v1/nanos").json()["items"]
        return {row["aoid"]: row["strain_id"] for row in rows}

    with two_policies.client("old") as client:
        assert strain_ids(client) == {10: 7, 11: 9, 12: 3}
    with two_policies.client("live") as client:
        assert strain_ids(client) == {10: 9, 11: 9, 12: 3}


def test_strain_counts_follow_the_strain_policy(two_policies):
    def counts(client):
        strains = client.get("/api/v1/nanos/strains").json()["strains"]
        return {row["id"]: row["count"] for row in strains}

    with two_policies.client("old") as client:
        assert counts(client) == {3: 1, 7: 1, 9: 1}
    with two_policies.client("live") as client:
        assert counts(client) == {3: 1, 9: 2}


def test_profession_list_rows_carry_the_effective_strain_in_their_stats(two_policies):
    def strains(client):
        rows = client.get(f"/api/v1/nanos/profession/{DOCTOR}").json()["items"]
        return {row["aoid"]: (row["strain_id"], strain_stats(row)) for row in rows}

    with two_policies.client("old") as client:
        assert strains(client) == {
            10: (7, [(75, 7)]),
            11: (9, [(75, 9)]),
            12: (3, [(75, 3)]),
        }
    with two_policies.client("live") as client:
        assert strains(client) == {
            10: (9, [(75, 9), (1003, 4)]),
            11: (9, [(75, 9)]),
            12: (3, [(75, 3)]),
        }


def test_a_profession_list_needs_a_real_effective_strain(store):
    nanos = [
        program(10, strain=0, use=cast_by(DOCTOR)),
        program(11, strain=99999, use=cast_by(DOCTOR)),
        program(12, strain=None, use=cast_by(DOCTOR)),
        program(13, strain=0, use=cast_by(DOCTOR)),
        program(14, strain=6, use=cast_by(DOCTOR)),
    ]
    store.add_build("live", 1, nanos=nanos)
    store.curate(nanos=overlay((13, 20, 8, 0)))

    with store.client("live") as client:
        assert aoids(client.get(f"/api/v1/nanos/profession/{DOCTOR}")) == [13, 14]
        # the list endpoints still show nanos without a strain
        assert len(aoids(client.get("/api/v1/nanos"))) == 5
        strains = client.get("/api/v1/nanos/strains").json()["strains"]
        assert {row["id"]: row["count"] for row in strains} == {
            0: 1,
            6: 1,
            8: 1,
            99999: 1,
        }


# ---------------------------------------------------------------------------
# Curated QL, presence, order
# ---------------------------------------------------------------------------


def test_ql_filters_and_sorts_use_the_curated_ql(store):
    store.add_build("live", 1, nanos=[program(n) for n in (10, 11, 12, 13)])
    store.curate(nanos=overlay((10, 200, 0, 0), (11, 50, 0, 0), (12, 200, 0, 0)))

    with store.client("live") as client:
        assert aoids(client.get("/api/v1/nanos?ql_min=100")) == [10, 12]
        assert aoids(client.get("/api/v1/nanos?ql_max=1")) == [13]
        assert aoids(client.get("/api/v1/nanos?sort_by=ql")) == [13, 11, 10, 12]
        by_ql_desc = client.get("/api/v1/nanos?sort_by=ql&sort_desc=true")
        assert aoids(by_ql_desc) == [10, 12, 11, 13]
        assert [row["ql"] for row in by_ql_desc.json()["items"]] == [200, 200, 50, 1]


def test_a_build_lists_the_nanos_it_has_as_it_has_them(store):
    store.add_build(
        "b1", 1, nanos=[program(10, name="Mend"), program(11, name="Gone Later")]
    )
    store.add_build(
        "b2", 2, nanos=[program(10, name="Mend Wounds"), program(12, name="New")]
    )

    def names(client, path="/api/v1/nanos"):
        return [row["name"] for row in client.get(path).json()["items"]]

    with store.client("b1") as client:
        assert names(client) == ["Gone Later", "Mend"]
        assert names(client, "/api/v1/nanos/search?q=wounds") == []
        assert names(client, "/api/v1/nanos/profession/0") == ["Mend", "Gone Later"]
    with store.client("b2") as client:
        assert names(client) == ["Mend Wounds", "New"]
        assert names(client, "/api/v1/nanos/search?q=wounds") == ["Mend Wounds"]
        assert names(client, "/api/v1/nanos/profession/0") == ["Mend Wounds", "New"]


def test_every_sort_breaks_ties_on_the_aoid(store):
    nanos = [
        program(aoid, name="Same", use=cast_by(DOCTOR, level=10))
        for aoid in (14, 11, 13, 12)
    ]
    store.add_build("live", 1, nanos=nanos)

    with store.client("live") as client:
        for query in (
            "",
            "?sort_desc=true",
            "?sort_by=ql&sort_desc=true",
            "?sort_by=level",
            "?sort_by=level&sort_desc=true",
            "?sort_by=no-such-field",
        ):
            assert aoids(client.get(f"/api/v1/nanos{query}")) == [11, 12, 13, 14]
            assert aoids(client.get(f"/api/v1/nanos/search{query or '?'}&q=same")) == [
                11,
                12,
                13,
                14,
            ]
        pages = [
            aoids(client.get(f"/api/v1/nanos?page_size=3&page={page}"))
            for page in (1, 2)
        ]
        assert pages == [[11, 12, 13], [14]]


def test_profession_lists_default_to_ql_descending_then_aoid(store):
    nanos = [
        program(n, name=name, use=cast_by(NT), effects=[damage()])
        for n, name in ((10, "Delta"), (11, "Alpha"), (12, "Charlie"), (13, "Bravo"))
    ]
    store.add_build("live", 1, nanos=nanos)
    store.curate(nanos=overlay((10, 50, 0, 0), (11, 200, 0, 0), (12, 200, 0, 0)))

    with store.client("live") as client:
        for route in ("profession", "offensive"):
            base = f"/api/v1/nanos/{route}/{NT}"
            assert aoids(client.get(base)) == [11, 12, 10, 13]
            assert aoids(client.get(f"{base}?sort=no-such-field")) == [11, 12, 10, 13]
            assert aoids(client.get(f"{base}?sort_order=asc")) == [13, 10, 11, 12]
            assert aoids(client.get(f"{base}?sort=name&sort_order=asc")) == [
                11,
                13,
                12,
                10,
            ]
            page = client.get(f"{base}?page_size=3&page=2").json()
            assert [row["aoid"] for row in page["items"]] == [13]
            assert (page["total"], page["pages"], page["has_prev"]) == (4, 2, True)


def test_level_sort_puts_nanos_nobody_casts_last_either_way(store):
    nanos = [
        program(10, use=cast_by(DOCTOR, level=50)),
        program(11),
        program(12, use=cast_by(DOCTOR, level=10)),
    ]
    store.add_build("live", 1, nanos=nanos)

    with store.client("live") as client:
        ascending = client.get("/api/v1/nanos?sort_by=level").json()["items"]
        assert [(n["aoid"], n["level"]) for n in ascending] == [
            (12, 10),
            (10, 50),
            (11, None),
        ]
        descending = client.get("/api/v1/nanos?sort_by=level&sort_desc=true")
        assert aoids(descending) == [10, 12, 11]


# ---------------------------------------------------------------------------
# Filters of the list
# ---------------------------------------------------------------------------


def test_list_filters_read_school_professions_and_level(store):
    nanos = [
        program(10, school=2, use=cast_by(DOCTOR, level=100)),
        program(11, school=1, use=cast_by(NT, level=20)),
        program(12, school=2, use=[]),
        program(13, school=2),
    ]
    store.add_build("live", 1, nanos=nanos)

    with store.client("live") as client:

        def listed(query):
            return aoids(client.get(f"/api/v1/nanos?{query}"))

        assert listed("school=Medical") == [10, 12, 13]
        assert listed("school=medical&school=1") == [10, 11, 12, 13]
        # anyone can cast a nano whose Use action names no profession; a nano
        # without a Use action is cast by nobody
        assert listed("profession=Doctor") == [10, 12]
        assert listed("profession=11&profession=Doctor") == [10, 11, 12]
        assert listed("level_min=20") == [10, 11]
        assert listed("level_max=1") == [12]
        assert listed("school=Medical&profession=Doctor&level_min=50") == [10]

        row = client.get("/api/v1/nanos?level_min=100").json()["items"][0]
        assert (row["school"], row["professions"], row["level"]) == (
            "Medical",
            ["Doctor"],
            100,
        )


def test_a_filter_of_only_unknown_values_matches_nothing(store):
    store.add_build("live", 1, nanos=[program(10, use=cast_by(DOCTOR))])

    with store.client("live") as client:
        for query in (
            "school=Alchemy",
            "profession=Monster",
            "profession=13",
            "strain=No such strain",
            "strain=99999999999999999999",
        ):
            data = client.get(f"/api/v1/nanos?{query}").json()
            assert (data["items"], data["total"], data["pages"]) == ([], 0, 1), query
        # an unknown value beside a known one is ignored
        assert aoids(client.get("/api/v1/nanos?school=Alchemy&school=Combat")) == [10]


def test_search_matches_name_or_description_and_takes_the_list_filters(store):
    nanos = [
        program(10, name="Heal Wounds", school=2),
        program(11, name="Burn", description="Does not HEAL anyone", school=1),
        program(12, name="Shield", school=2),
    ]
    store.add_build("live", 1, nanos=nanos)

    with store.client("live") as client:
        assert aoids(client.get("/api/v1/nanos/search?q=heal")) == [11, 10]
        assert aoids(client.get("/api/v1/nanos/search?q=heal&school=Medical")) == [10]
        strains = client.get("/api/v1/nanos/strains?q=heal&school=Combat").json()
        assert strains["strains"] == [{"id": 5, "name": "Challenger", "count": 1}]


def test_search_pages_add_up_to_its_total(store):
    nanos = [program(aoid, name=f"Heal {aoid % 3}") for aoid in range(10, 17)]
    store.add_build("live", 1, nanos=nanos + [program(20, name="Burn")])

    with store.client("live") as client:

        def page(number):
            path = f"/api/v1/nanos/search?q=heal&page_size=3&page={number}"
            return client.get(path).json()

        pages = [page(number) for number in (1, 2, 3)]
        past_the_end = page(4)

    assert [[n["aoid"] for n in p["items"]] for p in pages] == [
        [12, 15, 10],
        [13, 16, 11],
        [14],
    ]
    assert [(p["total"], p["pages"], p["has_next"]) for p in pages] == [
        (7, 3, True),
        (7, 3, True),
        (7, 3, False),
    ]
    assert (past_the_end["items"], past_the_end["total"]) == ([], 7)
    assert (past_the_end["has_next"], past_the_end["has_prev"]) == (False, True)


def test_strains_are_sorted_by_name_with_unnamed_ids_last(store):
    nanos = [
        program(10, strain=123456),
        program(11, strain=2),
        program(12, strain=1),
        program(13, strain=1),
    ]
    store.add_build("live", 1, nanos=nanos)

    with store.client("live") as client:
        strains = client.get("/api/v1/nanos/strains").json()["strains"]

    assert strains == [
        {"id": 1, "name": "Damage Shields", "count": 2},
        {"id": 2, "name": "Reflect Shield", "count": 1},
        {"id": 123456, "name": None, "count": 1},
    ]


# ---------------------------------------------------------------------------
# Profession and offensive lists
# ---------------------------------------------------------------------------


def test_a_profession_list_reads_the_use_actions_caster_criteria(store):
    on_target = [
        criterion(54, 10, 2),
        criterion(0, 0, ON_TARGET),
        criterion(60, DOCTOR, 0),
        criterion(0, 0, AND),
    ]
    wield_only = program(15)
    wield_only["ActionData"] = {"Actions": [{"Action": 6, "Criteria": cast_by(DOCTOR)}]}
    nanos = [
        program(10, use=cast_by(DOCTOR)),
        program(11, use=cast_by(DOCTOR, stat=368)),
        program(12, use=on_target),
        program(13, use=cast_by(SOLDIER)),
        program(14, name="TESTLIVEITEM heal", use=cast_by(DOCTOR)),
        wield_only,
        program(16),
    ]
    store.add_build("live", 1, nanos=nanos)

    with store.client("live") as client:
        assert aoids(client.get(f"/api/v1/nanos/profession/{DOCTOR}")) == [10, 11]
        assert aoids(client.get(f"/api/v1/nanos/profession/{SOLDIER}")) == [13]
        # profession 0 lists every nano with a strain but the test items
        assert aoids(client.get("/api/v1/nanos/profession/0")) == [
            10,
            11,
            12,
            13,
            15,
            16,
        ]
        unknown = client.get("/api/v1/nanos/profession/99").json()
        assert (unknown["items"], unknown["total"], unknown["pages"]) == ([], 0, 1)


def test_offensive_nanos_lower_a_hostile_targets_health(store):
    nanos = [
        program(10, use=cast_by(NT), effects=[damage()]),
        program(11, use=cast_by(NT), effects=[damage(stat=214)]),
        program(12, use=cast_by(NT), effects=[damage(target=2)]),
        program(13, use=cast_by(NT), effects=[damage(spell_id=53045)]),
        program(14, use=cast_by(DOCTOR), effects=[damage()]),
        program(15, use=cast_by(NT), effects=[damage(stat=214), damage()]),
        program(16, use=cast_by(NT), effects=[damage()], strain=0),
        program(17, use=cast_by(NT)),
    ]
    store.add_build("live", 1, nanos=nanos)

    with store.client("live") as client:
        assert aoids(client.get(f"/api/v1/nanos/offensive/{NT}")) == [10, 15]
        assert aoids(client.get("/api/v1/nanos/offensive/0")) == [10, 14, 15]
        row = client.get(f"/api/v1/nanos/offensive/{NT}").json()["items"][0]

    assert row["is_nano"] is True
    assert row["sources"] == [] and row["attack_stats"] == []
    spell = row["spell_data"][0]["spells"][0]
    assert (spell["spell_id"], spell["target"]) == (53002, 3)
    assert spell["spell_params"] == {
        "Stat": 27,
        "Amount": -100,
        "SpellDescription": "Hit 27 -100",
    }
    assert spell["spell_format"] == "Hit {Stat} {Amount}"
    assert row["actions"] == [
        {"action": 3, "criteria": [{"value1": 60, "value2": NT, "operator": 0}]}
    ]


# ---------------------------------------------------------------------------
# Response content
# ---------------------------------------------------------------------------


def test_cast_and_recharge_times_are_the_nanos_delay_stats(store):
    nanos = [
        program(10, stats=[(294, 340), (210, 560)], effects=[damage()]),
        program(11, stats=[(294, 0)]),
        program(12),
    ]
    store.add_build("live", 1, nanos=nanos)

    with store.client("live") as client:
        rows = client.get("/api/v1/nanos").json()["items"]

    assert [(n["aoid"], n["casting_time"], n["recharge_time"]) for n in rows] == [
        (10, 340, 560),
        (11, 0, None),
        (12, None, None),
    ]


def test_a_listed_nano_carries_its_actions_in_evaluation_order(store):
    use = [
        criterion(127, 300, 2),
        criterion(60, DOCTOR, 0),
        criterion(0, 0, AND),
        criterion(54, 99, 2),
        criterion(0, 0, AND),
    ]
    store.add_build("live", 1, nanos=[program(10, name="Heal", use=use)])

    with store.client("live") as client:
        row = client.get("/api/v1/nanos").json()["items"][0]

    assert (row["id"], row["aoid"], row["name"], row["ql"]) == (10, 10, "Heal", 1)
    assert row["actions"] == [
        {
            "action": 3,
            "criteria": [
                {"value1": 127, "value2": 300, "operator": 2},
                {"value1": 60, "value2": DOCTOR, "operator": 0},
                {"value1": 0, "value2": 0, "operator": AND},
                {"value1": 54, "value2": 99, "operator": 2},
                {"value1": 0, "value2": 0, "operator": AND},
            ],
        }
    ]
    assert (row["professions"], row["level"]) == (["Doctor"], 100)


def test_the_number_of_queries_does_not_grow_with_the_page(store):
    nanos = [program(1000 + n, use=cast_by(NT), effects=[damage()]) for n in range(30)]
    store.add_build("live", 1, nanos=nanos)

    with store.client("live") as client:
        for path in (
            "/api/v1/nanos?profession=11&sort_by=level",
            "/api/v1/nanos/search?q=nano",
            f"/api/v1/nanos/profession/{NT}?sort=name",
            f"/api/v1/nanos/offensive/{NT}?sort=name",
        ):
            counts = []
            for page_size in (2, 30):
                with store.counting_queries() as statements:
                    response = client.get(f"{path}&page_size={page_size}")
                assert len(response.json()["items"]) == page_size
                counts.append(len(statements))
            assert counts[0] == counts[1] <= 5, path
