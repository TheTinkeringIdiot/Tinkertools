#!/usr/bin/env python3
"""Extract game client databases into the folder that ``import_cli.py import-cas`` reads.

Runs TinkerParse, built from one pinned commit, over client builds and writes
``<extracts-dir>/<slug>/{items.json,nanos.json,manifest.json}`` plus ``index.json``.
Standard library only; needs ``git``, ``dotnet`` and, for archives, ``7z``.

See IMPORT_README.md ("Extract client builds") for usage.
"""

import argparse
import filecmp
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional

# Every build must be parsed by the same extractor: content hashes cover parser-generated fields.
TINKERPARSE_COMMIT = "56d596df9026e7fcf493e0926be4df1c682a5d07"

DB_DIR = Path("cd_image/data/db")
DAT_NAME = "ResourceDatabase.dat"
IDX_NAME = "ResourceDatabase.idx"
PRK_DB = Path("cd_image/rdb.db")
MAX_ERROR_RATIO = 0.01
HASH_CHUNK = 8 * 1024 * 1024

_log_lock = threading.Lock()
_log_file: Optional[Path] = None


def log(message: str) -> None:
    line = f"{datetime.now():%Y-%m-%d %H:%M:%S} {message}"
    with _log_lock:
        print(line, flush=True)
        if _log_file is not None:
            with open(_log_file, "a") as f:
                f.write(line + "\n")


@dataclass
class Build:
    family: str
    build: str
    slug: str
    source_path: str
    client_dir: Optional[Path] = None
    dat_files: list = field(default_factory=list)
    idx_file: Optional[Path] = None
    dat_sha: Optional[str] = None
    idx_sha: Optional[str] = None
    status: str = "extracted"
    extract_slug: Optional[str] = None
    error: Optional[str] = None
    repeat_of: Optional[str] = None

    def entry(self) -> dict:
        entry = {
            "build": self.build,
            "slug": self.slug,
            "family": self.family,
            "rdb_dat_sha256": self.dat_sha,
            "extract_slug": self.extract_slug,
            "status": self.status,
        }
        if self.error:
            entry["error"] = self.error
        return entry


def make_slug(family: str, build: str) -> str:
    return f"{family}-{re.sub(r'[^a-z0-9]+', '-', build.lower()).strip('-')}"


def build_key(build: str) -> tuple:
    """Numeric order for build strings: 14.7.10 sorts after 14.7.8."""
    return tuple(int(n) for n in re.findall(r"\d+", build)), build


def entry_key(entry: dict) -> tuple:
    return entry["family"], build_key(entry.get("build") or entry["slug"])


def sha256_files(paths: list) -> str:
    digest = hashlib.sha256()
    for path in paths:
        with open(path, "rb") as f:
            while chunk := f.read(HASH_CHUNK):
                digest.update(chunk)
    return digest.hexdigest()


def find_file(folder: Path, name: str) -> Optional[Path]:
    """Case-insensitive lookup: old clients do not agree on file name case."""
    if not folder.is_dir():
        return None
    for child in folder.iterdir():
        if child.name.lower() == name.lower():
            return child
    return None


def find_path(root: Path, relative: Path) -> Optional[Path]:
    current: Optional[Path] = root
    for part in relative.parts:
        current = find_file(current, part) if current else None
    return current


def read_version_file(path: Optional[Path]) -> Optional[str]:
    if path is None or not path.is_file():
        return None
    lines = path.read_text(errors="replace").split()
    return lines[0] if lines else None


def locate_ao_database(build: Build) -> None:
    """Fill in the database files of an AO client folder, or mark the build missing_db."""
    db_dir = find_path(build.client_dir, DB_DIR)
    dat = find_file(db_dir, DAT_NAME) if db_dir else None
    idx = find_file(db_dir, IDX_NAME) if db_dir else None
    if dat is None or idx is None:
        build.status = "missing_db"
        absent = [n for n, p in ((DAT_NAME, dat), (IDX_NAME, idx)) if p is None]
        build.error = f"no {' or '.join(absent)}"
        return
    # The live client splits the database into ResourceDatabase.dat, .dat.001, .dat.002, ...
    parts = sorted(
        p
        for p in db_dir.iterdir()
        if re.fullmatch(re.escape(dat.name) + r"\.\d+", p.name)
    )
    build.dat_files = [dat, *parts]
    build.idx_file = idx


def hash_build(build: Build) -> None:
    if build.status != "extracted":
        return
    build.dat_sha = sha256_files(build.dat_files)
    if build.idx_file is not None:
        build.idx_sha = sha256_files([build.idx_file])


