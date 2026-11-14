# TinkerTools Backend Test Suite

## Running Tests
```bash
cd backend && source venv/bin/activate && \
set -a && . ./.env.local && set +a && \
python -m pytest app/tests -q
```

Tests need the PostgreSQL database of `DATABASE_URL`. Nothing a test writes stays in it: a test that needs its own data builds it in a transaction that is rolled back.

## Two Kinds of Route Test

**Controlled data** (the default for a new test). The `store` fixture (`fixtures/store_fixtures.py`) gives an empty content-addressed store in its own schema. The test fills it through the real importer and asks the API:

```python
from app.tests.fixtures.store_fixtures import item

def test_an_item_is_served_as_of_the_requested_build(store):
    store.add_build("old", 1, items=[item(100, name="Wrench")])
    store.add_build("new", 2, items=[item(100, name="Spanner")])

    with store.client("old") as client:
        assert client.get("/api/v1/items/100").json()["name"] == "Wrench"
```

Models to copy: `test_store_read.py`, `test_item_search.py`, `test_nano_store_endpoints.py`, `test_curated_endpoints.py`.

**Real game data.** The `client` fixture reads the development store. The values a test expects come from the same store, through `app.store`, with the `store_db` (session) and `build` (the build `client` reads) fixtures of `conftest.py`:

```python
from app.store.items import load_records
from app.tests.db_test_constants import ITEM_PISTOL_MASTERY

def test_item_detail_names_the_item(client, store_db, build):
    (item,) = load_records(store_db, build, aoids=[ITEM_PISTOL_MASTERY])

    assert client.get(f"/api/v1/items/{item.aoid}").json()["name"] == item.name
```

`db_test_constants.py` names real records with known characteristics.

The rules for both kinds are under "Testing" in the docstring of `app/store/__init__.py`.

## Tests of the Old Per-Version Store

`db_session` and the ORM models of `app/models` read the old per-version store. They are for the tests whose subject is that store or code that stays until it is removed (`test_shared_store.py`, `test_models.py`, `test_migration_runner.py`, `test_legacy_item_ids.py`, `test_versions_endpoints.py`). Do not use them in a test of a route that reads the content-addressed store.

## Coverage
`pytest.ini` requires 60% coverage and writes reports to `htmlcov/` and `coverage.json`. Pass `--no-cov` to skip them when running a few tests.
