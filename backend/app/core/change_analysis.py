"""
What the importer derives about the change log.

Tables: backend/database/cas/003_change_analysis.sql. Rules:
app/core/change_rules.py (``change_relevance.toml``, ``build_notes.toml``).
Field-level diff: app/core/item_diff.py.

Three things are derived, all reproducible from the store and the two files:

``item_change.relevance``
    From ``revision_relevance``: per revision, one digest per relevance class
    of what the revision holds in that class. The relevance of a change is
    the set of classes whose digests differ, so classifying the log is one
    SQL statement and reads no part. The digests of a revision are computed
    once, here, from its part documents.

``item_change.note_id`` and ``build_note``
    The notes of ``build_notes.toml`` whose build is in the store, and the
    changes each explains. This needs the field-level diff of every changed
    item of a build that has notes.

``build_transition`` and ``change_transition``
    The field transitions shared by at least two changed items of a build,
    and the items that have each.

:func:`sync` brings all three in line at the start of an import run and does
the expensive parts only when a rules file (or the engine) changed;
:func:`analyze_build` does the same for the one build an import adds.
Nothing commits here. The caller owns the transaction.
"""

from __future__ import annotations

import hashlib
import json
from collections import Counter, defaultdict
from typing import Any, Dict, Iterable, Iterator, List, Optional, Sequence, Tuple

import psycopg
from psycopg import sql
from psycopg.types.json import Jsonb

from app.core import item_diff
from app.core.change_rules import (
    CLASSES,
    RELEVANCE_BITS,
    TEXT,
    ChangeRules,
    Note,
    NoteRules,
    RelevanceRules,
)
from app.core.item_diff import MISC_FIELDS, Transition

# Bump when the diff engine or what is derived from it changes, so stores
# analysed by the earlier code are analysed again.
ANALYSIS_VERSION = "1"

# A transition is kept in build_transition when this many items share it.
MIN_SHARED_ITEMS = 2

STATE_RELEVANCE = "relevance_rules"
STATE_ANALYSIS = "change_analysis"

# (branch, ordinal) of one build, or None for every build.
Scope = Optional[Tuple[str, int]]

_PART_COLUMNS = (
    "text_id",
    "stats_id",
    "effects_id",
    "actions_id",
    "atkdef_id",
    "misc_id",
)
_PART_OF_COLUMN = {
    "text_id": "text",
    "stats_id": "stats",
    "effects_id": "effects",
    "actions_id": "actions",
    "atkdef_id": "atkdef",
    "misc_id": "misc",
}
_DOC_TABLES = {
    "stats": ("part_stats", "stats_id"),
    "effects": ("part_effects", "effects_id"),
    "actions": ("part_actions", "actions_id"),
    "atkdef": ("part_atkdef", "atkdef_id"),
    "misc": ("part_misc", "misc_id"),
}


# ---------------------------------------------------------------------------
# Relevance digests
# ---------------------------------------------------------------------------


def _digest(value: Any) -> int:
    """A stable signed 64-bit digest of a JSON value."""
    data = json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return int.from_bytes(
        hashlib.blake2b(data, digest_size=8).digest(), "big", signed=True
    )


Slices = Tuple[int, ...]
_EMPTY: Slices = (0,) * len(CLASSES)


def _slices(members: Dict[str, List[Any]]) -> Slices:
    return tuple(
        _digest(sorted(members[name])) if members.get(name) else 0 for name in CLASSES
    )


def stats_slices(rules: RelevanceRules, doc: Optional[Sequence[Sequence[int]]]):
    """Per class, a digest of the stats of that class."""
    members: Dict[str, List[Any]] = defaultdict(list)
    for stat, value in doc or ():
        members[rules.stat_class(stat)].append((stat, value))
    return _slices(members)


def effects_slices(rules: RelevanceRules, doc: Optional[Sequence[Dict[str, Any]]]):
    """Per class, a digest of the effects whose type has that class, without
    the event they hang on and without their rendered description."""
    members: Dict[str, List[Any]] = defaultdict(list)
    for event in doc or ():
        for effect in event["effects"]:
            content = {k: v for k, v in effect.items() if k != "description"}
            members[rules.effect_class(effect["spell_id"])].append(
                json.dumps(content, sort_keys=True, separators=(",", ":"))
            )
    return _slices(members)


def misc_slices(rules: RelevanceRules, doc: Optional[Dict[str, Any]]):
    """Per class, a digest of the misc fields of that class."""
    members: Dict[str, List[Any]] = defaultdict(list)
    for name in MISC_FIELDS:
        if doc and name in doc:
            members[rules.changes[name]].append(
                json.dumps([name, doc[name]], sort_keys=True)
            )
    return _slices(members)


