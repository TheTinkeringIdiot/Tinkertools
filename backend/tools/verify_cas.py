"""Check the content-addressed store against the extracts it was imported from.

One build (``SLUG --extracts-dir DIR``): every item of the build is rebuilt
from the store's parts and compared, document by document, with the raw
extract split by app/core/parts.py: class, nano flag, QL and each part (text,
stats, effects with their criteria in order, actions, attack/defense, misc
including shop data). The item sets must be the same.

The store as a whole (``--store``): each search projection is derived again
in SQL from the part documents, the presence, change-log and strain-policy
rules of database/cas/001_store.sql and 002_curated_and_derived.sql are
tested, and the change log is checked against the rules files (every entry
classified as change_relevance.toml says, notes as build_notes.toml defines
them, 003_change_analysis.sql). With ``--extracts-dir`` the item count of
every build is also compared with the manifest of its extract.

Not checked by either mode: what the store derives or curates beyond the part
documents (nano properties, symbiant rows, perks, mobs, sources) is covered by
the importer's and the routes' tests, not by a second implementation here.

Usage: python tools/verify_cas.py SLUG --extracts-dir DIR [--schema cas] [--show N]
       python tools/verify_cas.py --store [--extracts-dir DIR] [--schema cas]
Exit status is 1 if anything differs, 2 if the check cannot be run (no store,
no extract, a build the store does not hold, bad arguments).
"""

import argparse
import json
import os
import sys
from pathlib import Path

import psycopg

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core import cas_store, change_analysis  # noqa: E402
from app.core.change_rules import RELEVANCE_BITS, default_rules  # noqa: E402
from app.core.parts import PART_NAMES, split_item  # noqa: E402


def dump(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False)


# ---------------------------------------------------------------------------
# One build
# ---------------------------------------------------------------------------


def load_build(conn, slug):
    row = conn.execute(
        "SELECT build_id, branch, ordinal, features, overlay_strain_first "
        "FROM build WHERE slug = %s",
        (slug,),
    ).fetchone()
    if row is None:
        fail(f"Build '{slug}' is not in the store")
    return dict(
        zip(("build_id", "branch", "ordinal", "features", "overlay_strain_first"), row)
    )


PRESENT = """
    item_presence p
    JOIN item_revision r ON r.rev_id = p.rev_id
"""
IN_BUILD = "p.branch = %(branch)s AND p.from_ordinal <= %(ordinal)s AND p.to_ordinal >= %(ordinal)s"


def build_documents(conn, build):
    """``{aoid: part documents and scalars}`` of every item of the build."""
    rows = conn.execute(
        f"""
        SELECT r.aoid, r.is_nano, r.ql, r.item_class, t.name, t.description,
               s.doc, e.doc, a.doc, d.doc, m.doc
        FROM {PRESENT}
        JOIN part_text t ON t.text_id = r.text_id
        JOIN part_stats s ON s.stats_id = r.stats_id
        LEFT JOIN part_effects e ON e.effects_id = r.effects_id
        LEFT JOIN part_actions a ON a.actions_id = r.actions_id
        LEFT JOIN part_atkdef d ON d.atkdef_id = r.atkdef_id
        LEFT JOIN part_misc m ON m.misc_id = r.misc_id
        WHERE {IN_BUILD}
        """,
        build,
    )
    return {
        aoid: {
            "is_nano": is_nano,
            "ql": ql,
            "item_class": item_class,
            "text": {"name": name, "description": description},
            "stats": stats,
            "effects": effects,
            "actions": actions,
            "atkdef": atkdef,
            "misc": misc or None,
        }
        for (
            aoid,
            is_nano,
            ql,
            item_class,
            name,
            description,
            stats,
            effects,
            actions,
            atkdef,
            misc,
        ) in rows
    }


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------


