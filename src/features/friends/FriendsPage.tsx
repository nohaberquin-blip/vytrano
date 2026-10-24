import { useCallback, useEffect, useState } from 'react'
import { useOnline } from '../../app/useOnline'
import { cachedFeed, FEED_PAGE, fetchFeed, toggleReaction, type FeedEntry } from '../../data/social'
import { useUserId } from '../auth/AuthProvider'
import { FeedItem } from './FeedItem'
import { FriendsManager } from './FriendsManager'
import { WorkoutDetail } from './WorkoutDetail'
import { useIncomingRequests } from './useIncomingRequests'

export function FriendsPage() {
  const userId = useUserId()
  const online = useOnline()
  const { count: incoming, refresh: refreshIncoming } = useIncomingRequests()
  const [tab, setTab] = useState<'feed' | 'manage'>('feed')
  const [feed, setFeed] = useState<FeedEntry[]>(cachedFeed)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState<FeedEntry | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const page = await fetchFeed()
      setFeed(page)
      setHasMore(page.length === FEED_PAGE)
    } catch { /* hors ligne : on garde le cache */ }
    setLoading(false)
  }, [])
  useEffect(() => { if (online) void load() }, [online, load])

  async function more() {
    const last = feed[feed.length - 1]
    if (!last) return
    try {
      const page = await fetchFeed(last.finished_at)
      setFeed((f) => [...f, ...page])
      setHasMore(page.length === FEED_PAGE)
    } catch { /* réessaiera */ }
  }

  return (
    <section className="page">
      <h1>Amis</h1>
      <div className="segmented" role="group" style={{ marginTop: 0 }}>
        <button aria-pressed={tab === 'feed'} onClick={() => setTab('feed')}>Fil</button>
        <button aria-pressed={tab === 'manage'} onClick={() => setTab('manage')}>
          Gérer{incoming > 0 ? ` (${incoming})` : ''}
        </button>
      </div>
      {!online && <div className="banner">Hors ligne : dernier fil enregistré.</div>}

      {tab === 'feed' && (
        <>
          {feed.length === 0 && !loading && (
            <div className="empty">
              <p>Rien pour l’instant. Les séances de tes amis apparaîtront ici.</p>
              <button className="btn primary" onClick={() => setTab('manage')}>Ajouter des amis</button>
            </div>
          )}
          {feed.map((e) => (
            <FeedItem key={e.id} entry={e} onOpen={() => setOpen(e)}
              onReact={(id, reacted) => toggleReaction(userId, id, reacted)} />
          ))}
          {hasMore && online && <button className="btn block" onClick={more}>Voir plus</button>}
        </>
      )}
      {tab === 'manage' && (online
        ? <FriendsManager onChange={() => { void refreshIncoming(); void load() }} />
        : <p className="empty">La gestion des amis nécessite une connexion.</p>)}

      {open && <WorkoutDetail entry={open} onClose={() => setOpen(null)} />}
    </section>
  )
}
