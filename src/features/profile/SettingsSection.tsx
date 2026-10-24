import { useState } from 'react'
import type { Profile } from '../../domain/types'
import { profileErrorMessage, usernameError } from '../../data/profile'

type Update = (changes: Partial<Omit<Profile, 'user_id'>>) => Promise<{ error: { code?: string; message: string } | null }>

export function SettingsSection({ profile, update, onSignOut, onDelete, pending }: {
  profile: Profile
  update: Update
  onSignOut(): void
  onDelete(): Promise<void>
  /** Écritures pas encore envoyées au serveur. */
  pending: number
}) {
  const [username, setUsername] = useState(profile.username)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  async function apply(changes: Parameters<Update>[0]) {
    setError(null); setSaved(false)
    const { error } = await update(changes)
    if (error) setError(profileErrorMessage(error))
    else setSaved(true)
  }

  async function saveUsername() {
    const invalid = usernameError(username)
    if (invalid) { setError(invalid); return }
    if (username !== profile.username) await apply({ username: username.trim() })
  }

  function signOut() {
    if (pending > 0 && !confirm(`${pending} modification${pending > 1 ? 's' : ''} pas encore synchronisée${pending > 1 ? 's' : ''} sera perdue. Se déconnecter quand même ?`)) return
    onSignOut()
  }

  return (
    <div>
      <h2>Paramètres</h2>
      <div className="card">
        <label className="field"><span>Pseudo</span>
          <div className="row">
            <input className="input" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} />
            <button className="btn" disabled={username === profile.username} onClick={saveUsername}>OK</button>
          </div>
        </label>
        <label className="switch">
          <span>Partager mes séances avec mes amis</span>
          <input type="checkbox" checked={profile.share_workouts}
            onChange={(e) => apply({ share_workouts: e.target.checked })} />
        </label>
        <p className="muted small" style={{ marginTop: 0 }}>
          Désactivé, tes amis ne voient plus aucune de tes séances, même les anciennes.
        </p>
        <label className="switch">
          <span>Unité</span>
          <select className="input" style={{ width: 100 }} value={profile.unit}
            onChange={(e) => apply({ unit: e.target.value as Profile['unit'] })}>
            <option value="kg">kg</option>
            <option value="lb">lb</option>
          </select>
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        {saved && <p className="muted small">Enregistré ✓</p>}
      </div>

      <button className="btn block" onClick={signOut}>Se déconnecter</button>

      {!deleting
        ? <button className="btn danger block" style={{ marginTop: 12 }} onClick={() => setDeleting(true)}>Supprimer mon compte</button>
        : (
          <div className="card" style={{ marginTop: 12, borderColor: 'var(--danger)' }}>
            <p><strong>Suppression définitive</strong> de ton compte, tes programmes et tout ton historique.</p>
            <label className="field"><span>Tape ton pseudo pour confirmer</span>
              <input className="input" aria-label="Tape ton pseudo pour confirmer" autoCapitalize="none"
                value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
            </label>
            <div className="grid-2">
              <button className="btn" onClick={() => { setDeleting(false); setConfirmText('') }}>Annuler</button>
              <button className="btn danger" disabled={confirmText !== profile.username} onClick={() => void onDelete()}>
                Supprimer définitivement
              </button>
            </div>
          </div>
        )}
    </div>
  )
}
