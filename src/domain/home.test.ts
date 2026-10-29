import { APPS, DEFAULT_LAYOUT, appColor, moveApp, moveWidget, readLayout, setAppColor, setAppHidden, setWidgetHidden } from './home'

const d = DEFAULT_LAYOUT

test('disposition par défaut : 8 icônes dans l’ordre de la spec, 4 widgets, rien de masqué', () => {
  expect(APPS.map((a) => a.id)).toEqual(['session', 'calendar', 'programs', 'exercises', 'nutrition', 'friends', 'profile', 'settings'])
  expect(d.apps).toEqual(APPS.map((a) => a.id))
  expect(d.widgets).toEqual(['next', 'progress', 'calories', 'goals'])
  expect(d.hiddenApps).toEqual([])
  expect(d.hiddenWidgets).toEqual([])
  expect(appColor(d, 'session')).toBe('orange')
  expect(appColor(d, 'settings')).toBe('gray')
})

test('valeur absente ou abîmée → disposition par défaut', () => {
  for (const raw of [null, undefined, 'x', 3, [], { apps: 3 }, { apps: ['zzz'], widgets: 'non' }]) {
    expect(readLayout(raw)).toEqual(d)
  }
})

test('ids inconnus et doublons ignorés, manquants ajoutés à la fin ; Paramètres jamais masqué ; couleur invalide ignorée', () => {
  const l = readLayout({
    apps: ['friends', 'zzz', 'friends', 'session'],
    hiddenApps: ['settings', 'nutrition', 'zzz'],
    colors: { session: 'green', friends: 'fuchsia', zzz: 'red' },
    widgets: ['goals', 'goals'],
    hiddenWidgets: ['calories', 'nope'],
  })
  expect(l.apps).toEqual(['friends', 'session', 'calendar', 'programs', 'exercises', 'nutrition', 'profile', 'settings'])
  expect(l.hiddenApps).toEqual(['nutrition'])
  expect(l.colors).toEqual({ session: 'green' })
  expect(appColor(l, 'friends')).toBe('teal')
  expect(l.widgets).toEqual(['goals', 'next', 'progress', 'calories'])
  expect(l.hiddenWidgets).toEqual(['calories'])
})

test('déplacer : l’icône prend la place de la cible', () => {
  expect(moveApp(d, 'friends', 'session').apps.slice(0, 2)).toEqual(['friends', 'session'])
  expect(moveApp(d, 'session', 'calendar').apps.slice(0, 3)).toEqual(['calendar', 'session', 'programs'])
  expect(moveApp(d, 'session', 'session')).toEqual(d)
  expect(moveWidget(d, 'goals', 'next').widgets).toEqual(['goals', 'next', 'progress', 'calories'])
})

test('masquer, afficher, couleur', () => {
  const hidden = setAppHidden(d, 'nutrition', true)
  expect(hidden.hiddenApps).toEqual(['nutrition'])
  expect(setAppHidden(hidden, 'nutrition', false).hiddenApps).toEqual([])
  expect(setAppHidden(d, 'settings', true)).toEqual(d)
  expect(setWidgetHidden(d, 'progress', true).hiddenWidgets).toEqual(['progress'])
  expect(setWidgetHidden(setWidgetHidden(d, 'progress', true), 'progress', false).hiddenWidgets).toEqual([])
  expect(appColor(setAppColor(d, 'session', 'blue'), 'session')).toBe('blue')
})
