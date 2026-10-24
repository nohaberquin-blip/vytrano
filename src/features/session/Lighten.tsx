import { useEffect, useState } from 'react'
import { useUnit } from '../../app/units'
import { db } from '../../data/db'
import { previewLighten } from '../../data/workouts'
import type { LightenChange } from '../../domain/lighten'
import type { Lightening, ProgramDay } from '../../domain/types'
import { useUserId } from '../auth/AuthProvider'

const CHOICES: { mode: Lightening; label: string }[] = [
  { mode: 'minus10', label: '−10 %' },
  { mode: 'minus20', label: '−20 %' },
  { mode: 'fewer', label: 'Moins de séries' },
]

/**
 * « Je ne me sens pas bien » (jour de règles) : charges −10 % / −20 % ou moins de séries, avec aperçu.
 * `mode` null = séance normale.
 */
export function Lighten({ day, mode, onChange }: { day: ProgramDay; mode: Lightening | null; onChange(m: Lightening | null): void }) {
  const userId = useUserId()
  const { show, toDisplay } = useUnit()
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<{ changes: LightenChange[]; names: Map<string, string> } | null>(null)

  useEffect(() => {
    setPreview(null)
    if (!mode) return
    let live = true
    void (async () => {
      const changes = await previewLighten(userId, day, mode)
      const items = await db.program_day_exercises.bulkGet(changes.map((c) => c.key))
      const exercises = await db.exercises.bulkGet(items.map((i) => i?.exercise_id ?? ''))
      const names = new Map(changes.map((c, i) => [c.key, exercises[i]?.name ?? '…']))
      if (live) setPreview({ changes, names })
    })()
    return () => { live = false }
  // day.id : l’objet jour est recréé à chaque lecture de la base.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, day.id, mode])

  if (!open) {
    return <button className="link-btn time-link" onClick={() => setOpen(true)}>🌸 Je ne me sens pas bien</button>
  }

  return (
    <section className="card time-limit" aria-label="Séance allégée">
      <p className="card-title">Séance allégée</p>
      <div className="lighten-choices" role="group">
        {CHOICES.map((c) => (
          <button key={c.mode} type="button" aria-pressed={mode === c.mode} onClick={() => onChange(c.mode)}>{c.label}</button>
        ))}
      </div>
      {mode && !preview && <p className="muted small">Calcul…</p>}
      {preview && preview.changes.length === 0 && <p className="muted small">Rien à alléger dans cette séance.</p>}
      {preview && preview.changes.length > 0 && (
        <ul className="time-changes small">
          {preview.changes.map((c) => (
            <li key={c.key}>
              {preview.names.get(c.key)} : {mode === 'fewer' ? `${c.from} → ${c.to} séries` : `${toDisplay(c.fromKg)} → ${show(c.toKg)}`}
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">Cette séance ne compte pas pour la progression : la suivante repart de tes charges habituelles.</p>
      <button className="btn ghost block small" onClick={() => { onChange(null); setOpen(false) }}>Annuler</button>
    </section>
  )
}
