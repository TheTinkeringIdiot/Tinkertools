/**
 * TinkerProfiles Library - Core Profile Management for TinkerTools
 *
 * This library provides a unified interface for character profile management
 * across all TinkerTools applications, handling storage, validation, and
 * data transformations.
 */

export { TinkerProfilesManager } from './manager';
export { ProfileValidator } from './validator';
export { ProfileStorage } from './storage';
export { ProfileTransformer, interpolatedToItem } from './transformer';

export {
  currentGameVersion,
  gameVersionDisplayName,
  firstVersionOfFamily,
  familyOf,
  versionForImport,
  stampGameVersion,
  profileMatchesVersion,
} from './game-version';
export type { ProfileImportSource, ImportVersionTarget } from './game-version';

export { buildVersionCopy, buildSummary as buildVersionCopySummary } from './version-copy';
export type { ProfileVersionCopyResult, MissingItemReport } from './version-copy';

export type {
  TinkerProfile,
  ReadonlyTinkerProfile,
  VersionFlaggedItem,
  ImplantWithClusters,
  SkillData,
  ProfileMetadata,
  ProfileExportFormat,
  ProfileImportResult,
  ProfileImportOptions,
  BulkImportResult,
  ProfileValidationResult,
  ProfileStorageOptions,
  ProfileEvents,
  TinkerProfilesConfig,
  ProfileSearchFilters,
  ProfileSortOptions,
} from './types';

export {
  createDefaultProfile,
  createDefaultNanoProfile,
  createDefaultSkillsV4,
  ANARCHY_PROFESSIONS,
  ANARCHY_BREEDS,
  ANARCHY_FACTIONS,
  ANARCHY_EXPANSIONS,
  ACCOUNT_TYPES,
  DEFAULT_SKILLS,
  STORAGE_KEYS,
} from './constants';
