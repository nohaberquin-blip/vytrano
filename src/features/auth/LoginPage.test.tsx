import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginPage } from './LoginPage'
import { supabase } from '../../data/supabase'

test('le lien de confirmation envoyé à l’inscription ramène sur l’app, pas sur une adresse par défaut', async () => {
  const signUp = vi.spyOn(supabase.auth, 'signUp').mockResolvedValue({ data: { user: null, session: null }, error: null } as never)
  render(<LoginPage />)
  await userEvent.click(screen.getByRole('button', { name: 'Inscription' }))
  await userEvent.type(screen.getByLabelText('Email'), 'ami@example.com')
  await userEvent.type(screen.getByLabelText('Mot de passe'), 'secret123')
  await userEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }))
  expect(signUp).toHaveBeenCalledWith({
    email: 'ami@example.com',
    password: 'secret123',
    options: { emailRedirectTo: window.location.origin },
  })
})
