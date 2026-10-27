import { addDays, isPlanned, weekProgress, weekStart, workoutDate, type CalendarInput } from './calendar'
import { challengeProgress } from './challenges'
import { exerciseRecords, type SessionSets } from './records'
import { progress } from './streak'
import type { Challenge, Workout } from './types'

export const monthStart = (ym: string) => `${ym}-01`
export function monthEnd(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
}
const previousMonth = (ym: string) => addDays(monthStart(ym), -1).slice(0, 7)
const inMonth = (date: string, ym: string) => date.startsWith(ym)

/** Jours d'entraînement prévus dans le mois (reports, jours ajoutés et repos compris), à partir du réglage. */
export function suggestedMonthGoal(input: CalendarInput, ym: string): number {
  let n = 0
  for (let d = monthStart(ym); d <= monthEnd(ym); d = addDays(d, 1)) if (d >= input.schedule.since && isPlanned(d, input)) n++
  return n
}

/** Objectif du mois : modifié s'il existe, sinon proposé (null sans calendrier réglé). */
export function monthGoal(input: CalendarInput | null, ym: string, challenges: Challenge[]): { goal: number | null; custom: boolean } {
  const custom = challenges.find((c) => c.kind === 'month' && c.start === monthStart(ym))
  if (custom) return { goal: custom.target, custom: true }
  return { goal: input ? suggestedMonthGoal(input, ym) : null, custom: false }
}

export interface MonthData {
  today: string
  /** Séances terminées. */
  workouts: Workout[]
  input: CalendarInput | null
  challenges: Challenge[]
  /** Historique par exercice, sans les séances allégées. */
  history: Map<string, SessionSets[]>
}

export interface MonthReport {
  sessions: number
  goal: number | null
  previous: number
  weeks: number
  streak: number
  records: { exerciseId: string }[]
  challengesDone: Challenge[]
  challengesFailed: Challenge[]
  xp: number
  badges: { id: string; date: string }[]
}

/** Progression (Régularité) arrêtée à la fin d'un jour donné. */
function progressAt(data: MonthData, day: string) {
  const workouts = data.workouts.filter((w) => workoutDate(w) <= day)
  const input = data.input && { ...data.input, today: day, workouts }
  return progress(workouts, input, day)
}

/** Bilan du mois `YYYY-MM` (le mois en cours s'arrête à aujourd'hui). */
export function monthReport(ym: string, data: MonthData): MonthReport {
  const end = monthEnd(ym) < data.today ? monthEnd(ym) : data.today
  const sessions = data.workouts.filter((w) => inMonth(workoutDate(w), ym)).length
  const previous = data.workouts.filter((w) => inMonth(workoutDate(w), previousMonth(ym))).length

  let weeks = 0
  if (data.input) {
    const input = { ...data.input, workouts: data.workouts }
    for (let monday = weekStart(monthStart(ym)); monday <= end; monday = addDays(monday, 7)) {
      if (inMonth(monday, ym) && monday >= data.input.schedule.since && weekProgress(input, monday).reached) weeks++
    }
  }

  const after = progressAt(data, end)
  const before = progressAt(data, addDays(monthStart(ym), -1))
  const records = [...data.history]
    .filter(([, h]) => exerciseRecords(h).points.some((p) => p.record && inMonth(p.date, ym)))
    .map(([exerciseId]) => ({ exerciseId }))
  const defis = data.challenges.filter((c) => c.kind !== 'month').map((c) => ({ c, p: challengeProgress(c, data.workouts, data.history, data.today) }))

  return {
    sessions,
    goal: monthGoal(data.input, ym, data.challenges).goal,
    previous,
    weeks,
    streak: after.streak,
    records,
    challengesDone: defis.filter(({ p }) => p.status === 'done' && inMonth(p.doneOn!, ym)).map(({ c }) => c),
    challengesFailed: defis.filter(({ c, p }) => p.status === 'failed' && inMonth(c.end_date, ym)).map(({ c }) => c),
    xp: after.xp - before.xp,
    badges: after.badges.filter((b) => inMonth(b.date, ym)),
  }
}
