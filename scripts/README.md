# Scripts

Utility scripts for TinkerTools repository management.

## Git Diff Exporter (Canonical Range Diff Artifact)

The repository includes a canonical zero-context git range diff exporter: [`git_diff_export.py`](git_diff_export.py)

### Purpose

- Produce a deterministic, machine-consumable JSON artifact plus a Markdown summary for changes under a path prefix (e.g. frontend/) over a commit range.
- Enforce integrity (addition/deletion totals) and hunk presence for textual Added/Modified/Renamed files.
- Standardize schema for downstream automation (CI, release notes, auditing).

### Schema (schemaVersion=1)

```json
{
  "schemaVersion": 1,
  "range": { "fromExclusive": "<base>", "to": "<ref>" },
  "files": [
    {
      "path": "frontend/src/...",
      "status": "A|M|D|R",
      "additions": 123 | null,
      "deletions": 45 | null,
      "hunks": [ { "oldStart": 10, "oldLines": 1, "newStart": 10, "newLines": 1 }, ... ],
      "renamedFrom": "old/path.ext" (only when status == "R")
    }
  ],
  "totals": { "files": N, "additions": X, "deletions": Y },
  "meta": {
    "generator": "git_diff_export",
    "hunksIncluded": true,
    "generatedAt": "UTC ISO timestamp",
    "command": "git diff --name-status/--numstat/--unified=0 <base>..<ref> -- <prefix>"
  }
}
```

**Notes:**
- Binary files: `additions` / `deletions` are `null` (git numstat uses '-') and `hunks` length == 0.
- Deleted files: `hunks` is always an empty array.
- Rename lines: status `R`, include `renamedFrom`.
- Ordering: `files` array sorted lexicographically by path for determinism.

### Usage Examples

```bash
# Basic (default outputs diff-<base>-<to>-<prefix>.json/md)
./scripts/git_diff_export.py c8c4fe1b40ac920dbe890fcd18fc0e874db06b4b frontend/

# Explicit end ref + custom output paths
./scripts/git_diff_export.py c8c4fe1b40ac920dbe890fcd18fc0e874db06b4b frontend/ --to HEAD \
  --json-out diff-latest.json --md-out diff-latest.md

# Skip hunk presence enforcement (still validates totals)
./scripts/git_diff_export.py <BASE> frontend/ --no-hunk-validation
```

### Exit Codes

- 0: Integrity OK (and hunk validation OK unless skipped).
- 1: Validation failure (add/del mismatch or a required hunk missing / deleted file with hunks).

### Validation Rules

- Recomputes additions/deletions sum from per-file entries; mismatch triggers failure.
- For A/M/R files with textual changes (additions is not null) at least one hunk must exist (unless `--no-hunk-validation`).
- D files must have zero hunks.
- Binary A/M/R (additions null) may have zero hunks.

### Markdown Table Columns

`| Status | Path | Add | Del | HunksCount |`

(Add/Del blank for binary, HunksCount zero for binary or deleted.)

### Adoption & Deprecation (Enforced)

- **DEPRECATED**: Any diff artifact missing `schemaVersion`, missing `meta.generator`, using legacy column header `Hunks` (instead of `HunksCount`), or emitting `meta.hunksIncluded: false`.
- **BANNED**: "Hunkless" mode (skipping unified=0 hunk extraction). All textual A/M/R files MUST include ≥1 hunk (binary exemption only). Remove any scripts that intentionally emit empty hunk arrays for non-binary A/M/R changes.
- **SINGLE SOURCE**: Only `scripts/git_diff_export.py` is permitted to generate canonical artifacts.
- **INVALID OUTPUTS**: Legacy terminals / ad hoc one-off scripts producing partial JSON or Markdown are not to be consumed by tooling and should be terminated/removed.
- **SCHEMA EVOLUTION**: Any future schema change must bump `schemaVersion` and document migration steps here before merging.

### Operational Policy

1. No parallel legacy exporters; CI and local automation must invoke only the canonical script.
2. Artifacts must retain original ordering & content (no post-processing).
3. Consumption tools should fail fast if `schemaVersion != 1` or required meta fields missing.
4. Any detection of a legacy pattern (e.g. `| Hunks |` header) should cause pipeline failure.

### CI Integration

1. Determine base commit (merge-base with target branch) to produce stable range.
2. Run exporter for required prefixes (start with `frontend/`).
3. Fail the job if exporter exit code != 0 OR if schema / validation checks fail.
4. Upload JSON + Markdown as artifacts for auditing or release automation.
5. (Optional) Append provenance step (e.g. attach to GitHub Release).

### GitHub Actions Example

`.github/workflows/diff-artifacts.yml`:

```yaml
name: Diff Artifacts

on:
  pull_request:
  push:
    branches: [ main ]

jobs:
  diff-frontend:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout (full history for merge-base)
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Compute base commit
        id: base
        run: |
          BASE=$(git merge-base origin/main $GITHUB_SHA)
          echo "base=$BASE" >> "$GITHUB_OUTPUT"

      - name: Export frontend diff
        run: |
          ./scripts/git_diff_export.py ${{ steps.base.outputs.base }} frontend/ \
            --to $GITHUB_SHA \
            --json-out diff-frontend.json \
            --md-out diff-frontend.md

      - name: Validate schemaVersion & meta
        run: |
            test "$(jq -r '.schemaVersion' diff-frontend.json)" = "1"
            jq -e '.meta.generator=="git_diff_export" and .meta.hunksIncluded==true' diff-frontend.json > /dev/null

      - name: Reject legacy patterns (defense in depth)
        run: |
          grep -q '| Hunks |' diff-frontend.md && { echo "Legacy Hunks column detected"; exit 1; } || true

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: git-diff-frontend
          path: |
            diff-frontend.json
            diff-frontend.md
```

### Local Pre-Commit Hook (Optional)

```bash
#!/usr/bin/env bash
BASE=$(git merge-base origin/main HEAD)
./scripts/git_diff_export.py "$BASE" frontend/ --to HEAD --json-out diff-precommit.json --md-out diff-precommit.md --quiet || {
  echo "[diff] Integrity failure" >&2
  exit 1
}
```

### Binary Change Test (Procedure)

- Add a small binary file (e.g. `frontend/public/test-binary.png`), stage & commit.
- Modify it (e.g. overwrite with different bytes), rerun exporter with new base.
- Expected JSON entry:
  - `additions: null`, `deletions: null`, `hunks: []`, status `A` or `M`.
- Confirm pipeline still returns exit code 0 (hunk rule exempt for binary).

### Future CI Hardening (Optional)

- Cache last successful diff artifact and diff against new artifact schema keys.
- Add SBOM-style manifest linking artifacts with commit metadata.
- Introduce multi-prefix aggregation once stable.

### Migration Workflow (If schemaVersion bump needed)

1. Introduce new version emitting both (N and legacy) behind a flag.
2. Update consumers to accept N.
3. Remove legacy emission & bump docs.
4. Enforce rejection of prior version in CI.

### Future Enhancements (Optional)

- Flag to include (currently always empty) structural delete hunks if ever required.
- Support multiple prefixes in a single invocation (aggregation) while preserving determinism.

### Conventions

- Do not edit JSON output post-generation; downstream tools must treat it as immutable.
- If schema changes are required, bump `schemaVersion` and document migration notes here.

## Secret Scanning

[`check-secrets.sh`](check-secrets.sh) - Pre-commit hook for detecting secrets in code.
