/**
 * API location configuration.
 *
 * The backend serves every game version under the same root:
 *   <API_ROOT>/<version-slug>/items/...   (version-scoped)
 *   <API_ROOT>/versions                   (cross-version)
 *
 * Everything that talks to the backend must build URLs through these helpers
 * so the selected game version is applied consistently.
 */

export const API_ROOT: string = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'
).replace(/\/+$/, '');

/** Base URL for version-scoped endpoints. Without a version, the backend's default is served. */
export function apiBaseFor(versionSlug: string | null | undefined): string {
  return versionSlug ? `${API_ROOT}/${encodeURIComponent(versionSlug)}` : API_ROOT;
}
