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

  it('bulk import with overwriteExisting dedupes same-name profiles within the batch', async () => {
    // Build two batch entries with the same name; no pre-existing profile of that name.
    const templateId = await store.createProfile('Template');
    const template = JSON.parse(await store.exportProfile(templateId, 'json'));
    await store.deleteProfile(templateId);

    const first = structuredClone(template);
    first.Character.Name = 'Twin';
    first.Character.Level = 10;

    const second = structuredClone(template);
    second.Character.Name = 'Twin';
    second.Character.Level = 99;

    const bulkData = JSON.stringify({
      version: '1.0',
      profileCount: 2,
      profiles: [first, second],
    });

    const result = await store.importAllProfiles(bulkData, { overwriteExisting: true });
    await store.loadProfiles();

    expect(result.successCount).toBe(2);
    const matches = store.profileMetadata.filter((p) => p.name === 'Twin');
    expect(matches).toHaveLength(1);
    // The later batch entry wins
    expect(matches[0].level).toBe(99);
    // The surviving profile keeps the id assigned to the first batch entry.
    expect(matches[0].id).toBe(result.results[0].profileId);
  });

  it('importProfile with updateExistingId refreshes the active profile without re-activating', async () => {
    const id = await store.createProfile('ActiveOne');
    await store.setActiveProfile(id);

    const exported = JSON.parse(await store.exportProfile(id, 'json'));
    exported.Character.Level = 150;

    const result = await store.importProfile(JSON.stringify(exported), undefined, {
      updateExistingId: id,
    });

    expect(result.success).toBe(true);
    expect(store.activeProfile?.id).toBe(id);
    expect(store.activeProfile?.Character.Level).toBe(150);
  });
});
