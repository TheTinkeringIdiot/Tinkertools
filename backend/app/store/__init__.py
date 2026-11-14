"""
Read path of the content-addressed store.

Every route that serves game data reads it through this package:

``context``   the build a request names and the session that reads the store
``tables``    the store's tables, for composing queries
``presence``  "the revisions present in this build", filters, pages
``items``     revisions as served items (``ItemRecord``, ``ItemDetail``)
``curated``   symbiants, mobs and perks of a build

The store itself is described where it is defined:
``backend/database/cas/001_store.sql`` and ``002_curated_and_derived.sql``
(how QL, strain, feature flags, source names and retired mobs are served) and
the docstring of ``app/core/parts.py`` (the part documents).

Writing a route
===============

1. Dependencies. A route takes the session and the build::

       db: Session = Depends(get_store), build: Build = Depends(get_build)

   The session has no ``search_path`` and no version: pass ``build`` to every
   query. Name the session ``db``: ``cached_response`` leaves a parameter of
   that name out of its cache key, and keeps ``build`` in it, which is right.
   The ORM models of ``app/models`` describe the old per-version store; they
   do not belong in a store session.

2. A list. Start from ``revisions(build)``, add filters, let ``fetch_page``
   count and page it, load the page::

       r = t.item_revision
       query = revisions(build).where(r.c.item_class == 1, r.c.ql >= min_ql)
       query = query.where(has_stat(t.stat_entry.c.stat == 298,
                                    t.stat_entry.c.value.op("&")(slot) == slot))
       found = fetch_page(db, query, [r.c.ql.desc()], page, page_size)
       items = load_item_details(db, build, rev_ids=found.rev_ids)
       return PaginatedResponse[ItemDetail](
           items=items, **page_fields(found.total, page, page_size))

   * ``revisions(build)`` has one row per item, so no DISTINCT is needed.
   * Filters on a part go through ``has_stat``, ``has_requirement``,
     ``has_effect`` and ``has_atkdef``: EXISTS on the projection of the
     revision's part. Several conditions in one call must hold for the same
     entry; separate calls may be met by different entries.
   * ``any_of`` and ``none_of`` test an integer column against a list of
     values from a request, whatever the values.
   * A route that is not paged executes its query itself and passes the
     revision ids, or the AOIDs, to the loader.

3. Paging. ``fetch_page`` sorts by the keys you give and then by AOID. Pass
   ``[]`` to sort by AOID alone. Never sort by ``rev_id`` or any other
   internal id. A query that matches text (a join to ``part_text`` with a
   pattern or a full-text condition) is paged with ``fetch_search_page``
   instead, same arguments: it finds the matches once, where ``fetch_page``
   would match them twice and can be planned badly (see its docstring). A
   paged query that is not on ``revisions`` computes its OFFSET with
   ``page_offset``. A page past the end, however far, is an empty page with
   the right total.

4. Items. ``load_item_details`` returns ``ItemDetail`` responses in three
   queries for any number of items. ``load_records`` returns ``ItemRecord``
   values (one query) for code that computes on items or builds another
   response shape; ``stats_response`` and ``actions_response`` turn a record
   into response pieces. ``item_document`` is the one place the shape of an
   ``ItemDetail`` is written: derive any other item response from it, as the
   nano lists and the perk lookup do. ``load_item_documents`` returns the
   plain documents for a route that serves too many items to validate each
   (``/weapons/analyze``). A lighter list shape (name, QL, a few columns) does
   not need the loader at all: select the columns in the ``revisions`` query.

5. Nanos. ``item_revision.ql`` is already the curated QL. School,
   professions, level and the effective strain are in ``nano_properties``:
   join it with ``nano_policy(build)``, which picks the row of the build's
   strain policy. Anything that filters, groups or counts by strain reads
   ``nano_properties.strain``, never ``stat_entry``.

6. Curated data and feature flags. A curated fact is served when the items it
   names are present in the build and ``build.has(flag)`` is true: ``perks``
   for ``perk``; ``symbiants`` for ``mob`` and mob sources; ``sources`` for
   item sources. With the flag off the route answers as for a build without
   that data (not found, or an empty list): check ``build.has(...)`` before
   querying. Join curated rows to the build's presence on the AOID.
   ``load_sources`` (``app.store.items``) already applies the rules for
   sources. ``symbiant_items`` is derived from items, not curated: its rows
   are served by presence alone (join on ``rev_id``), whatever the flags.

7. Retired mobs. A mob that left the curated data keeps its row, so its id is
   never given to another mob, with ``retired`` set. Every read of ``mob``
   filters ``~t.mob.c.retired``.

Testing
=======

* A test that needs data it controls uses the ``store`` fixture
  (``app/tests/fixtures/store_fixtures.py``): an empty store in its own schema
  inside a transaction that is rolled back, filled through the real importer
  with ``store.add_build`` and ``store.curate``, served by
  ``store.client(slug)``. This is the default for a new test: several builds
  of one item, feature flags, an exact page of results, a rule the real data
  cannot show in isolation. ``store.counting_queries()`` shows that a route's
  query count does not grow with its result. ``test_store_read.py`` and
  ``test_item_search.py`` are the models to copy.
* A test of a route against the real game data uses the ``client`` fixture,
  which reads the development store, and takes the values it expects from the
  same store through this package (the ``store_db`` and ``build`` fixtures of
  ``app/tests/conftest.py``): raw stats and criteria from ``tables``, items
  from ``load_records``. It never reads the old per-version store.
* Assert what a user of the API sees. Do not mock the session or patch a
  route's helpers.

Golden comparison
=================

``tools/golden.py`` records the responses of a fixed set of requests on five
builds and compares two recordings; its docstring lists what a comparison
ignores. A change that is not meant to change responses is checked against a
baseline captured before it. From ``backend/``, with the environment loaded::

    uvicorn app.main:app --port 8031 &
    python tools/golden.py capture http://localhost:8031 /tmp/new
    python tools/golden.py compare <baseline> /tmp/new

``compare`` lists every response that differs, by name (``item/...``,
``search/...``, ``nanos/...``) and exits 1 if any does. ``--build SLUG`` on
``capture`` limits a run to one build while iterating. The baseline covers a
few dozen items per build: it catches a change of shape or of a rule, not
every item a change could touch, so a new rule still needs its own test.

Pitfalls
========

* Join order. PostgreSQL does not reorder more than eight joined tables
  (``join_collapse_limit``) and then follows the query as written. Start
  from the most selective table and keep ``revisions(build)`` free of wide
  joins; fetch what the page shows after paging. The loader reads part
  documents by scalar subquery for the same reason.
* ORDER BY with LIMIT on a condition the planner cannot estimate (a text
  pattern above all) invites it to walk an index in sort order and hope to
  stop early. Use ``fetch_search_page``, and measure a rare term, a common
  one and one that matches nothing.
* A fresh connection pays about 2 ms of planning on the first wide query;
  measure warm.
* Raw ``text()`` SQL bypasses the schema mapping that lets tests read a
  throwaway store. Compose queries from ``tables``.
* ``stat_entry`` has the stats part only: no stat 23 (it is in ``part_misc``)
  and a nano's own strain, not the effective one.
* ``effect_entry.subject`` is a bigint; ``requirement`` keeps criteria in
  ``position`` order per action, and operators are data, not SQL operators.
* Effect criteria are served in the client's order, repeats included.
* An item's ``id`` is its AOID in every response built here.
* An id or a page number from a request can be any integer. ``any_of``,
  ``none_of`` and ``page_offset`` keep one that no column can hold from
  reaching the database as an error.
* The response cache keys on the route's arguments and holds the serialised
  body (``app/core/decorators.py``). In a test with a throwaway store use
  ``store.client``, which clears it.
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
