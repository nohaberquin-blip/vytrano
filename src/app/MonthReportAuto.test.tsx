import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '../data/db'
import { WithUser } from '../test/auth'
import { MonthReportAuto } from './MonthReportAuto'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 3, 10)) // 3 novembre 2026
  localStorage.clear()
  await Promise.all(db.tables.map((t) => t.clear()))
})
afterEach(() => vi.useRealTimers())

test('s’ouvre une seule fois au début du mois s’il y a eu des séances le mois précédent', async () => {
  await db.workouts.put({ id: 'a', user_id: 'u', program_day_id: null, name: 'S', started_at: new Date(2026, 9, 12, 12).toISOString(), finished_at: new Date(2026, 9, 12, 13).toISOString(), status: 'done' })
  const { unmount } = render(<WithUser><MonthReportAuto /></WithUser>)
  expect(await screen.findByRole('dialog', { name: 'Ton bilan d’octobre' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))
  unmount()
  render(<WithUser><MonthReportAuto /></WithUser>)
  await new Promise((r) => setTimeout(r, 50))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('ne s’ouvre pas sans séance le mois précédent', async () => {
  render(<WithUser><MonthReportAuto /></WithUser>)
  await new Promise((r) => setTimeout(r, 50))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
