"""
The transitional lookup from internal item row ids to AOIDs.

Runs against the real database inside a rolled-back transaction.
"""

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
