import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { db } from '../../data/db'
import { WithUser } from '../../test/auth'
import { HistoryPage } from './HistoryPage'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

const done = (id: string, name: string, start: Date, minutes: number) => db.workouts.put({
  id, user_id: 'u', program_day_id: null, name, started_at: start.toISOString(),
  finished_at: new Date(start.getTime() + minutes * 60_000).toISOString(), status: 'done',
})
const renderPage = () => render(<MemoryRouter><WithUser><HistoryPage /></WithUser></MemoryRouter>)

test('séances groupées par mois, récentes d’abord ; toucher ouvre le détail', async () => {
  await db.exercises.put({ id: 'squat', owner_id: null, name: 'Squat', muscle_group: 'Jambes' })
  await done('a', 'Jambes', new Date(2026, 8, 14, 18), 50)
  await done('b', 'Push', new Date(2026, 9, 2, 18), 45)
  await done('c', 'Pull', new Date(2026, 9, 20, 18), 60)
  await db.workout_sets.put({ id: 's1', workout_id: 'c', exercise_id: 'squat', position: 0, target_reps: 5, reps: 5, weight: 100, done: true })
  renderPage()
  expect(await screen.findByRole('heading', { name: 'Octobre 2026 · 2 séances' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Septembre 2026 · 1 séance' })).toBeInTheDocument()
  const rows = screen.getAllByRole('button', { name: /Jambes|Push|Pull/ })
  expect(rows.map((r) => r.textContent?.slice(0, 4))).toEqual(['Pull', 'Push', 'Jamb'])
  expect(rows[0]).toHaveTextContent('1 exercice · 60 min')
  expect(screen.getByRole('link', { name: '‹ Profil' })).toHaveAttribute('href', '/profil')
  await userEvent.click(rows[0])
  const sheet = await screen.findByRole('dialog', { name: 'Pull' })
  expect(await within(sheet).findByText('Squat')).toBeInTheDocument()
})

test('aucune séance', async () => {
  renderPage()
  expect(await screen.findByText('Aucune séance terminée pour l’instant.')).toBeInTheDocument()
})
