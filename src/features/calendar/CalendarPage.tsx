import { useState } from 'react'
import { loadCalendarInput } from '../../data/calendar'
import { db } from '../../data/db'
import { getActiveProgram } from '../../data/programs'
import { useLive } from '../../data/useLive'
import { addDays, buildCalendar, toISODate, weekStart, type CalendarDay } from '../../domain/calendar'
import { useUserId } from '../auth/AuthProvider'
import { DaySheet } from './DaySheet'
import { monthTitle, weekTitle } from './format'
import { MonthView } from './MonthView'
import { WeekView } from './WeekView'
import { WeekdaysSetup } from './WeekdaysSetup'

type View = 'month' | 'week'
const VIEW_KEY = 'vytrano.calendar.view'

function readView(): View {
  try { return localStorage.getItem(VIEW_KEY) === 'week' ? 'week' : 'month' } catch { return 'month' }
}
function storeView(v: View) {
  try { localStorage.setItem(VIEW_KEY, v) } catch { /* stockage indisponible : la vue n'est pas mémorisée */ }
}

const monthStart = (date: string) => `${date.slice(0, 7)}-01`

export function CalendarPage() {
  const userId = useUserId()
  const today = toISODate(new Date())
  const input = useLive(() => loadCalendarInput(userId, today), [userId, today])
  const exercises = useLive(async () => {
    const tree = await getActiveProgram(userId)
    const map = new Map<string, string[]>()
    for (const d of tree?.days ?? []) {
      const items = tree!.exercisesByDay.get(d.id) ?? []
      map.set(d.id, (await Promise.all(items.map((i) => db.exercises.get(i.exercise_id)))).map((e) => e?.name ?? '…'))
    }
    return map
  }, [userId])
  const [view, setView] = useState<View>(readView)
  const [cursor, setCursor] = useState(today)
  const [editing, setEditing] = useState(false)
  const [picked, setPicked] = useState<CalendarDay | null>(null)

  if (input === undefined || exercises === undefined) return null
  if (input === null || editing) {
    return (
      <section className="page">
        <h1>Calendrier</h1>
        <WeekdaysSetup initial={input?.schedule.weekdays ?? []} onDone={() => setEditing(false)}
          onCancel={input ? () => setEditing(false) : undefined} />
      </section>
    )
  }

  const switchView = (v: View) => { setView(v); storeView(v) }
  let from: string, to: string, title: string
  if (view === 'month') {
    const first = monthStart(cursor)
    const last = addDays(monthStart(addDays(first, 32)), -1)
    from = weekStart(first)
    to = addDays(weekStart(last), 6)
    title = monthTitle(first)
  } else {
    from = weekStart(cursor)
    to = addDays(from, 6)
    title = weekTitle(from, to)
  }
  const cal = buildCalendar(input, from, to)
  const step = (dir: -1 | 1) => setCursor(view === 'month'
    ? monthStart(dir === 1 ? addDays(monthStart(cursor), 32) : addDays(monthStart(cursor), -1))
    : addDays(cursor, 7 * dir))

  return (
    <section className="page">
      <div className="row between">
        <h1 style={{ textTransform: 'capitalize' }}>{title}</h1>
        <button className="btn ghost icon" aria-label="Jours d'entraînement" onClick={() => setEditing(true)}>⚙︎</button>
      </div>
      <div className="row cal-nav">
        <button className="btn icon" aria-label="Précédent" onClick={() => step(-1)}>‹</button>
        <button className="btn" style={{ flex: 1 }} onClick={() => setCursor(today)}>Aujourd'hui</button>
        <button className="btn icon" aria-label="Suivant" onClick={() => step(1)}>›</button>
      </div>
      <div className="segmented" role="group">
        <button type="button" aria-pressed={view === 'month'} onClick={() => switchView('month')}>Mois</button>
        <button type="button" aria-pressed={view === 'week'} onClick={() => switchView('week')}>Semaine</button>
      </div>
      {view === 'month'
        ? <MonthView month={cursor.slice(0, 7)} cal={cal} input={input} onPick={setPicked} />
        : <WeekView monday={from} cal={cal} input={input} exercises={exercises} onPick={setPicked} />}
      {picked && <DaySheet day={picked} input={input} exercises={exercises} onClose={() => setPicked(null)} />}
    </section>
  )
}
