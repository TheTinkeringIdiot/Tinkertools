# Extraction → import contract

Producer: `backend/extract_builds.py`, which runs TinkerParse (one pinned commit for every build). Consumer: `backend/import_cli.py` staging + merge importer (design.md §12).

## Layout

```
~/projects/AO/extracts/
  index.json                 # every known build, including duplicates
  <slug>/
    items.json               # TinkerParse output, unchanged
    nanos.json
    manifest.json
```

## Slugs

- Historical/official AO builds: `ao-<major>-<minor>-<patch>`, e.g. `ao-17-10-5`, `ao-14-2-2`.
- Installed live AO client: `ao-<major>-<minor>-<patch>` from the client's own version string (plus a suffix such as `-ep1` only if the version string carries one).
- PRK: `prk-<version>` from the client's version string, dots → dashes.
- Two different databases under one build number: the later source gets `-2`, `-3`, ... (`ao-16-2-0-2`) and is kept only if its items or nanos differ.
- `rdb_dat_sha256` covers `ResourceDatabase.dat` followed by its numbered parts (`.dat.001`, ...) in order; for PRK it is `rdb.db`.
- The first dev slugs `ao-2024-02` and `prk-2026-01` were replaced by `ao-18-8-62-ep1` and `prk-0-7-1` on 2026-11-12.

## manifest.json

```json
{
  "slug": "ao-17-10-5",
  "family": "ao",
  "client_build": "17.10.5",
  "source_path": "<archive or install path>/<build>/cd_image/data/db",
  "rdb_dat_sha256": "…",
  "rdb_idx_sha256": "…",
  "tinkerparse_commit": "<full sha>",
  "item_count": 114737,
  "nano_count": 10331,
  "parse_errors": [{"kind": "item", "aoid": 275338, "error": "…"}]
}
```

## index.json

A list, ordered by family then build number, one entry per build folder found, including builds whose `.dat` is identical to another:

```json
[{"build": "17.10.4", "slug": "ao-17-10-4", "family": "ao",
  "rdb_dat_sha256": "…", "extract_slug": "ao-17-10-4", "status": "extracted"},
 {"build": "16.4.0", "slug": "ao-16-4-0", "family": "ao",
  "rdb_dat_sha256": "…", "extract_slug": "ao-16-3-4", "status": "duplicate"}]
```

`extract_slug` points at the folder that holds the data. `status` is one of `extracted`, `duplicate`, `failed` (with `error`), `missing_db`.
