import { useLive } from '../../data/useLive'
import { useUnit } from '../../app/units'
import { exerciseHistory } from '../../data/workouts'
import { useAuth } from '../auth/AuthProvider'

export function ExerciseHistory({ exerciseId }: { exerciseId: string }) {
  const { show } = useUnit()
  const userId = useAuth().user?.id ?? ''
  const rows = useLive(() => exerciseHistory(userId, exerciseId, 5), [userId, exerciseId])
  if (!rows || rows.length === 0) return null
  return (
    <>
      <h2>Dernières séances</h2>
      <ul className="list">
        {rows.map(({ workout, sets }) => (
          <li key={workout.id} className="row between small" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
            <span className="muted">
              {new Date(workout.finished_at!).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              {workout.lightened && ' · allégée'}
            </span>
            <span className="num">{show(Math.max(...sets.filter((s) => s.done).map((s) => s.weight), 0))} · {sets.filter((s) => s.done).map((s) => s.reps).join(', ')}</span>
          </li>
        ))}
      </ul>
    </>
  )
}
