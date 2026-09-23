/**
 * Error message extraction and normalisation
 *
 * Kept apart from api-client so that tests which mock api-client with a
 * factory still get the real helpers.
 */

import type { UserFriendlyError } from '../types/api';

/**
 * The message of anything caught: an Error, or the UserFriendlyError objects
 * the API client throws. Empty when there is none, so callers can fall back.
 */
export function errorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return typeof error.message === 'string' ? error.message : '';
  }
  return '';
}

/** True for the errors the API client throws (see TinkerToolsApiClient.handleError) */
export function isUserFriendlyError(error: unknown): error is UserFriendlyError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'title' in error &&
    'message' in error &&
    'recoverable' in error
  );
}

/** Normalise anything caught from an API call into a UserFriendlyError */
export function toUserFriendlyError(error: unknown): UserFriendlyError {
  if (isUserFriendlyError(error)) return error;
  return {
    type: 'error',
    title: 'Unexpected Error',
    message: error instanceof Error ? error.message : String(error),
    action: 'Please try again or contact support',
    recoverable: false,
  };
}
