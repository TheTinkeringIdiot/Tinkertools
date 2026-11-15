"""
The net difference between two builds, worked out in memory.

``compare_page`` answers ``/compare/{base}``: the items whose revision in one
build is not their revision in the other, classified, filtered, sorted and
paged as ``fetch_changes`` does for the change log of one build. No build
notes: a note belongs to one step of the log.

Classifying a comparison means looking up the parts and the relevance digests
of both revisions of every changed item: 160,000 revisions for two builds far
apart, which costs the database 350 to 450 ms in one statement however it is
written, and sorting 120,000 names for a page far down the list as much
again. Here that work is done once:

``RevisionFacts``
    What classifying and listing read of every revision of the store: its
    part ids, its relevance digests (``revision_relevance``,
    database/cas/003_change_analysis.sql), QL, item class, nano flag, and the
    place of its name in name order. Revisions are immutable, so the facts
    are loaded once per process (``preload``, at startup) and only added to
    afterwards; 72 bytes a revision, 19 MB for the 264,000 of today's store.
    The process grows by more than that: 27 MB measured (resident size
    97 MB with the application imported, 124 MB with the facts loaded), and
    a server is at 134 MB when it is ready. Loading passes through far more
    (224 MB at the peak), which is handed back to the system when the facts
    are in place (``_release_freed_memory``); kept, it left a server at
    167 MB.

``Comparison``
    One pair of builds: every changed item with its kind, both revisions,
    the parts that differ and the relevance of the change, in name order,
    and the summary of the pair. Computed from one statement (the two
    presences, joined) and the facts, by the rule the importer applies to
    the change log (``change_analysis.relevance_sql``) in 50 to 200 ms; 24
    bytes a changed item, 3 MB for 123,000. It is kept in the response cache
    under the two builds for as long as a response is, counted against the
    cache's byte budget with its real size, and computed once however many
    requests ask for the pair at the same time.

A page is then a filter and a slice of the comparison. Only the filters that
read what the comparison does not hold go to the database, for the revisions
of the two builds that pass them: a name search, and the conditions on the
parts of a revision (profession, slot).
"""

from __future__ import annotations

import ctypes
import gc
import logging
import sys
import threading
import time
from array import array
from collections import Counter, OrderedDict
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple

from sqlalchemy import Integer, cast, func, select
from sqlalchemy.dialects.postgresql import aggregate_order_by
from sqlalchemy.orm import Session
from sqlalchemy.sql import text
from sqlalchemy.sql.expression import ColumnElement, literal_column

from app.core.cache import CACHE_TTL, cache_key_for_query, cache_service
from app.core.change_rules import (
    CLASSES,
    RELEVANCE_BITS,
    TEXT,
    RelevanceRules,
    default_rules,
    relevance_mask,
)
from app.store import tables as t
from app.store.changes import (
    KIND_CODES,
    PART_BITS,
    PART_COLUMNS,
    ChangeFilters,
    ChangePage,
    ChangeRow,
    name_contains,
    warn_of_stale_rules,
)
from app.store.context import Build, StoreSession, store_schema
from app.store.presence import page_offset, present, revisions

logger = logging.getLogger(__name__)

DIGESTS = (*CLASSES, "effects")
ADDED, REMOVED, CHANGED = (ord(code) for code in "ARC")
# Stores whose facts are held: the one the process serves and, in a test run,
# the throwaway store of the test before.
STORES_HELD = 2
# A sort key is the name's rank and the AOID in one integer.
_AOID_SPAN = 2**32
_NO_BYTES = literal_column("''::bytea")
# Revisions read in one row when the facts are loaded.
_FACTS_CHUNK = 8192


def _packed(expression: ColumnElement, wide: bool = False) -> ColumnElement:
    """Every value of an integer expression in one ``bytea``, four bytes each
    (eight when ``wide``): 100,000 rows cost what a few rows do to fetch."""
    send = func.int8send if wide else func.int4send
    return func.string_agg(send(expression), _NO_BYTES)


def _unpacked(packed: Optional[bytes], typecode: str = "i") -> array:
    values = array(typecode)
    if packed is not None:
        values.frombytes(bytes(packed))
        if sys.byteorder == "little":
            values.byteswap()
    return values


