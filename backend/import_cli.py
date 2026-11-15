#!/usr/bin/env python3
"""
TinkerTools data import.

Game data lives in the content-addressed store (schema ``cas``; design:
docs/plans/content-addressed-store/design.md, tables: database/cas/). One
command loads it, from nothing or on top of what is there:

    export DATABASE_URL="postgresql://aodbuser:password@localhost:5432/tinkertools"

    # every importable build of the extracts folder, oldest first
    python import_cli.py import-cas --extracts-dir ~/projects/AO/extracts --workers 8

    # with the internal ids of the old production database (see IMPORT_README.md)
    python import_cli.py import-cas --extracts-dir ~/projects/AO/extracts \\
        --legacy-ids-file legacy_item_ids.csv

    # a scratch store with a few builds
    python import_cli.py import-cas --extracts-dir ~/projects/AO/extracts --schema cas_dev \\
        --slug ao-14-2-2 --slug ao-15-0-1 --slug ao-17-10-5

Besides the extracts it reads committed files: the curated data
(all_nanos_compacted.csv, database/perks.json, database/symbiants.csv), how
builds are presented (database/builds.toml) and the rules of the change log
(database/change_relevance.toml, database/build_notes.toml). It needs nothing
else from the database than the schema it writes. IMPORT_README.md is the guide.
"""

import argparse
import json
import logging
import os
import sys
import time
from pathlib import Path

sys.path.append(str(Path(__file__).parent))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(), logging.FileHandler("import.log")],
)

logger = logging.getLogger(__name__)

EXTRACT_STATUSES = {"extracted", "duplicate", "failed", "missing_db"}


def given_path(text: str) -> Path:
    """A path from the command line, with ``~`` and variables expanded."""
    return Path(os.path.expandvars(text)).expanduser()


def read_extract_index(root: Path) -> list:
    path = root / "index.json"
    with open(path) as f:
        entries = json.load(f)
    if not isinstance(entries, list):
        raise ValueError(f"{path} must hold a list of builds")
    for entry in entries:
        missing = {"slug", "family", "status"} - set(entry)
        if missing:
            raise ValueError(f"{path}: entry {entry} lacks {sorted(missing)}")
        if entry["status"] not in EXTRACT_STATUSES:
            raise ValueError(
                f"{path}: unknown status {entry['status']!r} for {entry['slug']}"
            )
    return entries


