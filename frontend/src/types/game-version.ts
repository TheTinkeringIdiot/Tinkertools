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
  /**
   * Set on a family alias ('ao', 'prk'): the build it follows right now. An
   * alias is what URLs, the remembered version and profiles point at so they
   * move with the game; data is always requested and cached under the build.
   */
  alias_of?: string | null;
}

export interface GameVersionListResponse {
  versions: GameVersion[];
  current: string;
  total: number;
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
