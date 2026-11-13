"""Check the canonical part hashes against the raw extracts for two builds.

For every item present in both builds, each part's hash comparison is checked
against an independent comparison of the raw records. The hash must say
"changed" exactly when the raw data differs in content, and must not when it
differs only in order.

Usage: python tools/verify_parts.py EXTRACTS_DIR OLD_SLUG NEW_SLUG
Exit status is 1 if any hash disagrees with the raw comparison.
"""

import collections
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.parts import PART_NAMES, split_item  # noqa: E402


def load(extracts: Path, slug: str):
    records = {}
    for filename, is_nano in (("items.json", False), ("nanos.json", True)):
        for record in json.loads((extracts / slug / filename).read_text()):
            records[record["AOID"]] = (record, is_nano)
    return records


def dump(value):
    return json.dumps(value, sort_keys=True)


def bag(entries):
    return collections.Counter(dump(e) for e in entries or [])


def raw_view(record, ordered):
    """Each part of a raw record, either as extracted or with order removed."""
    stats = [s for s in record.get("StatValues") or [] if s["Stat"] != 23]
    instance = [s for s in record.get("StatValues") or [] if s["Stat"] == 23]
    events = [
        (
            event["Event"],
            [
                {
                    k: v
                    for k, v in s.items()
                    if k not in ("SpellDescription", "SpellFormat")
                }
                for s in event.get("Items") or []
            ],
        )
        for event in record.get("SpellData") or []
    ]
    actions = (record.get("ActionData") or {}).get("Actions") or []
    atkdef = record.get("AttackDefenseData") or {}
    if ordered:
        return {
            "text": (record.get("Name") or "", record.get("Description") or ""),
            "stats": stats,
            "effects": events,
            "actions": actions,
            "atkdef": (atkdef.get("Attack") or [], atkdef.get("Defense") or []),
            "misc": (
                instance,
                record.get("AnimationMesh"),
                record.get("ShopHashData") or None,
            ),
        }
    return {
        "text": (record.get("Name") or "", record.get("Description") or ""),
        "stats": bag(stats),
        "effects": bag((event, sorted(bag(items).items())) for event, items in events),
        "actions": bag(actions),
        "atkdef": (bag(atkdef.get("Attack")), bag(atkdef.get("Defense"))),
        "misc": (
            bag(instance),
            dump(record.get("AnimationMesh")),
            dump(record.get("ShopHashData") or None),
        ),
    }


def main():
    extracts, old_slug, new_slug = (
        Path(sys.argv[1]).expanduser(),
        sys.argv[2],
        sys.argv[3],
    )
    old, new = load(extracts, old_slug), load(extracts, new_slug)
    common = sorted(set(old) & set(new))
    counts = {name: collections.Counter() for name in PART_NAMES}
    wrong = []
    for aoid in common:
        (a, a_nano), (b, b_nano) = old[aoid], new[aoid]
        ha, hb = split_item(a, a_nano).hashes, split_item(b, b_nano).hashes
        content_a, content_b = raw_view(a, ordered=False), raw_view(b, ordered=False)
        order_a, order_b = raw_view(a, ordered=True), raw_view(b, ordered=True)
        for name in PART_NAMES:
            hash_changed = ha[name] != hb[name]
            content_changed = content_a[name] != content_b[name]
            if hash_changed != content_changed:
                wrong.append((aoid, name, hash_changed, content_changed))
            elif hash_changed:
                counts[name]["changed"] += 1
            elif dump(order_a[name]) != dump(order_b[name]):
                counts[name]["order only (ignored)"] += 1
    print(
        f"{old_slug} -> {new_slug}: {len(common)} items in both, "
        f"{len(set(new) - set(old))} added, {len(set(old) - set(new))} removed"
    )
    for name in PART_NAMES:
        print(
            f"  {name:8} changed {counts[name]['changed']:6}   "
            f"order only (ignored) {counts[name]['order only (ignored)']:6}"
        )
    print(f"  hash disagrees with raw comparison: {len(wrong)}")
    for row in wrong[:10]:
        print("   ", row)
    return 1 if wrong else 0


if __name__ == "__main__":
    sys.exit(main())
