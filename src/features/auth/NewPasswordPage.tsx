import { useState, type FormEvent } from 'react'
import { supabase } from '../../data/supabase'
import { useAuth } from './AuthProvider'

export { isRecoveryUrl } from './recovery'

type UpdateFn = (password: string) => Promise<{ error: { message: string } | null }>

function passwordErrorMessage(message: string): string {
  if (/different from the old/i.test(message)) return 'Choisis un mot de passe différent de l’ancien'
  if (/at least/i.test(message)) return '6 caractères minimum'
  if (/session|expired|jwt/i.test(message)) return 'Ce lien a expiré. Redemande un lien depuis « Mot de passe oublié ? ».'
  if (/fetch/i.test(message)) return 'Pas de connexion internet'
  return message
}

export function NewPasswordForm({ update, onDone }: { update: UpdateFn; onDone(): void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 6) { setError('6 caractères minimum'); return }
    if (password !== confirm) { setError('Les deux mots de passe ne correspondent pas'); return }
    setBusy(true); setError(null)
    const { error } = await update(password)
    setBusy(false)
    if (error) setError(passwordErrorMessage(error.message))
    else onDone()
  }

  return (
    <form onSubmit={submit}>
      <label className="field"><span>Nouveau mot de passe</span>
        <input className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      <label className="field"><span>Confirme le mot de passe</span>
        <input className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn primary block big" disabled={busy}>Enregistrer le mot de passe</button>
    </form>
  )
}

export function NewPasswordPage() {
  const { endRecovery } = useAuth()
  return (
    <div className="auth">
      <span className="brand">Vytrano</span>
      <h1>Nouveau mot de passe</h1>
      <p className="muted">Choisis ton nouveau mot de passe. Tu resteras connecté ensuite.</p>
      <NewPasswordForm
        update={async (password) => { const { error } = await supabase.auth.updateUser({ password }); return { error } }}
        onDone={endRecovery} />
    </div>
  )
}
