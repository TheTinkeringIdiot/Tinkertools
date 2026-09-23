"""
The equipment bonus cache is process-wide and keyed by items.id, a per-schema
serial. With one schema per game version the same id names different items in
different versions, so the cache key must carry the version.
"""

import time

import pytest

from app.core.versions import current_version
from app.services.equipment_bonus_service import EquipmentBonusService


@pytest.fixture(autouse=True)
def empty_cache():
    EquipmentBonusService._item_bonus_cache.clear()
    EquipmentBonusService._cache_timestamps.clear()
    yield
    EquipmentBonusService._item_bonus_cache.clear()
    EquipmentBonusService._cache_timestamps.clear()


def service_for(slug: str) -> EquipmentBonusService:
    token = current_version.set(slug)
    try:
        return EquipmentBonusService(db=None)
    finally:
        current_version.reset(token)


def test_cached_bonuses_are_not_shared_across_versions():
    now = time.time()
    service_for("ao-2024-02")._store_bonuses(12345, {16: 20}, now)

    assert service_for("ao-2024-02")._cached_bonuses(12345, now) == {16: 20}
    assert service_for("prk-2026-01")._cached_bonuses(12345, now) is None


def test_bonus_breakdown_uses_the_versions_own_entry():
    now = time.time()
    service_for("ao-2024-02")._store_bonuses(12345, {16: 20}, now)
    service_for("prk-2026-01")._store_bonuses(12345, {17: 5}, now)

    assert service_for("ao-2024-02").get_item_bonus_breakdown(12345) == {16: 20}
    assert service_for("prk-2026-01").get_item_bonus_breakdown(12345) == {17: 5}
