/**
 * Nano Favorites Integration Tests
 *
 * Favoriting a nano from its card in the list and from the detail dialog, by
 * clicking the real heart buttons, and finding it still favorited on a later
 * visit. Real nanos store and PrimeVue; only the API client is mocked.
 *
 * @group integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// IMPORTANT: Mock API client BEFORE importing any stores
vi.mock('@/services/api-client');

import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import {
  setupIntegrationTest,
  type IntegrationTestContext,
} from '../helpers/integration-test-utils';
import { appGlobals } from '../helpers/app-globals';
import { createTestNano } from '../helpers/nano-fixtures';
import { useNanosStore } from '@/stores/nanosStore';
import NanoList from '@/components/nanos/NanoList.vue';
import NanoDetail from '@/components/nanos/NanoDetail.vue';

const alleysweeper = createTestNano({ aoid: 203123, name: 'Alleysweeper' });
const minorSuppressor = createTestNano({ aoid: 43370, name: 'Minor Suppressor' });

describe('Nano favorites', () => {
  let context: IntegrationTestContext;
  let pinia: Pinia;
  const mounted: VueWrapper[] = [];

  beforeEach(async () => {
    context = await setupIntegrationTest();
    pinia = context.pinia;
  });

  afterEach(() => {
    mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  });

  /**
   * A later visit: a new Pinia, so a nanos store that knows only what the
   * browser's storage kept.
   */
  function visitAgain(): void {
    mounted.splice(0).forEach((wrapper) => wrapper.unmount());
    pinia = createPinia();
    context.app.use(pinia);
    setActivePinia(pinia);
  }

  async function showList(): Promise<VueWrapper> {
    const wrapper = mount(NanoList, {
      props: { nanos: [alleysweeper, minorSuppressor] },
      global: appGlobals(pinia),
    });
    mounted.push(wrapper);
    await flushPromises();
    return wrapper;
  }

  function cardOf(list: VueWrapper, nanoName: string) {
    const card = list
      .findAll('.nano-card')
      .find((candidate) => candidate.text().includes(nanoName));
    if (!card) throw new Error(`No card for ${nanoName}`);
    return card;
  }

  function heartOf(list: VueWrapper, nanoName: string) {
    const heart = cardOf(list, nanoName)
      .findAll('button')
      .find((button) => button.find('.pi-heart, .pi-heart-fill').exists());
    if (!heart) throw new Error(`No favorite button on the ${nanoName} card`);
    return heart;
  }

  const showsAsFavorite = (list: VueWrapper, nanoName: string): boolean =>
    heartOf(list, nanoName).find('.pi-heart-fill').exists();

  async function showDetail(): Promise<void> {
    const wrapper = mount(NanoDetail, {
      props: { visible: true, nano: alleysweeper },
      global: appGlobals(pinia),
      attachTo: document.body,
    });
    mounted.push(wrapper);
    await flushPromises();
  }

  /** The labelled favorite button in the dialog footer; the dialog renders into document.body */
  function detailFavoriteButton(): HTMLButtonElement {
    const button = Array.from(document.body.querySelectorAll('button')).find((candidate) =>
      /Favorites/.test(candidate.textContent ?? '')
    );
    if (!button) throw new Error('No favorite button in the nano detail dialog');
    return button;
  }

  describe('from the nano card', () => {
    it('marks only the clicked nano as a favorite', async () => {
      const list = await showList();
      expect(showsAsFavorite(list, 'Alleysweeper')).toBe(false);

      await heartOf(list, 'Alleysweeper').trigger('click');

      expect(showsAsFavorite(list, 'Alleysweeper')).toBe(true);
      expect(showsAsFavorite(list, 'Minor Suppressor')).toBe(false);
    });

    it('favorites without opening the nano', async () => {
      const list = await showList();

      await heartOf(list, 'Alleysweeper').trigger('click');

      expect(list.emitted('nano-select')).toBeUndefined();
    });

    it('is still a favorite on a later visit', async () => {
      const list = await showList();
      await heartOf(list, 'Alleysweeper').trigger('click');

      visitAgain();

      const store = useNanosStore();
      expect(store.isFavorite(alleysweeper.aoid)).toBe(true);
      expect(store.isFavorite(minorSuppressor.aoid)).toBe(false);
      const listAgain = await showList();
      expect(showsAsFavorite(listAgain, 'Alleysweeper')).toBe(true);
      expect(showsAsFavorite(listAgain, 'Minor Suppressor')).toBe(false);
    });

    it('stays removed on a later visit once unfavorited', async () => {
      const list = await showList();
      await heartOf(list, 'Alleysweeper').trigger('click');
      await heartOf(list, 'Alleysweeper').trigger('click');
      expect(showsAsFavorite(list, 'Alleysweeper')).toBe(false);

      visitAgain();

      expect(useNanosStore().isFavorite(alleysweeper.aoid)).toBe(false);
      expect(showsAsFavorite(await showList(), 'Alleysweeper')).toBe(false);
    });

    it('survives the store reloading its data for the game version', async () => {
      const list = await showList();
      await heartOf(list, 'Minor Suppressor').trigger('click');

      const store = useNanosStore();
      store.resetForVersionChange();
      await flushPromises();

      expect(store.isFavorite(minorSuppressor.aoid)).toBe(true);
      expect(showsAsFavorite(list, 'Minor Suppressor')).toBe(true);
    });
  });

  describe('from the nano detail dialog', () => {
    it('offers to remove the nano once it has been added', async () => {
      await showDetail();
      expect(detailFavoriteButton().textContent).toContain('Add to Favorites');

      detailFavoriteButton().click();
      await flushPromises();

      expect(detailFavoriteButton().textContent).toContain('Remove from Favorites');
    });

    it('is still a favorite on a later visit, in the dialog and on the card', async () => {
      await showDetail();
      detailFavoriteButton().click();
      await flushPromises();

      visitAgain();

      expect(useNanosStore().isFavorite(alleysweeper.aoid)).toBe(true);
      const list = await showList();
      expect(showsAsFavorite(list, 'Alleysweeper')).toBe(true);
      expect(showsAsFavorite(list, 'Minor Suppressor')).toBe(false);
      await showDetail();
      expect(detailFavoriteButton().textContent).toContain('Remove from Favorites');
    });
  });
});
