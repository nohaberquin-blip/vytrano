import type { Challenge } from '../../domain/types'

/** « Faire 12 séances », « Squat à 120 kg », « Squat : 1RM estimé 130 kg ». */
export function challengeTitle(c: Challenge, exerciseName: string | undefined, show: (kg: number) => string): string {
  if (c.kind !== 'lift') return `Faire ${c.target} séance${c.target > 1 ? 's' : ''}`
  const name = exerciseName ?? '…'
  return c.metric === 'e1rm' ? `${name} : 1RM estimé ${show(c.target)}` : `${name} à ${show(c.target)}`
}
