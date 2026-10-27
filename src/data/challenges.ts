import { challengeProgress } from '../domain/challenges'
import { monthEnd, monthStart, type MonthData } from '../domain/month'
import type { CalendarInput } from '../domain/calendar'
import type { Challenge, Workout } from '../domain/types'
import { loadCalendarInput, stableId } from './calendar'
import { db } from './db'
import { historyByExercise, historyOf } from './records'
import { repo } from './repo'

/** Défis et objectifs de mois modifiés, du plus ancien au plus récent. */
export async function listChallenges(userId: string): Promise<Challenge[]> {
  const all = await db.challenges.where('user_id').equals(userId).toArray()
  return all.sort((a, b) => a.start.localeCompare(b.start) || (a.updated_at ?? '').localeCompare(b.updated_at ?? ''))
}

/** Nouveau défi, commencé aujourd'hui. */
export async function createChallenge(userId: string, c: Omit<Challenge, 'id' | 'user_id' | 'start' | 'updated_at'>, today: string): Promise<void> {
  await repo.put<Challenge>('challenges', { ...c, id: crypto.randomUUID(), user_id: userId, start: today })
}

export const removeChallenge = (id: string) => repo.remove('challenges', id)

/** Objectif de séances d'un mois (`null` : revenir à la valeur proposée). Une ligne par mois (id fixe). */
export async function setMonthGoal(userId: string, ym: string, goal: number | null): Promise<void> {
  const id = stableId('month', userId, ym)
  if (goal === null) {
    if (await db.challenges.get(id)) await repo.remove('challenges', id)
    return
  }
  await repo.put<Challenge>('challenges', {
    id, user_id: userId, kind: 'month', exercise_id: null, metric: null, target: goal, start: monthStart(ym), end_date: monthEnd(ym),
  })
}

/** Tout ce qu'il faut pour l'objectif du mois, les défis et les bilans. */
export async function loadMonthData(userId: string, today: string): Promise<MonthData> {
  const [workouts, input, challenges, history] = await Promise.all([
    db.workouts.where('user_id').equals(userId).filter((w) => w.status === 'done').toArray(),
    loadCalendarInput(userId, today),
    listChallenges(userId),
    historyByExercise(userId),
  ])
  return { today, workouts, input, challenges, history }
}

/**
 * Comme `loadMonthData`, mais l'historique se limite aux exercices des défis de charge (index des exercices) :
 * de quoi afficher l'objectif et les défis sans relire toutes les séries à chaque écriture. Le bilan prend `loadMonthData`.
 * `input` déjà chargé (Calendrier) : ni le calendrier ni les séances ne sont relus.
 */
export async function loadMonthSummary(userId: string, today: string, input?: CalendarInput | null): Promise<MonthData> {
  const [cal, challenges] = await Promise.all([input === undefined ? loadCalendarInput(userId, today) : input, listChallenges(userId)])
  const workouts = cal?.workouts ?? await db.workouts.where('user_id').equals(userId).filter((w) => w.status === 'done').toArray()
  const lifts = [...new Set(challenges.filter((c) => c.kind === 'lift').map((c) => c.exercise_id!))]
  const history = lifts.length > 0 ? await historyOf(userId, lifts) : new Map()
  return { today, workouts, input: cal, challenges, history }
}

/** Défis que la séance en cours fait réussir (comptée comme terminée, ses séries ajoutées si elle n'est pas allégée). */
export async function challengesCompletedBy(userId: string, workout: Workout, today: string): Promise<Challenge[]> {
  const data = await loadMonthSummary(userId, today)
  const defis = data.challenges.filter((c) => c.kind !== 'month')
  if (defis.length === 0) return []
  const done = { ...workout, status: 'done' as const }
  const history = new Map(data.history)
  if (!(await db.workout_lightenings.get(workout.id))) {
    const sets = await db.workout_sets.where('workout_id').equals(workout.id).toArray()
    for (const exerciseId of new Set(sets.map((s) => s.exercise_id))) {
      history.set(exerciseId, [...(history.get(exerciseId) ?? []), { workout: done, sets: sets.filter((s) => s.exercise_id === exerciseId) }])
    }
  }
  const workouts = [...data.workouts.filter((w) => w.id !== workout.id), done]
  return defis.filter((c) =>
    challengeProgress(c, data.workouts, data.history, today).status !== 'done'
    && challengeProgress(c, workouts, history, today).status === 'done')
}
