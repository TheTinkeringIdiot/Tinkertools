"""
The response cache as a user of the API meets it (``cached_response``,
app/core/decorators.py):

* a cached response belongs to one build: the same route asked of two builds
  answers each with its own data, and a family alias shares the entry of the
  build it names;
* a cached route sends exactly what its ``response_model`` declares, although
  FastAPI no longer validates or filters it.
"""

import json
import os
from typing import Any, Callable, Dict, List, Tuple

import pytest
from fastapi.routing import APIRoute
from pydantic import TypeAdapter

from app.main import app
from app.tests.fixtures.store_fixtures import item

pytestmark = pytest.mark.skipif(
    not os.getenv("DATABASE_URL", "").startswith("postgres"), reason="needs PostgreSQL"
)

API = "/api/v1"


# ---------------------------------------------------------------------------
# One entry per build
# ---------------------------------------------------------------------------


@pytest.fixture
def two_builds(store):
    """A store with two builds whose item 100 differs:
    ``(store, alias of the newer, slug of the newer, slug of the older)``."""
    store.add_build("ao-1", 1, items=[item(100, name="Wrench")])
    store.add_build("ao-2", 2, items=[item(100, name="Spanner")])
    return store, "ao", "ao-2", "ao-1"


def test_a_cached_route_answers_each_build_with_its_own_data(two_builds):
    store, _, newer, older = two_builds

    with store.client() as client:
        names = [
            client.get(f"{API}/{slug}/items/100").json()["name"]
            for slug in (older, newer, older, newer)
        ]
        with store.counting_queries() as statements:
            again = client.get(f"{API}/{older}/items/100").json()["name"]

    assert names == ["Wrench", "Spanner", "Wrench", "Spanner"]
    assert again == "Wrench"
    assert statements == [], "the route is expected to be cached"


def test_a_family_alias_shares_the_cache_entry_of_the_build_it_names(two_builds):
    store, alias, newer, _ = two_builds

    with store.client() as client:
        by_slug = client.get(f"{API}/{newer}/items/100")
        with store.counting_queries() as statements:
            by_alias = client.get(f"{API}/{alias}/items/100")

    assert by_slug.json()["name"] == "Spanner"
    assert by_alias.content == by_slug.content
    assert statements == []


# ---------------------------------------------------------------------------
# A cached body is its response model
# ---------------------------------------------------------------------------

Ids = Dict[str, Any]
Example = Tuple[str, str, Callable[[Ids], Dict[str, Any]]]

WEAPON_CHARACTER = {
    "level": 220,
    "breed_id": 1,
    "profession_id": 11,
    "side": 2,
    "expansion_bitflag": 127,
    "top_weapon_skills": [{"skill_id": 116, "value": 2500}],
}

# One request per cached route, by the route's path: (method, path with the
# ids filled in, keyword arguments of the request). A route that gains
# ``cached_response`` is added here.
EXAMPLES: Dict[str, Example] = {
    "/items/{aoid}": ("GET", "/items/{item}", lambda ids: {}),
    "/items/{aoid}/timeline": ("GET", "/items/{item}/timeline", lambda ids: {}),
    "/items/{aoid}/compare/{base}": (
        "GET",
        "/items/{item}/compare/{base}",
        lambda ids: {},
    ),
    "/changes": (
        "GET",
        "/changes",
        lambda ids: {"params": {"page_size": 20, "include_diff": "true"}},
    ),
    "/changes/transitions": ("GET", "/changes/transitions", lambda ids: {}),
    "/compare/{base}": (
        "GET",
        "/compare/{base}",
        lambda ids: {"params": {"page_size": 20, "include_diff": "true"}},
    ),
    "/nanos": ("GET", "/nanos", lambda ids: {"params": {"page_size": 20}}),
    "/nanos/search": (
        "GET",
        "/nanos/search",
        lambda ids: {"params": {"q": "heal", "page_size": 20}},
    ),
    "/nanos/strains": ("GET", "/nanos/strains", lambda ids: {}),
    "/nanos/profession/{profession_id}": (
        "GET",
        "/nanos/profession/10",
        lambda ids: {"params": {"page_size": 20}},
    ),
    "/nanos/offensive/{profession_id}": (
        "GET",
        "/nanos/offensive/11",
        lambda ids: {"params": {"page_size": 20}},
    ),
    "/symbiants": ("GET", "/symbiants", lambda ids: {"params": {"page_size": 20}}),
    "/symbiants/{aoid}": ("GET", "/symbiants/{symbiant}", lambda ids: {}),
    "/symbiants/{aoid}/dropped-by": (
        "GET",
        "/symbiants/{symbiant}/dropped-by",
        lambda ids: {},
    ),
    "/mobs": ("GET", "/mobs", lambda ids: {"params": {"page_size": 20}}),
    "/mobs/{mob_id}": ("GET", "/mobs/{mob}", lambda ids: {}),
    "/mobs/{mob_id}/drops": ("GET", "/mobs/{mob}/drops", lambda ids: {}),
    "/weapons/analyze": (
        "POST",
        "/weapons/analyze",
        lambda ids: {"json": WEAPON_CHARACTER},
    ),
}


