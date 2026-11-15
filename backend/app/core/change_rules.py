"""
The maintained rules that describe changes between builds.

Two hand-edited files in ``backend/database`` say what a change means to a
player. Both are read here, validated, and used by the importer
(app/core/change_analysis.py) and by the routes that compare builds.

``change_relevance.toml``: relevance classes
============================================

Every change has a relevance, a set of the classes ``gameplay``, ``economy``,
``cosmetic`` and ``text`` (bits 1, 2, 4 and 8 of ``item_change.relevance``).
The file assigns a class to each stat and each effect type (``spell_id``) and
to the changes that are classified as a whole. A stat or effect type the file
does not list takes ``default``; one listed under ``unclassified`` takes it
knowingly, until a maintainer decides.

The relevance of a change from one revision to another is then:

* ``text`` when the name or description differs;
* the class of every stat whose values differ;
* the class of every effect type of which the two revisions do not hold the
  same effects, wherever in the item (which event) they are;
* the class of ``event`` when the effects differ in nothing but the events
  they hang on (an event renumbered, an empty event added);
* the class of ``actions`` when any action or requirement differs, and of
  ``attack_defense`` when the attack or defense skills differ;
* the class of each field of the misc part that differs
  (``static_instance``, ``animation_mesh``, ``shop``);
* for an item that was added or removed, the class of ``added`` or
  ``removed``.

``build_notes.toml``: build notes
=================================

A note names a build-wide event that explains many item changes of one build
at once ("implants renamed"), so that lists can collapse them. It is defined
by a rule, not by a list of items: patterns over the field transitions of a
change (``app.core.item_diff.transitions``). A change is explained by a note,
and tagged with it, when

* at least one of its transitions matches a pattern of ``explains``, and
* every one of its transitions matches a pattern of ``explains`` or of
  ``alongside`` (what the event regularly comes with, but which alone is not
  the event).

A change that also differs in anything else is not tagged. The notes of a
build are tried in file order and the first that explains a change tags it.

A pattern is a table with ``path`` and optionally ``part``, ``old`` and
``new``:

* ``path`` is a shell-style pattern (``*`` matches anything) on the
  transition's path, e.g. ``"stat:79"`` or ``"effect:*:target"``;
* ``old`` and ``new`` left out match anything. A number matches that value, a
  list of three numbers that criterion, and the word ``"absent"`` a side that
  does not exist (a stat that was added has an absent old value);
* for the ``name`` and ``description`` of the text part, ``old`` and ``new``
  are regular expressions that must match the whole old and the whole new
  text.
"""

from __future__ import annotations

import hashlib
import re
import tomllib
from collections import Counter
from dataclasses import dataclass
from fnmatch import fnmatchcase
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, FrozenSet, List, Mapping, Optional, Sequence, Tuple

from app.core.item_diff import MISC_FIELDS, Transition, effect_content

DATA_DIR = Path(__file__).resolve().parents[2] / "database"
RELEVANCE_FILE = DATA_DIR / "change_relevance.toml"
NOTES_FILE = DATA_DIR / "build_notes.toml"

GAMEPLAY, ECONOMY, COSMETIC, TEXT = 1, 2, 4, 8
RELEVANCE_BITS = {
    "gameplay": GAMEPLAY,
    "economy": ECONOMY,
    "cosmetic": COSMETIC,
    "text": TEXT,
}
# Classes a stat, an effect type or a whole-part change can be given.
CLASSES = ("gameplay", "economy", "cosmetic")
UNCLASSIFIED = "unclassified"
# Changes classified as a whole, the keys of ``[changes]``.
WHOLE_CHANGES = ("added", "removed", "actions", "attack_defense", "event") + MISC_FIELDS

ABSENT = "absent"


class RulesError(ValueError):
    """A rules file that cannot be used as it is written."""


def relevance_names(mask: Optional[int]) -> List[str]:
    """The classes in a relevance bitmask, in bit order."""
    return [name for name, bit in RELEVANCE_BITS.items() if (mask or 0) & bit]


def relevance_mask(names: Sequence[str]) -> int:
    mask = 0
    for name in names:
        mask |= RELEVANCE_BITS[name]
    return mask


# ---------------------------------------------------------------------------
# Relevance
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class RelevanceRules:
    """``change_relevance.toml``, read."""

    default: str
    stats: Mapping[int, str]
    effects: Mapping[int, str]
    unclassified_stats: FrozenSet[int]
    unclassified_effects: FrozenSet[int]
    changes: Mapping[str, str]
    digest: str

    def stat_class(self, stat: int) -> str:
        return self.stats.get(stat, self.default)

    def effect_class(self, spell_id: int) -> str:
        return self.effects.get(spell_id, self.default)

    def bit(self, change: str) -> int:
        """The relevance bit of a change classified as a whole."""
        return RELEVANCE_BITS[self.changes[change]]

    def knows_stat(self, stat: int) -> bool:
        return stat in self.stats or stat in self.unclassified_stats

    def knows_effect(self, spell_id: int) -> bool:
        return spell_id in self.effects or spell_id in self.unclassified_effects


