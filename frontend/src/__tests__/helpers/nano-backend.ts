/**
 * A fake of the backend's /nanos and /nanos/search endpoints, for tests that
 * mock the API client: it filters, sorts and pages a fixed nano list the way
 * the backend does, so a test can assert both on what was requested and on
 * what the user then sees.
 *
 * Mirrors backend/app/api/routes/nanos.py:
 * - school, profession and strain (NanoStrain IDs) repeat and match any value
 * - profession also matches nanos anyone can cast (no professions, a level)
 * - level_min / level_max leave out nanos without a level
 * - both sort by sort_by (nulls last) and sort_desc, with id as the tie-break
 * - /nanos/strains counts the strains of what the other filters match
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
  strain_id: number | null;
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
    strain_id: null,
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

/** The nanos every filter but strain matches (q only when given) */
function matchFilters(nanos: BackendNano[], query: URLSearchParams): BackendNano[] {
  let result = [...nanos];

  const q = (query.get('q') ?? '').toLowerCase();
  if (q) {
    result = result.filter(
      (nano) =>
        nano.name.toLowerCase().includes(q) || (nano.description ?? '').toLowerCase().includes(q)
    );
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
  const qlMin = query.get('ql_min');
  if (qlMin) result = result.filter((nano) => nano.ql >= Number(qlMin));
  const qlMax = query.get('ql_max');
  if (qlMax) result = result.filter((nano) => nano.ql <= Number(qlMax));
  const levelMin = query.get('level_min');
  if (levelMin) result = result.filter((nano) => nano.level !== null && nano.level >= +levelMin);
  const levelMax = query.get('level_max');
  if (levelMax) result = result.filter((nano) => nano.level !== null && nano.level <= +levelMax);
  return result;
}

/** Answer one /nanos or /nanos/search request URL (path plus query) */
export function answerNanoRequest(
  nanos: BackendNano[],
  url: string
): PaginatedResponse<BackendNano> {
  const [path, queryString] = url.split('?');
  const query = new URLSearchParams(queryString);
  if (path !== '/nanos' && path !== '/nanos/search') {
    throw new Error(`Unexpected nano request ${url}`);
  }
  if (path === '/nanos/search' && !query.get('q')) throw new Error('/nanos/search needs q');

  let result = matchFilters(nanos, query);
  const strains = query.getAll('strain').map(Number);
  if (strains.length > 0) {
    result = result.filter((nano) => nano.strain_id !== null && strains.includes(nano.strain_id));
  }

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

/** Answer a /nanos/strains request URL */
export function answerStrainRequest(nanos: BackendNano[], url: string): NanoStrainsResponse {
  const query = new URLSearchParams(url.split('?')[1]);
  const counts = new Map<number, { id: number; name: string | null; count: number }>();
  for (const nano of matchFilters(nanos, query)) {
    if (nano.strain_id === null) continue;
    const entry = counts.get(nano.strain_id) ?? {
      id: nano.strain_id,
      name: nano.strain,
      count: 0,
    };
    entry.count += 1;
    counts.set(nano.strain_id, entry);
  }
  const strains = [...counts.values()].sort(
    (a, b) =>
      Number(a.name === null) - Number(b.name === null) ||
      (a.name ?? '').localeCompare(b.name ?? '') ||
      a.id - b.id
  );
  return { strains };
}

interface NanoStrainsResponse {
  strains: { id: number; name: string | null; count: number }[];
}

type MockedApi = Pick<typeof import('@/services/api-client').apiClient, 'getPaginated' | 'get'>;

/**
 * Make the mocked API client answer nano requests from `nanos`: getPaginated
 * the /nanos endpoints, get /nanos/strains. Both are generic over the
 * response type; the fake always answers with backend nanos and strains.
 */
export function serveNanos(api: MockedApi, nanos: BackendNano[]): void {
  vi.mocked(api.getPaginated).mockImplementation(<T>(url: string) =>
    Promise.resolve(
      answerNanoRequest(nanos, url) as PaginatedResponse<unknown> as PaginatedResponse<T>
    )
  );
  vi.mocked(api.get).mockImplementation(<T>(url: string) => {
    if (!url.startsWith('/nanos/strains')) return Promise.reject(new Error(`Unexpected ${url}`));
    return Promise.resolve({
      success: true,
      data: answerStrainRequest(nanos, url) as unknown as T,
    });
  });
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
