import { useState } from 'react'
import { Sheet } from '../../app/Sheet'
import { useUnit } from '../../app/units'
import { addWeight, listWeights, removeWeight } from '../../data/body'
import { useLive } from '../../data/useLive'
import { addDays, noon, toISODate } from '../../domain/calendar'
import { formatWeight, parseWeight } from '../../domain/parseWeight'
import type { WeightEntry } from '../../domain/types'
import { useUserId } from '../auth/AuthProvider'
import { PERIODS, WeightChart, periodStart } from './WeightChart'

const longDate = (d: string) => noon(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const shortDate = (d: string) => noon(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

/** Dernière pesée, écart récent, courbe et historique. */
export function WeightCard() {
  const userId = useUserId()
  const { show, toDisplay, unit } = useUnit()
  const entries = useLive(() => listWeights(userId), [userId])
  const [days, setDays] = useState<number | null>(90)
  const [adding, setAdding] = useState(false)
  const [history, setHistory] = useState(false)
  if (!entries) return null
  const today = toISODate(new Date())
  const latest = entries.at(-1)

  // Écart avec la dernière pesée d'il y a 30 jours ou plus, sinon avec la première.
  let delta: string | null = null
  if (latest && entries.length > 1) {
    // « en 30 jours » seulement si la pesée de référence date d'environ 30 jours (30 à 37).
    const old = [...entries].reverse().find((e) => e.date <= addDays(latest.date, -30) && e.date >= addDays(latest.date, -37))
    const ref = old ?? entries[0]
    const diff = Math.round(toDisplay(latest.weight_kg - ref.weight_kg) * 10) / 10
    const sign = diff < 0 ? '−' : '+'
    delta = `${sign} ${formatWeight(Math.abs(diff))} ${unit} ${old ? 'en 30 jours' : `depuis le ${shortDate(ref.date)}`}`
  }

  return (
    <section className="card" aria-label="Mon poids">
      <div className="row between">
        <p className="card-title">Mon poids</p>
        <button className="btn small" onClick={() => setAdding(true)}>＋ Pesée</button>
      </div>
      {!latest ? <p className="muted">Ajoute ta première pesée</p> : (
        <>
          <p className="needs-kcal num"><strong>{show(latest.weight_kg)}</strong></p>
          {delta && <p className="muted small num" style={{ margin: '2px 0 8px' }}>{delta}</p>}
          <div className="segmented periods" role="group">
            {PERIODS.map((p) => (
              <button key={p.label} type="button" aria-pressed={days === p.days} onClick={() => setDays(p.days)}>{p.label}</button>
            ))}
          </div>
          <WeightChart entries={entries} from={periodStart(today, days)} today={today} />
          <button className="btn ghost block small" onClick={() => setHistory(!history)}>Historique</button>
          {history && (
            <ul className="list">
              {[...entries].reverse().map((e) => (
                <li key={e.id} className="list-item" style={{ cursor: 'default' }}>
                  <span className="num">{shortDate(e.date)} · {show(e.weight_kg)}</span>
                  <button className="btn ghost icon" aria-label={`Supprimer la pesée du ${longDate(e.date)}`} onClick={() => removeWeight(e.id)}>✕</button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {adding && <AddWeightSheet latest={latest} onClose={() => setAdding(false)} />}
    </section>
  )
}

function AddWeightSheet({ latest, onClose }: { latest: WeightEntry | undefined; onClose(): void }) {
  const userId = useUserId()
  const { toKg, toDisplay, unit } = useUnit()
  const today = toISODate(new Date())
  const [text, setText] = useState('')
  const [date, setDate] = useState(today)
  const value = parseWeight(text)
  const kg = value === null ? null : toKg(value)
  const error = text.trim() === '' ? null
    : kg === null || kg < 30 || kg > 300 ? `Poids : ${Math.ceil(toDisplay(30))} à ${Math.floor(toDisplay(300))} ${unit}`
      : null
  const dateError = !/^\d{4}-\d{2}-\d{2}$/.test(date) ? 'Date invalide' : date > today ? 'La date ne peut pas être dans le futur' : null

  async function save() {
    await addWeight(userId, date, kg!)
    onClose()
  }

  return (
    <Sheet title="Nouvelle pesée" onClose={onClose}>
      <label className="field"><span>Poids ({unit})</span>
        <input aria-label={`Poids (${unit})`} className="input num" inputMode="decimal" autoFocus
          placeholder={latest ? formatWeight(toDisplay(latest.weight_kg)) : undefined} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <label className="field"><span>Date</span>
        <input aria-label="Date" className="input" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      {dateError && <p className="error">{dateError}</p>}
      <button className="btn primary block" disabled={kg === null || !!error || !!dateError} onClick={save}>Enregistrer</button>
    </Sheet>
  )
}
