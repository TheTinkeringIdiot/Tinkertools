"""
Tests for extract_builds.py, the driver that turns client builds into the
extracts folder ``import_cli.py import-extracts`` reads.

What matters: every build found ends up in index.json with the right status,
identical client databases are parsed once, builds are listed in patch order
(lineage and the version list follow that order), and a second run does not
redo work or lose builds it was not given.
"""

import json

import pytest

import extract_builds
from extract_builds import (
    Build,
    build_key,
    classify,
    client_folder_builds,
    installed_build,
    known_extracts,
    make_slug,
    merge_index,
    write_index,
)

COMMIT = "c" * 40


def make_client(root, build, dat=b"dat", idx=b"idx", version=None):
    """An unpacked AO client folder named after its build."""
    db = root / build / "cd_image" / "data" / "db"
    db.mkdir(parents=True)
    if dat is not None:
        (db / "ResourceDatabase.dat").write_bytes(dat)
    if idx is not None:
        (db / "ResourceDatabase.idx").write_bytes(idx)
    if version is not None:
        (root / build / "version.id").write_text(version + "\r\n")
    return root / build


def make_extract(extracts, slug, sha, commit=COMMIT):
    folder = extracts / slug
    folder.mkdir(parents=True)
    (folder / "items.json").write_text("[]")
    (folder / "nanos.json").write_text("[]")
    (folder / "manifest.json").write_text(
        json.dumps({"slug": slug, "rdb_dat_sha256": sha, "tinkerparse_commit": commit})
    )


def hashed_builds(root, family="ao"):
    builds = client_folder_builds(root, family, str(root))
    for build in builds:
        extract_builds.hash_build(build)
    return builds


@pytest.mark.parametrize(
    "family, build, slug",
    [
        ("ao", "17.10.5", "ao-17-10-5"),
        ("ao", "18.8.62_EP1", "ao-18-8-62-ep1"),
        ("prk", "0.7.1", "prk-0-7-1"),
    ],
)
def test_slug_follows_the_client_build(family, build, slug):
    assert make_slug(family, build) == slug


def test_builds_sort_in_patch_order_not_text_order():
    builds = ["14.7.10", "14.7.8", "14.7.2", "15.0.1", "14.9.0"]
    assert sorted(builds, key=build_key) == [
        "14.7.2",
        "14.7.8",
        "14.7.10",
        "14.9.0",
        "15.0.1",
    ]


def test_identical_databases_are_parsed_once(tmp_path):
    make_client(tmp_path, "14.2.2", dat=b"one")
    make_client(tmp_path, "14.4.1", dat=b"one")
    make_client(tmp_path, "14.4.2", dat=b"two")

    builds = hashed_builds(tmp_path)
    to_parse = classify(builds, {}, {}, force=False)

    assert [b.slug for b in to_parse] == ["ao-14-2-2", "ao-14-4-2"]
    by_slug = {b.slug: b for b in builds}
    assert by_slug["ao-14-4-1"].status == "duplicate"
    assert by_slug["ao-14-4-1"].extract_slug == "ao-14-2-2"
    assert by_slug["ao-14-4-1"].dat_sha == by_slug["ao-14-2-2"].dat_sha


def test_a_client_without_its_database_is_listed_as_missing(tmp_path):
    make_client(tmp_path, "11.1", idx=None)
    make_client(tmp_path, "11.2", dat=None, idx=None)

    builds = hashed_builds(tmp_path)

    assert classify(builds, {}, {}, force=False) == []
    assert [(b.slug, b.status) for b in builds] == [
        ("ao-11-1", "missing_db"),
        ("ao-11-2", "missing_db"),
    ]
    assert "ResourceDatabase.idx" in builds[0].error


def test_an_extracted_build_is_not_parsed_again(tmp_path):
    clients, extracts = tmp_path / "clients", tmp_path / "extracts"
    make_client(clients, "17.10.5", dat=b"one")
    builds = hashed_builds(clients)
    make_extract(extracts, "ao-17-10-5", builds[0].dat_sha)

    assert classify(builds, known_extracts(extracts, COMMIT), {}, force=False) == []
    assert builds[0].status == "extracted"
    assert builds[0].extract_slug == "ao-17-10-5"

    again = hashed_builds(clients)
    assert [
        b.slug
        for b in classify(again, known_extracts(extracts, COMMIT), {}, force=True)
    ] == ["ao-17-10-5"]


