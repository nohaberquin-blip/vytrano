import { useState } from 'react'
import { profileErrorMessage, updateProfile, usernameError } from '../../data/profile'
import { loadProgress, setShareProgress } from '../../data/progress'
import { supabase } from '../../data/supabase'
import { useSyncStatus } from '../../data/sync'
import { useLive } from '../../data/useLive'
import { toISODate } from '../../domain/calendar'
import type { Profile } from '../../domain/types'
import { useAuth, useUserId } from '../auth/AuthProvider'

/** Enregistre une modification du profil ; erreur ou « Enregistré ✓ » affichés sous le réglage. */
function useApply() {
  const userId = useUserId()
  const { refreshProfile } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  async function apply(changes: Partial<Omit<Profile, 'user_id'>>) {
    setError(null); setSaved(false)
    const { error } = await updateProfile(userId, changes)
    if (error) setError(profileErrorMessage(error))
    else { setSaved(true); await refreshProfile() }
  }
  const feedback = <>
    {error && <p className="error" role="alert">{error}</p>}
    {saved && <p className="muted small">Enregistré ✓</p>}
  </>
  return { apply, setError, feedback }
}

export function ShareWorkoutsSetting() {
  const { profile } = useAuth()
  const { apply, feedback } = useApply()
  if (!profile) return null
  return (
    <div>
      <label className="switch">
        <span>Partager mes séances avec mes amis</span>
        <input type="checkbox" checked={profile.share_workouts} onChange={(e) => apply({ share_workouts: e.target.checked })} />
      </label>
      <p className="muted small" style={{ marginTop: 0 }}>Désactivé, tes amis ne voient plus aucune de tes séances, même les anciennes.</p>
      {feedback}
    </div>
  )
}

export function ShareProgressSetting() {
  const userId = useUserId()
  const { profile, refreshProfile } = useAuth()
  const p = useLive(() => loadProgress(userId, toISODate(new Date())), [userId])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!p) return null
  async function toggle(on: boolean) {
    setBusy(true); setError(null)
    const { error } = await setShareProgress(userId, on, p!)
    if (error) setError('Impossible d’enregistrer. Vérifie ta connexion.')
    else await refreshProfile()
    setBusy(false)
  }
  return (
    <div>
      <label className="switch">
        <span>Montrer mon niveau et mes badges à mes amis</span>
        <input type="checkbox" checked={!!profile?.share_progress} disabled={busy} onChange={(e) => toggle(e.target.checked)} />
      </label>
      <p className="muted small" style={{ marginTop: 0 }}>Seuls ton niveau, ta série et tes badges sont partagés, jamais le détail de tes séances.</p>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  )
}

export function UnitSetting() {
  const { profile } = useAuth()
  const { apply, feedback } = useApply()
  if (!profile) return null
  return (
    <div>
      <label className="switch">
        <span>Unité</span>
        <select className="input" style={{ width: 100 }} value={profile.unit}
          onChange={(e) => apply({ unit: e.target.value as Profile['unit'] })}>
          <option value="kg">kg</option>
          <option value="lb">lb</option>
        </select>
      </label>
      {feedback}
    </div>
  )
}

export function UsernameSetting() {
  const { profile } = useAuth()
  const { apply, setError, feedback } = useApply()
  const [username, setUsername] = useState(profile?.username ?? '')
  if (!profile) return null
  async function save() {
    const invalid = usernameError(username)
    if (invalid) { setError(invalid); return }
    if (username !== profile!.username) await apply({ username: username.trim() })
  }
  return (
    <div className="field">
      <span>Pseudo</span>
      <div className="row">
        <input className="input" aria-label="Pseudo" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} />
        <button className="btn" disabled={username === profile.username} onClick={save}>OK</button>
      </div>
      {feedback}
    </div>
  )
}

export function SignOutSetting() {
  const { signOut } = useAuth()
  const { pending } = useSyncStatus()
  function click() {
    if (pending > 0 && !confirm(`${pending} modification${pending > 1 ? 's' : ''} pas encore synchronisée${pending > 1 ? 's' : ''} sera perdue. Se déconnecter quand même ?`)) return
    void signOut()
  }
  return <button className="btn block" onClick={click}>Se déconnecter</button>
}

export function DeleteAccountSetting() {
  const { profile, signOut } = useAuth()
  const [deleting, setDeleting] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  if (!profile) return null
  async function remove() {
    const { error } = await supabase.rpc('delete_my_account')
    if (error) { alert('Suppression impossible. Vérifie ta connexion.'); return }
    await signOut()
  }
  if (!deleting) return <button className="btn danger block" onClick={() => setDeleting(true)}>Supprimer mon compte</button>
  return (
    <div className="card" style={{ borderColor: 'var(--danger)' }}>
      <p><strong>Suppression définitive</strong> de ton compte, tes programmes et tout ton historique.</p>
      <label className="field"><span>Tape ton pseudo pour confirmer</span>
        <input className="input" aria-label="Tape ton pseudo pour confirmer" autoCapitalize="none"
          value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
      </label>
      <div className="grid-2">
        <button className="btn" onClick={() => { setDeleting(false); setConfirmText('') }}>Annuler</button>
        <button className="btn danger" disabled={confirmText !== profile.username} onClick={() => void remove()}>Supprimer définitivement</button>
      </div>
    </div>
  )
}
