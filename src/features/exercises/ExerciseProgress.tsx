import { useState } from 'react'
import { useUnit } from '../../app/units'
import { historyFor } from '../../data/records'
import { useLive } from '../../data/useLive'
import { addDays, toISODate } from '../../domain/calendar'
import { exerciseRecords } from '../../domain/records'
import { useUserId } from '../auth/AuthProvider'
import { ProgressChart } from './ProgressChart'

const longDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
const PERIODS = [{ label: '3 mois', days: 90 }, { label: '1 an', days: 365 }, { label: 'Tout', days: null }] as const

/** Records de l'exercice et courbe de progression (rien tant qu'aucune série n'a compté). */
export function ExerciseProgress({ exerciseId }: { exerciseId: string }) {
  const userId = useUserId()
  const { show } = useUnit()
  const [metric, setMetric] = useState<'e1rm' | 'weight'>('e1rm')
  const [days, setDays] = useState<number | null>(null)
  const r = useLive(async () => exerciseRecords(await historyFor(userId, exerciseId)), [userId, exerciseId])
  if (!r || !r.weight || !r.e1rm) return null
  const from = days === null ? null : addDays(toISODate(new Date()), -days)
  const points = r.points.filter((p) => !from || p.date >= from)

  return (
    <>
      <section className="records-section" aria-label="Records">
        <h2>Records</h2>
        <p className="record-line num">Charge max {show(r.weight.value)} · {longDate(r.weight.date)}</p>
        <p className="record-line num">1RM estimé {show(r.e1rm.value)} · {longDate(r.e1rm.date)}</p>
      </section>
      <div className="segmented metric" role="group" aria-label="Mesure">
        <button type="button" aria-pressed={metric === 'e1rm'} onClick={() => setMetric('e1rm')}>1RM estimé</button>
        <button type="button" aria-pressed={metric === 'weight'} onClick={() => setMetric('weight')}>Charge max</button>
      </div>
      <div className="segmented periods three" role="group" aria-label="Période">
        {PERIODS.map((p) => (
          <button key={p.label} type="button" aria-pressed={days === p.days} onClick={() => setDays(p.days)}>{p.label}</button>
        ))}
      </div>
      {points.length < 2
        ? <p className="muted small">Fais encore une séance pour voir ta courbe</p>
        : <ProgressChart points={points} metric={metric} />}
    </>
  )
}
