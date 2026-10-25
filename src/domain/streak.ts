import { addDays, weekGoal, weekStart, workoutDate, type CalendarInput } from './calendar'
import type { Workout } from './types'

export interface Badge { id: string; label: string; hint: string }

const count = (n: number, one: string, many: string) => (n === 1 ? one : many)

/** Catalogue, dans l'ordre d'affichage. */
export const BADGES: Badge[] = [
  ...[1, 10, 50, 100, 250, 500].map((n) => ({
    id: `sessions-${n}`, label: n === 1 ? '1re séance' : `${n} séances`, hint: count(n, 'Terminer une séance', `Terminer ${n} séances`),
  })),
  ...[4, 12, 26, 52].map((n) => ({ id: `streak-${n}`, label: `${n} semaines de suite`, hint: `Réussir ${n} semaines de suite` })),
  ...[5, 10, 20, 30].map((n) => ({ id: `level-${n}`, label: `Niveau ${n}`, hint: `Atteindre le niveau ${n}` })),
  { id: 'goal-1', label: 'Premier objectif atteint', hint: 'Atteindre son objectif de la semaine' },
  { id: 'goal-10', label: '10 objectifs atteints', hint: 'Atteindre 10 fois son objectif de la semaine' },
  { id: 'comeback', label: 'Le retour', hint: 'Reprendre après au moins 3 semaines d’arrêt' },
]

const TITLES: [number, string][] = [[30, 'Légende'], [25, 'Élite'], [20, 'Expert'], [15, 'Assidu'], [10, 'Confirmé'], [5, 'Régulier'], [1, 'Débutant']]

/** XP totale pour atteindre le niveau n : passer de k à k + 1 demande 1500 + 250 × (k − 1). */
export function xpForLevel(n: number): number {
  const k = n - 1
  return k * 1500 + (250 * k * (k - 1)) / 2
}

const levelOf = (xp: number) => { let n = 1; while (xpForLevel(n + 1) <= xp) n++; return n }
export const titleFor = (level: number) => TITLES.find(([min]) => level >= min)![1]

export interface Progress {
  level: number
  title: string
  xp: number
  xpInLevel: number
  xpForNext: number
  streak: number
  jokers: number
  badges: { id: string; date: string }[]
}

const SESSION_XP = 100
const WEEK_XP = 200
const COMEBACK_DAYS = 21
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000)

/** Série, XP, niveau et badges, recalculés depuis les séances terminées (et le calendrier s'il est réglé). */
export function progress(workouts: Workout[], input: CalendarInput | null, today: string): Progress {
  const dates = workouts.map(workoutDate).sort()
  const badges = new Map<string, string>()
  const award = (id: string, date: string) => { if (!badges.has(id)) badges.set(id, date) }
  const events: { date: string; xp: number }[] = dates.map((date) => ({ date, xp: SESSION_XP }))

  dates.forEach((date, i) => {
    for (const n of [1, 10, 50, 100, 250, 500]) if (i + 1 === n) award(`sessions-${n}`, date)
    if (i > 0 && daysBetween(dates[i - 1], date) >= COMEBACK_DAYS) award('comeback', date)
  })

  let streak = 0
  let jokers = 0
  if (input) {
    // Jours d'entraînement distincts par semaine, calculés une seule fois (pas à chaque semaine).
    const byWeek = new Map<string, string[]>()
    for (const d of new Set(dates)) {
      const monday = weekStart(d)
      byWeek.set(monday, [...(byWeek.get(monday) ?? []), d])
    }
    const since = input.schedule.since
    let monday = weekStart(since) === since ? since : addDays(weekStart(since), 7)
    let reached = 0
    for (; monday <= weekStart(today); monday = addDays(monday, 7)) {
      const goal = weekGoal(input, monday)
      if (goal === 0) continue
      const days = byWeek.get(monday) ?? []
      if (days.length >= goal) {
        // Jour où l'objectif a été atteint : le goal-ième jour d'entraînement de la semaine.
        const date = days[goal - 1]
        streak++
        reached++
        if (reached % 4 === 0) jokers = Math.min(2, jokers + 1)
        events.push({ date, xp: Math.round(WEEK_XP * Math.min(2, 1 + 0.1 * (streak - 1))) })
        if (reached === 1) award('goal-1', date)
        if (reached === 10) award('goal-10', date)
        for (const n of [4, 12, 26, 52]) if (streak === n) award(`streak-${n}`, date)
      } else if (addDays(monday, 6) < today) {
        if (jokers > 0) jokers--
        else streak = 0
      }
    }
  }

  events.sort((a, b) => a.date.localeCompare(b.date))
  let xp = 0
  for (const e of events) {
    xp += e.xp
    for (const n of [5, 10, 20, 30]) if (levelOf(xp) >= n) award(`level-${n}`, e.date)
  }
  const level = levelOf(xp)
  return {
    level, title: titleFor(level), xp,
    xpInLevel: xp - xpForLevel(level), xpForNext: xpForLevel(level + 1) - xpForLevel(level),
    streak, jokers,
    badges: BADGES.filter((b) => badges.has(b.id)).map((b) => ({ id: b.id, date: badges.get(b.id)! })),
  }
}

/** Ce qu'une séance a rapporté : XP, niveau atteint (null si inchangé), nouveaux badges. */
export function progressGain(before: Progress, after: Progress): { xp: number; level: number | null; badges: Badge[] } {
  const had = new Set(before.badges.map((b) => b.id))
  return {
    xp: after.xp - before.xp,
    level: after.level > before.level ? after.level : null,
    badges: BADGES.filter((b) => !had.has(b.id) && after.badges.some((x) => x.id === b.id)),
  }
}
