"""Compare one build between the content-addressed store and the current store.

Every item of the build is rebuilt from the new store's parts, loaded from the
current store (shared tables in schema ``gd``, the build's ``gv_<slug>`` schema
for curated tables), brought to one canonical form and compared part by part.
The current store is only read.

Canonical form (the rules of app/core/parts.py, applied to both sides):

- Stats, attack/defense entries, events, actions and the effects of an event
  are compared without regard to order; a stat/value pair counts once.
- Criteria of an action are compared as a sequence. Criteria of an effect are
  compared as a set: the current store keeps them de-duplicated and unordered.
- An attack/defense block without entries is the same as none.
- StaticInstance (stat 23) is compared on its own: the new store keeps it
  outside the stat set.
- An effect's rendered description is not compared; its format template is
  compared per effect type.
- A nano's stats are compared with stat 75 and 1003 replaced by the effective
  strain and substrain of ``nano_properties``, as the read path will serve them.

Also compared: item counts, nano properties (strain, substrain, school,
professions, minimum level), symbiant rows, and the curated data as the build
is served with it: perks, mobs, sources and item-source links, after the
feature-flag and presence rules of database/cas/002_curated_and_derived.sql.

Known defect of the current store: it holds the apostrophe in a mob's location
as ``\\'`` (``Razor\\'s Lair``). That is read as ``'`` on the current store's
side, in a mob's location and nowhere else.

The current store does not hold shop data, keeps effect criteria unordered and
has no effect descriptions of its own to compare, so those are checked against
the raw extract only: every rebuilt item is compared, document by document,
with the extract split by parts.py. A build check therefore needs
``--extracts-dir``. ``--skip-extract`` leaves that comparison out; the run
then says so and is not a complete check of the build.

With ``--store`` the store is checked as a whole instead: each search
projection is derived again in SQL from the part documents, the presence,
change-log and strain-policy rules of database/cas/001_store.sql and
002_curated_and_derived.sql are tested, the change log is checked against the
rules files (every entry classified as change_relevance.toml says, notes as
build_notes.toml defines them, 003_change_analysis.sql), and the item count
of every build is compared with the current store.

Usage: python tools/verify_cas.py SLUG --extracts-dir DIR [--schema cas]
                                  [--show N] [--against OTHER_SLUG]
       python tools/verify_cas.py SLUG --skip-extract [--schema cas] ...
       python tools/verify_cas.py --store [--schema cas]
Exit status is 1 if anything differs, 2 if the check cannot be run (no store,
no extract, a build that one of the stores does not hold, bad arguments).
"""

import argparse
import collections
import json
import os
import sys
from pathlib import Path

import psycopg

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core import cas_store, change_analysis  # noqa: E402
from app.core.change_rules import RELEVANCE_BITS, default_rules  # noqa: E402
from app.core.parts import PART_NAMES, split_item  # noqa: E402

ITEM_PARTS = (
    "scalars",
    "text",
    "stats",
    "static_instance",
    "effects",
    "actions",
    "atkdef",
    "mesh",
)
NANO_FIELDS = ("strain", "substrain", "school", "professions", "min_level")
STAT_STATIC_INSTANCE = 23
STAT_STRAIN, STAT_SUBSTRAIN = 75, 1003


def dump(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False)


def effect_key(spell_id, target, tick_count, tick_interval, params, criteria):
    return dump(
        [
            spell_id,
            target,
            tick_count,
            tick_interval,
            params,
            sorted({tuple(c) for c in criteria}),
        ]
    )


# ---------------------------------------------------------------------------
# New store
# ---------------------------------------------------------------------------


def load_build(conn, slug):
    row = conn.execute(
        "SELECT build_id, branch, ordinal, features, overlay_strain_first "
        "FROM build WHERE slug = %s",
        (slug,),
    ).fetchone()
    if row is None:
        fail(f"Build '{slug}' is not in the new store")
    return dict(
        zip(("build_id", "branch", "ordinal", "features", "overlay_strain_first"), row)
    )