def _class_of(value: Any, where: str) -> str:
    if value not in CLASSES:
        raise RulesError(f"{where}: {value!r} is not one of {', '.join(CLASSES)}")
    return value


def _ids_by_class(section: Any, where: str) -> Tuple[Dict[int, str], FrozenSet[int]]:
    if not isinstance(section, dict):
        raise RulesError(f"[{where}] is missing")
    classified: Dict[int, str] = {}
    unclassified = set()
    for group, entries in section.items():
        if group != UNCLASSIFIED:
            _class_of(group, f"[{where}.{group}]")
        for key in entries:
            if not key.lstrip("-").isdigit():
                raise RulesError(f"[{where}.{group}]: {key!r} is not a numeric id")
            number = int(key)
            if number in classified or number in unclassified:
                raise RulesError(f"[{where}]: {number} is listed twice")
            if group == UNCLASSIFIED:
                unclassified.add(number)
            else:
                classified[number] = group
    return classified, frozenset(unclassified)


def parse_relevance(text: str) -> RelevanceRules:
    try:
        data = tomllib.loads(text)
    except tomllib.TOMLDecodeError as error:
        raise RulesError(f"change relevance file: {error}") from error
    default = _class_of(data.get("default"), "default")
    stats, unclassified_stats = _ids_by_class(data.get("stats"), "stats")
    effects, unclassified_effects = _ids_by_class(data.get("effects"), "effects")
    changes = data.get("changes") or {}
    missing = [name for name in WHOLE_CHANGES if name not in changes]
    unknown = [name for name in changes if name not in WHOLE_CHANGES]
    if missing or unknown:
        raise RulesError(
            f"[changes] must list exactly {', '.join(WHOLE_CHANGES)}"
            f" (missing: {missing}, unknown: {unknown})"
        )
    return RelevanceRules(
        default=default,
        stats=stats,
        effects=effects,
        unclassified_stats=unclassified_stats,
        unclassified_effects=unclassified_effects,
        changes={
            name: _class_of(value, f"[changes] {name}")
            for name, value in changes.items()
        },
        digest=hashlib.sha1(text.encode("utf-8")).hexdigest(),
    )


def with_relevance(diff: Dict[str, Any], rules: RelevanceRules) -> Dict[str, Any]:
    """A diff of ``app.core.item_diff.diff_parts`` with the relevance class
    of every entry, as ``relevance``: what the entry adds to the relevance of
    the whole change, which is the union of its entries' classes.

    Effects follow the rule of the module docstring: an effect counts under
    the class of its type when the two revisions do not hold it equally
    often, wherever it hangs. An effect that only moved to another event, and
    an event that was only renumbered, have the class of ``event`` when
    nothing else about the item's effects differs, and ``None`` when
    something does: the change is then classified by what really differs.
    """
    net: Counter = Counter()
    for event in diff["effects"]:
        for effect in event["added"]:
            net[effect_content(effect)] += 1
        for effect in event["removed"]:
            net[effect_content(effect)] -= 1
        for pair in event["changed"]:
            net[effect_content(pair["new"])] += 1
            net[effect_content(pair["old"])] -= 1
    moved = None if any(net.values()) else rules.changes["event"]

    def of_effect(*effects: Dict[str, Any]) -> Optional[str]:
        if any(net[effect_content(effect)] for effect in effects):
            return rules.effect_class(effects[0]["spell_id"])
        return moved

    def tagged(entries: List[Dict[str, Any]], relevance: Any) -> List[Dict[str, Any]]:
        return [
            {
                **entry,
                "relevance": relevance(entry) if callable(relevance) else relevance,
            }
            for entry in entries
        ]

    whole = rules.changes
    return {
        "text": tagged(diff["text"], "text"),
        "stats": tagged(diff["stats"], lambda c: rules.stat_class(c["stat"])),
        "actions": tagged(diff["actions"], whole["actions"]),
        "attack": tagged(diff["attack"], whole["attack_defense"]),
        "defense": tagged(diff["defense"], whole["attack_defense"]),
        "misc": tagged(diff["misc"], lambda c: whole[c["field"]]),
        "effects": [
            {
                **event,
                "relevance": moved,
                "added": tagged(event["added"], of_effect),
                "removed": tagged(event["removed"], of_effect),
                "changed": tagged(
                    event["changed"], lambda pair: of_effect(pair["new"], pair["old"])
                ),
            }
            for event in diff["effects"]
        ],
    }


def diff_relevance(diff: Dict[str, Any]) -> int:
    """The relevance bitmask of a diff tagged by :func:`with_relevance`: the
    union of its entries' classes."""
    names = set()
    for part, entries in diff.items():
        for entry in entries:
            names.add(entry["relevance"])
            if part == "effects":
                for effects in (entry["added"], entry["removed"], entry["changed"]):
                    names.update(effect["relevance"] for effect in effects)
    return relevance_mask(sorted(name for name in names if name is not None))


