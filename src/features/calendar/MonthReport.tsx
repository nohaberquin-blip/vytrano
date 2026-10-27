import { Sheet } from '../../app/Sheet'
import { useUnit } from '../../app/units'
import { db } from '../../data/db'
import { useLive } from '../../data/useLive'
import { addDays } from '../../domain/calendar'
import { monthReport, monthStart, type MonthData } from '../../domain/month'
import { BADGES } from '../../domain/streak'
import { BadgeIcon } from '../profile/BadgeIcon'
import { challengeTitle } from './challengeText'
import { monthName, ofMonth } from './format'

const plural = (n: number, word: string) => `${n} ${word}${Math.abs(n) > 1 ? 's' : ''}`

/** Bilan d'un mois : séances, semaines, records, défis, XP et badges. */
export function MonthReport({ ym, data, onClose }: { ym: string; data: MonthData; onClose(): void }) {
  const { show } = useUnit()
  const r = monthReport(ym, data)
  const prev = addDays(monthStart(ym), -1).slice(0, 7)
  const names = useLive(async () => {
    const ids = [...new Set([...r.records.map((x) => x.exerciseId), ...[...r.challengesDone, ...r.challengesFailed].map((c) => c.exercise_id ?? '')])]
    const list = await db.exercises.bulkGet(ids)
    return new Map(ids.map((id, i) => [id, list[i]?.name]))
  }, [ym, data])
  const diff = r.sessions - r.previous
  const title = (c: (typeof r.challengesDone)[number]) => challengeTitle(c, names?.get(c.exercise_id ?? ''), show)

  return (
    <Sheet title={`Ton bilan ${ofMonth(ym)}`} onClose={onClose}>
      <div className="report">
        <p className="report-big num">{plural(r.sessions, 'séance')}</p>
        {r.goal !== null && <p className="muted">Objectif : {r.goal}</p>}
        <p>{diff === 0 ? `Autant de séances qu’en ${monthName(prev)}` : `${diff > 0 ? '+' : ''}${plural(diff, 'séance')} par rapport à ${monthName(prev)}`}</p>
        {data.input && (
          <p>{plural(r.weeks, 'semaine')} réussie{r.weeks > 1 ? 's' : ''}{r.streak > 0 ? ` · 🔥 série de ${r.streak}` : ''}</p>
        )}
        {r.records.length > 0 && <p>🏆 Records battus : {r.records.map((x) => names?.get(x.exerciseId) ?? '…').join(', ')}</p>}
        {r.challengesDone.length > 0 && <p>🎯 Défis réussis : {r.challengesDone.map(title).join(', ')}</p>}
        {r.challengesFailed.length > 0 && <p className="muted">Défis non atteints : {r.challengesFailed.map(title).join(', ')}</p>}
        {r.xp > 0 && <p><strong>+{r.xp} XP</strong></p>}
        {r.badges.length > 0 && (
          <ul className="report-badges">
            {r.badges.map((b) => {
              const badge = BADGES.find((x) => x.id === b.id)!
              return <li key={b.id}><BadgeIcon icon={badge.icon} kg={badge.kg} size={40} /><span className="small">{badge.label}</span></li>
            })}
          </ul>
        )}
      </div>
    </Sheet>
  )
}
