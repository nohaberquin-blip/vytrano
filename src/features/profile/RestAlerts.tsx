import { useState } from 'react'
import { disablePush, enablePush, pushEnabledFlag, pushSupport } from '../../data/push'
import { useUserId } from '../auth/AuthProvider'

/** Activation des notifications de fin de repos (téléphone verrouillé, montre). */
export function RestAlerts() {
  const userId = useUserId()
  const [enabled, setEnabled] = useState(pushEnabledFlag)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const support = pushSupport()

  if (support === 'ios-home-screen') {
    return (
      <p className="banner">
        Pour recevoir une alerte en fin de repos (même téléphone verrouillé, et sur ta montre) :
        Ajoute Vytrano à l'écran d'accueil — Partager → Sur l'écran d'accueil — puis rouvre l'app depuis l'icône.
      </p>
    )
  }
  if (support === 'unsupported') return <p className="muted small">Ton navigateur ne permet pas les alertes.</p>

  async function toggle() {
    setBusy(true); setMessage(null)
    if (enabled) {
      await disablePush()
      setEnabled(false)
    } else {
      const res = await enablePush(userId)
      if (res === 'enabled') setEnabled(true)
      else setMessage(res === 'denied'
        ? 'Notifications refusées : autorise-les dans les réglages du téléphone pour Vytrano.'
        : 'Activation impossible. Vérifie ta connexion et réessaie.')
    }
    setBusy(false)
  }

  return (
    <div style={{ marginBottom: 12 }}>
      {enabled && <p className="small">Alertes activées : une notification arrive en fin de repos quand l'app est en arrière-plan.</p>}
      <button className="btn block" disabled={busy} onClick={toggle}>
        {enabled ? 'Désactiver les alertes' : 'Activer les alertes de repos'}
      </button>
      {message && <p className="error">{message}</p>}
    </div>
  )
}
