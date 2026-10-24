import { noon } from '../../domain/calendar'
import type { DayState } from '../../domain/calendar'

export const STATE_LABELS: Record<DayState, string> = {
  done: 'fait', planned: 'prévu', rest: 'repos', missed: 'manqué', moved: 'reporté',
}

/** Complément d'étiquette d'un jour de règles (notées ou prévues). */
export const periodLabel = (state: 'period' | 'predicted' | null) =>
  state === 'period' ? ', Règles' : state === 'predicted' ? ', Règles prévues' : ''

const fmt = (date: string, options: Intl.DateTimeFormatOptions) => noon(date).toLocaleDateString('fr-FR', options)

/** « mercredi 21 octobre » */
export const longDate = (date: string) => fmt(date, { weekday: 'long', day: 'numeric', month: 'long' })
/** « 21 octobre » */
export const dayMonth = (date: string) => fmt(date, { day: 'numeric', month: 'long' })
/** « mer. 21 » */
export const shortDay = (date: string) => fmt(date, { weekday: 'short', day: 'numeric' })
/** « octobre 2026 » */
export const monthTitle = (date: string) => fmt(date, { month: 'long', year: 'numeric' })

/** « 19 – 25 oct. » ou « 28 sept. – 4 oct. » */
export function weekTitle(monday: string, sunday: string): string {
  const month = (d: string) => fmt(d, { month: 'short' })
  const day = (d: string) => noon(d).getDate()
  return month(monday) === month(sunday)
    ? `${day(monday)} – ${day(sunday)} ${month(sunday)}`
    : `${day(monday)} ${month(monday)} – ${day(sunday)} ${month(sunday)}`
}
