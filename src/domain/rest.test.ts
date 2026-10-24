import { baseRest, formatClock, parseClock, restSeconds } from './rest'
import type { WorkoutSet } from './types'

const set = (p: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: 's', workout_id: 'w', exercise_id: 'e', position: 0, target_reps: 8, reps: 8, weight: 60, done: true, kind: 'work', ...p,
})
const next = set({ id: 'n', position: 1, done: false })
const fiche = { rest_seconds: null, target_reps: 8, current_weight: 100 }

test('pas de série suivante : pas de repos', () => {
  expect(restSeconds(set(), undefined, fiche)).toBeNull()
})

test('série suivante rattachée : durée fixe', () => {
  expect(restSeconds(set({ reps: 2 }), set({ kind: 'drop', done: false }), fiche)).toBe(15)
  expect(restSeconds(set(), set({ kind: 'restpause', done: false }), fiche)).toBe(20)
  expect(restSeconds(set(), set({ kind: 'cluster', done: false }), fiche)).toBe(20)
})

test('échauffement : 60 s', () => {
  expect(restSeconds(set({ kind: 'warmup', weight: 95 }), next, fiche)).toBe(60)
})

test('base selon les reps visées, ou la fiche', () => {
  expect(baseRest(5)).toBe(180)
  expect(baseRest(8)).toBe(120)
  expect(baseRest(12)).toBe(120)
  expect(baseRest(15)).toBe(75)
  expect(baseRest(null)).toBe(120)
  expect(restSeconds(set({ target_reps: 5, reps: 5 }), next, fiche)).toBe(180)
  expect(restSeconds(set({ target_reps: null, reps: 7 }), next, fiche)).toBe(120)
  expect(restSeconds(set(), next, { ...fiche, rest_seconds: 150 })).toBe(150)
  expect(restSeconds(set(), next, undefined)).toBe(120)
})

test('ajustements : type, difficulté, charge', () => {
  expect(restSeconds(set({ kind: 'top' }), next, fiche)).toBe(150)
  expect(restSeconds(set({ kind: 'amrap' }), next, fiche)).toBe(150)
  expect(restSeconds(set({ reps: 6 }), next, fiche)).toBe(150)
  expect(restSeconds(set({ reps: 10 }), next, fiche)).toBe(105)
  expect(restSeconds(set({ target_reps_max: 12, reps: 13 }), next, fiche)).toBe(120)
  expect(restSeconds(set({ target_reps_max: 12, reps: 14 }), next, fiche)).toBe(105)
  expect(restSeconds(set({ weight: 90 }), next, fiche)).toBe(135)
  expect(restSeconds(set({ weight: 90 }), next, { ...fiche, current_weight: 0 })).toBe(120)
  expect(restSeconds(set({ kind: 'top', reps: 3, weight: 100, target_reps: 5 }), next, fiche)).toBe(255)
})

test('bornes : 15 s minimum, 600 s maximum', () => {
  expect(restSeconds(set({ reps: 20 }), next, { ...fiche, rest_seconds: 20 })).toBe(15)
  expect(restSeconds(set({ kind: 'top', reps: 1, weight: 100 }), next, { ...fiche, rest_seconds: 600 })).toBe(600)
})

test('horloge : affichage et saisie', () => {
  expect(formatClock(150)).toBe('2:30')
  expect(formatClock(5)).toBe('0:05')
  expect(formatClock(0)).toBe('0:00')
  expect(parseClock('2:30')).toBe(150)
  expect(parseClock(' 90 ')).toBe(90)
  expect(parseClock('')).toBeNull()
  expect(parseClock('2:75')).toBeNaN()
  expect(parseClock('abc')).toBeNaN()
})
