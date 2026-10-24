import { useState, type FormEvent } from 'react'
import { supabase } from '../../data/supabase'
import { getRemember, setRemember } from '../../data/authStorage'

function authErrorMessage(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Email ou mot de passe incorrect'
  if (/already registered/i.test(message)) return 'Un compte existe déjà avec cet email'
  if (/password should be at least/i.test(message)) return 'Mot de passe : 6 caractères minimum'
  if (/email not confirmed/i.test(message)) return 'Ton email n’est pas encore confirmé : clique sur le lien reçu par email (pense à regarder les spams), puis reconnecte-toi'
  if (/rate limit/i.test(message)) return 'Trop de tentatives d’envoi d’email. Réessaie dans une heure.'
  if (/fetch/i.test(message)) return 'Pas de connexion internet'
  return message
}

/** Lien reçu par email expiré ou déjà utilisé : Supabase renvoie vers l'app avec l'erreur dans l'adresse. */
function expiredLinkInUrl(): boolean {
  const params = new URLSearchParams(window.location.hash.slice(1))
  if (!params.get('error_code') && !params.get('error')) return false
  history.replaceState(null, '', window.location.pathname + window.location.search)
  return true
}

const RESET_SENT = 'Si un compte existe pour cet email, tu vas recevoir un lien pour choisir un nouveau mot de passe. Pense à regarder les spams.'

export function LoginPage() {
  const [expired] = useState(expiredLinkInUrl)
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>(expired ? 'forgot' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRememberBox] = useState(getRemember)
  const [error, setError] = useState<string | null>(expired ? 'Ce lien a expiré ou a déjà servi. Demande-en un nouveau ci-dessous.' : null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function switchTo(next: typeof mode) {
    setMode(next); setError(null); setInfo(null)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null); setInfo(null)
    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
      // Message neutre : on ne révèle jamais si un compte existe pour cet email.
      if (error && /rate limit/i.test(error.message)) setError(authErrorMessage(error.message))
      else if (error && /fetch/i.test(error.message)) setError(authErrorMessage(error.message))
      else setInfo(RESET_SENT)
    } else if (mode === 'login') {
      setRemember(remember)
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(authErrorMessage(error.message))
    } else {
      setRemember(remember)
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
      {mode === 'forgot' ? (
        <h2>Mot de passe oublié</h2>
      ) : (
        <div className="segmented" role="group">
          <button type="button" aria-pressed={mode === 'login'} onClick={() => switchTo('login')}>Connexion</button>
          <button type="button" aria-pressed={mode === 'signup'} onClick={() => switchTo('signup')}>Inscription</button>
        </div>
      )}
      <form onSubmit={submit}>
        <label className="field"><span>Email</span>
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {mode !== 'forgot' && (
          <>
            <label className="field"><span>Mot de passe</span>
              <input className="input" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <label className="switch">
              <span>Rester connecté</span>
              <input type="checkbox" checked={remember} onChange={(e) => setRememberBox(e.target.checked)} />
            </label>
          </>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        {info && <p className="banner">{info}</p>}
        <button className="btn primary block big" disabled={busy}>
          {mode === 'login' ? 'Se connecter' : mode === 'signup' ? 'Créer mon compte' : 'Recevoir le lien'}
        </button>
      </form>
      {mode === 'login' && (
        <button className="btn ghost block" style={{ marginTop: 8 }} onClick={() => switchTo('forgot')}>Mot de passe oublié ?</button>
      )}
      {mode === 'forgot' && (
        <button className="btn ghost block" style={{ marginTop: 8 }} onClick={() => switchTo('login')}>Retour à la connexion</button>
      )}
    </div>
  )
}
