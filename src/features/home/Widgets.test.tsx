import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { addWeight, saveBodyProfile } from '../../data/body'
import { saveWeekdays } from '../../data/calendar'
import { db } from '../../data/db'
import { addDay, createProgram } from '../../data/programs'
import { WithUser } from '../../test/auth'
import { HomePage } from './HomePage'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 26, 10)) // lundi 26 octobre 2026
  localStorage.clear()
  await Promise.all(db.tables.map((t) => t.clear()))
})
afterEach(() => vi.useRealTimers())

const renderHome = () => render(<WithUser><MemoryRouter><HomePage /></MemoryRouter></WithUser>)
const widget = (name: string) => screen.findByRole('link', { name: new RegExp(`^${name}`) })
const done = (id: string, day: number, program_day_id: string | null = null) => db.workouts.put({
  id, user_id: 'u', program_day_id, name: 'S',
  started_at: new Date(2026, 9, day, 9).toISOString(), finished_at: new Date(2026, 9, day, 10).toISOString(), status: 'done',
})

test('prochaine séance : jour prévu et séance du programme', async () => {
  await saveWeekdays('u', [1, 3, 5], '2026-10-01')
  const p = await createProgram('u', 'Prog')
  await addDay(p.id, 'Push A')
  await addDay(p.id, 'Jambes')
  renderHome()
  const w = await widget('Prochaine séance')
  expect(w).toHaveAttribute('href', '/seance')
  expect(await within(w).findByText('Aujourd’hui · Push A')).toBeInTheDocument()
})

test('prochaine séance : sans programme', async () => {
  renderHome()
  expect(await within(await widget('Prochaine séance')).findByText('Choisis un programme')).toBeInTheDocument()
})

test('progression : niveau, titre et série', async () => {
  renderHome()
  const w = await widget('Progression')
  expect(w).toHaveAttribute('href', '/profil')
  expect(await within(w).findByText(/^Niveau 1 · /)).toBeInTheDocument()
  expect(w).toHaveTextContent('🔥 0 semaine')
  expect(within(w).getByRole('progressbar')).toBeInTheDocument()
})

test('calories : objectif du jour, ou fiche à compléter', async () => {
  const { unmount } = renderHome()
  expect(await within(await widget('Calories')).findByText('Complète ta fiche')).toBeInTheDocument()
  unmount()
  await saveBodyProfile('u', { sex: 'male', birth_date: '1996-10-25', height_cm: 180, activity: 'sedentary', sessions_per_week: 4, goal: 'cut' })
  await addWeight('u', '2026-10-25', 75)
  renderHome()
  const w = await widget('Calories')
  expect(w).toHaveAttribute('href', '/nutrition')
  expect(await within(w).findByText(/1\s940 kcal · 165 g de protéines par jour/)).toBeInTheDocument()
})

test('objectifs du jour : séance du jour faite, objectif du mois', async () => {
  await saveWeekdays('u', [1, 3, 5], '2026-10-01')
  await done('w1', 26)
  await done('w0', 23)
  renderHome()
  const w = await widget('Objectifs du jour')
  expect(w).toHaveAttribute('href', '/calendrier')
  expect(await within(w).findByText('✅ Séance du jour')).toBeInTheDocument()
  // Octobre 2026 : 13 lundis, mercredis et vendredis.
  expect(within(w).getByText('⬜ Objectif d’octobre : 2 / 13 séances')).toBeInTheDocument()
})

test('objectifs du jour : rien de prévu', async () => {
  renderHome()
  expect(await within(await widget('Objectifs du jour')).findByText('Rien de prévu aujourd’hui')).toBeInTheDocument()
})
