import { weekProgress, type CalendarDay, type CalendarInput } from '../../domain/calendar'
import { periodState } from '../../domain/cycle'
import type { Period } from '../../domain/types'
import { STATE_LABELS, periodLabel, dayMonth } from './format'

const HEADS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

/** Grille du mois (semaines complètes), progression de chaque semaine en bout de ligne. */
export function MonthView({ month, cal, input, periods, onPick }: {
  /** `YYYY-MM` du mois affiché. */
  month: string
  cal: CalendarDay[]
  input: CalendarInput
  /** Règles notées ; null = mode absent (profil non « Femme »). */
  periods: Period[] | null
  onPick(day: CalendarDay): void
}) {
  const weeks: CalendarDay[][] = []
  for (let i = 0; i < cal.length; i += 7) weeks.push(cal.slice(i, i + 7))
  return (
    <div className="cal-grid">
      {HEADS.map((h, i) => <span key={i} className="cal-head muted small" aria-hidden>{h}</span>)}
      <span aria-hidden />
      {weeks.map((week) => {
        const p = weekProgress(input, week[0].date)
        return [
          ...week.map((d) => {
            const ps = periods && periodState(d.date, periods, input.today)
            return (
            <button key={d.date} aria-label={`${dayMonth(d.date)}, ${STATE_LABELS[d.state]}${periodLabel(ps)}`}
              className={['cal-cell', `cal-${d.state}`, ps && `period-${ps}`, d.date === input.today && 'today', !d.date.startsWith(month) && 'out'].filter(Boolean).join(' ')}
              onClick={() => onPick(d)}>
              <span className="num">{Number(d.date.slice(8))}</span>
              <span className="cal-dot" aria-hidden />
              {ps && <span className="period-mark" aria-hidden />}
            </button>
            )
          }),
          <span key={`p${week[0].date}`} className={p.reached ? 'cal-progress reached num' : 'cal-progress num'}>{p.done}/{p.goal}</span>,
        ]
      })}
    </div>
  )
}
