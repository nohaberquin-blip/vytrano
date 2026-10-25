import { Fragment } from 'react'
import { useUnit } from '../../app/units'
import { ATTACHED_KINDS, COUNTING_KINDS, KIND_LABELS, setKind } from '../../domain/methods'
import type { WorkoutSet } from '../../domain/types'
import { oneRepMax, type RecordKind } from '../../domain/records'
import { WeightInput } from '../exercises/WeightInput'

const repsText = (s: WorkoutSet) =>
  setKind(s) === 'amrap' ? 'max' : s.target_reps === null ? 'échec'
    : s.target_reps_max ? `${s.target_reps}-${s.target_reps_max}` : String(s.target_reps)

/** « 1 × 5 à 120 kg + 3 × 8 à 102,5 kg » : séries qui comptent, regroupées quand elles se suivent à l'identique. */
function summary(sets: WorkoutSet[], show: (kg: number) => string): string {
  const groups: { n: number; reps: string; weight: number; kind: string }[] = []
  for (const s of sets.filter((x) => COUNTING_KINDS.includes(setKind(x)))) {
    const reps = repsText(s)
    const g = groups[groups.length - 1]
    if (g && g.reps === reps && g.weight === s.weight && g.kind === setKind(s)) g.n++
    else groups.push({ n: 1, reps, weight: s.weight, kind: setKind(s) })
  }
  return groups.map((g) => `${g.n} × ${g.reps} à ${show(g.weight)}`).join(' + ')
}

export function ExerciseCard({ name, methodLabel, sets, last, targetWeight, records, onUpdate, onAddSet }: {
  name: string
  /** Nom de la méthode, affiché au-dessus du résumé (absent pour une fiche classique). */
  methodLabel?: string
  sets: WorkoutSet[]
  /** Séries de la dernière séance terminée pour cet exercice. */
  last: WorkoutSet[]
  /** Charge de référence de la fiche. */
  targetWeight?: number
  /** Records battus par les séries validées de cette séance. */
  records?: Map<string, RecordKind[]>
  onUpdate(s: WorkoutSet): void
  onAddSet(): void
}) {
  const { show, toDisplay, toKg } = useUnit()
  const target = targetWeight ?? sets[0]?.weight ?? 0
  const lastDone = last.filter((s) => s.done && COUNTING_KINDS.includes(setKind(s)))
  const lastMax = lastDone.length ? Math.max(...lastDone.map((s) => s.weight)) : null
  const allDone = sets.length > 0 && sets.every((s) => s.done)
  // Étiquettes seulement s'il y a autre chose que des séries de travail (fiche classique inchangée).
  const labelled = sets.some((s) => setKind(s) !== 'work' || s.target_reps_max)

  return (
    <div className="card" style={allDone ? { borderColor: 'var(--accent)' } : undefined}>
      <div className="row between">
        <p className="card-title">{name}</p>
        {allDone && <span className="pill">✓</span>}
      </div>
      {methodLabel && <p className="muted small" style={{ margin: '0 0 2px' }}>{methodLabel}</p>}
      <div className="row">
        <span className="target num">{summary(sets, show)}</span>
        {lastMax !== null && target > lastMax && <span className="up" aria-label="Charge en hausse">↑</span>}
      </div>
      {lastDone.length > 0 && (
        <p className="muted small num" style={{ margin: '2px 0 0' }}>
          Dernière fois : {show(lastMax!)} · {lastDone.map((s) => s.reps).join(', ')}
        </p>
      )}
      <div className={labelled ? 'set-row labelled muted small' : 'set-row muted small'} style={{ marginTop: 12 }} aria-hidden>
        <span>#</span><span style={{ textAlign: 'center' }}>Charge</span><span style={{ textAlign: 'center' }}>Reps</span><span />
      </div>
      {sets.map((s, i) => {
        const kind = setKind(s)
        const classes = ['set-row', labelled && 'labelled', s.done && 'done', ATTACHED_KINDS.includes(kind) && i > 0 && setKind(sets[i - 1]) !== 'warmup' && 'attached']
        const noTarget = kind === 'amrap' || s.target_reps === null
        const record = s.done ? records?.get(s.id) : undefined
        return (
          <Fragment key={s.id}>
          <div className={classes.filter(Boolean).join(' ')}>
            <span className="set-label">
              <span className="muted num">{i + 1}</span>
              {labelled && <span className={`tag tag-${kind}`}>{KIND_LABELS[kind]}</span>}
              {s.target_reps_max ? <span className="muted small num">{s.target_reps}-{s.target_reps_max}</span> : null}
            </span>
            <WeightInput label={`Charge série ${i + 1}`} value={toDisplay(s.weight)}
              onChange={(v) => v !== null && onUpdate({ ...s, weight: toKg(v) })} />
            <input className="input num" aria-label={`Reps série ${i + 1}`} inputMode="numeric"
              placeholder={kind === 'amrap' ? 'max' : s.target_reps === null ? 'échec' : undefined}
              value={noTarget && s.reps === 0 && !s.done ? '' : s.reps}
              onFocus={(e) => e.target.select()}
              onChange={(e) => /^\d{0,3}$/.test(e.target.value) && onUpdate({ ...s, reps: Number(e.target.value) })} />
            <button className={s.done ? 'check on' : 'check'} aria-pressed={s.done}
              aria-label={`${s.done ? 'Annuler' : 'Valider'} la série ${i + 1}`}
              onClick={() => onUpdate({ ...s, done: !s.done })}>✓</button>
          </div>
          {record && (
            <p className="record-note small">
              🏆 Record ! {[
                record.includes('weight') && `Charge max ${show(s.weight)}`,
                record.includes('e1rm') && `1RM estimé ${show(oneRepMax(s))}`,
              ].filter(Boolean).join(' · ')}
            </p>
          )}
          </Fragment>
        )
      })}
      <button className="btn ghost small" style={{ marginTop: 6 }} onClick={onAddSet}>＋ Série</button>
    </div>
  )
}