PRESENT = """
    item_presence p
    JOIN item_revision r ON r.rev_id = p.rev_id
"""
IN_BUILD = "p.branch = %(branch)s AND p.from_ordinal <= %(ordinal)s AND p.to_ordinal >= %(ordinal)s"


def new_items(conn, build):
    """``({aoid: canonical item}, {aoid: nano fields}, {aoid: part documents})``."""
    rows = conn.execute(
        f"""
        SELECT r.aoid, r.is_nano, r.ql, r.item_class, t.name, t.description,
               s.doc, e.doc, a.doc, d.doc, m.doc,
               np.rev_id IS NOT NULL, np.strain, np.substrain, np.school,
               np.professions, np.min_level
        FROM {PRESENT}
        JOIN part_text t ON t.text_id = r.text_id
        JOIN part_stats s ON s.stats_id = r.stats_id
        LEFT JOIN part_effects e ON e.effects_id = r.effects_id
        LEFT JOIN part_actions a ON a.actions_id = r.actions_id
        LEFT JOIN part_atkdef d ON d.atkdef_id = r.atkdef_id
        LEFT JOIN part_misc m ON m.misc_id = r.misc_id
        LEFT JOIN nano_properties np ON np.rev_id = r.rev_id
            AND np.overlay_strain_first = %(policy)s
        WHERE {IN_BUILD}
        """,
        {**build, "policy": build["overlay_strain_first"]},
    )
    items, nanos, documents = {}, {}, {}
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
        has_np,
        strain,
        substrain,
        school,
        professions,
        min_level,
    ) in rows:
        misc = misc or {}
        documents[aoid] = {
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
        pairs = {tuple(pair) for pair in stats}
        if is_nano and has_np:
            pairs = {p for p in pairs if p[0] not in (STAT_STRAIN, STAT_SUBSTRAIN)}
            if strain is not None:
                pairs.add((STAT_STRAIN, strain))
            if substrain is not None:
                pairs.add((STAT_SUBSTRAIN, substrain))
            nanos[aoid] = dict(
                zip(
                    NANO_FIELDS,
                    (strain, substrain, school, sorted(professions), min_level),
                )
            )
        items[aoid] = {
            "scalars": (is_nano, ql, item_class),
            "text": (name, description),
            "stats": sorted(pairs),
            "static_instance": sorted(misc.get("static_instance") or []),
            "effects": sorted(
                (
                    event["event"],
                    sorted(
                        effect_key(
                            x["spell_id"],
                            x["target"],
                            x["tick_count"],
                            x["tick_interval"],
                            x["params"],
                            x["criteria"],
                        )
                        for x in event["effects"]
                    ),
                )
                for event in effects or []
            ),
            "actions": sorted(
                (action["action"], [tuple(c) for c in action["criteria"]])
                for action in actions or []
            ),
            "atkdef": (
                (
                    sorted(map(tuple, atkdef["attack"])),
                    sorted(map(tuple, atkdef["defense"])),
                )
                if atkdef
                else None
            ),
            "mesh": (
                {k: tuple(v) for k, v in misc["animation_mesh"].items()}
                if misc.get("animation_mesh")
                else None
            ),
        }
    return items, nanos, documents


# ---------------------------------------------------------------------------
# Current store
# ---------------------------------------------------------------------------

VERSION_ITEMS = (
    "WITH v AS MATERIALIZED "
    "(SELECT id, aoid FROM gd.items WHERE vids @> ARRAY[%(vid)s]::smallint[]) "
)


def current_items(conn, vid):
    """``({aoid: canonical item}, {aoid: nano fields}, {spell_id: {formats}})``."""
    params = {"vid": vid}
    by_id = {}
    for (
        item_id,
        aoid,
        name,
        ql,
        description,
        item_class,
        is_nano,
        atkdef_id,
        mesh_id,
    ) in conn.execute(
        "SELECT id, aoid, name, ql, description, item_class, is_nano, atkdef_id, "
        "animation_mesh_id FROM gd.items WHERE vids @> ARRAY[%(vid)s]::smallint[]",
        params,
    ):
        by_id[item_id] = {
            "aoid": aoid,
            "scalars": (bool(is_nano), ql, item_class),
            "text": (name, description or ""),
            "stats": [],
            "static_instance": [],
            "effects": collections.defaultdict(list),
            "actions": [],
            "atkdef": None,
            "mesh": None,
            "_atkdef_id": atkdef_id,
            "_mesh_id": mesh_id,
        }

    for item_id, stats, values in conn.execute(
        VERSION_ITEMS + "SELECT s.item_id, array_agg(sv.stat), array_agg(sv.value) "
        "FROM v JOIN gd.item_stats s ON s.item_id = v.id "
        "JOIN gd.stat_values sv ON sv.id = s.stat_value_id GROUP BY s.item_id",
        params,
    ):
        item = by_id[item_id]
        pairs = set(zip(stats, values))
        item["stats"] = sorted(p for p in pairs if p[0] != STAT_STATIC_INSTANCE)
        item["static_instance"] = sorted(
            v for s, v in pairs if s == STAT_STATIC_INSTANCE
        )

    for item_id, action, v1, v2, op in conn.execute(
        VERSION_ITEMS + "SELECT a.item_id, a.action, "
        "array_agg(c.value1 ORDER BY ac.order_index, ac.id) FILTER (WHERE c.id IS NOT NULL), "
        "array_agg(c.value2 ORDER BY ac.order_index, ac.id) FILTER (WHERE c.id IS NOT NULL), "
        "array_agg(c.operator ORDER BY ac.order_index, ac.id) FILTER (WHERE c.id IS NOT NULL) "
        "FROM v JOIN gd.actions a ON a.item_id = v.id "
        "LEFT JOIN gd.action_criteria ac ON ac.action_id = a.id "
        "LEFT JOIN gd.criteria c ON c.id = ac.criterion_id GROUP BY a.id",
        params,
    ):
        by_id[item_id]["actions"].append(
            (action, list(zip(v1 or [], v2 or [], op or [])))
        )

    criteria = {}
    for spell, v1, v2, op in conn.execute(
        VERSION_ITEMS
        + "SELECT sc.spell_id, array_agg(c.value1), array_agg(c.value2), array_agg(c.operator) "
        "FROM v JOIN gd.item_spell_data isd ON isd.item_id = v.id "
        "JOIN gd.spell_data_spells sds ON sds.spell_data_id = isd.spell_data_id "
        "JOIN gd.spell_criteria sc ON sc.spell_id = sds.spell_id "
        "JOIN gd.criteria c ON c.id = sc.criterion_id GROUP BY sc.spell_id",
        params,
    ):
        criteria[spell] = list(zip(v1, v2, op))

    formats = collections.defaultdict(set)
    for (
        item_id,
        spell_data_id,
        event,
        spell,
        target,
        tick_count,
        tick_interval,
        spell_id,
        spell_format,
        spell_params,
    ) in conn.execute(
        VERSION_ITEMS
        + "SELECT isd.item_id, sd.id, sd.event, s.id, s.target, s.tick_count, "
        "s.tick_interval, s.spell_id, s.spell_format, s.spell_params "
        "FROM v JOIN gd.item_spell_data isd ON isd.item_id = v.id "
        "JOIN gd.spell_data sd ON sd.id = isd.spell_data_id "
        "LEFT JOIN gd.spell_data_spells sds ON sds.spell_data_id = sd.id "
        "LEFT JOIN gd.spells s ON s.id = sds.spell_id",
        params,
    ):
        effects = by_id[item_id]["effects"][(spell_data_id, event)]
        if spell is None:
            continue
        formats[spell_id].add(spell_format)
        spell_params = {
            k: v for k, v in spell_params.items() if k != "SpellDescription"
        }
        effects.append(
            effect_key(
                spell_id,
                target,
                tick_count,
                tick_interval,
                spell_params,
                criteria.get(spell, []),
            )
        )

    attack_defense = collections.defaultdict(lambda: ([], []))
    for index, table in enumerate(("attack_defense_attack", "attack_defense_defense")):
        for atkdef_id, stat, value in conn.execute(
            VERSION_ITEMS
            + f"SELECT x.attack_defense_id, sv.stat, sv.value FROM gd.{table} x "
            "JOIN gd.stat_values sv ON sv.id = x.stat_value_id "
            "WHERE x.attack_defense_id IN (SELECT atkdef_id FROM gd.items i JOIN v ON v.id = i.id)",
            params,
        ):
            attack_defense[atkdef_id][index].append((stat, value))

    meshes = {}
    for mesh_id, a_stat, a_value, m_stat, m_value in conn.execute(
        VERSION_ITEMS
        + "SELECT am.id, a.stat, a.value, m.stat, m.value FROM gd.animation_mesh am "
        "LEFT JOIN gd.stat_values a ON a.id = am.animation_id "
        "LEFT JOIN gd.stat_values m ON m.id = am.mesh_id "
        "WHERE am.id IN (SELECT animation_mesh_id FROM gd.items i JOIN v ON v.id = i.id)",
        params,
    ):
        mesh = {}
        if a_stat is not None:
            mesh["animation"] = (a_stat, a_value)
        if m_stat is not None:
            mesh["mesh"] = (m_stat, m_value)
        meshes[mesh_id] = mesh or None

    nanos = {}
    for item_id, school, professions, min_level, strain in conn.execute(
        VERSION_ITEMS
        + "SELECT np.item_id, np.school, np.professions, np.min_level, np.strain "
        "FROM v JOIN gd.nano_properties np ON np.item_id = v.id",
        params,
    ):
        item = by_id[item_id]
        substrains = [v for s, v in item["stats"] if s == STAT_SUBSTRAIN]
        nanos[item["aoid"]] = dict(
            zip(
                NANO_FIELDS,
                (
                    strain,
                    substrains[0] if len(substrains) == 1 else substrains or None,
                    school,
                    sorted(professions or []),
                    min_level,
                ),
            )
        )

    items = {}
    for item in by_id.values():
        if item["aoid"] in items:
            fail(f"Current store holds AOID {item['aoid']} twice in this build")
        item["effects"] = sorted(
            (event, sorted(effects)) for (_, event), effects in item["effects"].items()
        )
        item["actions"].sort()
        block = attack_defense.get(item.pop("_atkdef_id"))
        if block and (block[0] or block[1]):
            item["atkdef"] = (sorted(set(block[0])), sorted(set(block[1])))
        item["mesh"] = meshes.get(item.pop("_mesh_id"))
        items[item.pop("aoid")] = item
    return items, nanos, formats


# ---------------------------------------------------------------------------
# Comparison and report
# ---------------------------------------------------------------------------


class Report:
    def __init__(self, show):
        self.show = show
        self.differences = 0

    def section(self, title):
        print(f"\n{title}")

    def compare_maps(self, label, new, old, fields=None, other="current"):
        """Compare two ``{key: value}`` maps; with ``fields`` the values are
        dicts compared field by field. ``other`` names the side the new store
        is compared with. Returns the number of differences."""
        self.other = other
        only_new = sorted(set(new) - set(old))
        only_old = sorted(set(old) - set(new))
        both = sorted(set(new) & set(old))
        total = len(only_new) + len(only_old)
        print(
            f"  {label}: new store {len(new)}, {other} {len(old)}, "
            f"only in new {len(only_new)}, only in {other} {len(only_old)}"
        )
        for name, keys, side in (
            ("only in new", only_new, new),
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
            print(f"        new:     {self._short(new[key])}")
            print(f"        {self.other + ':':<8} {self._short(old[key])}")
        return len(different)

    @staticmethod
    def _short(value, limit=600):
        text = dump(value) if not isinstance(value, str) else value
        return text if len(text) <= limit else text[:limit] + f"... ({len(text)} chars)"

    def fail(self, message):
        self.differences += 1
        print(f"    {message}")


def narrow(new, old):
    """For two differing lists, only the entries that are not on both sides."""
    if isinstance(new, list) and isinstance(old, list):
        new_only = [x for x in new if x not in old]
        old_only = [x for x in old if x not in new]
        return new_only, old_only
    return new, old


def compare_items(report, new, old):
    report.section("Items")
    only_new, only_old = sorted(set(new) - set(old)), sorted(set(old) - set(new))
    print(
        f"  items: new store {len(new)}, current store {len(old)}, "
        f"only in new {len(only_new)}, only in current {len(only_old)}"
    )
    for name, keys, side in (
        ("only in new", only_new, new),
        ("only in current", only_old, old),
    ):
        for aoid in keys[: report.show]:
            print(f"    {name}: {aoid} {side[aoid]['text'][0]!r}")
    report.differences += len(only_new) + len(only_old)
    both = sorted(set(new) & set(old))
    for part in ITEM_PARTS:
        different = [aoid for aoid in both if new[aoid][part] != old[aoid][part]]
        print(f"  {part:16} {len(different):7} of {len(both)} differ")
        for aoid in different[: report.show]:
            a, b = narrow(new[aoid][part], old[aoid][part])
            print(f"      {aoid} {new[aoid]['text'][0]!r}")
            print(f"        new:     {report._short(a)}")
            print(f"        current: {report._short(b)}")
        report.differences += len(different)


def compare_formats(report, conn, formats):
    report.section("Effect formats")
    new = dict(conn.execute("SELECT spell_id, format FROM effect_type").fetchall())
    wrong = {
        spell_id: sorted(f or "" for f in found)
        for spell_id, found in formats.items()
        if found != {new.get(spell_id)}
    }
    print(
        f"  effect types in this build: {len(formats)}, with another format: {len(wrong)}"
    )
    for spell_id in sorted(wrong)[: report.show]:
        report.fail(f"{spell_id}: new {new.get(spell_id)!r}, current {wrong[spell_id]}")
    report.differences += max(0, len(wrong) - report.show)


def compare_derived(report, conn, build, gv, new_nanos, old_nanos):
    report.section("Nano properties")
    report.compare_maps("nanos", new_nanos, old_nanos, NANO_FIELDS)

    report.section("Symbiants")
    new = {
        row[0]: row[1:]
        for row in conn.execute(
            f"SELECT s.aoid, s.name, s.ql, s.slot_id, s.family FROM {PRESENT} "
            f"JOIN symbiant_items s ON s.rev_id = r.rev_id WHERE {IN_BUILD}",
            build,
        )
    }
    old = {
        row[0]: row[1:]
        for row in conn.execute(
            f'SELECT aoid, name, ql, slot_id, family FROM "{gv}".symbiant_items'
        )
    }
    report.compare_maps("symbiant rows", new, old)


def compare_curated(report, conn, build, gv):
    features = build["features"]
    present = f"SELECT r.aoid, r.text_id FROM {PRESENT} WHERE {IN_BUILD}"

    report.section(f"Perks (feature flag {'on' if features.get('perks') else 'off'})")
    columns = (
        "k.name, k.perk_series, k.counter, k.type, k.level_required, "
        "k.ai_level_required, k.professions, k.breeds"
    )
    new = {}
    if features.get("perks"):
        new = {
            row[0]: row[1:]
            for row in conn.execute(
                f"SELECT k.aoid, {columns} FROM perk k "
                f"WHERE k.aoid IN (SELECT aoid FROM ({present}) x)",
                build,
            )
        }
    old = {
        row[0]: row[1:]
        for row in conn.execute(
            f'SELECT i.aoid, {columns} FROM "{gv}".perks k JOIN "{gv}".items i ON i.id = k.item_id'
        )
    }
    report.compare_maps("perks", new, old)

    report.section(
        f"Mobs (feature flag {'on' if features.get('symbiants') else 'off'})"
    )
    columns = "name, level, playfield, location, mob_names, is_pocket_boss, metadata"
    new = {}
    if features.get("symbiants"):
        new = {
            row[0]: row[1:]
            for row in conn.execute(
                f"SELECT mob_id, {columns} FROM mob WHERE NOT retired"
            )
        }
    old = {
        mob_id: (name, level, playfield, location and location.replace("\\'", "'"))
        + tuple(rest)
        for mob_id, name, level, playfield, location, *rest in conn.execute(
            f'SELECT id, {columns} FROM "{gv}".mobs'
        )
    }
    report.compare_maps("mobs", new, old)

    report.section(
        f"Sources (feature flags: sources {'on' if features.get('sources') else 'off'}, "
        f"symbiants {'on' if features.get('symbiants') else 'off'})"
    )
    flags = {
        "mobs": bool(features.get("symbiants")),
        "items": bool(features.get("sources")),
    }
    # A link is served when its item is present and its source is: a mob source
    # under the symbiants flag, an item source under the sources flag when the
    # source item is present. An item source is named by that item in this build.
    # Sources are compared through their served links: the current store has no
    # row for a crystal none of whose nanos is in the build.
    served = f"""
        SELECT i.aoid, st.name, s.entity_id, COALESCE(s.name, ct.name), s.metadata,
               l.drop_rate, l.min_ql, l.max_ql, l.conditions,
               CASE WHEN st.name = 'item'
                    THEN l.metadata || jsonb_build_object('crystal_name', ct.name)
                    ELSE l.metadata END
        FROM item_source l
        JOIN source s ON s.source_id = l.source_id
        JOIN source_type st ON st.source_type_id = s.source_type_id
        JOIN ({present}) i ON i.aoid = l.aoid
        LEFT JOIN ({present}) c ON st.name = 'item' AND c.aoid = s.entity_id
        LEFT JOIN part_text ct ON ct.text_id = c.text_id
        WHERE (st.name = 'mob' AND %(mobs)s)
           OR (st.name = 'item' AND %(items)s AND c.aoid IS NOT NULL)
    """
    new_links, new_sources = {}, {}
    for (
        aoid,
        type_name,
        entity,
        name,
        source_meta,
        drop_rate,
        min_ql,
        max_ql,
        conditions,
        link_meta,
    ) in conn.execute(served, {**build, **flags}):
        new_links[(aoid, type_name, entity)] = (
            drop_rate,
            min_ql,
            max_ql,
            conditions,
            link_meta,
        )
        new_sources[(type_name, entity)] = (name, source_meta)
    old_links, old_sources = {}, {}
    for type_name, entity, name, source_meta in conn.execute(
        f'SELECT st.name, s.source_id, s.name, s.metadata FROM "{gv}".sources s '
        f'JOIN "{gv}".source_types st ON st.id = s.source_type_id'
    ):
        old_sources[(type_name, entity)] = (name, source_meta)
    for (
        aoid,
        type_name,
        entity,
        drop_rate,
        min_ql,
        max_ql,
        conditions,
        link_meta,
    ) in conn.execute(
        f"SELECT i.aoid, st.name, s.source_id, l.drop_rate, l.min_ql, l.max_ql, "
        f'l.conditions, l.metadata FROM "{gv}".item_sources l '
        f'JOIN "{gv}".items i ON i.id = l.item_id '
        f'JOIN "{gv}".sources s ON s.id = l.source_id '
        f'JOIN "{gv}".source_types st ON st.id = s.source_type_id'
    ):
        old_links[(aoid, type_name, entity)] = (
            drop_rate,
            min_ql,
            max_ql,
            conditions,
            link_meta,
        )
    report.compare_maps("item-source links", new_links, old_links)
    report.compare_maps("sources with a served link", new_sources, old_sources)

    new_types = dict(
        (row[0], row[1:])
        for row in conn.execute(
            "SELECT source_type_id, name, description FROM source_type"
        )
    )
    old_types = dict(
        (row[0], row[1:])
        for row in conn.execute(
            f'SELECT id, name, description FROM "{gv}".source_types'
        )
    )
    report.compare_maps("source types", new_types, old_types)


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
    """``(part, path, stored relevance)`` of the shared transitions whose
    class is not what ``change_relevance.toml`` gives their field."""
    return [
        (part, path, stored)
        for part, path, stored in conn.execute(
            "SELECT DISTINCT part, path, relevance FROM build_transition"
        )
        if stored != RELEVANCE_BITS[rules.relevance.transition_class(part, path)]
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


def check_store(report, conn):
    """Checks that hold for the store as a whole, whatever the build."""
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

    report.section("Item count of every build against the current store")
    new = dict(conn.execute("SELECT slug, item_count FROM build").fetchall())
    old = dict(
        conn.execute(
            "SELECT g.slug, c.items FROM public.game_versions g JOIN "
            "(SELECT v, count(*) AS items FROM gd.items, unnest(vids) v GROUP BY v) c "
            "ON c.v = g.vid"
        ).fetchall()
    )
    report.compare_maps("builds", new, old)


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
        "against the part documents, presence and change-log rules, and the "
        "item count of every build against the current store",
    )
    parser.add_argument("--schema", default="cas")
    parser.add_argument(
        "--extracts-dir",
        default=None,
        help="extracts folder; a build check compares every part document with "
        "the raw extract (required for a build unless --skip-extract)",
    )
    parser.add_argument(
        "--skip-extract",
        action="store_true",
        help="check a build against the current store only: effect criteria "
        "order, effect descriptions and shop data stay unchecked",
    )
    parser.add_argument("--show", type=int, default=3, help="examples per difference")
    parser.add_argument(
        "--against",
        default=None,
        help="build of the current store to compare with (default: SLUG); another "
        "build here shows what the tool reports when the stores disagree",
    )
    args = parser.parse_args()

    if bool(args.slug) == args.store:
        parser.error("give a build slug or --store")
    if args.slug and bool(args.extracts_dir) == args.skip_extract:
        parser.error(
            "a build check needs --extracts-dir DIR: effect criteria order, effect "
            "descriptions and shop data are only checked against the raw extract "
            "(--skip-extract leaves them unchecked, and not both)"
        )
    conn = open_store(args.schema)
    if args.store:
        report = Report(args.show)
        check_store(report, conn)
        print(f"\nstore {args.schema}: {report.differences} difference(s)")
        return 1 if report.differences else 0
    build = load_build(conn, args.slug)
    against = args.against or args.slug
    registered = conn.execute(
        "SELECT vid, schema_name FROM public.game_versions WHERE slug = %s", (against,)
    ).fetchone()
    if registered is None or registered[0] is None:
        fail(f"Build '{against}' is not in the current store")
    vid, gv = registered
    extract = None
    if args.extracts_dir:
        extract_slug = conn.execute(
            "SELECT extract_slug FROM build WHERE slug = %s", (args.slug,)
        ).fetchone()[0]
        extract = Path(args.extracts_dir).expanduser() / extract_slug
        for name in ("items.json", "nanos.json"):
            if not (extract / name).is_file():
                fail(f"No extract to compare with: {extract / name} not found")

    print(
        f"Build {args.slug}: new store schema {args.schema} "
        f"(branch {build['branch']}, ordinal {build['ordinal']}), "
        f"current store {gv} (vid {vid})"
    )
    report = Report(args.show)
    new, new_nanos, documents = new_items(conn, build)
    old, old_nanos, formats = current_items(conn, vid)
    compare_items(report, new, old)
    compare_formats(report, conn, formats)
    compare_derived(report, conn, build, gv, new_nanos, old_nanos)
    compare_curated(report, conn, build, gv)
    if extract is not None:
        compare_extract(report, documents, extract.parent, extract.name)

    print(f"\n{args.slug}: {report.differences} difference(s)")
    if extract is None:
        print(
            "WARNING: INCOMPLETE CHECK (--skip-extract). Not compared with the raw "
            "extract: effect criteria order, effect descriptions, shop data."
        )
    return 1 if report.differences else 0


if __name__ == "__main__":
    sys.exit(main())
