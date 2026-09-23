/**
 * Item requirement extraction shared by the TinkerItems list/card/comparison views.
 *
 * The API does not return a flat requirements list for items; requirements live
 * in the criteria of the item's actions. This derives the minimum-stat
 * requirements ("stat >= value") from the action that governs using the item.
 */
import type { Item } from '@/types/api';
import { getCriteriaRequirements } from '@/services/action-criteria';

export interface ItemStatRequirement {
  /** Stat ID */
  stat: number;
  /** Minimum value required */
  value: number;
}

// Wield (8), Wear (6), Use (3): the first one present holds the equip/use requirements
const REQUIREMENT_ACTION_IDS = [8, 6, 3];

export function getItemRequirements(item: Item): ItemStatRequirement[] {
  const actions = item.actions ?? [];
  for (const actionId of REQUIREMENT_ACTION_IDS) {
    const action = actions.find((a) => a.action === actionId);
    if (!action) continue;

    return getCriteriaRequirements(action.criteria ?? []).flatMap((req) =>
      req.minValue !== undefined ? [{ stat: req.stat, value: req.minValue }] : []
    );
  }
  return [];
}
