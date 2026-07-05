# Import: Update Existing Profile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a profile import (pasted text, file, AOSetups) update an existing profile in place when the character name matches, instead of always creating a duplicate; also fix the broken bulk-import `overwriteExisting` flag.

**Architecture:** Two-phase import. A new `previewImport()` on `TinkerProfilesManager` parses without saving so the UI can inspect the parsed `Character.Name`. `importProfile()` gains an `options.updateExistingId` parameter: when set, the parsed profile takes the existing profile's `id` and `created` timestamp and overwrites it in localStorage. `ProfileImportModal.vue` previews first, and if the name matches an existing profile shows an inline choice (update vs create new) before committing.

**Tech Stack:** Vue 3 Composition API + TypeScript (strict), Pinia, PrimeVue, Vitest. All profile data is client-side localStorage (key `tinkertools_profile_<id>`, index `tinkertools_profile_index`).

**Spec:** `docs/superpowers/specs/2026-07-05-import-update-existing-profile-design.md`

## Global Constraints

- Full replace on update: only `id` and `created` are preserved from the existing profile; `updated` is set to now.
- Name matching is case-insensitive on `Character.Name`.
- `updateExistingId` pointing at a missing profile fails the import with an explicit error — never silently falls back to creating a new profile.
- No silent overwrites in the single-import UI: the user always confirms via the prompt.
- Follow existing code style: no new comments beyond what matches surrounding code; profession/breed are numeric IDs everywhere.
- The transformer supports two single-profile formats: `json` (TinkerProfile v4.0.0) and `aosetups`. (The spec mentions PRK; no PRK path exists in `transformer.ts` — the feature applies to all formats the transformer dispatches, so nothing format-specific is needed.)
- Component tests for the modal are NOT wanted (project policy deleted all component tests Nov 2025). Test at manager/store level; verify the modal manually.

## Codebase Orientation (read before starting)

- `frontend/src/lib/tinkerprofiles/manager.ts` — `TinkerProfilesManager`. `importProfile()` at ~line 585: calls `this.transformer.importProfile(data, sourceFormat)`, validates, then `this.storage.saveProfile(result.profile)`.
- `frontend/src/lib/tinkerprofiles/transformer.ts` — `importFromJSON()` (~line 138) always mints a fresh `id`/`created`/`updated` on the parsed profile. Leave this alone; the manager overrides those fields when updating.
- `frontend/src/lib/tinkerprofiles/storage.ts` — `saveProfile()` is an upsert on `tinkertools_profile_<id>`.
- `frontend/src/lib/tinkerprofiles/types.ts` — `ProfileImportResult` (line 193), `ProfileMetadata` (line 173, has `id` and `name`), `BulkImportResult` (line 206).
- `frontend/src/stores/tinkerProfiles.ts` — store wrapper `importProfile()` (line 464), bulk `importAllProfiles()` (line 491) with the broken `overwriteExisting` handling at lines 547–568. `profileMetadata` ref exposed read-only at line 1542.
- `frontend/src/components/profiles/ProfileImportModal.vue` — submit handler `importProfile()` at line 581; single-profile branch at line 679; footer Import button at ~line 380.
- Test patterns: `frontend/src/__tests__/lib/tinkerprofiles.test.ts` (manager + localStorage mock), `frontend/src/__tests__/integration/profile-management.integration.test.ts` (real store via `setupIntegrationTest()` from `@/__tests__/helpers/integration-test-utils`).

---

### Task 1: Manager — `previewImport()` and `importProfile()` with `updateExistingId`

**Files:**
- Modify: `frontend/src/lib/tinkerprofiles/types.ts` (after `ProfileImportResult`, ~line 203)
- Modify: `frontend/src/lib/tinkerprofiles/manager.ts:582-617`
- Create: `frontend/src/__tests__/lib/tinkerprofiles/import-update.test.ts`

