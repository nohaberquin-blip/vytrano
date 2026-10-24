import { db } from './db'
import { addDay, addDayExercise, createProgram } from './programs'
import { abandonWorkout, finishWorkout, getInProgress, lastSetsFor, startWorkout, updateSet } from './workouts'

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
