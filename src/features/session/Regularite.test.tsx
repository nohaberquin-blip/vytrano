import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { saveWeekdays } from '../../data/calendar'
import { db } from '../../data/db'
import { addDay, addDayExercise, createProgram } from '../../data/programs'
import { publishCard } from '../../data/progress'
import { addDays, toISODate, weekStart } from '../../domain/calendar'
import { WithUser, testProfile } from '../../test/auth'
import { SessionPage } from './SessionPage'
import { GlobalRestBar, RestProvider } from './RestProvider'

vi.mock('./beep', () => ({ playBeeps: vi.fn(), unlockAudio: vi.fn() }))
vi.mock('../../data/progress', async (orig) => ({
  ...(await orig<typeof import('../../data/progress')>()),
  publishCard: vi.fn().mockResolvedValue({ error: null }),
}))

const today = toISODate(new Date())

beforeEach(async () => {
  localStorage.clear()
  sessionStorage.clear()
  vi.mocked(publishCard).mockClear()
  await Promise.all(db.tables.map((t) => t.clear()))
  const p = await createProgram('u', 'Prog')
  const day = await addDay(p.id, 'Jambes')
  await db.exercises.put({ id: 'e0', owner_id: null, name: 'Squat', muscle_group: 'Jambes' })
  await addDayExercise('u', day.id, 'e0')
})

const renderPage = (profile = testProfile) =>
  render(<MemoryRouter><WithUser profile={profile}><RestProvider><SessionPage /><GlobalRestBar /></RestProvider></WithUser></MemoryRouter>)

const done = (id: string, date: string) => db.workouts.put({
  id, user_id: 'u', program_day_id: null, name: 'S', started_at: `${date}T10:00:00.000Z`, finished_at: `${date}T11:00:00.000Z`, status: 'done',
})

test('série affichée sous le programme', async () => {
  // Deux semaines passées réussies (objectif 1 séance).
  const monday = weekStart(today)
  await saveWeekdays('u', [1], addDays(monday, -14))
  await done('a', addDays(monday, -14))
  await done('b', addDays(monday, -7))
  renderPage()
  expect(await screen.findByText('🔥 2 semaines')).toBeInTheDocument()
})

test('fin de séance : +100 XP et nouveau badge ; carte publiée si le partage est activé', async () => {
  renderPage({ ...testProfile, share_progress: true })
  expect(screen.queryByText(/🔥/)).not.toBeInTheDocument()
  await userEvent.click(await screen.findByRole('button', { name: 'Commencer' }))
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  await userEvent.click(await screen.findByRole('button', { name: 'Terminer la séance' }))
  expect(await screen.findByText('+100 XP')).toBeInTheDocument()
  expect(screen.getByText('Nouveau badge : 1re séance')).toBeInTheDocument()
  expect(publishCard).toHaveBeenCalledWith('u', expect.objectContaining({ xp: 100 }))
})

test('partage désactivé : rien n’est publié', async () => {
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'Commencer' }))
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  await userEvent.click(await screen.findByRole('button', { name: 'Terminer la séance' }))
  expect(await screen.findByText('+100 XP')).toBeInTheDocument()
  expect(publishCard).not.toHaveBeenCalled()
})
