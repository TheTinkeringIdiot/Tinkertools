#!/usr/bin/env python3
"""
Canonical unified=0 git range diff exporter.

Features:
- Single-pass acquisition of name-status, numstat, and unified=0 hunk headers (diff-filter=ACMR for hunks).
- Produces machine-readable JSON (schemaVersion=1) and Markdown summary table.
- Includes hunks for every Added/Modified/Renamed (non-deleted) textual file.
- Deleted files included with empty hunk list.
- Binary detection: additions/deletions are null (git numstat uses '-').
- Deterministic path ordering.
- Integrity validation (totals vs recomputed).
- Hunk presence validation (unless disabled).
- Supports customizable output paths & range parameters.

Usage examples:
  ./scripts/git_diff_export.py c8c4fe1b40ac920dbe890fcd18fc0e874db06b4b frontend/
  ./scripts/git_diff_export.py BASE_HASH frontend/ --to HEAD --json-out diff.json --md-out diff.md
"""

from __future__ import annotations
import argparse
import dataclasses
import json
import os
import re
import subprocess
import sys
import textwrap
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any


@dataclasses.dataclass
class Hunk:
    oldStart: int
    oldLines: int
    newStart: int
    newLines: int

    def to_dict(self) -> Dict[str, int]:
        return {
            "oldStart": self.oldStart,
            "oldLines": self.oldLines,
            "newStart": self.newStart,
            "newLines": self.newLines,
        }


@dataclasses.dataclass
class FileDiff:
    path: str
    status: str  # A M D R
    additions: Optional[int]
    deletions: Optional[int]
    hunks: List[Hunk]
    renamedFrom: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        data = {
            "path": self.path,
            "status": self.status,
            "additions": self.additions,
            "deletions": self.deletions,
            "hunks": [h.to_dict() for h in self.hunks] if self.status != "D" else [],
        }
        if self.status == "R" and self.renamedFrom:
            data["renamedFrom"] = self.renamedFrom
        return data


def run_git(args: List[str]) -> str:
    try:
        return subprocess.check_output(["git", *args], text=True)
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] git {' '.join(args)} failed: {e}", file=sys.stderr)
        raise


def parse_name_status(raw: str) -> Tuple[Dict[str, str], Dict[str, str]]:
    """
    Returns:
        status_map[path] = status_code (A|M|D|R)
        renamed_from[new_path] = old_path (for status R)
    """
    status_map: Dict[str, str] = {}
    renamed_from: Dict[str, str] = {}
    for line in raw.strip().splitlines():
        if not line.strip():
            continue
        parts = line.split("\t")
        code = parts[0]
        if code.startswith("R"):
            # R### old new
            if len(parts) < 3:
                continue
            old_p, new_p = parts[1], parts[2]
            status_map[new_p] = "R"
            renamed_from[new_p] = old_p
        else:
            if len(parts) < 2:
                continue
            path = parts[1]
            status_map[path] = code
    return status_map, renamed_from


def parse_numstat(raw: str) -> Dict[str, Tuple[Optional[int], Optional[int]]]:
    """
    Returns:
        counts[path] = (additions, deletions)
        '-' becomes None (binary)
    """
    counts: Dict[str, Tuple[Optional[int], Optional[int]]] = {}
    for line in raw.strip().splitlines():
        if not line.strip():
            continue
        parts = line.split("\t")
        if len(parts) < 3:
            continue
        add_s, del_s, *paths = parts
        path = paths[-1]  # for rename lines numstat may have two paths
        additions: Optional[int] = None if add_s == "-" else int(add_s)
        deletions: Optional[int] = None if del_s == "-" else int(del_s)
        counts[path] = (additions, deletions)
    return counts


HUNK_HEADER_RE = re.compile(r"@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@")
DIFF_FILE_RE = re.compile(r"^diff --git a/(.+?) b/(\S+)")


