import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { db } from '../../data/db'
import { saveWeekdays } from '../../data/calendar'
import { addDay, addDayExercise, createProgram } from '../../data/programs'
import { WithUser } from '../../test/auth'
import { SessionPage } from './SessionPage'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  await Promise.all(db.tables.map((t) => t.clear()))
  const p = await createProgram('u', 'Prog')
  const day = await addDay(p.id, 'Jour A')
  await db.exercises.put({ id: 'squat', owner_id: null, name: 'Squat', muscle_group: 'Jambes' })
  await addDayExercise('u', day.id, 'squat')
})
afterEach(() => vi.useRealTimers())

const renderPage = () => render(<MemoryRouter><WithUser><SessionPage /></WithUser></MemoryRouter>)

test('jour de repos : mention affichée, on peut toujours commencer', async () => {
  vi.setSystemTime(new Date(2026, 9, 20, 10)) // mardi
  await saveWeekdays('u', [1, 3, 5], '2026-10-01')
  renderPage()
  expect(await screen.findByText("Jour de repos aujourd'hui")).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Commencer' })).toBeInTheDocument()
})

test('jour d’entraînement : pas de mention', async () => {
  vi.setSystemTime(new Date(2026, 9, 21, 10)) // mercredi
  await saveWeekdays('u', [1, 3, 5], '2026-10-01')
  renderPage()
  expect(await screen.findByRole('button', { name: 'Commencer' })).toBeInTheDocument()
  expect(screen.queryByText("Jour de repos aujourd'hui")).toBeNull()
})

test('sans calendrier réglé : pas de mention', async () => {
  vi.setSystemTime(new Date(2026, 9, 20, 10))
  renderPage()
  expect(await screen.findByRole('button', { name: 'Commencer' })).toBeInTheDocument()
  expect(screen.queryByText("Jour de repos aujourd'hui")).toBeNull()
})
