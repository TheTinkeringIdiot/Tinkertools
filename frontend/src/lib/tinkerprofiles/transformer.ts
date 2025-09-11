/**
 * TinkerProfiles Transformer
 * 
 * Transforms profiles between different formats:
 * - Full TinkerProfile ↔ NanoCompatibleProfile
 * - JSON export/import formats
 * - Legacy format migrations
 */

import type { 
  TinkerProfile, 
  NanoCompatibleProfile,
  ProfileExportFormat,
  ProfileImportResult
} from './types';
import { createDefaultProfile, createDefaultNanoProfile } from './constants';
import { SKILL_CATEGORIES, getSkillId } from './skill-mappings';

export class ProfileTransformer {
  
  // ============================================================================
  // Profile Format Transformations
  // ============================================================================
  
  /**
   * Convert TinkerProfile to NanoCompatibleProfile
   */
  toNanoCompatible(profile: TinkerProfile): NanoCompatibleProfile {
    const nanoProfile: NanoCompatibleProfile = {
      id: profile.id,
      name: profile.Character.Name,
      profession: profile.Character.Profession,
      level: profile.Character.Level,
      skills: {},
      stats: {},
      activeNanos: [],
      memoryCapacity: 500, // Default value
      nanoPoints: 1000 // Default value
    };
    
    // Map attributes to stats
    if (profile.Skills.Attributes) {
      nanoProfile.stats = {
        'Strength': profile.Skills.Attributes.Strength?.value || 10,
        'Stamina': profile.Skills.Attributes.Stamina?.value || 10,
        'Agility': profile.Skills.Attributes.Agility?.value || 10,
        'Sense': profile.Skills.Attributes.Sense?.value || 10,
        'Intelligence': profile.Skills.Attributes.Intelligence?.value || 10,
        'Psychic': profile.Skills.Attributes.Psychic?.value || 10
      };
    }
    
    // Map nano schools and relevant skills
    if (profile.Skills['Nanos & Casting']) {
      const nanoCasting = profile.Skills['Nanos & Casting'];
      nanoProfile.skills['Biological Metamorphosis'] = nanoCasting['Bio Metamor']?.value || 1;
      nanoProfile.skills['Matter Creation'] = nanoCasting['Matter Crea']?.value || 1;
      nanoProfile.skills['Matter Metamorphosis'] = nanoCasting['Matt. Metam']?.value || 1;
      nanoProfile.skills['Psychological Modifications'] = nanoCasting['Psycho Modi']?.value || 1;
      nanoProfile.skills['Sensory Improvement'] = nanoCasting['Sensory Impr']?.value || 1;
      nanoProfile.skills['Time and Space'] = nanoCasting['Time&Space']?.value || 1;
    }
    
    // Map core skills
    if (profile.Skills['Trade & Repair']) {
      nanoProfile.skills['Nano Programming'] = profile.Skills['Trade & Repair']['Nano Progra']?.value || 1;
      nanoProfile.skills['Computer Literacy'] = profile.Skills['Trade & Repair']['Comp. Liter']?.value || 1;
      nanoProfile.skills['Tutoring'] = profile.Skills['Trade & Repair']['Tutoring']?.value || 1;
    }
    
    if (profile.Skills['Combat & Healing']) {
      nanoProfile.skills['First Aid'] = profile.Skills['Combat & Healing']['First Aid']?.value || 1;
      nanoProfile.skills['Treatment'] = profile.Skills['Combat & Healing']['Treatment']?.value || 1;
    }
    
    // Estimate memory capacity based on level and profession
    nanoProfile.memoryCapacity = this.estimateMemoryCapacity(profile.Character.Level, profile.Character.Profession);
    
    // Estimate nano points based on level and intelligence
    const intel = profile.Skills.Attributes?.Intelligence?.value || 10;
    nanoProfile.nanoPoints = this.estimateNanoPoints(profile.Character.Level, intel);
    
    return nanoProfile;
  }
  
