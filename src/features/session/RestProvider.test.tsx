import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppRoutes } from '../../app/App'
import { db } from '../../data/db'
import { addDay, addDayExercise, createProgram } from '../../data/programs'
import { startWorkout } from '../../data/workouts'
import { WithUser } from '../../test/auth'

vi.mock('./beep', () => ({ playBeeps: vi.fn(), unlockAudio: vi.fn() }))

beforeEach(async () => {
  localStorage.clear()
  await Promise.all(db.tables.map((t) => t.clear()))
  const p = await createProgram('u', 'Prog')
  const day = await addDay(p.id, 'Jour A')
  await db.exercises.put({ id: 'squat', owner_id: null, name: 'Squat', muscle_group: 'Jambes' })
  await addDayExercise('u', day.id, 'squat')
  await startWorkout('u', day)
})

test('le repos continue quand on change d’onglet', async () => {
  render(<WithUser><MemoryRouter initialEntries={['/seance']}><AppRoutes /></MemoryRouter></WithUser>)
  await userEvent.click(await screen.findByRole('button', { name: 'Valider la série 1' }))
  expect(await screen.findByRole('timer', { name: 'Repos' })).toHaveTextContent('2:00')
  await userEvent.click(screen.getByRole('link', { name: '‹ Accueil' }))
  expect(screen.getByRole('timer', { name: 'Repos' })).toBeInTheDocument()
})
