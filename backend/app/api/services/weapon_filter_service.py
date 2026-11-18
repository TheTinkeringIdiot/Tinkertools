"""
The weapons a character can consider, for TinkerFite's weapon analysis.

A weapon is an item of class 1 with an attack/defense block. One is returned
when all of these hold:

* its attack block gives at least half of the attack rating to one of the
  character's top weapon skills;
* it has a requirement of some kind (which leaves out mob weapons and props),
  or it is one of the Martial Arts Item templates;
* nothing about wielding it excludes the character: it is not NPC-only, and
  its faction, breed, profession and expansion requirements are met.

The level and the skill values of the request do not filter: every QL variant
is returned, so the client can interpolate. ``WeaponCriteria`` is what of a
request does filter. The query takes nothing else and the route caches its
response under nothing else, so characters that differ only in level or in
skill values share one cached analysis.
"""

from dataclasses import dataclass
from typing import Any, Dict, List, Tuple

from sqlalchemy import ColumnElement, Select, and_, or_
from sqlalchemy.orm import Session

from app.api.schemas.weapon_analysis import WeaponAnalyzeRequest
from app.store import tables as t
from app.store.context import Build
from app.store.items import load_item_documents
from app.store.presence import any_of, has_atkdef, has_requirement, has_stat, revisions

WEAPON_ITEM_CLASS = 1
ACTION_WIELD = 8

STAT_BREED = 4
STAT_FACTION = 33
STAT_PROFESSION = 60
STAT_VISUAL_PROFESSION = 368
STAT_EXPANSION = 389
STAT_NPC_FAMILY = 455

OPERATOR_BIT_SET = 22
OPERATOR_BIT_NOT_SET = 107

# The least share of the attack rating a skill must give for the weapon to
# count as a weapon of that skill.
MIN_SKILL_SHARE = 50

# Player-equippable items that legitimately have no wield action criteria.
# These are the "Martial Arts Item" (unarmed combat) templates; the client
# selects one based on profession + MA skill rather than via wield
# requirements. See client PlayerCharacter.cs:184-259.
MARTIAL_ARTS_ITEM_AOIDS = (
    # Family 1: Martial Artist (profession 2)
    211352,
    211353,
    211354,
    211357,
    211358,
    211363,
    211364,
    # Family 2: Shade (profession 15)
    211349,
    211350,
    211351,
    211359,
    211360,
    211365,
    211366,
    # Family 3: Generic fallback (all other professions)
    43712,
    43713,
    144745,
    211355,
    211356,
    211361,
    211362,
)


@dataclass(frozen=True)
class WeaponCriteria:
    """What of a character decides the weapons it is offered.

    ``weapon_query`` reads a character through this and has no other access
    to the request, and ``/weapons/analyze`` keys its cache on this value. A
    field the query is to read is added here, which adds it to the key; one
    it stops reading is removed here.
    """

    breed_id: int
    profession_id: int
    side: int
    expansion_bitflag: int
    # The top weapon skills, each once, in ascending order.
    skill_ids: Tuple[int, ...]

    @classmethod
    def of(cls, request: WeaponAnalyzeRequest) -> "WeaponCriteria":
        return cls(
            breed_id=request.breed_id,
            profession_id=request.profession_id,
            side=request.side,
            expansion_bitflag=request.expansion_bitflag,
            skill_ids=tuple(
                sorted({skill.skill_id for skill in request.top_weapon_skills})
            ),
        )


def _wield_requires(*conditions: ColumnElement) -> ColumnElement:
    """The Wield action has a criterion meeting ``conditions``."""
    return has_requirement(t.requirement.c.action == ACTION_WIELD, *conditions)


def _excluded_by_wield(character: WeaponCriteria) -> List[ColumnElement]:
    """Wield criteria that rule the character out, whatever else the action
    asks for."""
    stat = t.requirement.c.value1
    value = t.requirement.c.value2
    operator = t.requirement.c.operator
    owned = value.op("&")(character.expansion_bitflag)
    return [
        _wield_requires(stat == STAT_NPC_FAMILY),
        _wield_requires(stat == STAT_BREED, value != character.breed_id, value != 0),
        _wield_requires(
            stat == STAT_EXPANSION, operator == OPERATOR_BIT_SET, owned != value
        ),
        _wield_requires(
            stat == STAT_EXPANSION, operator == OPERATOR_BIT_NOT_SET, owned != 0
        ),
    ]


def weapon_query(build: Build, character: WeaponCriteria) -> Select:
    """The revisions of ``build`` that are weapons for the character."""
    revision = t.item_revision
    query = revisions(build).where(
        revision.c.item_class == WEAPON_ITEM_CLASS,
        has_atkdef(
            t.atkdef_entry.c.is_attack,
            any_of(t.atkdef_entry.c.stat, character.skill_ids),
            t.atkdef_entry.c.value >= MIN_SKILL_SHARE,
        ),
        or_(has_requirement(), any_of(revision.c.aoid, MARTIAL_ARTS_ITEM_AOIDS)),
        *(~excluded for excluded in _excluded_by_wield(character)),
    )

    # Side 0 is neutral and can use the weapons of every faction.
    if character.side > 0:
        query = query.where(
            ~has_stat(
                t.stat_entry.c.stat == STAT_FACTION,
                t.stat_entry.c.value != character.side,
                t.stat_entry.c.value != 0,
            )
        )

    # A weapon restricted by profession lists one criterion per profession
    # allowed; value 0 stands for any. Profession 0 in the request is "any".
    if character.profession_id > 0:
        names_profession = t.requirement.c.value1.in_(
            (STAT_PROFESSION, STAT_VISUAL_PROFESSION)
        )
        query = query.where(
            or_(
                ~_wield_requires(names_profession),
                _wield_requires(
                    and_(
                        names_profession,
                        t.requirement.c.value2.in_((character.profession_id, 0)),
                    )
                ),
            )
        )
    return query


def filter_weapons(
    db: Session, build: Build, character: WeaponCriteria
) -> List[Dict[str, Any]]:
    """The weapons of ``build`` for the character, by AOID, each as the JSON
    document of its ``ItemDetail``.

    A character has several hundred to well over a thousand weapons. They are
    built as plain documents because validating that many response models
    costs more than finding and loading the weapons does.
    """
    rev_ids = db.execute(
        weapon_query(build, character).order_by(t.item_revision.c.aoid)
    ).scalars()
    return load_item_documents(db, build, rev_ids=list(rev_ids))
