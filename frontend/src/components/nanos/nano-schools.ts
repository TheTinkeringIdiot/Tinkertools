/**
 * Nano schools as TinkerNanos shows them: the game's NanoSchool stat (405),
 * which the /nanos endpoints send as a nano's school. Not the nano skills
 * (Matter Creation, Time and Space...), which TinkerNukes calls schools.
 */
import type { NanoSchoolName } from '@/types/nano';

export const NANO_SCHOOLS: readonly NanoSchoolName[] = [
  'Combat',
  'Medical',
  'Protection',
  'Psi',
  'Space',
];

const SCHOOL_AVATAR_CLASSES: Record<NanoSchoolName, string> = {
  Combat: 'bg-red-500 text-white',
  Medical: 'bg-green-500 text-white',
  Protection: 'bg-blue-500 text-white',
  Psi: 'bg-purple-500 text-white',
  Space: 'bg-yellow-500 text-white',
};

/** Avatar colours for a nano's school; neutral when it has none */
export function schoolAvatarClass(school: NanoSchoolName | null | undefined): string {
  return (school && SCHOOL_AVATAR_CLASSES[school]) || 'bg-surface-500 text-white';
}

/** Two letters for an avatar: Protection and Psi share their initial */
export function schoolInitials(school: NanoSchoolName | null | undefined): string {
  return school ? school.slice(0, 2) : 'N';
}
