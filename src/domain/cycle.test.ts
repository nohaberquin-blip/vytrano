import { cycleLength, periodOn, periodState } from './cycle'
import type { Period } from './types'

const p = (start: string, days = 5): Period => ({ id: start, user_id: 'u', start, days })
const TODAY = '2026-10-01'

test('jours notés : début + durée', () => {
  const list = [p('2026-10-01')]
  expect(periodState('2026-10-01', list, TODAY)).toBe('period')
  expect(periodState('2026-10-05', list, TODAY)).toBe('period')
  expect(periodState('2026-10-06', list, TODAY)).toBeNull()
  expect(periodOn('2026-10-03', list)?.id).toBe('2026-10-01')
  expect(periodOn('2026-10-06', list)).toBeUndefined()
})

test('un seul début : prévision 28 jours plus tard, même durée', () => {
  const list = [p('2026-10-01')]
  expect(cycleLength(list)).toBe(28)
  expect(periodState('2026-10-28', list, TODAY)).toBeNull()
  expect(periodState('2026-10-29', list, TODAY)).toBe('predicted')
  expect(periodState('2026-11-02', list, TODAY)).toBe('predicted')
  expect(periodState('2026-11-03', list, TODAY)).toBeNull()
})

test('moyenne des 3 derniers cycles', () => {
  const list = [p('2026-06-01'), p('2026-07-01'), p('2026-08-01'), p('2026-08-31'), p('2026-09-30')]
  // écarts : 30, 31, 30, 30 → 3 derniers : 31, 30, 30 → 30
  expect(cycleLength(list)).toBe(30)
  expect(periodState('2026-10-30', list, TODAY)).toBe('predicted')
  expect(periodState('2026-10-29', list, TODAY)).toBeNull()
})

test('écart hors 15 à 60 jours ignoré', () => {
  expect(cycleLength([p('2026-06-01'), p('2026-08-30')])).toBe(28)
  expect(cycleLength([p('2026-09-01'), p('2026-09-10')])).toBe(28)
})

test('prévision entièrement passée sans saisie : plus affichée ; la suivante oui', () => {
  const list = [p('2026-08-01')]
  const today = '2026-10-25'
  expect(periodState('2026-08-30', list, today)).toBeNull() // 08-29 → 09-02, passé
  expect(periodState('2026-10-25', list, today)).toBe('predicted') // 10-24 → 10-28, en cours
})

test('un jour noté n’est jamais « prévu » ; aucune période → rien', () => {
  const list = [p('2026-10-01'), p('2026-10-29')]
  expect(periodState('2026-10-29', list, TODAY)).toBe('period')
  expect(periodState('2026-10-15', [], TODAY)).toBeNull()
})