class Report:
    def __init__(self, show):
        self.show = show
        self.differences = 0

    def section(self, title):
        print(f"\n{title}")

    def compare_maps(self, label, new, old, fields=None, other="extract"):
        """Compare two ``{key: value}`` maps; with ``fields`` the values are
        dicts compared field by field. ``other`` names the side the store is
        compared with. Returns the number of differences."""
        self.other = other
        only_new = sorted(set(new) - set(old))
        only_old = sorted(set(old) - set(new))
        both = sorted(set(new) & set(old))
        total = len(only_new) + len(only_old)
        print(
            f"  {label}: store {len(new)}, {other} {len(old)}, "
            f"only in the store {len(only_new)}, only in {other} {len(only_old)}"
        )
        for name, keys, side in (
            ("only in the store", only_new, new),
            (f"only in {other}", only_old, old),
        ):
            for key in keys[: self.show]:
                print(f"    {name}: {key} {self._short(side[key])}")
        if fields is None:
            different = [key for key in both if new[key] != old[key]]
            total += self._examples(label, different, new, old)
        else:
            for name in fields:
                different = [key for key in both if new[key][name] != old[key][name]]
                total += self._examples(
                    f"{label}.{name}",
                    different,
                    {k: new[k][name] for k in different},
                    {k: old[k][name] for k in different},
                )
        self.differences += total
        return total

    def _examples(self, label, different, new, old):
        if different:
            print(f"    {label}: {len(different)} differ")
        for key in different[: self.show]:
            print(f"      {key}")
            print(f"        store:   {self._short(new[key])}")
            print(f"        {self.other + ':':<8} {self._short(old[key])}")
        return len(different)

    @staticmethod
    def _short(value, limit=600):
        text = dump(value) if not isinstance(value, str) else value
        return text if len(text) <= limit else text[:limit] + f"... ({len(text)} chars)"

    def fail(self, message):
        self.differences += 1
        print(f"    {message}")


# ---------------------------------------------------------------------------
# Whole-store checks
# ---------------------------------------------------------------------------

_INTEGER = "'^-?[0-9]+$'"
# Each search projection, derived again in SQL from the part documents.
PROJECTION_CHECKS = {
    "stat_entry": (
        "SELECT stats_id, stat, value FROM stat_entry",
        "SELECT p.stats_id, (e->>0)::int, (e->>1)::int "
        "FROM part_stats p, jsonb_array_elements(p.doc) e",
    ),
    "requirement": (
        "SELECT actions_id, action, position, value1, value2, operator FROM requirement",
        "SELECT p.actions_id, (a.doc->>'action')::int, "
        "(row_number() OVER (PARTITION BY p.actions_id, a.doc->>'action' "
        "ORDER BY a.n, c.n) - 1)::int, "
        "(c.doc->>0)::int, (c.doc->>1)::int, (c.doc->>2)::int "
        "FROM part_actions p, jsonb_array_elements(p.doc) WITH ORDINALITY a(doc, n), "
        "jsonb_array_elements(a.doc->'criteria') WITH ORDINALITY c(doc, n)",
    ),
    "effect_entry": (
        "SELECT effects_id, event, spell_id, target, subject, amount FROM effect_entry",
        "SELECT p.effects_id, (ev->>'event')::int, (ef->>'spell_id')::int, "
        "(ef->>'target')::int, "
        f"COALESCE(CASE WHEN ef->'params'->>'Stat' ~ {_INTEGER} "
        "AND jsonb_typeof(ef->'params'->'Stat') = 'number' "
        "THEN (ef->'params'->>'Stat')::bigint END, "
        f"CASE WHEN ef->'params'->>'Skill' ~ {_INTEGER} "
        "AND jsonb_typeof(ef->'params'->'Skill') = 'number' "
        "THEN (ef->'params'->>'Skill')::bigint END, "
        f"CASE WHEN ef->'params'->>'NanoID' ~ {_INTEGER} "
        "AND jsonb_typeof(ef->'params'->'NanoID') = 'number' "
        "THEN (ef->'params'->>'NanoID')::bigint END), "
        f"CASE WHEN ef->'params'->>'Amount' ~ {_INTEGER} "
        "AND jsonb_typeof(ef->'params'->'Amount') = 'number' "
        "THEN (ef->'params'->>'Amount')::int END "
        "FROM part_effects p, jsonb_array_elements(p.doc) ev, "
        "jsonb_array_elements(ev->'effects') ef",
    ),
    "atkdef_entry": (
        "SELECT atkdef_id, is_attack, stat, value FROM atkdef_entry",
        "SELECT p.atkdef_id, k.key = 'attack', (e->>0)::int, (e->>1)::int "
        "FROM part_atkdef p, jsonb_each(p.doc) k, jsonb_array_elements(k.value) e",
    ),
}

# item_change.parts_changed as 001_store.sql defines it, from the part ids of
# the two revisions (o old, n new).
PART_CHANGE_BITS = {
    "text_id": 1,
    "stats_id": 2,
    "effects_id": 4,
    "actions_id": 8,
    "atkdef_id": 16,
    "misc_id": 32,
}
_PARTS_CHANGED = " + ".join(
    f"CASE WHEN n.{column} IS DISTINCT FROM o.{column} THEN {bit} ELSE 0 END"
    for column, bit in PART_CHANGE_BITS.items()
)
_SERVED_WITH = """
    item_presence p
    JOIN build b ON b.branch = p.branch
        AND b.ordinal BETWEEN p.from_ordinal AND p.to_ordinal
"""

