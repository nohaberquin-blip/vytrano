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
const tile = (name: string) => screen.findByRole('link', { name: new RegExp(`^${name}`) })
const done = (id: string, day: number) => db.workouts.put({
  id, user_id: 'u', program_day_id: null, name: 'S',
  started_at: new Date(2026, 9, day, 9).toISOString(), finished_at: new Date(2026, 9, day, 10).toISOString(), status: 'done',
})

test('Séances : démarrer la prochaine séance prévue', async () => {
  await saveWeekdays('u', [1, 3, 5], '2026-10-01')
  const p = await createProgram('u', 'Prog')
  await addDay(p.id, 'Push A')
  await addDay(p.id, 'Jambes')
  renderHome()
  const t = await tile('Séances')
  expect(t).toHaveAttribute('href', '/seance')
  expect(await within(t).findByText('Démarrer')).toBeInTheDocument()
  expect(within(t).getByText('Aujourd’hui · Push A')).toBeInTheDocument()
  expect(t).toHaveAccessibleName('Séances Démarrer Aujourd’hui · Push A')
})

test('Séances : sans programme', async () => {
  renderHome()
  expect(await within(await tile('Séances')).findByText('Choisis un programme')).toBeInTheDocument()
})

test('Séances : séance en cours → Reprendre', async () => {
  await db.workouts.put({
    id: 'w1', user_id: 'u', program_day_id: null, name: 'Libre',
    started_at: new Date(Date.now() - 32 * 60_000).toISOString(), finished_at: null, status: 'in_progress',
  })
  renderHome()
  const t = await tile('Séances')
  expect(await within(t).findByText('Reprendre')).toBeInTheDocument()
  expect(within(t).getByText('32 min')).toBeInTheDocument()
})

test('Profil : niveau, titre et série', async () => {
  renderHome()
  const t = await tile('Profil')
  expect(t).toHaveAttribute('href', '/profil')
  expect(await within(t).findByText(/^Niv\. 1 · /)).toBeInTheDocument()
  expect(t).toHaveTextContent('0 semaine')
  expect(t).not.toHaveAccessibleName(/🔥/)
  expect(within(t).getByRole('progressbar')).toBeInTheDocument()
})

test('Nutrition : objectif du jour, ou fiche à compléter', async () => {
  const { unmount } = renderHome()
  expect(await within(await tile('Nutrition')).findByText('Complète ta fiche')).toBeInTheDocument()
  unmount()
  await saveBodyProfile('u', { sex: 'male', birth_date: '1996-10-25', height_cm: 180, activity: 'sedentary', sessions_per_week: 4, goal: 'cut' })
  await addWeight('u', '2026-10-25', 75)
  renderHome()
  const t = await tile('Nutrition')
  expect(t).toHaveAttribute('href', '/nutrition')
  expect(await within(t).findByText(/1\s940 kcal/)).toBeInTheDocument()
  expect(within(t).getByText('165 g de protéines')).toBeInTheDocument()
})

test('Calendrier : séance du jour faite, objectif du mois', async () => {
  await saveWeekdays('u', [1, 3, 5], '2026-10-01')
  await done('w1', 26)
  await done('w0', 23)
  renderHome()
  const t = await tile('Calendrier')
  expect(t).toHaveAttribute('href', '/calendrier')
  expect(await within(t).findByText('Séance du jour')).toBeInTheDocument()
  expect(within(t).getByText('2 / 13 séances en octobre')).toBeInTheDocument()
  // Les emojis ne sont pas lus : « fait » / « à faire » à la place.
  expect(t).toHaveAccessibleName('Calendrier fait : Séance du jour à faire : 2 / 13 séances en octobre')

})

test('Calendrier : rien de prévu', async () => {
  renderHome()
  expect(await within(await tile('Calendrier')).findByText('Rien de prévu aujourd’hui')).toBeInTheDocument()
})
