import { addDays, noon } from './calendar'
import type { Period } from './types'

export const PERIOD_DAYS = 5
export const PERIOD_MIN = 2
export const PERIOD_MAX = 10
export const DEFAULT_CYCLE = 28
/** Nombre de règles prévues au plus (un an). */
const HORIZON = 12

const daysBetween = (a: string, b: string) => Math.round((noon(b).getTime() - noon(a).getTime()) / 86_400_000)
const sorted = (periods: Period[]) => [...periods].sort((a, b) => a.start.localeCompare(b.start))
const covers = (start: string, days: number, date: string) => date >= start && date <= addDays(start, days - 1)

/** Longueur du cycle : moyenne des 3 derniers écarts entre débuts (15 à 60 jours), 28 sinon. */
export function cycleLength(periods: Period[]): number {
  const list = sorted(periods)
  const gaps = list.slice(1).map((p, i) => daysBetween(list[i].start, p.start)).filter((g) => g >= 15 && g <= 60)
  const last = gaps.slice(-3)
  return last.length ? Math.round(last.reduce((a, b) => a + b, 0) / last.length) : DEFAULT_CYCLE
}

/** Période notée couvrant ce jour. */
export function periodOn(date: string, periods: Period[]): Period | undefined {
  return periods.find((p) => covers(p.start, p.days, date))
}

/** Règles notées, prévues (pas encore terminées à `today`), ou rien. */
export function periodState(date: string, periods: Period[], today: string): 'period' | 'predicted' | null {
  if (periodOn(date, periods)) return 'period'
  const list = sorted(periods)
  const last = list[list.length - 1]
  if (!last) return null
  const length = cycleLength(list)
  for (let k = 1; k <= HORIZON; k++) {
    const start = addDays(last.start, k * length)
    if (start > date) break
    if (addDays(start, last.days - 1) >= today && covers(start, last.days, date)) return 'predicted'
  }
  return null
}
