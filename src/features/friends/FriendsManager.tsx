import { useCallback, useEffect, useState } from 'react'
import type { Profile } from '../../domain/types'
import {
  listFriendships, removeFriend, respondRequest, searchProfiles, sendRequest,
} from '../../data/social'
import { useUserId } from '../auth/AuthProvider'
import { Avatar } from './FeedItem'

type Lists = Awaited<ReturnType<typeof listFriendships>>

export function FriendsManager({ onChange }: { onChange(): void }) {
  const userId = useUserId()
  const [lists, setLists] = useState<Lists | null>(null)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Profile[]>([])
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setLists(await listFriendships(userId))
      setError(null)
    } catch {
      setError('Pas de connexion.')
    }
  }, [userId])
  useEffect(() => { void reload() }, [reload])

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return }
    const t = setTimeout(() => { searchProfiles(q).then(setResults, () => setResults([])) }, 300)
    return () => clearTimeout(t)
  }, [q])

  async function act(p: Promise<{ error: unknown }>) {
    const { error } = await p
    if (error) setError('Action impossible. Vérifie ta connexion.')
    await reload()
    onChange()
  }

  const known = new Map<string, string>()
  for (const f of lists?.friends ?? []) known.set(f.other.user_id, 'Ami')
  for (const f of lists?.outgoing ?? []) known.set(f.other.user_id, 'Demande envoyée')
  for (const f of lists?.incoming ?? []) known.set(f.other.user_id, 'T’a envoyé une demande')

  return (
    <div>
      <input className="input" placeholder="Rechercher un pseudo" aria-label="Rechercher un pseudo" autoCapitalize="none"
        value={q} onChange={(e) => setQ(e.target.value)} />
      {error && <p className="error">{error}</p>}
      {results.length > 0 && (
        <ul className="list" style={{ marginTop: 10 }}>
          {results.map((p) => (
            <li key={p.user_id} className="list-item" style={{ cursor: 'default' }}>
              <span className="row"><Avatar name={p.username} />{p.username}</span>
              {known.has(p.user_id)
                ? <span className="muted small">{known.get(p.user_id)}</span>
                : <button className="btn primary" onClick={() => act(sendRequest(userId, p.user_id))}>Ajouter</button>}
            </li>
          ))}
        </ul>
      )}
      {q.trim().length >= 2 && results.length === 0 && <p className="muted small">Aucun pseudo trouvé.</p>}

      {!!lists?.incoming.length && (
        <>
          <h2>Demandes reçues</h2>
          <ul className="list">
            {lists.incoming.map((f) => (
              <li key={f.id} className="list-item" style={{ cursor: 'default' }}>
                <span className="row"><Avatar name={f.other.username} />{f.other.username}</span>
                <span className="row">
                  <button className="btn primary" onClick={() => act(respondRequest(f.id, true))}>Accepter</button>
                  <button className="btn ghost icon" aria-label={`Refuser ${f.other.username}`} onClick={() => act(respondRequest(f.id, false))}>✕</button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {!!lists?.outgoing.length && (
        <>
          <h2>Demandes envoyées</h2>
          <ul className="list">
            {lists.outgoing.map((f) => (
              <li key={f.id} className="list-item" style={{ cursor: 'default' }}>
                <span className="row"><Avatar name={f.other.username} />{f.other.username}</span>
                <button className="btn ghost small" onClick={() => act(removeFriend(f.id))}>Annuler</button>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2>Mes amis {lists ? `(${lists.friends.length})` : ''}</h2>
      {lists?.friends.length === 0 && <p className="muted small">Cherche le pseudo d’un ami pour l’ajouter.</p>}
      <ul className="list">
        {lists?.friends.map((f) => (
          <li key={f.id} className="list-item" style={{ cursor: 'default' }}>
            <span className="row"><Avatar name={f.other.username} />{f.other.username}</span>
            <button className="btn ghost small" style={{ color: 'var(--danger)' }}
              onClick={() => confirm(`Retirer ${f.other.username} de tes amis ?`) && act(removeFriend(f.id))}>Retirer</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
