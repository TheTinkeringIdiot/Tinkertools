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
        'Strength': profile.Skills.Attributes.Strength || 10,
        'Stamina': profile.Skills.Attributes.Stamina || 10,
        'Agility': profile.Skills.Attributes.Agility || 10,
        'Sense': profile.Skills.Attributes.Sense || 10,
        'Intelligence': profile.Skills.Attributes.Intelligence || 10,
        'Psychic': profile.Skills.Attributes.Psychic || 10
      };
    }
    
    // Map nano schools and relevant skills
    if (profile.Skills['Nanos & Casting']) {
      const nanoCasting = profile.Skills['Nanos & Casting'];
      nanoProfile.skills['Biological Metamorphosis'] = nanoCasting['Bio Metamor'] || 1;
      nanoProfile.skills['Matter Creation'] = nanoCasting['Matter Crea'] || 1;
      nanoProfile.skills['Matter Metamorphosis'] = nanoCasting['Matt. Metam'] || 1;
      nanoProfile.skills['Psychological Modifications'] = nanoCasting['Psycho Modi'] || 1;
      nanoProfile.skills['Sensory Improvement'] = nanoCasting['Sensory Impr'] || 1;
      nanoProfile.skills['Time and Space'] = nanoCasting['Time&Space'] || 1;
    }
    
    // Map core skills
    if (profile.Skills['Trade & Repair']) {
      nanoProfile.skills['Nano Programming'] = profile.Skills['Trade & Repair']['Nano Progra'] || 1;
      nanoProfile.skills['Computer Literacy'] = profile.Skills['Trade & Repair']['Comp. Liter'] || 1;
      nanoProfile.skills['Tutoring'] = profile.Skills['Trade & Repair']['Tutoring'] || 1;
    }
    
    if (profile.Skills['Combat & Healing']) {
      nanoProfile.skills['First Aid'] = profile.Skills['Combat & Healing']['First Aid'] || 1;
      nanoProfile.skills['Treatment'] = profile.Skills['Combat & Healing']['Treatment'] || 1;
    }
    
    // Estimate memory capacity based on level and profession
    nanoProfile.memoryCapacity = this.estimateMemoryCapacity(profile.Character.Level, profile.Character.Profession);
    
    // Estimate nano points based on level and intelligence
    const intel = profile.Skills.Attributes?.Intelligence || 10;
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
      profile.Skills.Attributes.Strength = nanoProfile.stats.Strength || 10;
      profile.Skills.Attributes.Stamina = nanoProfile.stats.Stamina || 10;
      profile.Skills.Attributes.Agility = nanoProfile.stats.Agility || 10;
      profile.Skills.Attributes.Sense = nanoProfile.stats.Sense || 10;
      profile.Skills.Attributes.Intelligence = nanoProfile.stats.Intelligence || 10;
      profile.Skills.Attributes.Psychic = nanoProfile.stats.Psychic || 10;
    }
    
    // Map nano skills
    if (nanoProfile.skills) {
      if (nanoProfile.skills['Biological Metamorphosis']) {
        profile.Skills['Nanos & Casting']['Bio Metamor'] = nanoProfile.skills['Biological Metamorphosis'];
      }
      if (nanoProfile.skills['Matter Creation']) {
        profile.Skills['Nanos & Casting']['Matter Crea'] = nanoProfile.skills['Matter Creation'];
      }
      if (nanoProfile.skills['Matter Metamorphosis']) {
        profile.Skills['Nanos & Casting']['Matt. Metam'] = nanoProfile.skills['Matter Metamorphosis'];
      }
      if (nanoProfile.skills['Psychological Modifications']) {
        profile.Skills['Nanos & Casting']['Psycho Modi'] = nanoProfile.skills['Psychological Modifications'];
      }
      if (nanoProfile.skills['Sensory Improvement']) {
        profile.Skills['Nanos & Casting']['Sensory Impr'] = nanoProfile.skills['Sensory Improvement'];
      }
      if (nanoProfile.skills['Time and Space']) {
        profile.Skills['Nanos & Casting']['Time&Space'] = nanoProfile.skills['Time and Space'];
      }
      
      // Map other skills
      if (nanoProfile.skills['Nano Programming']) {
        profile.Skills['Trade & Repair']['Nano Progra'] = nanoProfile.skills['Nano Programming'];
      }
      if (nanoProfile.skills['Computer Literacy']) {
        profile.Skills['Trade & Repair']['Comp. Liter'] = nanoProfile.skills['Computer Literacy'];
      }
      if (nanoProfile.skills['Tutoring']) {
        profile.Skills['Trade & Repair']['Tutoring'] = nanoProfile.skills['Tutoring'];
      }
      if (nanoProfile.skills['First Aid']) {
        profile.Skills['Combat & Healing']['First Aid'] = nanoProfile.skills['First Aid'];
      }
      if (nanoProfile.skills['Treatment']) {
        profile.Skills['Combat & Healing']['Treatment'] = nanoProfile.skills['Treatment'];
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
            flattened[`${category}.${skill}`] = value;
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
          const categorySkills = targetSkills[category as keyof typeof targetSkills] as Record<string, number>;
          categorySkills[skill] = value;
        }
      }
    });
  }
}