/** L'adresse contient-elle un lien « mot de passe oublié » (session de récupération) ? */
export const isRecoveryUrl = (hash: string) => new URLSearchParams(hash.replace(/^#/, '')).get('type') === 'recovery'
