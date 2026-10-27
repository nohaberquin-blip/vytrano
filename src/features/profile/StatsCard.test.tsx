import { render, screen, within } from '@testing-library/react'
import { db } from '../../data/db'
import { WithUser } from '../../test/auth'
import { StatsCard } from './StatsCard'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

test('nouvel utilisateur : 0 séance, 0 min, 0 kg', async () => {
  render(<WithUser><StatsCard /></WithUser>)
  const card = await screen.findByRole('region', { name: 'Mes stats' })
  expect(await within(card).findByText('0 séance')).toBeInTheDocument()
  expect(within(card).getByText('0 min')).toBeInTheDocument()
  expect(within(card).getByText('0 kg')).toBeInTheDocument()
})

test('séances, heures et tonnes', async () => {
  for (const [id, day] of [['a', 1], ['b', 3]] as const) {
    await db.workouts.put({ id, user_id: 'u', program_day_id: null, name: 'S', started_at: `2026-10-0${day}T10:00:00.000Z`, finished_at: `2026-10-0${day}T11:00:00.000Z`, status: 'done' })
    await db.workout_sets.put({ id: `${id}1`, workout_id: id, exercise_id: 'squat', position: 0, target_reps: 10, reps: 10, weight: 100, done: true })
  }
  render(<WithUser><StatsCard /></WithUser>)
  const card = await screen.findByRole('region', { name: 'Mes stats' })
  expect(await within(card).findByText('2 séances')).toBeInTheDocument()
  expect(within(card).getByText('2 h')).toBeInTheDocument()
  expect(within(card).getByText('2 t')).toBeInTheDocument()
})