**Interfaces:**
- Consumes: existing `transformer.importProfile(data, sourceFormat)`, `validator.validateProfile(profile)`, `storage.saveProfile(profile)`, `loadProfile(id)`.
- Produces (used by Tasks 2–3):
  - `interface ProfileImportOptions { updateExistingId?: string }` exported from `types.ts` and re-exported from the lib barrel.
  - `TinkerProfilesManager.previewImport(data: string, sourceFormat?: string): Promise<ProfileImportResult>` — parses + validates, never saves.
  - `TinkerProfilesManager.importProfile(data: string, sourceFormat?: string, options?: ProfileImportOptions): Promise<ProfileImportResult>` — third parameter is new; existing two-arg calls behave exactly as before.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/__tests__/lib/tinkerprofiles/import-update.test.ts`:

```typescript
/**
 * Tests for import-with-update: previewImport() and importProfile updateExistingId
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TinkerProfilesManager } from '@/lib/tinkerprofiles';

const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => (store[key] = value),
    removeItem: (key: string) => delete store[key],
    clear: () => (store = {}),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('Profile import update', () => {
  let manager: TinkerProfilesManager;

  beforeEach(() => {
    localStorageMock.clear();
    manager = new TinkerProfilesManager({
      storage: { autoSave: true },
      validation: { strictMode: false, autoCorrect: true, allowLegacyFormats: false },
    });
  });

  async function exportOf(profileId: string): Promise<string> {
    return manager.exportProfile(profileId, 'json');
  }

  describe('previewImport', () => {
    it('parses valid data without saving a profile', async () => {
      const existingId = await manager.createProfile('Previewer');
      const data = await exportOf(existingId);
      await manager.deleteProfile(existingId);

      const preview = await manager.previewImport(data);

      expect(preview.success).toBe(true);
      expect(preview.profile?.Character.Name).toBe('Previewer');
      const metadata = await manager.getProfileMetadata();
      expect(metadata).toHaveLength(0);
    });

    it('reports errors for unparseable data without saving', async () => {
      const preview = await manager.previewImport('not json at all');

      expect(preview.success).toBe(false);
      expect(preview.errors.length).toBeGreaterThan(0);
      const metadata = await manager.getProfileMetadata();
      expect(metadata).toHaveLength(0);
    });
  });

  describe('importProfile with updateExistingId', () => {
    it('replaces the existing profile, preserving id and created', async () => {
      const existingId = await manager.createProfile('Nukeboy');
      const existing = await manager.loadProfile(existingId);
      expect(existing).toBeTruthy();

      const exported = JSON.parse(await exportOf(existingId));
      exported.Character.Level = 100;
      const data = JSON.stringify(exported);

      const result = await manager.importProfile(data, undefined, {
        updateExistingId: existingId,
      });

      expect(result.success).toBe(true);
      expect(result.profile?.id).toBe(existingId);
      expect(result.profile?.created).toBe(existing!.created);
      expect(result.profile?.Character.Level).toBe(100);

      const reloaded = await manager.loadProfile(existingId);
      expect(reloaded?.Character.Level).toBe(100);

      const metadata = await manager.getProfileMetadata();
      expect(metadata).toHaveLength(1);
    });

    it('fails when the target profile does not exist', async () => {
      const existingId = await manager.createProfile('Ghost');
      const data = await exportOf(existingId);
      await manager.deleteProfile(existingId);

      const result = await manager.importProfile(data, undefined, {
        updateExistingId: existingId,
      });

      expect(result.success).toBe(false);
      expect(result.errors.join(' ')).toContain('not found');
      const metadata = await manager.getProfileMetadata();
      expect(metadata).toHaveLength(0);
    });

    it('creates a new profile when no options are given (unchanged behavior)', async () => {
      const existingId = await manager.createProfile('Cloney');
      const data = await exportOf(existingId);

      const result = await manager.importProfile(data);

      expect(result.success).toBe(true);
      expect(result.profile?.id).not.toBe(existingId);
      const metadata = await manager.getProfileMetadata();
      expect(metadata).toHaveLength(2);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/__tests__/lib/tinkerprofiles/import-update.test.ts`
Expected: FAIL — `manager.previewImport is not a function`, and the `updateExistingId` tests fail (extra profile created / id mismatch).

- [ ] **Step 3: Add `ProfileImportOptions` to types**

In `frontend/src/lib/tinkerprofiles/types.ts`, directly after the `ProfileImportResult` interface (ends line 203), add:

```typescript
/** Options for importing a profile */
export interface ProfileImportOptions {
  /** Overwrite this existing profile in place (preserves its id and created date) */
  updateExistingId?: string;
}
```

Check the barrel `frontend/src/lib/tinkerprofiles/index.ts`: if it re-exports named types (rather than `export *` from `./types`), add `ProfileImportOptions` to that list.

- [ ] **Step 4: Implement in manager**

In `frontend/src/lib/tinkerprofiles/manager.ts`, add `ProfileImportOptions` to the existing type import from `./types`, then replace the `importProfile` method (lines 582–617) with:

```typescript
  /**
   * Parse and validate import data without saving
   */
  async previewImport(data: string, sourceFormat?: string): Promise<ProfileImportResult> {
    const result = await this.transformer.importProfile(data, sourceFormat);

    if (result.success && result.profile) {
      const validation = this.validator.validateProfile(result.profile);

      if (!validation.valid && this.config.validation.strictMode) {
        result.success = false;
        result.errors.push(...validation.errors);
        return result;
      }

      result.warnings.push(...validation.warnings);
    }

    return result;
  }

  /**
   * Import a profile
   */
  async importProfile(
    data: string,
    sourceFormat?: string,
    options: ProfileImportOptions = {}
  ): Promise<ProfileImportResult> {
    const result = await this.transformer.importProfile(data, sourceFormat);

    if (result.success && result.profile) {
      try {
        // Validate imported profile
        const validation = this.validator.validateProfile(result.profile);

        if (!validation.valid && this.config.validation.strictMode) {
          result.success = false;
          result.errors.push(...validation.errors);
          return result;
        }

        result.warnings.push(...validation.warnings);

        if (options.updateExistingId) {
          const existing = await this.loadProfile(options.updateExistingId);
          if (!existing) {
            result.success = false;
            result.errors.push(`Profile to update not found: ${options.updateExistingId}`);
            return result;
          }
          result.profile.id = existing.id;
          result.profile.created = existing.created;
          result.profile.updated = new Date().toISOString();
        }

        // Save the imported profile
        await this.storage.saveProfile(result.profile);
        this.invalidateCache();

        if (this.config.events.enabled) {
          this.events.emit('profile:imported', { profile: result.profile, result });
        }
      } catch (error) {
        result.success = false;
        result.errors.push(
          error instanceof Error ? error.message : 'Failed to save imported profile'
        );
      }
    }

    return result;
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/__tests__/lib/tinkerprofiles/import-update.test.ts`
Expected: PASS (all 5 tests). (`manager.getProfileMetadata()` exists at `manager.ts:374`; `createProfile`/`deleteProfile` at lines 162/350.)

Also run the existing lib suite to confirm no regression:
Run: `cd frontend && npx vitest run src/__tests__/lib/tinkerprofiles.test.ts`
Expected: PASS (same pass/fail state as before this change).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/tinkerprofiles/types.ts frontend/src/lib/tinkerprofiles/manager.ts frontend/src/lib/tinkerprofiles/index.ts frontend/src/__tests__/lib/tinkerprofiles/import-update.test.ts
git commit -m "feat(profiles): add previewImport and update-in-place import option"
```

---

### Task 2: Store — pass-through wrappers and bulk `overwriteExisting` fix

**Files:**
- Modify: `frontend/src/stores/tinkerProfiles.ts:461-593`
- Create: `frontend/src/__tests__/integration/profile-import-update.integration.test.ts`

**Interfaces:**
- Consumes (from Task 1): `manager.previewImport(data, sourceFormat?)`, `manager.importProfile(data, sourceFormat?, options?)`, `ProfileImportOptions`.
- Produces (used by Task 3):
  - Store `previewImport(data: string, sourceFormat?: string): Promise<ProfileImportResult>` — no loading-state changes, no error toast; pure parse.
  - Store `importProfile(data: string, sourceFormat?: string, options?: ProfileImportOptions): Promise<ProfileImportResult>` — same as today plus options pass-through.
  - Bulk `importAllProfiles` with `overwriteExisting: true` now truly overwrites the matched profile in place.

- [ ] **Step 1: Write the failing integration test**

Create `frontend/src/__tests__/integration/profile-import-update.integration.test.ts`:

```typescript
/**
 * Integration tests: import updates an existing profile in place.
 * Real Pinia store + real manager + mocked API client.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupIntegrationTest } from '@/__tests__/helpers/integration-test-utils';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';

vi.mock('@/services/api-client');

describe('Profile import update (integration)', () => {
  let store: ReturnType<typeof useTinkerProfilesStore>;

  beforeEach(async () => {
    await setupIntegrationTest();
    store = useTinkerProfilesStore();
    await store.loadProfiles();
  });

  it('previewImport parses without creating a profile', async () => {
    const id = await store.createProfile('Scout');
    const data = await store.exportProfile(id, 'json');
    const countBefore = store.profileMetadata.length;

    const preview = await store.previewImport(data);

    expect(preview.success).toBe(true);
    expect(preview.profile?.Character.Name).toBe('Scout');
    expect(store.profileMetadata.length).toBe(countBefore);
  });

  it('importProfile with updateExistingId replaces in place', async () => {
    const id = await store.createProfile('Updatee');
    const exported = JSON.parse(await store.exportProfile(id, 'json'));
    exported.Character.Level = 150;

    const result = await store.importProfile(JSON.stringify(exported), undefined, {
      updateExistingId: id,
    });
    await store.loadProfiles();

    expect(result.success).toBe(true);
    expect(result.profile?.id).toBe(id);
    const matches = store.profileMetadata.filter((p) => p.name === 'Updatee');
    expect(matches).toHaveLength(1);
    expect(matches[0].level).toBe(150);
  });

  it('bulk import with overwriteExisting updates instead of duplicating', async () => {
    const id = await store.createProfile('Bulky');
    const profile = JSON.parse(await store.exportProfile(id, 'json'));
    profile.Character.Level = 42;

    const bulkData = JSON.stringify({
      version: '1.0',
      profileCount: 1,
      profiles: [profile],
    });

    const result = await store.importAllProfiles(bulkData, { overwriteExisting: true });
    await store.loadProfiles();

    expect(result.successCount).toBe(1);
    const matches = store.profileMetadata.filter((p) => p.name === 'Bulky');
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe(id);
    expect(matches[0].level).toBe(42);
  });
});
```

(Store method names verified: `loadProfiles` at `stores/tinkerProfiles.ts:176`, `createProfile` at 214, `exportProfile` at 411.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/__tests__/integration/profile-import-update.integration.test.ts`
Expected: FAIL — `store.previewImport is not a function`; bulk test fails with 2 profiles named "Bulky".

- [ ] **Step 3: Implement store changes**

In `frontend/src/stores/tinkerProfiles.ts`:

3a. Add `ProfileImportOptions` to the type imports from `@/lib/tinkerprofiles`.

3b. Replace `importProfile` (lines 461–486) with a version that accepts and forwards options, and add `previewImport` after it:

```typescript
  /**
   * Import a profile
   */
  async function importProfile(
    data: string,
    sourceFormat?: string,
    options: ProfileImportOptions = {}
  ): Promise<ProfileImportResult> {
    if (!profileManager) {
      throw new Error('Profile manager not initialized');
    }

    loading.value = true;
    error.value = null;

    try {
      const result = await profileManager.importProfile(data, sourceFormat, options);

      if (!result.success) {
        error.value = `Import failed: ${result.errors.join(', ')}`;
      }

      return result;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to import profile';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Parse import data without saving, for pre-import inspection
   */
  async function previewImport(
    data: string,
    sourceFormat?: string
  ): Promise<ProfileImportResult> {
    if (!profileManager) {
      throw new Error('Profile manager not initialized');
    }

    return profileManager.previewImport(data, sourceFormat);
  }
```

3c. Fix the bulk overwrite. At line 520, replace the name-only list with a name→id map (keep the array for the rename loop):

```typescript
      const profiles = exportData.profiles as TinkerProfile[];
      const existingProfiles = profileMetadata.value.map((p) => p.name.toLowerCase());
      const existingIdsByName = new Map(
        profileMetadata.value.map((p) => [p.name.toLowerCase(), p.id])
      );
```

In the per-profile loop, track the overwrite target (replace lines 546–572 region):

```typescript
        try {
          // Check for duplicates
          const isDuplicate = existingProfiles.includes(profileResult.profileName.toLowerCase());
          let updateExistingId: string | undefined;

          if (isDuplicate) {
            if (options.skipDuplicates) {
              profileResult.skipped = true;
              result.skippedCount++;
              result.results.push(profileResult);
              continue;
            } else if (options.overwriteExisting) {
              updateExistingId = existingIdsByName.get(profileResult.profileName.toLowerCase());
            } else {
              // Generate unique name
              let counter = 1;
              let newName = `${profileResult.profileName} (${counter})`;
              while (existingProfiles.includes(newName.toLowerCase())) {
                counter++;
                newName = `${profileResult.profileName} (${counter})`;
              }
              profile.Character.Name = newName;
              profileResult.profileName = newName;
              profileResult.warnings?.push('Profile renamed to avoid duplicate');
            }
          }

          // Import the individual profile
          const profileJson = JSON.stringify(profile);
          const importResult = await importProfile(profileJson, undefined, { updateExistingId });
```

(The rest of the loop — success/failure bookkeeping and `existingProfiles.push(...)` — is unchanged.)

3d. Export `previewImport` from the store's return object (add it next to `importProfile` in the returned bindings near the bottom of the file).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/__tests__/integration/profile-import-update.integration.test.ts src/__tests__/lib/tinkerprofiles/import-update.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Type-check and commit**

Run: `cd frontend && npm run type-check`
Expected: no new errors (compare against `git stash`-free baseline if unsure).

```bash
git add frontend/src/stores/tinkerProfiles.ts frontend/src/__tests__/integration/profile-import-update.integration.test.ts
git commit -m "feat(profiles): store previewImport passthrough; fix bulk overwriteExisting to update in place"
```

---

### Task 3: Import modal — duplicate-name prompt

**Files:**
- Modify: `frontend/src/components/profiles/ProfileImportModal.vue` (template ~lines 136–182 and ~380; script ~lines 427–446, 581–832, watchers ~835–860)

**Interfaces:**
- Consumes (from Task 2): `profilesStore.previewImport(data)`, `profilesStore.importProfile(data, undefined, { updateExistingId })`, `profilesStore.profileMetadata` (array of `{ id, name, level, profession, ... }`).
- Produces: no new external interface; same `imported` emit and dialog behavior.

**Behavior:** On Import click (single-profile only): preview → case-insensitive match of parsed `Character.Name` against `profileMetadata`. No match → import immediately (today's flow). Match → stop, show an inline panel: "A profile named 'X' already exists", radio choice **Update existing** (default) / **Create new profile**, and — when several profiles share the name — a Select of which one to update. The footer Import button then commits the chosen action. Bulk imports are untouched.

- [ ] **Step 1: Add state, helpers, and split commit out of `importProfile()`**

In the script section:

1a. Add imports: `Select` from `'primevue/select'`, and extend the store types import to include `ProfileMetadata`:

```typescript
import Select from 'primevue/select';
import type { ProfileImportResult, BulkImportResult, ProfileMetadata } from '@/lib/tinkerprofiles';
```

1b. Add state after `isBulkImport` (line 438):

```typescript
const pendingImportData = ref<string | null>(null);
const duplicateMatches = ref<ProfileMetadata[]>([]);
const duplicateChoice = ref<'update' | 'new'>('update');
const updateTargetId = ref<string | null>(null);

const showDuplicatePrompt = computed(
  () => pendingImportData.value !== null && duplicateMatches.value.length > 0
);
```

1c. Rename the existing single-profile commit logic into `commitSingleImport`. The current `importProfile()` (line 581) does: gather data → bulk branch → single branch. Restructure as:

```typescript
async function onImportClick() {
  if (showDuplicatePrompt.value && pendingImportData.value) {
    const data = pendingImportData.value;
    const updateExistingId =
      duplicateChoice.value === 'update' ? (updateTargetId.value ?? undefined) : undefined;
    clearDuplicatePrompt();
    await commitSingleImport(data, updateExistingId);
    return;
  }
  await importProfile();
}

function clearDuplicatePrompt() {
  pendingImportData.value = null;
  duplicateMatches.value = [];
  duplicateChoice.value = 'update';
  updateTargetId.value = null;
}
```

1d. In `importProfile()`, keep the data-gathering and bulk branch exactly as they are. Replace the body of the single-profile `else` branch (after the v3.0.0 pre-validation block, i.e. the code from the `importProgress.value = { phase: 'equipment', ... }` assignment through the end of the success/failure handling) with:

```typescript
      const preview = await profilesStore.previewImport(data);
      if (!preview.success || !preview.profile) {
        importResult.value = preview;
        return;
      }

      const importName = preview.profile.Character.Name.toLowerCase();
      const matches = profilesStore.profileMetadata.filter(
        (p) => p.name.toLowerCase() === importName
      );

      if (matches.length > 0) {
        pendingImportData.value = data;
        duplicateMatches.value = [...matches];
        duplicateChoice.value = 'update';
        updateTargetId.value = matches[0].id;
        return;
      }

      await commitSingleImport(data, undefined);
```

1e. Create `commitSingleImport(data: string, updateExistingId: string | undefined)` containing the moved code — the equipment progress message, the `profilesStore.importProfile` call (now with options), and the unchanged success/emit/close and error handling:

```typescript
async function commitSingleImport(data: string, updateExistingId: string | undefined) {
  importing.value = true;
  importResult.value = null;
  importProgress.value = {
    phase: 'equipment',
    current: 0,
    total: 1,
    message: 'Fetching equipment from database...',
  };

  try {
    const result = await profilesStore.importProfile(data, undefined, { updateExistingId });
    importResult.value = result;

    if (result.success) {
      if (importOptions.setAsActive && result.profile) {
        await profilesStore.setActiveProfile(result.profile.id);
      }

      emit('imported', result);

      setTimeout(() => {
        emit('update:visible', false);
      }, 2000);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Import failed';
    importResult.value = {
      success: false,
      errors: [errorMessage],
      warnings: [],
      metadata: { source: 'unknown', migrated: false },
    };
  } finally {
    importing.value = false;
    importProgress.value = null;
  }
}
```

Keep the existing `console.log` diagnostics in or drop them within the moved code — match what's there; do not add new logging. The outer `importProfile()` `try/catch/finally` still handles gather-phase and bulk errors as today.

1f. Reset the prompt when inputs change: add `clearDuplicatePrompt()` calls inside `resetForm()` and in the `importText` and `importMethod` watchers' bodies.

- [ ] **Step 2: Add the prompt panel to the template**

After the Format Detection block (ends line 136), add:

```html
      <!-- Duplicate Profile Prompt -->
      <div v-if="showDuplicatePrompt" class="field">
        <div
          class="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg space-y-3"
        >
          <div class="flex items-center gap-2">
            <i class="pi pi-exclamation-triangle text-amber-600 dark:text-amber-400"></i>
            <span class="text-amber-700 dark:text-amber-300 font-medium">
              A profile named "{{ duplicateMatches[0].name }}" already exists
            </span>
          </div>
          <div class="space-y-2">
            <div class="flex items-center">
              <RadioButton
                id="duplicate-update"
                v-model="duplicateChoice"
                name="duplicateChoice"
                value="update"
              />
              <label for="duplicate-update" class="ml-2 text-surface-900 dark:text-surface-50">
                Update the existing profile
              </label>
            </div>
            <div v-if="duplicateChoice === 'update' && duplicateMatches.length > 1" class="ml-6">
              <Select
                v-model="updateTargetId"
                :options="duplicateMatches"
                option-value="id"
                :option-label="(p) => `${p.name} (Level ${p.level} ${p.profession})`"
                class="w-full"
              />
            </div>
            <div class="flex items-center">
              <RadioButton
                id="duplicate-new"
                v-model="duplicateChoice"
                name="duplicateChoice"
                value="new"
              />
              <label for="duplicate-new" class="ml-2 text-surface-900 dark:text-surface-50">
                Create a new profile
              </label>
            </div>
          </div>
        </div>
      </div>
```

Change the footer Import button's click handler (line 384) from `@click="importProfile"` to `@click="onImportClick"`.

- [ ] **Step 3: Type-check**

Run: `cd frontend && npm run type-check`
Expected: no new errors. If `Select` is not available in the installed PrimeVue version, use `Dropdown` from `'primevue/dropdown'` with the same props (check which one other components import: `grep -rn "primevue/select\|primevue/dropdown" frontend/src/components | head`).

- [ ] **Step 4: Run the full frontend test suite**

Run: `cd frontend && npm test -- --run`
Expected: same pass/fail state as before this branch, plus the new tests passing.

- [ ] **Step 5: Manual verification in the browser (Playwright MCP or dev server)**

1. `cd frontend && npm run dev` (or use the Playwright MCP browser).
2. Create a profile named "TestChar", export it (copy JSON).
3. Open Import → Paste Text → paste the JSON → Import. Expect the amber prompt with "Update the existing profile" preselected.
4. Confirm with "Update the existing profile" → exactly one "TestChar" remains in the profile list.
5. Repeat the paste, choose "Create a new profile" → two profiles exist.
6. Paste JSON for an unmatched name → imports immediately, no prompt.

Expected: all four behaviors as described; no console errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/profiles/ProfileImportModal.vue
git commit -m "feat(profiles): prompt to update existing profile on name-matching import"
```

---

### Task 4: Final verification

- [ ] **Step 1: Full suite + type-check + lint**

Run: `cd frontend && npm test -- --run && npm run type-check && npm run lint`
Expected: no regressions vs. the branch point; new tests green.

- [ ] **Step 2: Verify the feature end-to-end**

Use the superpowers:verification-before-completion checklist: re-run the manual flow from Task 3 Step 5 once more on a clean localStorage (DevTools → Application → clear site data) to confirm behavior with zero pre-existing profiles (no prompt, plain import).

- [ ] **Step 3: Commit any fixes; do not merge**

Leave the branch `feat/import-update-existing-profile` ready for review; do not merge or open a PR unless the user asks.
