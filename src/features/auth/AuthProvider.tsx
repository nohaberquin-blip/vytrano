import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Profile } from '../../domain/types'
import { db } from '../../data/db'
import { cacheProfile, cachedProfile, clearProfileCache, fetchProfile, keepLocalHome } from '../../data/profile'
import { pull, setCurrentUser } from '../../data/repo'
import { supabase, urlHashAtStartup } from '../../data/supabase'
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
  /** Change le profil tout de suite à l'écran et dans le cache local (l'écriture serveur est à part). */
  patchProfile(changes: Partial<Profile>): void
  signOut(): Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<AuthState['user']>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  // Lu au démarrage : l'événement PASSWORD_RECOVERY peut arriver avant l'abonnement, et Supabase efface l'adresse.
  const [recovering, setRecovering] = useState(() => isRecoveryUrl(urlHashAtStartup))

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

  // Disposition de l'accueil modifiée pendant cette session : elle l'emporte sur le profil relu du serveur.
  const pendingHome = useRef<{ local: unknown }>()
  const applyFetched = useCallback((p: Profile | null) => {
    const merged = keepLocalHome(p, pendingHome.current)
    if (merged && pendingHome.current) cacheProfile(merged)
    return merged
  }, [])

  const userId = user?.id
  useEffect(() => {
    setCurrentUser(userId ?? null)
    pendingHome.current = undefined
    if (!userId) { setProfile(null); return }
    const cached = cachedProfile()
    if (cached?.user_id === userId) setProfile(cached)
    void fetchProfile(userId).then((p) => p && setProfile(applyFetched(p)))
    const stop = sync.start()
    // On envoie d'abord ce qui attend, puis on récupère l'état du serveur.
    void sync.flush().then(() => pull(userId)).catch(() => { /* hors ligne : le cache local suffit */ })
    return stop
  }, [userId])

  const refreshProfile = useCallback(async () => {
    if (userId) setProfile(applyFetched(await fetchProfile(userId)))
  }, [userId, applyFetched])

  const patchProfile = useCallback((changes: Partial<Profile>) => {
    if ('home' in changes) pendingHome.current = { local: changes.home }
    setProfile((p) => {
      if (!p) return p
      const next = { ...p, ...changes }
      cacheProfile(next)
      return next
    })
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    await Promise.all(db.tables.map((t) => t.clear()))
    clearProfileCache()
    try { localStorage.removeItem('muscu.feed') } catch { /* rien */ }
  }, [])

  return (
    <AuthContext.Provider value={{ loading, user, profile, recovering, endRecovery: () => setRecovering(false), refreshProfile, patchProfile, signOut }}>
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
