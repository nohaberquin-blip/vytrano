import { weekday, type CalendarInput } from '../domain/calendar'
import type { ScheduleOverride, TrainingSchedule, WeeklyGoal } from '../domain/types'
import { db } from './db'
import { getActiveProgram } from './programs'
import { repo } from './repo'
import { lastDoneDayId } from './workouts'

export const getSchedule = (userId: string): Promise<TrainingSchedule | undefined> => db.training_schedules.get(userId)

/** Règle les jours d'entraînement ; la date d'activation n'est fixée qu'à la première fois. */
export async function saveWeekdays(userId: string, weekdays: number[], today: string): Promise<void> {
  const existing = await getSchedule(userId)
  await repo.put<TrainingSchedule>('training_schedules', {
    id: userId, user_id: userId, weekdays: [...weekdays].sort((a, b) => a - b), since: existing?.since ?? today,
  })
}

/**
 * Identifiant fixe, déduit de son contenu (ex. utilisateur + date) : deux appuis rapides ou deux
 * appareils visent la même ligne au lieu d'en créer deux (contrainte d'unicité côté serveur).
 */
export function stableId(...parts: string[]): string {
  const text = parts.join('|')
  const words = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b].map((seed) => {
    let h = seed >>> 0
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0
    return (Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0).toString(16).padStart(8, '0')
  })
  const hex = words.join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

const overrideId = (userId: string, date: string) => stableId(userId, 'override', date)

const overrideOn = (userId: string, date: string) => db.schedule_overrides.get(overrideId(userId, date))

/** Jour coché dans les jours d'entraînement : prévu sans exception. */
async function isRegular(userId: string, date: string): Promise<boolean> {
  return !!(await getSchedule(userId))?.weekdays.includes(weekday(date))
}

/** Une seule exception par date (id fixe) : l'existante est remplacée. */
async function putOverride(userId: string, date: string, kind: ScheduleOverride['kind'], moved_to: string | null = null) {
  await repo.put<ScheduleOverride>('schedule_overrides', { id: overrideId(userId, date), user_id: userId, date, kind, moved_to })
}

async function removeOverride(userId: string, date: string) {
  if (await overrideOn(userId, date)) await repo.remove('schedule_overrides', overrideId(userId, date))
}

/** Exception de report qui pointe vers cette date (la séance y avait été déplacée). */
const originOf = (userId: string, date: string) =>
  db.schedule_overrides.where('user_id').equals(userId).filter((o) => o.moved_to === date).first()

/** Rend une date prévue (ou non) avec le moins d'exceptions possible. */
async function setPlanned(userId: string, date: string, planned: boolean) {
  if (planned === (await isRegular(userId, date))) await removeOverride(userId, date)
  else await putOverride(userId, date, planned ? 'train' : 'rest')
}

// Les exceptions ne décrivent que les écarts aux jours cochés : un jour coché n'a jamais
// d'exception `train`, un jour non coché jamais d'exception `rest` sans report.

export async function moveSession(userId: string, from: string, to: string): Promise<void> {
  const origin = await originOf(userId, from)
  if (origin) {
    // Séance déjà déplacée : son origine pointe vers la nouvelle date, `from` redevient normal.
    if (origin.date === to) await removeOverride(userId, to)
    else await repo.put<ScheduleOverride>('schedule_overrides', { ...origin, moved_to: to })
    await setPlanned(userId, from, false)
  } else {
    await putOverride(userId, from, 'rest', to)
  }
  if (origin?.date !== to) await setPlanned(userId, to, true)
}

export async function cancelMove(userId: string, from: string): Promise<void> {
  const origin = await overrideOn(userId, from)
  if (!origin?.moved_to) return
  await setPlanned(userId, origin.moved_to, false)
  await repo.remove('schedule_overrides', origin.id)
}

export async function setRest(userId: string, date: string): Promise<void> {
  // Séance reportée ici puis annulée : son jour d'origine devient un simple repos.
  const origin = await originOf(userId, date)
  if (origin) {
    if (await isRegular(userId, origin.date)) await repo.put<ScheduleOverride>('schedule_overrides', { ...origin, moved_to: null })
    else await repo.remove('schedule_overrides', origin.id)
  }
  await setPlanned(userId, date, false)
}

export async function addSession(userId: string, date: string): Promise<void> {
  await setPlanned(userId, date, true)
}

/** `null` = revenir à l'objectif par défaut (le nombre de jours d'entraînement). */
export async function setWeeklyGoal(userId: string, monday: string, sessions: number | null): Promise<void> {
  const id = stableId(userId, 'goal', monday)
  if (sessions === null) {
    if (await db.weekly_goals.get(id)) await repo.remove('weekly_goals', id)
    return
  }
  await repo.put<WeeklyGoal>('weekly_goals', { id, user_id: userId, week_start: monday, sessions })
}

/** Tout ce qu'il faut pour calculer le calendrier ; null tant que les jours ne sont pas réglés. */
export async function loadCalendarInput(userId: string, today: string): Promise<CalendarInput | null> {
  const schedule = await getSchedule(userId)
  if (!schedule) return null
  const [overrides, goals, workouts, tree, lastDone] = await Promise.all([
    db.schedule_overrides.where('user_id').equals(userId).toArray(),
    db.weekly_goals.where('user_id').equals(userId).toArray(),
    db.workouts.where('user_id').equals(userId).filter((w) => w.status === 'done').toArray(),
    getActiveProgram(userId),
    lastDoneDayId(userId),
  ])
  return { today, schedule, overrides, goals, workouts, days: tree?.days ?? [], lastDoneDayId: lastDone }
}