# ---------------------------------------------------------------------------
# What is known of every revision
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class RevisionFacts:
    """Columns of every revision of a store, read by row number;
    ``row_of[rev_id]`` is a revision's row."""

    # What the facts were read from: see ``_signature``.
    signature: Tuple[Any, ...]
    last_rev_id: int
    row_of: array
    # {part name: the part's id, 0 for none}
    parts: Dict[str, array]
    # {digest name: the digest}, and whether the revision has digests at all
    digests: Dict[str, array]
    digested: bytes
    ql: array
    item_class: array
    is_nano: bytes
    # The place of a text's name among all names in the database's order,
    # equal for equal names, by ``text_id``.
    name_rank: array

    @property
    def size(self) -> int:
        arrays = [
            self.row_of,
            *self.parts.values(),
            *self.digests.values(),
            self.ql,
            self.item_class,
            self.name_rank,
        ]
        return sum(len(values) * values.itemsize for values in arrays) + 2 * len(
            self.digested
        )


def _signature(db: Session) -> Tuple[Any, ...]:
    """What the facts depend on, cheap to read: the newest revision and text,
    the rules the digests were derived from, and the curated nano QLs (the
    one column of a revision that an import can rewrite)."""
    state, overlay = t.store_state, t.nano_overlay
    return tuple(
        db.execute(
            select(
                select(func.max(t.item_revision.c.rev_id)).scalar_subquery(),
                select(func.max(t.part_text.c.text_id)).scalar_subquery(),
                select(
                    func.string_agg(
                        state.c.name + "=" + state.c.value,
                        aggregate_order_by(literal_column("','"), state.c.name),
                    )
                ).scalar_subquery(),
                select(
                    func.sum(overlay.c.aoid.op("#")(overlay.c.ql * 7919))
                ).scalar_subquery(),
                select(func.count()).select_from(overlay).scalar_subquery(),
            )
        ).one()
    )


def _revisions_after(db: Session, last_rev_id: int) -> List[array]:
    """The columns of ``RevisionFacts`` for the revisions after
    ``last_rev_id``: rev_id, the parts, QL, class, nano flag, the digests and
    whether there are any.

    They are read ``_FACTS_CHUNK`` revisions a row. A connection keeps a
    buffer the size of the largest row it ever received for as long as it
    stays in the pool: 40 MB when every revision came in one row.
    """
    revision, digests = t.item_revision, t.revision_relevance
    rows = db.execute(
        select(
            _packed(revision.c.rev_id),
            *(
                _packed(func.coalesce(revision.c[PART_COLUMNS[part]], 0))
                for part in PART_BITS
            ),
            _packed(revision.c.ql),
            _packed(revision.c.item_class),
            _packed(cast(revision.c.is_nano, Integer)),
            _packed(cast(digests.c.rev_id.isnot(None), Integer)),
            *(
                _packed(func.coalesce(digests.c[name], 0), wide=True)
                for name in DIGESTS
            ),
        )
        .select_from(revision.outerjoin(digests, digests.c.rev_id == revision.c.rev_id))
        .where(revision.c.rev_id > last_rev_id)
        .group_by(revision.c.rev_id / _FACTS_CHUNK)
    ).all()
    integers = len(PART_BITS) + 5
    columns = [array("i") for _ in range(integers)] + [array("q") for _ in DIGESTS]
    for row in rows:
        for column, packed in zip(columns, row, strict=True):
            column.extend(_unpacked(packed, column.typecode))
    return columns


def _name_ranks(db: Session) -> array:
    """``RevisionFacts.name_rank`` of the store.

    The names are read in the order of their index: sorting 129,000 names
    under the database's collation takes three times as long, and the
    planner, which does not know the table is in memory, would sort.
    """
    texts = t.part_text
    ranked = select(
        texts.c.text_id,
        func.dense_rank().over(order_by=texts.c.name).label("rank"),
    ).subquery()
    db.execute(text("SET LOCAL enable_sort = off"))
    try:
        text_ids, ranks = (
            _unpacked(column)
            for column in db.execute(
                select(_packed(ranked.c.text_id), _packed(cast(ranked.c.rank, Integer)))
            ).one()
        )
    finally:
        db.execute(text("RESET enable_sort"))
    by_text = array("i", bytes(4 * (max(text_ids, default=0) + 1)))
    for text_id, rank in zip(text_ids, ranks):
        by_text[text_id] = rank
    return by_text


