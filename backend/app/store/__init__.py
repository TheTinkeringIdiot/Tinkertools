"""
Read path of the content-addressed store.

Every route that serves game data reads it through this package:

``context``   the build a request names and the session that reads the store
``tables``    the store's tables, for composing queries
``presence``  "the revisions present in this build", filters, pages
``items``     revisions as served items (``ItemRecord``, ``ItemDetail``)

The store itself is described where it is defined:
``backend/database/cas/001_store.sql`` and ``002_curated_and_derived.sql``
(how QL, strain, feature flags, source names and retired mobs are served) and
the docstring of ``app/core/parts.py`` (the part documents).

Porting a route
===============

1. Dependencies. Replace ``db: Session = Depends(get_db)`` by::

       db: Session = Depends(get_store), build: Build = Depends(get_build)

   Keep the name ``db``: ``cached_response`` leaves a parameter of that name
   out of its cache key. ``build`` becomes part of the key, which is right.
   The session has no ``search_path`` and no version: pass ``build`` to every
   query. Do not mix old-store ORM models into a store session.

2. A list or search. Start from ``revisions(build)``, add filters, let
   ``fetch_page`` count and page it, load the page::

       r = t.item_revision
       query = revisions(build).where(r.c.item_class == 1, r.c.ql >= min_ql)
       query = query.join(t.part_text, t.part_text.c.text_id == r.c.text_id)
       query = query.where(t.part_text.c.name.ilike(f"%{q}%"))
       query = query.where(has_stat(t.stat_entry.c.stat == 298,
                                    t.stat_entry.c.value.op("&")(slot) == slot))
       page_ = fetch_page(db, query, [t.part_text.c.name], page, page_size)
       items = load_item_details(db, build, rev_ids=page_.rev_ids)
       return PaginatedResponse[ItemDetail](
           items=items, **page_fields(page_.total, page, page_size))

   * ``revisions(build)`` has one row per item, so no DISTINCT is needed.
   * Filters on a part go through ``has_stat``, ``has_requirement``,
     ``has_effect`` and ``has_atkdef``: EXISTS on the projection of the
     revision's part. Several conditions in one call must hold for the same
     entry; separate calls may be met by different entries.
   * ``fetch_page`` sorts by the keys you give and then by AOID. Pass ``[]``
     to sort by AOID alone. Never sort by ``rev_id`` or any other internal id.
   * A route that is not paged executes its query itself and passes the
     revision ids, or the AOIDs, to the loader.

3. Items. ``load_item_details`` returns ``ItemDetail`` responses in three
   queries for any number of items. ``load_records`` returns ``ItemRecord``
   values (one query) for code that computes on items or builds another
   response shape; ``stats_response`` and ``actions_response`` turn a record
   into response pieces.
   ``item_document`` is the one place the shape of an ``ItemDetail`` is
   written; ``load_item_documents`` returns the plain documents for a route
   that serves too many items to validate each (``/weapons/analyze``). A lighter
   list shape (name, QL, a few columns) does not need the loader at all:
   select the columns in the ``revisions`` query.

4. Nanos. ``item_revision.ql`` is already the curated QL. School,
   professions, level and the effective strain are in ``nano_properties``:
   join it with ``nano_policy(build)``. Anything that filters, groups or
   counts by strain reads ``nano_properties.strain``, never ``stat_entry``.

5. Curated data and feature flags. A curated fact is served when the items it
   names are present in the build and ``build.has(flag)`` is true: ``perks``
   for ``perk``; ``symbiants`` for ``mob`` and mob sources; ``sources`` for
   item sources. With the flag off the route answers as it does today on a
   build without that data (not found, or an empty list): check
   ``build.has(...)`` before querying. Join curated rows to
   ``revisions(build)`` on the AOID for presence. Every read of ``mob``
   filters ``~t.mob.c.retired``. ``load_sources`` already applies the rules
   for sources. ``symbiant_items`` is derived from items, not curated: its
   rows are served by presence alone (join on ``rev_id``), whatever the flags.

Testing
=======

* Tests of a ported route against the real game data keep working as they
  are: the shared ``client`` fixture needs no change, the route reads schema
  ``cas`` of the development database, and comparing a response with ORM rows
  of the old store still holds because both stores have the same content.
  Such a comparison dies with the old store; prefer asserting the facts.
* A test that needs controlled data uses the ``store`` fixture
  (``app/tests/fixtures/store_fixtures.py``): an empty store in its own schema
  inside a transaction that is rolled back, filled through the real importer
  with ``store.add_build`` and ``store.curate``, served by
  ``store.client(slug)``. ``store.counting_queries()`` shows that a route's
  query count does not grow with its result. ``test_store_read.py`` and
  ``test_interpolation_endpoints.py`` are the models to copy.
* Tests that mock the session or patch a route's helpers test the old
  implementation: replace them, do not adapt them.

Golden comparison for one family
================================

From ``backend/``, with the environment loaded::

    uvicorn app.main:app --port 8031 &
    python tools/golden.py capture http://localhost:8031 /tmp/new
    python tools/golden.py compare <baseline> /tmp/new

``compare`` lists every response that differs, by name (``item/...``,
``search/...``, ``nanos/...``): your family must match on all five builds and
no other name may appear. ``--build SLUG`` on ``capture`` limits a run to one
build while iterating. The baseline covers a few dozen items per build;
before calling a family done, run its requests on a few hundred more items
against a backend serving the old path and compare with
``golden.differences``.

Pitfalls
========

* Join order. PostgreSQL does not reorder more than eight joined tables
  (``join_collapse_limit``) and then follows the query as written. Start
  from the most selective table and keep ``revisions(build)`` free of wide
  joins; fetch what the page shows after paging. The loader reads part
  documents by scalar subquery for the same reason.
* A fresh connection pays about 2 ms of planning on the first wide query;
  measure warm.
* Raw ``text()`` SQL bypasses the schema mapping that lets tests read a
  throwaway store. Compose queries from ``tables``.
* ``stat_entry`` has the stats part only: no stat 23 (it is in ``part_misc``)
  and a nano's own strain, not the effective one.
* ``effect_entry.subject`` is a bigint; ``requirement`` keeps criteria in
  ``position`` order per action, and operators are data, not SQL operators.
* Effect criteria are served in the client's order with repeats; the old
  store served them de-duplicated in no order. The golden comparison treats
  them as a set, nothing else.
* An item's ``id`` is its AOID in every response built here.
* The response cache keys on the route's arguments. In a test with a
  throwaway store use ``store.client``, which clears it.
"""

from app.store.context import Build, get_build, get_store
from app.store.items import (
    ItemRecord,
    actions_response,
    item_document,
    load_effect_formats,
    load_item_details,
    load_item_documents,
    load_records,
    stats_response,
)
from app.store.presence import (
    Page,
    any_of,
    fetch_page,
    fetch_search_page,
    has_atkdef,
    has_effect,
    has_requirement,
    has_stat,
    nano_policy,
    none_of,
    page_fields,
    page_offset,
    present,
    revisions,
)

__all__ = [
    "Build",
    "ItemRecord",
    "Page",
    "actions_response",
    "any_of",
    "fetch_page",
    "fetch_search_page",
    "get_build",
    "get_store",
    "has_atkdef",
    "has_effect",
    "has_requirement",
    "has_stat",
    "item_document",
    "load_effect_formats",
    "load_item_details",
    "load_item_documents",
    "load_records",
    "nano_policy",
    "none_of",
    "page_fields",
    "page_offset",
    "present",
    "revisions",
    "stats_response",
]
