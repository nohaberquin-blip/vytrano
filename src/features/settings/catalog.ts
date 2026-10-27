export type CategoryId = 'appearance' | 'notifications' | 'privacy' | 'training' | 'account'

export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: 'appearance', label: 'Apparence' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'privacy', label: 'Confidentialité' },
  { id: 'training', label: 'Préférences d’entraînement' },
  { id: 'account', label: 'Compte' },
]

export type SettingId = 'theme' | 'restAlerts' | 'sound' | 'vibrate' | 'shareWorkouts' | 'shareProgress'
  | 'unit' | 'auto' | 'wakeLock' | 'username' | 'signOut' | 'deleteAccount'

/** Tous les réglages, dans l'ordre d'affichage. Les mots-clés servent seulement à la recherche. */
export const SETTINGS: { id: SettingId; category: CategoryId; label: string; keywords: string[] }[] = [
  { id: 'theme', category: 'appearance', label: 'Thème', keywords: ['sombre', 'clair', 'nuit', 'couleur', 'mode'] },
  { id: 'restAlerts', category: 'notifications', label: 'Alertes de repos', keywords: ['notification', 'notif', 'alerte', 'push'] },
  { id: 'sound', category: 'notifications', label: 'Son', keywords: ['bip', 'sonnerie', 'audio'] },
  { id: 'vibrate', category: 'notifications', label: 'Vibration', keywords: ['vibrer'] },
  { id: 'shareWorkouts', category: 'privacy', label: 'Partager mes séances avec mes amis', keywords: ['amis', 'partage', 'visible'] },
  { id: 'shareProgress', category: 'privacy', label: 'Montrer mon niveau et mes badges à mes amis', keywords: ['amis', 'partage', 'badges', 'niveau', 'progression'] },
  { id: 'unit', category: 'training', label: 'Unité', keywords: ['kg', 'kilo', 'livre', 'lb', 'poids'] },
  { id: 'auto', category: 'training', label: 'Repos automatique', keywords: ['minuteur', 'chrono', 'timer'] },
  { id: 'wakeLock', category: 'training', label: "Garder l'écran allumé", keywords: ['veille', 'écran'] },
  { id: 'username', category: 'account', label: 'Pseudo', keywords: ['nom', 'identifiant'] },
  { id: 'signOut', category: 'account', label: 'Se déconnecter', keywords: ['déconnexion', 'sortir'] },
  { id: 'deleteAccount', category: 'account', label: 'Supprimer mon compte', keywords: ['supprimer', 'effacer', 'compte'] },
]

/** Minuscules, sans accents ni espaces autour : « ÉCRAN » et « ecran » se valent. */
export const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Réglages dont le nom ou un mot-clé contient la recherche (tous si elle est vide). */
export function searchSettings(query: string): SettingId[] {
  const q = normalize(query)
  return SETTINGS.filter((s) => !q || [s.label, ...s.keywords].some((w) => normalize(w).includes(q))).map((s) => s.id)
}
