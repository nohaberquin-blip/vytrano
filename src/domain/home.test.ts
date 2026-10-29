import { APPS, DEFAULT_LAYOUT, appColor, appSize, moveApp, readLayout, setAppColor, setAppHidden, setAppSize } from './home'

const d = DEFAULT_LAYOUT

test('disposition par défaut : 8 tuiles dans l’ordre, tailles du bento, rien de masqué', () => {
  expect(APPS.map((a) => a.id)).toEqual(['session', 'calendar', 'nutrition', 'profile', 'friends', 'programs', 'exercises', 'settings'])
  expect(d.apps).toEqual(APPS.map((a) => a.id))
  expect(d.hiddenApps).toEqual([])
  expect(APPS.map((a) => appSize(d, a.id))).toEqual(['large', 'tall', 'tall', 'small', 'small', 'small', 'small', 'wide'])
  expect(appColor(d, 'session')).toBe('orange')
  expect(appColor(d, 'settings')).toBe('gray')
})

test('valeur absente ou abîmée → disposition par défaut', () => {
  for (const raw of [null, undefined, 'x', 3, [], { apps: 3 }, { apps: ['zzz'], sizes: 'non' }]) {
    expect(readLayout(raw)).toEqual(d)
  }
})

test('ids inconnus et doublons ignorés, manquants ajoutés à la fin ; Paramètres jamais masqué ; couleur et taille invalides ignorées', () => {
  const l = readLayout({
    apps: ['friends', 'zzz', 'friends', 'session'],
    hiddenApps: ['settings', 'nutrition', 'zzz'],
    colors: { session: 'green', friends: 'fuchsia', zzz: 'red' },
    sizes: { session: 'small', friends: 'huge', zzz: 'large' },
    widgets: ['goals'],
  })
  expect(l.apps).toEqual(['friends', 'session', 'calendar', 'nutrition', 'profile', 'programs', 'exercises', 'settings'])
  expect(l.hiddenApps).toEqual(['nutrition'])
  expect(l.colors).toEqual({ session: 'green' })
  expect(l.sizes).toEqual({ session: 'small' })
  expect(appSize(l, 'friends')).toBe('small')
  expect(appColor(l, 'friends')).toBe('teal')
})

test('ancienne disposition (grille d’icônes) : relue sans erreur', () => {
  const old = readLayout({ apps: ['programs', 'session'], hiddenApps: [], colors: {}, widgets: ['next'], hiddenWidgets: ['next'] })
  expect(old.apps.slice(0, 2)).toEqual(['programs', 'session'])
  expect(old.sizes).toEqual({})
})

test('déplacer : la tuile prend la place de la cible', () => {
  expect(moveApp(d, 'friends', 'session').apps.slice(0, 2)).toEqual(['friends', 'session'])
  expect(moveApp(d, 'session', 'calendar').apps.slice(0, 3)).toEqual(['calendar', 'session', 'nutrition'])
  expect(moveApp(d, 'session', 'session')).toEqual(d)
})

test('masquer, afficher, couleur, taille', () => {
  const hidden = setAppHidden(d, 'nutrition', true)
  expect(hidden.hiddenApps).toEqual(['nutrition'])
  expect(setAppHidden(hidden, 'nutrition', false).hiddenApps).toEqual([])
  expect(setAppHidden(d, 'settings', true)).toEqual(d)
  expect(appColor(setAppColor(d, 'session', 'blue'), 'session')).toBe('blue')
  expect(appSize(setAppSize(d, 'friends', 'wide'), 'friends')).toBe('wide')
})
