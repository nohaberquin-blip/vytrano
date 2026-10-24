import { render, screen, waitFor, within } from '@testing-library/react'
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
  await Promise.all(db.tables.map((t) => t.clear()))
  const p = await createProgram('u', 'Prog')
  const day = await addDay(p.id, 'Jour long')
  const names = ['Squat', 'Presse', 'Fentes', 'Leg extension', 'Leg curl', 'Mollets']
  for (const [i, name] of names.entries()) {
    await db.exercises.put({ id: `e${i}`, owner_id: null, name, muscle_group: 'Jambes' })
    await addDayExercise('u', day.id, `e${i}`)
    const f = (await db.user_exercises.where('exercise_id').equals(`e${i}`).first())!
    await db.user_exercises.put({ ...f, sets: 4, target_reps: 8, current_weight: 60 })
  }
})

const renderPage = () => render(<MemoryRouter><WithUser><RestProvider><SessionPage /><GlobalRestBar /></RestProvider></WithUser></MemoryRouter>)

test('option facultative : lien, choix, aperçu, annulation', async () => {
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: '⏱ Temps limité ?' }))
  await userEvent.click(screen.getByRole('button', { name: '20 min' }))
  const preview = await screen.findByRole('region', { name: 'Temps limité' })
  await waitFor(() => expect(preview).toHaveTextContent(/Séance adaptée : ~\d+ min au lieu de ~\d+/))
  expect(preview).toHaveTextContent('Mollets : retiré')
  await userEvent.click(within(preview).getByRole('button', { name: 'Annuler' }))
  expect(screen.getByRole('button', { name: '⏱ Temps limité ?' })).toBeInTheDocument()
})

test('séance qui tient dans le temps choisi', async () => {
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: '⏱ Temps limité ?' }))
  await userEvent.click(screen.getByRole('button', { name: '90 min' }))
  expect(await screen.findByText(/Ta séance tient en ~\d+ min/)).toBeInTheDocument()
})

test('Commencer avec 20 min : séance adaptée et mention pendant la séance', async () => {
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: '⏱ Temps limité ?' }))
  await userEvent.click(screen.getByRole('button', { name: '20 min' }))
  await screen.findByText(/Séance adaptée/)
  await userEvent.click(screen.getByRole('button', { name: 'Commencer' }))
  expect(await screen.findByText('Séance adaptée à 20 min')).toBeInTheDocument()
  const w = (await db.workouts.toArray())[0]
  expect(w.time_limit).toBe(20)
  expect(await db.workout_sets.where('workout_id').equals(w.id).count()).toBeLessThan(24)
})

test('temps libre : saisie de 35 min, bornes 10 à 180', async () => {
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: '⏱ Temps limité ?' }))
  const field = screen.getByLabelText('Temps disponible (minutes)')
  await userEvent.type(field, '5')
  expect(screen.getByText('Entre 10 et 180 min')).toBeInTheDocument()
  await userEvent.clear(field)
  await userEvent.type(field, '35')
  expect(await screen.findByText(/Séance adaptée : ~\d+ min/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '30 min' })).toHaveAttribute('aria-pressed', 'false')
  await userEvent.click(screen.getByRole('button', { name: 'Commencer' }))
  await screen.findByText('Séance adaptée à 35 min')
  expect((await db.workouts.toArray())[0].time_limit).toBe(35)
})

test('une proposition remplit le champ', async () => {
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: '⏱ Temps limité ?' }))
  await userEvent.click(screen.getByRole('button', { name: '45 min' }))
  expect(screen.getByLabelText('Temps disponible (minutes)')).toHaveValue('45')
})
