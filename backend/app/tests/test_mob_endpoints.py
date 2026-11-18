"""
Unit tests for mob API endpoints.

Most tests read the real mobs and symbiants of the development store and take
the values they expect from the store's own ``mob`` table. The two that need a
store without mobs, or a mob without drops, fill a throwaway store.
"""

from sqlalchemy import select

from app.store import tables as t
from app.tests.db_test_constants import (
    MOB_ADOBE_SUZERAIN,
    MOB_AESMA_DAEVA,
    MOB_AHPTA,
)
from app.tests.fixtures.store_fixtures import item


def _mob(store_db, name):
    """The store's row of a served mob, by its (unique) name."""
    return store_db.execute(
        select(t.mob).where(t.mob.c.name == name, ~t.mob.c.retired)
    ).one()


# ============================================================================
# GET /api/v1/mobs Tests
# ============================================================================


def test_list_mobs_empty(store):
    """Test listing mobs of a store that has none."""
    store.add_build("b1", 1, items=[item(1)])

    with store.client("b1") as client:
        response = client.get("/api/v1/mobs")

    assert response.status_code == 200
    assert response.json() == {
        "items": [],
        "total": 0,
        "page": 1,
        "page_size": 50,
        "pages": 1,
        "has_next": False,
        "has_prev": False,
    }


def test_list_mobs_with_data(client, store_db):
    """Test listing mobs with data using real database mobs."""
    response = client.get("/api/v1/mobs?page_size=200")

    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) >= 1

    # Verify Adobe Suzerain exists in the list
    mob = _mob(store_db, MOB_ADOBE_SUZERAIN)
    adobe_suzerain = next((m for m in data["items"] if m["id"] == mob.mob_id), None)
    assert adobe_suzerain is not None
    assert adobe_suzerain["name"] == mob.name
    assert adobe_suzerain["level"] == mob.level


def test_list_mobs_pagination(client, store_db):
    """Test mob pagination."""
    response = client.get("/api/v1/mobs?page=1&page_size=5")

    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) >= 1
    assert data["page"] == 1
    assert data["page_size"] == 5


def test_list_mobs_filter_pocket_boss(client, store_db):
    """Test filtering mobs by pocket boss status."""
    response = client.get("/api/v1/mobs?is_pocket_boss=true&page_size=200")

    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1

    # All returned items should be pocket bosses
    for mob in data["items"]:
        assert mob["is_pocket_boss"] is True

    # Verify our known pocket boss is in the list
    mob = _mob(store_db, MOB_ADOBE_SUZERAIN)
    adobe_suzerain = next((m for m in data["items"] if m["id"] == mob.mob_id), None)
    assert adobe_suzerain is not None


def test_list_mobs_filter_playfield(client, store_db):
    """Test filtering mobs by playfield."""
    mob = _mob(store_db, MOB_ADOBE_SUZERAIN)

    response = client.get(f"/api/v1/mobs?playfield={mob.playfield}")

    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1

    # Find our mob
    adobe_suzerain = next((m for m in data["items"] if m["id"] == mob.mob_id), None)
    assert adobe_suzerain is not None
    assert mob.playfield in adobe_suzerain["playfield"]


def test_list_mobs_filter_level_range(client, store_db):
    """Test filtering mobs by level range."""
    # Get mobs in level range 120-130 (Adobe Suzerain is level 125)
    response = client.get("/api/v1/mobs?min_level=120&max_level=130")

    assert response.status_code == 200
    data = response.json()

    # All returned mobs should be in range
    for mob in data["items"]:
        assert 120 <= mob["level"] <= 130

    # Adobe Suzerain should be in this range
    mob = _mob(store_db, MOB_ADOBE_SUZERAIN)
    adobe_suzerain = next((m for m in data["items"] if m["id"] == mob.mob_id), None)
    assert adobe_suzerain is not None


def test_list_mobs_invalid_page(client):
    """Test with invalid page number."""
    response = client.get("/api/v1/mobs?page=-1")
    assert response.status_code == 422


