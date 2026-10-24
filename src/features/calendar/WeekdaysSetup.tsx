import { useState } from 'react'
import { saveWeekdays } from '../../data/calendar'
import { toISODate } from '../../domain/calendar'
import { useUserId } from '../auth/AuthProvider'

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

/** Choix des jours d'entraînement (1 = lundi … 7 = dimanche). */
export function WeekdaysSetup({ initial, onDone, onCancel }: { initial: number[]; onDone(): void; onCancel?(): void }) {
  const userId = useUserId()
  const [selected, setSelected] = useState<number[]>(initial)
  const toggle = (n: number) => setSelected((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]))

  async function save() {
    await saveWeekdays(userId, selected, toISODate(new Date()))
    onDone()
  }

  return (
    <div>
      <h2>Quels jours tu t'entraînes ?</h2>
      <p className="muted small">Les jours de ton programme y seront placés dans l'ordre. Les autres jours sont des repos.</p>
      <div className="weekday-picker">
        {DAYS.map((name, i) => (
          <button key={name} type="button" aria-label={name} aria-pressed={selected.includes(i + 1)} onClick={() => toggle(i + 1)}>
            {name[0]}
          </button>
        ))}
      </div>
      <button className="btn primary block" disabled={selected.length === 0} onClick={save}>Valider</button>
      {onCancel && <button className="btn ghost block" style={{ marginTop: 8 }} onClick={onCancel}>Annuler</button>}
    </div>
  )
}