# Each query returns the rows that break a rule of 001_store.sql or
# 002_curated_and_derived.sql; none may.
INVARIANTS = {
    "closed runs that do not end at a build of their branch": f"""
        SELECT p.branch, p.aoid, p.to_ordinal FROM item_presence p
        WHERE p.to_ordinal <> {cas_store.OPEN_RUN} AND NOT EXISTS (
            SELECT 1 FROM build b WHERE b.branch = p.branch AND b.ordinal = p.to_ordinal)
    """,
    "runs split although the revision did not change": """
        WITH ordered AS (
            SELECT branch, ordinal,
                   lag(ordinal) OVER (PARTITION BY branch ORDER BY ordinal) AS previous
            FROM build)
        SELECT p.branch, p.aoid, p.from_ordinal FROM item_presence p
        JOIN ordered o ON o.branch = p.branch AND o.ordinal = p.from_ordinal
        JOIN item_presence q ON q.branch = p.branch AND q.aoid = p.aoid
            AND q.to_ordinal = o.previous AND q.rev_id = p.rev_id
    """,
    "builds whose presence does not hold item_count items": """
        SELECT b.slug, b.item_count, count(p.aoid) FROM build b
        LEFT JOIN item_presence p ON p.branch = b.branch
            AND p.from_ordinal <= b.ordinal AND p.to_ordinal >= b.ordinal
        GROUP BY b.slug, b.item_count HAVING count(p.aoid) <> b.item_count
    """,
    "revisions no build serves": """
        SELECT r.rev_id, r.aoid FROM item_revision r
        WHERE NOT EXISTS (SELECT 1 FROM item_presence p WHERE p.rev_id = r.rev_id)
    """,
    "parts no revision uses": " UNION ALL ".join(
        f"SELECT '{name}', p.{column} FROM {table} p WHERE NOT EXISTS "
        f"(SELECT 1 FROM item_revision r WHERE r.{column} = p.{column})"
        for name, (table, column) in cas_store.PART_TABLES.items()
    ),
    "runs opened without an added or changed entry in the change log": """
        SELECT p.branch, p.aoid, p.from_ordinal FROM item_presence p
        JOIN build b ON b.branch = p.branch AND b.ordinal = p.from_ordinal
        WHERE NOT (b.parent_build_id IS NOT NULL AND b.ordinal =
                   (SELECT min(ordinal) FROM build WHERE branch = b.branch))
          AND NOT EXISTS (
            SELECT 1 FROM item_change c WHERE c.branch = p.branch
              AND c.ordinal = p.from_ordinal AND c.aoid = p.aoid
              AND c.kind IN ('A', 'C') AND c.new_rev_id = p.rev_id)
    """,
    "change log entries that presence does not bear out": """
        WITH ordered AS (
            SELECT branch, ordinal, parent_build_id,
                   lag(ordinal) OVER (PARTITION BY branch ORDER BY ordinal) AS previous
            FROM build)
        SELECT c.branch, c.ordinal, c.aoid, c.kind FROM item_change c
        JOIN ordered o ON o.branch = c.branch AND o.ordinal = c.ordinal
        LEFT JOIN build parent ON parent.build_id = o.parent_build_id
            AND o.previous IS NULL
        WHERE (c.new_rev_id IS NOT NULL AND NOT EXISTS (
                SELECT 1 FROM item_presence p WHERE p.branch = c.branch
                  AND p.aoid = c.aoid AND p.rev_id = c.new_rev_id
                  AND p.from_ordinal = c.ordinal))
           OR (c.old_rev_id IS NOT NULL AND NOT EXISTS (
                SELECT 1 FROM item_presence p
                WHERE p.aoid = c.aoid AND p.rev_id = c.old_rev_id
                  AND ((o.previous IS NOT NULL AND p.branch = c.branch
                        AND p.to_ordinal = o.previous)
                    OR (o.previous IS NULL AND p.branch = parent.branch
                        AND p.from_ordinal <= parent.ordinal
                        AND p.to_ordinal >= parent.ordinal))))
           OR (c.kind = 'C') <> (c.old_rev_id IS NOT NULL AND c.new_rev_id IS NOT NULL)
           OR c.old_rev_id = c.new_rev_id
    """,
    "change log entries whose parts_changed is not what the revisions differ in": f"""
        SELECT c.branch, c.ordinal, c.aoid, c.kind, c.parts_changed
        FROM item_change c
        LEFT JOIN item_revision o ON o.rev_id = c.old_rev_id
        LEFT JOIN item_revision n ON n.rev_id = c.new_rev_id
        WHERE c.parts_changed <>
              CASE WHEN c.kind = 'C' THEN {_PARTS_CHANGED} ELSE 0 END
    """,
    "builds whose strain policy is not 'the newest of its branch takes the overlay'": """
        SELECT b.slug, b.overlay_strain_first FROM build b
        WHERE b.overlay_strain_first <> (b.ordinal =
            (SELECT max(ordinal) FROM build WHERE branch = b.branch))
    """,
    "nano properties under a policy no build serves the revision with": f"""
        SELECT np.rev_id, np.overlay_strain_first FROM nano_properties np
        WHERE NOT EXISTS (
            SELECT 1 FROM {_SERVED_WITH}
            WHERE p.rev_id = np.rev_id
              AND b.overlay_strain_first = np.overlay_strain_first)
    """,
    "nanos served without nano properties under their build's policy": """
        SELECT DISTINCT b.slug, r.aoid FROM build b
        JOIN item_presence p ON p.branch = b.branch
            AND p.from_ordinal <= b.ordinal AND p.to_ordinal >= b.ordinal
        JOIN item_revision r ON r.rev_id = p.rev_id AND r.is_nano
        WHERE NOT EXISTS (SELECT 1 FROM nano_properties np WHERE np.rev_id = r.rev_id
                          AND np.overlay_strain_first = b.overlay_strain_first)
    """,
    "nano revisions whose QL is not the overlay's": """
        SELECT r.rev_id, r.aoid, r.ql FROM item_revision r
        LEFT JOIN nano_overlay o ON o.aoid = r.aoid
        WHERE r.is_nano AND r.ql <> COALESCE(o.ql, 1)
    """,
}


