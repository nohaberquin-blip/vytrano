import { useCallback, useEffect, useState } from 'react'
import { countIncoming } from '../../data/social'
import { useAuth } from '../auth/AuthProvider'

/** Nombre de demandes d'ami reçues, rafraîchi toutes les minutes. */
export function useIncomingRequests() {
  const userId = useAuth().user?.id
  const [count, setCount] = useState(0)
  const refresh = useCallback(async () => {
    if (!userId || !navigator.onLine) return
    try { setCount(await countIncoming(userId)) } catch { /* hors ligne */ }
  }, [userId])
  useEffect(() => {
    void refresh()
    const t = setInterval(() => void refresh(), 60_000)
    return () => clearInterval(t)
  }, [refresh])
  return { count, refresh }
}
