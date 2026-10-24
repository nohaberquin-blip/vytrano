import { useSyncStatus } from '../data/sync'

export function SyncBadge() {
  const { pending, failed } = useSyncStatus()
  if (failed > 0) return <span className="small" style={{ color: 'var(--danger)' }} title="Des modifications ont été refusées par le serveur">⚠ {failed} non envoyée{failed > 1 ? 's' : ''}</span>
  if (pending > 0) return <span className="muted small" title="Sera envoyé au retour du réseau">non synchronisé ({pending})</span>
  return null
}
