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

describe('selon la méthode', () => {
  const s = (i: number, kind: WorkoutSet['kind'], weight: number, target: number | null, max?: number): WorkoutSet =>
    ({ id: `m${i}`, workout_id: 'w', exercise_id: 'e', position: i, kind, target_reps: target, target_reps_max: max ?? null,
       reps: target === null || kind === 'amrap' ? 0 : target, weight, done: false })

  test('top set + back-off : étiquettes, méthode et résumé', () => {
    render(<ExerciseCard name="Squat" methodLabel="Top set + back-off" targetWeight={120} last={[]} onUpdate={() => {}} onAddSet={() => {}}
      sets={[s(0, 'warmup', 60, 8), s(1, 'top', 120, 5), s(2, 'backoff', 102.5, 8), s(3, 'backoff', 102.5, 8), s(4, 'backoff', 102.5, 8)]} />)
    expect(screen.getByText('Top set + back-off')).toBeInTheDocument()
    expect(screen.getByText('1 × 5 à 120 kg + 3 × 8 à 102,5 kg')).toBeInTheDocument()
    expect(screen.getByText('ÉCHAUF.')).toBeInTheDocument()
    expect(screen.getByText('TOP-SET')).toBeInTheDocument()
    expect(screen.getAllByText('BACK-OFF')).toHaveLength(3)
  })

  test('drop en retrait, AMRAP vide avec « max », fourchette affichée', () => {
    render(<ExerciseCard name="Curl" last={[]} onUpdate={() => {}} onAddSet={() => {}}
      sets={[s(0, 'work', 30, 8, 12), s(1, 'drop', 24, null), s(2, 'amrap', 30, 5)]} />)
    expect(screen.getByText('DROP').closest('.set-row')).toHaveClass('attached')
    const amrap = screen.getByLabelText('Reps série 3') as HTMLInputElement
    expect(amrap.value).toBe('')
    expect(amrap.placeholder).toBe('max')
    expect((screen.getByLabelText('Reps série 2') as HTMLInputElement).placeholder).toBe('échec')
    expect(screen.getByText('8-12')).toBeInTheDocument()
  })
})