def revision_digests(
    rules: RelevanceRules,
    stats: Slices,
    effects: Slices,
    misc: Slices,
    actions_id: Optional[int],
    atkdef_id: Optional[int],
) -> Tuple[int, int, int, int]:
    """``(gameplay, economy, cosmetic, effects)`` of one revision, from the
    slices of its parts. Parts classified as a whole enter by their id, which
    is as good as their content within one store."""
    per_class = []
    for index, name in enumerate(CLASSES):
        per_class.append(
            _digest(
                [
                    stats[index],
                    effects[index],
                    misc[index],
                    actions_id if rules.changes["actions"] == name else None,
                    atkdef_id if rules.changes["attack_defense"] == name else None,
                ]
            )
        )
    return (*per_class, _digest(list(effects)))


def _documents(
    conn: psycopg.Connection, part: str, ids: Iterable[Optional[int]]
) -> Dict[int, Any]:
    wanted = sorted({i for i in ids if i is not None})
    if not wanted:
        return {}
    table, column = _DOC_TABLES[part]
    return dict(
        conn.execute(
            sql.SQL(
                "SELECT {column}, doc FROM {table} WHERE {column} = ANY(%s)"
            ).format(column=sql.Identifier(column), table=sql.Identifier(table)),
            (wanted,),
        ).fetchall()
    )


def ensure_revision_relevance(conn: psycopg.Connection, rules: RelevanceRules) -> int:
    """Add the ``revision_relevance`` rows that are missing. Returns how many."""
    revisions = conn.execute("""
        SELECT r.rev_id, r.stats_id, r.effects_id, r.misc_id, r.actions_id, r.atkdef_id
        FROM item_revision r
        WHERE NOT EXISTS (SELECT 1 FROM revision_relevance d WHERE d.rev_id = r.rev_id)
        """).fetchall()
    if not revisions:
        return 0
    slices: Dict[str, Dict[Optional[int], Slices]] = {}
    for part, column, function in (
        ("stats", 1, stats_slices),
        ("effects", 2, effects_slices),
        ("misc", 3, misc_slices),
    ):
        documents = _documents(conn, part, (row[column] for row in revisions))
        slices[part] = {key: function(rules, doc) for key, doc in documents.items()}
        slices[part][None] = _EMPTY
    with conn.cursor().copy(
        "COPY revision_relevance (rev_id, gameplay, economy, cosmetic, effects) "
        "FROM STDIN"
    ) as copy:
        for rev_id, stats_id, effects_id, misc_id, actions_id, atkdef_id in revisions:
            copy.write_row(
                (rev_id,)
                + revision_digests(
                    rules,
                    slices["stats"][stats_id],
                    slices["effects"][effects_id],
                    slices["misc"][misc_id],
                    actions_id,
                    atkdef_id,
                )
            )
    # The planner knows nothing of rows copied in this transaction, and the
    # statements that follow join on them.
    conn.execute("ANALYZE revision_relevance")
    return len(revisions)


def relevance_sql(rules: RelevanceRules) -> sql.Composable:
    """The relevance of the change between two revisions of an item as SQL,
    over these aliases: ``ro`` and ``rn`` the old and new ``item_revision``,
    ``o`` and ``n`` their ``revision_relevance``."""
    classes = sql.SQL(" | ").join(
        sql.SQL("CASE WHEN o.{name} <> n.{name} THEN {bit} ELSE 0 END").format(
            name=sql.Identifier(name), bit=sql.Literal(RELEVANCE_BITS[name])
        )
        for name in CLASSES
    )
    return sql.SQL("""(
            {classes}
            | CASE WHEN ro.text_id <> rn.text_id THEN {text} ELSE 0 END
            | CASE WHEN ro.effects_id IS DISTINCT FROM rn.effects_id
                        AND o.effects = n.effects THEN {event} ELSE 0 END
        )""").format(
        classes=classes, text=sql.Literal(TEXT), event=sql.Literal(rules.bit("event"))
    )


def _in_scope(scope: Scope, alias: str = "c") -> sql.Composable:
    if scope is None:
        return sql.SQL("true")
    return sql.SQL("{a}.branch = {branch} AND {a}.ordinal = {ordinal}").format(
        a=sql.Identifier(alias),
        branch=sql.Literal(scope[0]),
        ordinal=sql.Literal(scope[1]),
    )


