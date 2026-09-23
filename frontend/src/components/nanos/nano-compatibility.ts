/**
 * Nano casting compatibility shared by the TinkerNanos list, card and detail views.
 *
 * What it takes to cast a nano is the criteria of the nano item's Use action, not
 * its spells' criteria (those gate individual effects). They are evaluated by the
 * shared action-criteria machinery against a stat-ID map of the character, as
 * built by mapProfileToStats.
 */
import type { Action } from '@/types/api';
import type { NanoCompatibilityInfo, NanoProgram } from '@/types/nano';
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
  const { canPerform, unmetRequirements } = useAction
    ? checkActionRequirements(parseAction(useAction), characterStats)
    : { canPerform: true, unmetRequirements: [] };

  // Share of the stat requirements met; below 100 whenever the nano can't be cast
  const total = new Set(getNanoRequirements(nano).map((req) => req.stat)).size;
  const unmetStats = new Set(unmetRequirements.map((req) => req.stat)).size;
  const metShare = total > 0 ? Math.round((Math.max(total - unmetStats, 0) / total) * 100) : 0;
  const compatibilityScore = canPerform ? 100 : Math.min(metShare, 99);

  return {
    canCast: canPerform,
    compatibilityScore,
    unmetRequirements,
    memoryUsage: nano.memoryUsage || 0,
    nanoPointCost: nano.nanoPointCost || 0,
  };
}
