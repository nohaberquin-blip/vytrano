import { SETTINGS, normalize, searchSettings } from './catalog'

test('normalize : minuscules, sans accents ni espaces autour', () => {
  expect(normalize('  ÉCRAN ')).toBe('ecran')
})

test('recherche par nom ou mot-clé', () => {
  expect(searchSettings('vib')).toEqual(['vibrate'])
  expect(searchSettings('sombre')).toEqual(['theme'])
  expect(searchSettings('kilo')).toEqual(['unit'])
  expect(searchSettings('amis')).toEqual(['shareWorkouts', 'shareProgress'])
  expect(searchSettings('Écran')).toEqual(['wakeLock'])
})

test('aucun résultat ; requête vide → tout', () => {
  expect(searchSettings('zzz')).toEqual([])
  expect(searchSettings('  ')).toEqual(SETTINGS.map((s) => s.id))
  expect(SETTINGS).toHaveLength(12)
})