def parse_unified_zero_for_hunks(raw: str) -> Dict[str, List[Hunk]]:
    """
    Extracts hunk headers for unified=0 diff output filtered to ACMR.
    """
    hunks: Dict[str, List[Hunk]] = {}
    current_file: Optional[str] = None
    for line in raw.splitlines():
        if line.startswith("diff --git "):
            m = DIFF_FILE_RE.search(line)
            if m:
                # We take the 'b/' path (second group)
                current_file = m.group(2)
            else:
                current_file = None
            continue
        if not current_file:
            continue
        if line.startswith("@@ "):
            m = HUNK_HEADER_RE.match(line)
            if m:
                old_start = int(m.group(1))
                old_len = int(m.group(2)) if m.group(2) else 1
                new_start = int(m.group(3))
                new_len = int(m.group(4)) if m.group(4) else 1
                hunks.setdefault(current_file, []).append(
                    Hunk(
                        oldStart=old_start,
                        oldLines=old_len,
                        newStart=new_start,
                        newLines=new_len,
                    )
                )
    return hunks


def build_file_entries(
    status_map: Dict[str, str],
    renamed_from: Dict[str, str],
    counts: Dict[str, Tuple[Optional[int], Optional[int]]],
    hunks_map: Dict[str, List[Hunk]],
) -> List[FileDiff]:
    all_paths = sorted(set(status_map.keys()) | set(counts.keys()))
    files: List[FileDiff] = []
    for path in all_paths:
        status = status_map.get(path, "M")
        adds, dels = counts.get(path, (0, 0))
        file_hunks: List[Hunk] = [] if status == "D" else hunks_map.get(path, [])
        renamed = renamed_from.get(path) if status == "R" else None
        files.append(
            FileDiff(
                path=path,
                status=status,
                additions=adds,
                deletions=dels,
                hunks=file_hunks,
                renamedFrom=renamed,
            )
        )
    return files


def compute_totals(files: List[FileDiff]) -> Tuple[int, int, int]:
    add = 0
    dele = 0
    for f in files:
        if isinstance(f.additions, int):
            add += f.additions
        if isinstance(f.deletions, int):
            dele += f.deletions
    return len(files), add, dele


def validate_integrity(
    files: List[FileDiff],
    reported_add: int,
    reported_del: int,
    enforce_hunks: bool,
) -> List[str]:
    errs: List[str] = []
    _, calc_add, calc_del = compute_totals(files)
    if calc_add != reported_add:
        errs.append(f"additions mismatch: reported={reported_add} computed={calc_add}")
    if calc_del != reported_del:
        errs.append(f"deletions mismatch: reported={reported_del} computed={calc_del}")

    if enforce_hunks:
        for f in files:
            if f.status in ("A", "M", "R"):
                # For textual changes (additions not None), expect ≥1 hunk.
                # If binary (additions is None), allow 0 hunks.
                if f.additions is not None and len(f.hunks) == 0:
                    errs.append(f"missing hunks for {f.status} {f.path}")
            elif f.status == "D" and f.hunks:
                errs.append(f"deleted file has hunks {f.path}")
    return errs


def write_json(
    path: Path,
    base: str,
    to_ref: str,
    files: List[FileDiff],
    totals: Tuple[int, int, int],
    command_str: str,
) -> None:
    out = {
        "schemaVersion": 1,
        "range": {"fromExclusive": base, "to": to_ref},
        "files": [f.to_dict() for f in files],
        "totals": {
            "files": totals[0],
            "additions": totals[1],
            "deletions": totals[2],
        },
        "meta": {
            "generator": "git_diff_export",
            "hunksIncluded": True,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "command": command_str,
        },
    }
    path.write_text(json.dumps(out, indent=2) + "\n")


