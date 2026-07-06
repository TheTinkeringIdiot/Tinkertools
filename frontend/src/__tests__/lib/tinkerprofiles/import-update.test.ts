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
