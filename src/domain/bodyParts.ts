import type { Exercise } from './types'

/** Parties du corps du catalogue, dans l'ordre d'affichage. Doit rester identique à la contrainte SQL (004). */
export const BODY_PARTS = [
  'Pectoraux', 'Dos', 'Épaules', 'Biceps', 'Triceps', 'Avant-bras',
  'Abdos', 'Quadriceps', 'Ischios', 'Fessiers', 'Mollets', 'Cardio / Autre',
] as const

export type BodyPart = (typeof BODY_PARTS)[number]

export const OTHER_PART: BodyPart = 'Cardio / Autre'

/** Ramène une valeur stockée (y compris les anciennes, comme « Jambes ») à une partie du corps de la liste. */
export function toBodyPart(value: string | null | undefined): BodyPart {
  if (value === 'Jambes') return 'Quadriceps'
  return (BODY_PARTS as readonly string[]).includes(value ?? '') ? (value as BodyPart) : OTHER_PART
}

export function groupByBodyPart<T extends Pick<Exercise, 'name' | 'muscle_group'>>(exercises: T[]): { part: BodyPart; items: T[] }[] {
  return BODY_PARTS
    .map((part) => ({
      part,
      items: exercises.filter((e) => toBodyPart(e.muscle_group) === part).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    }))
    .filter((g) => g.items.length > 0)
}
