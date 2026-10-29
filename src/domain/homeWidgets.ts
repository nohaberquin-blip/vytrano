import { addDays, buildCalendar, isPlanned, noon, workoutDate, type CalendarInput } from './calendar'
import { challengeProgress, type ChallengeProgress } from './challenges'
import { monthGoal, type MonthData } from './month'
import { nextDay } from './rotation'
import type { Challenge, ProgramDay } from './types'

/** Prochain jour prévu (aujourd'hui compris s'il n'est pas fait) sur 14 jours ; sans date s'il n'y en a pas. null : pas de programme. */
export function nextSession(input: CalendarInput | null, days: ProgramDay[], lastDoneDayId: string | null, today: string):
  { date: string | null; day: ProgramDay } | null {
  const rotation = nextDay(days, lastDoneDayId)
  if (!rotation) return null
  if (input) {
    const planned = buildCalendar({ ...input, days }, today, addDays(today, 13)).find((d) => d.state === 'planned')
    if (planned) return { date: planned.date, day: planned.day ?? rotation }
  }
  return { date: null, day: rotation }
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** « Aujourd’hui », « Demain », le nom du jour dans la semaine qui vient, sinon « 26 novembre ». */
export function whenLabel(date: string, today: string): string {
  if (date === today) return 'Aujourd’hui'
  if (date === addDays(today, 1)) return 'Demain'
  const options: Intl.DateTimeFormatOptions = date < addDays(today, 7) ? { weekday: 'long' } : { day: 'numeric', month: 'long' }
  return capitalize(noon(date).toLocaleDateString('fr-FR', options))
}

export interface DailyGoals {
  today: { done: boolean } | null
  month: { done: number; goal: number } | null
  challenge: { c: Challenge; p: ChallengeProgress } | null
}

/** Séance du jour (si prévue), objectif du mois et défi actif dont la fin est la plus proche. */
export function dailyGoals(data: MonthData): DailyGoals {
  const { today, input, workouts, challenges, history } = data
  const ym = today.slice(0, 7)
  const dates = workouts.map(workoutDate)
  const { goal } = monthGoal(input, ym, challenges)
  const active = challenges
    .filter((c) => c.kind !== 'month')
    .map((c) => ({ c, p: challengeProgress(c, workouts, history, today) }))
    .filter(({ p }) => p.status === 'active')
    .sort((a, b) => a.c.end_date.localeCompare(b.c.end_date))
  return {
    today: input && isPlanned(today, input) ? { done: dates.includes(today) } : null,
    month: goal ? { done: dates.filter((d) => d.startsWith(ym)).length, goal } : null,
    challenge: active[0] ?? null,
  }
}