def cached_routes() -> Dict[str, APIRoute]:
    """The routes whose endpoint ``cached_response`` wraps, by their path
    under the API prefix."""
    return {
        route.path[len(API) :]: route
        for route in app.routes
        if isinstance(route, APIRoute) and hasattr(route.endpoint, "cache_type")
    }


@pytest.fixture
def ids(client) -> Ids:
    """Values of the development store that the example requests name."""

    def first(path: str, **params: Any) -> Dict[str, Any]:
        response = client.get(f"{API}{path}", params={"page_size": 1, **params})
        assert response.status_code == 200, response.text
        return response.json()["items"][0]

    versions = client.get(f"{API}/versions").json()["versions"]
    mob = first("/mobs")["id"]
    return {
        "item": first("/changes", kind="changed")["aoid"],
        "symbiant": client.get(f"{API}/mobs/{mob}/drops").json()[0]["aoid"],
        "mob": mob,
        "base": next(
            version["slug"]
            for version in versions
            if not version["is_current"] and version["alias_of"] is None
        ),
    }


def test_every_cached_route_has_an_example_request():
    assert sorted(cached_routes()) == sorted(EXAMPLES)


def _undeclared(sent: Any, declared: Any, where: str = "") -> List[str]:
    """Where a body and its response model's rendering of it differ."""
    if isinstance(sent, dict) and isinstance(declared, dict):
        return [
            difference
            for key in sorted(set(sent) | set(declared))
            for difference in (
                _undeclared(sent[key], declared[key], f"{where}.{key}")
                if key in sent and key in declared
                else [f"{where}.{key}: {'extra' if key in sent else 'missing'}"]
            )
        ]
    if isinstance(sent, list) and isinstance(declared, list):
        if len(sent) != len(declared):
            return [f"{where}: {len(sent)} entries sent, {len(declared)} declared"]
        return [
            difference
            for index, pair in enumerate(zip(sent, declared))
            for difference in _undeclared(*pair, f"{where}[{index}]")
        ]
    return (
        [] if sent == declared else [f"{where}: {sent!r} sent, {declared!r} declared"]
    )


@pytest.mark.parametrize("path", sorted(EXAMPLES))
def test_a_cached_route_sends_exactly_its_response_model(client, ids, path):
    route = cached_routes()[path]
    method, template, arguments = EXAMPLES[path]
    url = API + template.format(**ids)

    first = client.request(method, url, **arguments(ids))
    cached = client.request(method, url, **arguments(ids))

    assert first.status_code == 200, first.text
    assert cached.content == first.content
    model = TypeAdapter(route.response_model)
    declared = model.dump_python(
        model.validate_json(first.content),
        mode="json",
        by_alias=route.response_model_by_alias,
    )
    assert json.loads(first.content) not in (
        [],
        {},
        None,
    ), "an empty body shows nothing"
    assert _undeclared(json.loads(first.content), declared)[:20] == []
