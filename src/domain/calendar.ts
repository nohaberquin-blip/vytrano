import { nextDay } from './rotation'
import type { ProgramDay, ScheduleOverride, TrainingSchedule, WeeklyGoal, Workout } from './types'

const pad = (n: number) => String(n).padStart(2, '0')

/** Date locale `YYYY-MM-DD`. */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Midi local : les changements d'heure ne font jamais changer de jour. */
function noon(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

export function addDays(date: string, n: number): string {
  const d = noon(date)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

/** 1 = lundi … 7 = dimanche. */
export function weekday(date: string): number {
  return noon(date).getDay() || 7
}

/** Lundi de la semaine. */
export const weekStart = (date: string) => addDays(date, 1 - weekday(date))

export const workoutDate = (w: Workout) => toISODate(new Date(w.started_at))

export type DayState = 'done' | 'planned' | 'rest' | 'missed' | 'moved'

export interface CalendarInput {
  today: string
  schedule: TrainingSchedule
  overrides: ScheduleOverride[]
  goals: WeeklyGoal[]
  /** Séances terminées uniquement. */
  workouts: Workout[]
  /** Jours du programme actif ([] si aucun). */
  days: ProgramDay[]
  lastDoneDayId: string | null
}

export interface CalendarDay {
  date: string
  state: DayState
  /** Séance attribuée à un jour prévu ; null = « Séance libre » ou sans objet. */
  day: ProgramDay | null
  /** Séances terminées ce jour. */
  workouts: Workout[]
  movedTo: string | null
}

const overrideOn = (input: CalendarInput, date: string) => input.overrides.find((o) => o.date === date)

export function isPlanned(date: string, input: CalendarInput): boolean {
  const o = overrideOn(input, date)
  if (o) return o.kind === 'train'
  return input.schedule.weekdays.includes(weekday(date))
}

function workoutsByDate(workouts: Workout[]): Map<string, Workout[]> {
  const map = new Map<string, Workout[]>()
  for (const w of workouts) {
    const d = workoutDate(w)
    map.set(d, [...(map.get(d) ?? []), w])
  }
  return map
}

/** Jours de `from` à `to` inclus, avec leur état et la séance prévue. */
export function buildCalendar(input: CalendarInput, from: string, to: string): CalendarDay[] {
  const done = workoutsByDate(input.workouts)
  // Rotation : à partir d'aujourd'hui, chaque jour prévu non fait reçoit le jour suivant du programme.
  const assigned = new Map<string, ProgramDay | null>()
  let cur = nextDay(input.days, input.lastDoneDayId)
  for (let d = input.today; d <= to; d = addDays(d, 1)) {
    if (done.has(d) || !isPlanned(d, input)) continue
    assigned.set(d, cur)
    if (cur) cur = nextDay(input.days, cur.id)
  }

  const out: CalendarDay[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const workouts = done.get(d) ?? []
    const o = overrideOn(input, d)
    let state: DayState = 'rest'
    if (workouts.length) state = 'done'
    else if (o?.kind === 'rest' && o.moved_to) state = 'moved'
    else if (isPlanned(d, input)) state = d < input.today ? (d >= input.schedule.since ? 'missed' : 'rest') : 'planned'
    out.push({ date: d, state, day: state === 'planned' ? assigned.get(d) ?? null : null, workouts, movedTo: state === 'moved' ? o!.moved_to : null })
  }
  return out
}

/** Séances faites (jours distincts) dans la semaine commençant `monday`, et objectif. */
export function weekProgress(input: CalendarInput, monday: string): { done: number; goal: number; reached: boolean } {
  const dates = new Set(input.workouts.map(workoutDate))
  let done = 0
  for (let i = 0; i < 7; i++) if (dates.has(addDays(monday, i))) done++
  const goal = input.goals.find((g) => g.week_start === monday)?.sessions ?? input.schedule.weekdays.length
  return { done, goal, reached: goal > 0 && done >= goal }
}
