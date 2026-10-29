export type AppId = 'session' | 'calendar' | 'programs' | 'exercises' | 'nutrition' | 'friends' | 'profile' | 'settings'
export type IconColor = 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'blue' | 'indigo' | 'purple' | 'gray'
/** Bento sur 2 colonnes : 1 case, 2 côte à côte, 2 l'une sur l'autre, 4 cases. */
export type TileSize = 'small' | 'wide' | 'tall' | 'large'

export const APPS: { id: AppId; label: string; emoji: string; to: string; color: IconColor; size: TileSize }[] = [
  { id: 'session', label: 'Séances', emoji: '🏋️', to: '/seance', color: 'orange', size: 'large' },
  { id: 'calendar', label: 'Calendrier', emoji: '📅', to: '/calendrier', color: 'red', size: 'tall' },
  { id: 'nutrition', label: 'Nutrition', emoji: '🥗', to: '/nutrition', color: 'green', size: 'tall' },
  { id: 'profile', label: 'Profil', emoji: '👤', to: '/profil', color: 'indigo', size: 'small' },
  { id: 'friends', label: 'Amis', emoji: '👥', to: '/amis', color: 'teal', size: 'small' },
  { id: 'programs', label: 'Programmes', emoji: '📋', to: '/programmes', color: 'blue', size: 'small' },
  { id: 'exercises', label: 'Exercices', emoji: '💪', to: '/exercices', color: 'purple', size: 'small' },
  { id: 'settings', label: 'Paramètres', emoji: '⚙️', to: '/parametres', color: 'gray', size: 'wide' },
]

export const COLORS: IconColor[] = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'indigo', 'purple', 'gray']
export const SIZES: TileSize[] = ['small', 'wide', 'tall', 'large']

/** Ordre complet (masqués compris) ; `hidden*` : sous-ensembles. */
export interface HomeLayout {
  apps: AppId[]
  hiddenApps: AppId[]
  colors: Partial<Record<AppId, IconColor>>
  sizes: Partial<Record<AppId, TileSize>>
}

const APP_IDS = APPS.map((a) => a.id)

export const DEFAULT_LAYOUT: HomeLayout = { apps: APP_IDS, hiddenApps: [], colors: {}, sizes: {} }

/** Ids connus, sans doublons, dans l'ordre donné. */
function known<T extends string>(raw: unknown, ids: readonly T[]): T[] {
  return Array.isArray(raw) ? [...new Set(raw.filter((x): x is T => ids.includes(x as T)))] : []
}
/** Ordre enregistré, puis les ids manquants à la fin. */
const ordered = <T extends string>(raw: unknown, ids: readonly T[]): T[] => {
  const list = known(raw, ids)
  return [...list, ...ids.filter((id) => !list.includes(id))]
}

/** Disposition enregistrée dans le profil ; tout ce qui est inconnu ou abîmé est ignoré. */
export function readLayout(raw: unknown): HomeLayout {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return DEFAULT_LAYOUT
  const r = raw as Record<string, unknown>
  return {
    apps: ordered(r.apps, APP_IDS),
    hiddenApps: known(r.hiddenApps, APP_IDS).filter((id) => id !== 'settings'),
    colors: pick(r.colors, COLORS),
    sizes: pick(r.sizes, SIZES),
  }
}

/** Valeurs connues d'un objet `{ id d'appli: valeur }` (les anciennes clés, comme les widgets, sont ignorées). */
function pick<T extends string>(raw: unknown, values: readonly T[]): Partial<Record<AppId, T>> {
  const out: Partial<Record<AppId, T>> = {}
  if (raw && typeof raw === 'object') {
    for (const [id, v] of Object.entries(raw)) if (APP_IDS.includes(id as AppId) && values.includes(v as T)) out[id as AppId] = v as T
  }
  return out
}

export const appColor = (l: HomeLayout, id: AppId): IconColor => l.colors[id] ?? APPS.find((a) => a.id === id)!.color
export const appSize = (l: HomeLayout, id: AppId): TileSize => l.sizes[id] ?? APPS.find((a) => a.id === id)!.size

/** `id` prend la place de `target` (les autres se décalent). */
function moveTo<T>(list: T[], id: T, target: T): T[] {
  if (id === target) return list
  const rest = list.filter((x) => x !== id)
  const at = list.indexOf(target) > list.indexOf(id) ? rest.indexOf(target) + 1 : rest.indexOf(target)
  return [...rest.slice(0, at), id, ...rest.slice(at)]
}

export const moveApp = (l: HomeLayout, id: AppId, target: AppId): HomeLayout =>
  id === target ? l : { ...l, apps: moveTo(l.apps, id, target) }

const toggle = <T>(list: T[], id: T, on: boolean) => (on ? (list.includes(id) ? list : [...list, id]) : list.filter((x) => x !== id))

/** Paramètres ne se masque jamais : on ne doit pas pouvoir s'enfermer dehors. */
export const setAppHidden = (l: HomeLayout, id: AppId, hidden: boolean): HomeLayout =>
  id === 'settings' ? l : { ...l, hiddenApps: toggle(l.hiddenApps, id, hidden) }
export const setAppColor = (l: HomeLayout, id: AppId, c: IconColor): HomeLayout => ({ ...l, colors: { ...l.colors, [id]: c } })
export const setAppSize = (l: HomeLayout, id: AppId, size: TileSize): HomeLayout => ({ ...l, sizes: { ...l.sizes, [id]: size } })
