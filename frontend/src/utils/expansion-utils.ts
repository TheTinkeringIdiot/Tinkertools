/**
 * Expansion Utilities
 *
 * Converts account type to expansion bitflag value for stat 389.
 * Converts specialization level to cumulative bitflag for stat 182.
 * Used for requirement validation in TinkerItems and TinkerNukes.
 */

/**
 * Converts account type to expansion bitflag value for stat 389
 *
 * Bitflag breakdown:
 * - Froob: 1 (NotumWars only)
 * - Sloob: 7 (None + NotumWars + Shadowlands + ShadowlandsPreorder = 1|2|4)
 * - Paid: 127 (All expansion flags = 1|2|4|8|16|32|64)
 *
 * @param accountType - The account type from Character.AccountType
 * @returns The expansion bitflag value
 */
export function accountTypeToExpansionBitflag(accountType: string): number {
  switch (accountType) {
    case 'Froob':
      return 1    // NotumWars only (1 << 0)
    case 'Sloob':
      return 7    // None + NotumWars + Shadowlands + ShadowlandsPreorder (1|2|4)
    case 'Paid':
      return 127  // All expansion flags (1|2|4|8|16|32|64)
    default:
      return 0    // Classic/None
  }
}

/**
 * Converts specialization level to cumulative bitflag for stat 182
 *
 * Specializations are cumulative - having spec 4 means you also have 1-3.
 * The bitflags accumulate: spec 4 = 1|2|4|8 = 15
 *
 * Bitflag mapping:
 * - Spec 0: 0 (no specialization)
 * - Spec 1: 1 (1 << 0)
 * - Spec 2: 3 (1|2)
 * - Spec 3: 7 (1|2|4)
 * - Spec 4: 15 (1|2|4|8)
 *
 * @param specLevel - The specialization level (0-4)
 * @returns The cumulative specialization bitflag value
 */
export function specializationLevelToBitflag(specLevel: number): number {
  if (specLevel <= 0) return 0;
  if (specLevel >= 4) return 15; // 1|2|4|8

  // Calculate cumulative bitflag: (1 << specLevel) - 1 + (1 << specLevel)
  // Simpler: (1 << (specLevel + 1)) - 1
  return (1 << (specLevel + 1)) - 1;
}