def classify(
    conn: psycopg.Connection, rules: RelevanceRules, scope: Scope = None
) -> int:
    """Set ``item_change.relevance`` of every change (of one build with
    ``scope``) to what the rules give. Writes only the rows that differ and
    returns their number. ``revision_relevance`` must be complete.

    The statements reach the revisions of each change by primary key, so they
    do not depend on the planner knowing rows written in this transaction.
    """
    written = conn.execute(
        sql.SQL("""
            UPDATE item_change c SET relevance = {relevance}
            FROM item_revision ro, item_revision rn,
                 revision_relevance o, revision_relevance n
            WHERE c.kind = 'C' AND {scope}
              AND ro.rev_id = c.old_rev_id AND rn.rev_id = c.new_rev_id
              AND o.rev_id = c.old_rev_id AND n.rev_id = c.new_rev_id
              AND c.relevance IS DISTINCT FROM {relevance}
            """).format(relevance=relevance_sql(rules), scope=_in_scope(scope))
    ).rowcount
    for kind, change in (("A", "added"), ("R", "removed")):
        written += conn.execute(
            sql.SQL("""
                UPDATE item_change c SET relevance = {bit}
                WHERE c.kind = {kind} AND {scope}
                  AND c.relevance IS DISTINCT FROM {bit}
                """).format(
                bit=sql.Literal(rules.bit(change)),
                kind=sql.Literal(kind),
                scope=_in_scope(scope),
            )
        ).rowcount
    return written


# ---------------------------------------------------------------------------
# Field-level diffs of the change log
# ---------------------------------------------------------------------------

_DIFF_OF_PART = {
    "text": item_diff.diff_text,
    "stats": item_diff.diff_stats,
    "effects": item_diff.diff_effects,
    "actions": item_diff.diff_actions,
    "atkdef": item_diff.diff_atkdef,
    "misc": item_diff.diff_misc,
}


class ChangeDiffs:
    """Field-level diffs of changed items, computed once per pair of parts.

    ``rows`` are ``(key, old part ids, new part ids)`` with the ids in
    ``_PART_COLUMNS`` order; the documents of the parts that differ are read
    in one query per part.
    """

    def __init__(self, conn: psycopg.Connection, rows: Sequence[Tuple]):
        self._rows = rows
        wanted: Dict[str, set] = {part: set() for part in _PART_OF_COLUMN.values()}
        for _, old, new in rows:
            for part, before, after in zip(wanted, old, new):
                if before != after:
                    wanted[part].update((before, after))
        self._documents: Dict[str, Dict[int, Any]] = {
            part: _documents(conn, part, wanted[part]) for part in _DOC_TABLES
        }
        text_ids = sorted(i for i in wanted["text"] if i is not None)
        self._documents["text"] = {
            text_id: {"name": name, "description": description}
            for text_id, name, description in conn.execute(
                "SELECT text_id, name, description FROM part_text "
                "WHERE text_id = ANY(%s)",
                (text_ids,),
            )
        }
        self._memo: Dict[Tuple, Any] = {}

    def _part_diff(self, part: str, old: Optional[int], new: Optional[int]) -> Any:
        key = (part, old, new)
        if key not in self._memo:
            documents = self._documents[part]
            self._memo[key] = _DIFF_OF_PART[part](
                documents.get(old), documents.get(new)
            )
        return self._memo[key]

    def __iter__(self) -> Iterator[Tuple[Any, Dict[str, List[Dict[str, Any]]]]]:
        """``(key, diff)`` per row, the diff shaped as ``item_diff.diff_parts``."""
        for key, old, new in self._rows:
            diff: Dict[str, Any] = {part: [] for part in item_diff.PARTS}
            for part, before, after in zip(_PART_OF_COLUMN.values(), old, new):
                if before == after:
                    continue
                changes = self._part_diff(part, before, after)
                if part == "atkdef":
                    diff.update(changes)
                else:
                    diff[part] = changes
            yield key, diff


def changed_rows(conn: psycopg.Connection, scope: Scope = None) -> List[Tuple]:
    """``((branch, ordinal, aoid), old part ids, new part ids)`` of every
    changed item of the log, or of one build."""
    columns = sql.SQL(", ").join(
        sql.SQL("{}.{}").format(sql.Identifier(alias), sql.Identifier(column))
        for alias in ("ro", "rn")
        for column in _PART_COLUMNS
    )
    rows = conn.execute(sql.SQL("""
            SELECT c.branch, c.ordinal, c.aoid, {columns}
            FROM item_change c
            JOIN item_revision ro ON ro.rev_id = c.old_rev_id
            JOIN item_revision rn ON rn.rev_id = c.new_rev_id
            WHERE c.kind = 'C' AND {scope}
            ORDER BY c.branch, c.ordinal, c.aoid
            """).format(columns=columns, scope=_in_scope(scope))).fetchall()
    width = len(_PART_COLUMNS)
    return [(row[:3], row[3 : 3 + width], row[3 + width :]) for row in rows]