def change_analysis_invariants(conn, rules):
    """Rules of 003_change_analysis.sql as queries like INVARIANTS: what the
    importer derives about the change log is what ``rules`` give."""
    relevance = change_analysis.relevance_sql(rules.relevance).as_string(conn)
    added, removed = rules.relevance.bit("added"), rules.relevance.bit("removed")
    return {
        "change log entries that are not classified": """
            SELECT branch, ordinal, aoid FROM item_change
            WHERE relevance IS NULL OR relevance = 0
        """,
        "revisions without relevance digests": """
            SELECT r.rev_id, r.aoid FROM item_revision r
            WHERE NOT EXISTS (
                SELECT 1 FROM revision_relevance d WHERE d.rev_id = r.rev_id)
        """,
        "change log entries whose relevance is not what change_relevance.toml gives": f"""
            SELECT c.branch, c.ordinal, c.aoid, c.kind, c.relevance FROM item_change c
            LEFT JOIN item_revision ro ON ro.rev_id = c.old_rev_id
            LEFT JOIN item_revision rn ON rn.rev_id = c.new_rev_id
            LEFT JOIN revision_relevance o ON o.rev_id = c.old_rev_id
            LEFT JOIN revision_relevance n ON n.rev_id = c.new_rev_id
            WHERE c.relevance IS DISTINCT FROM
                  CASE c.kind WHEN 'A' THEN {added} WHEN 'R' THEN {removed}
                       ELSE {relevance} END
        """,
        "change log entries tagged with a note that is not their build's": """
            SELECT c.branch, c.ordinal, c.aoid, c.note_id FROM item_change c
            JOIN build_note n ON n.note_id = c.note_id
            JOIN build b ON b.build_id = n.build_id
            WHERE b.branch <> c.branch OR b.ordinal <> c.ordinal OR c.kind <> 'C'
        """,
        "shared transitions of fewer than two items, or not of the items listed for them": f"""
            SELECT t.branch, t.ordinal, t.path FROM build_transition t
            WHERE t.items < {change_analysis.MIN_SHARED_ITEMS}
               OR t.occurrences < t.items
               OR t.items <> (SELECT count(*) FROM change_transition m
                              JOIN item_change c ON c.branch = t.branch
                                  AND c.ordinal = t.ordinal AND c.aoid = m.aoid
                                  AND c.kind = 'C'
                              WHERE m.transition_id = t.transition_id)
               OR t.items > (SELECT count(*) FROM item_change c
                             WHERE c.branch = t.branch AND c.ordinal = t.ordinal
                               AND c.kind = 'C')
        """,
        "shared transitions not counted over the changes without a note as the log has them": """
            SELECT t.branch, t.ordinal, t.path, t.unnoted_items FROM build_transition t
            WHERE t.unnoted_occurrences < t.unnoted_items
               OR t.unnoted_occurrences > t.occurrences
               OR t.unexplained_items > t.unnoted_items
               OR t.unexplained_items < 0
               OR t.unnoted_items <> (SELECT count(*) FROM change_transition m
                                      JOIN item_change c ON c.branch = t.branch
                                          AND c.ordinal = t.ordinal AND c.aoid = m.aoid
                                          AND c.note_id IS NULL
                                      WHERE m.transition_id = t.transition_id)
        """,
    }


