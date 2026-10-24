import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { OnboardingForm } from './OnboardingPage'

function setup(save = vi.fn().mockResolvedValue({ error: null })) {
  const onDone = vi.fn()
  render(<MemoryRouter><OnboardingForm save={save} onDone={onDone} /></MemoryRouter>)
  return { save, onDone }
}

test('pseudo trop court → message et aucun appel réseau', async () => {
  const { save } = setup()
  await userEvent.type(screen.getByLabelText('Pseudo'), 'ab')
  await userEvent.click(screen.getByRole('button', { name: 'Continuer' }))
  expect(screen.getByText('3 caractères minimum')).toBeInTheDocument()
  expect(save).not.toHaveBeenCalled()
})

test('caractères interdits → message', async () => {
  const { save } = setup()
  await userEvent.type(screen.getByLabelText('Pseudo'), 'léa muscu')
  await userEvent.click(screen.getByRole('button', { name: 'Continuer' }))
  expect(screen.getByText(/lettres sans accent, chiffres/)).toBeInTheDocument()
  expect(save).not.toHaveBeenCalled()
})

test('pseudo déjà pris → message dédié', async () => {
  const { onDone } = setup(vi.fn().mockResolvedValue({ error: { code: '23505', message: 'duplicate key' } }))
  await userEvent.type(screen.getByLabelText('Pseudo'), 'lea')
  await userEvent.click(screen.getByRole('button', { name: 'Continuer' }))
  expect(await screen.findByText('Ce pseudo est déjà pris')).toBeInTheDocument()
  expect(onDone).not.toHaveBeenCalled()
})

test('pseudo valide → enregistré puis étape suivante', async () => {
  const { save, onDone } = setup()
  await userEvent.type(screen.getByLabelText('Pseudo'), 'lea_92')
  await userEvent.click(screen.getByRole('button', { name: 'Continuer' }))
  expect(save).toHaveBeenCalledWith('lea_92')
  expect(onDone).toHaveBeenCalled()
})