def import_cas(args) -> bool:
    """Import builds from an extracts folder into the content-addressed store.

    The extracts folder, its index, the manifests of the planned builds, the
    committed files, the legacy id file if one is given and the options are
    checked before anything is written. Curated data, the presentation of the
    stored builds and the change log are then brought in line with their
    files. Builds load in index order, each in its own transaction; builds
    already in the store are skipped, so the command can be re-run and picks
    up where it stopped.

    The nano strain policy follows the store: after every commit the newest
    stored build of each branch is the one served with the curated strains,
    whatever the index lists beyond it.
    """
    from app.core import cas_store, change_analysis
    from app.core.cas_curated import CuratedFiles, sync_curated
    from app.core.cas_extract import (
        BUILDS_FILE,
        ExtractReader,
        plan_builds,
        read_build_descriptions,
        read_manifest,
    )
    from app.core.cas_legacy import read_legacy_ids, sync_legacy_ids
    from app.core.change_rules import read_rules

    if args.workers < 0:
        logger.error("--workers must be 0 or more")
        return False
    if not args.extracts_dir:
        logger.error("--extracts-dir is required")
        return False
    database_url = args.database_url or os.environ.get("DATABASE_URL")
    if not database_url:
        logger.error("DATABASE_URL is not set")
        return False
    root = given_path(args.extracts_dir)
    started = time.perf_counter()
    timings = {}
    conn = None
    try:
        if not root.is_dir():
            raise FileNotFoundError(f"Extracts folder not found: {root}")
        if not (root / "index.json").is_file():
            raise FileNotFoundError(f"No index.json in the extracts folder {root}")
        if args.reset and not args.yes:
            raise ValueError(
                f"--reset drops every table of schema {args.schema}; re-run with --yes"
            )
        entries = read_extract_index(root)
        known = {e["slug"] for e in entries}
        for slug in args.slug or []:
            if slug not in known:
                # A folder outside the index: take what the manifest says.
                manifest = read_manifest(root, slug)
                entries.append(
                    {
                        "slug": slug,
                        "family": manifest.get("family") or "ao",
                        "build": manifest.get("client_build"),
                        "status": "extracted",
                        "extract_slug": slug,
                        "rdb_dat_sha256": manifest.get("rdb_dat_sha256"),
                    }
                )
        files = CuratedFiles()
        for attribute, given in (
            ("nanos_csv", args.nanos_csv),
            ("perks_json", args.perks_file),
            ("symbiants_csv", args.symbiants_file),
        ):
            if given:
                setattr(files, attribute, given_path(given))
            if not getattr(files, attribute).exists():
                raise FileNotFoundError(
                    f"Data file not found: {getattr(files, attribute)}"
                )
        rules = read_rules()
        described = read_build_descriptions(
            given_path(args.builds_file) if args.builds_file else BUILDS_FILE
        )
        legacy_ids = None
        if args.legacy_ids_file:
            legacy_file = given_path(args.legacy_ids_file)
            if not legacy_file.is_file():
                raise FileNotFoundError(f"Legacy id file not found: {legacy_file}")
            legacy_ids = read_legacy_ids(legacy_file)
        planned = plan_builds(root, entries, described)
        specs = [spec for spec in planned if not args.slug or spec.slug in args.slug]
        unknown = set(args.slug or []) - {spec.slug for spec in specs}
        if unknown:
            raise ValueError(f"No importable extract for: {', '.join(sorted(unknown))}")
        conn = cas_store.connect(database_url, args.schema)
    except (cas_store.StoreError, FileNotFoundError, ValueError) as e:
        logger.error(str(e))
        return False

    reader = None
    try:
        if args.reset:
            cas_store.drop_store(conn, args.schema)
        if cas_store.create_store(conn, args.schema):
            logger.info(f"Created the store's tables in schema {args.schema}")
        cas_store.upgrade_store(conn, args.schema)
        conn.commit()
        stored = {row[0] for row in conn.execute("SELECT slug FROM build")}

        with cas_store.phase(timings, "curated data"):
            written = sync_curated(conn, files)
            for spec in planned:
                if spec.slug in stored:
                    cas_store.update_presentation(conn, spec)
            cas_store.assign_strain_policy(conn)
            if written["nano_overlay"]:
                cas_store.apply_nano_overlay(conn)
            else:
                cas_store.sync_nano_properties(conn)
            conn.commit()
        if any(written.values()):
            logger.info(
                "Curated rows written: "
                + ", ".join(
                    f"{table} {count}" for table, count in written.items() if count
                )
            )
        if legacy_ids is not None:
            with cas_store.phase(timings, "legacy ids"):
                changed = sync_legacy_ids(conn, legacy_ids)
                conn.commit()
            logger.info(
                f"Legacy item ids: {len(legacy_ids)} in the file, "
                f"{changed} written or removed"
            )
        with cas_store.phase(timings, "change analysis"):
            analysed = change_analysis.sync(conn, rules)
            conn.commit()
        if any(analysed.values()):
            logger.info(
                "Change log brought in line with the rules: "
                + ", ".join(
                    f"{what} {count}" for what, count in analysed.items() if count
                )
            )

        todo = [spec for spec in specs if spec.slug not in stored]
        # Refuse an out-of-order build before anything is read. A duplicate of
        # the build before it needs no data read at all.
        newest_extract, needs_content = {}, {}
        for spec in todo:
            if spec.branch not in newest_extract:
                newest = cas_store.newest_build(conn, spec.branch)
                cas_store.require_newer(newest, spec)
                newest_extract[spec.branch] = newest["extract_slug"] if newest else None
            needs_content[spec.slug] = (
                spec.extract_slug == spec.slug
                or newest_extract[spec.branch] != spec.extract_slug
            )
            newest_extract[spec.branch] = spec.extract_slug
        reader = ExtractReader(
            [root / spec.extract_slug for spec in todo if needs_content[spec.slug]],
            args.workers,
        )

        logger.info(
            f"{len(specs) - len(todo)} build(s) already in the store, "
            f"{len(todo)} to import"
        )
        for spec in todo:
            content = None
            if needs_content[spec.slug]:
                with cas_store.phase(timings, "read and split (waiting)"):
                    content = reader.next()
            try:
                result = cas_store.import_build(conn, spec, content, timings, rules)
                with cas_store.phase(timings, "commit"):
                    conn.commit()
            finally:
                if content is not None:
                    content.close()
            if result.same_as_previous:
                logger.info(f"  {spec.slug:<20} same data as the build before it")
            else:
                logger.info(
                    f"  {spec.slug:<20} {result.items:>6} items, "
                    f"{result.new_revisions:>6} new revisions, "
                    f"+{result.added} -{result.removed} ~{result.changed}, "
                    f"new parts {sum(result.new_parts.values())}"
                )

        if todo or legacy_ids is not None:
            with cas_store.phase(timings, "analyze"):
                cas_store.analyze(conn, args.schema)
                conn.commit()
    except cas_store.StoreError as e:
        logger.error(str(e))
        return False
    finally:
        if reader is not None:
            reader.close()
        conn.close()

    logger.info("=" * 60)
    for name, seconds in timings.items():
        logger.info(f"  {name:<28} {seconds:8.1f} s")
    logger.info(f"  {'total (wall clock)':<28} {time.perf_counter() - started:8.1f} s")
    logger.info("=" * 60)
    return True


