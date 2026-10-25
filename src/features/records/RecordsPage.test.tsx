import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { db } from '../../data/db'
import { WithUser } from '../../test/auth'
import { RecordsPage } from './RecordsPage'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

async function session(id: string, date: string, sets: [string, number, number][]) {
  await db.workouts.put({ id, user_id: 'u', program_day_id: null, name: 'S', started_at: `${date}T12:00:00`, finished_at: `${date}T13:00:00`, status: 'done' })
  await db.workout_sets.bulkPut(sets.map(([ex, weight, reps], i) => ({ id: `${id}-${i}`, workout_id: id, exercise_id: ex, position: i, target_reps: reps, reps, weight, done: true })))
}

const renderPage = () => render(<MemoryRouter><WithUser><RecordsPage /></WithUser></MemoryRouter>)

test('vide : invitation', async () => {
  renderPage()
  expect(await screen.findByText('Termine une séance pour voir tes records.')).toBeInTheDocument()
})

test('liste triée par dernier record ; toucher un exercice ouvre sa fiche', async () => {
  await db.exercises.bulkPut([
    { id: 'squat', owner_id: null, name: 'Squat', muscle_group: 'Jambes' },
    { id: 'bench', owner_id: null, name: 'Développé couché', muscle_group: 'Pectoraux' },
  ])
  await db.user_exercises.bulkPut([
    { id: 'f1', user_id: 'u', exercise_id: 'squat', current_weight: 110, sets: 3, target_reps: 5, increment: 2.5 },
    { id: 'f2', user_id: 'u', exercise_id: 'bench', current_weight: 80, sets: 3, target_reps: 5, increment: 2.5 },
  ])
  await session('a', '2026-09-01', [['squat', 100, 5], ['bench', 80, 5]])
  await session('b', '2026-09-08', [['bench', 85, 5]])
  await session('c', '2026-09-15', [['squat', 110, 5]])
  renderPage()
  const rows = await screen.findAllByRole('button', { name: /Charge max/ })
  expect(rows.map((r) => r.textContent)).toEqual([
    expect.stringContaining('Squat'),
    expect.stringContaining('Développé couché'),
  ])
  expect(rows[0]).toHaveTextContent('Charge max 110 kg · 1RM estimé 128,5 kg')
  await userEvent.click(rows[0])
  expect(await screen.findByRole('dialog', { name: 'Squat' })).toBeInTheDocument()
})

test('exercice fait une seule fois : « Première séance » plutôt qu’un faux dernier record', async () => {
  await db.exercises.put({ id: 'squat', owner_id: null, name: 'Squat', muscle_group: 'Jambes' })
  await session('a', '2026-09-01', [['squat', 100, 5]])
  renderPage()
  expect(await screen.findByText(/Première séance : 1 sept\. 2026/)).toBeInTheDocument()
  expect(screen.queryByText(/Dernier record/)).not.toBeInTheDocument()
})
