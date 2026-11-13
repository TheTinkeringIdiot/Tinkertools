"""Golden reference for the API: capture responses, then compare a later capture.

The rewrite of the storage layer must not change what the API returns. This
tool records the responses of a fixed set of requests on a fixed set of builds
and compares two recordings, ignoring only what is allowed to change:

- internal row ids (``id``, ``item_id``): items are identified by AOID;
- the order of stats, effects, actions, events and attack/defense entries
  (see app/core/parts.py). The order of criteria is compared, because it is
  meaningful;
- the order of rows that tie on a list's sort key. Lists are compared as sets
  keyed by AOID, and the sequence of sort-key values is compared separately.
  When a result does not fit on one page, only the total and the sort-key
  sequence are compared with the rows both pages share.

Usage:
    python tools/golden.py samples EXTRACTS_DIR            > tools/golden_samples.json
    python tools/golden.py capture BASE_URL OUT_DIR [--samples FILE] [--build SLUG ...]
    python tools/golden.py compare OLD_DIR NEW_DIR [--ignore-key KEY ...]

``compare`` exits 1 when any response differs.
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
from typing import Any, Dict, Iterable, List, Optional, Tuple

BUILDS = ("ao-14-2-2", "ao-15-0-1", "ao-17-10-5", "ao-18-8-62-ep1", "prk-0-7-1")
SAMPLE_COUNTS = {"items": 20, "nanos": 10, "weapons": 8, "implants": 5}
IGNORED_KEYS = frozenset({"id", "item_id"})
# Lists whose order is part of the content.
ORDERED_LISTS = frozenset({"criteria"})
# Lists of result rows, compared as sets with a separate sort-key check.
ROW_LISTS = ("items", "weapons", "results")
DEFAULT_SAMPLES = Path(__file__).with_name("golden_samples.json")

NT, ADVENTURER, DOCTOR = 11, 6, 10
# Perks exist only in the newest builds; elsewhere the lookup finds nothing.
PERK_AOIDS = (211897, 252356, 253065, 260942, 261097, 261129, 261349, 261929)


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


def _get(
    path: str, order_key: Optional[str] = None, all_pages: bool = False, **params
) -> dict:
    query = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
    return {
        "method": "GET",
        "path": path + ("?" + query if query else ""),
        "order_key": order_key,
        "all_pages": all_pages,
    }


def _post(path: str, body: dict) -> dict:
    return {"method": "POST", "path": path, "body": body, "order_key": None}


def requests_for(sample: Dict[str, List[int]]) -> Iterable[Tuple[str, dict]]:
    """Every request made against one build, as ``(name, request)``."""
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
        "ql-range": dict(q="ring", min_ql=150, max_ql=160),
        "class-armor": dict(q="cloak", item_class=2),
        "slot-head": dict(q="helmet", slot=2, min_ql=150),
        "requires-and-modifies": dict(
            q="a", stat_filters="requires:112:>=:100,modifies:17:>=:1"
        ),
        "requires-level": dict(q="of", stat_filters="requires:54:>=:215"),
        "modifies-skill": dict(q="e", stat_bonuses="124", min_ql=250),
        "froob-nodrop-breed": dict(
            q="bracer", froob_friendly="true", nodrop="false", breed=1
        ),
        "profession-faction": dict(
            q="armor", profession=ADVENTURER, faction=1, min_ql=280
        ),
        "gender": dict(q="a", gender=2),
        "no-match": dict(q="zzzzqqqq"),
    }.items():
        yield f"search/{name}", _get(
            "/items/search", order_key="name", page_size=big, **params
        )
    for name, params in {
        "class-weapon-ql": dict(item_class=1, min_ql=299, max_ql=299),
        "nanos-ql": dict(is_nano="true", min_ql=215, max_ql=220),
        "slot-profession": dict(slot=6, profession=DOCTOR, min_ql=200),
        "stat-bonus": dict(stat_bonuses="19,21", min_ql=290),
        "strain": dict(strain=144),
    }.items():
        yield f"items/{name}", _get("/items", page_size=big, **params)

    for name, params in {
        "school": dict(school="Combat", ql_min=100, ql_max=110),
        "profession-level": dict(profession=NT, level_min=100, level_max=150),
        "ql-sorted": dict(ql_min=205, ql_max=207, sort_by="ql"),
        "strain": dict(strain=144),
    }.items():
        yield f"nanos/{name}", _get("/nanos", page_size=200, **params)
    yield "nanos/search-heal", _get(
        "/nanos/search",
        order_key="name",
        q="heal",
        ql_min=150,
        ql_max=170,
        page_size=200,
    )
    yield "nanos/strains", _get("/nanos/strains")
    yield "nanos/strains-profession", _get("/nanos/strains", profession=DOCTOR)
    for profession in (ADVENTURER, DOCTOR, NT):
        yield f"nanos/profession/{profession}", _get(
            f"/nanos/profession/{profession}", order_key="name", page_size=big
        )
    yield f"nanos/offensive/{NT}", _get(
        f"/nanos/offensive/{NT}", order_key="name", page_size=big
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
        yield f"weapons/{name}", _post("/weapons/analyze", body)

    for name, body in {
        "chest-three": dict(
            slot=32, ql=200, clusters={"Shiny": 16, "Bright": 112, "Faded": 19}
        ),
        "head-one": dict(slot=4, ql=120, clusters={"Shiny": 19}),
        "eye-empty": dict(slot=2, ql=50, clusters={}),
    }.items():
        yield f"implants/{name}", _post("/implants/lookup", body)

    yield "symbiants", _get("/symbiants", all_pages=True, page_size=200)
    yield "mobs/pocket-bosses", _get("/mobs", is_pocket_boss="true", page_size=big)
    yield "perks/batch-lookup", _post(
        "/perks/batch/lookup", {"aoids": list(PERK_AOIDS) + everything[:3]}
    )


# --------------------------------------------------------------------------- capture


def call(base: str, request: dict) -> dict:
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


def capture(
    base: str, out: Path, samples: Dict[str, Dict[str, List[int]]], builds
) -> int:
    base = base.rstrip("/")
    for slug in builds:
        folder = out / slug
        folder.mkdir(parents=True, exist_ok=True)
        index, slow = {}, []
        for name, request in requests_for(samples[slug]):
            result = call(f"{base}/api/v1/{slug}", request)
            filename = hashlib.sha1(name.encode()).hexdigest()[:16] + ".json"
            (folder / filename).write_text(json.dumps(result, sort_keys=True))
            index[name] = {
                "file": filename,
                "status": result["status"],
                "ms": result["ms"],
            }
            if result["ms"] > 500 and not request.get("all_pages"):
                slow.append((result["ms"], name))
        # Mob drops need the server's own mob ids, which are not part of the contract.
        mobs = call(
            f"{base}/api/v1/{slug}",
            _get("/mobs", is_pocket_boss="true", page_size=1000),
        )
        rows = mobs["body"].get("items", []) if isinstance(mobs["body"], dict) else []
        for mob in sorted(rows, key=lambda m: m.get("name") or "")[:5]:
            name = f"mob-drops/{mob['name']}"
            result = call(f"{base}/api/v1/{slug}", _get(f"/mobs/{mob['id']}/drops"))
            result["request"]["path"] = "/mobs/<id>/drops"
            filename = hashlib.sha1(name.encode()).hexdigest()[:16] + ".json"
            (folder / filename).write_text(json.dumps(result, sort_keys=True))
            index[name] = {
                "file": filename,
                "status": result["status"],
                "ms": result["ms"],
            }
        (folder / "index.json").write_text(json.dumps(index, indent=1, sort_keys=True))
        statuses: Dict[int, int] = {}
        for entry in index.values():
            statuses[entry["status"]] = statuses.get(entry["status"], 0) + 1
        print(
            f"{slug}: {len(index)} responses, statuses {statuses}, "
            f"{len(slow)} over 500 ms" + (f" (slowest {max(slow)})" if slow else "")
        )
    return 0


# --------------------------------------------------------------------------- compare


def normalize(value: Any, ignored: frozenset, parent: str = "") -> Any:
    """Drop ignored keys and remove the order of lists whose order is not content."""
    if isinstance(value, dict):
        return {
            k: normalize(v, ignored, k) for k, v in value.items() if k not in ignored
        }
    if isinstance(value, list):
        items = [normalize(v, ignored, parent) for v in value]
        if parent in ORDERED_LISTS or parent in ROW_LISTS:
            return items
        return sorted(items, key=lambda v: json.dumps(v, sort_keys=True))
    return value


def _rows(body: Any) -> Tuple[Optional[str], Optional[list]]:
    if isinstance(body, dict):
        for key in ROW_LISTS:
            if isinstance(body.get(key), list):
                return key, body[key]
    return None, None


def _row_key(row: Any) -> Any:
    if isinstance(row, dict):
        for key in ("aoid", "name"):
            if key in row:
                return (key, row[key])
    return ("json", json.dumps(row, sort_keys=True))


def differences(old: dict, new: dict, ignored: frozenset) -> List[str]:
    if old["status"] != new["status"]:
        return [f"status {old['status']} -> {new['status']}"]
    a, b = normalize(old["body"], ignored), normalize(new["body"], ignored)
    key, rows_a = _rows(a)
    _, rows_b = _rows(b)
    if key is None or rows_b is None:
        return [] if a == b else [_first_difference(a, b)]

    found = []
    rest_a = {k: v for k, v in a.items() if k != key}
    rest_b = {k: v for k, v in b.items() if k != key}
    if rest_a != rest_b:
        found.append("envelope: " + _first_difference(rest_a, rest_b))
    order_key = old["request"].get("order_key")
    if order_key:
        seq_a = [r.get(order_key) for r in rows_a]
        seq_b = [r.get(order_key) for r in rows_b]
        if seq_a != seq_b:
            found.append(f"order by {order_key} differs")
    by_a = {_row_key(r): r for r in rows_a}
    by_b = {_row_key(r): r for r in rows_b}
    complete = a.get("total") in (None, len(rows_a)) and not a.get("has_next")
    if complete and set(by_a) != set(by_b):
        found.append(
            f"rows: {len(set(by_a) - set(by_b))} missing, "
            f"{len(set(by_b) - set(by_a))} unexpected"
        )
    for row_key in sorted(set(by_a) & set(by_b), key=str):
        if by_a[row_key] != by_b[row_key]:
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
            if a[k] != b[k]:
                return _first_difference(a[k], b[k], f"{path}.{k}")
    if isinstance(a, list):
        if len(a) != len(b):
            return f"{path}: {len(a)} entries -> {len(b)}"
        for i, (x, y) in enumerate(zip(a, b)):
            if x != y:
                return _first_difference(x, y, f"{path}[{i}]")
    return f"{path or '.'}: {_short(a)} -> {_short(b)}"


def _short(value: Any) -> str:
    text = json.dumps(value, sort_keys=True)
    return text if len(text) <= 80 else text[:77] + "..."


def compare(old_dir: Path, new_dir: Path, ignored: frozenset) -> int:
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
            found = differences(old, new, ignored)
            if found:
                bad.append((name, found))
        old_ms = sum(e["ms"] for e in old_index.values())
        new_ms = sum(new_index[n]["ms"] for n in old_index if n in new_index)
        print(
            f"{slug}: {len(old_index) - len(bad)}/{len(old_index)} match; "
            f"total time {old_ms} ms -> {new_ms} ms"
        )
        for name, found in bad[:15]:
            print(f"  {name}")
            for line in found[:3]:
                print(f"      {line}")
        if len(bad) > 15:
            print(f"  ... and {len(bad) - 15} more")
        failed += len(bad)
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
    d.add_argument("--ignore-key", action="append", default=[])
    args = parser.parse_args()

    if args.command == "samples":
        json.dump(build_samples(args.extracts.expanduser()), sys.stdout, indent=1)
        return 0
    if args.command == "capture":
        samples = json.loads(args.samples.read_text())
        return capture(args.base_url, args.out, samples, args.build or BUILDS)
    return compare(args.old, args.new, IGNORED_KEYS | frozenset(args.ignore_key))


if __name__ == "__main__":
    sys.exit(main())
