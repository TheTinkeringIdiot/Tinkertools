/**
 * Change list filters and their place in the URL.
 */

import { describe, it, expect } from 'vitest';
import {
  activeFilterCount,
  changeFiltersToQuery,
  changeFiltersToRequest,
  defaultChangeFilters,
  parseChangeFilters,
  transitionFilterValues,
} from '@/services/change-filters';

describe('change filters in the URL', () => {
  it('reads a plain URL as the default view: gameplay and economy changes', () => {
    const filters = parseChangeFilters({});
    expect(filters).toEqual(defaultChangeFilters());
    expect(filters.relevance).toEqual(['gameplay', 'economy']);
    expect(changeFiltersToQuery(filters)).toEqual({});
  });

  it('asks the API for the default view with its relevance filter', () => {
    expect(changeFiltersToRequest(defaultChangeFilters())).toEqual({
      page: 1,
      page_size: 50,
      sort: 'name',
      relevance: ['gameplay', 'economy'],
    });
  });

  it('writes every filter to the URL and reads the same filters back', () => {
    const filters = {
      ...defaultChangeFilters(),
      kind: ['added' as const, 'changed' as const],
      part: ['effects' as const],
      relevance: ['cosmetic' as const],
      type: 'nano' as const,
      itemClass: 1,
      minQl: 100,
      maxQl: 200,
      profession: 11,
      slot: 6,
      search: 'Rifle',
      sort: 'ql' as const,
      page: 3,
      pageSize: 100,
      expandNotes: true,
      showDiffs: true,
      transition: null,
    };
    const query = changeFiltersToQuery(filters);
    expect(query).toEqual({
      kind: 'added,changed',
      part: 'effects',
      relevance: 'cosmetic',
      type: 'nano',
      class: '1',
      minql: '100',
      maxql: '200',
      prof: '11',
      slot: '6',
      q: 'Rifle',
      sort: 'ql',
      page: '3',
      size: '100',
      notes: 'expand',
      diffs: '1',
    });
    expect(parseChangeFilters(query as Record<string, string>)).toEqual(filters);
  });

  it('turns the filters into request parameters', () => {
    const request = changeFiltersToRequest(
      parseChangeFilters({
        kind: 'removed',
        part: 'stats,actions',
        relevance: 'all',
        type: 'item',
        class: '2',
        minql: '50',
        prof: '4',
        slot: '2',
        q: 'Helmet',
        page: '2',
        notes: 'expand',
        diffs: '1',
      })
    );
    expect(request).toEqual({
      page: 2,
      page_size: 50,
      sort: 'name',
      kind: ['removed'],
      part: ['stats', 'actions'],
      is_nano: false,
      item_class: 2,
      min_ql: 50,
      profession: 4,
      slot: 2,
      search: 'Helmet',
      notes: 'expand',
      include_diff: true,
    });
  });

  it('carries one patch note as a filter: its path and both values', () => {
    const filters = {
      ...defaultChangeFilters(),
      relevance: [],
      transition: { path: 'effect:53089:spell_params.Chance', old: '60', new: '100' },
    };
    const query = changeFiltersToQuery(filters);
    expect(query).toEqual({
      relevance: 'all',
      t: 'effect:53089:spell_params.Chance',
      tfrom: '60',
      tto: '100',
    });
    expect(parseChangeFilters(query as Record<string, string>)).toEqual(filters);
    // Its items include those a build note explains.
    expect(changeFiltersToRequest(filters)).toEqual({
      page: 1,
      page_size: 50,
      sort: 'name',
      transition: 'effect:53089:spell_params.Chance',
      transition_old: '60',
      transition_new: '100',
      notes: 'expand',
    });
  });

  it('tells an absent value (JSON null) from any value (left out)', () => {
    const added = parseChangeFilters({ t: 'stat:287', tfrom: 'null', tto: '20' });
    expect(added.transition).toEqual({ path: 'stat:287', old: 'null', new: '20' });
    expect(transitionFilterValues(added.transition!)).toEqual({ old: null, new: 20 });
    expect(changeFiltersToRequest(added)).toMatchObject({
      transition_old: 'null',
      transition_new: '20',
    });

    const any = parseChangeFilters({ t: 'stat:287', tfrom: 'not json' });
    expect(any.transition).toEqual({ path: 'stat:287', old: null, new: null });
    expect(changeFiltersToRequest(any).transition_old).toBeUndefined();
    expect(transitionFilterValues(any.transition!)).toEqual({ old: undefined, new: undefined });
  });

  it('writes "every change" as relevance=all', () => {
    const everything = { ...defaultChangeFilters(), relevance: [] };
    expect(changeFiltersToQuery(everything)).toEqual({ relevance: 'all' });
    expect(parseChangeFilters({ relevance: 'all' }).relevance).toEqual([]);
  });

  it('ignores values it does not know instead of failing', () => {
    const filters = parseChangeFilters({
      kind: 'exploded,added',
      part: 'nonsense',
      type: 'robot',
      class: 'abc',
      minql: '-4',
      sort: 'price',
      page: '0',
      size: '7',
    });
    expect(filters.kind).toEqual(['added']);
    expect(filters.part).toEqual([]);
    expect(filters.type).toBeNull();
    expect(filters.itemClass).toBeNull();
    expect(filters.minQl).toBeNull();
    expect(filters.sort).toBe('name');
    expect(filters.page).toBe(1);
    expect(filters.pageSize).toBe(50);
  });

  it('accepts repeated parameters as well as comma lists', () => {
    expect(parseChangeFilters({ kind: ['added', 'removed'] }).kind).toEqual(['added', 'removed']);
  });

  it('keeps parameters of the URL that are not its own', () => {
    expect(changeFiltersToQuery(defaultChangeFilters(), { ref: 'forum' })).toEqual({
      ref: 'forum',
    });
  });

  it('counts the filters that narrow the default view', () => {
    expect(activeFilterCount(defaultChangeFilters())).toBe(0);
    expect(
      activeFilterCount({ ...defaultChangeFilters(), kind: ['added'], search: 'x', relevance: [] })
    ).toBe(3);
    expect(activeFilterCount({ ...defaultChangeFilters(), sort: 'ql', page: 4 })).toBe(0);
    expect(
      activeFilterCount({
        ...defaultChangeFilters(),
        transition: { path: 'stat:2', old: null, new: null },
      })
    ).toBe(1);
  });
});
