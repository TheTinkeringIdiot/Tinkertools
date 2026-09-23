"""
Nano school, casting professions and minimum caster level.

The client data has no "profession" or "level" field for a nano: both live in
the Use action's criteria (action 3), a postfix (RPN) expression such as
``Profession == Doctor, Level > 99, And``. Those can OR several professions
together, negate them, or follow an ``OnTarget`` modifier, where they
describe the target instead of the caster, so they cannot be answered with a
simple join. This module evaluates the expression once per nano and the
importer stores the answers in ``nano_properties`` (migration 008), which the
``/nanos`` endpoints join and filter on.

- ``school``: the item's NanoSchool stat (405), 1-5 (see ``NANO_SCHOOLS``).
  0 and the odd 999 mean no school and are stored as NULL.
- ``professions``: the player professions (``PROFESSIONS`` ids) whose members
  can satisfy the Use criteria. Empty when the criteria do not restrict the
  profession at all, or when the nano has no Use action.
- ``min_level``: the lowest character Level (stat 54) that can satisfy the Use
  criteria, 1 when they do not ask for a level. NULL when the nano has no Use
  action, since such a nano cannot be cast by a player at all.

Criteria that are neither about the profession nor the level (skills, NCU,
states) are unknown to the evaluator, and three-valued logic keeps a profession
or level unless the criteria rule it out whatever those unknowns turn out to be.
"""

from __future__ import annotations

import logging
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

USE_ACTION = 3

STAT_LEVEL = 54
STAT_PROFESSION = 60
STAT_VISUAL_PROFESSION = 368
STAT_NANO_SCHOOL = 405

# NanoSchool stat values, as in the frontend's NANOSCHOOL table
NANO_SCHOOLS: Dict[int, str] = {
    1: "Combat",
    2: "Medical",
    3: "Protection",
    4: "Psi",
    5: "Space",
}

# Player professions by Profession stat value (13 is Monster). Display names
# match the profession filter in the TinkerNanos UI.
PROFESSIONS: Dict[int, str] = {
    1: "Soldier",
    2: "Martial Artist",
    3: "Engineer",
    4: "Fixer",
    5: "Agent",
    6: "Adventurer",
    7: "Trader",
    8: "Bureaucrat",
    9: "Enforcer",
    10: "Doctor",
    11: "Nano-Technician",
    12: "Meta-Physicist",
    14: "Keeper",
    15: "Shade",
}

# Criterion operators
OP_EQUAL = 0
OP_LESS_THAN = 1
OP_GREATER_THAN = 2
OP_OR = 3
OP_AND = 4
OP_NOT_EQUAL = 24
OP_NOT = 42
# A modifier sets whom every following criterion tests, up to the next
# modifier: "Level > 24, And, OnTarget, Level < 2, And" is a caster of level 25+
# on a target below level 2 (Leet Friend).
OTHER_TARGET_MODIFIERS = frozenset({18, 21})  # OnTarget, OnSecondaryItem
CASTER_MODIFIERS = frozenset({19, 26})  # OnSelf, OnUser

# (stat, value, operator), in order_index order
Criterion = Tuple[int, int, int]
# True, False, or None for "depends on something the evaluator doesn't know"
Truth = Optional[bool]


def _compare(actual: int, operator: int, value: int) -> Truth:
    if operator == OP_EQUAL:
        return actual == value
    if operator == OP_NOT_EQUAL:
        return actual != value
    if operator == OP_LESS_THAN:
        return actual < value
    if operator == OP_GREATER_THAN:
        return actual > value
    return None


def _and(a: Truth, b: Truth) -> Truth:
    if a is False or b is False:
        return False
    if a is None or b is None:
        return None
    return True


def _or(a: Truth, b: Truth) -> Truth:
    if a is True or b is True:
        return True
    if a is None or b is None:
        return None
    return False


def _not(a: Truth) -> Truth:
    return None if a is None else not a


def evaluate(
    criteria: Sequence[Criterion], known: Dict[int, int]
) -> Tuple[Truth, bool]:
    """Evaluate Use criteria for a caster whose ``known`` stats are given.

    Criteria on any other stat, and every criterion an OnTarget modifier
    applies to, are unknown. Returns the three-valued result and whether the
    expression was well formed (a malformed one evaluates to unknown).
    """
    stack: List[Truth] = []
    on_caster = True
    well_formed = True
    for stat, value, operator in criteria:
        if operator in OTHER_TARGET_MODIFIERS:
            on_caster = False
            continue
        if operator in CASTER_MODIFIERS:
            on_caster = True
            continue
        if operator in (OP_AND, OP_OR):
            if len(stack) < 2:
                well_formed = False
                break
            b, a = stack.pop(), stack.pop()
            stack.append(_and(a, b) if operator == OP_AND else _or(a, b))
            continue
        if operator == OP_NOT:
            if not stack:
                well_formed = False
                break
            stack.append(_not(stack.pop()))
            continue
        if on_caster and stat in known:
            stack.append(_compare(known[stat], operator, value))
        else:
            stack.append(None)

    if not well_formed:
        return None, False
    # Leftover operands are implicitly required together
    result: Truth = True
    for truth in stack:
        result = _and(result, truth)
    return result, True


