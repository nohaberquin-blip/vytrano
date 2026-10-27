import { useState } from 'react'
import { Sheet } from '../../app/Sheet'
import { useUnit } from '../../app/units'
import { createChallenge, loadMonthData, removeChallenge, setMonthGoal } from '../../data/challenges'
import { db } from '../../data/db'
import { useLive } from '../../data/useLive'
import { addDays, workoutDate } from '../../domain/calendar'
import { challengeProgress } from '../../domain/challenges'
import { monthEnd, monthGoal, type MonthData } from '../../domain/month'
import type { Challenge } from '../../domain/types'
import { useUserId } from '../auth/AuthProvider'
import { challengeTitle } from './challengeText'
import { ofMonth } from './format'
import { MonthReport } from './MonthReport'

const shortDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

/** En-tête du mois : objectif de séances (réglable) et bouton du bilan. */
/** Bilan ouvert depuis le Calendrier : charge alors tout l'historique (records du mois). */
function FullReport({ ym, today, onClose }: { ym: string; today: string; onClose(): void }) {
  const userId = useUserId()
  const data = useLive(() => loadMonthData(userId, today), [userId, today])
  return data ? <MonthReport ym={ym} data={data} onClose={onClose} /> : null
}

export function MonthHeader({ ym, data }: { ym: string; data: MonthData }) {
  const userId = useUserId()
  const [editing, setEditing] = useState(false)
  const [report, setReport] = useState(false)
  const { goal, custom } = monthGoal(data.input, ym, data.challenges)
  const done = data.workouts.filter((w) => workoutDate(w).startsWith(ym)).length
  const past = ym <= data.today.slice(0, 7)
  return (
    <div className="month-header">
      {goal !== null && (
        <>
          <button className={done >= goal && goal > 0 ? 'goal reached' : 'goal'} onClick={() => setEditing(!editing)}>
            Objectif {ofMonth(ym)} : {done} / {goal} séances
          </button>
          <div className="xp-bar month-bar" aria-hidden><span style={{ width: `${goal ? Math.min(100, (done / goal) * 100) : 0}%` }} /></div>
          {editing && (
            <div className="row goal-editor">
              <button className="btn icon" aria-label="Diminuer l’objectif du mois" onClick={() => setMonthGoal(userId, ym, Math.max(0, goal - 1))}>−</button>
              <span className="num">{goal}</span>
              <button className="btn icon" aria-label="Augmenter l’objectif du mois" onClick={() => setMonthGoal(userId, ym, Math.min(62, goal + 1))}>＋</button>
              {custom && <button className="btn ghost small" onClick={() => setMonthGoal(userId, ym, null)}>Par défaut</button>}
            </div>
          )}
        </>
      )}
      {past && <button className="btn block small" style={{ marginTop: 8 }} onClick={() => setReport(true)}>Bilan du mois</button>}
      {report && <FullReport ym={ym} today={data.today} onClose={() => setReport(false)} />}
    </div>
  )
}

/** « Mes défis » : en cours, puis terminés depuis moins de 30 jours ; les plus anciens repliés. */
export function Challenges({ data }: { data: MonthData }) {
  const { show, toDisplay } = useUnit()
  const [creating, setCreating] = useState(false)
  const names = useLive(async () => new Map((await db.exercises.toArray()).map((e) => [e.id, e.name])), [])
  const items = data.challenges.filter((c) => c.kind !== 'month')
    .map((c) => ({ c, p: challengeProgress(c, data.workouts, data.history, data.today) }))
  const ended = (x: (typeof items)[number]) => x.p.doneOn ?? x.c.end_date
  const recent = items.filter((x) => x.p.status === 'active' || ended(x) >= addDays(data.today, -30))
  const old = items.filter((x) => !recent.includes(x))
  const title = (c: Challenge) => challengeTitle(c, names?.get(c.exercise_id ?? ''), show)

  const row = ({ c, p }: (typeof items)[number]) => (
    <li key={c.id} className={`challenge ${p.status}`}>
      <div className="row between">
        <strong>{title(c)}</strong>
        <button className="btn ghost icon small" aria-label={`Supprimer le défi « ${title(c)} »`}
          onClick={() => confirm(`Supprimer le défi « ${title(c)} » ?`) && void removeChallenge(c.id)}>✕</button>
      </div>
      <div className="xp-bar" aria-hidden><span style={{ width: `${Math.min(100, (p.value / p.target) * 100)}%` }} /></div>
      <p className="small num muted" style={{ margin: '4px 0 0' }}>
        {c.kind === 'lift' ? `${toDisplay(p.value).toLocaleString('fr-FR')} / ${show(c.target)}` : `${p.value} / ${c.target} séances`}
        {' · '}
        {p.status === 'done' ? `✅ Réussi le ${shortDate(p.doneOn!)}` : p.status === 'failed' ? 'Non atteint' : `jusqu’au ${shortDate(c.end_date)}`}
      </p>
    </li>
  )

  return (
    <section className="challenges" aria-label="Mes défis">
      <h2>Mes défis</h2>
      {items.length === 0 && <p className="muted small">Fixe-toi un nombre de séances ou une charge à atteindre.</p>}
      <ul className="list">{recent.map(row)}</ul>
      {old.length > 0 && (
        <details><summary className="muted small">Défis terminés ({old.length})</summary><ul className="list">{old.map(row)}</ul></details>
      )}
      <button className="btn block" onClick={() => setCreating(true)}>＋ Nouveau défi</button>
      {creating && <NewChallenge today={data.today} onClose={() => setCreating(false)} />}
    </section>
  )
}

