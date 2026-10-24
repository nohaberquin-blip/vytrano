import { useUnit } from '../../app/units'
import type { WorkoutSet } from '../../domain/types'
import { WeightInput } from '../exercises/WeightInput'

export function ExerciseCard({ name, sets, last, targetWeight, onUpdate, onAddSet }: {
  name: string
  sets: WorkoutSet[]
  /** Séries de la dernière séance terminée pour cet exercice. */
  last: WorkoutSet[]
  targetWeight?: number
  onUpdate(s: WorkoutSet): void
  onAddSet(): void
}) {
  const { show, toDisplay, toKg } = useUnit()
  const target = targetWeight ?? sets[0]?.weight ?? 0
  const lastDone = last.filter((s) => s.done)
  const lastMax = lastDone.length ? Math.max(...lastDone.map((s) => s.weight)) : null
  const allDone = sets.length > 0 && sets.every((s) => s.done)

  return (
    <div className="card" style={allDone ? { borderColor: 'var(--accent)' } : undefined}>
      <div className="row between">
        <p className="card-title">{name}</p>
        {allDone && <span className="pill">✓</span>}
      </div>
      <div className="row">
        <span className="target num">{sets.length} × {sets[0]?.target_reps} à {show(target)}</span>
        {lastMax !== null && target > lastMax && <span className="up" aria-label="Charge en hausse">↑</span>}
      </div>
      {lastDone.length > 0 && (
        <p className="muted small num" style={{ margin: '2px 0 0' }}>
          Dernière fois : {show(lastMax!)} · {lastDone.map((s) => s.reps).join(', ')}
        </p>
      )}
      <div className="set-row muted small" style={{ marginTop: 12 }} aria-hidden>
        <span>#</span><span style={{ textAlign: 'center' }}>Charge</span><span style={{ textAlign: 'center' }}>Reps</span><span />
      </div>
      {sets.map((s, i) => (
        <div key={s.id} className={s.done ? 'set-row done' : 'set-row'}>
          <span className="muted num">{i + 1}</span>
          <WeightInput label={`Charge série ${i + 1}`} value={toDisplay(s.weight)}
            onChange={(v) => v !== null && onUpdate({ ...s, weight: toKg(v) })} />
          <input className="input num" aria-label={`Reps série ${i + 1}`} inputMode="numeric" value={s.reps}
            onFocus={(e) => e.target.select()}
            onChange={(e) => /^\d{0,3}$/.test(e.target.value) && onUpdate({ ...s, reps: Number(e.target.value) })} />
          <button className={s.done ? 'check on' : 'check'} aria-pressed={s.done}
            aria-label={`${s.done ? 'Annuler' : 'Valider'} la série ${i + 1}`}
            onClick={() => onUpdate({ ...s, done: !s.done })}>✓</button>
        </div>
      ))}
      <button className="btn ghost small" style={{ marginTop: 6 }} onClick={onAddSet}>＋ Série</button>
    </div>
  )
}
