import { db } from './db'
import { addDay, addDayExercise, createProgram } from './programs'
import { presetTemplate } from '../domain/methods'
import { abandonWorkout, addSet, finishWorkout, getInProgress, lastSetsFor, previewWorkout, startWorkout, updateSet } from './workouts'
import { setDayExercisePriority } from './programs'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

async function setupDay(weight = 60) {
  const p = await createProgram('u', 'A')
  const day = await addDay(p.id, 'Jour 1')
  await addDayExercise('u', day.id, 'squat')
  const fiche = (await db.user_exercises.where('exercise_id').equals('squat').first())!
  await db.user_exercises.put({ ...fiche, current_weight: weight, sets: 4, target_reps: 8, increment: 2.5 })
  return day
}

test('une séance commencée est retrouvée après rechargement, avec ses séries validées', async () => {
  const day = await setupDay()
  const started = await startWorkout('u', day)
  const first = (await db.workout_sets.where('workout_id').equals(started.id).sortBy('position'))[0]
  await updateSet({ ...first, done: true })
  const resumed = await getInProgress('u')
  expect(resumed?.workout.id).toBe(started.id)
  expect(resumed?.workout.name).toBe('Jour 1')
  expect(resumed?.sets).toHaveLength(4)
  expect(resumed?.sets.filter((s) => s.done)).toHaveLength(1)
})

test('terminer avec toutes les séries réussies → fiche augmentée du palier', async () => {
  const day = await setupDay(60)
  const w = await startWorkout('u', day)
  for (const s of await db.workout_sets.where('workout_id').equals(w.id).toArray()) await updateSet({ ...s, done: true })
  await finishWorkout(w.id)
  expect((await db.workouts.get(w.id))).toMatchObject({ status: 'done' })
  expect((await db.workouts.get(w.id))?.finished_at).toBeTruthy()
  expect((await db.user_exercises.where('exercise_id').equals('squat').first())?.current_weight).toBe(62.5)
  expect(await getInProgress('u')).toBeNull()
})

test('terminer avec une série ratée → fiche inchangée', async () => {
  const day = await setupDay(60)
  const w = await startWorkout('u', day)
  const sets = await db.workout_sets.where('workout_id').equals(w.id).sortBy('position')
  for (const s of sets) await updateSet({ ...s, done: true, reps: s.position === 2 ? 6 : 8 })
  await finishWorkout(w.id)
  expect((await db.user_exercises.where('exercise_id').equals('squat').first())?.current_weight).toBe(60)
})

test('lastSetsFor renvoie les séries de la dernière séance terminée', async () => {
  const day = await setupDay(60)
  const w = await startWorkout('u', day)
  for (const s of await db.workout_sets.where('workout_id').equals(w.id).toArray()) await updateSet({ ...s, done: true })
  await finishWorkout(w.id)
  await startWorkout('u', day) // séance en cours : ne compte pas
  const last = await lastSetsFor('u', 'squat')
  expect(last.map((s) => s.workout_id)).toEqual([w.id, w.id, w.id, w.id])
})

test('abandonner supprime la séance et ses séries', async () => {
  const day = await setupDay()
  const w = await startWorkout('u', day)
  await abandonWorkout(w.id)
  expect(await db.workouts.get(w.id)).toBeUndefined()
  expect(await db.workout_sets.where('workout_id').equals(w.id).count()).toBe(0)
})

test('deux appuis simultanés sur Commencer → une seule séance', async () => {
  const day = await setupDay()
  const [a, b] = await Promise.all([startWorkout('u', day), startWorkout('u', day)])
  expect(a.id).toBe(b.id)
  expect(await db.workouts.count()).toBe(1)
  expect(await db.workout_sets.count()).toBe(4)
})

test('double appui sur Terminer → la hausse n’est appliquée qu’une fois', async () => {
  const day = await setupDay(60)
  const w = await startWorkout('u', day)
  for (const s of await db.workout_sets.where('workout_id').equals(w.id).toArray()) await updateSet({ ...s, done: true })
  await Promise.all([finishWorkout(w.id), finishWorkout(w.id)])
  await finishWorkout(w.id)
  expect((await db.user_exercises.where('exercise_id').equals('squat').first())?.current_weight).toBe(62.5)
})

test('séance top set + back-off reprise avec ses types ; ＋ Série copie le type de la dernière', async () => {
  const day = await setupDay(120)
  const fiche = (await db.user_exercises.where('exercise_id').equals('squat').first())!
  await db.user_exercises.put({ ...fiche, template: presetTemplate('top_backoff') })
  const w = await startWorkout('u', day)
  const resumed = await getInProgress('u')
  expect(resumed?.sets.map((s) => s.kind)).toEqual(['top', 'backoff', 'backoff', 'backoff'])
  await addSet(w.id, 'squat')
  const after = await db.workout_sets.where('workout_id').equals(w.id).sortBy('position')
  expect(after.map((s) => s.kind)).toEqual(['top', 'backoff', 'backoff', 'backoff', 'backoff'])
})

test('mode manuel : terminer une séance réussie ne change pas la référence', async () => {
  const day = await setupDay(60)
  const fiche = (await db.user_exercises.where('exercise_id').equals('squat').first())!
  await db.user_exercises.put({ ...fiche, auto_progression: false })
  const w = await startWorkout('u', day)
  for (const s of await db.workout_sets.where('workout_id').equals(w.id).toArray()) await updateSet({ ...s, done: true })
  await finishWorkout(w.id)
  expect((await db.user_exercises.where('exercise_id').equals('squat').first())?.current_weight).toBe(60)
})

