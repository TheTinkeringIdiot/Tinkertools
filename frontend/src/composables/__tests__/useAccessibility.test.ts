/**
 * useAccessibility announcements reach the app-wide live regions
 * rendered by AccessibilityAnnouncer (mounted once in App.vue).
 */

import { describe, it, expect, afterEach } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import AccessibilityAnnouncer from '@/components/shared/AccessibilityAnnouncer.vue';
import { useAccessibility } from '../useAccessibility';

describe('useAccessibility', () => {
  let announcer: VueWrapper;

  afterEach(() => {
    announcer?.unmount();
  });

  it('announces polite messages in the polite live region', async () => {
    announcer = mount(AccessibilityAnnouncer);
    const { announce } = useAccessibility();

    announce('Eye slot switched to Symbiant mode');
    await nextTick();

    expect(announcer.find('[aria-live="polite"]').text()).toBe(
      'Eye slot switched to Symbiant mode'
    );
    expect(announcer.find('[aria-live="assertive"]').text()).toBe('');
  });

  it('announces errors in the assertive live region', async () => {
    announcer = mount(AccessibilityAnnouncer);
    const { announce, announceError } = useAccessibility();

    announce('Failed to save implant configuration', 'assertive');
    await nextTick();
    expect(announcer.find('[aria-live="assertive"]').text()).toBe(
      'Failed to save implant configuration'
    );

    announceError('Lookup failed');
    await nextTick();
    expect(announcer.find('[aria-live="assertive"]').text()).toBe('Error: Lookup failed');
  });
});
