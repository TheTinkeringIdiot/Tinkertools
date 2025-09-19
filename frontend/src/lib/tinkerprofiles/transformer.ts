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
  ProfileImportResult,
  ImplantWithClusters,
  ImplantCluster
} from './types';
import type { Item } from '@/types/api';
import { createDefaultProfile, createDefaultNanoProfile } from './constants';
import type { PerkSystem } from './perk-types';
import { SKILL_CATEGORIES, getSkillId } from './skill-mappings';
import { 
  getClusterMapping, 
  getSlotPosition,
  AOSETUPS_SLOT_TO_BITFLAG 
} from './cluster-mappings';
import { apiClient } from '@/services/api-client';

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
        return this.exportJSONFormat(profile);

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
  async importProfile(data: string, sourceFormat?: string): Promise<ProfileImportResult> {
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
          profile = await this.importFromAOSetups(data, result);
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

  private exportJSONFormat(profile: TinkerProfile): string {
    // Enhanced JSON export with proper perk serialization
    const exportData = {
      ...profile,
      // Ensure perks are properly structured
      PerksAndResearch: this.serializePerkSystem(profile.PerksAndResearch),
      // Add export metadata
      exportMetadata: {
        exportedAt: new Date().toISOString(),
        exportFormat: 'tinkerprofiles-json',
        version: profile.version,
        includesPerks: true
      }
    };

    return JSON.stringify(exportData, null, 2);
  }
  
  private exportLegacyFormat(profile: TinkerProfile): string {
    // Export in the legacy TinkerProfiles format with converted perks
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
      // Convert structured perks back to legacy array format for compatibility
      perksAndResearch: this.convertToLegacyPerks(profile.PerksAndResearch),
      metadata: {
        created: profile.created,
        version: profile.version,
        perkFormat: 'legacy-array'
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
      },
      // Add perk data in a simple format for AO compatibility
      Perks: this.convertToAOPerks(profile.PerksAndResearch)
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

      // Import and normalize perk data
      importedProfile.PerksAndResearch = this.importPerksFromData(parsed, result);

      // Ensure perk system is properly migrated with point calculation
      return this.migrateProfilePerks(importedProfile);
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

    // Import perk data from legacy format
    profile.PerksAndResearch = this.importPerksFromData(legacy, result);

    result.warnings.push('Profile migrated from legacy format');

    // Ensure perk system is migrated with point calculation
    return this.migrateProfilePerks(profile);
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

    // Import perk data from AO format
    profile.PerksAndResearch = this.importPerksFromData(ao, result);

    result.warnings.push('Profile imported from Anarchy Online format');

    // Ensure perk system is migrated with point calculation
    return this.migrateProfilePerks(profile);
  }
  
  private async importFromAOSetups(data: string, result: ProfileImportResult): Promise<TinkerProfile> {
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
    await this.mapAOSetupsEquipment(aosetups, profile, result);
    
    // Map perks to PerksAndResearch (fetch details from backend)
    if (aosetups.perks && Array.isArray(aosetups.perks)) {
      const legacyPerks = [];

      for (const perk of aosetups.perks) {
        if (!perk.aoid) continue;

        try {
          // Try to fetch perk details from backend
          const perkDetails = await apiClient.lookupPerkByAoid(perk.aoid);

          if (perkDetails) {
            // Extract base perk name (without level suffix)
            let baseName = perkDetails.name;
            if (baseName && perkDetails.counter > 1) {
              // Remove the level suffix if present (e.g., "Perk Name 5" -> "Perk Name")
              const nameParts = baseName.split(' ');
              if (nameParts.length > 1 && nameParts[nameParts.length - 1] === perkDetails.counter.toString()) {
                baseName = nameParts.slice(0, -1).join(' ');
              }
            }

            legacyPerks.push({
              aoid: perk.aoid,
              name: baseName,
              level: perkDetails.counter || 1,
              type: perkDetails.type || 'SL'
            });

            console.log(`[ProfileTransformer] Fetched perk: ${baseName} (level ${perkDetails.counter}, type: ${perkDetails.type})`);
          } else {
            // Fallback if perk not found in database
            legacyPerks.push({
              aoid: perk.aoid,
              name: `Unknown Perk (${perk.aoid})`,
              level: 1,
              type: 'SL'
            });
            result.warnings.push(`Could not find perk with AOID ${perk.aoid} in database`);
          }
        } catch (error) {
          // Fallback on API error
          console.warn(`[ProfileTransformer] Failed to fetch perk AOID ${perk.aoid}:`, error);
          legacyPerks.push({
            aoid: perk.aoid,
            name: `Unknown Perk (${perk.aoid})`,
            level: 1,
            type: 'SL'
          });
          result.warnings.push(`Failed to fetch perk details for AOID ${perk.aoid}`);
        }
      }

      // Set as legacy array format, will be migrated by migrateProfilePerks
      (profile as any).PerksAndResearch = legacyPerks;
      result.warnings.push(`Imported ${legacyPerks.length} perks from AOSetups format`);
    }
    
    result.warnings.push('Profile imported from AOSetups format');
    result.warnings.push('Equipment items fetched from database with interpolated stats at target QLs');

    // Ensure perk system is migrated
    return this.migrateProfilePerks(profile);
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
  
  private async mapAOSetupsEquipment(aosetups: any, profile: TinkerProfile, result: ProfileImportResult): Promise<void> {
    // First pass: collect all item requests
    const itemRequests: Array<{aoid: number, targetQl?: number}> = [];
    const itemPlacement: Array<{
      type: 'implant' | 'weapon' | 'clothing',
      slot: string,
      aoid: number,
      targetQl?: number,
      clusters?: Record<string, { ClusterID: number }>,
      implantType?: 'implant' | 'symbiant'
    }> = [];
    
    // Collect implant/symbiant requests
    if (aosetups.implants && Array.isArray(aosetups.implants)) {
      for (const implant of aosetups.implants) {
        // Handle symbiant implants (has symbiant.highid)
        if (implant && implant.slot && implant.symbiant?.highid) {
          const aoid = implant.symbiant.highid;
          const targetQl = implant.symbiant.selectedQl;
          
          itemRequests.push({ aoid, targetQl });
          itemPlacement.push({
            type: 'implant',
            slot: implant.slot,
            aoid,
            targetQl,
            implantType: 'symbiant'
          });
        }
        // Handle regular implants (has type: 'implant', clusters, ql)
        else if (implant && implant.slot && implant.type === 'implant' && implant.ql) {
          // For regular implants, we don't have an AOID but we have cluster data
          // We'll create a placeholder item and focus on the cluster data
          itemPlacement.push({
            type: 'implant',
            slot: implant.slot,
            aoid: 0, // Placeholder - no actual item to fetch
            targetQl: implant.ql,
            clusters: implant.clusters,
            implantType: 'implant'
          });
        }
      }
    }
    
    // Collect weapon requests
    if (aosetups.weapons && Array.isArray(aosetups.weapons)) {
      for (let i = 0; i < aosetups.weapons.length; i++) {
        const weapon = aosetups.weapons[i];
        if (weapon && weapon.highid) {
          const aoid = weapon.highid;
          const targetQl = weapon.selectedQl;
          
          itemRequests.push({ aoid, targetQl });
          itemPlacement.push({
            type: 'weapon',
            slot: i.toString(),
            aoid,
            targetQl
          });
        }
      }
    }
    
    // Collect clothing requests
    if (aosetups.clothes && Array.isArray(aosetups.clothes)) {
      for (const clothing of aosetups.clothes) {
        if (clothing && clothing.slot && clothing.highid) {
          const aoid = clothing.highid;
          const targetQl = clothing.selectedQl;
          
          itemRequests.push({ aoid, targetQl });
          itemPlacement.push({
            type: 'clothing',
            slot: clothing.slot,
            aoid,
            targetQl
          });
        }
      }
    }
    
    // Fetch all items
    const itemMap = await this.fetchItems(itemRequests);
    
    // Second pass: populate equipment with fetched items
    for (const placement of itemPlacement) {
      const key = `${placement.aoid}:${placement.targetQl || 'base'}`;
      const item = itemMap.get(key);
      
      if (placement.type === 'implant') {
        const transformedImplant = await this.transformAOSetupsImplant(placement, item, result);
        if (transformedImplant) {
          // Use bitflag values as keys instead of string slot names
          const slotBitflag = getSlotPosition(placement.slot);
          if (slotBitflag) {
            profile.Implants[slotBitflag.toString()] = transformedImplant;
          }
        }
      } else if (placement.type === 'weapon') {
        const slotMapping = ['HUD1', 'HUD2', 'HUD3', 'UTILS1', 'UTILS2', 'UTILS3', 'RHand', 'Waist', 'LHand', 'NCU1', 'NCU2', 'NCU3', 'NCU4', 'NCU5', 'NCU6'];
        const slotIndex = parseInt(placement.slot);
        const slot = slotMapping[slotIndex] as keyof typeof profile.Weapons;
        
        if (slot) {
          if (item) {
            profile.Weapons[slot] = item;
          } else {
            // Fallback to basic data if item fetch failed
            profile.Weapons[slot] = {
              id: placement.aoid,
              aoid: placement.aoid,
              name: `Item ${placement.aoid} (fetch failed)`,
              ql: placement.targetQl || 1,
              description: undefined,
              item_class: undefined,
              is_nano: false,
              stats: [],
              spell_data: [],
              actions: [],
              attack_stats: [],
              defense_stats: [],
              sources: []
            } as Item;
            result.warnings.push(`Failed to fetch weapon item AOID ${placement.aoid}`);
          }
        }
      } else if (placement.type === 'clothing') {
        const slotMapping: Record<string, keyof typeof profile.Clothing> = {
          'HEAD': 'Head',
          'BACK': 'Back', 
          'BODY': 'Chest',
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
        
        const slot = slotMapping[placement.slot];
        if (slot) {
          if (item) {
            profile.Clothing[slot] = item;
          } else {
            // Fallback to basic data if item fetch failed
            profile.Clothing[slot] = {
              id: placement.aoid,
              aoid: placement.aoid,
              name: `Item ${placement.aoid} (fetch failed)`,
              ql: placement.targetQl || 1,
              description: undefined,
              item_class: undefined,
              is_nano: false,
              stats: [],
              spell_data: [],
              actions: [],
              attack_stats: [],
              defense_stats: [],
              sources: []
            } as Item;
            result.warnings.push(`Failed to fetch clothing item AOID ${placement.aoid}`);
          }
        }
      }
    }
  }
  
  /**
   * Transform AOSetups implant data using backend API lookup
   */
  private async transformAOSetupsImplant(
    placement: {
      type: string,
      slot: string,
      aoid: number,
      targetQl?: number,
      clusters?: Record<string, { ClusterID: number }>,
      implantType?: 'implant' | 'symbiant'
    },
    item: Item | undefined | null,
    result: ProfileImportResult
  ): Promise<ImplantWithClusters | null> {
    // Get numeric slot position
    const slotPosition = getSlotPosition(placement.slot);
    if (!slotPosition) {
      result.warnings.push(`Unknown implant slot: ${placement.slot}`);
      return null;
    }
    
    // Handle symbiants (use fetched item data)
    if (placement.implantType === 'symbiant' && item) {
      const enhancedImplant: ImplantWithClusters = {
        ...item,
        slot: slotPosition,
        type: 'symbiant'
      };
      
      result.warnings.push(`Mapped symbiant ${item.name || placement.aoid} to slot ${placement.slot}`);
      return enhancedImplant;
    }
    
    // Handle regular implants with clusters using backend API
    if (placement.implantType === 'implant' && placement.clusters) {
      try {
        // Convert ClusterIDs to STAT numbers
        const clusters: Record<string, number> = {};
        let hasValidClusters = false;
        
        for (const [position, clusterData] of Object.entries(placement.clusters)) {
          if (clusterData && clusterData.ClusterID) {
            const mapping = getClusterMapping(clusterData.ClusterID);
            if (mapping) {
              clusters[position] = mapping.stat;
              hasValidClusters = true;
            } else {
              result.warnings.push(`Unknown ClusterID: ${clusterData.ClusterID}`);
            }
          }
        }
        
        if (!hasValidClusters) {
          result.warnings.push(`No valid clusters found for implant in slot ${placement.slot}`);
          return null;
        }
        
        // Call backend API to lookup the exact implant
        const lookupItem = await apiClient.lookupImplant(
          slotPosition,
          placement.targetQl || 100,
          clusters
        );
        
        // Create enhanced implant with the real data
        const enhancedImplant: ImplantWithClusters = {
          ...lookupItem,
          slot: slotPosition,
          type: 'implant',
          clusters: {}
        };
        
        // Add cluster metadata for UI display
        for (const [position, statId] of Object.entries(clusters)) {
          const mapping = Object.values(getClusterMapping.bind(this)).find(
            (m: any) => m && m.stat === statId
          );
          
          if (mapping) {
            const positionMap: Record<string, keyof NonNullable<ImplantWithClusters['clusters']>> = {
              'Shiny': 'Shiny',
              'Bright': 'Bright', 
              'Faded': 'Faded'
            };
            
            const mappedPosition = positionMap[position];
            if (mappedPosition && enhancedImplant.clusters) {
              enhancedImplant.clusters[mappedPosition] = {
                stat: statId,
                skillName: (mapping as any).skillName
              };
            }
          }
        }
        
        const clusterCount = Object.keys(clusters).length;
        result.warnings.push(`Found implant with ${clusterCount} clusters for slot ${placement.slot} (${lookupItem.name})`);
        
        return enhancedImplant;
        
      } catch (error) {
        result.warnings.push(`Failed to lookup implant for slot ${placement.slot}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        // Fallback to placeholder implant
        return this.createPlaceholderImplant(placement, result, slotPosition);
      }
    }
    
    // Fallback for cases where we can't lookup from backend
    return this.createPlaceholderImplant(placement, result, slotPosition);
  }
  
  /**
   * Create a placeholder implant when backend lookup fails
   */
  private createPlaceholderImplant(
    placement: {
      type: string,
      slot: string,
      aoid: number,
      targetQl?: number,
      clusters?: Record<string, { ClusterID: number }>,
      implantType?: 'implant' | 'symbiant'
    },
    result: ProfileImportResult,
    slotPosition: number
  ): ImplantWithClusters {
    const placeholderItem: Item = {
      id: 0,
      aoid: placement.aoid || 0,
      name: placement.implantType === 'implant' ? `Implant QL${placement.targetQl || 100}` : `Symbiant ${placement.aoid}`,
      ql: placement.targetQl || 1,
      description: undefined,
      item_class: 3,
      is_nano: false,
      stats: [],
      spell_data: [],
      actions: [],
      attack_stats: [],
      defense_stats: [],
      sources: []
    };
    
    const enhancedImplant: ImplantWithClusters = {
      ...placeholderItem,
      slot: slotPosition,
      type: placement.implantType || 'implant'
    };
    
    // Add cluster information as metadata
    if (placement.clusters) {
      enhancedImplant.clusters = {};
      
      for (const [position, clusterData] of Object.entries(placement.clusters)) {
        if (clusterData && clusterData.ClusterID) {
          const mapping = getClusterMapping(clusterData.ClusterID);
          if (mapping) {
            const positionMap: Record<string, keyof NonNullable<ImplantWithClusters['clusters']>> = {
              'Shiny': 'Shiny',
              'Bright': 'Bright', 
              'Faded': 'Faded'
            };
            
            const mappedPosition = positionMap[position];
            if (mappedPosition) {
              enhancedImplant.clusters[mappedPosition] = {
                stat: mapping.stat,
                skillName: mapping.skillName
              };
            }
          }
        }
      }
    }
    
    result.warnings.push(`Using placeholder data for ${placement.implantType} in slot ${placement.slot}`);
    return enhancedImplant;
  }
  
  // ============================================================================
  // Item Fetching Utilities
  // ============================================================================
  
  /**
   * Fetch multiple items from the backend API
   * @param itemRequests Array of {aoid: number, targetQl?: number}
   * @returns Promise<Map<string, Item | null>> - Map of "aoid:ql" to Item
   */
  private async fetchItems(itemRequests: Array<{aoid: number, targetQl?: number}>): Promise<Map<string, Item | null>> {
    const itemMap = new Map<string, Item | null>();
    
    if (itemRequests.length === 0) {
      return itemMap;
    }
    
    console.log(`[ProfileTransformer] Fetching ${itemRequests.length} items from backend...`);
    
    // Process each item request
    const fetchPromises = itemRequests.map(async (request) => {
      const key = `${request.aoid}:${request.targetQl || 'base'}`;
      
      try {
        let itemResponse;
        
        if (request.targetQl && request.targetQl > 1) {
          // Use interpolation API for specific quality levels
          console.log(`[ProfileTransformer] Fetching interpolated item AOID ${request.aoid} at QL ${request.targetQl}`);
          const interpolationResponse = await apiClient.interpolateItem(request.aoid, request.targetQl);
          if (interpolationResponse.success && interpolationResponse.item) {
            // Convert InterpolatedItem to Item format for TinkerProfile
            itemResponse = {
              success: true,
              data: {
                id: interpolationResponse.item.id,
                aoid: interpolationResponse.item.aoid,
                name: interpolationResponse.item.name,
                ql: interpolationResponse.item.ql,
                description: interpolationResponse.item.description,
                item_class: interpolationResponse.item.item_class,
                is_nano: interpolationResponse.item.is_nano,
                stats: interpolationResponse.item.stats || [],
                spell_data: interpolationResponse.item.spell_data || [],
                actions: interpolationResponse.item.actions || [],
                attack_stats: [],
                defense_stats: [],
                sources: []
              } as unknown as Item
            };
          } else {
            throw new Error(`Interpolation failed: ${interpolationResponse.error || 'Unknown error'}`);
          }
        } else {
          // Use regular item API for base item
          console.log(`[ProfileTransformer] Fetching base item AOID ${request.aoid}`);
          itemResponse = await apiClient.getItem(request.aoid);
        }
        
        if (itemResponse.success && itemResponse.data) {
          itemMap.set(key, itemResponse.data);
          console.log(`[ProfileTransformer] Successfully fetched ${itemResponse.data.name} (AOID: ${request.aoid})`);
        } else {
          console.warn(`[ProfileTransformer] Failed to fetch item AOID ${request.aoid}: No data returned`);
          itemMap.set(key, null);
        }
      } catch (error) {
        console.warn(`[ProfileTransformer] Failed to fetch item AOID ${request.aoid}:`, error);
        itemMap.set(key, null);
      }
    });
    
    // Wait for all fetches to complete
    await Promise.all(fetchPromises);
    
    console.log(`[ProfileTransformer] Completed item fetching: ${itemMap.size} items processed`);
    return itemMap;
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

    // Import perk data from any available format
    profile.PerksAndResearch = this.importPerksFromData(data, result);

    // Ensure perk system is migrated with point calculation
    return this.migrateProfilePerks(profile);
  }
  
  // ============================================================================
  // Profile Migration
  // ============================================================================

  /**
   * Migrate profile to include structured PerkSystem
   * Handles migration from legacy PerksAndResearch formats
   */
  migrateProfilePerks(profile: TinkerProfile): TinkerProfile {
    // Check if already using structured PerkSystem
    if (profile.PerksAndResearch &&
        typeof profile.PerksAndResearch === 'object' &&
        'perks' in profile.PerksAndResearch &&
        'standardPerkPoints' in profile.PerksAndResearch &&
        'aiPerkPoints' in profile.PerksAndResearch) {
      return profile; // Already migrated
    }

    console.log(`[ProfileTransformer] Migrating profile ${profile.Character.Name} to structured PerkSystem`);

    // Calculate available perk points based on current levels
    const characterLevel = profile.Character.Level || 1;
    const alienLevel = profile.Character.AlienLevel || 0;

    const standardPerkPoints = this.calculateStandardPerkPoints(characterLevel);
    const aiPerkPoints = this.calculateAIPerkPoints(alienLevel);

    // Create new structured perk system
    const newPerkSystem: PerkSystem = {
      perks: [],
      standardPerkPoints: {
        total: standardPerkPoints,
        spent: 0,
        available: standardPerkPoints
      },
      aiPerkPoints: {
        total: aiPerkPoints,
        spent: 0,
        available: aiPerkPoints
      },
      research: [],
      lastCalculated: new Date().toISOString()
    };

    // Preserve any existing PerksAndResearch data if possible
    const legacyPerksAndResearch = profile.PerksAndResearch as any;
    if (legacyPerksAndResearch && Array.isArray(legacyPerksAndResearch)) {
      // Legacy array format - try to convert if possible
      console.log(`[ProfileTransformer] Found legacy perk array with ${legacyPerksAndResearch.length} entries`);

      for (const perkEntry of legacyPerksAndResearch) {
        if (perkEntry && typeof perkEntry === 'object') {
          try {
            // Try to map legacy perk entries to new format
            if ('aoid' in perkEntry && 'name' in perkEntry && 'level' in perkEntry) {
              const legacyPerk = perkEntry as any;

              // Determine perk type (default to SL if not specified)
              const perkType = legacyPerk.type || 'SL';

              if (perkType === 'LE') {
                // LE research perk (free)
                newPerkSystem.research.push({
                  aoid: legacyPerk.aoid,
                  name: legacyPerk.name,
                  level: legacyPerk.level,
                  type: 'LE'
                });
              } else {
                // SL or AI perk (costs points)
                const cost = legacyPerk.level; // 1 point per level
                newPerkSystem.perks.push({
                  aoid: legacyPerk.aoid,
                  name: legacyPerk.name,
                  level: legacyPerk.level,
                  type: perkType as 'SL' | 'AI'
                });

                // Update spent points
                if (perkType === 'AI') {
                  newPerkSystem.aiPerkPoints.spent += cost;
                  newPerkSystem.aiPerkPoints.available -= cost;
                } else {
                  newPerkSystem.standardPerkPoints.spent += cost;
                  newPerkSystem.standardPerkPoints.available -= cost;
                }
              }
            }
          } catch (error) {
            console.warn(`[ProfileTransformer] Failed to migrate perk entry:`, perkEntry, error);
          }
        }
      }

      console.log(`[ProfileTransformer] Migrated ${newPerkSystem.perks.length} perks and ${newPerkSystem.research.length} research entries`);
    }

    // Ensure point totals don't go negative
    newPerkSystem.standardPerkPoints.available = Math.max(0, newPerkSystem.standardPerkPoints.available);
    newPerkSystem.aiPerkPoints.available = Math.max(0, newPerkSystem.aiPerkPoints.available);

    // Update the profile
    const migratedProfile = structuredClone(profile);
    migratedProfile.PerksAndResearch = newPerkSystem;
    migratedProfile.updated = new Date().toISOString();

    return migratedProfile;
  }

  /**
   * Calculate standard perk points based on character level
   */
  private calculateStandardPerkPoints(level: number): number {
    if (level < 10) return 0;

    // 1 point every 10 levels up to level 200 (20 points)
    const pointsUpTo200 = Math.min(Math.floor(level / 10), 20);

    // 1 point per level from 201-220 (20 points)
    const pointsAfter200 = level > 200 ? Math.min(level - 200, 20) : 0;

    // Total: maximum 40 points at level 220
    return pointsUpTo200 + pointsAfter200;
  }

  /**
   * Calculate AI perk points based on alien level
   */
  private calculateAIPerkPoints(alienLevel: number): number {
    // 1 AI perk point per alien level, max 30
    return Math.min(alienLevel, 30);
  }

  // ============================================================================
  // Perk Serialization Utilities
  // ============================================================================

  /**
   * Serialize PerkSystem for export, ensuring proper structure
   */
  private serializePerkSystem(perkSystem: any): PerkSystem | any {
    // If already a structured PerkSystem, return as-is
    if (perkSystem &&
        typeof perkSystem === 'object' &&
        'perks' in perkSystem &&
        'standardPerkPoints' in perkSystem &&
        'aiPerkPoints' in perkSystem) {
      return perkSystem;
    }

    // If legacy format or undefined, create empty structured system
    return {
      perks: [],
      standardPerkPoints: {
        total: 0,
        spent: 0,
        available: 0
      },
      aiPerkPoints: {
        total: 0,
        spent: 0,
        available: 0
      },
      research: [],
      lastCalculated: new Date().toISOString()
    };
  }

  /**
   * Convert structured PerkSystem to legacy array format
   */
  private convertToLegacyPerks(perkSystem: any): any[] {
    const legacyPerks: any[] = [];

    if (!perkSystem || typeof perkSystem !== 'object') {
      return legacyPerks;
    }

    // Add SL and AI perks
    if (Array.isArray(perkSystem.perks)) {
      for (const perk of perkSystem.perks) {
        legacyPerks.push({
          aoid: perk.aoid,
          name: perk.name,
          level: perk.level,
          type: perk.type
        });
      }
    }

    // Add LE research
    if (Array.isArray(perkSystem.research)) {
      for (const research of perkSystem.research) {
        legacyPerks.push({
          aoid: research.aoid,
          name: research.name,
          level: research.level,
          type: research.type
        });
      }
    }

    return legacyPerks;
  }

  /**
   * Convert PerkSystem to AO-compatible format
   */
  private convertToAOPerks(perkSystem: any): any[] {
    const aoPerks: any[] = [];

    if (!perkSystem || typeof perkSystem !== 'object') {
      return aoPerks;
    }

    // Convert SL and AI perks to simple format
    if (Array.isArray(perkSystem.perks)) {
      for (const perk of perkSystem.perks) {
        aoPerks.push({
          aoid: perk.aoid,
          name: perk.name,
          level: perk.level,
          type: perk.type,
          category: perk.type === 'AI' ? 'Alien' : 'Standard'
        });
      }
    }

    // Convert LE research
    if (Array.isArray(perkSystem.research)) {
      for (const research of perkSystem.research) {
        aoPerks.push({
          aoid: research.aoid,
          name: research.name,
          level: research.level,
          type: research.type,
          category: 'Research'
        });
      }
    }

    return aoPerks;
  }

  /**
   * Import perks from various formats and normalize to PerkSystem
   */
  private importPerksFromData(data: any, result: ProfileImportResult): PerkSystem {
    // Handle structured PerkSystem
    if (data.PerksAndResearch &&
        typeof data.PerksAndResearch === 'object' &&
        'perks' in data.PerksAndResearch) {
      result.warnings.push('Imported structured perk system');
      return data.PerksAndResearch as PerkSystem;
    }

    // Handle legacy array format
    if (data.PerksAndResearch && Array.isArray(data.PerksAndResearch)) {
      result.warnings.push(`Converted ${data.PerksAndResearch.length} perks from legacy array format`);
      return this.convertLegacyPerksToSystem(data.PerksAndResearch);
    }

    // Handle legacy format with different key
    if (data.perksAndResearch && Array.isArray(data.perksAndResearch)) {
      result.warnings.push(`Converted ${data.perksAndResearch.length} perks from legacy format`);
      return this.convertLegacyPerksToSystem(data.perksAndResearch);
    }

    // Handle AO format
    if (data.Perks && Array.isArray(data.Perks)) {
      result.warnings.push(`Converted ${data.Perks.length} perks from AO format`);
      return this.convertLegacyPerksToSystem(data.Perks);
    }

    // Return empty system if no perks found
    return {
      perks: [],
      standardPerkPoints: { total: 0, spent: 0, available: 0 },
      aiPerkPoints: { total: 0, spent: 0, available: 0 },
      research: [],
      lastCalculated: new Date().toISOString()
    };
  }

  /**
   * Convert legacy perk array to structured PerkSystem
   */
  private convertLegacyPerksToSystem(legacyPerks: any[]): PerkSystem {
    const system: PerkSystem = {
      perks: [],
      standardPerkPoints: { total: 0, spent: 0, available: 0 },
      aiPerkPoints: { total: 0, spent: 0, available: 0 },
      research: [],
      lastCalculated: new Date().toISOString()
    };

    for (const perk of legacyPerks) {
      if (!perk || typeof perk !== 'object') continue;

      const perkType = perk.type || 'SL';
      const perkLevel = perk.level || 1;

      if (perkType === 'LE') {
        // Research perk
        system.research.push({
          aoid: perk.aoid || 0,
          name: perk.name || `Research ${perk.aoid}`,
          level: perkLevel,
          type: 'LE'
        });
      } else {
        // SL or AI perk
        system.perks.push({
          aoid: perk.aoid || 0,
          name: perk.name || `Perk ${perk.aoid}`,
          level: perkLevel,
          type: perkType as 'SL' | 'AI'
        });

        // Update point tracking
        const cost = perkLevel; // 1 point per level
        if (perkType === 'AI') {
          system.aiPerkPoints.spent += cost;
        } else {
          system.standardPerkPoints.spent += cost;
        }
      }
    }

    return system;
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