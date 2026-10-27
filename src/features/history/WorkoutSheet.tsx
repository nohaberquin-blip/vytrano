import { Sheet } from '../../app/Sheet'
import { useUnit } from '../../app/units'
import { db } from '../../data/db'
import { useLive } from '../../data/useLive'
import { setsOf } from '../../data/workouts'
import { KIND_LABELS, setKind } from '../../domain/methods'
import type { Workout } from '../../domain/types'

/** Détail d'une séance terminée : séries validées, par exercice. */
export function WorkoutSheet({ workout, onClose }: { workout: Workout; onClose(): void }) {
  const { show } = useUnit()
  const rows = useLive(async () => {
    const sets = await setsOf(workout.id)
    const ids = [...new Set(sets.map((s) => s.exercise_id))]
    const exercises = await db.exercises.bulkGet(ids)
    return ids.map((id, i) => ({ id, name: exercises[i]?.name ?? 'Exercice', sets: sets.filter((s) => s.exercise_id === id && s.done) }))
  }, [workout.id])
  return (
    <Sheet title={workout.name} onClose={onClose}>
      {rows?.map((ex) => (
        <div key={ex.id} className="card">
          <p className="card-title">{ex.name}</p>
          {ex.sets.length === 0
            ? <p className="muted small">Aucune série validée</p>
            : <ul className="list num">{ex.sets.map((s, i) => <li key={s.id} className="small">{i + 1}. {setKind(s) !== 'work' && <span className={`tag tag-${setKind(s)}`}>{KIND_LABELS[setKind(s)]}</span>} {show(s.weight)} × {s.reps}</li>)}</ul>}
        </div>
      ))}
    </Sheet>
  )
}
