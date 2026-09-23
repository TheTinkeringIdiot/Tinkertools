/**
 * Interpolation across game versions.
 *
 * Interpolated stats differ per snapshot, so a peek must request the peeked
 * version and must not read or poison the browsing version's cache entries.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';

vi.mock('@/services/api-client', () => ({
  apiClient: {
    interpolateItem: vi.fn(),
    getInterpolationInfo: vi.fn(),
    checkItemInterpolatable: vi.fn(),
  },
}));

import interpolationService from '@/services/interpolation-service';
import { apiClient } from '@/services/api-client';
import { currentVersion, setCurrentVersion } from '@/composables/useGameVersion';

const mockApi = apiClient as unknown as {
  interpolateItem: Mock;
  getInterpolationInfo: Mock;
  checkItemInterpolatable: Mock;
};

function interpolated(ql: number) {
  return { aoid: 24562, name: 'Notum Splice', target_ql: ql, interpolating: true, stats: [] };
}

function info(maxQl: number) {
  return {
    aoid: 24562,
    interpolatable: true,
    min_ql: 1,
    max_ql: maxQl,
    ql_range: maxQl - 1,
    ranges: [],
  };
}

describe('interpolation across game versions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    interpolationService.clearAllCaches();
    currentVersion.value = null;
    setCurrentVersion('ao-2024-02');
  });

  it('sends no version for the browsing version', async () => {
    mockApi.interpolateItem.mockResolvedValue({ success: true, item: interpolated(150) });

    await interpolationService.interpolateItem(24562, 150);

    expect(mockApi.interpolateItem).toHaveBeenCalledWith(24562, 150);
  });

  it('sends the peeked version when one is given', async () => {
    mockApi.interpolateItem.mockResolvedValue({ success: true, item: interpolated(150) });

    await interpolationService.interpolateItem(24562, 150, { gameVersion: 'ao-2019-11' });

    expect(mockApi.interpolateItem).toHaveBeenCalledWith(24562, 150, {
      gameVersion: 'ao-2019-11',
    });
  });

  it('caches interpolated items per version', async () => {
    mockApi.interpolateItem.mockResolvedValue({ success: true, item: interpolated(150) });

    await interpolationService.interpolateItem(24562, 150);
    await interpolationService.interpolateItem(24562, 150);
    expect(mockApi.interpolateItem).toHaveBeenCalledTimes(1);

    // Same item and QL, other snapshot: must not reuse the cached entry.
    await interpolationService.interpolateItem(24562, 150, { gameVersion: 'ao-2019-11' });
    expect(mockApi.interpolateItem).toHaveBeenCalledTimes(2);

    // And the peeked result is cached separately.
    await interpolationService.interpolateItem(24562, 150, { gameVersion: 'ao-2019-11' });
    expect(mockApi.interpolateItem).toHaveBeenCalledTimes(2);
  });

  it('caches interpolation info per version', async () => {
    mockApi.getInterpolationInfo
      .mockResolvedValueOnce({ success: true, data: info(300) })
      .mockResolvedValueOnce({ success: true, data: info(200) });

    const live = await interpolationService.getInterpolationInfo(24562);
    const old = await interpolationService.getInterpolationInfo(24562, {
      gameVersion: 'ao-2019-11',
    });

    expect(live?.max_ql).toBe(300);
    expect(old?.max_ql).toBe(200);
    expect(mockApi.getInterpolationInfo).toHaveBeenCalledTimes(2);

    // Reading the browsing version again still returns its own entry.
    const liveAgain = await interpolationService.getInterpolationInfo(24562);
    expect(liveAgain?.max_ql).toBe(300);
    expect(mockApi.getInterpolationInfo).toHaveBeenCalledTimes(2);
  });

  it('clears an item from every version on clearItemCache', async () => {
    mockApi.interpolateItem.mockResolvedValue({ success: true, item: interpolated(150) });

    await interpolationService.interpolateItem(24562, 150);
    await interpolationService.interpolateItem(24562, 150, { gameVersion: 'ao-2019-11' });
    expect(mockApi.interpolateItem).toHaveBeenCalledTimes(2);

    interpolationService.clearItemCache(24562);

    await interpolationService.interpolateItem(24562, 150);
    await interpolationService.interpolateItem(24562, 150, { gameVersion: 'ao-2019-11' });
    expect(mockApi.interpolateItem).toHaveBeenCalledTimes(4);
  });
});
