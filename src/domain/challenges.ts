import { workoutDate } from './calendar'
import { counts, oneRepMax, type SessionSets } from './records'
import type { Challenge, Workout } from './types'

export interface ChallengeProgress { value: number; target: number; status: 'active' | 'done' | 'failed'; doneOn: string | null }

/** Progression d'un défi entre `start` et `end_date` inclus ; réussi le jour où la cible est atteinte. */
export function challengeProgress(c: Challenge, workouts: Workout[], history: Map<string, SessionSets[]>, today: string): ChallengeProgress {
  const inRange = (d: string) => d >= c.start && d <= c.end_date
  let value = 0
  let doneOn: string | null = null
  if (c.kind === 'lift') {
    for (const { workout, sets } of history.get(c.exercise_id ?? '') ?? []) {
      const date = workoutDate(workout)
      if (!inRange(date)) continue
      for (const s of sets.filter(counts)) value = Math.max(value, c.metric === 'e1rm' ? oneRepMax(s) : s.weight)
      if (!doneOn && value >= c.target) doneOn = date
    }
  } else {
    const dates = workouts.map(workoutDate).filter(inRange).sort()
    value = dates.length
    doneOn = dates[c.target - 1] ?? null
  }
  const status = doneOn ? 'done' : c.end_date < today ? 'failed' : 'active'
  return { value, target: c.target, status, doneOn }
}