def _json_value(value: Any) -> Optional[Jsonb]:
    if value is None:
        return None
    return Jsonb(list(value) if isinstance(value, tuple) else value)


# Per transition: [occurrences, AOIDs of the items that have it].
Counted = Dict[Transition, List[Any]]


def shared_transitions(
    counted: Counted,
) -> List[Tuple[Transition, List[int], int]]:
    """``(transition, AOIDs of its items, occurrences)`` of the transitions
    enough items share, most shared first."""
    shared = [
        (transition, aoids, occurrences)
        for transition, (occurrences, aoids) in counted.items()
        if len(aoids) >= MIN_SHARED_ITEMS
    ]
    shared.sort(key=lambda entry: (-len(entry[1]), -entry[2], repr(entry[0])))
    return shared


def count_transitions(counted: Counted, aoid: int, found: List[Transition]) -> None:
    """Add the transitions of one item to ``counted``."""
    for transition, occurrences in Counter(found).items():
        entry = counted.setdefault(transition, [0, []])
        entry[0] += occurrences
        entry[1].append(aoid)


# ---------------------------------------------------------------------------
# Build notes and transitions
# ---------------------------------------------------------------------------


def _sync_notes(
    conn: psycopg.Connection, notes: NoteRules, scope: Scope
) -> Dict[Tuple[str, int], List[Tuple[int, Note]]]:
    """Make ``build_note`` hold the notes of the file for the builds in
    scope. Returns ``{(branch, ordinal): [(note_id, note), ...]}`` in file
    order."""
    builds = conn.execute(
        sql.SQL(
            "SELECT c.build_id, c.slug, c.branch, c.ordinal FROM build c WHERE {}"
        ).format(_in_scope(scope))
    ).fetchall()
    by_build: Dict[Tuple[str, int], List[Tuple[int, Note]]] = {}
    for build_id, slug, branch, ordinal in builds:
        wanted = notes.of_build(slug)
        stored = {
            title: (note_id, body)
            for note_id, title, body in conn.execute(
                "SELECT note_id, title, body FROM build_note WHERE build_id = %s",
                (build_id,),
            )
        }
        for title in set(stored) - {note.title for note in wanted}:
            conn.execute(
                "DELETE FROM build_note WHERE note_id = %s", (stored[title][0],)
            )
        for note in wanted:
            if note.title not in stored:
                note_id = conn.execute(
                    "INSERT INTO build_note (build_id, title, body) "
                    "VALUES (%s, %s, %s) RETURNING note_id",
                    (build_id, note.title, note.body),
                ).fetchone()[0]
            else:
                note_id, body = stored[note.title]
                if body != note.body:
                    conn.execute(
                        "UPDATE build_note SET body = %s WHERE note_id = %s",
                        (note.body, note_id),
                    )
            by_build.setdefault((branch, ordinal), []).append((note_id, note))
    return by_build


