import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NewPasswordForm } from './NewPasswordPage'
import { isRecoveryUrl, linkError } from './recovery'

function setup(update = vi.fn().mockResolvedValue({ error: null })) {
  const onDone = vi.fn()
  render(<NewPasswordForm update={update} onDone={onDone} />)
  return { update, onDone }
}

async function fill(a: string, b: string) {
  await userEvent.type(screen.getByLabelText('Nouveau mot de passe'), a)
  await userEvent.type(screen.getByLabelText('Confirme le mot de passe'), b)
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le mot de passe' }))
}

test('les deux mots de passe doivent être identiques', async () => {
  const { update } = setup()
  await fill('secret123', 'secret124')
  expect(screen.getByText('Les deux mots de passe ne correspondent pas')).toBeInTheDocument()
  expect(update).not.toHaveBeenCalled()
})

test('6 caractères minimum', async () => {
  const { update } = setup()
  await fill('abc', 'abc')
  expect(screen.getByText('6 caractères minimum')).toBeInTheDocument()
  expect(update).not.toHaveBeenCalled()
})

test('mot de passe valide → enregistré puis on continue', async () => {
  const { update, onDone } = setup()
  await fill('nouveau123', 'nouveau123')
  expect(update).toHaveBeenCalledWith('nouveau123')
  expect(onDone).toHaveBeenCalled()
})

test('erreur du serveur affichée (ex. même mot de passe qu’avant)', async () => {
  const { onDone } = setup(vi.fn().mockResolvedValue({ error: { message: 'New password should be different from the old password.' } }))
  await fill('nouveau123', 'nouveau123')
  expect(await screen.findByText('Choisis un mot de passe différent de l’ancien')).toBeInTheDocument()
  expect(onDone).not.toHaveBeenCalled()
})

test('détection d’un lien de réinitialisation dans l’adresse', () => {
  expect(isRecoveryUrl('#access_token=x&type=recovery')).toBe(true)
  expect(isRecoveryUrl('#access_token=x&type=signup')).toBe(false)
  expect(isRecoveryUrl('')).toBe(false)
})

test('erreur de lien dans l’adresse', () => {
  expect(linkError('#error=access_denied&error_code=otp_expired')).toBe(true)
  expect(linkError('#access_token=x&type=recovery')).toBe(false)
  expect(linkError('')).toBe(false)
})
