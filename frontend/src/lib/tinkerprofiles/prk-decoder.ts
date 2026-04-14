import pako from 'pako';

export const PRK_PREFIX = 'PRK1:';

/** Raw item entry from PRK export */
export interface PRKItem {
  sl: number;  // slot index
  id: number;  // AOID (HighTemplateId)
  ql: number;  // quality level
}

/** Raw PRK export payload after JSON decode */
export interface PRKPayload {
  n: string;     // name
  l: number;     // level
  p: number;     // profession ID
  b: number;     // breed ID
  f: number;     // faction/side
  al: number;    // alien level
  s: Record<string, number>;  // stat ID -> base value
  e: PRKItem[];  // equipment (weapons/HUDs/utils)
  a: PRKItem[];  // armor
  i: PRKItem[];  // implants
  pk: number[];  // perk AOIDs
  na: number[];  // active nano AOIDs
}

export function isPRKFormat(data: string): boolean {
  return data.trimStart().startsWith(PRK_PREFIX);
}

export function decodePRK(data: string): PRKPayload {
  const trimmed = data.trim();
  if (!trimmed.startsWith(PRK_PREFIX)) {
    throw new Error('Invalid PRK export string: missing PRK1: prefix');
  }

  const base64 = trimmed.slice(PRK_PREFIX.length);
  const compressed = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const jsonBytes = pako.inflateRaw(compressed);
  const json = new TextDecoder().decode(jsonBytes);

  return JSON.parse(json) as PRKPayload;
}
