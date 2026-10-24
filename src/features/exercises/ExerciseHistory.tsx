import { db } from '../../data/db'
import { useLive } from '../../data/useLive'
import { useUnit } from '../../app/units'
import type { WorkoutSet } from '../../domain/types'

/** Les séries validées des séances terminées pour un exercice, les plus récentes d'abord. */
export async function exerciseHistory(exerciseId: string, limit: number) {
  const sets = await db.workout_sets.where('exercise_id').equals(exerciseId).filter((s) => s.done).toArray()
  const byWorkout = new Map<string, WorkoutSet[]>()
  for (const s of sets) byWorkout.set(s.workout_id, [...(byWorkout.get(s.workout_id) ?? []), s])
  const workouts = (await db.workouts.bulkGet([...byWorkout.keys()]))
    .filter((w) => w && w.status === 'done')
    .sort((a, b) => (b!.finished_at ?? '').localeCompare(a!.finished_at ?? ''))
    .slice(0, limit)
  return workouts.map((w) => ({ workout: w!, sets: byWorkout.get(w!.id)!.sort((a, b) => a.position - b.position) }))
}

export function ExerciseHistory({ exerciseId }: { exerciseId: string }) {
  const { show } = useUnit()
  const rows = useLive(() => exerciseHistory(exerciseId, 5), [exerciseId])
  if (!rows || rows.length === 0) return null
  return (
    <>
      <h2>Dernières séances</h2>
      <ul className="list">
        {rows.map(({ workout, sets }) => (
          <li key={workout.id} className="row between small" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
            <span className="muted">{new Date(workout.finished_at!).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
            <span className="num">{show(Math.max(...sets.map((s) => s.weight)))} · {sets.map((s) => s.reps).join(', ')}</span>
          </li>
        ))}
      </ul>
    </>
  )
}