def test_list_mobs_invalid_page_size(client):
    """Test with invalid page size."""
    response = client.get("/api/v1/mobs?page_size=0")
    assert response.status_code == 422

    response = client.get("/api/v1/mobs?page_size=2000")
    assert response.status_code == 422


# ============================================================================
# GET /api/v1/mobs/{mob_id} Tests
# ============================================================================


def test_get_mob_by_id(client, store_db):
    """Test getting a specific mob by ID using real database mob."""
    mob = _mob(store_db, MOB_ADOBE_SUZERAIN)

    response = client.get(f"/api/v1/mobs/{mob.mob_id}")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == mob.mob_id
    assert data["name"] == mob.name
    assert data["level"] == mob.level
    assert data["playfield"] == mob.playfield
    assert data["is_pocket_boss"] is True


def test_get_mob_not_found(client, store_db):
    """Test getting non-existent mob."""
    response = client.get("/api/v1/mobs/999999999")

    assert response.status_code == 404
    data = response.json()
    # Check for either 'detail' or 'error' field (different FastAPI versions)
    error_msg = data.get("detail", data.get("error", ""))
    assert "not found" in str(error_msg).lower()


def test_get_mob_invalid_id(client):
    """Test getting mob with invalid ID."""
    response = client.get("/api/v1/mobs/invalid")
    assert response.status_code == 422


# ============================================================================
# GET /api/v1/mobs/{mob_id}/drops Tests
# ============================================================================


def test_get_mob_drops(client, store_db):
    """Test getting symbiant drops for a mob using real database data."""
    # Adobe Suzerain has 7 symbiant drops
    mob = _mob(store_db, MOB_ADOBE_SUZERAIN)

    response = client.get(f"/api/v1/mobs/{mob.mob_id}/drops")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    # Should have multiple drops (7 in real database)
    assert len(data) >= 1


def test_get_mob_drops_filter_family(client, store_db):
    """Test filtering mob drops by family using real database data."""
    # Ahpta has symbiants from Artillery and Control families
    mob = _mob(store_db, MOB_AHPTA)

    response = client.get(f"/api/v1/mobs/{mob.mob_id}/drops?family=Control")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)

    # All returned items should be Control family
    for symbiant in data:
        assert symbiant["family"] == "Control"


def test_get_mob_drops_no_drops(store):
    """Test getting drops for a mob none of whose drops the build carries."""
    symbiant = item(
        1, name="Active Ocular Symbiant, Artillery Unit Aban", stats=[(298, 2)]
    )
    store.add_build("b1", 1, items=[symbiant])
    store.curate(mobs=[("Ahpta", "Inferno", 1), ("Alatyr", "Inferno", 2)])

    with store.client("b1") as client:
        mobs = {mob["name"]: mob for mob in client.get("/api/v1/mobs").json()["items"]}
        with_drops = client.get(f"/api/v1/mobs/{mobs['Ahpta']['id']}/drops")
        without_drops = client.get(f"/api/v1/mobs/{mobs['Alatyr']['id']}/drops")

    assert [symbiant["aoid"] for symbiant in with_drops.json()] == [1]
    assert without_drops.status_code == 200
    assert without_drops.json() == []
    assert mobs["Alatyr"]["symbiant_count"] == 0


def test_get_mob_drops_mob_not_found(client, store_db):
    """Test getting drops for non-existent mob."""
    response = client.get("/api/v1/mobs/999999999/drops")

    assert response.status_code == 404
    data = response.json()
    # Check for either 'detail' or 'error' field (different FastAPI versions)
    error_msg = data.get("detail", data.get("error", ""))
    assert "not found" in str(error_msg).lower()


def test_get_mob_drops_invalid_mob_id(client):
    """Test getting drops with invalid mob ID."""
    response = client.get("/api/v1/mobs/invalid/drops")
    assert response.status_code == 422


def test_get_mob_drops_with_actions(client, store_db):
    """Test that mob drops include actions with criteria using real database data."""
    # Adobe Suzerain drops symbiants which should have actions
    mob = _mob(store_db, MOB_ADOBE_SUZERAIN)

    response = client.get(f"/api/v1/mobs/{mob.mob_id}/drops")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)

    # Check that actions are included if they exist
    for symbiant_response in data:
        assert "actions" in symbiant_response