def test_an_extract_from_another_parser_commit_is_parsed_again(tmp_path):
    clients, extracts = tmp_path / "clients", tmp_path / "extracts"
    make_client(clients, "17.10.5", dat=b"one")
    builds = hashed_builds(clients)
    make_extract(extracts, "ao-17-10-5", builds[0].dat_sha, commit="d" * 40)

    assert [
        b.slug
        for b in classify(builds, known_extracts(extracts, COMMIT), {}, force=False)
    ] == ["ao-17-10-5"]


def test_two_different_databases_with_one_build_number_both_survive(tmp_path):
    first, second = tmp_path / "a", tmp_path / "b"
    make_client(first, "16.2.0", dat=b"one")
    make_client(second, "16.2.0", dat=b"two")
    taken = {}

    earlier = hashed_builds(first)
    classify(earlier, {}, taken, force=False)
    later = hashed_builds(second)
    to_parse = classify(later, {}, taken, force=False)

    assert earlier[0].slug == "ao-16-2-0"
    assert [b.slug for b in to_parse] == ["ao-16-2-0-2"]
    entries = merge_index([], earlier + later)
    assert [e["slug"] for e in entries] == ["ao-16-2-0", "ao-16-2-0-2"]


def test_the_live_client_hash_covers_every_database_part(tmp_path):
    client = make_client(tmp_path, "live", dat=b"part0", version="18.8.62_EP1")
    db = client / "cd_image" / "data" / "db"
    (db / "ResourceDatabase.dat.001").write_bytes(b"part1")

    build = installed_build(client, "ao")
    extract_builds.hash_build(build)

    assert build.slug == "ao-18-8-62-ep1"
    assert build.dat_sha == extract_builds.hashlib.sha256(b"part0part1").hexdigest()


def test_the_prk_build_comes_from_patch_version(tmp_path):
    (tmp_path / "cd_image").mkdir()
    (tmp_path / "cd_image" / "rdb.db").write_bytes(b"db")
    (tmp_path / "patch.version").write_text("0.7.1")
    (tmp_path / "version.id").write_text("00.7.0_EP1\r\n")

    build = installed_build(tmp_path, "prk")

    assert (build.family, build.build, build.slug) == ("prk", "0.7.1", "prk-0-7-1")


def test_a_later_run_keeps_builds_it_was_not_given(tmp_path):
    old = Build(
        family="ao",
        build="17.10.5",
        slug="ao-17-10-5",
        source_path="x",
        dat_sha="a",
        extract_slug="ao-17-10-5",
    )
    prk = Build(
        family="prk",
        build="0.7.1",
        slug="prk-0-7-1",
        source_path="x",
        dat_sha="p",
        extract_slug="prk-0-7-1",
    )
    write_index(tmp_path, [prk, old])

    new = Build(
        family="ao",
        build="18.8.62_EP1",
        slug="ao-18-8-62-ep1",
        source_path="x",
        dat_sha="b",
        extract_slug="ao-18-8-62-ep1",
    )
    entries = write_index(tmp_path, [new])

    assert [e["slug"] for e in entries] == ["ao-17-10-5", "ao-18-8-62-ep1", "prk-0-7-1"]
    assert json.loads((tmp_path / "index.json").read_text()) == entries


def test_one_build_packed_twice_with_the_same_content_is_listed_once(tmp_path):
    first, second, extracts = tmp_path / "a", tmp_path / "b", tmp_path / "extracts"
    make_client(first, "16.2.0", dat=b"one")
    make_client(second, "16.2.0", dat=b"two")
    kept = hashed_builds(first)[0]
    kept.extract_slug = kept.slug
    repeat = hashed_builds(second)[0]
    make_extract(extracts, "ao-16-2-0", kept.dat_sha)
    make_extract(extracts, "ao-16-2-0-2", repeat.dat_sha)
    write_index(extracts, [kept])
    taken = {"ao-16-2-0": kept.dat_sha}

    extract_builds.process([repeat], extracts, None, COMMIT, taken, jobs=1, force=False)
    entries = write_index(extracts, [repeat])

    assert [e["slug"] for e in entries] == ["ao-16-2-0"]
    assert not (extracts / "ao-16-2-0-2").exists()
    assert "ao-16-2-0-2" not in taken