def analyze(
    conn: psycopg.Connection, notes: NoteRules, scope: Scope = None
) -> Dict[str, int]:
    """Derive the build notes, the note of every change and the shared
    transitions, for every build or the one in ``scope``. Rewrites
    ``build_transition`` for the builds in scope; writes only the note tags
    that differ. Returns counts for the log."""
    by_build = _sync_notes(conn, notes, scope)
    tags: List[Tuple[str, int, int, int]] = []
    counted: Dict[Tuple[str, int], Counted] = defaultdict(dict)
    for (branch, ordinal, aoid), diff in ChangeDiffs(conn, changed_rows(conn, scope)):
        count_transitions(counted[(branch, ordinal)], aoid, item_diff.transitions(diff))
        candidates = by_build.get((branch, ordinal))
        if not candidates:
            continue
        facts = item_diff.transitions(diff, full_text=True)
        for note_id, note in candidates:
            if note.explains_change(facts):
                tags.append((branch, ordinal, aoid, note_id))
                break

    conn.execute(
        "CREATE TEMP TABLE IF NOT EXISTS change_note_tag (branch varchar(20), "
        "ordinal integer, aoid integer, note_id integer) ON COMMIT DROP"
    )
    conn.execute("TRUNCATE change_note_tag")
    with conn.cursor().copy(
        "COPY change_note_tag (branch, ordinal, aoid, note_id) FROM STDIN"
    ) as copy:
        for tag in tags:
            copy.write_row(tag)
    conn.execute("ANALYZE change_note_tag")
    retagged = conn.execute("""
        UPDATE item_change c SET note_id = g.note_id
        FROM change_note_tag g
        WHERE c.branch = g.branch AND c.ordinal = g.ordinal AND c.aoid = g.aoid
          AND c.note_id IS DISTINCT FROM g.note_id
        """).rowcount
    retagged += conn.execute(sql.SQL("""
            UPDATE item_change c SET note_id = NULL
            WHERE c.note_id IS NOT NULL AND {scope}
              AND NOT EXISTS (
                SELECT 1 FROM change_note_tag g
                WHERE g.branch = c.branch AND g.ordinal = c.ordinal
                  AND g.aoid = c.aoid)
            """).format(scope=_in_scope(scope))).rowcount

    conn.execute(
        sql.SQL("DELETE FROM build_transition c WHERE {}").format(_in_scope(scope))
    )
    shared = [
        (branch, ordinal, entry)
        for (branch, ordinal), transitions in counted.items()
        for entry in shared_transitions(transitions)
    ]
    ids = [
        row[0]
        for row in conn.execute(
            "SELECT nextval(pg_get_serial_sequence('build_transition', "
            "'transition_id')) FROM generate_series(1, %s)",
            (len(shared),),
        )
    ]
    with conn.cursor().copy(
        "COPY build_transition (transition_id, branch, ordinal, part, path, old, "
        "new, items, occurrences) FROM STDIN"
    ) as copy:
        for transition_id, (branch, ordinal, entry) in zip(ids, shared):
            transition, aoids, occurrences = entry
            copy.write_row(
                (
                    transition_id,
                    branch,
                    ordinal,
                    transition.part,
                    transition.path,
                    _json_value(transition.old),
                    _json_value(transition.new),
                    len(aoids),
                    occurrences,
                )
            )
    with conn.cursor().copy(
        "COPY change_transition (transition_id, aoid) FROM STDIN"
    ) as copy:
        for transition_id, (_, _, (_, aoids, _)) in zip(ids, shared):
            for aoid in aoids:
                copy.write_row((transition_id, aoid))
    written = len(shared)
    return {"noted": len(tags), "retagged": retagged, "transitions": written}


# ---------------------------------------------------------------------------
# Entry points of the importer
# ---------------------------------------------------------------------------


def _analysis_digest(notes: NoteRules) -> str:
    return hashlib.sha1(f"{ANALYSIS_VERSION}:{notes.digest}".encode()).hexdigest()


def _set_state(conn: psycopg.Connection, name: str, value: str) -> None:
    conn.execute(
        "INSERT INTO store_state (name, value) VALUES (%s, %s) "
        "ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value "
        "WHERE store_state.value <> EXCLUDED.value",
        (name, value),
    )


def sync(conn: psycopg.Connection, rules: ChangeRules) -> Dict[str, int]:
    """Bring everything derived about the change log in line with the rules.

    Idempotent. The relevance of every change is checked on each call (one
    statement); the per-revision digests are recomputed only when
    ``change_relevance.toml`` changed, and the notes and transitions only
    when ``build_notes.toml`` or the engine did. Returns what was written.
    """
    state = dict(conn.execute("SELECT name, value FROM store_state").fetchall())
    done = {
        "digests": 0,
        "reclassified": 0,
        "noted": 0,
        "retagged": 0,
        "transitions": 0,
    }
    if state.get(STATE_RELEVANCE) != rules.relevance.digest:
        conn.execute("TRUNCATE revision_relevance")
    done["digests"] = ensure_revision_relevance(conn, rules.relevance)
    done["reclassified"] = classify(conn, rules.relevance)
    _set_state(conn, STATE_RELEVANCE, rules.relevance.digest)
    if state.get(STATE_ANALYSIS) != _analysis_digest(rules.notes):
        done.update(analyze(conn, rules.notes))
        _set_state(conn, STATE_ANALYSIS, _analysis_digest(rules.notes))
    return done


def analyze_build(
    conn: psycopg.Connection, branch: str, ordinal: int, rules: ChangeRules
) -> None:
    """Classify, note and count the changes of one build just imported."""
    ensure_revision_relevance(conn, rules.relevance)
    classify(conn, rules.relevance, (branch, ordinal))
    analyze(conn, rules.notes, (branch, ordinal))
