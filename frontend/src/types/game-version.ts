/**
 * Game version (database snapshot) types.
 * Mirrors backend/app/api/schemas/versions.py.
 */

export type GameVersionFamily = 'ao' | 'prk' | string;

export interface GameVersionFeatures {
  items?: boolean;
  nanos?: boolean;
  perks?: boolean;
  symbiants?: boolean;
  sources?: boolean;
  [feature: string]: boolean | undefined;
}

export interface GameVersion {
  slug: string;
  display_name: string;
  family: GameVersionFamily;
  parent_slug: string | null;
  client_build: string | null;
  snapshot_date: string | null;
  sort_order: number;
  enabled: boolean;
  is_default: boolean;
  features: GameVersionFeatures;
  notes: string | null;
  is_current: boolean;
}

export interface GameVersionListResponse {
  versions: GameVersion[];
  current: string;
  total: number;
}

export type ItemRevisionChange = 'stats' | 'spells' | 'actions' | 'text';

export interface ItemRevisionPoint {
  version_slug: string;
  display_name: string;
  family: GameVersionFamily;
  snapshot_date: string | null;
  client_build: string | null;
  changed: ItemRevisionChange[];
  first_seen: boolean;
}

export interface ItemRevisionsResponse {
  aoid: number;
  present_in: string[];
  first_seen_in: string | null;
  revisions: ItemRevisionPoint[];
  missing_in: string[];
}

export interface ItemRevisionBatchEntry {
  aoid: number;
  revision_count: number;
  latest_change_slug: string | null;
  present_in_current: boolean;
}

export interface ItemRevisionsBatchResponse {
  items: Record<number, ItemRevisionBatchEntry>;
}
