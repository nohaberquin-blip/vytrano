import { useEffect, useState } from 'react'
import { db } from '../../data/db'
import { previewWorkout } from '../../data/workouts'
import { TIME_CHOICES, TIME_MAX, TIME_MIN, type FitResult } from '../../domain/fitTime'
import type { Lightening, ProgramDay } from '../../domain/types'
import { useUserId } from '../auth/AuthProvider'

const mins = (seconds: number) => Math.max(1, Math.round(seconds / 60))

/**
 * Option facultative « temps limité » : choix du temps et aperçu de la séance adaptée.
 * `minutes` null = séance complète (rien n'est raccourci).
 */
export function TimeLimit({ day, minutes, lightened = null, onChange }: {
  day: ProgramDay
  minutes: number | null
  /** Allègement choisi : appliqué avant le temps, l'aperçu en tient compte. */
  lightened?: Lightening | null
  onChange(m: number | null): void
}) {
  const userId = useUserId()
  const [open, setOpen] = useState(false)
  // Temps libre : la personne tape son propre temps ; les propositions remplissent le champ.
  const [text, setText] = useState(minutes ? String(minutes) : '')
  const typed = /^\d{1,3}$/.test(text.trim()) ? Number(text.trim()) : null
  const invalid = text.trim() !== '' && (typed === null || typed < TIME_MIN || typed > TIME_MAX)

  function type(value: string) {
    setText(value)
    const n = /^\d{1,3}$/.test(value.trim()) ? Number(value.trim()) : null
    onChange(n !== null && n >= TIME_MIN && n <= TIME_MAX ? n : null)
  }
  function choose(m: number) {
    setText(String(m))
    onChange(m)
  }
  const [preview, setPreview] = useState<{ result: FitResult; names: Map<string, string> } | null>(null)

  useEffect(() => {
    setPreview(null)
    if (!minutes) return
    let live = true
    void (async () => {
      const result = await previewWorkout(userId, day, minutes, lightened)
      const items = await db.program_day_exercises.bulkGet(result.changes.map((c) => c.key))
      const exercises = await db.exercises.bulkGet(items.map((i) => i?.exercise_id ?? ''))
      const names = new Map(result.changes.map((c, i) => [c.key, exercises[i]?.name ?? '…']))
      if (live) setPreview({ result, names })
    })()
    return () => { live = false }
  // day.id : l’objet jour est recréé à chaque lecture de la base.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, day.id, minutes, lightened])

  if (!open) {
    return <button className="link-btn time-link" onClick={() => setOpen(true)}>⏱ Temps limité ?</button>
  }

  const r = preview?.result
  return (
    <section className="card time-limit" aria-label="Temps limité">
      <p className="card-title">Temps disponible</p>
      <div className="time-choices" role="group">
        {TIME_CHOICES.map((m) => (
          <button key={m} type="button" aria-pressed={minutes === m} onClick={() => choose(m)}>{m} min</button>
        ))}
      </div>
      <label className="field time-field"><span>Ou ton temps</span>
        <span className="row">
          <input aria-label="Temps disponible (minutes)" className="input num" inputMode="numeric" placeholder="ex. 35"
            value={text} onChange={(e) => type(e.target.value)} />
          <span className="muted">min</span>
        </span>
      </label>
      {invalid && <p className="error">Entre {TIME_MIN} et {TIME_MAX} min</p>}
      {minutes && !r && <p className="muted small">Calcul…</p>}
      {r && !r.changed && !r.minimum && <p>Ta séance tient en ~{mins(r.fullSeconds)} min</p>}
      {r && r.minimum && <p className="muted small">Au plus court : ~{mins(r.seconds)} min</p>}
      {r && r.changed && (
        <>
          <p><strong>Séance adaptée : ~{mins(r.seconds)} min</strong> <span className="muted">au lieu de ~{mins(r.fullSeconds)}</span></p>
          <ul className="time-changes small">
            {r.changes.map((c) => (
              <li key={c.key} className={c.to === 0 ? 'removed' : undefined}>
                {c.to === 0 ? `${preview!.names.get(c.key)} : retiré` : `${preview!.names.get(c.key)} : ${c.from} → ${c.to} séries`}
              </li>
            ))}
          </ul>
          <p className="muted small">Le reste est inchangé. Les charges, les répétitions et les repos ne bougent pas.</p>
        </>
      )}
      <button className="btn ghost block small" onClick={() => { onChange(null); setText(''); setOpen(false) }}>Annuler</button>
    </section>
  )
}
