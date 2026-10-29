import { useEffect, useState, type ReactNode } from 'react'
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
import type { AppId } from '../../domain/home'
import { dailyGoals, nextSession, whenLabel } from '../../domain/homeWidgets'
import { computeNeeds } from '../../domain/needs'
import { useUserId } from '../auth/AuthProvider'
import { challengeTitle } from '../calendar/challengeText'
import { monthName } from '../calendar/format'
import { fmtInt } from '../profile/numberField'

const today = () => toISODate(new Date())

/** Emoji décoratif : VoiceOver ne le lit pas (le texte suffit). */
const Deco = ({ children }: { children: string }) => <span aria-hidden>{children} </span>

/** Minutes écoulées, rafraîchies chaque minute. */
function useMinutesSince(iso: string | undefined): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])
  return iso ? Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000)) : 0
}

function SessionInfo() {
  const userId = useUserId()
  const data = useLive(async () => {
    const t = today()
    const current = await db.workouts.where('user_id').equals(userId).filter((w) => w.status === 'in_progress').first()
    if (current) return { current }
    const [input, tree, last] = await Promise.all([loadCalendarInput(userId, t), getActiveProgram(userId), lastDoneDayId(userId)])
    return { t, n: nextSession(input, tree?.days ?? [], last, t) }
  }, [userId])
  const minutes = useMinutesSince(data?.current?.started_at)
  if (!data) return null
  if (data.current) return <><span className="tile-main"><Deco>▶</Deco>Reprendre</span><span className="tile-sub">{minutes} min</span></>
  if (!data.n) return <span className="tile-sub">Choisis un programme</span>
  return (
    <>
      <span className="tile-main"><Deco>▶</Deco>Démarrer</span>
      <span className="tile-sub">{data.n.date ? `${whenLabel(data.n.date, data.t!)} · ${data.n.day.name}` : data.n.day.name}</span>
    </>
  )
}

function CalendarInfo() {
  const userId = useUserId()
  const { show } = useUnit()
  const data = useLive(async () => {
    const g = dailyGoals(await loadMonthSummary(userId, today()))
    const ex = g.challenge?.c.exercise_id ? await db.exercises.get(g.challenge.c.exercise_id) : undefined
    return { g, name: ex?.name, ym: today().slice(0, 7) }
  }, [userId])
  if (!data) return null
  const { g, name, ym } = data
  const lines: { done: boolean; text: string }[] = []
  if (g.today) lines.push({ done: g.today.done, text: 'Séance du jour' })
  if (g.month) lines.push({ done: g.month.done >= g.month.goal, text: `${g.month.done} / ${g.month.goal} séances en ${monthName(ym)}` })
  if (g.challenge) {
    const { c, p } = g.challenge
    lines.push({ done: false, text: `${challengeTitle(c, name, show)} : ${c.kind === 'lift' ? `${show(p.value)} / ${show(p.target)}` : `${p.value} / ${p.target}`}` })
  }
  if (lines.length === 0) return <span className="tile-sub">Rien de prévu aujourd’hui</span>
  return (
    <ul className="tile-lines">
      {lines.map((l) => (
        <li key={l.text}><Deco>{l.done ? '✅' : '⬜'}</Deco><span className="sr-only">{l.done ? 'fait : ' : 'à faire : '}</span><span>{l.text}</span></li>
      ))}
    </ul>
  )
}

function NutritionInfo() {
  const userId = useUserId()
  const n = useLive(async () => {
    const [profile, weight] = await Promise.all([getBodyProfile(userId), latestWeight(userId)])
    return computeNeeds(profile ?? null, weight?.weight_kg ?? null, today())
  }, [userId])
  if (!n) return null
  if (n.kcal === null || n.protein === null) return <span className="tile-sub">Complète ta fiche</span>
  return <><span className="tile-main">{fmtInt(n.kcal)} kcal</span><span className="tile-sub">{fmtInt(n.protein)} g de protéines</span></>
}

function ProfileInfo() {
  const userId = useUserId()
  const p = useLive(() => loadProgress(userId, today()), [userId])
  if (!p) return null
  return (
    <>
      <span className="tile-main">Niv. {p.level} · {p.title}</span>
      <progress className="tile-bar" max={p.xpForNext} value={p.xpInLevel} aria-label="XP vers le niveau suivant" />
      <span className="tile-sub"><Deco>🔥</Deco>{p.streak} semaine{p.streak > 1 ? 's' : ''}</span>
    </>
  )
}

/** Infos affichées dans les tuiles qui en ont (les autres montrent seulement leur nom). */
export const TILE_INFO: Partial<Record<AppId, (props: { badge: number }) => ReactNode>> = {
  session: SessionInfo,
  calendar: CalendarInfo,
  nutrition: NutritionInfo,
  profile: ProfileInfo,
  friends: ({ badge }) => (badge > 0 ? <span className="tile-alert">{badge} demande{badge > 1 ? 's' : ''}</span> : null),
}
