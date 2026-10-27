import { render, screen } from '@testing-library/react'
import { db } from '../data/db'
import { WithUser } from '../test/auth'
import { MonthReportAuto } from './MonthReportAuto'

const load = vi.hoisted(() => vi.fn())
vi.mock('../data/challenges', async (orig) => {
  const actual = await orig<typeof import('../data/challenges')>()
  load.mockImplementation(actual.loadMonthData)
  return { ...actual, loadMonthData: load }
})

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 3, 10)) // 3 novembre 2026
  localStorage.clear()
  load.mockClear()
  await Promise.all(db.tables.map((t) => t.clear()))
})
afterEach(() => vi.useRealTimers())

test('sans séance le mois précédent, ne charge pas tout l’historique (même après une séance ce mois-ci)', async () => {
  render(<WithUser><MonthReportAuto /></WithUser>)
  await db.workouts.put({ id: 'n', user_id: 'u', program_day_id: null, name: 'S', started_at: new Date(2026, 10, 2, 12).toISOString(), finished_at: new Date(2026, 10, 2, 13).toISOString(), status: 'done' })
  await new Promise((r) => setTimeout(r, 80))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(load).not.toHaveBeenCalled()
})

test('avec une séance le mois précédent, le bilan s’ouvre', async () => {
  await db.workouts.put({ id: 'a', user_id: 'u', program_day_id: null, name: 'S', started_at: new Date(2026, 9, 12, 12).toISOString(), finished_at: new Date(2026, 9, 12, 13).toISOString(), status: 'done' })
  render(<WithUser><MonthReportAuto /></WithUser>)
  expect(await screen.findByRole('dialog', { name: 'Ton bilan d’octobre' })).toBeInTheDocument()
})
