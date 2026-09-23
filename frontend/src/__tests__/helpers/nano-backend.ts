/**
 * A fake of the backend's /nanos and /nanos/search endpoints, for tests that
 * mock the API client: it filters, sorts and pages a fixed nano list the way
 * the backend does, so a test can assert both on what was requested and on
 * what the user then sees.
 *
 * Mirrors backend/app/api/routes/nanos.py:
 * - school, profession and strain repeat and match any of their values
 * - profession also matches nanos anyone can cast (no professions, a level)
 * - level_min / level_max leave out nanos without a level
 * - /nanos sorts by sort_by (nulls last) and sort_desc; /nanos/search by id
 */

import { vi } from 'vitest';
import type { Action, PaginatedResponse } from '@/types/api';
import type { NanoSchoolName } from '@/types/nano';

/** A nano as the /nanos endpoints return it (snake_case) */
export interface BackendNano {
  id: number;
  aoid: number;
  name: string;
  ql: number;
  description: string | null;
  school: NanoSchoolName | null;
  strain: string | null;
  professions: string[];
  level: number | null;
  actions: Action[];
  effects: [];
}

export function backendNano(
  fields: Partial<BackendNano> & Pick<BackendNano, 'id' | 'name'>
): BackendNano {
  return {
    aoid: 100000 + fields.id,
    ql: 1,
    description: null,
    school: null,
    strain: null,
    professions: [],
    level: 1,
    actions: [],
    effects: [],
    ...fields,
  };
}

const lower = (values: string[]) => values.map((value) => value.toLowerCase());

function compareNullsLast(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

/** Answer one request URL (path plus query, as the store sends it) */
export function answerNanoRequest(
  nanos: BackendNano[],
  url: string
): PaginatedResponse<BackendNano> {
  const [path, queryString] = url.split('?');
  const query = new URLSearchParams(queryString);
  let result = [...nanos];

  if (path === '/nanos/search') {
    const q = (query.get('q') ?? '').toLowerCase();
    result = result.filter(
      (nano) =>
        nano.name.toLowerCase().includes(q) || (nano.description ?? '').toLowerCase().includes(q)
    );
  } else if (path !== '/nanos') {
    throw new Error(`Unexpected nano request ${url}`);
  }

  const schools = lower(query.getAll('school'));
  if (schools.length > 0) {
    result = result.filter((nano) => nano.school && schools.includes(nano.school.toLowerCase()));
  }
  const professions = lower(query.getAll('profession'));
  if (professions.length > 0) {
    result = result.filter((nano) =>
      nano.professions.length === 0
        ? nano.level !== null
        : lower(nano.professions).some((profession) => professions.includes(profession))
    );
  }
  const strains = query.getAll('strain');
  if (strains.length > 0) {
    result = result.filter((nano) => nano.strain !== null && strains.includes(nano.strain));
  }
  const qlMin = query.get('ql_min');
  if (qlMin) result = result.filter((nano) => nano.ql >= Number(qlMin));
  const qlMax = query.get('ql_max');
  if (qlMax) result = result.filter((nano) => nano.ql <= Number(qlMax));
  const levelMin = query.get('level_min');
  if (levelMin) result = result.filter((nano) => nano.level !== null && nano.level >= +levelMin);
  const levelMax = query.get('level_max');
  if (levelMax) result = result.filter((nano) => nano.level !== null && nano.level <= +levelMax);

  if (path === '/nanos') {
    const descending = query.get('sort_desc') === 'true';
    const sortBy = query.get('sort_by') ?? 'name';
    const direction = descending ? -1 : 1;
    result.sort((a, b) => {
      let comparison: number;
      if (sortBy === 'level') {
        // Nulls last in both directions
        if (a.level === null || b.level === null) return compareNullsLast(a.level, b.level);
        comparison = (a.level - b.level) * direction;
      } else if (sortBy === 'ql') {
        comparison = (a.ql - b.ql) * direction;
      } else {
        comparison = a.name.localeCompare(b.name) * direction;
      }
      return comparison || a.id - b.id;
    });
  } else {
    result.sort((a, b) => a.id - b.id);
  }

  const page = Number(query.get('page') ?? 1);
  const pageSize = Number(query.get('page_size') ?? 50);
  const total = result.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return {
    items: result.slice((page - 1) * pageSize, page * pageSize),
    total,
    page,
    page_size: pageSize,
    pages,
    has_next: page < pages,
    has_prev: page > 1,
  };
}

/**
 * Make the mocked apiClient.getPaginated answer nano requests from `nanos`.
 * getPaginated is generic over the item type; the fake always answers with
 * backend nanos.
 */
export function serveNanos(
  getPaginated: typeof import('@/services/api-client').apiClient.getPaginated,
  nanos: BackendNano[]
): void {
  vi.mocked(getPaginated).mockImplementation(<T>(url: string) =>
    Promise.resolve(
      answerNanoRequest(nanos, url) as PaginatedResponse<unknown> as PaginatedResponse<T>
    )
  );
}

/** The query of every nano request made so far, in order */
export function nanoRequests(
  getPaginated: typeof import('@/services/api-client').apiClient.getPaginated
): { path: string; params: URLSearchParams }[] {
  return vi.mocked(getPaginated).mock.calls.map(([url]) => {
    const [path, query] = String(url).split('?');
    return { path, params: new URLSearchParams(query) };
  });
}
