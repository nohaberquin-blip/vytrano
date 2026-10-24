import { useEffect, useState } from 'react'
import { Sheet } from '../../app/Sheet'
import { useUnit } from '../../app/units'
import { fetchWorkoutDetail, type FeedEntry } from '../../data/social'
import { KIND_LABELS } from '../../domain/methods'

type Detail = Awaited<ReturnType<typeof fetchWorkoutDetail>>

export function WorkoutDetail({ entry, onClose }: { entry: FeedEntry; onClose(): void }) {
  const { show } = useUnit()
  const [detail, setDetail] = useState<Detail | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    fetchWorkoutDetail(entry.id).then(setDetail, () => setError(true))
  }, [entry.id])

  return (
    <Sheet title={`${entry.username} · ${entry.day_name}`} onClose={onClose}>
      <p className="muted small">
        {new Date(entry.finished_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} · {entry.duration_min} min
      </p>
      {error && <p className="error">Impossible de charger la séance.</p>}
      {!detail && !error && <p className="muted">Chargement…</p>}
      {detail?.map((ex) => (
        <div key={ex.exerciseId} className="card">
          <p className="card-title">{ex.name}</p>
          {ex.sets.length === 0
            ? <p className="muted small">Aucune série validée</p>
            : <ul className="list num">
                {ex.sets.map((s, i) => <li key={i} className="small">{i + 1}. {s.kind !== 'work' && <span className={`tag tag-${s.kind}`}>{KIND_LABELS[s.kind]}</span>} {show(s.weight)} × {s.reps}</li>)}
              </ul>}
        </div>
      ))}
    </Sheet>
  )
}
