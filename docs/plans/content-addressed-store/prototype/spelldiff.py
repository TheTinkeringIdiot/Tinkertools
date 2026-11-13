"""Prototype: field-level diff of spell effects between two builds.

Usage: spelldiff.py OLD_SLUG NEW_SLUG [--samples N]
Reads DATABASE_URL. Read-only.
"""
import collections
import json
import os
import sys

import psycopg2

DERIVED = {"SpellDescription"}


def load(cur, vid_old, vid_new):
    cur.execute(
        """select a.aoid, b.name, a.id, b.id, b.is_nano from gd.items a join gd.items b on a.aoid=b.aoid
           where a.vids @> array[%s::smallint] and b.vids @> array[%s::smallint]
             and a.spells_hash<>b.spells_hash""",
        (vid_old, vid_new),
    )
    pairs = cur.fetchall()
    ids = [p[2] for p in pairs] + [p[3] for p in pairs]
    cur.execute(
        """select isd.item_id, sd.id, sd.event, s.id, s.target, s.tick_count, s.tick_interval,
                  s.spell_id, s.spell_params,
                  coalesce((select json_agg(json_build_array(c.value1, c.value2, c.operator) order by sc.ctid)
                            from gd.spell_criteria sc join gd.criteria c on c.id=sc.criterion_id
                            where sc.spell_id=s.id), '[]'::json)
           from gd.item_spell_data isd
           join gd.spell_data sd on sd.id=isd.spell_data_id
           left join gd.spell_data_spells sds on sds.spell_data_id=sd.id
           left join gd.spells s on s.id=sds.spell_id
           where isd.item_id = any(%s) order by isd.item_id, sd.id, s.id""",
        (ids,),
    )
    docs = collections.defaultdict(lambda: collections.defaultdict(list))
    for item_id, _sd, event, sid, target, ticks, interval, spell_id, params, crit in cur:
        if sid is None:
            docs[item_id][event]
            continue
        params = {k: v for k, v in (params or {}).items()}
        docs[item_id][event].append(
            {"spell_id": spell_id, "target": target, "tick_count": ticks,
             "tick_interval": interval, "params": params, "criteria": crit}
        )
    return pairs, docs


def key(spell, drop=()):
    s = dict(spell)
    s["params"] = {k: v for k, v in spell["params"].items() if k not in drop}
    return json.dumps(s, sort_keys=True)


def field_diffs(old, new):
    out = []
    for f in ("target", "tick_count", "tick_interval"):
        if old[f] != new[f]:
            out.append((f, old[f], new[f]))
    if old["criteria"] != new["criteria"]:
        out.append(("criteria", old["criteria"], new["criteria"]))
    for k in sorted(set(old["params"]) | set(new["params"])):
        if k in DERIVED:
            continue
        a, b = old["params"].get(k, "<absent>"), new["params"].get(k, "<absent>")
        if a != b:
            out.append((f"param.{k}", a, b))
    return out


def identity(spell):
    """What makes an effect 'the same effect' across builds: its function and what it acts on."""
    p = spell["params"]
    return (spell["spell_id"], spell["target"], p.get("Stat"), p.get("NanoID"), p.get("Skill"))


def diff_event(old, new):
    """Returns (changed[(old,new,fields)], added, removed, reordered_only)."""
    old_left, new_left = list(old), list(new)
    # 1. exact matches (ignoring derived text)
    bucket = collections.defaultdict(list)
    for s in new_left:
        bucket[key(s, DERIVED)].append(s)
    rest_old = []
    for s in old_left:
        b = bucket[key(s, DERIVED)]
        if b:
            b.pop()
        else:
            rest_old.append(s)
    rest_new = [s for b in bucket.values() for s in b]
    # 2. match by identity, then by spell_id+target, in order
    changed = []
    for ident in (identity, lambda s: (s["spell_id"], s["target"]), lambda s: (s["spell_id"],)):
        groups = collections.defaultdict(list)
        for s in rest_new:
            groups[ident(s)].append(s)
        still = []
        for s in rest_old:
            g = groups[ident(s)]
            if g:
                n = g.pop(0)
                changed.append((s, n, field_diffs(s, n)))
            else:
                still.append(s)
        rest_old = still
        rest_new = [s for g in groups.values() for s in g]
    reordered = not changed and not rest_old and not rest_new and \
        [key(s, DERIVED) for s in old] != [key(s, DERIVED) for s in new]
    return changed, rest_new, rest_old, reordered