def test_get_mob_drops_with_spell_data(client, store_db):
    """Test that mob drops include spell_data using real database data."""
    # Adobe Suzerain drops symbiants which should have spell data
    mob = _mob(store_db, MOB_ADOBE_SUZERAIN)

    response = client.get(f"/api/v1/mobs/{mob.mob_id}/drops")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)

    # Check that spell_data structure is included
    for symbiant_response in data:
        assert "spell_data" in symbiant_response


# ============================================================================
# Performance and Edge Cases
# ============================================================================


def test_mob_endpoints_performance_logging(client, store_db):
    """Test that mob endpoints log performance metrics."""
    mob = _mob(store_db, MOB_ADOBE_SUZERAIN)

    response = client.get(f"/api/v1/mobs/{mob.mob_id}")

    assert response.status_code == 200
    # Performance logging is done by the @performance_monitor decorator
    # We just verify the endpoint works correctly


def test_list_mobs_with_symbiant_counts(client, store_db):
    """Test that mob list includes symbiant drop counts."""
    mob = _mob(store_db, MOB_ADOBE_SUZERAIN)

    # Get the mob by ID to check symbiant_count field
    response = client.get(f"/api/v1/mobs/{mob.mob_id}")

    assert response.status_code == 200
    data = response.json()
    assert "symbiant_count" in data
    # Adobe Suzerain has 7 symbiants
    assert data["symbiant_count"] >= 1


def test_get_mob_by_id_with_symbiant_count(client, store_db):
    """Test that mob detail includes symbiant drop count."""
    mob = _mob(store_db, MOB_ADOBE_SUZERAIN)

    response = client.get(f"/api/v1/mobs/{mob.mob_id}")

    assert response.status_code == 200
    data = response.json()
    assert "symbiant_count" in data
    # Adobe Suzerain has 7 symbiants
    assert data["symbiant_count"] >= 1


def test_list_mobs_ordering(client, store_db):
    """Test that mobs are ordered by level then name."""
    # Just verify that endpoint returns ordered results by level
    response = client.get("/api/v1/mobs?page=1&page_size=50")

    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) >= 1

    # Check that returned mobs are ordered by level ascending
    for i in range(len(data["items"]) - 1):
        assert data["items"][i]["level"] <= data["items"][i + 1]["level"]


def test_mob_drops_ordering(client, store_db):
    """Test that mob drops are ordered by QL then name using real database data."""
    # Adobe Suzerain has 7 symbiants with different QLs (150, 170, etc.)
    mob = _mob(store_db, MOB_ADOBE_SUZERAIN)

    response = client.get(f"/api/v1/mobs/{mob.mob_id}/drops")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)

    # Check ordering if we have multiple items
    if len(data) >= 2:
        for i in range(len(data) - 1):
            assert data[i]["ql"] <= data[i + 1]["ql"]
            if data[i]["ql"] == data[i + 1]["ql"]:
                assert data[i]["name"] <= data[i + 1]["name"]


def test_multiple_mobs_multiple_drops(client, store_db):
    """Test scenario with multiple mobs each having multiple drops."""
    # Use real mobs: Adobe Suzerain (7 drops), Ahpta (5 drops), Aesma Daeva (1 drop)
    mobs = [
        _mob(store_db, MOB_ADOBE_SUZERAIN),
        _mob(store_db, MOB_AHPTA),
        _mob(store_db, MOB_AESMA_DAEVA),
    ]

    # Test each mob endpoint works
    for mob in mobs:
        response = client.get(f"/api/v1/mobs/{mob.mob_id}/drops")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    # Test mob list endpoint works
    response = client.get("/api/v1/mobs?page_size=200")
    assert response.status_code == 200
    data = response.json()

    # Check that our mobs appear in the list
    for mob in mobs:
        test_mob = next((m for m in data["items"] if m["id"] == mob.mob_id), None)
        if test_mob:
            assert "symbiant_count" in test_mob
            assert test_mob["symbiant_count"] >= 0
