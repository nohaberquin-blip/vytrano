import { useEffect, useState } from 'react'
import { loadProgress, publishCard, refreshCard, setShareProgress } from '../../data/progress'
import { useLive } from '../../data/useLive'
import { toISODate } from '../../domain/calendar'
import { BADGES } from '../../domain/streak'
import { useAuth, useUserId } from '../auth/AuthProvider'
import { fmtInt } from './numberField'
import { BadgeIcon } from './BadgeIcon'

const shortDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`

/** Carte « Régularité » du Profil : niveau, XP, série, jokers, badges et partage avec les amis. */
export function ProgressCard() {
  const userId = useUserId()
  const { profile, refreshProfile } = useAuth()
  const p = useLive(() => loadProgress(userId, toISODate(new Date())), [userId])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sharing = !!profile?.share_progress
  // Partage activé : la carte vue par les amis est remise à jour si elle a changé (série perdue, objectif modifié…).
  useEffect(() => {
    if (sharing && p) void refreshCard(userId, p, publishCard).catch(() => {})
  }, [sharing, p, userId])
  if (!p) return null
  const unlocked = new Map(p.badges.map((b) => [b.id, b.date]))

  async function toggle(on: boolean) {
    setBusy(true); setError(null)
    const { error } = await setShareProgress(userId, on, p!)
    if (error) setError('Impossible d’enregistrer. Vérifie ta connexion.')
    else await refreshProfile()
    setBusy(false)
  }

  return (
    <section className="card progress-card" aria-label="Régularité">
      <p className="card-title">Régularité</p>
      <p className="progress-level"><strong>Niveau {p.level} · {p.title}</strong></p>
      <div className="xp-bar" role="progressbar" aria-label="Expérience" aria-valuemin={0} aria-valuemax={p.xpForNext} aria-valuenow={p.xpInLevel}>
        <span style={{ width: `${Math.min(100, (p.xpInLevel / p.xpForNext) * 100)}%` }} />
      </div>
      <p className="muted small num">{fmtInt(p.xpInLevel)} / {fmtInt(p.xpForNext)} XP</p>
      {(p.streak > 0 || p.jokers > 0) && (
        <p className="row progress-streak">
          {p.streak > 0 && <span>🔥 {plural(p.streak, 'semaine')} de suite</span>}
          {p.jokers > 0 && <span className="muted">🃏 {plural(p.jokers, 'joker')}</span>}
        </p>
      )}
      <ul className="badges">
        {BADGES.map((b) => {
          const date = unlocked.get(b.id)
          return (
            <li key={b.id} className={date ? 'badge on' : 'badge'}
              aria-label={date ? `${b.label}, obtenu le ${shortDate(date)}` : `${b.label}, à débloquer : ${b.hint}`}>
              <BadgeIcon icon={b.icon} tier={b.tier} locked={!date} />
              <span className="badge-label">{b.label}</span>
              {date && <span className="badge-sub small">{shortDate(date)}</span>}
            </li>
          )
        })}
      </ul>
      <label className="switch">
        <span>Montrer mon niveau et mes badges à mes amis</span>
        <input type="checkbox" checked={!!profile?.share_progress} disabled={busy} onChange={(e) => toggle(e.target.checked)} />
      </label>
      <p className="muted small" style={{ marginTop: 0 }}>Seuls ton niveau, ta série et tes badges sont partagés, jamais le détail de tes séances.</p>
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  )
}
