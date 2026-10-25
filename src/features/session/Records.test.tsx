import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { db } from '../../data/db'
import { addDay, addDayExercise, createProgram } from '../../data/programs'
import { WithUser } from '../../test/auth'
import { SessionPage } from './SessionPage'
import { GlobalRestBar, RestProvider } from './RestProvider'

vi.mock('./beep', () => ({ playBeeps: vi.fn(), unlockAudio: vi.fn() }))

beforeEach(async () => {
  localStorage.clear()
  sessionStorage.clear()
  Object.defineProperty(navigator, 'vibrate', { value: vi.fn(), configurable: true })
  await Promise.all(db.tables.map((t) => t.clear()))
  await db.exercises.put({ id: 'squat', owner_id: null, name: 'Squat', muscle_group: 'Jambes' })
  const p = await createProgram('u', 'Prog')
  const day = await addDay(p.id, 'Jambes')
  await addDayExercise('u', day.id, 'squat')
  const f = (await db.user_exercises.where('exercise_id').equals('squat').first())!
  await db.user_exercises.put({ ...f, sets: 2, target_reps: 5, current_weight: 105, auto_progression: true })
  // Séance précédente : 100 kg × 5 (1RM estimé 116,5).
  await db.workouts.put({ id: 'old', user_id: 'u', program_day_id: null, name: 'S', started_at: '2026-09-01T12:00:00', finished_at: '2026-09-01T13:00:00', status: 'done' })
  await db.workout_sets.put({ id: 'old-1', workout_id: 'old', exercise_id: 'squat', position: 0, target_reps: 5, reps: 5, weight: 100, done: true })
})

const renderPage = () => render(<MemoryRouter><WithUser><RestProvider><SessionPage /><GlobalRestBar /></RestProvider></WithUser></MemoryRouter>)

test('valider une série record : mention et vibration ; dévalider la retire ; bandeau de fin', async () => {
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'Commencer' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Valider la série 1' }))
  expect(await screen.findByText('🏆 Record ! Charge max 105 kg · 1RM estimé 122,5 kg')).toBeInTheDocument()
  expect(navigator.vibrate).toHaveBeenCalledWith([60, 40, 60])
  await userEvent.click(screen.getByRole('button', { name: 'Annuler la série 1' }))
  await vi.waitFor(() => expect(screen.queryByText(/🏆 Record/)).not.toBeInTheDocument())
  await userEvent.click(screen.getByRole('button', { name: 'Valider la série 1' }))
  await userEvent.click(screen.getByRole('button', { name: 'Valider la série 2' }))
  expect(await screen.findAllByText(/🏆 Record/)).toHaveLength(1) // série 2 égale : pas un record
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  await userEvent.click(screen.getByRole('button', { name: 'Terminer la séance' }))
  const banner = await screen.findByText(/🏆 1 record/)
  expect(banner).toHaveTextContent('🏆 1 record : Squat (charge max 105 kg, 1RM estimé 122,5 kg)')
})
