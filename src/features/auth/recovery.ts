/** L'adresse contient-elle un lien « mot de passe oublié » (session de récupération) ? */
export const isRecoveryUrl = (hash: string) => new URLSearchParams(hash.replace(/^#/, '')).get('type') === 'recovery'

/** Lien reçu par email expiré ou déjà utilisé : Supabase renvoie vers l'app avec l'erreur dans l'adresse. */
export function linkError(hash: string): boolean {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  return !!(params.get('error_code') || params.get('error'))
}
