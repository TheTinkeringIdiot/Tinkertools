"""
Reading extracted builds for the content-addressed store.

Layout of the extracts folder: docs/plans/content-addressed-store/extract-contract.md.

Parsing and splitting a build takes far longer than writing it, and most of
what it produces is already in the store, so builds are read in worker
processes ahead of the importer (:class:`ExtractReader`). A worker splits one
build, hands over the per-item rows, and then answers one request for the part
documents the store turned out to lack, so the documents of unchanged items
never leave the worker.
"""

from __future__ import annotations

import json
import multiprocessing
from collections import deque
from pathlib import Path
from typing import Any, Deque, Dict, Iterator, List, Optional, Tuple

from app.core.cas_store import BuildContent, BuildSpec, StoreError, split_records

IMPORTABLE = ("extracted", "duplicate")
# Position in the version list for a build the registry does not know: per
# family, newest build first.
SORT_BASE = {"prk": 100, "ao": 1000}
OTHER_SORT_BASE = 5000
DEFAULT_FEATURES = {
    "items": True,
    "nanos": True,
    "perks": False,
    "symbiants": False,
    "sources": True,
}


def read_manifest(root: Path, slug: str) -> Dict[str, Any]:
    path = root / slug / "manifest.json"
    if not path.exists():
        raise StoreError(f"No manifest for '{slug}': {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def plan_builds(
    root: Path, entries: List[Dict[str, Any]], registry: Dict[str, Dict[str, Any]]
) -> List[BuildSpec]:
    """The ``build`` row of every importable entry of index.json, in index order.

    ``registry`` holds the rows of ``public.game_versions`` by slug; a build it
    knows takes its display name, list position, flags and features from there.

    - ``ordinal`` is the entry's position among all entries of its family, so
      a build that failed to extract keeps its place should it be fixed.
    - ``parent_slug`` is set only for a build whose registered parent belongs
      to another family: the fork point of a branch.
    - ``overlay_strain_first`` is true for the newest importable build of each
      family: the curated nano strains describe the game as it is now.
    """
    family_of = {entry["slug"]: entry["family"] for entry in entries}
    specs = []
    for entry in entries:
        if entry["status"] not in IMPORTABLE:
            continue
        slug, family = entry["slug"], entry["family"]
        same_family = [e for e in entries if e["family"] == family]
        importable = [e["slug"] for e in same_family if e["status"] in IMPORTABLE]
        position = [e["slug"] for e in same_family].index(slug)
        extract_slug = entry.get("extract_slug") or slug
        manifest = read_manifest(root, extract_slug)
        known = registry.get(slug)
        build = entry.get("build") or manifest.get("client_build") or slug
        parent = known.get("parent_slug") if known else None
        if parent and family_of.get(parent, family) == family:
            parent = None
        commit = manifest.get("tinkerparse_commit")
        if known:
            display_name, sort_order = known["display_name"], known["sort_order"]
        else:
            display_name = f"{family.upper()} {build}"
            sort_order = (
                SORT_BASE.get(family, OTHER_SORT_BASE) + len(same_family) - position
            )
        if extract_slug != slug:
            client_build = build
            notes = f"Client database identical to {extract_slug}"
        else:
            client_build = manifest.get("client_build") or build
            notes = (
                f"Client build {client_build}, extracted by TinkerParse "
                f"{(commit or 'unknown')[:12]}"
            )
        specs.append(
            BuildSpec(
                slug=slug,
                branch=family,
                ordinal=position + 1,
                display_name=display_name,
                sort_order=sort_order,
                client_build=client_build,
                parent_slug=parent,
                enabled=known["enabled"] if known else True,
                is_default=bool(known and known["is_default"]),
                features=dict(known["features"] or {})
                if known
                else dict(DEFAULT_FEATURES),
                extract_slug=extract_slug,
                rdb_dat_sha256=entry.get("rdb_dat_sha256")
                or manifest.get("rdb_dat_sha256"),
                tinkerparse_commit=commit,
                notes=(known or {}).get("notes") or notes,
                overlay_strain_first=slug == importable[-1],
            )
        )
    return specs


def read_records(folder: Path) -> Iterator[Tuple[Dict[str, Any], bool]]:
    """Every record of an extracted build as ``(record, is_nano)``."""
    for filename, is_nano in (("items.json", False), ("nanos.json", True)):
        for record in json.loads((folder / filename).read_bytes()):
            yield record, is_nano


def read_build(folder: Path) -> BuildContent:
    return split_records(read_records(folder))


def _serve(connection, folder: str) -> None:
    """Worker: split the build in ``folder``, send its rows, then answer
    document requests until told to stop (None) or the importer goes away."""
    try:
        try:
            content = read_build(Path(folder))
        except Exception as exc:
            connection.send(("error", f"{type(exc).__name__}: {exc}"))
            return
        connection.send(("rows", content.rows, content.formats))
        while True:
            wanted = connection.recv()
            if wanted is None:
                return
            connection.send(content.documents(wanted))
    except (EOFError, BrokenPipeError):
        pass
    finally:
        connection.close()


class RemoteContent(BuildContent):
    """A :class:`BuildContent` whose documents stay in the worker that split
    the build until they are asked for."""

    def __init__(self, process, connection, rows, formats):
        super().__init__(rows, formats, {})
        self._process, self._connection = process, connection

    def documents(self, wanted: Dict[str, List[str]]) -> Dict[str, List[Any]]:
        self._connection.send(wanted)
        return self._connection.recv()

    def close(self) -> None:
        try:
            self._connection.send(None)
        except (BrokenPipeError, OSError):
            pass
        self._connection.close()
        self._process.join()


class ExtractReader:
    """Reads the build folders in ``folders``, in order, up to ``workers`` of
    them at once and ahead of the consumer.

    :meth:`next` returns the content of the next folder. With ``workers`` 0
    builds are read in this process, one at a time.
    """

    def __init__(self, folders: List[Path], workers: int):
        self._pending: Deque[Path] = deque(folders)
        self._workers = workers
        self._running: Deque[Tuple[Path, Any, Any]] = deque()
        self._context = multiprocessing.get_context("spawn")

    def _start(self) -> None:
        while self._pending and len(self._running) < self._workers:
            folder = self._pending.popleft()
            ours, theirs = self._context.Pipe()
            process = self._context.Process(
                target=_serve, args=(theirs, str(folder)), daemon=True
            )
            process.start()
            theirs.close()
            self._running.append((folder, process, ours))

    def next(self) -> BuildContent:
        if self._workers <= 0:
            return read_build(self._pending.popleft())
        self._start()
        folder, process, connection = self._running.popleft()
        try:
            message = connection.recv()
        except EOFError:
            process.join()
            raise StoreError(
                f"Reading {folder} failed: worker exited with code {process.exitcode}"
            )
        self._start()
        if message[0] == "error":
            process.join()
            raise StoreError(f"Reading {folder} failed: {message[1]}")
        return RemoteContent(process, connection, message[1], message[2])

    def close(self) -> None:
        for _, process, connection in self._running:
            process.terminate()
            connection.close()
            process.join()
        self._running.clear()
