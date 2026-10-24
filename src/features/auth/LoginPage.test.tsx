import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginPage } from './LoginPage'
import { supabase } from '../../data/supabase'
import { getRemember } from '../../data/authStorage'

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

describe('mot de passe oublié et rester connecté', () => {
  beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); window.location.hash = '' })

  test('« Rester connecté » coché par défaut ; décoché, le choix est enregistré avant la connexion', async () => {
    const signIn = vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValue({ data: {}, error: null } as never)
    render(<LoginPage />)
    const box = screen.getByRole('checkbox', { name: 'Rester connecté' })
    expect(box).toBeChecked()
    await userEvent.click(box)
    await userEvent.type(screen.getByLabelText('Email'), 'moi@example.com')
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }))
    expect(getRemember()).toBe(false)
    expect(signIn).toHaveBeenCalled()
  })

  test('mot de passe oublié : lien demandé avec retour vers l’app, message neutre', async () => {
    const reset = vi.spyOn(supabase.auth, 'resetPasswordForEmail').mockResolvedValue({ data: {}, error: null } as never)
    render(<LoginPage />)
    await userEvent.click(screen.getByRole('button', { name: 'Mot de passe oublié ?' }))
    await userEvent.type(screen.getByLabelText('Email'), 'ami@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Recevoir le lien' }))
    expect(reset).toHaveBeenCalledWith('ami@example.com', { redirectTo: window.location.origin })
    expect(await screen.findByText(/Si un compte existe pour cet email/)).toBeInTheDocument()
  })

  test('même si l’email est inconnu, le message reste neutre', async () => {
    vi.spyOn(supabase.auth, 'resetPasswordForEmail').mockResolvedValue({ data: null, error: { message: 'User not found' } } as never)
    render(<LoginPage />)
    await userEvent.click(screen.getByRole('button', { name: 'Mot de passe oublié ?' }))
    await userEvent.type(screen.getByLabelText('Email'), 'inconnu@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Recevoir le lien' }))
    expect(await screen.findByText(/Si un compte existe pour cet email/)).toBeInTheDocument()
  })

  test('lien expiré dans l’adresse → message et formulaire de nouveau lien', () => {
    window.location.hash = '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'
    render(<LoginPage />)
    expect(screen.getByText(/Ce lien a expiré ou a déjà servi/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Recevoir le lien' })).toBeInTheDocument()
  })
})