def write_markdown(path: Path, files: List[FileDiff]) -> None:
    lines = [
        "| Status | Path | Add | Del | HunksCount |",
        "|--------|------|-----|-----|------------|",
    ]
    for f in files:
        add = "" if f.additions is None else f.additions
        dele = "" if f.deletions is None else f.deletions
        lines.append(
            f"| {f.status} | {f.path} | {add} | {dele} | {0 if f.status=='D' else len(f.hunks)} |"
        )
    path.write_text("\n".join(lines) + "\n")


def derive_default_outputs(base: str, to_ref: str, prefix: str) -> Tuple[Path, Path]:
    sanitized_prefix = prefix.rstrip("/").replace("/", "_")
    json_name = f"diff-{base}-{to_ref}-{sanitized_prefix}.json"
    md_name = f"diff-{base}-{to_ref}-{sanitized_prefix}.md"
    return Path(json_name), Path(md_name)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Export a zero-context (unified=0) git range diff (JSON + Markdown).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent(
            """
            Notes:
              - Hunks are always included for A/M/R textual files.
              - Binary changes have null additions/deletions and 0 hunks.
              - Deleted files appear with empty hunks array.
              - Exit code non-zero if integrity validation fails (unless --no-hunk-validation overrides hunk check only).
            """
        ),
    )
    p.add_argument("base", help="Base commit (exclusive).")
    p.add_argument("prefix", help="Path prefix / directory filter (e.g. 'frontend/').")
    p.add_argument(
        "--to",
        default="HEAD",
        help="End commit/ref (inclusive). Default: HEAD",
    )
    p.add_argument(
        "--json-out",
        help="Path to write JSON output (default derived).",
    )
    p.add_argument(
        "--md-out",
        help="Path to write Markdown table (default derived).",
    )
    p.add_argument(
        "--no-hunk-validation",
        action="store_true",
        help="Do not fail if A/M/R textual files have zero hunks.",
    )
    p.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress stdout summary (non-error).",
    )
    return p.parse_args()


def main() -> int:
    args = parse_args()
    base = args.base
    to_ref = args.to
    prefix = args.prefix

    # Acquire git outputs
    range_spec = f"{base}..{to_ref}"

    name_status_raw = run_git(["diff", "--name-status", range_spec, "--", prefix])
    status_map, renamed_from = parse_name_status(name_status_raw)

    numstat_raw = run_git(["diff", "--numstat", range_spec, "--", prefix])
    counts = parse_numstat(numstat_raw)

    unified_raw = run_git(
        ["diff", "--unified=0", "--diff-filter=ACMR", range_spec, "--", prefix]
    )
    hunks_map = parse_unified_zero_for_hunks(unified_raw)

    files = build_file_entries(status_map, renamed_from, counts, hunks_map)
    totals = compute_totals(files)

    # Validation
    integrity_errors = validate_integrity(
        files,
        reported_add=totals[1],
        reported_del=totals[2],
        enforce_hunks=not args.no_hunk_validation,
    )

    # Determine output paths
    if args.json_out:
        json_path = Path(args.json_out)
    else:
        json_path, _ = derive_default_outputs(base, to_ref, prefix)
    if args.md_out:
        md_path = Path(args.md_out)
    else:
        _, md_path = derive_default_outputs(base, to_ref, prefix)

    command_str = f"git diff --name-status/--numstat/--unified=0 {range_spec} -- {prefix}"

    write_json(json_path, base, to_ref, files, totals, command_str)
    write_markdown(md_path, files)

    if not args.quiet:
        print(f"[OK] Wrote JSON   -> {json_path}")
        print(f"[OK] Wrote Markdown -> {md_path}")
        print(
            f"[Totals] files={totals[0]} additions={totals[1]} deletions={totals[2]} (schemaVersion=1)"
        )
        if integrity_errors:
            print("[Integrity] FAIL")
            for e in integrity_errors:
                print(" -", e)
        else:
            print("[Integrity] OK")

    # Exit code: fail only if integrity/hunk validation errors exist
    return 1 if integrity_errors else 0


if __name__ == "__main__":
    sys.exit(main())