def _with_profession(profession: int) -> Dict[int, int]:
    return {STAT_PROFESSION: profession, STAT_VISUAL_PROFESSION: profession}


def castable_professions(criteria: Sequence[Criterion]) -> List[int]:
    """Player professions that can satisfy the criteria; [] if unrestricted."""
    allowed = [
        profession
        for profession in PROFESSIONS
        if evaluate(criteria, _with_profession(profession))[0] is not False
    ]
    return [] if len(allowed) == len(PROFESSIONS) else allowed


def minimum_level(criteria: Sequence[Criterion]) -> Optional[int]:
    """Lowest caster Level that can satisfy the criteria (1 if unrestricted).

    None when no level can (the criteria contradict themselves).
    """
    candidates = {1}
    for stat, value, operator in criteria:
        if stat == STAT_LEVEL:
            candidates.update(v for v in (value - 1, value, value + 1) if v >= 1)
    for level in sorted(candidates):
        if evaluate(criteria, {STAT_LEVEL: level})[0] is not False:
            return level
    return None


def nano_school(value: Optional[int]) -> Optional[int]:
    """NanoSchool stat value, or None when it names no school."""
    return value if value in NANO_SCHOOLS else None


def derive(
    school_stat: Optional[int], use_criteria: Optional[Sequence[Criterion]]
) -> Tuple[Optional[int], List[int], Optional[int]]:
    """(school, professions, min_level) for one nano.

    ``use_criteria`` is None when the nano has no Use action.
    """
    if use_criteria is None:
        return nano_school(school_stat), [], None
    return (
        nano_school(school_stat),
        castable_professions(use_criteria),
        minimum_level(use_criteria),
    )


def school_name(school: Optional[int]) -> Optional[str]:
    return NANO_SCHOOLS.get(school) if school is not None else None


def profession_names(professions: Optional[Iterable[int]]) -> List[str]:
    return [PROFESSIONS[p] for p in professions or () if p in PROFESSIONS]


def profession_id(name_or_id: str) -> Optional[int]:
    """Profession id for a display name (case-insensitive) or numeric id."""
    candidate = name_or_id.strip()
    if candidate.isdigit():
        return int(candidate) if int(candidate) in PROFESSIONS else None
    wanted = candidate.casefold()
    for pid, name in PROFESSIONS.items():
        if name.casefold() == wanted:
            return pid
    return None


def school_id(name_or_id: str) -> Optional[int]:
    """NanoSchool value for a school name (case-insensitive) or numeric value."""
    candidate = name_or_id.strip()
    if candidate.isdigit():
        return int(candidate) if int(candidate) in NANO_SCHOOLS else None
    wanted = candidate.casefold()
    for sid, name in NANO_SCHOOLS.items():
        if name.casefold() == wanted:
            return sid
    return None


_NANOS_SQL = text("""
    SELECT i.id,
           (SELECT sv.value FROM item_stats ist
              JOIN stat_values sv ON sv.id = ist.stat_value_id
             WHERE ist.item_id = i.id AND sv.stat = :school_stat
             LIMIT 1) AS school_stat
    FROM items i
    WHERE i.is_nano
    """)

_USE_CRITERIA_SQL = text("""
    SELECT a.item_id, c.value1, c.value2, c.operator
    FROM actions a
    JOIN items i ON i.id = a.item_id AND i.is_nano
    LEFT JOIN action_criteria ac ON ac.action_id = a.id
    LEFT JOIN criteria c ON c.id = ac.criterion_id
    WHERE a.action = :use_action
    ORDER BY a.item_id, a.id, ac.order_index
    """)


def compute_all(
    db: Session,
) -> List[Tuple[int, Optional[int], List[int], Optional[int]]]:
    """(item_id, school, professions, min_level) for every nano in the schema."""
    use_criteria: Dict[int, List[Criterion]] = {}
    for item_id, stat, value, operator in db.execute(
        _USE_CRITERIA_SQL, {"use_action": USE_ACTION}
    ):
        criteria = use_criteria.setdefault(item_id, [])
        if stat is not None:
            criteria.append((stat, value, operator))

    rows = []
    for item_id, school_stat in db.execute(
        _NANOS_SQL, {"school_stat": STAT_NANO_SCHOOL}
    ):
        school, professions, min_level = derive(school_stat, use_criteria.get(item_id))
        rows.append((item_id, school, professions, min_level))
    return rows


def populate(db: Session) -> int:
    """Rebuild ``nano_properties`` for the session's schema. Returns row count.

    The caller commits.
    """
    rows = compute_all(db)
    db.execute(text("DELETE FROM nano_properties"))
    if rows:
        db.execute(
            text(
                "INSERT INTO nano_properties (item_id, school, professions, min_level) "
                "VALUES (:item_id, :school, :professions, :min_level)"
            ),
            [
                {
                    "item_id": item_id,
                    "school": school,
                    "professions": professions,
                    "min_level": min_level,
                }
                for item_id, school, professions, min_level in rows
            ],
        )
    logger.info(f"Derived nano properties for {len(rows)} nanos")
    return len(rows)
