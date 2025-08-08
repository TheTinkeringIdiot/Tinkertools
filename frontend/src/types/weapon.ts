/**
 * Types for TinkerFite weapon management and skill-based filtering
 */

export interface StatValue {
  id: number
  stat: number
  value: number
}

export interface Weapon {
  id: number
  aoid: number
  name: string
  ql: number
  item_class: number
  description?: string
  is_nano: boolean
  stats: StatValue[]
  attack_stats: StatValue[]
  defense_stats: StatValue[]
  spells: any[] // Will define spell type later if needed
}

export interface CharacterSkills {
  [skillId: number]: number
}

export interface WeaponRequirement {
  stat: number
  statName: string
  value: number
  met: boolean
  characterValue?: number
}

export interface WeaponUsability {
  canUse: boolean
  requirements: WeaponRequirement[]
  missingRequirements: WeaponRequirement[]
}

export interface WeaponFilters {
  weaponTypes: number[]
  qualityLevels: number[]
  usableOnly: boolean
  sortBy: string
  sortDescending: boolean
}

export interface WeaponSearchRequest {
  query?: string
  filters?: Partial<WeaponFilters>
  characterSkills?: CharacterSkills
}

export interface WeaponApiResponse {
  items: Weapon[]
  total: number
  page: number
  page_size: number
  pages: number
  has_next: boolean
  has_prev: boolean
}

// Anarchy Online skill mappings (stat IDs to skill names)
export const SKILL_NAMES: Record<number, string> = {
  // Main stats
  16: 'Strength',
  17: 'Stamina', 
  18: 'Agility',
  19: 'Sense',
  20: 'Intelligence',
  21: 'Psychic',
  
  // Weapon skills
  100: '1h Blunt',
  101: '1h Edged',
  102: '2h Blunt', 
  103: '2h Edged',
  104: 'Pistol',
  105: 'Bow',
  106: 'Thrown Grips',
  107: 'Assault Rifle',
  108: 'SMG',
  109: 'Rifle',
  110: 'Shotgun',
  111: 'Heavy Weapons',
  112: 'Piercing',
  113: 'Multi Melee',
  114: 'Multi Ranged',
  
  // Other common requirements
  54: 'Level',
  152: 'Martial Arts',
  
  // Add more as discovered in the data
}

// Weapon type classifications
export const WEAPON_TYPES: Record<number, string> = {
  1: 'Weapon',
  2: 'Armor',
  3: 'Implant',
  4: 'Template',
  5: 'Spirit', 
  // Add more weapon sub-types as needed
}

// Quality level ranges for filtering
export const QUALITY_RANGES = [
  { label: 'Low (1-50)', min: 1, max: 50 },
  { label: 'Medium (51-100)', min: 51, max: 100 },
  { label: 'High (101-200)', min: 101, max: 200 },
  { label: 'Premium (201-300)', min: 201, max: 300 },
]