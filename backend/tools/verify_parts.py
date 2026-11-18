"""Check the canonical part hashes against the raw extracts for two builds.

Three checks, each against a comparison of the raw records that does not use
app/core/parts.py:

1. Across builds: for every item present in both, each part's hash must say
   "changed" exactly when the raw data differs in content, and must not when
   it differs only in order.
2. Within each build: a part hash must stand for exactly one content, and one
   content must have exactly one hash, across all items. The effect text
   left out of the hash must be determined by what is hashed.
3. Every part document can be stored: it contains no NUL character.

The raw comparison shares the scope decisions of the canonical forms, which
are stated in app/core/parts.py: StaticInstance belongs to ``misc``, rendered
effect text is not content, a stat/value pair repeated verbatim counts once,
and an empty attack/defense block is the same as none.

Usage: python tools/verify_parts.py EXTRACTS_DIR OLD_SLUG NEW_SLUG
Exit status is 1 if any check fails.
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
    return sorted(collections.Counter(dump(e) for e in entries or []).items())


def distinct(entries):
    return sorted({dump(e) for e in entries or []})


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
    text = (record.get("Name") or "", record.get("Description") or "")
    mesh, shop = record.get("AnimationMesh"), record.get("ShopHashData") or None
    if ordered:
        return {
            "text": text,
            "stats": stats,
            "effects": events,
            "actions": actions,
            "atkdef": (atkdef.get("Attack") or [], atkdef.get("Defense") or []),
            "misc": (instance, mesh, shop),
        }
    return {
        "text": text,
        "stats": distinct(stats),
        "effects": bag((event, bag(items)) for event, items in events),
        "actions": bag(actions),
        "atkdef": (distinct(atkdef.get("Attack")), distinct(atkdef.get("Defense"))),
        "misc": (distinct(instance), dump(mesh), dump(shop)),
    }


def check_build(slug, records):
    """Checks 2 and 3 for one build; returns the split of every record."""
    by_hash = {name: {} for name in PART_NAMES}
    by_content = {name: {} for name in PART_NAMES}
    formats, descriptions = {}, {}
    problems, parts = [], {}
    for aoid, (record, is_nano) in records.items():
        # Rendered effect text is left out of the hash, which is only sound if
        # it is a function of what is hashed.
        for event in record.get("SpellData") or []:
            for raw in event.get("Items") or []:
                shown = (raw.get("SpellFormat"), raw.get("SpellDescription"))
                hashed = dump(
                    {
                        k: v
                        for k, v in raw.items()
                        if k not in ("SpellFormat", "SpellDescription")
                    }
                )
                if formats.setdefault(raw["SpellID"], shown[0]) != shown[0]:
                    problems.append((aoid, "effect type with two formats"))
                if descriptions.setdefault(hashed, shown[1]) != shown[1]:
                    problems.append((aoid, "effect with two descriptions"))
        split = parts[aoid] = split_item(record, is_nano)
        if "\x00" in json.dumps(split.documents, ensure_ascii=False):
            problems.append((aoid, "document contains NUL"))
        content = raw_view(record, ordered=False)
        for name in PART_NAMES:
            digest, raw = split.hashes[name], dump(content[name])
            if by_hash[name].setdefault(digest, raw) != raw:
                problems.append((aoid, name, "one hash, two contents"))
            if by_content[name].setdefault(raw, digest) != digest:
                problems.append((aoid, name, "one content, two hashes"))
    sizes = ", ".join(f"{name} {len(by_hash[name])}" for name in PART_NAMES)
    print(f"{slug}: {len(records)} items; distinct parts: {sizes}")
    print(f"  one-to-one, text and storability problems: {len(problems)}")
    for row in problems[:10]:
        print("   ", row)
    return parts, problems


def main():
    extracts = Path(sys.argv[1]).expanduser()
    old_slug, new_slug = sys.argv[2], sys.argv[3]
    old, new = load(extracts, old_slug), load(extracts, new_slug)
    old_parts, old_problems = check_build(old_slug, old)
    new_parts, new_problems = check_build(new_slug, new)

    common = sorted(set(old) & set(new))
    counts = {name: collections.Counter() for name in PART_NAMES}
    wrong = []
    for aoid in common:
        (a, _), (b, _) = old[aoid], new[aoid]
        ha, hb = old_parts[aoid].hashes, new_parts[aoid].hashes
        content_a, content_b = raw_view(a, False), raw_view(b, False)
        order_a, order_b = raw_view(a, True), raw_view(b, True)
        for name in PART_NAMES:
            hash_changed = ha[name] != hb[name]
            content_changed = content_a[name] != content_b[name]
            if hash_changed != content_changed:
                wrong.append((aoid, name, hash_changed, content_changed))
            elif hash_changed:
                counts[name]["changed"] += 1
            elif dump(order_a[name]) != dump(order_b[name]):
                counts[name]["order only"] += 1
    print(
        f"{old_slug} -> {new_slug}: {len(common)} items in both, "
        f"{len(set(new) - set(old))} added, {len(set(old) - set(new))} removed"
    )
    for name in PART_NAMES:
        print(
            f"  {name:8} changed {counts[name]['changed']:6}   "
            f"order only (ignored) {counts[name]['order only']:6}"
        )
    print(f"  hash disagrees with raw comparison: {len(wrong)}")
    for row in wrong[:10]:
        print("   ", row)
    return 1 if wrong or old_problems or new_problems else 0


if __name__ == "__main__":
    sys.exit(main())
