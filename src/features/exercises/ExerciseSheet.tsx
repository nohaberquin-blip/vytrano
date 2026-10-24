import { useState } from 'react'
import type { Exercise, UserExercise } from '../../domain/types'
import { Sheet } from '../../app/Sheet'
import { useUnit } from '../../app/units'
import { WeightInput } from './WeightInput'
import { ExerciseHistory } from './ExerciseHistory'

const toInt = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s) : null)

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
  const [sets, setSets] = useState(String(fiche.sets))
  const [reps, setReps] = useState(String(fiche.target_reps))

  const setsN = toInt(sets)
  const repsN = toInt(reps)
  const valid = weight !== null && increment !== null && !!setsN && setsN <= 20 && !!repsN && repsN <= 100

  async function submit() {
    if (!valid) return
    await save({ ...fiche, current_weight: toKg(weight!), increment: toKg(increment!), sets: setsN!, target_reps: repsN! })
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
        <label className="field"><span>Séries</span>
          <input aria-label="Séries" className="input" inputMode="numeric" value={sets} onChange={(e) => setSets(e.target.value)} />
        </label>
        <label className="field"><span>Reps visées</span>
          <input aria-label="Reps visées" className="input" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} />
        </label>
      </div>
      {weight === null && <p className="error">Charge invalide</p>}
      {increment === null && <p className="error">Palier invalide</p>}
      {(!setsN || setsN > 20) && <p className="error">Séries : entre 1 et 20</p>}
      {(!repsN || repsN > 100) && <p className="error">Reps : entre 1 et 100</p>}
      <p className="muted small">
        Quand toutes les séries atteignent les reps visées, la charge augmente du palier à la séance suivante.
      </p>
      <button className="btn primary block big" disabled={!valid} onClick={submit}>Enregistrer</button>
      <ExerciseHistory exerciseId={exercise.id} />
      {onRemove && (
        <button className="btn danger block" style={{ marginTop: 16 }} onClick={onRemove}>Retirer de mes exercices</button>
      )}
    </Sheet>
  )
}