function NewChallenge({ today, onClose }: { today: string; onClose(): void }) {
  const userId = useUserId()
  const { unit, toKg, show } = useUnit()
  const [kind, setKind] = useState<'sessions' | 'lift'>('sessions')
  const [count, setCount] = useState('10')
  const [exerciseId, setExerciseId] = useState('')
  const [metric, setMetric] = useState<'weight' | 'e1rm'>('weight')
  const [kg, setKg] = useState('')
  const [end, setEnd] = useState(monthEnd(today.slice(0, 7)))
  const mine = useLive(async () => {
    const fiches = await db.user_exercises.where('user_id').equals(userId).toArray()
    const list = await db.exercises.bulkGet(fiches.map((f) => f.exercise_id))
    return list.filter((e) => !!e).map((e) => e!).sort((a, b) => a.name.localeCompare(b.name))
  }, [userId])

  const n = Number(count)
  const countError = kind === 'sessions' && !(Number.isInteger(n) && n >= 1 && n <= 200)
  const weight = Number(kg.replace(',', '.'))
  const kgError = kind === 'lift' && kg !== '' && !(toKg(weight) >= 1 && toKg(weight) <= 999)
  const endError = !(end >= today && end <= addDays(today, 365))
  const valid = !countError && !endError && (kind === 'sessions' || (exerciseId !== '' && kg !== '' && !kgError))

  async function submit() {
    if (!valid) return
    await createChallenge(userId, kind === 'sessions'
      ? { kind, exercise_id: null, metric: null, target: n, end_date: end }
      : { kind, exercise_id: exerciseId, metric, target: toKg(weight), end_date: end }, today)
    onClose()
  }

  return (
    <Sheet title="Nouveau défi" onClose={onClose}>
      <div className="segmented" role="group" aria-label="Type de défi">
        <button type="button" aria-pressed={kind === 'sessions'} onClick={() => setKind('sessions')}>Séances</button>
        <button type="button" aria-pressed={kind === 'lift'} onClick={() => setKind('lift')}>Charge</button>
      </div>
      {kind === 'sessions' ? (
        <>
          <label className="field"><span>Nombre de séances</span>
            <input className="input num" type="number" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} />
          </label>
          {countError && <p className="error">Entre 1 et 200 séances</p>}
        </>
      ) : (
        <>
          <label className="field"><span>Exercice</span>
            <select className="input" value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
              <option value="">Choisir…</option>
              {mine?.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </label>
          <div className="segmented" role="group" aria-label="Mesure">
            <button type="button" aria-pressed={metric === 'weight'} onClick={() => setMetric('weight')}>Charge max</button>
            <button type="button" aria-pressed={metric === 'e1rm'} onClick={() => setMetric('e1rm')}>1RM estimé</button>
          </div>
          <label className="field"><span>Charge visée ({unit})</span>
            <input className="input num" type="number" inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} />
          </label>
          {kgError && <p className="error">{`Entre ${show(1)} et ${show(999)}`}</p>}
        </>
      )}
      <label className="field"><span>Date de fin</span>
        <input className="input" type="date" value={end} min={today} max={addDays(today, 365)} onChange={(e) => setEnd(e.target.value)} />
      </label>
      {endError && <p className="error">Date de fin invalide</p>}
      <button className="btn primary block" disabled={!valid} onClick={submit}>Créer le défi</button>
    </Sheet>
  )
}
