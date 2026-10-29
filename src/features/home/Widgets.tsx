import { Link } from 'react-router-dom'
import { useUnit } from '../../app/units'
import { getBodyProfile, latestWeight } from '../../data/body'
import { loadCalendarInput } from '../../data/calendar'
import { loadMonthSummary } from '../../data/challenges'
import { db } from '../../data/db'
import { getActiveProgram } from '../../data/programs'
import { loadProgress } from '../../data/progress'
import { useLive } from '../../data/useLive'
import { lastDoneDayId } from '../../data/workouts'
import { toISODate } from '../../domain/calendar'
import type { WidgetId } from '../../domain/home'
import { dailyGoals, nextSession, whenLabel } from '../../domain/homeWidgets'
import { computeNeeds } from '../../domain/needs'
import { useUserId } from '../auth/AuthProvider'
import { challengeTitle } from '../calendar/challengeText'
import { ofMonth } from '../calendar/format'
import { fmtInt } from '../profile/numberField'

const today = () => toISODate(new Date())

function Widget({ to, title, children }: { to: string; title: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="widget">
      <span className="widget-title">{title}</span>
      {children}
    </Link>
  )
}

function NextWidget() {
  const userId = useUserId()
  const next = useLive(async () => {
    const t = today()
    const [input, tree, last] = await Promise.all([loadCalendarInput(userId, t), getActiveProgram(userId), lastDoneDayId(userId)])
    return { t, n: nextSession(input, tree?.days ?? [], last, t) }
  }, [userId])
  let text = ''
  if (next) text = !next.n ? 'Choisis un programme' : next.n.date ? `${whenLabel(next.n.date, next.t)} · ${next.n.day.name}` : next.n.day.name
  return <Widget to="/seance" title="Prochaine séance"><span className="widget-main">{text}</span></Widget>
}

function ProgressWidget() {
  const userId = useUserId()
  const p = useLive(() => loadProgress(userId, today()), [userId])
  return (
    <Widget to="/profil" title="Progression">
      {p && (
        <>
          <span className="widget-main">Niveau {p.level} · {p.title}</span>
          <progress className="widget-bar" max={p.xpForNext} value={p.xpInLevel} aria-label="XP vers le niveau suivant" />
          <span className="muted small">🔥 {p.streak} semaine{p.streak > 1 ? 's' : ''}</span>
        </>
      )}
    </Widget>
  )
}

function CaloriesWidget() {
  const userId = useUserId()
  const n = useLive(async () => {
    const [profile, weight] = await Promise.all([getBodyProfile(userId), latestWeight(userId)])
    return computeNeeds(profile ?? null, weight?.weight_kg ?? null, today())
  }, [userId])
  let text = ''
  if (n) text = n.kcal !== null && n.protein !== null ? `${fmtInt(n.kcal)} kcal · ${fmtInt(n.protein)} g de protéines par jour` : 'Complète ta fiche'
  return <Widget to="/nutrition" title="Calories"><span className="widget-main">{text}</span></Widget>
}

function GoalsWidget() {
  const userId = useUserId()
  const { show } = useUnit()
  const data = useLive(async () => {
    const g = dailyGoals(await loadMonthSummary(userId, today()))
    const ex = g.challenge?.c.exercise_id ? await db.exercises.get(g.challenge.c.exercise_id) : undefined
    return { g, name: ex?.name, ym: today().slice(0, 7) }
  }, [userId])
  if (!data) return <Widget to="/calendrier" title="Objectifs du jour">{null}</Widget>
  const { g, name, ym } = data
  const lines: string[] = []
  const tick = (ok: boolean) => (ok ? '✅' : '⬜')
  if (g.today) lines.push(`${tick(g.today.done)} Séance du jour`)
  if (g.month) lines.push(`${tick(g.month.done >= g.month.goal)} Objectif ${ofMonth(ym)} : ${g.month.done} / ${g.month.goal} séances`)
  if (g.challenge) {
    const { c, p } = g.challenge
    const value = c.kind === 'lift' ? `${show(p.value)} / ${show(p.target)}` : `${p.value} / ${p.target}`
    lines.push(`⬜ ${challengeTitle(c, name, show)} : ${value}`)
  }
  return (
    <Widget to="/calendrier" title="Objectifs du jour">
      {lines.length === 0 ? <span className="muted">Rien de prévu aujourd’hui</span> : (
        <ul className="widget-goals">{lines.map((l) => <li key={l}>{l}</li>)}</ul>
      )}
    </Widget>
  )
}

export const WIDGET_VIEWS: Record<WidgetId, () => React.ReactNode> = {
  next: NextWidget, progress: ProgressWidget, calories: CaloriesWidget, goals: GoalsWidget,
}