  /**
   * Convert NanoCompatibleProfile to TinkerProfile
   */
  fromNanoCompatible(nanoProfile: NanoCompatibleProfile): TinkerProfile {
    const profile = createDefaultProfile(nanoProfile.name);
    
    // Update basic character info
    profile.Character.Name = nanoProfile.name;
    profile.Character.Profession = nanoProfile.profession;
    profile.Character.Level = nanoProfile.level;
    
    // Map stats to attributes
    if (nanoProfile.stats) {
      profile.Skills.Attributes.Strength.value = nanoProfile.stats.Strength || 10;
      profile.Skills.Attributes.Stamina.value = nanoProfile.stats.Stamina || 10;
      profile.Skills.Attributes.Agility.value = nanoProfile.stats.Agility || 10;
      profile.Skills.Attributes.Sense.value = nanoProfile.stats.Sense || 10;
      profile.Skills.Attributes.Intelligence.value = nanoProfile.stats.Intelligence || 10;
      profile.Skills.Attributes.Psychic.value = nanoProfile.stats.Psychic || 10;
    }
    
    // Map nano skills
    if (nanoProfile.skills) {
      if (nanoProfile.skills['Biological Metamorphosis']) {
        profile.Skills['Nanos & Casting']['Bio Metamor'].value = nanoProfile.skills['Biological Metamorphosis'];
      }
      if (nanoProfile.skills['Matter Creation']) {
        profile.Skills['Nanos & Casting']['Matter Crea'].value = nanoProfile.skills['Matter Creation'];
      }
      if (nanoProfile.skills['Matter Metamorphosis']) {
        profile.Skills['Nanos & Casting']['Matt. Metam'].value = nanoProfile.skills['Matter Metamorphosis'];
      }
      if (nanoProfile.skills['Psychological Modifications']) {
        profile.Skills['Nanos & Casting']['Psycho Modi'].value = nanoProfile.skills['Psychological Modifications'];
      }
      if (nanoProfile.skills['Sensory Improvement']) {
        profile.Skills['Nanos & Casting']['Sensory Impr'].value = nanoProfile.skills['Sensory Improvement'];
      }
      if (nanoProfile.skills['Time and Space']) {
        profile.Skills['Nanos & Casting']['Time&Space'].value = nanoProfile.skills['Time and Space'];
      }
      
      // Map other skills
      if (nanoProfile.skills['Nano Programming']) {
        profile.Skills['Trade & Repair']['Nano Progra'].value = nanoProfile.skills['Nano Programming'];
      }
      if (nanoProfile.skills['Computer Literacy']) {
        profile.Skills['Trade & Repair']['Comp. Liter'].value = nanoProfile.skills['Computer Literacy'];
      }
      if (nanoProfile.skills['Tutoring']) {
        profile.Skills['Trade & Repair']['Tutoring'].value = nanoProfile.skills['Tutoring'];
      }
      if (nanoProfile.skills['First Aid']) {
        profile.Skills['Combat & Healing']['First Aid'].value = nanoProfile.skills['First Aid'];
      }
      if (nanoProfile.skills['Treatment']) {
        profile.Skills['Combat & Healing']['Treatment'].value = nanoProfile.skills['Treatment'];
      }
    }
    
    return profile;
  }
  
  // ============================================================================
  // Export/Import Transformations
  // ============================================================================
  
