import type { HomeLayout } from '../domain/home'
import type { Profile } from '../domain/types'
import { supabase } from './supabase'

const CACHE_KEY = 'muscu.profile'

export function usernameError(name: string): string | null {
  if (name.trim().length < 3) return '3 caractères minimum'
  if (name.length > 20) return '20 caractères maximum'
  if (!/^[a-zA-Z0-9_.]+$/.test(name)) return 'Uniquement lettres sans accent, chiffres, « _ » et « . »'
  return null
}

export const isProvisionalUsername = (u: string) => /^user_[0-9a-f]{8}$/.test(u)

export function profileErrorMessage(error: { code?: string; message: string }): string {
  if (error.code === '23505') return 'Ce pseudo est déjà pris'
  if (error.code === '23514') return 'Pseudo invalide'
  return 'Impossible d’enregistrer. Vérifie ta connexion.'
}

export function cachedProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as Profile) : null
  } catch {
    return null
  }
}

export function cacheProfile(p: Profile | null) {
  try {
    if (p) localStorage.setItem(CACHE_KEY, JSON.stringify(p))
    else localStorage.removeItem(CACHE_KEY)
  } catch { /* stockage indisponible : on se passe du cache */ }
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    // « * » : un champ ajouté par une migration pas encore appliquée ne casse pas la lecture du profil.
    .from('profiles').select('*').eq('user_id', userId).maybeSingle()
  if (error) return cachedProfile()
  cacheProfile(data as Profile | null)
  return data as Profile | null
}

/** Les profils s'écrivent directement sur le serveur (réseau requis). */
export async function updateProfile(userId: string, changes: Partial<Omit<Profile, 'user_id'>>) {
  const { error } = await supabase.from('profiles').update({ ...changes, updated_at: new Date().toISOString() }).eq('user_id', userId)
  return { error }
}

/**
 * Profil relu du serveur, mais avec la disposition de l'accueil modifiée sur cet appareil (`pending`) :
 * une lecture partie avant l'enregistrement ne doit pas effacer le dernier choix.
 */
export function keepLocalHome(p: Profile | null, pending: { local: unknown } | undefined): Profile | null {
  return p && pending ? { ...p, home: pending.local } : p
}

/** Disposition de l'accueil, enregistrée sur le profil (réseau requis). */
export const saveHome = (userId: string, layout: HomeLayout) => updateProfile(userId, { home: layout })

export function clearProfileCache() {
  cacheProfile(null)
}
