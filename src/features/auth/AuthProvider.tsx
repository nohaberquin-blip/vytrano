import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Profile } from '../../domain/types'
import { db } from '../../data/db'
import { cachedProfile, clearProfileCache, fetchProfile } from '../../data/profile'
import { pull, setCurrentUser } from '../../data/repo'
import { supabase } from '../../data/supabase'
import { createSync, supabaseSyncClient } from '../../data/sync'
import { isRecoveryUrl } from './recovery'

export const sync = createSync(supabaseSyncClient)

interface AuthState {
  loading: boolean
  user: { id: string; email?: string } | null
  profile: Profile | null
  /** Arrivé par un lien « mot de passe oublié » : il faut choisir un nouveau mot de passe. */
  recovering: boolean
  endRecovery(): void
  refreshProfile(): Promise<void>
  signOut(): Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<AuthState['user']>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  // Lu dès le départ : l'événement PASSWORD_RECOVERY peut arriver avant l'abonnement.
  const [recovering, setRecovering] = useState(() => isRecoveryUrl(window.location.hash))

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session ? { id: data.session.user.id, email: data.session.user.email } : null)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      // Session expirée : on revient à la connexion, sans toucher aux données locales.
      setUser(session ? { id: session.user.id, email: session.user.email } : null)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = user?.id
  useEffect(() => {
    setCurrentUser(userId ?? null)
    if (!userId) { setProfile(null); return }
    const cached = cachedProfile()
    if (cached?.user_id === userId) setProfile(cached)
    void fetchProfile(userId).then((p) => p && setProfile(p))
    const stop = sync.start()
    // On envoie d'abord ce qui attend, puis on récupère l'état du serveur.
    void sync.flush().then(() => pull(userId)).catch(() => { /* hors ligne : le cache local suffit */ })
    return stop
  }, [userId])

  const refreshProfile = useCallback(async () => {
    if (userId) setProfile(await fetchProfile(userId))
  }, [userId])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    await Promise.all(db.tables.map((t) => t.clear()))
    clearProfileCache()
    try { localStorage.removeItem('muscu.feed') } catch { /* rien */ }
  }, [])

  return (
    <AuthContext.Provider value={{ loading, user, profile, recovering, endRecovery: () => setRecovering(false), refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth hors de AuthProvider')
  return ctx
}

/** Pour les écrans réservés aux connectés : l'utilisateur est garanti non nul. */
export function useUserId(): string {
  const { user } = useAuth()
  if (!user) throw new Error('Utilisateur non connecté')
  return user.id
}
