import type { Symbiant } from '@/types/api';

// Helper functions for working with symbiant data
export function getSymbiantDisplayName(symbiant: Symbiant): string {
  if (symbiant.name) return symbiant.name;
  if (symbiant.family) return `${symbiant.family} Symbiant`;
  return `Symbiant ${symbiant.aoid || symbiant.id}`;
}

export function getSymbiantSlot(symbiant: Symbiant): string {
  if (symbiant.slot) return symbiant.slot;
  
  // Generate placeholder slots based on family or id
  const slotTypes = ['Head', 'Eye', 'Ear', 'Chest', 'Arm', 'Wrist', 'Hand', 'Waist', 'Leg', 'Feet'];
  const index = (symbiant.id || 0) % slotTypes.length;
  return slotTypes[index];
}

export function getSymbiantQL(symbiant: Symbiant): number {
  if (symbiant.ql) return symbiant.ql;
  
  // Generate placeholder QL between 50-300
  return 50 + ((symbiant.id || 0) % 251);
}

export function getSymbiantFamily(symbiant: Symbiant): string {
  if (symbiant.family) return symbiant.family;
  
  // Generate placeholder families
  const families = ['Artillery', 'Control', 'Exterminator', 'Infantry', 'Support'];
  const index = (symbiant.id || 0) % families.length;
  return families[index];
}

// Create enriched symbiant with display-friendly data
export function enrichSymbiant(symbiant: Symbiant): Symbiant {
  return {
    ...symbiant,
    name: getSymbiantDisplayName(symbiant),
    slot: getSymbiantSlot(symbiant),
    ql: getSymbiantQL(symbiant),
    family: getSymbiantFamily(symbiant)
  };
}