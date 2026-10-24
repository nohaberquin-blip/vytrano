import { createClient } from '@supabase/supabase-js'
import { authStorage } from './authStorage'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * Fin de l'adresse au démarrage (lien reçu par email). À lire ici, avant la création du client :
 * Supabase la traite puis l'efface pendant son initialisation.
 */
export const urlHashAtStartup = typeof window === 'undefined' ? '' : window.location.hash

let startupHashUsed = false
/**
 * La fin d'adresse du démarrage tant qu'elle n'a pas été marquée comme utilisée. Lecture sans effet de bord :
 * React peut appeler deux fois une initialisation (mode strict).
 */
export const peekStartupHash = () => (startupHashUsed ? '' : urlHashAtStartup)
/** À appeler après affichage : un message « lien expiré » ne doit pas revenir après une déconnexion. */
export function consumeStartupHash() { startupHashUsed = true }

export const supabaseConfigured = Boolean(url && key)

export const supabase = createClient(url || 'http://localhost:54321', key || 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true, storage: authStorage },
})
