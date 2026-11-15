#!/usr/bin/env python3
"""
Candidates for build notes: what many changed items of a build have in common.

For each build (or the ones named) it prints, from the field-level diff of
every changed item:

* the field transitions shared by at least ``--min-items`` items
  ("effects effect:53089:spell_params.Chance 60 -> 100 on 760 items");
* the change shapes shared by at least that many items: the set of fields
  that changed, without their values. A mass rename shows here, as thousands
  of items whose whole change is ``name`` and ``description``, even though no
  two of them were renamed with the same words;
* the notes ``backend/database/build_notes.toml`` defines for the build, with
  the number of changes each would explain, and the number left unexplained.

A maintainer turns a candidate into a note by writing its transitions as
patterns in ``build_notes.toml`` (the format is in the docstring of
app/core/change_rules.py) and re-running this tool to see what the note
catches. The next ``import_cli.py import-cas`` run applies the file.

Read-only. Run from ``backend/`` with ``DATABASE_URL`` set::

    python tools/change_candidates.py [--schema cas] [--min-items 200]
                                      [--top 15] [--examples 3] [SLUG ...]
"""

import argparse
import os
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core import cas_store, change_analysis, item_diff  # noqa: E402
from app.core.change_rules import default_rules  # noqa: E402


def show(value):
    return "absent" if value is None else repr(value)


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("slugs", nargs="*", help="builds to report (default: all)")
    parser.add_argument("--schema", default="cas")
    parser.add_argument("--min-items", type=int, default=200)
    parser.add_argument("--top", type=int, default=15, help="lines per list")
    parser.add_argument(
        "--examples", type=int, default=3, help="AOIDs shown per change shape"
    )
    args = parser.parse_args()

    conn = cas_store.connect(os.environ["DATABASE_URL"], args.schema)
    conn.read_only = True
    notes = default_rules().notes
    builds = conn.execute(
        "SELECT slug, branch, ordinal FROM build ORDER BY branch, ordinal"
    ).fetchall()
    unknown = set(args.slugs) - {slug for slug, _, _ in builds}
    if unknown:
        parser.error(f"not in the store: {', '.join(sorted(unknown))}")

    for slug, branch, ordinal in builds:
        if args.slugs and slug not in args.slugs:
            continue
        rows = change_analysis.changed_rows(conn, (branch, ordinal))
        counted = {}
        shapes = defaultdict(list)
        build_notes = notes.of_build(slug)
        explained = Counter()
        for (_, _, aoid), diff in change_analysis.ChangeDiffs(conn, rows):
            found = item_diff.transitions(diff)
            change_analysis.count_transitions(counted, found)
            shapes[frozenset((t.part, t.path) for t in found)].append(aoid)
            facts = item_diff.transitions(diff, full_text=True)
            for note in build_notes:
                if note.explains_change(facts):
                    explained[note.title] += 1
                    break
        shared = [
            entry
            for entry in change_analysis.shared_transitions(counted)
            if entry[1] >= args.min_items
        ]
        common = sorted(
            ((len(aoids), sorted(shape), aoids) for shape, aoids in shapes.items()),
            key=lambda entry: (-entry[0], entry[1]),
        )
        common = [entry for entry in common if entry[0] >= args.min_items]
        if not (shared or common or build_notes):
            continue
        print(f"\n{slug}: {len(rows)} changed items")
        if shared:
            print("  transitions:")
        for transition, items, occurrences in shared[: args.top]:
            print(
                f"    {items:6} items {occurrences:6} times  {transition.part} "
                f"{transition.path}: {show(transition.old)} -> {show(transition.new)}"
            )
        if common:
            print("  change shapes (every field that changed):")
        for count, shape, aoids in common[: args.top]:
            fields = ", ".join(f"{part} {path}" for part, path in shape)
            examples = ", ".join(map(str, aoids[: args.examples]))
            print(f"    {count:6} items  {fields}   e.g. {examples}")
        if build_notes:
            print("  notes:")
            for note in build_notes:
                print(f"    {explained[note.title]:6} changes  {note.title}")
            print(f"    {len(rows) - sum(explained.values()):6} changes  (no note)")
    conn.close()


if __name__ == "__main__":
    main()
