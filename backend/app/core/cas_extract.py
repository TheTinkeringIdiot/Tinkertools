"""
Reading extracted builds for the content-addressed store.

Layout of the extracts folder: docs/plans/content-addressed-store/extract-contract.md.

``backend/database/builds.toml``: how builds are presented
==========================================================

What a build contains comes from its extract. How it is presented comes from
defaults, which a hand-maintained file overrides build by build. A table of
the file is named by the build's slug and may hold:

``display_name``  name in the version list (default ``<FAMILY> <client build>``)
``released_on``   date the build was released or captured (default: none)
``sort_order``    position in the version list (default: per family, newest
                  build first; see ``SORT_BASE``)
``enabled``       false hides the build from the API (default true)
``default``       true for the one build served to requests that name none
``parent``        the build of another family this family forks from; read
                  when the build is imported, never changed afterwards
``features``      curated data the build is served with, merged over
                  ``DEFAULT_FEATURES`` (``perks``, ``symbiants``, ...)
``notes``         provenance text (default: client build and extractor)

A build the file does not name takes every default. A table whose build the
extracts do not hold is ignored, so one file serves every store. Everything
but ``parent`` follows the file on every import run, also for builds already
stored (``cas_store.update_presentation``).

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
import tomllib
from collections import deque
from datetime import date
from pathlib import Path
from typing import Any, Deque, Dict, Iterator, List, Tuple

from app.core.cas_store import BuildContent, BuildSpec, StoreError, split_records

IMPORTABLE = ("extracted", "duplicate")
BUILDS_FILE = Path(__file__).resolve().parents[2] / "database" / "builds.toml"
# What a table of the builds file may hold, and the type of each value.
DESCRIPTION_FIELDS = {
    "display_name": str,
    "released_on": date,
    "sort_order": int,
    "enabled": bool,
    "default": bool,
    "parent": str,
    "features": dict,
    "notes": str,
}
# Position in the version list unless the builds file gives one: per family,
# newest build first.
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
    """The manifest of the extracted build ``slug``.

    The folder must be a complete extract: a manifest that names the slug,
    next to items.json and nanos.json.
    """
    folder = root / slug
    path = folder / "manifest.json"
    if not path.exists():
        raise StoreError(f"No manifest for '{slug}': {path}")
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except ValueError as exc:
        raise StoreError(f"{path} is not valid JSON: {exc}") from exc
    if not isinstance(manifest, dict) or manifest.get("slug") != slug:
        named = manifest.get("slug") if isinstance(manifest, dict) else None
        raise StoreError(f"{path} names slug {named!r}, expected {slug!r}")
    for name in ("items.json", "nanos.json"):
        if not (folder / name).exists():
            raise StoreError(f"Missing {folder / name}")
    return manifest


def read_build_descriptions(path: Path = BUILDS_FILE) -> Dict[str, Dict[str, Any]]:
    """The tables of the builds file by slug, checked (see the module docstring)."""
    try:
        data = tomllib.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise StoreError(f"Builds file not found: {path}") from None
    except tomllib.TOMLDecodeError as exc:
        raise StoreError(f"{path} is not valid TOML: {exc}") from exc
    for slug, described in data.items():
        if not isinstance(described, dict):
            raise StoreError(f"{path}: '{slug}' is not a table")
        for name, value in described.items():
            kind = DESCRIPTION_FIELDS.get(name)
            if kind is None:
                raise StoreError(f"{path}: [{slug}] has an unknown field '{name}'")
            # bool is an int to Python; a flag is not a position.
            if not isinstance(value, kind) or (kind is int and isinstance(value, bool)):
                raise StoreError(
                    f"{path}: [{slug}] {name} must be of type {kind.__name__}"
                )
        for feature, served in described.get("features", {}).items():
            if not isinstance(served, bool):
                raise StoreError(
                    f"{path}: [{slug}] features.{feature} must be true or false"
                )
    defaults = sorted(slug for slug, d in data.items() if d.get("default"))
    if len(defaults) > 1:
        raise StoreError(
            f"{path}: only one build can be the default, not {', '.join(defaults)}"
        )
    return data


def plan_builds(
    root: Path, entries: List[Dict[str, Any]], described: Dict[str, Dict[str, Any]]
) -> List[BuildSpec]:
    """The ``build`` row of every importable entry of index.json, in index order.

    ``described`` holds the tables of the builds file by slug
    (:func:`read_build_descriptions`); a build takes from its table whatever
    the table gives and a default for the rest.

    - ``ordinal`` is the entry's position among all entries of its family, so
      a build that failed to extract keeps its place should it be fixed.
    - ``parent_slug`` is set only for a build whose described parent belongs
      to another family: the fork point of a branch.
    """
    family_of = {entry["slug"]: entry["family"] for entry in entries}
    specs = []
    for entry in entries:
        if entry["status"] not in IMPORTABLE:
            continue
        slug, family = entry["slug"], entry["family"]
        same_family = [e for e in entries if e["family"] == family]
        position = [e["slug"] for e in same_family].index(slug)
        extract_slug = entry.get("extract_slug") or slug
        manifest = read_manifest(root, extract_slug)
        given = described.get(slug, {})
        build = entry.get("build") or manifest.get("client_build") or slug
        parent = given.get("parent")
        if parent and family_of.get(parent, family) == family:
            parent = None
        commit = manifest.get("tinkerparse_commit")
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
                display_name=given.get("display_name", f"{family.upper()} {build}"),
                sort_order=given.get(
                    "sort_order",
                    SORT_BASE.get(family, OTHER_SORT_BASE)
                    + len(same_family)
                    - position,
                ),
                client_build=client_build,
                released_on=given.get("released_on"),
                parent_slug=parent,
                enabled=given.get("enabled", True),
                is_default=given.get("default", False),
                features={**DEFAULT_FEATURES, **given.get("features", {})},
                extract_slug=extract_slug,
                rdb_dat_sha256=entry.get("rdb_dat_sha256")
                or manifest.get("rdb_dat_sha256"),
                tinkerparse_commit=commit,
                notes=given.get("notes", notes),
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
    builds are read in this process, one at a time. A build that cannot be
    read is a :class:`StoreError` naming its folder, wherever it was read.
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
            folder = self._pending.popleft()
            try:
                return read_build(folder)
            except Exception as exc:
                raise StoreError(
                    f"Reading {folder} failed: {type(exc).__name__}: {exc}"
                ) from exc
        self._start()
        folder, process, connection = self._running.popleft()
        try:
            message = connection.recv()
        except EOFError:
            process.join()
            raise StoreError(
                f"Reading {folder} failed: worker exited with code {process.exitcode}"
            ) from None
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