test('mode manuel : chaque jour reprend les charges de sa propre dernière séance', async () => {
  const p = await createProgram('u', 'B')
  const dayA = await addDay(p.id, 'A')
  const dayB = await addDay(p.id, 'B')
  await addDayExercise('u', dayA.id, 'squat')
  await addDayExercise('u', dayB.id, 'squat')
  const fiche = (await db.user_exercises.where('exercise_id').equals('squat').first())!
  await db.user_exercises.put({ ...fiche, current_weight: 100, sets: 2, target_reps: 8, auto_progression: false })
  const finishWith = async (day: typeof dayA, weight: number) => {
    const w = await startWorkout('u', day)
    for (const s of await db.workout_sets.where('workout_id').equals(w.id).toArray()) await updateSet({ ...s, weight, done: true })
    await finishWorkout(w.id)
  }
  await finishWith(dayB, 80)
  await finishWith(dayA, 60) // plus récente, mais un autre jour
  const w = await startWorkout('u', dayB)
  expect((await db.workout_sets.where('workout_id').equals(w.id).toArray()).map((s) => s.weight)).toEqual([80, 80])
})

async function bigDay() {
  const p = await createProgram('u', 'Gros')
  const day = await addDay(p.id, 'Jour long')
  for (const id of ['e1', 'e2', 'e3', 'e4', 'e5', 'e6']) {
    await addDayExercise('u', day.id, id)
    const f = (await db.user_exercises.where('exercise_id').equals(id).first())!
    await db.user_exercises.put({ ...f, sets: 4, target_reps: 8, current_weight: 60 })
  }
  return day
}

test('temps limité : séance réduite et limite enregistrée ; sans limite, séance complète', async () => {
  const day = await bigDay()
  const short = await startWorkout('u', day, 20)
  expect(short.time_limit).toBe(20)
  const shortSets = await db.workout_sets.where('workout_id').equals(short.id).count()
  expect(shortSets).toBeLessThan(24)
  await abandonWorkout(short.id)
  const full = await startWorkout('u', day)
  expect(full.time_limit ?? null).toBeNull()
  expect(await db.workout_sets.where('workout_id').equals(full.id).count()).toBe(24)
})

test('aperçu : rien n’est écrit ; un exercice prioritaire est gardé', async () => {
  const day = await bigDay()
  const last = (await db.program_day_exercises.where('day_id').equals(day.id).sortBy('position')).at(-1)!
  await setDayExercisePriority(last.id, true)
  expect((await db.program_day_exercises.get(last.id))!.priority).toBe(true)
  const preview = await previewWorkout('u', day, 20)
  expect(preview.changed).toBe(true)
  expect(preview.exercises.map((e) => e.key)).toContain(last.id)
  expect(await db.workouts.count()).toBe(0)
})

test('séance allégée −10 % : charges réduites, allègement enregistré ; combinable avec le temps', async () => {
  const day = await bigDay()
  const light = await startWorkout('u', day, null, 'minus10')
  expect((await db.workout_lightenings.get(light.id))?.mode).toBe('minus10')
  // Privé : la séance (lisible par les amis) ne porte pas l'allègement.
  const pushed = (await db.outbox.where('table').equals('workouts').toArray()).find((e) => e.key === light.id)!
  expect(pushed.row).not.toHaveProperty('lightened')
  const sets = await db.workout_sets.where('workout_id').equals(light.id).toArray()
  expect(sets).toHaveLength(24)
  expect(new Set(sets.map((s) => s.weight))).toEqual(new Set([55]))
  await abandonWorkout(light.id)
  const both = await startWorkout('u', day, 20, 'fewer')
  expect((await db.workout_lightenings.get(both.id))?.mode).toBe('fewer')
  expect(both.time_limit).toBe(20)
  expect(await db.workout_sets.where('workout_id').equals(both.id).count()).toBeLessThan(12)
})

test('séance allégée réussie : charge inchangée ; la suivante repart de la dernière séance normale', async () => {
  const day = await setupDay(60)
  const normal = await startWorkout('u', day)
  for (const s of await db.workout_sets.where('workout_id').equals(normal.id).toArray()) await updateSet({ ...s, done: true, reps: 5 })
  await finishWorkout(normal.id)
  const light = await startWorkout('u', day, null, 'minus20')
  for (const s of await db.workout_sets.where('workout_id').equals(light.id).toArray()) await updateSet({ ...s, done: true, reps: 12 })
  await finishWorkout(light.id)
  expect((await db.user_exercises.where('exercise_id').equals('squat').first())!.current_weight).toBe(60)
  const last = await lastSetsFor('u', 'squat', day.id)
  expect(last.every((s) => s.workout_id === normal.id)).toBe(true)
  expect(last.map((s) => s.reps)).toEqual([5, 5, 5, 5])
  expect((await lastSetsFor('u', 'squat')).every((s) => s.workout_id === normal.id)).toBe(true)
})

test('allègement qui ne change rien : séance normale, rien d’enregistré', async () => {
  const day = await setupDay(60)
  const f = (await db.user_exercises.where('exercise_id').equals('squat').first())!
  await db.user_exercises.put({ ...f, sets: 2 })
  const w = await startWorkout('u', day, null, 'fewer')
  expect(await db.workout_lightenings.get(w.id)).toBeUndefined()
})

test('abandon d’une séance allégée : l’allègement disparaît aussi', async () => {
  const day = await setupDay(60)
  const w = await startWorkout('u', day, null, 'minus10')
  await abandonWorkout(w.id)
  expect(await db.workout_lightenings.get(w.id)).toBeUndefined()
})