def misclassified_transitions(conn, rules):
    """``(part, path, old, new, stored relevance)`` of the shared transitions
    whose class is not what ``change_relevance.toml`` gives their field."""
    return [
        (part, path, old, new, stored)
        for part, path, old, new, stored in conn.execute(
            "SELECT DISTINCT part, path, old, new, relevance FROM build_transition"
        )
        if stored
        != RELEVANCE_BITS[rules.relevance.transition_class(part, path, old, new)]
    ]


def check_change_rules(report, conn, rules):
    """The notes and the digests of the rules files against the store."""
    stored = set(
        conn.execute(
            "SELECT b.slug, n.title, n.body FROM build_note n "
            "JOIN build b ON b.build_id = n.build_id"
        ).fetchall()
    )
    slugs = {row[0] for row in conn.execute("SELECT slug FROM build")}
    defined = {
        (note.build, note.title, note.body)
        for note in rules.notes.notes
        if note.build in slugs
    }
    print(
        f"  build notes: {len(stored)} stored, not in build_notes.toml "
        f"{len(stored - defined)}, missing {len(defined - stored)}"
    )
    report.differences += len(stored ^ defined)

    state = dict(conn.execute("SELECT name, value FROM store_state").fetchall())
    for what, name, wanted in (
        (
            "change_relevance.toml applied to the store",
            change_analysis.STATE_RELEVANCE,
            rules.relevance.digest,
        ),
        (
            "build_notes.toml, change_relevance.toml and the diff engine "
            "applied to the notes and transitions",
            change_analysis.STATE_ANALYSIS,
            change_analysis.analysis_digest(rules),
        ),
    ):
        stale = state.get(name) != wanted
        print(f"  {what}: " + ("no (run import_cli.py import-cas)" if stale else "yes"))
        report.differences += stale


def check_store(report, conn, extracts=None):
    """Checks that hold for the store as a whole, whatever the build. With
    ``extracts`` (the extracts folder) the item count of every build is
    compared with the manifest of its extract."""
    report.section("Search projections against the part documents (whole store)")
    for table, (stored, derived) in PROJECTION_CHECKS.items():
        extra, missing = (
            conn.execute(f"SELECT count(*) FROM (({a}) EXCEPT ALL ({b})) d").fetchone()[
                0
            ]
            for a, b in ((stored, derived), (derived, stored))
        )
        rows = conn.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
        print(
            f"  {table}: {rows} rows, not in the documents {extra}, missing {missing}"
        )
        report.differences += extra + missing

    rules = default_rules()
    report.section("Store rules (whole store)")
    invariants = {**INVARIANTS, **change_analysis_invariants(conn, rules)}
    for rule, query in invariants.items():
        rows = conn.execute(query).fetchall()
        print(f"  {rule}: {len(rows)}")
        for row in rows[: report.show]:
            print(f"    {row}")
        report.differences += len(rows)
    misclassified = misclassified_transitions(conn, rules)
    print(
        "  shared transitions whose class is not what change_relevance.toml "
        f"gives: {len(misclassified)}"
    )
    for row in misclassified[: report.show]:
        print(f"    {row}")
    report.differences += len(misclassified)
    check_change_rules(report, conn, rules)

    if extracts is None:
        print("\nItem counts are not compared with the extracts (no --extracts-dir)")
        return
    report.section("Item count of every build against its extract's manifest")
    stored, expected = {}, {}
    for slug, extract_slug, items in conn.execute(
        "SELECT slug, extract_slug, item_count FROM build"
    ):
        manifest = extracts / (extract_slug or slug) / "manifest.json"
        if not manifest.is_file():
            fail(f"No manifest to compare with: {manifest} not found")
        counts = json.loads(manifest.read_text(encoding="utf-8"))
        stored[slug] = items
        expected[slug] = counts["item_count"] + counts["nano_count"]
    report.compare_maps("builds", stored, expected, other="manifest")


