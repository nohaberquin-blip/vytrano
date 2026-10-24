import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { profileErrorMessage, updateProfile, usernameError } from '../../data/profile'
import { useAuth, useUserId } from './AuthProvider'

type SaveFn = (username: string) => Promise<{ error: { code?: string; message: string } | null }>

export function OnboardingForm({ save, onDone, initial = '' }: { save: SaveFn; onDone(): void; initial?: string }) {
  const [username, setUsername] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const invalid = usernameError(username)
    if (invalid) { setError(invalid); return }
    setBusy(true); setError(null)
    const { error } = await save(username.trim())
    setBusy(false)
    if (error) setError(profileErrorMessage(error))
    else onDone()
  }

  return (
    <form onSubmit={submit}>
      <label className="field"><span>Pseudo</span>
        <input className="input" autoCapitalize="none" autoCorrect="off" value={username}
          onChange={(e) => setUsername(e.target.value)} placeholder="ex. lea_92" />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn primary block big" disabled={busy}>Continuer</button>
    </form>
  )
}

export function OnboardingPage() {
  const userId = useUserId()
  const { refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<'username' | 'start'>('username')

  if (step === 'username') {
    return (
      <div className="auth">
        <h1>Bienvenue 👋</h1>
        <p className="muted">Choisis ton pseudo. Tes amis te trouveront grâce à lui.</p>
        <OnboardingForm save={(username) => updateProfile(userId, { username })} onDone={() => setStep('start')} />
      </div>
    )
  }

  const go = async (to: string) => {
    await refreshProfile()
    navigate(to, { replace: true })
  }
  return (
    <div className="auth stack">
      <h1>On commence ?</h1>
      <p className="muted">Crée ton programme, ou reprends celui d’un ami avec son code.</p>
      <button className="btn primary block big" onClick={() => go('/programmes?nouveau=1')}>Créer un programme</button>
      <button className="btn block big" onClick={() => go('/programmes?import=1')}>Importer un code</button>
    </div>
  )
}