def read_manifest(extracts: Path, slug: str) -> Optional[dict]:
    folder = extracts / slug
    path = folder / "manifest.json"
    if not (
        path.is_file()
        and (folder / "items.json").is_file()
        and (folder / "nanos.json").is_file()
    ):
        return None
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def known_extracts(extracts: Path, commit: str) -> dict:
    """Database hash -> slug, for extract folders written by this extractor commit."""
    known = {}
    if not extracts.is_dir():
        return known
    for folder in sorted(extracts.iterdir()):
        manifest = read_manifest(extracts, folder.name) if folder.is_dir() else None
        if (
            manifest
            and manifest.get("tinkerparse_commit") == commit
            and manifest.get("rdb_dat_sha256")
        ):
            known.setdefault(manifest["rdb_dat_sha256"], folder.name)
    return known


def classify(builds: list, known: dict, taken: dict, force: bool) -> list:
    """Decide what each build is, in build order. Returns the builds that need parsing.

    ``known`` maps a database hash to the slug whose extract folder holds it;
    ``taken`` maps every slug decided so far to its database hash.
    """
    to_parse = []
    pending = {}
    for build in sorted(builds, key=lambda b: (b.family, build_key(b.build))):
        if build.status != "extracted":
            taken.setdefault(build.slug, None)
            continue
        base, n = build.slug, 1
        while taken.get(build.slug, build.dat_sha) != build.dat_sha:
            n += 1
            build.slug = f"{base}-{n}"
        if build.slug != base:
            build.repeat_of = base
            log(
                f"{build.source_path}: slug {base} already names another database, using {build.slug}"
            )
        taken[build.slug] = build.dat_sha

        holder = pending.get(build.dat_sha) or known.get(build.dat_sha)
        if holder is None or holder == build.slug:
            build.extract_slug = build.slug
            pending[build.dat_sha] = build.slug
            if holder is None or force:
                to_parse.append(build)
            else:
                log(f"{build.slug}: up to date")
        else:
            build.status = "duplicate"
            build.extract_slug = holder
            log(f"{build.slug}: duplicate of {holder}")
    return to_parse


def parser_command(
    parser_dll: Path, build: Build, staging: Path, errors_file: Path
) -> list:
    command = [
        "dotnet",
        str(parser_dll),
        "--aopath",
        str(build.client_dir),
        "--output-dir",
        str(staging),
        "--errors-file",
        str(errors_file),
        "--items",
        "--nanos",
    ]
    if build.family == "prk":
        command.append("--prk")
    else:
        # Older AO clients store records in older formats; PRK numbers its builds on its own scale.
        command += ["--client-version", build.build]
    return command


def run_parser(parser_dll: Path, build: Build, extracts: Path, commit: str) -> None:
    """Parse one build into ``<extracts>/<slug>``; on failure mark the build failed."""
    started = datetime.now()
    target = extracts / build.slug
    staging = extracts / f".{build.slug}.tmp"
    shutil.rmtree(staging, ignore_errors=True)
    staging.mkdir(parents=True)
    errors_file = staging / "errors.json"
    command = parser_command(parser_dll, build, staging, errors_file)
    try:
        result = subprocess.run(
            command, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True
        )
        if result.returncode != 0:
            tail = (result.stderr or "").strip().splitlines()[-1:] or ["no output"]
            raise RuntimeError(f"TinkerParse exit {result.returncode}: {tail[0]}")
        with open(staging / "items.json") as f:
            item_count = len(json.load(f))
        with open(staging / "nanos.json") as f:
            nano_count = len(json.load(f))
        with open(errors_file) as f:
            parse_errors = json.load(f)
        errors_file.unlink()
        if item_count == 0:
            raise RuntimeError("no items parsed")
        total = item_count + nano_count + len(parse_errors)
        if len(parse_errors) > total * MAX_ERROR_RATIO:
            raise RuntimeError(
                f"{len(parse_errors)} of {total} records failed to parse"
            )
        manifest = {
            "slug": build.slug,
            "family": build.family,
            "client_build": build.build,
            "source_path": build.source_path,
            "rdb_dat_sha256": build.dat_sha,
            "rdb_idx_sha256": build.idx_sha,
            "tinkerparse_commit": commit,
            "item_count": item_count,
            "nano_count": nano_count,
            "parse_errors": parse_errors,
        }
        with open(staging / "manifest.json", "w") as f:
            json.dump(manifest, f, indent=2)
        shutil.rmtree(target, ignore_errors=True)
        staging.rename(target)
    except Exception as e:  # one bad build must not stop the run
        shutil.rmtree(staging, ignore_errors=True)
        build.status = "failed"
        build.extract_slug = None
        build.error = f"{type(e).__name__}: {e}"
        log(f"FAILED {build.slug}: {build.error}")
        return
    seconds = int((datetime.now() - started).total_seconds())
    log(
        f"parsed {build.slug} in {seconds}s items={item_count} nanos={nano_count} errors={len(parse_errors)}"
    )


