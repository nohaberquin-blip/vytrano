import { useState } from 'react'
import { getBodyProfile, latestWeight } from '../../data/body'
import { getSchedule } from '../../data/calendar'
import { useLive } from '../../data/useLive'
import { toISODate } from '../../domain/calendar'
import { GOALS, bmiCategory, computeNeeds } from '../../domain/needs'
import { useUserId } from '../auth/AuthProvider'
import { AdjustSheet } from './AdjustSheet'
import { BodySheet } from './BodySheet'
import { fmtInt } from './numberField'

const perso = (on: boolean) => (on ? <span className="muted small"> (perso)</span> : null)
const decimal = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })

/** Besoins du jour (calories, macros, IMC) calculés depuis la fiche et la dernière pesée. */
export function NeedsCard() {
  const userId = useUserId()
  const [sheet, setSheet] = useState<'body' | 'adjust' | null>(null)
  const data = useLive(async () => {
    const [profile, weight, schedule] = await Promise.all([getBodyProfile(userId), latestWeight(userId), getSchedule(userId)])
    return { profile, weight: weight?.weight_kg ?? null, sessions: schedule?.weekdays.length ?? null }
  }, [userId])
  if (!data) return null
  const { profile, weight } = data
  const n = computeNeeds(profile ?? null, weight, toISODate(new Date()))
  const ready = n.kcal !== null && n.protein !== null

  return (
    <section className="card needs" aria-label="Mes besoins">
      <div className="row between">
        <p className="card-title">Mes besoins</p>
        {profile?.goal && <span className="pill">{GOALS[profile.goal].label}</span>}
      </div>
      {ready ? (
        <>
          <p className="needs-kcal num"><strong>{fmtInt(n.kcal!)} kcal</strong>{perso(n.custom.kcal)} <span className="muted">par jour</span></p>
          <MacroDonut protein={n.protein!} carbs={n.carbs!} fat={n.fat!} custom={n.custom} />
          {n.carbsExhausted && <p className="error">0 g de glucides : baisse les protéines ou les lipides</p>}
        </>
      ) : (
        <>
          <p>Complète ta fiche pour voir tes besoins</p>
          <p className="muted small">Il manque : {n.missing.join(', ')}.</p>
        </>
      )}
      <p className="muted small num" style={{ margin: '8px 0 0' }}>
        {[
          n.bmr !== null && `Métabolisme de base ${fmtInt(n.bmr)} kcal`,
          n.maintenance !== null && `Maintien ${fmtInt(n.maintenance)} kcal`,
          n.bmi !== null && `IMC ${decimal(n.bmi)} (${bmiCategory(n.bmi).toLowerCase()})`,
        ].filter(Boolean).join(' · ')}
      </p>
      <p className="muted small" style={{ margin: '4px 0 10px' }}>Repères moyens, pas un avis médical.</p>
      <div className="row">
        <button className="btn" style={{ flex: 1 }} onClick={() => setSheet('body')}>Ma fiche</button>
        {weight !== null && <button className="btn" style={{ flex: 1 }} onClick={() => setSheet('adjust')}>Ajuster</button>}
      </div>
      {sheet === 'body' && <BodySheet profile={profile} defaultSessions={data.sessions} onClose={() => setSheet(null)} />}
      {sheet === 'adjust' && weight !== null && <AdjustSheet profile={profile} weightKg={weight} onClose={() => setSheet(null)} />}
    </section>
  )
}

const MACROS = [
  { key: 'protein', label: 'Protéines', kcalPerG: 4 },
  { key: 'carbs', label: 'Glucides', kcalPerG: 4 },
  { key: 'fat', label: 'Lipides', kcalPerG: 9 },
] as const

/** Diagramme circulaire : part de chaque macro dans les calories, avec la légende en grammes. */
function MacroDonut({ protein, carbs, fat, custom }: {
  protein: number; carbs: number; fat: number; custom: { protein: boolean; fat: boolean }
}) {
  const grams = { protein, carbs, fat }
  const kcal = MACROS.map((m) => grams[m.key] * m.kcalPerG)
  const total = kcal.reduce((a, b) => a + b, 0) || 1
  const pct = kcal.map((k) => Math.round((k / total) * 100))
  const R = 42
  const C = 2 * Math.PI * R
  let offset = 0
  return (
    <div className="macro-donut">
      <svg viewBox="0 0 110 110" role="img"
        aria-label={`Répartition des calories : ${MACROS.map((m, i) => `${m.label.toLowerCase()} ${pct[i]} %`).join(', ')}`}>
        <circle cx="55" cy="55" r={R} className="track" />
        {MACROS.map((m, i) => {
          const len = (kcal[i] / total) * C
          const el = (
            <circle key={m.key} cx="55" cy="55" r={R} className={`part macro-${m.key}`}
              strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} transform="rotate(-90 55 55)" />
          )
          offset += len
          return el
        })}
      </svg>
      <ul className="macro-legend num">
        {MACROS.map((m, i) => (
          <li key={m.key}>
            <span className={`legend-dot macro-${m.key}`} aria-hidden /> {m.label} <strong>{grams[m.key]} g</strong>
            {m.key !== 'carbs' && perso(custom[m.key])} <span className="muted small">{pct[i]} %</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
