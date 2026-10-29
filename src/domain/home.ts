export type AppId = 'session' | 'calendar' | 'programs' | 'exercises' | 'nutrition' | 'friends' | 'profile' | 'settings'
export type WidgetId = 'next' | 'progress' | 'calories' | 'goals'
export type IconColor = 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'blue' | 'indigo' | 'purple' | 'gray'

export const APPS: { id: AppId; label: string; emoji: string; to: string; color: IconColor }[] = [
  { id: 'session', label: 'Séances', emoji: '🏋️', to: '/seance', color: 'orange' },
  { id: 'calendar', label: 'Calendrier', emoji: '📅', to: '/calendrier', color: 'red' },
  { id: 'programs', label: 'Programmes', emoji: '📋', to: '/programmes', color: 'blue' },
  { id: 'exercises', label: 'Exercices', emoji: '💪', to: '/exercices', color: 'purple' },
  { id: 'nutrition', label: 'Nutrition', emoji: '🥗', to: '/nutrition', color: 'green' },
  { id: 'friends', label: 'Amis', emoji: '👥', to: '/amis', color: 'teal' },
  { id: 'profile', label: 'Profil', emoji: '👤', to: '/profil', color: 'indigo' },
  { id: 'settings', label: 'Paramètres', emoji: '⚙️', to: '/parametres', color: 'gray' },
]

export const WIDGETS: { id: WidgetId; label: string }[] = [
  { id: 'next', label: 'Prochaine séance' },
  { id: 'progress', label: 'Progression' },
  { id: 'calories', label: 'Calories' },
  { id: 'goals', label: 'Objectifs du jour' },
]

export const COLORS: IconColor[] = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'indigo', 'purple', 'gray']

/** Ordre complet (masqués compris) ; `hidden*` : sous-ensembles. */
export interface HomeLayout {
  apps: AppId[]
  hiddenApps: AppId[]
  colors: Partial<Record<AppId, IconColor>>
  widgets: WidgetId[]
  hiddenWidgets: WidgetId[]
}

const APP_IDS = APPS.map((a) => a.id)
const WIDGET_IDS = WIDGETS.map((w) => w.id)

export const DEFAULT_LAYOUT: HomeLayout = { apps: APP_IDS, hiddenApps: [], colors: {}, widgets: WIDGET_IDS, hiddenWidgets: [] }

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
  const colors: HomeLayout['colors'] = {}
  if (r.colors && typeof r.colors === 'object') {
    for (const [id, c] of Object.entries(r.colors)) {
      if (APP_IDS.includes(id as AppId) && COLORS.includes(c as IconColor)) colors[id as AppId] = c as IconColor
    }
  }
  return {
    apps: ordered(r.apps, APP_IDS),
    hiddenApps: known(r.hiddenApps, APP_IDS).filter((id) => id !== 'settings'),
    colors,
    widgets: ordered(r.widgets, WIDGET_IDS),
    hiddenWidgets: known(r.hiddenWidgets, WIDGET_IDS),
  }
}

export const appColor = (l: HomeLayout, id: AppId): IconColor => l.colors[id] ?? APPS.find((a) => a.id === id)!.color

/** `id` prend la place de `target` (les autres se décalent). */
function moveTo<T>(list: T[], id: T, target: T): T[] {
  if (id === target) return list
  const rest = list.filter((x) => x !== id)
  const at = list.indexOf(target) > list.indexOf(id) ? rest.indexOf(target) + 1 : rest.indexOf(target)
  return [...rest.slice(0, at), id, ...rest.slice(at)]
}

export const moveApp = (l: HomeLayout, id: AppId, target: AppId): HomeLayout =>
  id === target ? l : { ...l, apps: moveTo(l.apps, id, target) }
export const moveWidget = (l: HomeLayout, id: WidgetId, target: WidgetId): HomeLayout =>
  id === target ? l : { ...l, widgets: moveTo(l.widgets, id, target) }

const toggle = <T>(list: T[], id: T, on: boolean) => (on ? (list.includes(id) ? list : [...list, id]) : list.filter((x) => x !== id))

/** Paramètres ne se masque jamais : on ne doit pas pouvoir s'enfermer dehors. */
export const setAppHidden = (l: HomeLayout, id: AppId, hidden: boolean): HomeLayout =>
  id === 'settings' ? l : { ...l, hiddenApps: toggle(l.hiddenApps, id, hidden) }
export const setWidgetHidden = (l: HomeLayout, id: WidgetId, hidden: boolean): HomeLayout =>
  ({ ...l, hiddenWidgets: toggle(l.hiddenWidgets, id, hidden) })
export const setAppColor = (l: HomeLayout, id: AppId, c: IconColor): HomeLayout => ({ ...l, colors: { ...l.colors, [id]: c } })
