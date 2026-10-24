import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExerciseSheet } from './ExerciseSheet'
import { WithUser } from '../../test/auth'
import type { Exercise, UserExercise } from '../../domain/types'

const exercise: Exercise = { id: 'e', owner_id: null, name: 'Squat', muscle_group: 'Jambes' }
const fiche: UserExercise = { id: 'f', user_id: 'u', exercise_id: 'e', current_weight: 60, sets: 4, target_reps: 8, increment: 2.5 }

function setup() {
  const save = vi.fn().mockResolvedValue(undefined)
  const onClose = vi.fn()
  render(<WithUser><ExerciseSheet exercise={exercise} fiche={fiche} save={save} onClose={onClose} /></WithUser>)
  return { save, onClose }
}

test('« 62,5 » est enregistré comme 62.5', async () => {
  const { save, onClose } = setup()
  const charge = screen.getByLabelText('Charge (kg)')
  await userEvent.clear(charge)
  await userEvent.type(charge, '62,5')
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ id: 'f', current_weight: 62.5, sets: 4, target_reps: 8, increment: 2.5 }))
  expect(onClose).toHaveBeenCalled()
})

test('charge invalide → bouton désactivé et message', async () => {
  const { save } = setup()
  const charge = screen.getByLabelText('Charge (kg)')
  await userEvent.clear(charge)
  await userEvent.type(charge, 'abc')
  expect(screen.getByText('Charge invalide')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
  expect(save).not.toHaveBeenCalled()
})

test('réglages de méthode enregistrés : mode manuel, arrondi, méthode', async () => {
  const { save } = setup()
  await userEvent.click(screen.getByRole('checkbox', { name: 'Progression automatique' }))
  const arrondi = screen.getByLabelText('Arrondi (kg)')
  await userEvent.clear(arrondi)
  await userEvent.type(arrondi, '2')
  await userEvent.selectOptions(screen.getByLabelText('Méthode'), 'top_backoff')
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  expect(save).toHaveBeenCalledWith(expect.objectContaining({
    auto_progression: false, rounding: 2, template: expect.objectContaining({ method: 'top_backoff' }),
  }))
})

test('méthode invalide → bouton désactivé', async () => {
  setup()
  for (const n of [1, 2, 3, 4]) await userEvent.selectOptions(screen.getByLabelText(`Type série ${n}`), 'warmup')
  expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
})

test('repos de base : 2:30 → 150 s ; vide → auto ; hors bornes refusé', async () => {
  const { save } = setup()
  const repos = screen.getByLabelText('Repos de base')
  expect(repos).toHaveAttribute('inputmode', 'text') // le clavier numérique de l'iPhone n'a pas « : »
  await userEvent.type(repos, '5')
  expect(screen.getByText('Repos : 0:10 à 10:00')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
  await userEvent.clear(repos)
  await userEvent.type(repos, '2:30')
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ rest_seconds: 150 }))
})

test('repos de base vide : null (auto)', async () => {
  const { save } = setup()
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ rest_seconds: null }))
})
