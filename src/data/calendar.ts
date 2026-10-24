import type { CalendarInput } from '../domain/calendar'
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

const overrideOn = (userId: string, date: string) =>
  db.schedule_overrides.where('date').equals(date).filter((o) => o.user_id === userId).first()

/** Une seule exception par date : l'existante est remplacée (même id). */
async function putOverride(userId: string, date: string, kind: ScheduleOverride['kind'], moved_to: string | null = null) {
  const existing = await overrideOn(userId, date)
  await repo.put<ScheduleOverride>('schedule_overrides', { id: existing?.id ?? crypto.randomUUID(), user_id: userId, date, kind, moved_to })
}

async function removeOverride(userId: string, date: string) {
  const existing = await overrideOn(userId, date)
  if (existing) await repo.remove('schedule_overrides', existing.id)
}

export async function moveSession(userId: string, from: string, to: string): Promise<void> {
  await putOverride(userId, from, 'rest', to)
  await putOverride(userId, to, 'train')
}

export async function cancelMove(userId: string, from: string): Promise<void> {
  const origin = await overrideOn(userId, from)
  if (!origin?.moved_to) return
  const target = await overrideOn(userId, origin.moved_to)
  if (target?.kind === 'train') await repo.remove('schedule_overrides', target.id)
  await repo.remove('schedule_overrides', origin.id)
}

export async function setRest(userId: string, date: string): Promise<void> {
  const existing = await overrideOn(userId, date)
  if (existing?.kind === 'train') await removeOverride(userId, date)
  else await putOverride(userId, date, 'rest')
}

export async function addSession(userId: string, date: string): Promise<void> {
  const existing = await overrideOn(userId, date)
  if (existing?.kind === 'rest' && !existing.moved_to) await removeOverride(userId, date)
  else await putOverride(userId, date, 'train')
}

/** `null` = revenir à l'objectif par défaut (le nombre de jours d'entraînement). */
export async function setWeeklyGoal(userId: string, monday: string, sessions: number | null): Promise<void> {
  const existing = await db.weekly_goals.where('week_start').equals(monday).filter((g) => g.user_id === userId).first()
  if (sessions === null) {
    if (existing) await repo.remove('weekly_goals', existing.id)
    return
  }
  await repo.put<WeeklyGoal>('weekly_goals', { id: existing?.id ?? crypto.randomUUID(), user_id: userId, week_start: monday, sessions })
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
