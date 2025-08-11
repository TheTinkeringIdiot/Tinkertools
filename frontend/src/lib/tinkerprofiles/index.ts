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
export { ProfileTransformer } from './transformer';

export type {
  TinkerProfile,
  ProfileMetadata,
  ProfileExportFormat,
  ProfileImportResult,
  ProfileValidationResult,
  ProfileStorageOptions,
  ProfileEvents
} from './types';

export {
  createDefaultProfile,
  createDefaultNanoProfile,
  ANARCHY_PROFESSIONS,
  ANARCHY_BREEDS,
  ANARCHY_FACTIONS,
  ANARCHY_EXPANSIONS,
  ACCOUNT_TYPES,
  DEFAULT_SKILLS,
  STORAGE_KEYS
} from './constants';