# ---------------------------------------------------------------------------
# Build notes
# ---------------------------------------------------------------------------

_ANY = object()


@dataclass(frozen=True)
class Pattern:
    """One pattern over field transitions; see the module docstring."""

    path: str
    part: Optional[str] = None
    old: Any = _ANY
    new: Any = _ANY

    def matches(self, transition: Transition) -> bool:
        if self.part is not None and self.part != transition.part:
            return False
        if not fnmatchcase(transition.path, self.path):
            return False
        return _value_matches(self.old, transition.old) and _value_matches(
            self.new, transition.new
        )


def _value_matches(wanted: Any, value: Any) -> bool:
    if wanted is _ANY:
        return True
    if isinstance(wanted, re.Pattern):
        return isinstance(value, str) and wanted.fullmatch(value) is not None
    if wanted == ABSENT:
        return value is None
    return wanted == value


@dataclass(frozen=True)
class Note:
    """A build note and the rule that selects the changes it explains."""

    build: str
    title: str
    body: Optional[str]
    explains: Tuple[Pattern, ...]
    alongside: Tuple[Pattern, ...] = ()

    def explains_change(self, transitions: Sequence[Transition]) -> bool:
        """Whether the note explains all of a change with these transitions
        (``transitions(diff, full_text=True)``)."""
        if not any(p.matches(t) for t in transitions for p in self.explains):
            return False
        patterns = self.explains + self.alongside
        return all(any(p.matches(t) for p in patterns) for t in transitions)


@dataclass(frozen=True)
class NoteRules:
    """``build_notes.toml``, read."""

    notes: Tuple[Note, ...]
    digest: str

    def of_build(self, slug: str) -> List[Note]:
        return [note for note in self.notes if note.build == slug]


def _pattern_value(raw: Any, is_text: bool, where: str) -> Any:
    if isinstance(raw, str):
        if raw == ABSENT:
            return ABSENT
        if is_text:
            try:
                return re.compile(raw, re.DOTALL)
            except re.error as error:
                raise RulesError(f"{where}: bad regular expression: {error}") from error
        return raw
    if isinstance(raw, bool) or not isinstance(raw, (int, list)):
        raise RulesError(f"{where}: {raw!r} is not a number, a criterion or a string")
    if isinstance(raw, list):
        if len(raw) != 3 or not all(type(n) is int for n in raw):
            raise RulesError(f"{where}: a criterion is [value1, value2, operator]")
        return tuple(raw)
    return raw


def _pattern(raw: Any, where: str) -> Pattern:
    if not isinstance(raw, dict) or not isinstance(raw.get("path"), str):
        raise RulesError(f"{where}: a pattern is a table with a path")
    unknown = set(raw) - {"path", "part", "old", "new"}
    if unknown:
        raise RulesError(f"{where}: unknown keys {sorted(unknown)}")
    is_text = raw["path"] in ("name", "description")
    return Pattern(
        path=raw["path"],
        part=raw.get("part"),
        **{
            side: _pattern_value(raw[side], is_text, f"{where} {side}")
            for side in ("old", "new")
            if side in raw
        },
    )


def parse_notes(text: str) -> NoteRules:
    try:
        data = tomllib.loads(text)
    except tomllib.TOMLDecodeError as error:
        raise RulesError(f"build notes file: {error}") from error
    notes = []
    seen = set()
    for index, raw in enumerate(data.get("note") or [], start=1):
        where = f"note {index}"
        for key in ("build", "title"):
            if not isinstance(raw.get(key), str) or not raw[key].strip():
                raise RulesError(f"{where}: {key} is required")
        where = f"note '{raw['title']}' of {raw['build']}"
        if (raw["build"], raw["title"]) in seen:
            raise RulesError(f"{where}: defined twice")
        seen.add((raw["build"], raw["title"]))
        explains = tuple(
            _pattern(p, f"{where} explains") for p in raw.get("explains") or []
        )
        if not explains:
            raise RulesError(f"{where}: explains needs at least one pattern")
        notes.append(
            Note(
                build=raw["build"],
                title=raw["title"],
                body=raw.get("body"),
                explains=explains,
                alongside=tuple(
                    _pattern(p, f"{where} alongside")
                    for p in raw.get("alongside") or []
                ),
            )
        )
    return NoteRules(
        notes=tuple(notes), digest=hashlib.sha1(text.encode("utf-8")).hexdigest()
    )


# ---------------------------------------------------------------------------
# Both files
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ChangeRules:
    relevance: RelevanceRules
    notes: NoteRules


def read_rules(
    relevance_file: Path = RELEVANCE_FILE, notes_file: Path = NOTES_FILE
) -> ChangeRules:
    return ChangeRules(
        relevance=parse_relevance(relevance_file.read_text(encoding="utf-8")),
        notes=parse_notes(notes_file.read_text(encoding="utf-8")),
    )


@lru_cache(maxsize=1)
def default_rules() -> ChangeRules:
    """The rules of the files in the repository, read once per process."""
    return read_rules()
