import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { saveBodyProfile } from '../../data/body'
import { startPeriod } from '../../data/cycle'
import { db } from '../../data/db'
import { addDay, addDayExercise, createProgram } from '../../data/programs'
import { addDays, toISODate } from '../../domain/calendar'
import { WithUser } from '../../test/auth'
import { SessionPage } from './SessionPage'
import { GlobalRestBar, RestProvider } from './RestProvider'

vi.mock('./beep', () => ({ playBeeps: vi.fn(), unlockAudio: vi.fn() }))

const today = toISODate(new Date())

beforeEach(async () => {
  localStorage.clear()
  await Promise.all(db.tables.map((t) => t.clear()))
  const p = await createProgram('u', 'Prog')
  const day = await addDay(p.id, 'Jambes')
  for (const [i, name] of ['Squat', 'Presse'].entries()) {
    await db.exercises.put({ id: `e${i}`, owner_id: null, name, muscle_group: 'Jambes' })
    await addDayExercise('u', day.id, `e${i}`)
    const f = (await db.user_exercises.where('exercise_id').equals(`e${i}`).first())!
    await db.user_exercises.put({ ...f, sets: 4, target_reps: 8, current_weight: 60 })
  }
})

const renderPage = () => render(<MemoryRouter><WithUser><RestProvider><SessionPage /><GlobalRestBar /></RestProvider></WithUser></MemoryRouter>)
const LINK = { name: '🌸 Je ne me sens pas bien' }

test('jour de règles : lien, −10 %, aperçu, annulation', async () => {
  await saveBodyProfile('u', { sex: 'female' })
  await startPeriod('u', addDays(today, -1))
  renderPage()
  await userEvent.click(await screen.findByRole('button', LINK))
  await userEvent.click(screen.getByRole('button', { name: '−10 %' }))
  const panel = await screen.findByRole('region', { name: 'Séance allégée' })
  await waitFor(() => expect(panel).toHaveTextContent('Squat : 60 → 55 kg'))
  expect(panel).toHaveTextContent('Presse : 60 → 55 kg')
  await userEvent.click(within(panel).getByRole('button', { name: 'Moins de séries' }))
  await waitFor(() => expect(panel).toHaveTextContent('Squat : 4 → 2 séries'))
  await userEvent.click(within(panel).getByRole('button', { name: 'Annuler' }))
  expect(screen.getByRole('button', LINK)).toBeInTheDocument()
})

test('jour de règles prévu : lien proposé aussi', async () => {
  await saveBodyProfile('u', { sex: 'female' })
  await startPeriod('u', addDays(today, -28))
  renderPage()
  expect(await screen.findByRole('button', LINK)).toBeInTheDocument()
})

test('hors règles, ou profil non « Femme » : pas de lien', async () => {
  await saveBodyProfile('u', { sex: 'female' })
  await startPeriod('u', addDays(today, -10))
  const { unmount } = renderPage()
  expect(await screen.findByRole('button', { name: 'Commencer' })).toBeInTheDocument()
  expect(screen.queryByRole('button', LINK)).not.toBeInTheDocument()
  unmount()
  await saveBodyProfile('u', { sex: 'male' })
  await startPeriod('u', today)
  renderPage()
  expect(await screen.findByRole('button', { name: 'Commencer' })).toBeInTheDocument()
  expect(screen.queryByRole('button', LINK)).not.toBeInTheDocument()
})

test('Commencer avec « Moins de séries » : séance allégée, 2 séries par exercice', async () => {
  await saveBodyProfile('u', { sex: 'female' })
  await startPeriod('u', today)
  renderPage()
  await userEvent.click(await screen.findByRole('button', LINK))
  await userEvent.click(screen.getByRole('button', { name: 'Moins de séries' }))
  await userEvent.click(screen.getByRole('button', { name: 'Commencer' }))
  await screen.findByRole('button', { name: 'Terminer la séance' })
  expect(screen.getByText('Séance allégée')).toBeInTheDocument()
  const w = (await db.workouts.toArray())[0]
  expect(w.lightened).toBe('fewer')
  await waitFor(async () => expect(await db.workout_sets.where('workout_id').equals(w.id).count()).toBe(4))
})
