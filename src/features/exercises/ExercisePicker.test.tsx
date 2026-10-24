import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '../../data/db'
import { setCurrentUser } from '../../data/repo'
import { WithUser } from '../../test/auth'
import { ExercisePicker } from './ExercisePicker'

beforeEach(async () => {
  setCurrentUser('u')
  await Promise.all(db.tables.map((t) => t.clear()))
  await db.exercises.bulkPut([
    { id: 'a', owner_id: null, name: 'Tractions', muscle_group: 'Dos' },
    { id: 'b', owner_id: 'quelquun', name: 'Pullover poulie', muscle_group: 'Dos' },
    { id: 'c', owner_id: null, name: 'Développé couché', muscle_group: 'Pectoraux' },
  ])
})

function setup() {
  const onPick = vi.fn()
  render(<WithUser><ExercisePicker onPick={onPick} /></WithUser>)
  return { onPick }
}

test('le catalogue de tout le monde est rangé par partie du corps', async () => {
  setup()
  const dos = await screen.findByRole('region', { name: 'Dos' })
  expect(within(dos).getByText('Pullover poulie')).toBeInTheDocument()
  expect(within(dos).getByText('Tractions')).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Pectoraux' })).toBeInTheDocument()
})

test('un filtre n’affiche qu’une partie du corps', async () => {
  setup()
  await screen.findByText('Tractions')
  await userEvent.click(screen.getByRole('button', { name: 'Pectoraux' }))
  expect(screen.queryByText('Tractions')).toBeNull()
  expect(screen.getByText('Développé couché')).toBeInTheDocument()
})

test('créer un exercice oblige à choisir sa partie du corps', async () => {
  const { onPick } = setup()
  await userEvent.type(screen.getByLabelText('Rechercher un exercice'), 'Hip abduction')
  await userEvent.click(await screen.findByRole('button', { name: /Créer « Hip abduction »/ }))
  expect(onPick).not.toHaveBeenCalled()
  await userEvent.click(within(screen.getByRole('group', { name: 'Partie du corps' })).getByRole('button', { name: 'Fessiers' }))
  await vi.waitFor(() =>
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ name: 'Hip abduction', muscle_group: 'Fessiers', owner_id: 'u' })))
  expect((await db.exercises.toArray()).some((e) => e.name === 'Hip abduction' && e.muscle_group === 'Fessiers')).toBe(true)
}, 10000)
