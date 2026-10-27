import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { saveWeekdays } from '../../data/calendar'
import { db } from '../../data/db'
import { WithUser } from '../../test/auth'
import { CalendarPage } from './CalendarPage'

const full = vi.hoisted(() => vi.fn())
vi.mock('../../data/records', async (orig) => {
  const actual = await orig<typeof import('../../data/records')>()
  full.mockImplementation(actual.historyByExercise)
  return { ...actual, historyByExercise: full }
})

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 21, 10))
  localStorage.clear()
  full.mockClear()
  await Promise.all(db.tables.map((t) => t.clear()))
  await saveWeekdays('u', [1, 3, 5], '2026-10-01')
})
afterEach(() => vi.useRealTimers())

test('le Calendrier ne relit pas tout l’historique ; le bilan le charge à l’ouverture', async () => {
  render(<MemoryRouter><WithUser><CalendarPage /></WithUser></MemoryRouter>)
  await screen.findByRole('region', { name: 'Mes défis' })
  expect(full).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Bilan du mois' }))
  expect(await screen.findByRole('dialog', { name: 'Ton bilan d’octobre' })).toBeInTheDocument()
  expect(full).toHaveBeenCalled()
})
