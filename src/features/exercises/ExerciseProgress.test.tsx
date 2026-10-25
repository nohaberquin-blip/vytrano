import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '../../data/db'
import { addDays, toISODate } from '../../domain/calendar'
import { WithUser } from '../../test/auth'
import { ExerciseProgress } from './ExerciseProgress'

const today = toISODate(new Date())
const long = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

async function session(id: string, date: string, weight: number, reps: number) {
  await db.workouts.put({ id, user_id: 'u', program_day_id: null, name: 'S', started_at: `${date}T12:00:00`, finished_at: `${date}T13:00:00`, status: 'done' })
  await db.workout_sets.put({ id: `${id}-1`, workout_id: id, exercise_id: 'squat', position: 0, target_reps: reps, reps, weight, done: true })
}

test('records, courbe, sélecteurs de mesure et de période', async () => {
  const old = addDays(today, -200)
  const mid = addDays(today, -30)
  const recent = addDays(today, -2)
  await session('a', old, 100, 5)
  await session('b', mid, 110, 3)
  await session('c', recent, 105, 8)
  render(<WithUser><ExerciseProgress exerciseId="squat" /></WithUser>)
  const section = await screen.findByRole('region', { name: 'Records' })
  expect(within(section).getByText(`Charge max 110 kg · ${long(mid)}`)).toBeInTheDocument()
  expect(within(section).getByText(`1RM estimé 133 kg · ${long(recent)}`)).toBeInTheDocument()
  const chart = screen.getByRole('img', { name: 'Courbe de progression' })
  expect(chart).toHaveAttribute('data-points', '3')
  expect(chart).toHaveAttribute('data-records', '2')
  expect(screen.getByRole('button', { name: '1RM estimé' })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(screen.getByRole('button', { name: 'Charge max' }))
  expect(screen.getByRole('button', { name: 'Charge max' })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(screen.getByRole('button', { name: '3 mois' }))
  expect(screen.getByRole('img', { name: 'Courbe de progression' })).toHaveAttribute('data-points', '2')
})

test('moins de 2 séances : message ; aucune : rien', async () => {
  const { unmount } = render(<WithUser><ExerciseProgress exerciseId="squat" /></WithUser>)
  await new Promise((r) => setTimeout(r, 30))
  expect(screen.queryByRole('region', { name: 'Records' })).not.toBeInTheDocument()
  unmount()
  await session('a', addDays(today, -3), 100, 5)
  render(<WithUser><ExerciseProgress exerciseId="squat" /></WithUser>)
  expect(await screen.findByText('Fais encore une séance pour voir ta courbe')).toBeInTheDocument()
})