def main():
    parser = argparse.ArgumentParser(
        description="TinkerTools data import",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("command", choices=["import-cas"], help="Command to run")
    parser.add_argument(
        "--extracts-dir",
        type=str,
        default=None,
        help="Folder holding index.json and one <slug>/ per build (required)",
    )
    parser.add_argument(
        "--slug",
        action="append",
        default=None,
        help="Build to import (repeatable; default: every build in index.json). "
        "The builds of a branch are taken oldest first; one older than the newest "
        "stored build of its branch is refused",
    )
    parser.add_argument(
        "--schema",
        type=str,
        default="cas",
        help="Schema holding the store (default: cas)",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=4,
        help="Builds read and split in parallel, about 2 GB of memory each "
        "(default: 4; 0 reads in this process)",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Drop the store's tables in --schema and import from scratch (needs --yes)",
    )
    parser.add_argument(
        "--yes", action="store_true", help="Confirm --reset, which is destructive"
    )
    parser.add_argument(
        "--builds-file",
        type=str,
        default=None,
        help="How builds are presented (default: backend/database/builds.toml)",
    )
    parser.add_argument(
        "--legacy-ids-file",
        type=str,
        default=None,
        help="Internal item ids of the old store, as written by "
        "tools/export_legacy_item_ids.py. The store's map is made equal to the "
        "file; without the option the map is left as it is",
    )
    parser.add_argument(
        "--nanos-csv",
        type=str,
        default=None,
        help="Nano QL, strains and crystal sources "
        "(default: backend/all_nanos_compacted.csv)",
    )
    parser.add_argument(
        "--perks-file",
        type=str,
        default=None,
        help="Perk metadata (default: backend/database/perks.json)",
    )
    parser.add_argument(
        "--symbiants-file",
        type=str,
        default=None,
        help="Mobs and their drops (default: backend/database/symbiants.csv)",
    )
    parser.add_argument(
        "--database-url",
        type=str,
        default=None,
        help="Database to write (default: the DATABASE_URL variable)",
    )
    args = parser.parse_args()

    try:
        success = import_cas(args)
    except KeyboardInterrupt:
        logger.info("Import interrupted")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        import traceback

        logger.error(traceback.format_exc())
        sys.exit(1)

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
