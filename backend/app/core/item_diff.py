"""
Field-level diff of two revisions of an item.

Pure functions over the part documents of app/core/parts.py: no database, no
build. ``diff_parts`` takes the documents of the old and of the new revision
(a part the revision lacks is ``None``) and returns, per part, a list of
changes that a UI can render and a person can read as patch notes.
``transitions`` flattens such a diff into item-independent field transitions
("effect 53045 target 2 -> 3"), the unit in which a build's changes are
counted and build notes are defined (app/core/change_analysis.py).

What each part reports
======================

``text``     ``{"field": "name" | "description", "old", "new"}``.

``stats``    one entry per stat whose values differ: ``{"stat", "change":
             "added" | "removed" | "changed", "old", "new"}``. A stat in
             ``FLAG_STATS`` is a bitmask and also carries ``bits_set`` and
             ``bits_cleared``, each a list of single-bit values (1, 2, 4, ...).
             A stat the client data holds twice with different values is
             compared as a multiset: values on both sides are unchanged, the
             rest are paired in ascending order and what is left over is
             added or removed.

``attack``, ``defense``
             the same entries as ``stats`` (never flags), per skill.

``actions``  one entry per action whose criteria differ: ``{"action",
             "change", "criteria"}``. ``criteria`` is the whole sequence as a
             diff (see below), so the requirement list can be shown with its
             changes marked.

``effects``  one entry per event that differs: ``{"event", "change": "added"
             | "removed" | "changed" | "renumbered", "old_event", "added",
             "removed", "changed"}``. ``added`` and ``removed`` are effects as
             the part document holds them. ``changed`` pairs an old effect
             with a new one: ``{"old", "new", "fields", "criteria"}``, where
             ``fields`` lists the fixed fields (``target``, ``tick_count``,
             ``tick_interval``) and parameters (``spell_params.<name>``) that
             differ, and ``criteria`` is the sequence diff of the two effects'
             criteria, or ``None`` when they are equal.

``misc``     ``{"field": "static_instance" | "animation_mesh" | "shop", "old",
             "new"}``.

Order never matters where the part documents say it does not (stats,
attack/defense, events, actions, effects within an event): the input is
compared as sets or multisets, so a pure reordering is no change. The output
order is fixed: ascending stat, action and event; effects in the canonical
order of the part documents.

Pairing effects
===============

Within one event, the old and the new effects are matched in three passes.
Each pass only looks at what the passes before left over.

1. *Unchanged.* An old and a new effect that are equal in everything but the
   rendered description are the same effect and are not reported.
2. *Same effect, same target.* An old and a new effect pair when they have the
   same effect type (``spell_id``), the same target and the same subject. The
   subject of an effect is what it acts on: its ``Stat``, ``Skill``,
   ``NanoID``, ``NanoStrain``, ``Item`` and ``PerkID`` parameters, taken
   together; a parameter the effect lacks counts as a value of its own.
3. *Same effect, retargeted.* As pass 2 without the target.

Effects left over are removed (old) and added (new). An old effect is
therefore never paired with a new one of another type or acting on another
subject: "Modify Strength 5" replaced by "Modify Agility 5" is a removal and
an addition, never "Stat changed from Strength to Agility".

When a pass finds several candidates on either side (two modifiers of the
same stat under different criteria), it pairs those that differ in the fewest
fields first; ties go to the effects that come first in canonical order.

An event that is missing on one side is matched to a leftover event of the
other side with exactly the same effects, lowest event numbers first, and
reported as ``renumbered`` (14.5.0 moved every Wear effect from event 14 to
event 0). Events that share a number are compared with each other.

Diffing criteria
================

Criteria are evaluated as a sequence, so they are compared as one: a longest
common subsequence keeps every criterion that stayed (``"op": "same"``), and
between two kept criteria the old and new runs are aligned by the stat they
test (``value1``): a criterion testing the same stat at the same place is
``changed`` (old and new given), anything else is ``removed`` or ``added``.
One criterion inserted in the middle of a list is one ``added`` entry among
``same`` ones, and a criterion that moved shows as removed where it was and
added where it is.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from difflib import SequenceMatcher
from typing import Any, Dict, Hashable, List, NamedTuple, Optional, Sequence, Tuple

from app.core.content_hash import hash_object

# Stats the frontend decodes as bit flags (frontend/src/services/game-data.ts:
# ITEM_NONE_FLAG and NANO_NONE_FLAG, CANFLAG, SPECIALIZATION_FLAG, the slot
# maps, WORN_ITEM, EXPANSION_FLAG).
STAT_FLAGS = 0
STAT_CAN = 30
STAT_SPECIALIZATION = 182
STAT_SLOT = 298
STAT_WORN_ITEM = 355
STAT_EXPANSION = 389
FLAG_STATS = frozenset(
    {
        STAT_FLAGS,
        STAT_CAN,
        STAT_SPECIALIZATION,
        STAT_SLOT,
        STAT_WORN_ITEM,
        STAT_EXPANSION,
    }
)

# Parameters that say what an effect acts on.
SUBJECT_PARAMS = ("Stat", "Skill", "NanoID", "NanoStrain", "Item", "PerkID")

EFFECT_FIELDS = ("target", "tick_count", "tick_interval")
MISC_FIELDS = ("static_instance", "animation_mesh", "shop")
TEXT_FIELDS = ("name", "description")

PARTS = ("text", "stats", "effects", "actions", "attack", "defense", "misc")

Change = Dict[str, Any]
Criterion = Sequence[int]
Effect = Dict[str, Any]


class Transition(NamedTuple):
    """One field going from a value to another, whatever the item.

    ``path`` names the field (see :func:`transitions`); ``old`` and ``new`` are
    JSON scalars, or a ``(value1, value2, operator)`` tuple for a criterion,
    and ``None`` where the side does not exist or the value is particular to
    the item.
    """

    part: str
    path: str
    old: Any
    new: Any


# ---------------------------------------------------------------------------
# Text and misc
# ---------------------------------------------------------------------------


def _field_changes(
    old: Optional[Dict[str, Any]], new: Optional[Dict[str, Any]], fields: Sequence[str]
) -> List[Change]:
    old, new = old or {}, new or {}
    return [
        {"field": name, "old": old.get(name), "new": new.get(name)}
        for name in fields
        if old.get(name) != new.get(name)
    ]


def diff_text(
    old: Optional[Dict[str, str]], new: Optional[Dict[str, str]]
) -> List[Change]:
    return _field_changes(old, new, TEXT_FIELDS)


def diff_misc(
    old: Optional[Dict[str, Any]], new: Optional[Dict[str, Any]]
) -> List[Change]:
    return _field_changes(old, new, MISC_FIELDS)


# ---------------------------------------------------------------------------
# Stats and attack/defense
# ---------------------------------------------------------------------------


def _bits(value: int) -> List[int]:
    """The single-bit values set in ``value``, read as 32 unsigned bits."""
    value &= 0xFFFFFFFF
    return [1 << n for n in range(32) if value >> n & 1]


def _stat_change(stat: int, old: Optional[int], new: Optional[int], flags: bool):
    change: Change = {
        "stat": stat,
        "change": "added" if old is None else "removed" if new is None else "changed",
        "old": old,
        "new": new,
    }
    if flags and stat in FLAG_STATS:
        before, after = set(_bits(old or 0)), set(_bits(new or 0))
        change["bits_set"] = sorted(after - before)
        change["bits_cleared"] = sorted(before - after)
    return change


def _diff_pairs(
    old: Optional[Sequence[Sequence[int]]],
    new: Optional[Sequence[Sequence[int]]],
    flags: bool,
) -> List[Change]:
    before: Dict[int, Counter] = defaultdict(Counter)
    after: Dict[int, Counter] = defaultdict(Counter)
    for stat, value in old or ():
        before[stat][value] += 1
    for stat, value in new or ():
        after[stat][value] += 1
    changes = []
    for stat in sorted(set(before) | set(after)):
        gone = sorted((before[stat] - after[stat]).elements())
        come = sorted((after[stat] - before[stat]).elements())
        for index in range(max(len(gone), len(come))):
            changes.append(
                _stat_change(
                    stat,
                    gone[index] if index < len(gone) else None,
                    come[index] if index < len(come) else None,
                    flags,
                )
            )
    return changes


def diff_stats(
    old: Optional[Sequence[Sequence[int]]], new: Optional[Sequence[Sequence[int]]]
) -> List[Change]:
    return _diff_pairs(old, new, flags=True)


def diff_atkdef(
    old: Optional[Dict[str, Any]], new: Optional[Dict[str, Any]]
) -> Dict[str, List[Change]]:
    old, new = old or {}, new or {}
    return {
        side: _diff_pairs(old.get(side), new.get(side), flags=False)
        for side in ("attack", "defense")
    }


# ---------------------------------------------------------------------------
# Criteria
# ---------------------------------------------------------------------------


def _criterion(criterion: Optional[Criterion]) -> Optional[List[int]]:
    return None if criterion is None else list(criterion)


def _criterion_change(op: str, old: Optional[Criterion], new: Optional[Criterion]):
    return {"op": op, "old": _criterion(old), "new": _criterion(new)}


def diff_criteria(
    old: Optional[Sequence[Criterion]], new: Optional[Sequence[Criterion]]
) -> List[Change]:
    """The sequence diff of two criteria lists: every criterion of either
    side once, in order, as ``same``, ``changed``, ``removed`` or ``added``."""
    before = [tuple(c) for c in old or ()]
    after = [tuple(c) for c in new or ()]
    changes: List[Change] = []
    matcher = SequenceMatcher(None, before, after, autojunk=False)
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            changes += [_criterion_change("same", c, c) for c in before[i1:i2]]
            continue
        gone, come = before[i1:i2], after[j1:j2]
        by_stat = SequenceMatcher(
            None, [c[0] for c in gone], [c[0] for c in come], autojunk=False
        )
        for inner, a1, a2, b1, b2 in by_stat.get_opcodes():
            if inner == "equal":
                changes += [
                    _criterion_change("changed", o, n)
                    for o, n in zip(gone[a1:a2], come[b1:b2])
                ]
                continue
            changes += [_criterion_change("removed", o, None) for o in gone[a1:a2]]
            changes += [_criterion_change("added", None, n) for n in come[b1:b2]]
    return changes


def _criteria_differ(changes: Sequence[Change]) -> bool:
    return any(change["op"] != "same" for change in changes)


# ---------------------------------------------------------------------------
# Actions
# ---------------------------------------------------------------------------


def _grouped(entries: Optional[Sequence[Dict[str, Any]]], key: str):
    groups: Dict[int, List[Dict[str, Any]]] = defaultdict(list)
    for entry in entries or ():
        groups[entry[key]].append(entry)
    return groups


def diff_actions(
    old: Optional[Sequence[Dict[str, Any]]], new: Optional[Sequence[Dict[str, Any]]]
) -> List[Change]:
    before, after = _grouped(old, "action"), _grouped(new, "action")
    changes = []
    for action in sorted(set(before) | set(after)):
        gone, come = _without_common(
            before[action], after[action], lambda a: _hashable(a["criteria"])
        )
        for index in range(max(len(gone), len(come))):
            o = gone[index]["criteria"] if index < len(gone) else None
            n = come[index]["criteria"] if index < len(come) else None
            changes.append(
                {
                    "action": action,
                    "change": (
                        "added" if o is None else "removed" if n is None else "changed"
                    ),
                    "criteria": diff_criteria(o, n),
                }
            )
    return changes


# ---------------------------------------------------------------------------
# Effects
# ---------------------------------------------------------------------------


def _hashable(value: Any) -> Hashable:
    if isinstance(value, dict):
        return tuple(sorted((key, _hashable(item)) for key, item in value.items()))
    if isinstance(value, (list, tuple)):
        return tuple(_hashable(item) for item in value)
    return value


def effect_content(effect: Effect) -> Hashable:
    """An effect as a value: everything but its rendered description."""
    return _hashable({k: v for k, v in effect.items() if k != "description"})


def _canonical_order(effect: Effect) -> Tuple:
    params = effect["params"]
    return (
        effect["spell_id"],
        effect["target"] if effect["target"] is not None else -1,
        tuple(
            params[k] if isinstance(params.get(k), int) else -1 for k in SUBJECT_PARAMS
        ),
        hash_object({k: v for k, v in effect.items() if k != "description"}),
    )


def effect_subject(effect: Effect) -> Tuple:
    """What an effect acts on: its subject parameters, taken together."""
    params = effect["params"]
    return tuple(_hashable(params.get(name)) for name in SUBJECT_PARAMS)


def _without_common(old: Sequence[Any], new: Sequence[Any], key) -> Tuple[List, List]:
    """``old`` and ``new`` without the entries they share (as multisets)."""
    shared = Counter(key(entry) for entry in new)
    rest_old = []
    for entry in old:
        content = key(entry)
        if shared[content] > 0:
            shared[content] -= 1
        else:
            rest_old.append(entry)
    rest_new = []
    kept = Counter(key(entry) for entry in old)
    for entry in new:
        content = key(entry)
        if kept[content] > 0:
            kept[content] -= 1
        else:
            rest_new.append(entry)
    return rest_old, rest_new


def effect_field_changes(old: Effect, new: Effect) -> List[Change]:
    """The fixed fields and parameters in which two effects differ."""
    changes = [
        {"field": name, "old": old[name], "new": new[name]}
        for name in EFFECT_FIELDS
        if old[name] != new[name]
    ]
    before, after = old["params"], new["params"]
    for name in sorted(set(before) | set(after)):
        if before.get(name) != after.get(name):
            changes.append(
                {
                    "field": f"spell_params.{name}",
                    "old": before.get(name),
                    "new": after.get(name),
                }
            )
    return changes


def _pair_changed(old: Effect, new: Effect) -> Change:
    criteria = diff_criteria(old["criteria"], new["criteria"])
    return {
        "old": old,
        "new": new,
        "fields": effect_field_changes(old, new),
        "criteria": criteria if _criteria_differ(criteria) else None,
    }


def _distance(pair: Change) -> int:
    return len(pair["fields"]) + (pair["criteria"] is not None)


def _pair_effects(old: List[Effect], new: List[Effect], identity):
    """One pairing pass: (pairs, old left over, new left over)."""
    candidates: Dict[Hashable, List[int]] = defaultdict(list)
    for index, effect in enumerate(new):
        candidates[identity(effect)].append(index)
    scored = []
    for i, effect in enumerate(old):
        for j in candidates.get(identity(effect), ()):
            pair = _pair_changed(effect, new[j])
            scored.append((_distance(pair), i, j, pair))
    scored.sort(key=lambda entry: entry[:3])
    used_old, used_new, pairs = set(), set(), []
    for _, i, j, pair in scored:
        if i not in used_old and j not in used_new:
            used_old.add(i)
            used_new.add(j)
            pairs.append((i, pair))
    pairs.sort(key=lambda entry: entry[0])
    return (
        [pair for _, pair in pairs],
        [e for i, e in enumerate(old) if i not in used_old],
        [e for j, e in enumerate(new) if j not in used_new],
    )


def diff_event_effects(
    old: Sequence[Effect], new: Sequence[Effect]
) -> Tuple[List[Change], List[Effect], List[Effect]]:
    """``(changed, added, removed)`` between the effects of one event, by the
    pairing rule of the module docstring."""
    rest_old, rest_new = _without_common(old, new, effect_content)
    rest_old.sort(key=_canonical_order)
    rest_new.sort(key=_canonical_order)
    changed: List[Change] = []
    for identity in (
        lambda e: (e["spell_id"], e["target"], effect_subject(e)),
        lambda e: (e["spell_id"], effect_subject(e)),
    ):
        pairs, rest_old, rest_new = _pair_effects(rest_old, rest_new, identity)
        changed += pairs
    changed.sort(key=lambda pair: _canonical_order(pair["new"]))
    return changed, rest_new, rest_old


def _event_content(event: Dict[str, Any]) -> Hashable:
    return frozenset(Counter(map(effect_content, event["effects"])).items())


def _event_change(event: int, change: str, old_event: Optional[int] = None) -> Change:
    return {
        "event": event,
        "change": change,
        "old_event": old_event,
        "added": [],
        "removed": [],
        "changed": [],
    }


def diff_effects(
    old: Optional[Sequence[Dict[str, Any]]], new: Optional[Sequence[Dict[str, Any]]]
) -> List[Change]:
    before, after = _grouped(old, "event"), _grouped(new, "event")
    changes: List[Change] = []
    gone_events: List[Dict[str, Any]] = []
    come_events: List[Dict[str, Any]] = []
    for number in sorted(set(before) | set(after)):
        gone, come = _without_common(before[number], after[number], _event_content)
        for o, n in zip(gone, come):
            changed, added, removed = diff_event_effects(o["effects"], n["effects"])
            entry = _event_change(number, "changed")
            entry.update(added=added, removed=removed, changed=changed)
            changes.append(entry)
        gone_events += gone[len(come) :]
        come_events += come[len(gone) :]

    renumbered_from = set()
    for event in come_events:
        content = _event_content(event)
        source = next(
            (
                index
                for index, candidate in enumerate(gone_events)
                if index not in renumbered_from and _event_content(candidate) == content
            ),
            None,
        )
        if source is None:
            entry = _event_change(event["event"], "added")
            entry["added"] = sorted(event["effects"], key=_canonical_order)
        else:
            renumbered_from.add(source)
            entry = _event_change(
                event["event"], "renumbered", gone_events[source]["event"]
            )
        changes.append(entry)
    for index, event in enumerate(gone_events):
        if index not in renumbered_from:
            entry = _event_change(event["event"], "removed")
            entry["removed"] = sorted(event["effects"], key=_canonical_order)
            changes.append(entry)
    order = {"removed": 0, "renumbered": 1, "changed": 1, "added": 2}
    changes.sort(key=lambda c: (c["event"], order[c["change"]]))
    return changes


# ---------------------------------------------------------------------------
# Whole item
# ---------------------------------------------------------------------------


def diff_parts(old: Dict[str, Any], new: Dict[str, Any]) -> Dict[str, List[Change]]:
    """The field-level diff of two revisions.

    ``old`` and ``new`` map the part names of app/core/parts.py (``text``,
    ``stats``, ``effects``, ``actions``, ``atkdef``, ``misc``) to the part
    documents; a missing key or ``None`` is a part the revision does not
    have. Every key of ``PARTS`` is in the result, with an empty list when
    that part did not change.
    """
    atkdef = diff_atkdef(old.get("atkdef"), new.get("atkdef"))
    return {
        "text": diff_text(old.get("text"), new.get("text")),
        "stats": diff_stats(old.get("stats"), new.get("stats")),
        "effects": diff_effects(old.get("effects"), new.get("effects")),
        "actions": diff_actions(old.get("actions"), new.get("actions")),
        "attack": atkdef["attack"],
        "defense": atkdef["defense"],
        "misc": diff_misc(old.get("misc"), new.get("misc")),
    }


def is_empty(diff: Dict[str, List[Change]]) -> bool:
    return not any(diff[part] for part in PARTS)


# ---------------------------------------------------------------------------
# Transitions
# ---------------------------------------------------------------------------

_WORD_DELTA_LIMIT = 80


def _word_delta(old: str, new: str) -> Tuple[Optional[str], Optional[str]]:
    """The words only ``old`` has and the words only ``new`` has, or
    ``(None, None)`` when that is too much text to be a pattern."""
    before, after = old.split(), new.split()
    gone: List[str] = []
    come: List[str] = []
    matcher = SequenceMatcher(None, before, after, autojunk=False)
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag != "equal":
            gone += before[i1:i2]
            come += after[j1:j2]
    removed, added = " ".join(gone), " ".join(come)
    if len(removed) > _WORD_DELTA_LIMIT or len(added) > _WORD_DELTA_LIMIT:
        return None, None
    return removed, added


def _scalar(value: Any) -> Any:
    """``value`` if it can stand in a transition, else ``None``."""
    return value if isinstance(value, (int, str, bool)) or value is None else None


def _criteria_transitions(part: str, path: str, criteria: Sequence[Change]):
    return [
        Transition(
            part,
            path,
            None if change["old"] is None else tuple(change["old"]),
            None if change["new"] is None else tuple(change["new"]),
        )
        for change in criteria
        if change["op"] != "same"
    ]


def _subject(effect: Effect) -> Any:
    params = effect["params"]
    return next(
        (params[k] for k in SUBJECT_PARAMS if isinstance(params.get(k), int)), None
    )


def transitions(
    diff: Dict[str, List[Change]], full_text: bool = False
) -> List[Transition]:
    """The field transitions a diff consists of, without what is particular
    to the item, so that the same change on many items counts as one.

    With ``full_text`` a text transition carries the whole old and new text
    instead of the words that differ: what a build note's pattern is matched
    against (app/core/change_rules.py).

    =========  ==================================  ===========================
    part       path                                old -> new
    =========  ==================================  ===========================
    text       ``name``, ``description``           the words only the old and
                                                   only the new text have;
                                                   ``None`` beyond 80 chars
    stats      ``stat:<id>``                       the values
    stats      ``stat:<id>:bit:<bit>``             0 -> 1 set, 1 -> 0 cleared
                                                   (flag stats, instead of the
                                                   line above)
    atkdef     ``attack:<id>``, ``defense:<id>``   the values
    actions    ``action:<id>``                     ``added`` or ``removed``
                                                   as ``new`` or ``old``
    actions    ``action:<id>:criterion``           the criterion triples
    effects    ``event``                           the event numbers of a
                                                   renumbering
    effects    ``event:<id>``                      ``added`` or ``removed``
    effects    ``effect:<spell_id>``               the subject (stat, skill,
                                                   nano, ...) of an effect
                                                   that was removed (``old``)
                                                   or added (``new``); the
                                                   word ``none`` for an
                                                   effect without one
    effects    ``effect:<spell_id>:<field>``       the values of a field of a
                                                   changed effect
    effects    ``effect:<spell_id>:criterion``     the criterion triples
    misc       ``static_instance``, ``shop``       ``None`` (per-item values)
    misc       ``animation_mesh``                  ``None``
    =========  ==================================  ===========================

    A transition appears once per occurrence in the item.
    """
    found: List[Transition] = []
    for change in diff["text"]:
        old, new = change["old"] or "", change["new"] or ""
        delta = (old, new) if full_text else _word_delta(old, new)
        found.append(Transition("text", change["field"], *delta))
    for change in diff["stats"]:
        stat = change["stat"]
        if "bits_set" in change:
            found += [
                Transition("stats", f"stat:{stat}:bit:{bit}", 0, 1)
                for bit in change["bits_set"]
            ]
            found += [
                Transition("stats", f"stat:{stat}:bit:{bit}", 1, 0)
                for bit in change["bits_cleared"]
            ]
        else:
            found.append(
                Transition("stats", f"stat:{stat}", change["old"], change["new"])
            )
    for side in ("attack", "defense"):
        found += [
            Transition("atkdef", f"{side}:{c['stat']}", c["old"], c["new"])
            for c in diff[side]
        ]
    for change in diff["actions"]:
        path = f"action:{change['action']}"
        if change["change"] == "added":
            found.append(Transition("actions", path, None, "added"))
        elif change["change"] == "removed":
            found.append(Transition("actions", path, "removed", None))
        else:
            found += _criteria_transitions(
                "actions", f"{path}:criterion", change["criteria"]
            )
    for event in diff["effects"]:
        if event["change"] == "renumbered":
            found.append(
                Transition("effects", "event", event["old_event"], event["event"])
            )
            continue
        if event["change"] == "added":
            found.append(
                Transition("effects", f"event:{event['event']}", None, "added")
            )
        elif event["change"] == "removed":
            found.append(
                Transition("effects", f"event:{event['event']}", "removed", None)
            )
        for effect in event["removed"]:
            subject = _subject(effect)
            found.append(
                Transition(
                    "effects",
                    f"effect:{effect['spell_id']}",
                    "none" if subject is None else subject,
                    None,
                )
            )
        for effect in event["added"]:
            subject = _subject(effect)
            found.append(
                Transition(
                    "effects",
                    f"effect:{effect['spell_id']}",
                    None,
                    "none" if subject is None else subject,
                )
            )
        for pair in event["changed"]:
            path = f"effect:{pair['new']['spell_id']}"
            found += [
                Transition(
                    "effects",
                    f"{path}:{field['field']}",
                    _scalar(field["old"]),
                    _scalar(field["new"]),
                )
                for field in pair["fields"]
            ]
            found += _criteria_transitions(
                "effects", f"{path}:criterion", pair["criteria"] or ()
            )
    found += [
        Transition("misc", change["field"], None, None) for change in diff["misc"]
    ]
    return found
