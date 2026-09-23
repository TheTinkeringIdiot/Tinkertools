/**
 * Version-namespaced storage key tests.
 *
 * These keys are what stops one game version's cached data from being served
 * as another's, so the important cases are: the slug ends up in the key, keys
 * of other versions are recognised and removed, and pre-version data is
 * adopted rather than dropped.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  UNKNOWN_VERSION,
  activeVersionSlug,
  versionKey,
  versionPrefix,
  versionOfKey,
  isVersionKey,
  trailingVersionOf,
  purgeOtherVersions,
  purgeLocalStoragePrefix,
  adoptLegacyKey,
} from '@/services/version-keys';
import { setCurrentVersion, currentVersion } from '@/composables/useGameVersion';
import { TEST_VERSION, TEST_ALT_VERSION } from '../helpers/version-fixtures';

describe('version-keys', () => {
  beforeEach(() => {
    setCurrentVersion(TEST_VERSION);
    localStorage.clear();
  });

  afterEach(() => {
    setCurrentVersion(TEST_VERSION);
  });

  describe('key construction', () => {
    it('appends the active version to a base key', () => {
      expect(versionKey('tinkertools_nanos_cache')).toBe(`tinkertools_nanos_cache:${TEST_VERSION}`);
    });

    it('accepts an explicit slug', () => {
      expect(versionKey('base', TEST_ALT_VERSION)).toBe(`base:${TEST_ALT_VERSION}`);
    });

    it('builds a family prefix with a trailing separator', () => {
      expect(versionPrefix('weapons')).toBe(`weapons:${TEST_VERSION}:`);
    });

    it('follows the active version rather than snapshotting it', () => {
      const before = versionKey('base');
      setCurrentVersion(TEST_ALT_VERSION);

      expect(versionKey('base')).not.toBe(before);
      expect(versionKey('base')).toBe(`base:${TEST_ALT_VERSION}`);
    });

    it('falls back to a placeholder when no version is resolved', () => {
      currentVersion.value = null;

      expect(activeVersionSlug()).toBe(UNKNOWN_VERSION);
      expect(versionKey('base')).toBe(`base:${UNKNOWN_VERSION}`);
    });
  });

  describe('key inspection', () => {
    it('reads the version out of a single-entry key', () => {
      expect(versionOfKey(`base:${TEST_ALT_VERSION}`, 'base')).toBe(TEST_ALT_VERSION);
    });

    it('reads the version out of a family key', () => {
      expect(versionOfKey(`base:${TEST_ALT_VERSION}:200_1_5`, 'base')).toBe(TEST_ALT_VERSION);
    });

    it('rejects keys of a different base', () => {
      expect(versionOfKey(`other:${TEST_VERSION}`, 'base')).toBeNull();
      expect(isVersionKey('base_legacy_key', 'base')).toBe(false);
    });

    it('rejects a pre-version key of the same base', () => {
      expect(isVersionKey('base', 'base')).toBe(false);
    });

    it('reads a version carried in the trailing segment', () => {
      expect(trailingVersionOf(`api_items_abc123:${TEST_VERSION}`)).toBe(TEST_VERSION);
      expect(trailingVersionOf('api_items_abc123')).toBeNull();
    });
  });

  describe('purging other versions', () => {
    it('removes only the entries of versions we are not on', () => {
      localStorage.setItem(versionKey('favorites', TEST_VERSION), '[1]');
      localStorage.setItem(versionKey('favorites', TEST_ALT_VERSION), '[2]');
      localStorage.setItem(`favorites:${TEST_ALT_VERSION}:extra`, '[3]');
      localStorage.setItem('unrelated', 'keep me');

      const removed = purgeOtherVersions('favorites');

      expect(removed).toBe(2);
      expect(localStorage.getItem(versionKey('favorites', TEST_VERSION))).toBe('[1]');
      expect(localStorage.getItem(versionKey('favorites', TEST_ALT_VERSION))).toBeNull();
      expect(localStorage.getItem(`favorites:${TEST_ALT_VERSION}:extra`)).toBeNull();
      expect(localStorage.getItem('unrelated')).toBe('keep me');
    });

    it('leaves pre-version keys alone so they can still be adopted', () => {
      localStorage.setItem('favorites', '[1]');

      expect(purgeOtherVersions('favorites')).toBe(0);
      expect(localStorage.getItem('favorites')).toBe('[1]');
    });

    it('purges a whole legacy prefix when asked', () => {
      localStorage.setItem('legacy_cache_a', '1');
      localStorage.setItem('legacy_cache_b', '2');
      localStorage.setItem('kept', '3');

      expect(purgeLocalStoragePrefix('legacy_cache_')).toBe(2);
      expect(localStorage.getItem('kept')).toBe('3');
    });
  });

  describe('adopting pre-version data', () => {
    it('renames an un-namespaced key to the current version', () => {
      localStorage.setItem('farm-list', '{"aoids":[1,2]}');

      expect(adoptLegacyKey('farm-list')).toBe(true);
      expect(localStorage.getItem('farm-list')).toBeNull();
      expect(localStorage.getItem(versionKey('farm-list'))).toBe('{"aoids":[1,2]}');
    });

    it('does not overwrite data the current version already has', () => {
      localStorage.setItem('farm-list', 'old');
      localStorage.setItem(versionKey('farm-list'), 'new');

      expect(adoptLegacyKey('farm-list')).toBe(false);
      expect(localStorage.getItem(versionKey('farm-list'))).toBe('new');
      expect(localStorage.getItem('farm-list')).toBeNull();
    });

    it('is a no-op when there is nothing to adopt', () => {
      expect(adoptLegacyKey('farm-list')).toBe(false);
      expect(localStorage.getItem(versionKey('farm-list'))).toBeNull();
    });

    it('adopts into whichever version is active at the time', () => {
      setCurrentVersion(TEST_ALT_VERSION);
      localStorage.setItem('farm-list', 'data');

      adoptLegacyKey('farm-list');

      expect(localStorage.getItem(`farm-list:${TEST_ALT_VERSION}`)).toBe('data');
    });
  });
});
