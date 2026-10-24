import { nextDay } from './rotation'
import type { ProgramDay } from './types'

const days: ProgramDay[] = [2, 0, 1].map((p) => ({ id: `d${p}`, program_id: 'p', position: p, name: `Jour ${p + 1}` }))

test('aucune séance → premier jour', () => expect(nextDay(days, null)?.id).toBe('d0'))
test('après le jour 2 → jour 3', () => expect(nextDay(days, 'd1')?.id).toBe('d2'))
test('après le dernier jour → retour au premier', () => expect(nextDay(days, 'd2')?.id).toBe('d0'))
test('jour inconnu → premier jour', () => expect(nextDay(days, 'zzz')?.id).toBe('d0'))
test('aucun jour → null', () => expect(nextDay([], null)).toBeNull())
