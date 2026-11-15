/**
 * Changes Store - cross-version diff data
 *
 * Holds what the diff routes answered, keyed by the builds and parameters of
 * the request, and coordinates the requests themselves:
 *
 * - an answer already held is returned without a request (a build's changes
 *   are immutable until the next import, and going back from an item to the
 *   change list must not wait);
 * - a request identical to one in flight joins it;
 * - list requests run on a named channel, and a new request on a channel
 *   aborts the one before it (fast filter changes).
 *
 * Every key carries the build slugs, so nothing here outlives a version
 * switch incorrectly. Nothing is persisted.
 */

import { defineStore } from 'pinia';
import { apiClient } from '../services/api-client';
import { dataSlug, dataVersion } from '../composables/useGameVersion';
import type {
  BuildTransitionsResponse,
  ChangeListQuery,
  ChangeListResponse,
  ItemCompareResponse,
  ItemTimelineResponse,
  TransitionsQuery,
} from '../types/changes';

const MAX_LIST_PAGES = 40;
const MAX_ITEM_ENTRIES = 200;

/** Insertion-ordered map capped in size; reading an entry makes it the newest. */
class LruCache<T> {
  private readonly entries = new Map<string, T>();

  constructor(private readonly limit: number) {}

  get(key: string): T | undefined {
    const value = this.entries.get(key);
    if (value !== undefined) {
      this.entries.delete(key);
      this.entries.set(key, value);
    }
    return value;
  }

  set(key: string, value: T): void {
    this.entries.delete(key);
    this.entries.set(key, value);
    while (this.entries.size > this.limit) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  clear(): void {
    this.entries.clear();
  }
}

interface InFlight<T> {
  promise: Promise<T>;
  controller: AbortController;
  /** Callers waiting on the request; it is aborted when the last one leaves. */
  channels: Set<string>;
}

function buildOf(version: string | null | undefined): string {
  return dataSlug(version) ?? dataVersion.value ?? '';
}

/** Stable text of a query: keys sorted, lists in the order given, empties dropped. */
export function queryKey(query: object): string {
  const entries = Object.entries(query as Record<string, unknown>)
    .filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        value !== '' &&
        !(Array.isArray(value) && value.length === 0)
    )
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

export const useChangesStore = defineStore('changes', () => {
  const lists = new LruCache<ChangeListResponse>(MAX_LIST_PAGES);
  const transitions = new LruCache<BuildTransitionsResponse>(MAX_LIST_PAGES);
  const timelines = new LruCache<ItemTimelineResponse>(MAX_ITEM_ENTRIES);
  const itemCompares = new LruCache<ItemCompareResponse>(MAX_ITEM_ENTRIES);

  const inFlight = new Map<string, InFlight<unknown>>();
  /** Request key each channel is waiting on. */
  const channelKeys = new Map<string, string>();

  function leave(channel: string): void {
    const key = channelKeys.get(channel);
    if (key === undefined) return;
    channelKeys.delete(channel);
    const request = inFlight.get(key);
    if (!request) return;
    request.channels.delete(channel);
    if (request.channels.size === 0) {
      inFlight.delete(key);
      request.controller.abort();
    }
  }

  /**
   * Answer `key` from the cache, from the identical request in flight, or
   * with a new request. With a channel, whatever else the channel was waiting
   * on is left (and aborted when no other channel waits on it).
   */
  function load<T>(
    cache: LruCache<T>,
    key: string,
    channel: string | undefined,
    request: (signal: AbortSignal) => Promise<T>
  ): Promise<T> {
    if (channel !== undefined && channelKeys.get(channel) !== key) leave(channel);

    const held = cache.get(key);
    if (held !== undefined) return Promise.resolve(held);

    let entry = inFlight.get(key) as InFlight<T> | undefined;
    if (!entry) {
      const controller = new AbortController();
      const created: InFlight<T> = {
        controller,
        channels: new Set(),
        promise: (async () => request(controller.signal))()
          .then((value) => {
            cache.set(key, value);
            return value;
          })
          .finally(() => {
            if (inFlight.get(key) === created) {
              inFlight.delete(key);
              for (const waiting of created.channels) {
                if (channelKeys.get(waiting) === key) channelKeys.delete(waiting);
              }
            }
          }),
      };
      entry = created;
      inFlight.set(key, created as InFlight<unknown>);
    }
    if (channel !== undefined) {
      entry.channels.add(channel);
      channelKeys.set(channel, key);
    } else {
      // A caller without a channel never cancels; keep the request alive.
      entry.channels.add(`pinned:${key}`);
    }
    return entry.promise;
  }

  /**
   * A page of the changes of `version` against the build before it, or
   * against `base` when one is given.
   */
  function loadChangeList(
    request: { version?: string | null; base?: string | null; query: ChangeListQuery },
    channel?: string
  ): Promise<ChangeListResponse> {
    const build = buildOf(request.version);
    const base = request.base ? (dataSlug(request.base) ?? request.base) : null;
    const key = `list|${build}|${base ?? ''}|${queryKey(request.query)}`;
    return load(lists, key, channel, (signal) =>
      base
        ? apiClient.compareBuilds(base, request.query, { gameVersion: build, signal })
        : apiClient.getBuildChanges(request.query, { gameVersion: build, signal })
    );
  }

  function peekChangeList(request: {
    version?: string | null;
    base?: string | null;
    query: ChangeListQuery;
  }): ChangeListResponse | undefined {
    const build = buildOf(request.version);
    const base = request.base ? (dataSlug(request.base) ?? request.base) : null;
    return lists.get(`list|${build}|${base ?? ''}|${queryKey(request.query)}`);
  }

  function loadTransitions(
    request: { version?: string | null; query?: TransitionsQuery },
    channel?: string
  ): Promise<BuildTransitionsResponse> {
    const build = buildOf(request.version);
    const query = request.query ?? {};
    const key = `transitions|${build}|${queryKey(query)}`;
    return load(transitions, key, channel, (signal) =>
      apiClient.getBuildTransitions(query, { gameVersion: build, signal })
    );
  }

  function loadTimeline(
    aoid: number,
    version?: string | null,
    channel?: string
  ): Promise<ItemTimelineResponse> {
    const build = buildOf(version);
    return load(timelines, `timeline|${build}|${aoid}`, channel, (signal) =>
      apiClient.getItemTimeline(aoid, { gameVersion: build, signal })
    );
  }

  /** One item in `base` (older side) and in `version` (newer side). */
  function loadItemCompare(
    request: { aoid: number; version?: string | null; base: string },
    channel?: string
  ): Promise<ItemCompareResponse> {
    const build = buildOf(request.version);
    const base = dataSlug(request.base) ?? request.base;
    return load(itemCompares, `item|${build}|${base}|${request.aoid}`, channel, (signal) =>
      apiClient.compareItem(request.aoid, base, { gameVersion: build, signal })
    );
  }

  /** Stop waiting on whatever `channel` asked for last. */
  function cancel(channel: string): void {
    leave(channel);
  }

  function clear(): void {
    for (const request of inFlight.values()) request.controller.abort();
    inFlight.clear();
    channelKeys.clear();
    lists.clear();
    transitions.clear();
    timelines.clear();
    itemCompares.clear();
  }

  return {
    loadChangeList,
    peekChangeList,
    loadTransitions,
    loadTimeline,
    loadItemCompare,
    cancel,
    clear,
  };
});
