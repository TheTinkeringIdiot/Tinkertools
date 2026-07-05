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