def main():
    old_slug, new_slug = sys.argv[1], sys.argv[2]
    samples = int(sys.argv[sys.argv.index("--samples") + 1]) if "--samples" in sys.argv else 6
    conn = psycopg2.connect(os.environ["DATABASE_URL"].replace("+asyncpg", "").replace("+psycopg2", ""))
    conn.set_session(readonly=True)
    cur = conn.cursor()
    cur.execute("select slug, vid from public.game_versions where slug in (%s,%s)", (old_slug, new_slug))
    vids = dict(cur.fetchall())
    pairs, docs = load(cur, vids[old_slug], vids[new_slug])

    kinds = collections.Counter()          # per-item outcome
    signatures = collections.Counter()     # (spell_id, field) -> count of effect changes
    transitions = collections.Counter()    # (field, old, new) for scalar fields
    added_ids, removed_ids = collections.Counter(), collections.Counter()
    event_changes = collections.Counter()
    examples = collections.defaultdict(list)
    for aoid, name, old_id, new_id, is_nano in pairs:
        o, n = docs[old_id], docs[new_id]
        item_kinds = set()
        for event in sorted(set(o) | set(n), key=lambda e: (e is None, e)):
            if event not in o:
                item_kinds.add("event added"); event_changes[("added", event)] += 1; continue
            if event not in n:
                item_kinds.add("event removed"); event_changes[("removed", event)] += 1; continue
            changed, added, removed, reordered = diff_event(o[event], n[event])
            if reordered:
                item_kinds.add("reordered only")
            for s_old, s_new, fields in changed:
                if not fields:
                    item_kinds.add("derived text only"); continue
                item_kinds.add("effect changed")
                for f, a, b in fields:
                    signatures[(s_old["spell_id"], f)] += 1
                    if not isinstance(a, (list, dict)) and not isinstance(b, (list, dict)):
                        transitions[(s_old["spell_id"], f, a, b)] += 1
                    if len(examples[(s_old["spell_id"], f)]) < 2:
                        examples[(s_old["spell_id"], f)].append((aoid, name, a, b))
            for s in added:
                item_kinds.add("effect added"); added_ids[s["spell_id"]] += 1
            for s in removed:
                item_kinds.add("effect removed"); removed_ids[s["spell_id"]] += 1
        if not item_kinds:
            item_kinds.add("no visible difference")
        kinds[" + ".join(sorted(item_kinds))] += 1

    print(f"{old_slug} -> {new_slug}: {len(pairs)} items with a different spells_hash")
    print("\nPer-item outcome:")
    for k, c in kinds.most_common(15):
        print(f"  {c:7}  {k}")
    print("\nChanged fields by (spell_id, field):")
    for (sid, f), c in signatures.most_common(15):
        ex = "; ".join(f"{a}: {x!r}->{y!r}"[:90] for a, _n, x, y in examples[(sid, f)])
        print(f"  {c:7}  {sid} {f}   e.g. {ex}")
    print("\nMost common value transitions:")
    for (sid, f, a, b), c in transitions.most_common(12):
        print(f"  {c:7}  {sid} {f}: {a!r} -> {b!r}")
    print("\nAdded effects by spell_id:", added_ids.most_common(8))
    print("Removed effects by spell_id:", removed_ids.most_common(8))
    print("Events added/removed:", event_changes.most_common(6))


main()
