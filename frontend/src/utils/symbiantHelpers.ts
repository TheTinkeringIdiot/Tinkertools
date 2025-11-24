import type { Symbiant } from '@/types/api';

// Helper functions for working with symbiant data
export function getSymbiantDisplayName(symbiant: Symbiant): string {
  if (symbiant.name) return symbiant.name;
  if (symbiant.family) return `${symbiant.family} Symbiant`;
  return `Symbiant ${symbiant.aoid || symbiant.id}`;
}

export function getSymbiantSlotId(symbiant: Symbiant): number {
  if (symbiant.slot_id !== undefined) return symbiant.slot_id;

  // Generate placeholder slot_id based on id
  return (symbiant.id || 0) % 10;
}

export function getSymbiantQL(symbiant: Symbiant): number {
  if (symbiant.ql) return symbiant.ql;

  // Generate placeholder QL between 50-300
  return 50 + ((symbiant.id || 0) % 251);
}

export function getSymbiantFamily(symbiant: Symbiant): 'Artillery' | 'Control' | 'Extermination' | 'Infantry' | 'Support' {
  if (symbiant.family) return symbiant.family;

  // Generate placeholder families
  const families: Array<'Artillery' | 'Control' | 'Extermination' | 'Infantry' | 'Support'> =
    ['Artillery', 'Control', 'Extermination', 'Infantry', 'Support'];
  const index = (symbiant.id || 0) % families.length;
  return families[index];
}

// Create enriched symbiant with display-friendly data
export function enrichSymbiant(symbiant: Symbiant): Symbiant {
  return {
    ...symbiant,
    name: getSymbiantDisplayName(symbiant),
    slot_id: getSymbiantSlotId(symbiant),
    ql: getSymbiantQL(symbiant),
    family: getSymbiantFamily(symbiant),
  };
}
