import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExerciseCard } from './ExerciseCard'
import type { WorkoutSet } from '../../domain/types'

const set = (i: number, weight: number, done = false): WorkoutSet =>
  ({ id: `s${i}`, workout_id: 'w', exercise_id: 'e', position: i, target_reps: 8, reps: 8, weight, done })

test('affiche la cible, la dernière fois, et valide une série', async () => {
  const onUpdate = vi.fn()
  render(<ExerciseCard name="Squat" sets={[0, 1, 2, 3].map((i) => set(i, 62.5))}
    last={[0, 1, 2, 3].map((i) => set(i, 60, true))} onUpdate={onUpdate} onAddSet={() => {}} />)
  expect(screen.getByText('4 × 8 à 62,5 kg')).toBeInTheDocument()
  expect(screen.getByText('Dernière fois : 60 kg · 8, 8, 8, 8')).toBeInTheDocument()
  expect(screen.getByLabelText('Charge en hausse')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Valider la série 1' }))
  expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: 's0', done: true }))
})

test('première fois : pas de « dernière fois » ni de flèche', () => {
  render(<ExerciseCard name="Squat" sets={[set(0, 40)]} last={[]} onUpdate={() => {}} onAddSet={() => {}} />)
  expect(screen.getByText('1 × 8 à 40 kg')).toBeInTheDocument()
  expect(screen.queryByText(/Dernière fois/)).toBeNull()
  expect(screen.queryByLabelText('Charge en hausse')).toBeNull()
})