def same_content(extracts: Path, build: Build) -> bool:
    return all(
        (extracts / slug / name).is_file()
        for slug in (build.slug, build.repeat_of)
        for name in ("items.json", "nanos.json")
    ) and all(
        filecmp.cmp(
            extracts / build.slug / name,
            extracts / build.repeat_of / name,
            shallow=False,
        )
        for name in ("items.json", "nanos.json")
    )


def process(
    builds: list,
    extracts: Path,
    parser_dll: Path,
    commit: str,
    taken: dict,
    jobs: int,
    force: bool,
) -> None:
    with ThreadPoolExecutor(max_workers=jobs) as pool:
        list(pool.map(hash_build, builds))
        to_parse = classify(builds, known_extracts(extracts, commit), taken, force)
        list(pool.map(lambda b: run_parser(parser_dll, b, extracts, commit), to_parse))
    # A build that pointed at an extract which then failed has nothing to point at.
    failed = {b.slug: b.error for b in builds if b.status == "failed"}
    for build in builds:
        if build.status == "duplicate" and build.extract_slug in failed:
            build.status, build.error = (
                "failed",
                f"duplicate of failed {build.extract_slug}",
            )
            build.extract_slug = None
    # The same build number packed twice: keep the second copy only if its content differs.
    for build in builds:
        if (
            build.status == "extracted"
            and build.repeat_of
            and same_content(extracts, build)
        ):
            log(f"{build.slug}: same content as {build.repeat_of}, dropped")
            shutil.rmtree(extracts / build.slug, ignore_errors=True)
            taken.pop(build.slug, None)
            build.status = "redundant"


def client_folder_builds(root: Path, family: str, source_root: str) -> list:
    """One build per sub-folder of ``root``; the folder name is the build number."""
    builds = []
    for folder in sorted(p for p in root.iterdir() if p.is_dir()):
        build = Build(
            family=family,
            build=folder.name,
            slug=make_slug(family, folder.name),
            source_path=f"{source_root}/{folder.name}/{DB_DIR}",
            client_dir=folder,
        )
        locate_ao_database(build)
        stated = read_version_file(find_file(folder, "version.id"))
        if stated and stated != folder.name:
            log(f"{source_root}/{folder.name}: version.id says {stated}")
        builds.append(build)
    return builds


