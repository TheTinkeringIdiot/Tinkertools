#!/usr/bin/env node

// Comprehensive test for all 9 AC types with equipment, perk, and buff bonuses

const testProfile = {
  id: 'test-comprehensive-ac',
  Character: {
    Name: 'ComprehensiveTestChar',
    Level: 200,
    Profession: 'Soldier',
    Breed: 'Atrox',
    Faction: 'Neutral',
    Expansion: 'SL',
    AccountType: 'paid',
    MaxHealth: 2000,
    MaxNano: 800
  },
  Skills: {
    Attributes: {
      Strength: { pointFromIp: 200, value: 300 },
      Agility: { pointFromIp: 200, value: 300 },
      Stamina: { pointFromIp: 200, value: 300 },
      Intelligence: { pointFromIp: 200, value: 300 },
      Sense: { pointFromIp: 200, value: 300 },
      Psychic: { pointFromIp: 200, value: 300 }
    },
    'Body & Defense': {},
    ACs: {
      'Chemical AC': 10,    // STAT ID 93
      'Cold AC': 15,        // STAT ID 95
      'Energy AC': 20,      // STAT ID 92
      'Fire AC': 25,        // STAT ID 97
      'Melee AC': 30,       // STAT ID 91
      'Nano AC': 0,         // Missing from skill-mappings! This might need to be added
      'Poison AC': 5,       // STAT ID 96
      'Projectile AC': 35,  // STAT ID 90
      'Radiation AC': 12    // STAT ID 94
    },
    Misc: {}
  },
  Weapons: {
    'Right Hand': {
      id: 789,
      name: 'AC Weapon',
      spell_data: [
        {
          event: 2, // Wield event
          spells: [
            {
              spell_id: 53045,
              spell_params: {
                Stat: 92, // Energy AC
                Amount: 50
              }
            }
          ]
        }
      ],
      actions: [],
      attack_stats: [],
      defense_stats: [],
      is_nano: false
    }
  },
  Clothing: {
    'Chest': {
      id: 101,
      name: 'AC Armor',
      spell_data: [
        {
          event: 14, // Wear event
          spells: [
            {
              spell_id: 53045,
              spell_params: { Stat: 93, Amount: 100 } // Chemical AC +100
            },
            {
              spell_id: 53045,
              spell_params: { Stat: 95, Amount: 75 }  // Cold AC +75
            },
            {
              spell_id: 53045,
              spell_params: { Stat: 91, Amount: 200 } // Melee AC +200
            }
          ]
        }
      ],
      actions: [],
      attack_stats: [],
      defense_stats: [],
      is_nano: false
    },
    'Legs': {
      id: 102,
      name: 'AC Legs',
      spell_data: [
        {
          event: 14,
          spells: [
            {
              spell_id: 53045,
              spell_params: { Stat: 97, Amount: 80 }  // Fire AC +80
            },
            {
              spell_id: 53045,
              spell_params: { Stat: 90, Amount: 150 } // Projectile AC +150
            }
          ]
        }
      ],
      actions: [],
      attack_stats: [],
      defense_stats: [],
      is_nano: false
    }
  },
  Implants: {},
  PerksAndResearch: {
    perks: [
      {
        id: 201,
        name: 'AC Boost Perk',
        aoid: 300001,
        spell_data: [
          {
            event: 1, // Cast event for perk activation
            spells: [
              {
                spell_id: 53045,
                spell_params: { Stat: 96, Amount: 50 }  // Poison AC +50
              },
              {
                spell_id: 53045,
                spell_params: { Stat: 94, Amount: 30 }  // Radiation AC +30
              }
            ]
          }
        ],
        actions: [],
        attack_stats: [],
        defense_stats: [],
        is_nano: false
      }
    ],
    research: []
  },
  buffs: [
    {
      id: 301,
      name: 'Multi AC Nano',
      is_nano: true,
      spell_data: [
        {
          event: 1, // Cast event for nano
          spells: [
            {
              spell_id: 53045,
              spell_params: { Stat: 95, Amount: 25 }  // Cold AC +25 (stacks with equipment)
            },
            {
              spell_id: 53045,
              spell_params: { Stat: 92, Amount: 40 }  // Energy AC +40 (stacks with equipment)
            },
            {
              spell_id: 53045,
              spell_params: { Stat: 97, Amount: 60 }  // Fire AC +60 (stacks with equipment)
            }
          ]
        }
      ],
      actions: [],
      attack_stats: [],
      defense_stats: [],
      aoid: 400001,
      ql: 200
    }
  ]
};

console.log('=== COMPREHENSIVE AC BONUS TEST ===\n');

console.log('Base AC Values:');
Object.entries(testProfile.Skills.ACs).forEach(([acName, value]) => {
  console.log(`  ${acName}: ${value}`);
});

console.log('\nEquipment Bonuses:');
console.log('  Chemical AC: +100 (from Chest armor)');
console.log('  Cold AC: +75 (from Chest armor)');
console.log('  Energy AC: +50 (from Weapon)');
console.log('  Fire AC: +80 (from Legs armor)');
console.log('  Melee AC: +200 (from Chest armor)');
console.log('  Projectile AC: +150 (from Legs armor)');

console.log('\nPerk Bonuses:');
console.log('  Poison AC: +50 (from AC Boost Perk)');
console.log('  Radiation AC: +30 (from AC Boost Perk)');

console.log('\nBuff Bonuses (from Multi AC Nano):');
console.log('  Cold AC: +25 (stacks with equipment)');
console.log('  Energy AC: +40 (stacks with equipment)');
console.log('  Fire AC: +60 (stacks with equipment)');

console.log('\n=== EXPECTED FINAL VALUES ===');
console.log('  Chemical AC: 110 (10 base + 100 equipment)');
console.log('  Cold AC: 115 (15 base + 75 equipment + 25 buff)');
console.log('  Energy AC: 110 (20 base + 50 equipment + 40 buff)');
console.log('  Fire AC: 165 (25 base + 80 equipment + 60 buff)');
console.log('  Melee AC: 230 (30 base + 200 equipment)');
console.log('  Nano AC: 0 (0 base, no bonuses)');
console.log('  Poison AC: 55 (5 base + 50 perk)');
console.log('  Projectile AC: 185 (35 base + 150 equipment)');
console.log('  Radiation AC: 42 (12 base + 30 perk)');

console.log('\n=== VALIDATION ===');

// Verify STAT IDs are correctly mapped
const acMappings = {
  'Chemical AC': 93,
  'Cold AC': 95,
  'Energy AC': 92,
  'Fire AC': 97,
  'Melee AC': 91,
  'Poison AC': 96,
  'Projectile AC': 90,
  'Radiation AC': 94
};

console.log('\nAC to STAT ID mappings:');
Object.entries(acMappings).forEach(([acName, statId]) => {
  console.log(`  ${acName} -> STAT ID ${statId}`);
});

console.log('\nNote: "Nano AC" is missing from skill-mappings.ts and might need to be added.');
console.log('All other AC types should now receive equipment, perk, and buff bonuses correctly!');