def _load_facts(
    db: Session, signature: Tuple[Any, ...], held: Optional[RevisionFacts]
) -> RevisionFacts:
    """The facts of the store as of ``signature``. Facts held from before are
    added to when nothing but new revisions and texts sets them apart."""
    last_rev_id, last_text_id, *derived = signature
    last_rev_id = last_rev_id or 0
    grown = (
        held is not None
        and list(held.signature[2:]) == derived
        and held.last_rev_id <= last_rev_id
    )
    rev_ids, *columns = _revisions_after(db, held.last_rev_id if grown else 0)
    if grown:
        row_of = array("i", held.row_of)
        first_row = len(held.ql)
    else:
        row_of, first_row = array("i"), 0
    row_of.extend(array("i", [-1]) * (last_rev_id + 1 - len(row_of)))
    for row, rev_id in enumerate(rev_ids, first_row):
        if rev_id <= last_rev_id:
            row_of[rev_id] = row

    def column(before: Optional[Sequence[int]], added: array) -> array:
        return added if before is None else array(added.typecode, before) + added

    parts = {
        part: column(held.parts[part] if grown else None, columns[n])
        for n, part in enumerate(PART_BITS)
    }
    ql, item_class, is_nano, digested = columns[len(parts) : len(parts) + 4]
    digests = {
        name: column(held.digests[name] if grown else None, columns[len(parts) + 4 + n])
        for n, name in enumerate(DIGESTS)
    }
    return RevisionFacts(
        signature=signature,
        last_rev_id=last_rev_id,
        row_of=row_of,
        parts=parts,
        digests=digests,
        digested=(held.digested if grown else b"") + bytes(digested.tolist()),
        ql=column(held.ql if grown else None, ql),
        item_class=column(held.item_class if grown else None, item_class),
        is_nano=(held.is_nano if grown else b"") + bytes(is_nano.tolist()),
        name_rank=(
            held.name_rank
            if grown and held.signature[1] == last_text_id
            else _name_ranks(db)
        ),
    )


def _release_freed_memory() -> None:
    """Hand the memory that loading the facts used and freed back to the
    system: what the driver and the result rows took, which the collector
    and then the C library would otherwise keep for the process (about
    90 MB). Nothing to trim where the C library is not glibc."""
    gc.collect()
    try:
        ctypes.CDLL(None).malloc_trim(0)
    except (AttributeError, OSError):
        pass


