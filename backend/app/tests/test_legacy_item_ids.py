"""
The transitional lookup from internal item row ids to AOIDs.

Runs against the real database inside a rolled-back transaction.
"""

from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import app
from app.models import Item


def test_legacy_item_ids_resolve_to_aoids(client, db_session):
    items = db_session.query(Item).order_by(Item.aoid).limit(3).all()
    missing_id = 2_000_000_000

    response = client.post(
        "/api/v1/legacy-item-ids/resolve",
        json={"item_ids": [item.id for item in items] + [missing_id]},
    )

    assert response.status_code == 200
    # Ids this version does not have are simply absent
    assert response.json() == {"aoids": {str(item.id): item.aoid for item in items}}


def test_legacy_item_ids_resolve_nothing(client):
    response = client.post("/api/v1/legacy-item-ids/resolve", json={"item_ids": []})

    assert response.status_code == 200
    assert response.json() == {"aoids": {}}


def test_legacy_item_ids_request_is_bounded(client):
    response = client.post(
        "/api/v1/legacy-item-ids/resolve", json={"item_ids": list(range(1001))}
    )

    assert response.status_code == 422


def test_legacy_item_ids_listed_twice_resolve_once(client, db_session):
    item = db_session.query(Item).order_by(Item.aoid).first()

    response = client.post(
        "/api/v1/legacy-item-ids/resolve", json={"item_ids": [item.id] * 3}
    )

    assert response.status_code == 200
    assert response.json() == {"aoids": {str(item.id): item.aoid}}


def test_legacy_item_ids_accepts_the_largest_allowed_request(client):
    response = client.post(
        "/api/v1/legacy-item-ids/resolve", json={"item_ids": list(range(1, 1001))}
    )

    assert response.status_code == 200


def test_legacy_item_ids_resolve_against_the_version_in_the_url(db_session):
    """An internal id means a different item, or nothing, in another version.

    Uses the application's own database handling, not the test session, so the
    version in the URL decides which data is read. The request only reads.
    """
    rows = db_session.execute(
        text("SELECT id, aoid FROM gv_prk_0_7_1.items ORDER BY aoid LIMIT 3")
    ).all()
    ids = [row.id for row in rows]

    with TestClient(app) as routed:
        in_prk = routed.post(
            "/api/v1/prk-0-7-1/legacy-item-ids/resolve", json={"item_ids": ids}
        )
        in_default = routed.post(
            "/api/v1/legacy-item-ids/resolve", json={"item_ids": ids}
        )

    assert in_prk.status_code == 200
    assert in_prk.json() == {"aoids": {str(row.id): row.aoid for row in rows}}
    assert in_default.json() != in_prk.json()