def unpack_archive(archive: Path, work: Path) -> Path:
    """Unpack the client databases of a 7z archive. The archives are solid: one pass each."""
    target = work / archive.name
    shutil.rmtree(target, ignore_errors=True)
    target.mkdir(parents=True)
    result = subprocess.run(
        [
            "7z",
            "x",
            "-y",
            "-bd",
            f"-o{target}",
            str(archive),
            f"-i!*/{DB_DIR}/ResourceDatabase.*",
            "-i!*/version.id",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True,
    )
    log(f"{archive.name}: 7z exit {result.returncode}")
    if result.returncode != 0:
        raise RuntimeError(
            f"7z failed on {archive}: {(result.stderr or '').strip()[-300:]}"
        )
    return target


def installed_build(path: Path, family: str) -> Build:
    if family == "prk":
        name = read_version_file(find_file(path, "patch.version"))
        database = find_path(path, PRK_DB)
        if not name:
            raise RuntimeError(f"{path}: no patch.version")
        build = Build(
            family="prk",
            build=name,
            slug=make_slug("prk", name),
            source_path=str(path / PRK_DB),
            client_dir=path,
        )
        if database is None:
            build.status, build.error = "missing_db", f"no {PRK_DB}"
        else:
            build.dat_files = [database]
        return build
    name = read_version_file(find_file(path, "version.id"))
    if not name:
        raise RuntimeError(f"{path}: no version.id")
    build = Build(
        family="ao",
        build=name,
        slug=make_slug("ao", name),
        source_path=str(path / DB_DIR),
        client_dir=path,
    )
    locate_ao_database(build)
    return build


def build_parser(tinkerparse: Path, commit: str, work: Path) -> tuple:
    """Build TinkerParse from ``commit`` exactly, ignoring the state of its working tree."""
    sha = subprocess.run(
        [
            "git",
            "-C",
            str(tinkerparse),
            "rev-parse",
            "--verify",
            f"{commit}^{{commit}}",
        ],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    root = work / f"tinkerparse-{sha[:12]}"
    dll = root / "out" / "TinkerParser.dll"
    if dll.is_file():
        return dll, sha
    shutil.rmtree(root, ignore_errors=True)
    (root / "src").mkdir(parents=True)
    archive = subprocess.Popen(
        ["git", "-C", str(tinkerparse), "archive", sha], stdout=subprocess.PIPE
    )
    subprocess.run(
        ["tar", "-x", "-C", str(root / "src")], stdin=archive.stdout, check=True
    )
    if archive.wait() != 0:
        raise RuntimeError(f"git archive {sha} failed")
    log(f"building TinkerParse {sha}")
    subprocess.run(
        [
            "dotnet",
            "publish",
            str(root / "src" / "Parser" / "Parser.csproj"),
            "-c",
            "Release",
            "-o",
            str(root / "out"),
            "--nologo",
            "-v",
            "quiet",
        ],
        check=True,
        stdout=subprocess.DEVNULL,
    )
    return dll, sha


def merge_index(existing: list, builds: list) -> list:
    """This run's builds replace index entries with the same slug; the rest are kept."""
    by_slug = {e["slug"]: e for e in existing}
    for build in builds:
        if build.status == "redundant":
            by_slug.pop(build.slug, None)
        else:
            by_slug[build.slug] = build.entry()
    return sorted(by_slug.values(), key=entry_key)


def read_index(extracts: Path) -> list:
    path = extracts / "index.json"
    if not path.is_file():
        return []
    with open(path) as f:
        return json.load(f)


def write_index(extracts: Path, builds: list) -> list:
    entries = merge_index(read_index(extracts), builds)
    temp = extracts / "index.json.tmp"
    with open(temp, "w") as f:
        json.dump(entries, f, indent=1)
    os.replace(temp, extracts / "index.json")
    return entries


def main(argv: Optional[list] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument(
        "--extracts-dir",
        required=True,
        help="output folder (index.json and one folder per build)",
    )
    parser.add_argument("--tinkerparse", required=True, help="TinkerParse git checkout")
    parser.add_argument(
        "--commit",
        default=TINKERPARSE_COMMIT,
        help="TinkerParse commit to build (default: the pinned commit; change it for every build or none)",
    )
    parser.add_argument(
        "--archive",
        action="append",
        default=[],
        help="7z archive of client builds, <build>/cd_image/data/db/... (repeatable)",
    )
    parser.add_argument(
        "--builds-dir",
        action="append",
        default=[],
        help="folder of unpacked clients, one sub-folder per build number (repeatable)",
    )
    parser.add_argument(
        "--live",
        action="append",
        default=[],
        help="installed Anarchy Online client; build read from version.id (repeatable)",
    )
    parser.add_argument(
        "--prk",
        action="append",
        default=[],
        help="installed Project Rubi-Ka client; build read from patch.version (repeatable)",
    )
    parser.add_argument(
        "--family",
        default="ao",
        help="family of --archive and --builds-dir builds (default: ao)",
    )
    parser.add_argument(
        "--work-dir",
        help="scratch space for unpacked archives and the parser build "
        "(default: <extracts-dir>/.work; an archive needs up to ~45 GB)",
    )
    parser.add_argument(
        "--jobs", type=int, default=4, help="builds parsed at once (default: 4)"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="parse again builds that are already extracted",
    )
    args = parser.parse_args(argv)

    if not (args.archive or args.builds_dir or args.live or args.prk):
        parser.error("give at least one of --archive, --builds-dir, --live, --prk")

    def resolve(value: str) -> Path:
        return Path(os.path.expandvars(value)).expanduser().resolve()

    extracts = resolve(args.extracts_dir)
    extracts.mkdir(parents=True, exist_ok=True)
    work = resolve(args.work_dir) if args.work_dir else extracts / ".work"
    work.mkdir(parents=True, exist_ok=True)
    global _log_file
    _log_file = extracts / "extract.log"

    parser_dll, commit = build_parser(resolve(args.tinkerparse), args.commit, work)
    log(f"run start, TinkerParse {commit}")

    # Slugs already in the index keep their database, so a later source cannot silently take one over.
    taken = {
        e["slug"]: e.get("rdb_dat_sha256")
        for e in read_index(extracts)
        if e["status"] in ("extracted", "duplicate")
    }
    done: list = []

    def finish(builds: list) -> None:
        process(builds, extracts, parser_dll, commit, taken, args.jobs, args.force)
        done.extend(builds)
        write_index(extracts, done)

    installed = [installed_build(resolve(p), "ao") for p in args.live]
    installed += [installed_build(resolve(p), "prk") for p in args.prk]
    if installed:
        finish(installed)
    for value in args.builds_dir:
        root = resolve(value)
        finish(client_folder_builds(root, args.family, str(root)))
    for value in args.archive:
        archive = resolve(value)
        log(f"{archive.name}: unpacking")
        unpacked = unpack_archive(archive, work)
        try:
            finish(client_folder_builds(unpacked, args.family, str(archive)))
        finally:
            shutil.rmtree(unpacked, ignore_errors=True)

    counts: dict = {}
    for build in done:
        counts[build.status] = counts.get(build.status, 0) + 1
    log(
        "run end: " + ", ".join(f"{n} {status}" for status, n in sorted(counts.items()))
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
