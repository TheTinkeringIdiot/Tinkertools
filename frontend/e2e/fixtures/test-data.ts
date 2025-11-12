/**
 * Test Data Fixtures for E2E Tests
 *
 * Provides realistic test data for profiles, items, and other entities
 */

export const testProfiles = {
  enforcer: {
    name: 'TestEnforcer',
    level: 220,
    profession: 'Enforcer',
    breed: 'Atrox',
  },
  doctor: {
    name: 'TestDoctor',
    level: 200,
    profession: 'Doctor',
    breed: 'Nanomage',
  },
  trader: {
    name: 'TestTrader',
    level: 150,
    profession: 'Trader',
    breed: 'Opifex',
  },
};

export const testItems = {
  weapon: {
    name: 'Kyr\'Ozch Energy Rapier',
    aoid: 275634,
  },
  armor: {
    name: 'Visible OT Aban Helmet',
    aoid: 251695,
  },
  implant: {
    name: 'Aban',
    ql: 300,
  },
};

export const testBuffs = {
  wrangle: {
    name: 'Wrangle',
    type: 'nano',
  },
  composite: {
    name: 'Composite Attribute',
    type: 'nano',
  },
};

export const professions = [
  'Adventurer',
  'Agent',
  'Bureaucrat',
  'Doctor',
  'Enforcer',
  'Engineer',
  'Fixer',
  'Keeper',
  'Martial Artist',
  'Meta-Physicist',
  'Nano-Technician',
  'Shade',
  'Soldier',
  'Trader',
];

export const breeds = [
  'Atrox',
  'Nanomage',
  'Opifex',
  'Solitus',
];

export const equipmentSlots = [
  'head',
  'neck',
  'back',
  'shoulder',
  'chest',
  'arms',
  'wrists',
  'hands',
  'waist',
  'legs',
  'feet',
  'finger1',
  'finger2',
  'weapon1',
  'weapon2',
  'util1',
  'util2',
  'util3',
];

export const implantSlots = [
  'head',
  'eye',
  'ear',
  'chest',
  'waist',
  'leg',
  'right-arm',
  'left-arm',
  'right-wrist',
  'left-wrist',
  'right-hand',
  'left-hand',
  'feet',
];
