/**
 * Nano casting compatibility shared by the TinkerNanos list, card and detail views.
 *
 * What it takes to cast a nano is the criteria of the nano item's Use action, not
 * its spells' criteria (those gate individual effects). They are evaluated by the
 * shared action-criteria machinery against a stat-ID map of the character, as
 * built by mapProfileToStats. Criteria a stat map can't decide (running nanos,
 * perks, game state, the target's stats) leave a nano unverified, not blocked.
 */
import type { Action } from '@/types/api';
import type { NanoCastState, NanoCompatibilityInfo, NanoProgram } from '@/types/nano';
import {
  checkActionRequirements,
  parseAction,
  type DisplayCriterion,
} from '@/services/action-criteria';

const USE_ACTION = 3;

export function getNanoUseAction(nano: NanoProgram): Action | undefined {
  return nano.actions?.find((action) => action.action === USE_ACTION);
}

/** The stat requirements of the nano's Use action, ready for display */
export function getNanoRequirements(nano: NanoProgram): DisplayCriterion[] {
  const useAction = getNanoUseAction(nano);
  return useAction
    ? parseAction(useAction).criteria.filter((criterion) => criterion.isStatRequirement)
    : [];
}

export function getNanoCompatibility(
  nano: NanoProgram,
  characterStats: Record<number, number>
): NanoCompatibilityInfo {
  const useAction = getNanoUseAction(nano);
  const { status, unmetRequirements, unverifiedRequirements } = useAction
    ? checkActionRequirements(parseAction(useAction), characterStats)
    : { status: 'met' as const, unmetRequirements: [], unverifiedRequirements: [] };

  const castState: NanoCastState =
    status === 'met' ? 'castable' : status === 'unknown' ? 'unverified' : 'blocked';

  // Share of the stat requirements met; below 100 whenever the nano is blocked.
  // Requirements the profile can't check don't count either way.
  const total = new Set(getNanoRequirements(nano).map((req) => req.stat)).size;
  const unmetStats = new Set(
    unmetRequirements.filter((req) => !req.description).map((req) => req.stat)
  ).size;
  const metShare = total > 0 ? Math.round((Math.max(total - unmetStats, 0) / total) * 100) : 0;
  const compatibilityScore = castState === 'blocked' ? Math.min(metShare, 99) : 100;

  return {
    castState,
    canCast: castState !== 'blocked',
    compatibilityScore,
    unmetRequirements,
    // The same condition can appear in several alternatives
    unverifiedRequirements: [
      ...new Map(
        unverifiedRequirements.map((criterion) => [criterion.description, criterion])
      ).values(),
    ],
    memoryUsage: nano.memoryUsage || 0,
    nanoPointCost: nano.nanoPointCost || 0,
  };
}