class _FactsOfStores:
    """The facts of the stores this process reads, by schema."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._held: "OrderedDict[str, RevisionFacts]" = OrderedDict()

    def of(self, db: Session) -> RevisionFacts:
        """The facts of the store ``db`` reads, as of now: loaded, or added
        to, when the store is not what they were read from."""
        schema = store_schema(db)
        with self._lock:
            signature = _signature(db)
            held = self._held.get(schema)
            if held is None or held.signature != signature:
                started = time.perf_counter()
                held = _load_facts(db, signature, held)
                _release_freed_memory()
                logger.info(
                    f"Facts of {len(held.ql)} revisions of {schema} "
                    f"({held.size / 1e6:.1f} MB) "
                    f"in {time.perf_counter() - started:.2f} s"
                )
                self._held[schema] = held
            self._held.move_to_end(schema)
            while len(self._held) > STORES_HELD:
                self._held.popitem(last=False)
            return held


facts_of_stores = _FactsOfStores()


def preload() -> None:
    """Load the facts of the store the process serves, so that no request
    waits for them, and say so in the log when the store was analysed with
    other rules files than the process read. Called once, when the
    application starts; a store that cannot be read is left to the first
    request."""
    try:
        with StoreSession() as db:
            warn_of_stale_rules(db)
            facts_of_stores.of(db)
    except Exception as error:
        logger.warning(f"Revision facts not preloaded: {error}")


# ---------------------------------------------------------------------------
# One pair of builds
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Comparison:
    """The changed items of a pair of builds, in the order of the name they
    are listed by and then of the AOID. Columns are read by row number."""

    aoids: array
    # 0 for an item the side does not have
    old_revs: array
    new_revs: array
    # ``ADDED``, ``REMOVED`` or ``CHANGED``
    kinds: bytes
    # masks of ``PART_BITS`` and ``RELEVANCE_BITS``
    parts: bytes
    relevance: bytes
    # of the revision a row is listed by: the newer, the older when removed
    qls: array
    item_classes: array
    nanos: bytes
    summary: Dict[str, Any]

    def __len__(self) -> int:
        return len(self.aoids)

    @property
    def size(self) -> int:
        """Bytes the comparison holds."""
        arrays = (self.aoids, self.old_revs, self.new_revs, self.qls, self.item_classes)
        return sum(len(values) * values.itemsize for values in arrays) + 4 * len(self)


def _changed_presence(db: Session, base: Build, build: Build) -> List[array]:
    """``[aoids, revisions in base, revisions in build]`` of the items whose
    revisions differ; 0 where a build does not have the item."""
    before, after = t.item_presence.alias("before"), t.item_presence.alias("after")
    old = (
        select(before.c.aoid, before.c.rev_id).where(present(base, before))
    ).subquery("old_presence")
    new = (select(after.c.aoid, after.c.rev_id).where(present(build, after))).subquery(
        "new_presence"
    )
    row = db.execute(
        select(
            _packed(func.coalesce(new.c.aoid, old.c.aoid)),
            _packed(func.coalesce(old.c.rev_id, 0)),
            _packed(func.coalesce(new.c.rev_id, 0)),
        )
        .select_from(old.join(new, old.c.aoid == new.c.aoid, full=True))
        .where(old.c.rev_id.is_distinct_from(new.c.rev_id))
    ).one()
    return [_unpacked(column) for column in row]


def _bit_counts(masks: bytes, bits: Dict[str, int]) -> Dict[str, int]:
    """How many of ``masks`` have each of ``bits``."""
    counted = Counter(masks)
    return {
        name: sum(count for mask, count in counted.items() if mask & bit)
        for name, bit in bits.items()
    }


def _compare(
    db: Session,
    facts: RevisionFacts,
    base: Build,
    build: Build,
    rules: RelevanceRules,
) -> Comparison:
    aoids, old_revs, new_revs = _changed_presence(db, base, build)
    if max(max(old_revs, default=0), max(new_revs, default=0)) > facts.last_rev_id:
        facts = facts_of_stores.of(db)
    row_of = facts.row_of
    old_rows = [row_of[rev_id] if rev_id else -1 for rev_id in old_revs]
    new_rows = [row_of[rev_id] if rev_id else -1 for rev_id in new_revs]
    shown = [new if new >= 0 else old for old, new in zip(old_rows, new_rows)]

    text_ids, name_rank = facts.parts["text"], facts.name_rank
    keys = [
        name_rank[text_ids[row]] * _AOID_SPAN + aoid for row, aoid in zip(shown, aoids)
    ]
    order = sorted(range(len(aoids)), key=keys.__getitem__)

    compared = [
        (facts.parts[part], bit) for part, bit in PART_BITS.items() if part != "text"
    ]
    effects_bit = PART_BITS["effects"]
    classes = [(facts.digests[name], RELEVANCE_BITS[name]) for name in CLASSES]
    same_effects, digested = facts.digests["effects"], facts.digested
    text_bit, event_bit = PART_BITS["text"], rules.bit("event")
    added_bit, removed_bit = rules.bit("added"), rules.bit("removed")

    kinds, parts, relevance = (bytearray(len(order)) for _ in range(3))
    for at, item in enumerate(order):
        old, new = old_rows[item], new_rows[item]
        if old < 0:
            kinds[at], relevance[at] = ADDED, added_bit
        elif new < 0:
            kinds[at], relevance[at] = REMOVED, removed_bit
        else:
            kinds[at] = CHANGED
            differs = relevant = 0
            if text_ids[old] != text_ids[new]:
                differs, relevant = text_bit, TEXT
            for ids, bit in compared:
                if ids[old] != ids[new]:
                    differs |= bit
            if digested[old] and digested[new]:
                for digests, bit in classes:
                    if digests[old] != digests[new]:
                        relevant |= bit
                if differs & effects_bit and same_effects[old] == same_effects[new]:
                    relevant |= event_bit
            parts[at], relevance[at] = differs, relevant

    listed = [shown[item] for item in order]
    kinds, parts, relevance = bytes(kinds), bytes(parts), bytes(relevance)
    return Comparison(
        aoids=array("i", [aoids[item] for item in order]),
        old_revs=array("i", [old_revs[item] for item in order]),
        new_revs=array("i", [new_revs[item] for item in order]),
        kinds=kinds,
        parts=parts,
        relevance=relevance,
        qls=array("i", [facts.ql[row] for row in listed]),
        item_classes=array("i", [facts.item_class[row] for row in listed]),
        nanos=bytes([facts.is_nano[row] for row in listed]),
        summary={
            "total": len(order),
            "by_kind": {
                name: kinds.count(code.encode()) for name, code in KIND_CODES.items()
            },
            "by_part": _bit_counts(parts, PART_BITS),
            "by_relevance": _bit_counts(relevance, RELEVANCE_BITS),
            "noted": 0,
        },
    )


def comparison_of(db: Session, base: Build, build: Build) -> Comparison:
    """The comparison of ``base`` with ``build``, from the cache when it is
    there. Requests that ask for a pair while it is being computed wait for
    that one computation."""
    key = cache_key_for_query(
        "comparison",
        store=store_schema(db),
        old=(base.build_id, base.branch, base.ordinal),
        new=(build.build_id, build.branch, build.ordinal),
    )

    def compute() -> Comparison:
        started = time.perf_counter()
        found = _compare(
            db, facts_of_stores.of(db), base, build, default_rules().relevance
        )
        logger.info(
            f"Comparison of {base.slug} with {build.slug}: {len(found)} changes, "
            f"{found.size / 1e6:.1f} MB in {time.perf_counter() - started:.3f} s"
        )
        return found

    return cache_service.get_or_compute(
        key, compute, CACHE_TTL["changes_compare"], size_of=lambda found: found.size
    )


# ---------------------------------------------------------------------------
# A page
# ---------------------------------------------------------------------------


def _revisions_where(
    db: Session,
    base: Build,
    build: Build,
    conditions: Sequence[ColumnElement],
    on_text: bool = False,
) -> Set[int]:
    """The revisions of either build that meet ``conditions`` on
    ``item_revision``, and on ``part_text`` when ``on_text``."""
    found: Set[int] = set()
    for side in (base, build) if base != build else (build,):
        matching = revisions(side)
        if on_text:
            matching = matching.join(
                t.part_text, t.part_text.c.text_id == t.item_revision.c.text_id
            )
        matching = matching.where(*conditions).subquery()
        found.update(
            _unpacked(
                db.execute(
                    select(_packed(matching.c.rev_id)).select_from(matching)
                ).scalar_one()
            )
        )
    return found


def _sorted(comparison: Comparison, rows: Sequence[int], sort: str) -> Sequence[int]:
    """``rows``, which are in name order, in the order of ``sort``; ties end
    on the AOID."""
    if sort == "name":
        return rows
    by_aoid = sorted(rows, key=comparison.aoids.__getitem__)
    return sorted(by_aoid, key=comparison.qls.__getitem__) if sort == "ql" else by_aoid


def compare_page(
    db: Session,
    base: Build,
    build: Build,
    filters: ChangeFilters,
    sort: str,
    page: int,
    page_size: int,
) -> ChangePage:
    """One page of the items whose revision in ``build`` is not their
    revision in ``base``, with the summary of the whole comparison.

    Rows, filters, sort and counts are those of ``fetch_changes``. A row is
    listed, filtered and sorted by its newer revision (the older for a
    removed item); a name search also matches the older name. No change of a
    comparison has a build note, so asking for one note's changes finds none.
    """
    if filters.among is not None:
        raise ValueError("A comparison cannot be narrowed to a set of AOIDs")
    comparison = comparison_of(db, base, build)
    rows: Sequence[int] = range(len(comparison))
    if filters.note_id is not None:
        rows = []

    def keep(column: Sequence[int], passes) -> None:
        nonlocal rows
        rows = [row for row in rows if passes(column[row])]

    if filters.kinds:
        keep(
            comparison.kinds,
            {ord(KIND_CODES[name]) for name in filters.kinds}.__contains__,
        )
    if filters.parts:
        mask = sum(PART_BITS[name] for name in set(filters.parts))
        keep(comparison.parts, mask.__and__)
    if filters.relevance:
        mask = relevance_mask(sorted(set(filters.relevance)))
        keep(comparison.relevance, mask.__and__)
    if filters.is_nano is not None:
        keep(comparison.nanos, (1 if filters.is_nano else 0).__eq__)
    if filters.item_class is not None:
        keep(comparison.item_classes, filters.item_class.__eq__)
    if filters.min_ql is not None:
        keep(comparison.qls, filters.min_ql.__le__)
    if filters.max_ql is not None:
        keep(comparison.qls, filters.max_ql.__ge__)

    old_revs, new_revs = comparison.old_revs, comparison.new_revs
    if filters.search and rows:
        named = _revisions_where(
            db,
            base,
            build,
            [name_contains(t.part_text, filters.search)],
            on_text=True,
        )
        rows = [row for row in rows if new_revs[row] in named or old_revs[row] in named]
    if filters.item_conditions and rows:
        passing = _revisions_where(db, base, build, filters.item_conditions)
        rows = [row for row in rows if (new_revs[row] or old_revs[row]) in passing]

    rows = _sorted(comparison, rows, sort)
    first = page_offset(page, page_size)
    return ChangePage(
        rows=[
            ChangeRow(
                aoid=comparison.aoids[row],
                kind=chr(comparison.kinds[row]),
                old_rev_id=old_revs[row] or None,
                new_rev_id=new_revs[row] or None,
                parts_changed=comparison.parts[row],
                relevance=comparison.relevance[row],
                note_id=None,
            )
            for row in rows[first : first + page_size]
        ],
        total=len(rows),
        summary=comparison.summary,
        notes={},
    )
