"""Golden reference for the API: capture responses, then compare a later capture.

The rewrite of the storage layer must not change what the API returns. This
tool records the responses of a fixed set of requests on a fixed set of builds
and compares two recordings. Values are compared strictly, including their JSON
type. Only the following is allowed to differ:

1. Internal ids. An item's ``id`` (any object that also carries ``aoid``), a
   source record's ``id``, ``item_id``, ``animation_mesh_id`` and
   ``attack_defense_id`` are ignored. Every other ``id`` (strains, mobs,
   source types) is compared.
2. The order of stats, events, effects, actions and attack/defense entries,
   which carries no meaning (app/core/parts.py).
3. The criteria of an *effect* are compared as a set. The store being replaced
   keeps them de-duplicated and unordered, so their order in a response is an
   artefact and repeats are lost; the new store keeps the client's sequence.
   The criteria of an *action* are compared in order.

Row order is compared exactly. Every list the API sorts ends its sort on the
AOID (or the mob id), so the order is the same whatever the storage. The one
exception is ``/weapons/analyze``, which returns its rows in no defined order;
they are matched by AOID.

Usage:
    python tools/golden.py samples EXTRACTS_DIR            > tools/golden_samples.json
    python tools/golden.py capture BASE_URL OUT_DIR [--samples FILE] [--build SLUG ...]
    python tools/golden.py compare OLD_DIR NEW_DIR

``capture`` exits 1 if a response is not sorted the way its request declares;
that check covers the leading numeric sort fields only, since text is collated
by the database. ``compare`` checks row order exactly.
``compare`` exits 1 when any response differs. Timings in a capture are single
measurements and are reported for orientation only.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, Iterator, List, Optional, Tuple

BUILDS = ("ao-14-2-2", "ao-15-0-1", "ao-17-10-5", "ao-18-8-62-ep1", "prk-0-7-1")
SAMPLE_COUNTS = {"items": 20, "nanos": 10, "weapons": 8, "implants": 5}
# Ignored wherever they appear.
INTERNAL_ID_KEYS = frozenset({"item_id", "animation_mesh_id", "attack_defense_id"})
# Lists of result rows: matched by identity, with a separate sort-key check.
ROW_LISTS = ("items", "weapons", "results", "strains", "versions")
# Other lists whose order is content.
ORDERED_LISTS = frozenset({"ranges", "mob_names"})
DEFAULT_SAMPLES = Path(__file__).with_name("golden_samples.json")

NT, ADVENTURER, DOCTOR = 11, 6, 10
# Perks exist only in the newest builds; elsewhere the lookup finds nothing.
PERK_AOIDS = (211897, 252356, 253065, 260942, 261097, 261129, 261349, 261929)

Order = List[Tuple[str, str]]
Request = Dict[str, Any]


# --------------------------------------------------------------------------- samples


def _spread(values: List[int], count: int) -> List[int]:
    values = sorted(values)
    if len(values) <= count:
        return values
    step = len(values) / count
    return [values[int(i * step)] for i in range(count)]


def build_samples(extracts: Path) -> Dict[str, Dict[str, List[int]]]:
    """Evenly spaced AOIDs of each kind per build, read from the extracts."""
    samples = {}
    for slug in BUILDS:
        kinds: Dict[str, List[int]] = {k: [] for k in SAMPLE_COUNTS}
        for record in json.loads((extracts / slug / "items.json").read_text()):
            item_class = next(
                (s["RawValue"] for s in record["StatValues"] if s["Stat"] == 76), 0
            )
            if record.get("AttackDefenseData") and item_class == 1:
                kinds["weapons"].append(record["AOID"])
            elif item_class == 3:
                kinds["implants"].append(record["AOID"])
            else:
                kinds["items"].append(record["AOID"])
        for record in json.loads((extracts / slug / "nanos.json").read_text()):
            kinds["nanos"].append(record["AOID"])
        samples[slug] = {k: _spread(v, SAMPLE_COUNTS[k]) for k, v in kinds.items()}
    return samples


# --------------------------------------------------------------------------- requests


def _order(*fields: str) -> Order:
    """``_order("ql", "-name")``: ascending ql, then descending name."""
    return [(f.lstrip("-"), "desc" if f.startswith("-") else "asc") for f in fields]


def _get(
    path: str,
    order: Optional[Order] = None,
    all_pages: bool = False,
    in_order: bool = True,
    **params,
) -> Request:
    query = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
    return {
        "method": "GET",
        "path": path + ("?" + query if query else ""),
        "order": order,
        "all_pages": all_pages,
        "in_order": in_order,
    }


def _post(path: str, body: dict, in_order: bool = True) -> Request:
    return {
        "method": "POST",
        "path": path,
        "body": body,
        "order": None,
        "in_order": in_order,
    }


BY_NAME = _order("name", "aoid")
BY_AOID = _order("aoid")


def requests_for(sample: Dict[str, List[int]]) -> Iterator[Tuple[str, Request]]:
    """Every fixed request made against one build, as ``(name, request)``."""
    everything = (
        sample["items"] + sample["nanos"] + sample["weapons"] + sample["implants"]
    )
    for aoid in everything:
        yield f"item/{aoid}", _get(f"/items/{aoid}")
    for aoid in sample["weapons"] + sample["implants"] + sample["items"][:5]:
        yield f"interpolation-info/{aoid}", _get(f"/items/{aoid}/interpolation-info")
        for ql in (1, 150, 300):
            yield f"interpolate/{aoid}/{ql}", _get(
                f"/items/{aoid}/interpolate", target_ql=ql
            )
    yield "interpolate/batch", _post(
        "/items/batch/interpolate",
        {"items": [{"aoid": a, "target_ql": 120} for a in sample["weapons"]]},
    )

    big = 1000
    for name, params in {
        "text-sword": dict(q="sword"),
        "text-two-words": dict(q="combat armor"),
        "text-exact": dict(q="Pillow", exact_match="true"),
        "weapons-only": dict(q="rifle", weapons="true", min_ql=200),
        "weapons-only-low": dict(q="pistol", weapons="true", max_ql=60),
        "ql-range": dict(q="ring", min_ql=150, max_ql=160),
        "class-armor": dict(q="cloak", item_class=2),
        "slot-head": dict(q="helmet", slot=2, min_ql=150),
        "requires-and-modifies": dict(
            q="a", stat_filters="requires:112:>=:100,modifies:17:>=:1"
        ),
        "requires-level": dict(q="of", stat_filters="requires:54:>=:215"),
        "requires-level-low": dict(q="armor", stat_filters="requires:54:>=:100"),
        "modifies-skill": dict(q="e", stat_bonuses="124", min_ql=250),
        "modifies-skill-low": dict(q="a", stat_bonuses="124", min_ql=90, max_ql=100),
        "froob-nodrop-breed": dict(
            q="bracer", froob_friendly="true", nodrop="false", breed=1
        ),
        "froob-low": dict(q="armor", froob_friendly="true", min_ql=95, max_ql=100),
        "profession-faction": dict(
            q="armor", profession=ADVENTURER, faction=1, min_ql=280
        ),
        "profession-low": dict(q="a", profession=ADVENTURER, min_ql=140, max_ql=150),
        "gender": dict(q="a", gender=2),
        "no-match": dict(q="zzzzqqqq"),
    }.items():
        yield f"search/{name}", _get(
            "/items/search", order=BY_NAME, page_size=big, **params
        )
    for name, params in {
        "name-sword": dict(q="sword", search_fields="name"),
        "name-two-words": dict(q="nano crystal heal", search_fields="name"),
        "description": dict(q="doctor", search_fields="description", min_ql=200),
        "name-and-description": dict(q="omni armed", search_fields="name,description"),
        "default-fields": dict(q="viral"),
        "weapons": dict(q="shotgun", weapons="true", search_fields="name"),
        "filtered": dict(q="eye implant", search_fields="name", min_ql=200, max_ql=200),
    }.items():
        yield f"fuzzy/{name}", _get(
            "/items/search", exact_match="false", page_size=big, **params
        )
    for name, params in {
        "class-weapon-ql": dict(item_class=1, min_ql=299, max_ql=299),
        "class-weapon-ql-low": dict(item_class=1, min_ql=100, max_ql=100),
        "nanos-ql": dict(is_nano="true", min_ql=215, max_ql=220),
        "slot-profession": dict(slot=6, profession=DOCTOR, min_ql=200),
        "slot-low": dict(slot=6, min_ql=120, max_ql=121),
        "stat-bonus": dict(stat_bonuses="19,21", min_ql=290),
        "stat-bonus-low": dict(stat_bonuses="19,21", min_ql=150, max_ql=152),
        "strain": dict(strain=144),
    }.items():
        yield f"items/{name}", _get("/items", order=BY_AOID, page_size=big, **params)

    for name, order, params in (
        ("school", BY_NAME, dict(school="Combat", ql_min=100, ql_max=110)),
        (
            "profession-level",
            BY_NAME,
            dict(profession=NT, level_min=100, level_max=150),
        ),
        (
            "profession-any-level",
            BY_NAME,
            dict(profession=DOCTOR, ql_min=60, ql_max=70),
        ),
        ("ql-sorted", _order("ql", "aoid"), dict(ql_min=205, ql_max=207, sort_by="ql")),
        (
            "ql-sorted-desc",
            _order("-ql", "aoid"),
            dict(ql_min=100, ql_max=104, sort_by="ql", sort_desc="true"),
        ),
        (
            "level-sorted",
            _order("level", "aoid"),
            dict(school="Combat", ql_min=100, ql_max=140, sort_by="level"),
        ),
        (
            "level-sorted-desc",
            _order("-level", "aoid"),
            dict(
                profession=NT, ql_min=150, ql_max=200, sort_by="level", sort_desc="true"
            ),
        ),
        ("strain", BY_NAME, dict(strain=144)),
    ):
        yield f"nanos/{name}", _get("/nanos", order=order, page_size=200, **params)
    yield "nanos/search-heal", _get(
        "/nanos/search", order=BY_NAME, q="heal", ql_min=150, ql_max=170, page_size=200
    )
    yield "nanos/strains", _get("/nanos/strains", order=_order("name"))
    yield "nanos/strains-profession", _get(
        "/nanos/strains", order=_order("name"), profession=DOCTOR
    )
    for profession in (ADVENTURER, DOCTOR, NT):
        yield f"nanos/profession/{profession}", _get(
            f"/nanos/profession/{profession}",
            order=_order("-ql", "aoid"),
            page_size=big,
        )
    yield f"nanos/profession/{DOCTOR}/by-name", _get(
        f"/nanos/profession/{DOCTOR}",
        order=BY_NAME,
        page_size=big,
        sort="name",
        sort_order="asc",
    )
    yield f"nanos/profession/{NT}/ql-asc", _get(
        f"/nanos/profession/{NT}",
        order=_order("ql", "aoid"),
        page_size=big,
        sort="ql",
        sort_order="asc",
    )
    yield f"nanos/offensive/{NT}", _get(
        f"/nanos/offensive/{NT}", order=_order("-ql", "aoid"), page_size=big
    )

    for name, body in {
        "nt-pistol": dict(
            level=220,
            breed_id=1,
            profession_id=NT,
            side=1,
            expansion_bitflag=127,
            top_weapon_skills=[{"skill_id": 112, "value": 2500}],
        ),
        "froob-adventurer": dict(
            level=100,
            breed_id=2,
            profession_id=ADVENTURER,
            side=2,
            expansion_bitflag=0,
            top_weapon_skills=[
                {"skill_id": 102, "value": 600},
                {"skill_id": 105, "value": 500},
            ],
        ),
    }.items():
        yield f"weapons/{name}", _post("/weapons/analyze", body, in_order=False)

    for name, body in {
        "right-hand-three": dict(
            slot=1024, ql=200, clusters={"Shiny": 100, "Bright": 102, "Faded": 150}
        ),
        "eye-two-interpolated": dict(
            slot=2, ql=120, clusters={"Shiny": 101, "Bright": 130}
        ),
        "head-two-low": dict(slot=4, ql=37, clusters={"Shiny": 221, "Bright": 140}),
        "eye-basic": dict(slot=2, ql=50, clusters={}),
        "no-such-combination": dict(
            slot=32, ql=200, clusters={"Shiny": 16, "Bright": 112}
        ),
    }.items():
        yield f"implants/{name}", _post("/implants/lookup", body)

    yield "symbiants", _get(
        "/symbiants",
        order=_order("family", "ql", "name", "aoid"),
        all_pages=True,
        page_size=200,
    )
    yield "mobs/pocket-bosses", _get(
        "/mobs",
        order=_order("level", "name", "id"),
        is_pocket_boss="true",
        page_size=big,
    )
    yield "mobs/level-range", _get(
        "/mobs",
        order=_order("level", "name", "id"),
        min_level=100,
        max_level=200,
        page_size=big,
    )
    yield "perks/batch-lookup", _post(
        "/perks/batch/lookup", {"aoids": list(PERK_AOIDS) + everything[:3]}
    )
    yield "versions", _get("/versions")

    yield "errors/item-not-found", _get("/items/999999999")
    yield "errors/item-id-not-a-number", _get("/items/abc")
    yield "errors/search-without-query", _get("/items/search")
    yield "errors/symbiant-not-found", _get("/symbiants/999999999")
    yield "errors/implant-ql-out-of-range", _post(
        "/implants/lookup", dict(slot=2, ql=0, clusters={})
    )
    yield "errors/nano-profession-unknown", _get("/nanos/profession/99")


def follow_up_requests(
    fetch: Callable[[Request], dict],
) -> Iterator[Tuple[str, Request, str]]:
    """Requests whose path needs a value the server chose (a mob's id).

    Yields ``(name, request, recorded_path)``; the recorded path omits the id.
    """
    mobs = fetch(_get("/mobs", is_pocket_boss="true", page_size=1000))["body"]
    rows = mobs.get("items", []) if isinstance(mobs, dict) else []
    for mob in sorted(rows, key=lambda m: m.get("name") or "")[:5]:
        yield f"mob/{mob['name']}", _get(f"/mobs/{mob['id']}"), "/mobs/<id>"
        yield (
            f"mob-drops/{mob['name']}",
            _get(f"/mobs/{mob['id']}/drops", order=_order("ql", "name", "aoid")),
            "/mobs/<id>/drops",
        )
    symbiants = fetch(_get("/symbiants", page_size=200))["body"]
    rows = symbiants.get("items", []) if isinstance(symbiants, dict) else []
    for aoid in _spread([row["aoid"] for row in rows], 4):
        yield f"symbiant/{aoid}", _get(f"/symbiants/{aoid}"), f"/symbiants/{aoid}"
        yield (
            f"symbiant-dropped-by/{aoid}",
            _get(f"/symbiants/{aoid}/dropped-by", order=_order("level", "name", "id")),
            f"/symbiants/{aoid}/dropped-by",
        )


# --------------------------------------------------------------------------- capture


def call(base: str, request: Request) -> dict:
    body = request.get("body")
    data = json.dumps(body).encode() if body is not None else None
    http = urllib.request.Request(
        base + request["path"],
        data=data,
        method=request["method"],
        headers={"Content-Type": "application/json"},
    )
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(http, timeout=300) as response:
            status, payload = response.status, response.read()
    except urllib.error.HTTPError as error:
        status, payload = error.code, error.read()
    elapsed = round((time.perf_counter() - started) * 1000)
    try:
        parsed = json.loads(payload)
    except ValueError:
        parsed = payload.decode("utf-8", "replace")
    result = {"request": request, "status": status, "ms": elapsed, "body": parsed}
    if request.get("all_pages") and status == 200 and parsed.get("has_next"):
        page = dict(request, all_pages=False)
        rows = list(parsed["items"])
        number = 1
        while parsed.get("has_next"):
            number += 1
            page["path"] = f"{request['path']}&page={number}"
            following = call(base, page)
            if following["status"] != 200:
                return following
            parsed = following["body"]
            rows.extend(parsed["items"])
            result["ms"] += following["ms"]
        result["body"] = dict(
            parsed, items=rows, page=1, pages=1, has_next=False, has_prev=False
        )
    return result


def _rows(body: Any) -> Tuple[Optional[str], Optional[list]]:
    """The list of result rows in a response body and the key it is under."""
    if isinstance(body, list):
        return "", body
    if isinstance(body, dict):
        for key in ROW_LISTS:
            if isinstance(body.get(key), list):
                return key, body[key]
    return None, None


def unsorted_at(rows: list, order: Order) -> Optional[int]:
    """Index of the first row that breaks the declared order, judged on its
    numeric fields only: text is collated by the database, not by Python."""
    previous = None
    for index, row in enumerate(rows):
        key = []
        for field, direction in order:
            value = row.get(field)
            if isinstance(value, str):
                break
            # NULLs sort last in either direction
            rank = (
                (1, 0)
                if value is None
                else (0, value if direction == "asc" else -value)
            )
            key.append(rank)
        if previous is not None and key[: len(previous)] < previous[: len(key)]:
            return index
        previous = key
    return None


def capture(
    base: str, out: Path, samples: Dict[str, Dict[str, List[int]]], builds
) -> int:
    base = base.rstrip("/")
    failed = 0
    for slug in builds:
        folder = out / slug
        folder.mkdir(parents=True, exist_ok=True)
        root = f"{base}/api/v1/{slug}"
        index: Dict[str, dict] = {}
        notes: List[str] = []

        def record(name: str, request: Request, recorded_path: Optional[str] = None):
            result = call(root, request)
            if recorded_path:
                result["request"] = dict(request, path=recorded_path)
            filename = hashlib.sha1(name.encode()).hexdigest()[:16] + ".json"
            (folder / filename).write_text(json.dumps(result, sort_keys=True))
            _, rows = _rows(result["body"])
            index[name] = {
                "file": filename,
                "status": result["status"],
                "ms": result["ms"],
                "rows": len(rows) if rows is not None else None,
            }
            if request.get("order") and rows:
                at = unsorted_at(rows, request["order"])
                if at is not None:
                    notes.append(f"NOT SORTED as declared: {name} (row {at})")

        for name, request in requests_for(samples[slug]):
            record(name, request)
        for name, request, recorded_path in follow_up_requests(lambda r: call(root, r)):
            record(name, request, recorded_path)

        (folder / "index.json").write_text(json.dumps(index, indent=1, sort_keys=True))
        statuses: Dict[int, int] = {}
        for entry in index.values():
            statuses[entry["status"]] = statuses.get(entry["status"], 0) + 1
        empty = sorted(n for n, e in index.items() if e["rows"] == 0)
        slow = sum(1 for e in index.values() if e["ms"] > 500)
        print(
            f"{slug}: {len(index)} responses, statuses {dict(sorted(statuses.items()))}, "
            f"{len(empty)} with no rows, {slow} over 500 ms"
        )
        for note in notes:
            print(f"  {note}")
        failed += len(notes)
    return 1 if failed else 0


# --------------------------------------------------------------------------- compare


def canonical(value: Any) -> str:
    """Strict text form: 15 and 15.0, or false and 0, are different values."""
    return json.dumps(value, sort_keys=True)


def normalize(value: Any, parent: str = "", grandparent: str = "") -> Any:
    """Apply the allowed differences listed in the module docstring."""
    if isinstance(value, dict):
        internal = "aoid" in value or "source_type_id" in value
        skip = INTERNAL_ID_KEYS | ({"id"} if internal else frozenset())
        return {k: normalize(v, k, parent) for k, v in value.items() if k not in skip}
    if isinstance(value, list):
        items = [normalize(v, parent, grandparent) for v in value]
        if parent in ROW_LISTS or parent in ORDERED_LISTS:
            return items
        if parent == "criteria":
            if grandparent == "actions":
                return items
            return sorted({canonical(v): v for v in items}.values(), key=canonical)
        return sorted(items, key=canonical)
    return value


def _row_key(row: Any) -> Any:
    if isinstance(row, dict):
        for key in ("aoid", "slug"):
            if key in row:
                return (key, row[key])
        if "name" in row:
            return ("name", f"{row['name']} #{row.get('id', '')}")
    return ("json", canonical(row))


def differences(old: dict, new: dict) -> List[str]:
    if old["status"] != new["status"]:
        return [f"status {old['status']} -> {new['status']}"]
    key, raw_a = _rows(old["body"])
    _, raw_b = _rows(new["body"])
    if key is None or raw_b is None:
        a, b = normalize(old["body"]), normalize(new["body"])
        return [] if canonical(a) == canonical(b) else [_first_difference(a, b)]

    found = []
    if isinstance(old["body"], dict) != isinstance(new["body"], dict):
        return ["the response changed shape (object or list)"]
    if key:
        rest_a = normalize({k: v for k, v in old["body"].items() if k != key})
        rest_b = normalize({k: v for k, v in new["body"].items() if k != key})
        if canonical(rest_a) != canonical(rest_b):
            found.append("envelope: " + _first_difference(rest_a, rest_b))
    rows_a = [normalize(row, "", key or "rows") for row in raw_a]
    rows_b = [normalize(row, "", key or "rows") for row in raw_b]
    if old["request"].get("in_order", True) and [_row_key(r) for r in rows_a] != [
        _row_key(r) for r in rows_b
    ]:
        if sorted(map(str, map(_row_key, rows_a))) == sorted(
            map(str, map(_row_key, rows_b))
        ):
            found.append("same rows in a different order")
        else:
            found.append("different rows")
    by_a = {_row_key(r): r for r in rows_a}
    by_b = {_row_key(r): r for r in rows_b}
    if len(by_a) != len(rows_a) or len(by_b) != len(rows_b):
        found.append("rows repeat within one response")
    if set(by_a) != set(by_b):
        found.append(
            f"rows: {len(set(by_a) - set(by_b))} missing, "
            f"{len(set(by_b) - set(by_a))} unexpected"
        )
    for row_key in sorted(set(by_a) & set(by_b), key=str):
        if canonical(by_a[row_key]) != canonical(by_b[row_key]):
            found.append(
                f"row {row_key[1]}: " + _first_difference(by_a[row_key], by_b[row_key])
            )
            if len(found) >= 5:
                break
    return found


def _first_difference(a: Any, b: Any, path: str = "") -> str:
    if type(a) is not type(b):
        return f"{path or '.'}: {_short(a)} -> {_short(b)}"
    if isinstance(a, dict):
        for k in sorted(set(a) | set(b)):
            if k not in a:
                return f"{path}.{k}: added"
            if k not in b:
                return f"{path}.{k}: removed"
            if canonical(a[k]) != canonical(b[k]):
                return _first_difference(a[k], b[k], f"{path}.{k}")
    if isinstance(a, list):
        if len(a) != len(b):
            return f"{path}: {len(a)} entries -> {len(b)}"
        for i, (x, y) in enumerate(zip(a, b)):
            if canonical(x) != canonical(y):
                return _first_difference(x, y, f"{path}[{i}]")
    return f"{path or '.'}: {_short(a)} -> {_short(b)}"


def _short(value: Any) -> str:
    text = canonical(value)
    return text if len(text) <= 80 else text[:77] + "..."


def compare(old_dir: Path, new_dir: Path) -> int:
    failed = 0
    for slug in sorted(p.name for p in old_dir.iterdir() if p.is_dir()):
        old_index = json.loads((old_dir / slug / "index.json").read_text())
        new_path = new_dir / slug / "index.json"
        if not new_path.exists():
            print(f"{slug}: missing from {new_dir}")
            failed += len(old_index)
            continue
        new_index = json.loads(new_path.read_text())
        bad = []
        for name, entry in sorted(old_index.items()):
            if name not in new_index:
                bad.append((name, ["not captured"]))
                continue
            old = json.loads((old_dir / slug / entry["file"]).read_text())
            new = json.loads((new_dir / slug / new_index[name]["file"]).read_text())
            found = differences(old, new)
            if found:
                bad.append((name, found))
        extra = sorted(set(new_index) - set(old_index))
        print(
            f"{slug}: {len(old_index) - len(bad)}/{len(old_index)} match"
            + (f"; {len(extra)} responses only in the new capture" if extra else "")
        )
        for name, found in bad[:15]:
            print(f"  {name}")
            for line in found[:3]:
                print(f"      {line}")
        if len(bad) > 15:
            print(f"  ... and {len(bad) - 15} more")
        failed += len(bad) + len(extra)
    return 1 if failed else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    commands = parser.add_subparsers(dest="command", required=True)
    s = commands.add_parser("samples")
    s.add_argument("extracts", type=Path)
    c = commands.add_parser("capture")
    c.add_argument("base_url")
    c.add_argument("out", type=Path)
    c.add_argument("--samples", type=Path, default=DEFAULT_SAMPLES)
    c.add_argument("--build", action="append")
    d = commands.add_parser("compare")
    d.add_argument("old", type=Path)
    d.add_argument("new", type=Path)
    args = parser.parse_args()

    if args.command == "samples":
        json.dump(build_samples(args.extracts.expanduser()), sys.stdout, indent=1)
        return 0
    if args.command == "capture":
        samples = json.loads(args.samples.read_text())
        return capture(args.base_url, args.out, samples, args.build or BUILDS)
    return compare(args.old, args.new)


if __name__ == "__main__":
    sys.exit(main())
