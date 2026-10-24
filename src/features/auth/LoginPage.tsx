import { useState, type FormEvent } from 'react'
import { supabase } from '../../data/supabase'

function authErrorMessage(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Email ou mot de passe incorrect'
  if (/already registered/i.test(message)) return 'Un compte existe déjà avec cet email'
  if (/password should be at least/i.test(message)) return 'Mot de passe : 6 caractères minimum'
  if (/email not confirmed/i.test(message)) return 'Ton email n’est pas encore confirmé : clique sur le lien reçu par email (pense à regarder les spams), puis reconnecte-toi'
  if (/rate limit/i.test(message)) return 'Trop de tentatives d’envoi d’email. Réessaie dans une heure.'
  if (/fetch/i.test(message)) return 'Pas de connexion internet'
  return message
}

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null); setInfo(null)
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(authErrorMessage(error.message))
    } else {
      // Le lien de confirmation ramène sur l'adresse d'où l'on s'inscrit (sinon Supabase utilise sa « Site URL »).
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
      if (error) setError(authErrorMessage(error.message))
      else if (!data.session) setInfo('Compte créé. Clique sur le lien reçu par email pour l’activer, puis connecte-toi.')
    }
    setBusy(false)
  }

  return (
    <div className="auth">
      <span className="brand">Vytrano</span>
      <p className="muted">Ton programme, tes charges, tes progrès.</p>
      <div className="segmented" role="group">
        <button type="button" aria-pressed={mode === 'login'} onClick={() => setMode('login')}>Connexion</button>
        <button type="button" aria-pressed={mode === 'signup'} onClick={() => setMode('signup')}>Inscription</button>
      </div>
      <form onSubmit={submit}>
        <label className="field"><span>Email</span>
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field"><span>Mot de passe</span>
          <input className="input" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        {info && <p className="banner">{info}</p>}
        <button className="btn primary block big" disabled={busy}>
          {mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
        </button>
      </form>
    </div>
  )
}
