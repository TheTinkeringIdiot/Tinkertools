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
  ImplantCluster,
} from './types';
import type { Item } from '@/types/api';
import { createDefaultProfile, createDefaultNanoProfile } from './constants';
import type { PerkSystem } from './perk-types';
import { SKILL_CATEGORIES, getSkillId } from './skill-mappings';
import { getClusterMapping, getSlotPosition, AOSETUPS_SLOT_TO_BITFLAG } from './cluster-mappings';
import { apiClient } from '@/services/api-client';
import { skillService } from '@/services/skill-service';
import type { SkillId } from '@/types/skills';
import { SKILL_COST_FACTORS } from '@/services/game-data';
import { normalizeProfessionToId, normalizeBreedToId } from '@/services/game-utils';

export class ProfileTransformer {
  // ============================================================================
  // Profile Format Transformations
  // ============================================================================

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
        migrated: false,
      },
    };

    try {
      // Try to detect format if not specified
      const detectedFormat = sourceFormat || this.detectFormat(data);
      result.metadata.source = detectedFormat;
      result.metadata.originalFormat = detectedFormat;

      // Reject unsupported formats immediately
      if (detectedFormat === 'unsupported_legacy') {
        result.errors.push('Profile format not supported. Only v4.0.0 profiles can be imported.');
        return result;
      }

      let profile: TinkerProfile;

      switch (detectedFormat) {
        case 'json':
          profile = await this.importFromJSON(data, result);
          break;

        case 'aosetups':
          profile = await this.importFromAOSetups(data, result);
          break;

        default:
          result.errors.push('Unable to detect or unsupported format');
          return result;
      }

      // Verify imported profile version === '4.0.0' before returning success
      if (profile.version !== '4.0.0') {
        result.errors.push(`Invalid profile version: ${profile.version}. Only v4.0.0 supported.`);
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
    // Verify profile is v4.0.0
    if (profile.version !== '4.0.0') {
      throw new Error(`Cannot export profile version ${profile.version}. Only v4.0.0 supported.`);
    }

    // Export profile in v4.0.0 format with numeric skill IDs
    const exportData = {
      version: '4.0.0',
      id: profile.id,
      created: profile.created,
      updated: profile.updated,
      Character: profile.Character,
      IPTracker: profile.IPTracker,
      skills: profile.skills, // Use numeric skill IDs as keys
      Weapons: profile.Weapons,
      Clothing: profile.Clothing,
      Implants: profile.Implants,
      PerksAndResearch: this.serializePerkSystem(profile.PerksAndResearch),
      buffs: profile.buffs,
    };

    return JSON.stringify(exportData, null, 2);
  }

  private async importFromJSON(data: string, result: ProfileImportResult): Promise<TinkerProfile> {
    const parsed = JSON.parse(data);

    // Check if it's already a valid TinkerProfile
    if (this.isValidTinkerProfile(parsed)) {
      // Generate new ID and timestamps for imported profile
      const importedProfile = structuredClone(parsed);
      importedProfile.id = `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      importedProfile.created = new Date().toISOString();
      importedProfile.updated = new Date().toISOString();

      // Normalize Character IDs (handles both legacy strings and numeric IDs)
      importedProfile.Character.Profession = normalizeProfessionToId(
        importedProfile.Character.Profession
      );
      importedProfile.Character.Breed = normalizeBreedToId(importedProfile.Character.Breed);

      // Import and normalize perk data
      importedProfile.PerksAndResearch = this.importPerksFromData(parsed, result);

      // Validate the imported profile
      const { validateProfile: validateProfileIds } = await import('./validation');
      const validation = validateProfileIds(importedProfile);
      if (!validation.valid) {
        result.errors.push(...validation.errors);
        throw new Error(`JSON import validation failed: ${validation.errors.join(', ')}`);
      }

      if (validation.warnings.length > 0) {
        result.warnings.push(...validation.warnings);
      }

      // Ensure perk system is properly migrated with point calculation
      return this.migrateProfilePerks(importedProfile);
    }

    // Try to convert from other JSON formats
    return this.convertToTinkerProfile(parsed, result);
  }

  private async importFromAOSetups(
    data: string,
    result: ProfileImportResult
  ): Promise<TinkerProfile> {
    const aosetups = JSON.parse(data);
    result.metadata.migrated = true;

    const profile = createDefaultProfile();
    console.log(
      `[ProfileTransformer] Created default profile with ${Object.keys(profile.skills).length} skills`
    );

    // Ensure profile is v4.0.0 format with ID-based skills
    profile.version = '4.0.0';
    // Keep all default skills - AOSetups will update the values for skills it includes

    // Map character data
    if (aosetups.character) {
      profile.Character.Name = aosetups.character.name || aosetups.name || 'AOSetups Import';
      profile.Character.Level = aosetups.character.level || 1;

      // Normalize profession and breed to numeric IDs
      profile.Character.Profession = normalizeProfessionToId(
        aosetups.character.profession || 'Adventurer'
      );
      profile.Character.Breed = normalizeBreedToId(aosetups.character.breed || 'Solitus');
      profile.Character.Faction = 'Neutral'; // Default, not in AOSetups
      profile.Character.Expansion = 'Lost Eden'; // Default
      profile.Character.AccountType = 'Paid'; // Default

      // Calculate base health and nano based on breed and level
      const level = profile.Character.Level;
      // Breed IDs: 1=Solitus, 2=Opifex, 3=Nanomage, 4=Atrox
      const healthPerLevel =
        profile.Character.Breed === 4
          ? 10 // Atrox
          : profile.Character.Breed === 2
            ? 6 // Opifex
            : 8; // Default (Solitus/Nanomage)
      const nanoPerLevel =
        profile.Character.Breed === 4
          ? 4 // Atrox
          : profile.Character.Breed === 2
            ? 6 // Opifex
            : 5; // Default (Solitus/Nanomage)

      profile.Character.MaxHealth = level * healthPerLevel;
      profile.Character.MaxNano = level * nanoPerLevel;

      // STEP 1: Normalize all skill names to IDs immediately after parsing
      if (aosetups.character.skills && Array.isArray(aosetups.character.skills)) {
        const normalizedSkills: Array<{
          skillId: SkillId;
          ipExpenditure: number;
          pointsFromIp: number;
        }> = [];

        for (const skill of aosetups.character.skills) {
          try {
            // Normalize skill name to ID using SkillService
            const skillId = skillService.resolveId(skill.name);
            normalizedSkills.push({
              skillId,
              ipExpenditure: skill.ipExpenditure || 0,
              pointsFromIp: skill.pointsFromIp || 0,
            });
          } catch (error) {
            // Halt import with descriptive error if any skill name unresolvable
            const errorMessage = `Unable to resolve skill name: "${skill.name}" from AOSetups import. ${error instanceof Error ? error.message : 'Unknown error'}`;
            result.errors.push(errorMessage);
            throw new Error(errorMessage);
          }
        }

        // STEP 2: Build profile with numeric skill IDs only
        for (const normalizedSkill of normalizedSkills) {
          this.mapNormalizedSkillToProfile(normalizedSkill, profile, result);
        }
        console.log(
          `[ProfileTransformer] After mapping AOSetups skills, profile has ${Object.keys(profile.skills).length} skills`
        );
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
          // Try to fetch complete perk details from backend
          const perkDetails = await apiClient.lookupPerkByAoid(perk.aoid);

          if (perkDetails) {
            // Extract base perk name (without level suffix)
            let baseName = perkDetails.perk_name || perkDetails.name;
            if (baseName && perkDetails.perk_counter > 1) {
              // Remove the level suffix if present (e.g., "Perk Name 5" -> "Perk Name")
              const nameParts = baseName.split(' ');
              if (
                nameParts.length > 1 &&
                nameParts[nameParts.length - 1] === perkDetails.perk_counter.toString()
              ) {
                baseName = nameParts.slice(0, -1).join(' ');
              }
            }

            legacyPerks.push({
              aoid: perk.aoid,
              name: baseName,
              level: perkDetails.perk_counter || perkDetails.counter || 1,
              type: perkDetails.perk_type || perkDetails.type || 'SL',
              item: perkDetails, // Store complete item details
            });

            console.log(
              `[ProfileTransformer] Fetched complete perk item: ${baseName} (level ${perkDetails.perk_counter || perkDetails.counter}, type: ${perkDetails.perk_type || perkDetails.type})`
            );
          } else {
            // Fallback if perk not found in database
            legacyPerks.push({
              aoid: perk.aoid,
              name: `Unknown Perk (${perk.aoid})`,
              level: 1,
              type: 'SL',
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
            type: 'SL',
          });
          result.warnings.push(`Failed to fetch perk details for AOID ${perk.aoid}`);
        }
      }

      // Set as legacy array format, will be migrated by migrateProfilePerks
      (profile as any).PerksAndResearch = legacyPerks;
      result.warnings.push(`Imported ${legacyPerks.length} perks from AOSetups format`);
    }

    result.warnings.push('Profile imported from AOSetups format');
    result.warnings.push(
      'Equipment items fetched from database with interpolated stats at target QLs'
    );

    // Validate the imported profile
    const { validateProfile: validateProfileIds } = await import('./validation');
    const validation = validateProfileIds(profile);
    if (!validation.valid) {
      result.errors.push(...validation.errors);
      throw new Error(`AOSetups import validation failed: ${validation.errors.join(', ')}`);
    }

    if (validation.warnings.length > 0) {
      result.warnings.push(...validation.warnings);
    }

    // Ensure perk system is migrated
    return this.migrateProfilePerks(profile);
  }

  /**
   * Map normalized skill (with numeric ID) to v4.0.0 profile structure
   * Never references string skill names after normalization
   */
  private mapNormalizedSkillToProfile(
    normalizedSkill: { skillId: SkillId; ipExpenditure: number; pointsFromIp: number },
    profile: TinkerProfile,
    result: ProfileImportResult
  ): void {
    const { skillId, ipExpenditure, pointsFromIp } = normalizedSkill;
    const numericId = Number(skillId);

    // Ensure skills map exists in v4.0.0 format
    if (!profile.skills) {
      profile.skills = {};
    }

    // Check if this is an ability (IDs 16-21: Strength, Agility, Stamina, Intelligence, Sense, Psychic)
    const isAbility = numericId >= 16 && numericId <= 21;

    // Handle abilities separately - they should already exist from createDefaultProfile()
    if (isAbility) {
      if (profile.skills[numericId]) {
        // Just update the IP values for abilities
        profile.skills[numericId].ipSpent = ipExpenditure;
        profile.skills[numericId].pointsFromIp = pointsFromIp;
        // Total will be recalculated by ipIntegrator.updateProfileSkillInfo later
      }
      return;
    }

    // Only update trainable skills from AOSetups data
    // Other non-trainable skills (ACs, bonus-only stats) should keep their default values
    if (!SKILL_COST_FACTORS[numericId]) {
      console.log(
        `[ProfileTransformer] Skipping non-trainable skill ID ${numericId} (${skillService.getName(skillId)}) - keeping default values`
      );
      return;
    }

    // Create or update skill data with ID-based structure
    if (!profile.skills[numericId]) {
      // Initialize with default skill data structure
      profile.skills[numericId] = {
        base: 5, // Default base value (will be adjusted for misc/AC skills)
        trickle: 0,
        ipSpent: 0,
        pointsFromIp: 0,
        equipmentBonus: 0,
        perkBonus: 0,
        buffBonus: 0,
        total: 5,
      };

      // Adjust base value for special skill types
      const category = skillService.getCategory(skillId);
      if (category === 'Misc' || category === 'ACs') {
        profile.skills[numericId].base = 0;
        profile.skills[numericId].total = 0;
      }
    }

    // Apply AOSetups IP data
    profile.skills[numericId].ipSpent = ipExpenditure;
    profile.skills[numericId].pointsFromIp = pointsFromIp;

    // Recalculate total (base + trickle + pointsFromIp + bonuses)
    profile.skills[numericId].total =
      profile.skills[numericId].base +
      profile.skills[numericId].trickle +
      profile.skills[numericId].pointsFromIp +
      profile.skills[numericId].equipmentBonus +
      profile.skills[numericId].perkBonus +
      profile.skills[numericId].buffBonus;
  }

  private async mapAOSetupsEquipment(
    aosetups: any,
    profile: TinkerProfile,
    result: ProfileImportResult
  ): Promise<void> {
    // First pass: collect all item requests
    const itemRequests: Array<{ aoid: number; targetQl?: number }> = [];
    const itemPlacement: Array<{
      type: 'implant' | 'weapon' | 'clothing';
      slot: string;
      aoid: number;
      targetQl?: number;
      clusters?: Record<string, { ClusterID: number }>;
      implantType?: 'implant' | 'symbiant';
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
            implantType: 'symbiant',
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
            implantType: 'implant',
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
            targetQl,
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
            targetQl,
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
        const slotMapping = [
          'HUD1',
          'HUD2',
          'HUD3',
          'UTILS1',
          'UTILS2',
          'UTILS3',
          'RHand',
          'Waist',
          'LHand',
          'NCU1',
          'NCU2',
          'NCU3',
          'NCU4',
          'NCU5',
          'NCU6',
        ];
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
              sources: [],
            } as Item;
            result.warnings.push(`Failed to fetch weapon item AOID ${placement.aoid}`);
          }
        }
      } else if (placement.type === 'clothing') {
        const slotMapping: Record<string, keyof typeof profile.Clothing> = {
          HEAD: 'Head',
          BACK: 'Back',
          BODY: 'Chest',
          ARM_R: 'RightArm',
          ARM_L: 'LeftArm',
          WRIST_R: 'RightWrist',
          WRIST_L: 'LeftWrist',
          HANDS: 'Hands',
          LEGS: 'Legs',
          FEET: 'Feet',
          SHOULDER_R: 'RightShoulder',
          SHOULDER_L: 'LeftShoulder',
          FINGER_R: 'RightFinger',
          FINGER_L: 'LeftFinger',
          NECK: 'Neck',
          BELT: 'Belt',
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
              sources: [],
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
      type: string;
      slot: string;
      aoid: number;
      targetQl?: number;
      clusters?: Record<string, { ClusterID: number }>;
      implantType?: 'implant' | 'symbiant';
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
        type: 'symbiant',
      };

      result.warnings.push(
        `Mapped symbiant ${item.name || placement.aoid} to slot ${placement.slot}`
      );
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
        const lookupResponse = await apiClient.lookupImplant(
          slotPosition,
          placement.targetQl || 100,
          clusters
        );

        // Check if lookup was successful
        if (!lookupResponse.success || !lookupResponse.data) {
          const errorMsg = lookupResponse.error?.message || 'Implant lookup failed';
          result.warnings.push(`Failed to lookup implant for slot ${placement.slot}: ${errorMsg}`);
          return this.createPlaceholderImplant(placement, result, slotPosition);
        }

        const lookupItem = lookupResponse.data;

        // Create enhanced implant with the real data
        const enhancedImplant: ImplantWithClusters = {
          ...lookupItem,
          slot: slotPosition,
          type: 'implant',
          clusters: {},
        };

        // Add cluster metadata for UI display
        for (const [position, statId] of Object.entries(clusters)) {
          const mapping = Object.values(getClusterMapping.bind(this)).find(
            (m: any) => m && m.stat === statId
          );

          if (mapping) {
            const positionMap: Record<string, keyof NonNullable<ImplantWithClusters['clusters']>> =
              {
                Shiny: 'Shiny',
                Bright: 'Bright',
                Faded: 'Faded',
              };

            const mappedPosition = positionMap[position];
            if (mappedPosition && enhancedImplant.clusters) {
              enhancedImplant.clusters[mappedPosition] = {
                stat: statId,
                skillName: (mapping as any).skillName,
              };
            }
          }
        }

        const clusterCount = Object.keys(clusters).length;
        result.warnings.push(
          `Found implant with ${clusterCount} clusters for slot ${placement.slot} (${lookupItem.name})`
        );

        return enhancedImplant;
      } catch (error) {
        result.warnings.push(
          `Failed to lookup implant for slot ${placement.slot}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );

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
      type: string;
      slot: string;
      aoid: number;
      targetQl?: number;
      clusters?: Record<string, { ClusterID: number }>;
      implantType?: 'implant' | 'symbiant';
    },
    result: ProfileImportResult,
    slotPosition: number
  ): ImplantWithClusters {
    const placeholderItem: Item = {
      id: 0,
      aoid: placement.aoid || 0,
      name:
        placement.implantType === 'implant'
          ? `Implant QL${placement.targetQl || 100}`
          : `Symbiant ${placement.aoid}`,
      ql: placement.targetQl || 1,
      description: undefined,
      item_class: 3,
      is_nano: false,
      stats: [],
      spell_data: [],
      actions: [],
      attack_stats: [],
      defense_stats: [],
      sources: [],
    };

    const enhancedImplant: ImplantWithClusters = {
      ...placeholderItem,
      slot: slotPosition,
      type: placement.implantType || 'implant',
    };

    // Add cluster information as metadata
    if (placement.clusters) {
      enhancedImplant.clusters = {};

      for (const [position, clusterData] of Object.entries(placement.clusters)) {
        if (clusterData && clusterData.ClusterID) {
          const mapping = getClusterMapping(clusterData.ClusterID);
          if (mapping) {
            const positionMap: Record<string, keyof NonNullable<ImplantWithClusters['clusters']>> =
              {
                Shiny: 'Shiny',
                Bright: 'Bright',
                Faded: 'Faded',
              };

            const mappedPosition = positionMap[position];
            if (mappedPosition) {
              enhancedImplant.clusters[mappedPosition] = {
                stat: mapping.stat,
                skillName: mapping.skillName,
              };
            }
          }
        }
      }
    }

    result.warnings.push(
      `Using placeholder data for ${placement.implantType} in slot ${placement.slot}`
    );
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
  private async fetchItems(
    itemRequests: Array<{ aoid: number; targetQl?: number }>
  ): Promise<Map<string, Item | null>> {
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
          console.log(
            `[ProfileTransformer] Fetching interpolated item AOID ${request.aoid} at QL ${request.targetQl}`
          );
          const interpolationResponse = await apiClient.interpolateItem(
            request.aoid,
            request.targetQl
          );
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
                sources: [],
              } as unknown as Item,
            };
          } else {
            throw new Error(
              `Interpolation failed: ${interpolationResponse.error || 'Unknown error'}`
            );
          }
        } else {
          // Use regular item API for base item
          console.log(`[ProfileTransformer] Fetching base item AOID ${request.aoid}`);
          itemResponse = await apiClient.getItem(request.aoid);
        }

        if (itemResponse.success && itemResponse.data) {
          itemMap.set(key, itemResponse.data);
          console.log(
            `[ProfileTransformer] Successfully fetched ${itemResponse.data.name} (AOID: ${request.aoid})`
          );
        } else {
          console.warn(
            `[ProfileTransformer] Failed to fetch item AOID ${request.aoid}: No data returned`
          );
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

      // Check for v4.0.0 TinkerProfile format
      if (parsed.Character && parsed.skills && parsed.version === '4.0.0') {
        return 'json';
      }

      // Check for AOSetups format
      if (parsed.character && parsed.implants && parsed.weapons && parsed.clothes) {
        return 'aosetups';
      }

      // Check for unsupported legacy formats (v3.0.0 or Skills property with non-4.0.0 version)
      if (parsed.Character && parsed.Skills && parsed.version !== '4.0.0') {
        return 'unsupported_legacy';
      }

      return 'unknown';
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
      data.skills &&
      data.version === '4.0.0'
    );
  }

  private convertToTinkerProfile(data: any, result: ProfileImportResult): TinkerProfile {
    const profile = createDefaultProfile();

    // Check if this looks like an incomplete v4.0.0 TinkerProfile
    if (data.Character && data.skills) {
      // Copy all Character data
      if (data.Character.Name) profile.Character.Name = data.Character.Name;
      if (data.Character.Level) profile.Character.Level = data.Character.Level;
      if (data.Character.Profession) {
        profile.Character.Profession = normalizeProfessionToId(data.Character.Profession);
      }
      if (data.Character.Breed) {
        profile.Character.Breed = normalizeBreedToId(data.Character.Breed);
      }
      if (data.Character.Faction) profile.Character.Faction = data.Character.Faction;
      if (data.Character.Expansion) profile.Character.Expansion = data.Character.Expansion;
      if (data.Character.AccountType) profile.Character.AccountType = data.Character.AccountType;

      // Copy skills if present (v4.0.0 format with numeric IDs)
      if (data.skills) {
        profile.skills = { ...profile.skills, ...data.skills };
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
      if (data.profession) {
        profile.Character.Profession = normalizeProfessionToId(data.profession);
      }
      if (data.breed) {
        profile.Character.Breed = normalizeBreedToId(data.breed);
      }

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
   * Migrate legacy string-based Profession/Breed to numeric IDs
   * Safe to call multiple times (idempotent)
   * Automatically called when loading profiles
   */
  migrateProfileCharacterIds(profile: TinkerProfile): TinkerProfile {
    let needsMigration = false;
    const migrated = structuredClone(profile);

    // Migrate Profession if it's a string
    if (typeof migrated.Character.Profession !== 'number') {
      const oldValue = migrated.Character.Profession;
      migrated.Character.Profession = normalizeProfessionToId(oldValue as any);
      console.log(
        `[Migration] Converted profession "${oldValue}" to ID ${migrated.Character.Profession}`
      );
      needsMigration = true;
    }

    // Migrate Breed if it's a string
    if (typeof migrated.Character.Breed !== 'number') {
      const oldValue = migrated.Character.Breed;
      migrated.Character.Breed = normalizeBreedToId(oldValue as any);
      console.log(`[Migration] Converted breed "${oldValue}" to ID ${migrated.Character.Breed}`);
      needsMigration = true;
    }

    if (needsMigration) {
      migrated.updated = new Date().toISOString();
    }

    return migrated;
  }

  /**
   * Migrate profile to include structured PerkSystem
   * Handles migration from legacy PerksAndResearch formats
   */
  migrateProfilePerks(profile: TinkerProfile): TinkerProfile {
    // Check if already using structured PerkSystem
    if (
      profile.PerksAndResearch &&
      typeof profile.PerksAndResearch === 'object' &&
      'perks' in profile.PerksAndResearch &&
      'standardPerkPoints' in profile.PerksAndResearch &&
      'aiPerkPoints' in profile.PerksAndResearch
    ) {
      return profile; // Already migrated
    }

    console.log(
      `[ProfileTransformer] Migrating profile ${profile.Character.Name} to structured PerkSystem`
    );

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
        available: standardPerkPoints,
      },
      aiPerkPoints: {
        total: aiPerkPoints,
        spent: 0,
        available: aiPerkPoints,
      },
      research: [],
      lastCalculated: new Date().toISOString(),
    };

    // Preserve any existing PerksAndResearch data if possible
    const legacyPerksAndResearch = profile.PerksAndResearch as any;
    if (legacyPerksAndResearch && Array.isArray(legacyPerksAndResearch)) {
      // Legacy array format - try to convert if possible
      console.log(
        `[ProfileTransformer] Found legacy perk array with ${legacyPerksAndResearch.length} entries`
      );

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
                const researchEntry: any = {
                  aoid: legacyPerk.aoid,
                  name: legacyPerk.name,
                  level: legacyPerk.level,
                  type: 'LE',
                };
                // Preserve item details if available
                if (legacyPerk.item) {
                  researchEntry.item = legacyPerk.item;
                }
                newPerkSystem.research.push(researchEntry);
              } else {
                // SL or AI perk (costs points)
                const cost = 1; // Each perk costs exactly 1 point regardless of level
                const perkEntry: any = {
                  aoid: legacyPerk.aoid,
                  name: legacyPerk.name,
                  level: legacyPerk.level,
                  type: perkType as 'SL' | 'AI',
                };
                // Preserve item details if available
                if (legacyPerk.item) {
                  perkEntry.item = legacyPerk.item;
                }
                newPerkSystem.perks.push(perkEntry);

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

      console.log(
        `[ProfileTransformer] Migrated ${newPerkSystem.perks.length} perks and ${newPerkSystem.research.length} research entries`
      );
    }

    // Ensure point totals don't go negative
    newPerkSystem.standardPerkPoints.available = Math.max(
      0,
      newPerkSystem.standardPerkPoints.available
    );
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
    if (
      perkSystem &&
      typeof perkSystem === 'object' &&
      'perks' in perkSystem &&
      'standardPerkPoints' in perkSystem &&
      'aiPerkPoints' in perkSystem
    ) {
      return perkSystem;
    }

    // If legacy format or undefined, create empty structured system
    return {
      perks: [],
      standardPerkPoints: {
        total: 0,
        spent: 0,
        available: 0,
      },
      aiPerkPoints: {
        total: 0,
        spent: 0,
        available: 0,
      },
      research: [],
      lastCalculated: new Date().toISOString(),
    };
  }

  /**
   * Import perks from various formats and normalize to PerkSystem
   */
  private importPerksFromData(data: any, result: ProfileImportResult): PerkSystem {
    // Handle structured PerkSystem
    if (
      data.PerksAndResearch &&
      typeof data.PerksAndResearch === 'object' &&
      'perks' in data.PerksAndResearch
    ) {
      result.warnings.push('Imported structured perk system');
      return data.PerksAndResearch as PerkSystem;
    }

    // Handle legacy array format
    if (data.PerksAndResearch && Array.isArray(data.PerksAndResearch)) {
      result.warnings.push(
        `Converted ${data.PerksAndResearch.length} perks from legacy array format`
      );
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
      lastCalculated: new Date().toISOString(),
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
      lastCalculated: new Date().toISOString(),
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
          type: 'LE',
        });
      } else {
        // SL or AI perk
        system.perks.push({
          aoid: perk.aoid || 0,
          name: perk.name || `Perk ${perk.aoid}`,
          level: perkLevel,
          type: perkType as 'SL' | 'AI',
        });

        // Update point tracking
        const cost = 1; // Each perk costs exactly 1 point regardless of level
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
}