  /**
   * Export profile in specified format
   */
  exportProfile(profile: TinkerProfile, format: ProfileExportFormat = 'json'): string {
    switch (format) {
      case 'json':
        return JSON.stringify(profile, null, 2);
        
      case 'legacy':
        return this.exportLegacyFormat(profile);
        
      case 'anarchy_online':
        return this.exportAOFormat(profile);
        
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }
  
  /**
   * Import profile from various formats
   */
  importProfile(data: string, sourceFormat?: string): ProfileImportResult {
    const result: ProfileImportResult = {
      success: false,
      errors: [],
      warnings: [],
      metadata: {
        source: 'unknown',
        migrated: false
      }
    };
    
    try {
      // Try to detect format if not specified
      const detectedFormat = sourceFormat || this.detectFormat(data);
      result.metadata.source = detectedFormat;
      result.metadata.originalFormat = detectedFormat;
      
      let profile: TinkerProfile;
      
      switch (detectedFormat) {
        case 'json':
          profile = this.importFromJSON(data, result);
          break;
          
        case 'legacy':
          profile = this.importFromLegacy(data, result);
          break;
          
        case 'anarchy_online':
          profile = this.importFromAO(data, result);
          break;
          
        case 'aosetups':
          profile = this.importFromAOSetups(data, result);
          break;
          
        default:
          result.errors.push('Unable to detect or unsupported format');
          return result;
      }
      
      result.profile = profile;
      result.success = true;
      
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Import failed');
    }
    
    return result;
  }
  
  // ============================================================================
  // Format-Specific Import/Export
  // ============================================================================
  
  private exportLegacyFormat(profile: TinkerProfile): string {
    // Export in the legacy TinkerProfiles format
    const legacy = {
      character: {
        name: profile.Character.Name,
        level: profile.Character.Level,
        profession: profile.Character.Profession,
        breed: profile.Character.Breed,
        faction: profile.Character.Faction
      },
      skills: profile.Skills,
      equipment: {
        weapons: profile.Weapons,
        clothing: profile.Clothing,
        implants: profile.Implants
      },
      metadata: {
        created: profile.created,
        version: profile.version
      }
    };
    
    return JSON.stringify(legacy, null, 2);
  }
  
  private exportAOFormat(profile: TinkerProfile): string {
    // Export in a format similar to Anarchy Online's character export
    const aoFormat = {
      CharacterName: profile.Character.Name,
      Level: profile.Character.Level,
      Profession: profile.Character.Profession,
      Breed: profile.Character.Breed,
      Faction: profile.Character.Faction,
      Skills: this.flattenSkills(profile.Skills),
      Equipment: {
        ...profile.Weapons,
        ...profile.Clothing,
        ...profile.Implants
      }
    };
    
    return JSON.stringify(aoFormat, null, 2);
  }
  
  private importFromJSON(data: string, result: ProfileImportResult): TinkerProfile {
    const parsed = JSON.parse(data);
    
    // Check if it's already a valid TinkerProfile
    if (this.isValidTinkerProfile(parsed)) {
      // Generate new ID and timestamps for imported profile
      const importedProfile = structuredClone(parsed);
      importedProfile.id = `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      importedProfile.created = new Date().toISOString();
      importedProfile.updated = new Date().toISOString();
      return importedProfile;
    }
    
    // Try to convert from other JSON formats
    return this.convertToTinkerProfile(parsed, result);
  }
  
  private importFromLegacy(data: string, result: ProfileImportResult): TinkerProfile {
    const legacy = JSON.parse(data);
    result.metadata.migrated = true;
    
    const profile = createDefaultProfile();
    
    if (legacy.character) {
      profile.Character.Name = legacy.character.name || 'Imported Character';
      profile.Character.Level = legacy.character.level || 1;
      profile.Character.Profession = legacy.character.profession || 'Adventurer';
      profile.Character.Breed = legacy.character.breed || 'Solitus';
      profile.Character.Faction = legacy.character.faction || 'Neutral';
    }
    
    if (legacy.skills) {
      profile.Skills = { ...profile.Skills, ...legacy.skills };
    }
    
    if (legacy.equipment) {
      if (legacy.equipment.weapons) profile.Weapons = legacy.equipment.weapons;
      if (legacy.equipment.clothing) profile.Clothing = legacy.equipment.clothing;
      if (legacy.equipment.implants) profile.Implants = legacy.equipment.implants;
    }
    
    result.warnings.push('Profile migrated from legacy format');
    
    return profile;
  }
  
  private importFromAO(data: string, result: ProfileImportResult): TinkerProfile {
    const ao = JSON.parse(data);
    result.metadata.migrated = true;
    
    const profile = createDefaultProfile();
    
    profile.Character.Name = ao.CharacterName || 'AO Import';
    profile.Character.Level = ao.Level || 1;
    profile.Character.Profession = ao.Profession || 'Adventurer';
    profile.Character.Breed = ao.Breed || 'Solitus';
    profile.Character.Faction = ao.Faction || 'Neutral';
    
    if (ao.Skills) {
      // Unflatten skills back to categorized structure
      this.unflattenSkills(ao.Skills, profile.Skills);
    }
    
    result.warnings.push('Profile imported from Anarchy Online format');
    
    return profile;
  }
  
  private importFromAOSetups(data: string, result: ProfileImportResult): TinkerProfile {
    const aosetups = JSON.parse(data);
    result.metadata.migrated = true;
    
    const profile = createDefaultProfile();
    
    // Map character data
    if (aosetups.character) {
      profile.Character.Name = aosetups.character.name || aosetups.name || 'AOSetups Import';
      profile.Character.Level = aosetups.character.level || 1;
      profile.Character.Profession = aosetups.character.profession || 'Adventurer';
      profile.Character.Breed = aosetups.character.breed || 'Solitus';
      profile.Character.Faction = 'Neutral'; // Default, not in AOSetups
      profile.Character.Expansion = 'Lost Eden'; // Default
      profile.Character.AccountType = 'Paid'; // Default
      
      // Calculate base health and nano based on breed and level
      const level = profile.Character.Level;
      const healthPerLevel = profile.Character.Breed === 'Atrox' ? 10 : 
                           profile.Character.Breed === 'Opifex' ? 6 : 8;
      const nanoPerLevel = profile.Character.Breed === 'Atrox' ? 4 : 
                          profile.Character.Breed === 'Opifex' ? 6 : 5;
      
      profile.Character.MaxHealth = level * healthPerLevel;
      profile.Character.MaxNano = level * nanoPerLevel;
      
      // Map skills with IP expenditure
      if (aosetups.character.skills && Array.isArray(aosetups.character.skills)) {
        for (const skill of aosetups.character.skills) {
          this.mapAOSetupsSkill(skill, profile, result);
        }
      }
    }
    
    // Map equipment (implants, weapons, clothing)
    this.mapAOSetupsEquipment(aosetups, profile, result);
    
    // Map perks to PerksAndResearch
    if (aosetups.perks && Array.isArray(aosetups.perks)) {
      profile.PerksAndResearch = aosetups.perks.map((perk: any) => ({
        id: perk.aoid?.toString() || perk._id,
        name: `Perk ${perk.aoid}`, // Would need item lookup for actual name
        type: 'perk'
      }));
    }
    
    result.warnings.push('Profile imported from AOSetups format');
    result.warnings.push('Equipment highids preserved but item names need database lookup');
    
    return profile;
  }
  
  private mapAOSetupsSkill(skill: any, profile: TinkerProfile, result: ProfileImportResult): void {
    const skillName = skill.name;
    const ipExpenditure = skill.ipExpenditure || 0;
    const pointsFromIp = skill.pointsFromIp || 0;
    
    // Check if this skill exists in SKILL_ID_MAP (now includes AOSetups variants)
    const skillId = getSkillId(skillName);
    if (!skillId) {
      result.warnings.push(`Unknown skill mapping: ${skillName}`);
      return;
    }
    
    // Find which category and key this skill belongs to using SKILL_CATEGORIES
    let foundCategory: keyof typeof profile.Skills | null = null;
    let foundKey: string | null = null;
    
    // Search through SKILL_CATEGORIES to find the skill
    for (const [category, skills] of Object.entries(SKILL_CATEGORIES)) {
      if (skills.includes(skillName)) {
        foundCategory = category as keyof typeof profile.Skills;
        foundKey = skillName;
        break;
      }
    }
    
    if (foundCategory && foundKey && profile.Skills[foundCategory]) {
      const categorySkills = profile.Skills[foundCategory] as Record<string, any>;
      if (categorySkills[foundKey]) {
        categorySkills[foundKey].ipSpent = ipExpenditure;
        categorySkills[foundKey].pointFromIp = pointsFromIp;
        // Calculate total value (base + IP points)
        categorySkills[foundKey].value = (categorySkills[foundKey].value || 0) + pointsFromIp;
      }
    } else {
      result.warnings.push(`Skill '${skillName}' not found in profile categories`);
    }
  }
  
  private mapAOSetupsEquipment(aosetups: any, profile: TinkerProfile, result: ProfileImportResult): void {
    // Map implants/symbiants
    if (aosetups.implants && Array.isArray(aosetups.implants)) {
      for (const implant of aosetups.implants) {
        if (implant && implant.slot) {
          const slotMapping: Record<string, keyof typeof profile.Implants> = {
            'head': 'Head',
            'eye': 'Eye', 
            'ear': 'Ear',
            'chest': 'Chest',
            'rarm': 'RightArm',
            'larm': 'LeftArm',
            'waist': 'Waist',
            'rwrist': 'RightWrist',
            'lwrist': 'LeftWrist',
            'leg': 'Leg',
            'rhand': 'RightHand',
            'lhand': 'LeftHand',
            'feet': 'Feet'
          };
          
          const slot = slotMapping[implant.slot];
          if (slot) {
            profile.Implants[slot] = {
              id: implant.symbiant?.highid?.toString() || implant._id,
              name: `Item ${implant.symbiant?.highid}`, // Would need item lookup
              ql: implant.symbiant?.selectedQl || implant.ql || 1,
              highId: implant.symbiant?.highid || null,
              stats: [], // Empty stats array to prevent errors
              lowId: null,
              isContainer: false
            };
          }
        }
      }
    }
    
    // Map weapons  
    if (aosetups.weapons && Array.isArray(aosetups.weapons)) {
      for (let i = 0; i < aosetups.weapons.length; i++) {
        const weapon = aosetups.weapons[i];
        if (weapon && weapon.highid) {
          const slotMapping = ['HUD1', 'HUD2', 'HUD3', 'UTILS1', 'UTILS2', 'UTILS3', 'RHand', 'Waist', 'LHand', 'NCU1', 'NCU2', 'NCU3', 'NCU4', 'NCU5', 'NCU6'];
          const slot = slotMapping[i] as keyof typeof profile.Weapons;
          if (slot) {
            profile.Weapons[slot] = {
              id: weapon.highid.toString(),
              name: `Item ${weapon.highid}`, // Would need item lookup
              ql: weapon.selectedQl || 1,
              highId: weapon.highid,
              stats: [], // Empty stats array to prevent errors
              lowId: null,
              isContainer: false
            };
          }
        }
      }
    }
    
    // Map clothing
    if (aosetups.clothes && Array.isArray(aosetups.clothes)) {
      for (const clothing of aosetups.clothes) {
        if (clothing && clothing.slot && clothing.highid) {
          const slotMapping: Record<string, keyof typeof profile.Clothing> = {
            'HEAD': 'Head',
            'BACK': 'Back', 
            'BODY': 'Body',
            'ARM_R': 'RightArm',
            'ARM_L': 'LeftArm',
            'WRIST_R': 'RightWrist',
            'WRIST_L': 'LeftWrist',
            'HANDS': 'Hands',
            'LEGS': 'Legs',
            'FEET': 'Feet',
            'SHOULDER_R': 'RightShoulder',
            'SHOULDER_L': 'LeftShoulder',
            'FINGER_R': 'RightFinger',
            'FINGER_L': 'LeftFinger',
            'NECK': 'Neck',
            'BELT': 'Belt'
          };
          
          const slot = slotMapping[clothing.slot];
          if (slot) {
            profile.Clothing[slot] = {
              id: clothing.highid.toString(),
              name: `Item ${clothing.highid}`, // Would need item lookup
              ql: clothing.selectedQl || 1,
              highId: clothing.highid,
              stats: [], // Empty stats array to prevent errors
              lowId: null,
              isContainer: false
            };
          }
        }
      }
    }
  }
  
  // ============================================================================
  // Format Detection and Validation
  // ============================================================================
  
  private detectFormat(data: string): string {
    try {
      const parsed = JSON.parse(data);
      
      // Check for TinkerProfile format
      if (parsed.Character && parsed.Skills && parsed.version) {
        return 'json';
      }
      
      // Check for AOSetups format
      if (parsed.character && parsed.implants && parsed.weapons && parsed.clothes) {
        return 'aosetups';
      }
      
      // Check for legacy format
      if (parsed.character && parsed.skills) {
        return 'legacy';
      }
      
      // Check for AO format
      if (parsed.CharacterName && parsed.Profession && parsed.Skills) {
        return 'anarchy_online';
      }
      
      return 'json'; // Default assumption
      
    } catch {
      return 'unknown';
    }
  }
  
  private isValidTinkerProfile(data: any): data is TinkerProfile {
    return !!(
      data &&
      data.id &&
      data.Character &&
      data.Character.Name &&
      data.Skills &&
      data.version
    );
  }
  
  private convertToTinkerProfile(data: any, result: ProfileImportResult): TinkerProfile {
    const profile = createDefaultProfile();
    
    // Check if this looks like an incomplete TinkerProfile
    if (data.Character && data.Skills) {
      // Copy all Character data
      if (data.Character.Name) profile.Character.Name = data.Character.Name;
      if (data.Character.Level) profile.Character.Level = data.Character.Level;
      if (data.Character.Profession) profile.Character.Profession = data.Character.Profession;
      if (data.Character.Breed) profile.Character.Breed = data.Character.Breed;
      if (data.Character.Faction) profile.Character.Faction = data.Character.Faction;
      if (data.Character.Expansion) profile.Character.Expansion = data.Character.Expansion;
      if (data.Character.AccountType) profile.Character.AccountType = data.Character.AccountType;
      
      // Copy Skills if present
      if (data.Skills) {
        profile.Skills = { ...profile.Skills, ...data.Skills };
      }
      
      // Copy Equipment if present
      if (data.Weapons) profile.Weapons = data.Weapons;
      if (data.Clothing) profile.Clothing = data.Clothing;
      if (data.Implants) profile.Implants = data.Implants;
      
      result.warnings.push('Profile imported with missing required fields - filled with defaults');
    } else {
      // Try to map common fields from other formats
      if (data.name) profile.Character.Name = data.name;
      if (data.level) profile.Character.Level = data.level;
      if (data.profession) profile.Character.Profession = data.profession;
      
      result.warnings.push('Profile converted from unrecognized format - some data may be lost');
    }
    
    return profile;
  }
  
  // ============================================================================
  // Utility Methods
  // ============================================================================
  
  private estimateMemoryCapacity(level: number, profession: string): number {
    const baseCap = 500;
    const levelBonus = Math.floor(level / 10) * 50;
    const professionBonus = ['Meta-Physicist', 'Nanotechnician'].includes(profession) ? 100 : 0;
    
    return baseCap + levelBonus + professionBonus;
  }
  
  private estimateNanoPoints(level: number, intelligence: number): number {
    const base = 1000;
    const levelBonus = level * 10;
    const intelBonus = Math.floor(intelligence / 10) * 50;
    
    return base + levelBonus + intelBonus;
  }
  
  private flattenSkills(skills: TinkerProfile['Skills']): Record<string, number> {
    const flattened: Record<string, number> = {};
    
    Object.entries(skills).forEach(([category, categorySkills]) => {
      if (typeof categorySkills === 'object' && categorySkills !== null) {
        Object.entries(categorySkills).forEach(([skill, value]) => {
          if (typeof value === 'number') {
            // Handle Misc category which uses raw numbers
            flattened[`${category}.${skill}`] = value;
          } else if (value && typeof value === 'object' && 'value' in value) {
            // Handle other categories which use SkillWithIP structure
            flattened[`${category}.${skill}`] = value.value;
          }
        });
      }
    });
    
    return flattened;
  }
  
  private unflattenSkills(flatSkills: Record<string, number>, targetSkills: TinkerProfile['Skills']): void {
    Object.entries(flatSkills).forEach(([key, value]) => {
      const parts = key.split('.');
      if (parts.length === 2) {
        const [category, skill] = parts;
        if (targetSkills[category as keyof typeof targetSkills]) {
          if (category === 'Misc') {
            // Handle Misc category which uses raw numbers
            const categorySkills = targetSkills[category as keyof typeof targetSkills] as Record<string, number>;
            categorySkills[skill] = value;
          } else {
            // Handle other categories which use SkillWithIP structure
            const categorySkills = targetSkills[category as keyof typeof targetSkills] as Record<string, any>;
            if (categorySkills[skill] && typeof categorySkills[skill] === 'object' && 'value' in categorySkills[skill]) {
              categorySkills[skill].value = value;
            }
          }
        }
      }
    });
  }
}