import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { nextTick } from 'vue';
import { mountWithContext, standardCleanup } from '@/__tests__/helpers';
import AccessibilityAnnouncer from '@/components/shared/AccessibilityAnnouncer.vue';

describe('AccessibilityAnnouncer', () => {
  let wrapper: any;
  let announcePolite: Event;
  let announceAssertive: Event;
  let announceStatus: Event;

  beforeEach(() => {
    wrapper = mountWithContext(AccessibilityAnnouncer);
    
    // Create custom events for testing
    announcePolite = new CustomEvent('announce-polite', { 
      detail: { message: 'Test polite message' } 
    });
    
    announceAssertive = new CustomEvent('announce-assertive', { 
      detail: { message: 'Test assertive message' } 
    });
    
    announceStatus = new CustomEvent('announce-status', { 
      detail: { message: 'Test status message' } 
    });
  });

  afterEach(() => {
    standardCleanup()
    wrapper.unmount();
  });

  it('mounts successfully', () => {
    expect(wrapper.exists()).toBe(true);
  });

  it('has aria live regions with correct attributes', () => {
    const politeRegion = wrapper.find('#polite-announcer');
    const assertiveRegion = wrapper.find('#assertive-announcer');
    const statusRegion = wrapper.find('#status-announcer');

    expect(politeRegion.exists()).toBe(true);
    expect(politeRegion.attributes('aria-live')).toBe('polite');
    expect(politeRegion.attributes('aria-atomic')).toBe('true');

    expect(assertiveRegion.exists()).toBe(true);
    expect(assertiveRegion.attributes('aria-live')).toBe('assertive');
    expect(assertiveRegion.attributes('aria-atomic')).toBe('true');

    expect(statusRegion.exists()).toBe(true);
    expect(statusRegion.attributes('role')).toBe('status');
    expect(statusRegion.attributes('aria-live')).toBe('polite');
    expect(statusRegion.attributes('aria-atomic')).toBe('true');
  });

  it('all live regions have sr-only class for screen readers', () => {
    const politeRegion = wrapper.find('#polite-announcer');
    const assertiveRegion = wrapper.find('#assertive-announcer');
    const statusRegion = wrapper.find('#status-announcer');

    expect(politeRegion.classes()).toContain('sr-only');
    expect(assertiveRegion.classes()).toContain('sr-only');
    expect(statusRegion.classes()).toContain('sr-only');
  });

  it('handles polite announcements', async () => {
    // Dispatch the custom event
    window.dispatchEvent(announcePolite);
    
    await wrapper.vm.$nextTick();
    
    const politeRegion = wrapper.find('#polite-announcer');
    expect(politeRegion.text()).toBe('Test polite message');
  });

  it('handles assertive announcements', async () => {
    // Dispatch the custom event
    window.dispatchEvent(announceAssertive);
    
    await wrapper.vm.$nextTick();
    
    const assertiveRegion = wrapper.find('#assertive-announcer');
    expect(assertiveRegion.text()).toBe('Test assertive message');
  });

  it('handles status announcements', async () => {
    // Dispatch the custom event
    window.dispatchEvent(announceStatus);
    
    await wrapper.vm.$nextTick();
    
    const statusRegion = wrapper.find('#status-announcer');
    expect(statusRegion.text()).toBe('Test status message');
  });

  it('clears messages after timeout', async () => {
    vi.useFakeTimers();
    
    // Dispatch the event
    window.dispatchEvent(announcePolite);
    await wrapper.vm.$nextTick();
    
    // Verify message is shown
    const politeRegion = wrapper.find('#polite-announcer');
    expect(politeRegion.text()).toBe('Test polite message');
    
    // Fast forward time
    vi.advanceTimersByTime(1100); // Just over 1 second
    await wrapper.vm.$nextTick();
    
    // Message should be cleared
    expect(politeRegion.text()).toBe('');
    
    vi.useRealTimers();
  });

  it('handles multiple rapid announcements', async () => {
    // Dispatch multiple events
    window.dispatchEvent(announcePolite);
    window.dispatchEvent(announceAssertive);
    window.dispatchEvent(announceStatus);
    
    await wrapper.vm.$nextTick();
    
    const politeRegion = wrapper.find('#polite-announcer');
    const assertiveRegion = wrapper.find('#assertive-announcer');
    const statusRegion = wrapper.find('#status-announcer');
    
    expect(politeRegion.text()).toBe('Test polite message');
    expect(assertiveRegion.text()).toBe('Test assertive message');
    expect(statusRegion.text()).toBe('Test status message');
  });
});