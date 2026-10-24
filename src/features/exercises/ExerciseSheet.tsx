import { useState } from 'react'
import type { Exercise, UserExercise } from '../../domain/types'
import { Sheet } from '../../app/Sheet'
import { useUnit } from '../../app/units'
import { WeightInput } from './WeightInput'
import { ExerciseHistory } from './ExerciseHistory'
import { MethodEditor } from './MethodEditor'
import { readTemplate, templateError, type SetTemplate } from '../../domain/methods'
import { baseRest, formatClock, parseClock } from '../../domain/rest'

export function ExerciseSheet({ exercise, fiche, save, onClose, onRemove }: {
  exercise: Exercise
  fiche: UserExercise
  save(f: UserExercise): Promise<unknown>
  onClose(): void
  onRemove?(): void
}) {
  const { unit, toDisplay, toKg } = useUnit()
  const [weight, setWeight] = useState<number | null>(toDisplay(fiche.current_weight))
  const [increment, setIncrement] = useState<number | null>(toDisplay(fiche.increment))
  const [rounding, setRounding] = useState<number | null>(toDisplay(fiche.rounding ?? 2.5))
  const [auto, setAuto] = useState(fiche.auto_progression !== false)
  const [template, setTemplate] = useState<SetTemplate>(() => readTemplate(fiche.template, fiche))
  const [restText, setRestText] = useState(fiche.rest_seconds ? formatClock(fiche.rest_seconds) : '')
  const rest = parseClock(restText)
  const restError = rest !== null && (Number.isNaN(rest) || rest < 10 || rest > 600)

  const methodError = templateError(template)
  const valid = weight !== null && increment !== null && rounding !== null && rounding > 0 && !methodError && !restError

  async function submit() {
    if (!valid) return
    await save({
      ...fiche,
      current_weight: toKg(weight!), increment: toKg(increment!), rounding: toKg(rounding!),
      auto_progression: auto, template, rest_seconds: rest,
    })
    onClose()
  }

  return (
    <Sheet title={exercise.name} onClose={onClose}>
      <div className="grid-2">
        <label className="field"><span>Charge ({unit})</span>
          <WeightInput label={`Charge (${unit})`} value={weight} onChange={setWeight} />
        </label>
        <label className="field"><span>Palier ({unit})</span>
          <WeightInput label={`Palier (${unit})`} value={increment} onChange={setIncrement} />
        </label>
        <label className="field"><span>Arrondi ({unit})</span>
          <WeightInput label={`Arrondi (${unit})`} value={rounding} onChange={setRounding} />
        </label>
      </div>
      {weight === null && <p className="error">Charge invalide</p>}
      {increment === null && <p className="error">Palier invalide</p>}
      {(rounding === null || rounding <= 0) && <p className="error">Arrondi invalide</p>}
      <label className="field"><span>Repos de base</span>
        <input aria-label="Repos de base" className="input num" inputMode="numeric" value={restText}
          placeholder={`Auto (${formatClock(baseRest(fiche.target_reps))} selon les reps)`} onChange={(e) => setRestText(e.target.value)} />
      </label>
      {restError && <p className="error">Repos : 0:10 à 10:00</p>}
      <label className="switch">
        <span>Progression automatique</span>
        <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
      </label>
      <p className="muted small" style={{ marginTop: 0 }}>
        {auto
          ? 'Quand toutes les séries qui comptent atteignent leurs reps, la charge de référence augmente du palier.'
          : 'Tu choisis tes charges : chaque séance reprend celles réellement soulevées la fois précédente.'}
      </p>
      <MethodEditor value={template} reference={weight === null ? fiche.current_weight : toKg(weight)}
        rounding={rounding === null ? undefined : toKg(rounding)} onChange={setTemplate} />
      <button className="btn primary block big" disabled={!valid} onClick={submit}>Enregistrer</button>
      <ExerciseHistory exerciseId={exercise.id} />
      {onRemove && (
        <button className="btn danger block" style={{ marginTop: 16 }} onClick={onRemove}>Retirer de mes exercices</button>
      )}
    </Sheet>
  )
}
