# Import: Update Existing Profile — Design

**Date:** 2026-07-05
**Status:** Approved

## Problem

Every profile import (pasted text, file upload, AOSetups, PRK) always creates a new
profile with a freshly minted ID (`transformer.ts` `importFromJSON` mints
`profile_<timestamp>_<rand>` unconditionally). Re-importing an updated export of the
same character therefore produces duplicates. Additionally, the bulk-import
`overwriteExisting` option is broken: it only suppresses auto-renaming, then still
creates a new profile with the same name — it never overwrites.

## Decisions

1. **Match UX:** Auto-detect by character name, then prompt. If the parsed
   `Character.Name` matches an existing profile (case-insensitive), the import modal
   shows an explicit choice: **Update existing** (default) vs **Create new profile**.
   No silent overwrites.
2. **Update mode:** Full replace, keep ID. The parsed profile completely replaces the
   existing one; only the existing profile's `id` and `created` timestamp are
   preserved. `updated` is set to now.
3. **Scope:** All single-profile import paths (pasted text, file upload, AOSetups,
   PRK) get the prompt. The bulk-import `overwriteExisting` flag is fixed to truly
   overwrite in place.

## Architecture: Two-Phase Import

Split import into *parse* and *commit* so the UI can inspect the parsed profile
before anything is saved.

### 1. Manager (`frontend/src/lib/tinkerprofiles/manager.ts`)

- **New: `previewImport(data: string): Promise<ProfileImportResult>`** — runs the
  existing transformer (format detection + parsing + validation) exactly as
  `importProfile` does today, but does **not** save. Returns the parsed profile,
  warnings, and errors.
- **Changed: `importProfile(data: string, options?: { updateExistingId?: string })`**
  - Without options: current behavior (new ID, saved as new profile).
  - With `updateExistingId`: load the existing profile; set the parsed profile's
    `id` to the existing ID and `created` to the existing created timestamp; set
    `updated` to now; then `storage.saveProfile()` overwrites in place. If the
    existing profile is not found, fail with a clear error (no silent fallback to
    creating a new profile).

### 2. Import modal (`frontend/src/components/profiles/ProfileImportModal.vue`)

On submit (single-profile path, all formats):

1. Call `previewImport()` first.
2. Look up the parsed `Character.Name` against existing profiles via the store's
   `profileMetadata` (case-insensitive comparison).
3. **Match found:** show an inline confirmation step inside the modal:
   *"A profile named 'X' already exists."* with choices **Update existing 'X'**
   (default) and **Create new profile**. If multiple existing profiles share the
   name, list them so the user picks which one to update (or create new).
4. **No match:** commit immediately (`importProfile()` with no options) — identical
   to today's flow.
5. On "update": `importProfile(data, { updateExistingId })`. Active-profile state and
   any references survive because the ID is unchanged.

### 3. Bulk import fix (`frontend/src/stores/tinkerProfiles.ts`)

In `importAllProfiles` (duplicate handling around lines 547–568): when
`overwriteExisting` is true and a name match exists, pass the matched existing
profile's ID through to `importProfile(data, { updateExistingId })` so the profile is
replaced in place instead of duplicated. `skipDuplicates` and auto-rename behavior
are unchanged.

## Error Handling

- Preview errors (unrecognized format, validation failure) surface in the modal as
  import errors do today; nothing is saved.
- `updateExistingId` pointing at a missing profile → import fails with an explicit
  error message.
- Cancel/close during the confirmation step saves nothing.

## Testing

- **Unit (manager/transformer):** `importProfile` with `updateExistingId` preserves
  `id` and `created`, replaces all other data, sets new `updated`; missing target ID
  errors; `previewImport` parses without persisting.
- **Unit (bulk):** `overwriteExisting: true` results in one profile per name with
  updated data, not duplicates.
- **Integration (real store, mocked API):** paste an export, import; paste an updated
  export of the same character, choose update → exactly one profile exists with the
  new data and the same ID; active profile remains active.

## Out of Scope

- Merging pasted data into an existing profile (full replace only).
- Matching on anything other than character name.
- Changes to export formats or the PRK/AOSetups parsers themselves.
