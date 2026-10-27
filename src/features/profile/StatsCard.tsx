import { useUnit } from '../../app/units'
import { loadGlobalStats } from '../../data/stats'
import { useLive } from '../../data/useLive'
import { formatDuration, formatTonnage } from '../../domain/stats'
import { useUserId } from '../auth/AuthProvider'

/** Séances, temps d'entraînement et charge totale soulevée depuis le début. */
export function StatsCard() {
  const userId = useUserId()
  const { unit } = useUnit()
  const stats = useLive(() => loadGlobalStats(userId), [userId])
  return (
    <section className="card stats-card" aria-label="Mes stats">
      <p className="card-title">Mes stats</p>
      {stats && (
        <div className="stats-grid">
          <div><strong className="num">{stats.sessions} séance{stats.sessions > 1 ? 's' : ''}</strong><span className="muted small">terminées</span></div>
          <div><strong className="num">{formatDuration(stats.minutes)}</strong><span className="muted small">d’entraînement</span></div>
          <div><strong className="num">{formatTonnage(stats.tonnageKg, unit)}</strong><span className="muted small">soulevés</span></div>
        </div>
      )}
    </section>
  )
}