def compare_extract(report, documents, extracts, extract_slug):
    report.section(
        f"Raw extract {extract_slug} (every part document, including shop data)"
    )
    raw = {}
    for filename, is_nano in (("items.json", False), ("nanos.json", True)):
        for record in json.loads((extracts / extract_slug / filename).read_bytes()):
            split = split_item(record, is_nano)
            raw[split.aoid] = {
                "is_nano": is_nano,
                "item_class": split.item_class,
                **({} if is_nano else {"ql": split.ql}),
                **{name: split.documents[name] for name in PART_NAMES},
            }
    new = {
        aoid: {key: doc[key] for key in raw.get(aoid, doc)}
        for aoid, doc in documents.items()
    }
    fields = ("is_nano", "item_class") + PART_NAMES
    report.compare_maps("items", new, raw, fields, other="extract")
    wrong_ql = [
        a for a in raw if a in new and "ql" in raw[a] and raw[a]["ql"] != new[a]["ql"]
    ]
    print(f"    item QL differs from stat 54: {len(wrong_ql)} {wrong_ql[:report.show]}")
    report.differences += len(wrong_ql)


def fail(message):
    """End the run: the check could not be made."""
    print(f"error: {message}", file=sys.stderr)
    sys.exit(2)


def open_store(schema):
    """A read-only connection to the store in ``schema``, which must be one
    the importer has brought up to date."""
    url = os.environ.get("DATABASE_URL")
    if not url:
        fail("DATABASE_URL is not set")
    try:
        conn = cas_store.connect(url, schema)
    except (cas_store.StoreError, psycopg.Error) as exc:
        fail(str(exc).strip())
    conn.read_only = True
    if not cas_store.store_exists(conn, schema):
        fail(f"Schema '{schema}' holds no content-addressed store")
    columns = {
        row[0]
        for row in conn.execute(
            "SELECT table_name || '.' || column_name FROM information_schema.columns "
            "WHERE table_schema = %s",
            (schema,),
        )
    }
    missing = sorted(
        {
            "build.overlay_strain_first",
            "mob.retired",
            "store_state.name",
            "part_text.name_lower",
        }
        - columns
    )
    if missing:
        fail(
            f"Schema '{schema}' is not a current content-addressed store "
            f"(no {', '.join(missing)}); run import_cli.py import-cas on it first"
        )
    return conn


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("slug", nargs="?")
    parser.add_argument(
        "--store",
        action="store_true",
        help="check the store as a whole instead of one build: projections "
        "against the part documents, presence and change-log rules and, with "
        "--extracts-dir, the item count of every build against its manifest",
    )
    parser.add_argument("--schema", default="cas")
    parser.add_argument(
        "--extracts-dir",
        default=None,
        help="extracts folder; required for a build, whose every part document "
        "is compared with the raw extract",
    )
    parser.add_argument("--show", type=int, default=3, help="examples per difference")
    args = parser.parse_args()

    if bool(args.slug) == args.store:
        parser.error("give a build slug or --store")
    if args.slug and not args.extracts_dir:
        parser.error("a build is checked against its extract: give --extracts-dir DIR")
    extracts = Path(args.extracts_dir).expanduser() if args.extracts_dir else None
    if extracts is not None and not extracts.is_dir():
        fail(f"Extracts folder not found: {extracts}")
    conn = open_store(args.schema)
    report = Report(args.show)
    if args.store:
        check_store(report, conn, extracts)
        print(f"\nstore {args.schema}: {report.differences} difference(s)")
        return 1 if report.differences else 0

    build = load_build(conn, args.slug)
    extract_slug = conn.execute(
        "SELECT extract_slug FROM build WHERE slug = %s", (args.slug,)
    ).fetchone()[0]
    for name in ("items.json", "nanos.json"):
        if not (extracts / extract_slug / name).is_file():
            fail(
                f"No extract to compare with: {extracts / extract_slug / name} not found"
            )
    print(
        f"Build {args.slug}: store schema {args.schema} "
        f"(branch {build['branch']}, ordinal {build['ordinal']})"
    )
    compare_extract(report, build_documents(conn, build), extracts, extract_slug)
    print(f"\n{args.slug}: {report.differences} difference(s)")
    return 1 if report.differences else 0


if __name__ == "__main__":
    sys.exit(main())
