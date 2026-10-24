import { weekProgress, type CalendarDay, type CalendarInput } from '../../domain/calendar'
import { STATE_LABELS, dayMonth } from './format'

const HEADS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

/** Grille du mois (semaines complètes), progression de chaque semaine en bout de ligne. */
export function MonthView({ month, cal, input, onPick }: {
  /** `YYYY-MM` du mois affiché. */
  month: string
  cal: CalendarDay[]
  input: CalendarInput
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
          ...week.map((d) => (
            <button key={d.date} aria-label={`${dayMonth(d.date)}, ${STATE_LABELS[d.state]}`}
              className={['cal-cell', `cal-${d.state}`, d.date === input.today && 'today', !d.date.startsWith(month) && 'out'].filter(Boolean).join(' ')}
              onClick={() => onPick(d)}>
              <span className="num">{Number(d.date.slice(8))}</span>
              <span className="cal-dot" aria-hidden />
            </button>
          )),
          <span key={`p${week[0].date}`} className={p.reached ? 'cal-progress reached num' : 'cal-progress num'}>{p.done}/{p.goal}</span>,
        ]
      })}
    </div>
  )
}
