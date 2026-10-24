import type { ProgramDay } from './types'

/** Jour suivant dans l'ordre du programme, en revenant au début après le dernier. */
export function nextDay(days: ProgramDay[], lastDoneDayId: string | null): ProgramDay | null {
  if (days.length === 0) return null
  const sorted = [...days].sort((a, b) => a.position - b.position)
  const i = sorted.findIndex((d) => d.id === lastDoneDayId)
  return i === -1 ? sorted[0] : sorted[(i + 1) % sorted.length]
}
