import type { Program, ProgramDay, ProgramDayExercise } from '../domain/types'
import type { SetTemplate } from '../domain/methods'
import { db } from './db'
import { ensureFiche, repo } from './repo'

const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position

export async function createProgram(userId: string, name: string): Promise<Program> {
  const hasActive = (await db.programs.where('owner_id').equals(userId).filter((p) => p.is_active).count()) > 0
  return repo.put<Program>('programs', { id: crypto.randomUUID(), owner_id: userId, name, is_active: !hasActive, share_code: null })
}

export async function renameProgram(programId: string, name: string) {
  const p = await db.programs.get(programId)
  if (p) await repo.put('programs', { ...p, name })
}

export async function setActiveProgram(userId: string, programId: string): Promise<void> {
  const programs = await db.programs.where('owner_id').equals(userId).toArray()
  for (const p of programs) {
    const active = p.id === programId
    if (p.is_active !== active) await repo.put('programs', { ...p, is_active: active })
  }
}

export async function deleteProgram(userId: string, programId: string): Promise<void> {
  const program = await db.programs.get(programId)
  if (!program) return
  const days = await db.program_days.where('program_id').equals(programId).toArray()
  // Le serveur supprime les enfants en cascade ; en local on les retire sans les renvoyer.
  for (const d of days) await db.program_day_exercises.where('day_id').equals(d.id).delete()
  await db.program_days.bulkDelete(days.map((d) => d.id))
  await repo.remove('programs', programId)
  if (program.is_active) {
    const next = await db.programs.where('owner_id').equals(userId).first()
    if (next) await setActiveProgram(userId, next.id)
  }
}

export async function addDay(programId: string, name: string): Promise<ProgramDay> {
  const days = await db.program_days.where('program_id').equals(programId).toArray()
  const position = days.length ? Math.max(...days.map((d) => d.position)) + 1 : 0
  return repo.put<ProgramDay>('program_days', { id: crypto.randomUUID(), program_id: programId, position, name })
}

export async function renameDay(dayId: string, name: string) {
  const d = await db.program_days.get(dayId)
  if (d) await repo.put('program_days', { ...d, name })
}

export async function deleteDay(dayId: string) {
  await db.program_day_exercises.where('day_id').equals(dayId).delete()
  await repo.remove('program_days', dayId)
}

/** Échange la position avec le voisin dans le sens `delta` ; rien si on est déjà au bout. */
async function swapWithNeighbour<T extends { id: string; position: number }>(
  table: 'program_days' | 'program_day_exercises', siblings: T[], id: string, delta: -1 | 1,
) {
  const sorted = [...siblings].sort(byPosition)
  const i = sorted.findIndex((s) => s.id === id)
  const j = i + delta
  if (i === -1 || j < 0 || j >= sorted.length) return
  const a = sorted[i], b = sorted[j]
  await repo.put(table, { ...a, position: b.position })
  await repo.put(table, { ...b, position: a.position })
}

export async function moveDay(dayId: string, delta: -1 | 1): Promise<void> {
  const day = await db.program_days.get(dayId)
  if (!day) return
  await swapWithNeighbour('program_days', await db.program_days.where('program_id').equals(day.program_id).toArray(), dayId, delta)
}

export async function addDayExercise(userId: string, dayId: string, exerciseId: string): Promise<ProgramDayExercise> {
  await ensureFiche(userId, exerciseId)
  const items = await db.program_day_exercises.where('day_id').equals(dayId).toArray()
  const position = items.length ? Math.max(...items.map((d) => d.position)) + 1 : 0
  return repo.put<ProgramDayExercise>('program_day_exercises', { id: crypto.randomUUID(), day_id: dayId, exercise_id: exerciseId, position })
}

export async function moveDayExercise(id: string, delta: -1 | 1): Promise<void> {
  const item = await db.program_day_exercises.get(id)
  if (!item) return
  await swapWithNeighbour('program_day_exercises', await db.program_day_exercises.where('day_id').equals(item.day_id).toArray(), id, delta)
}

/** Méthode propre à cet exercice ce jour-là ; null = revenir à la méthode de la fiche. */
export async function setDayExerciseTemplate(id: string, template: SetTemplate | null): Promise<void> {
  const item = await db.program_day_exercises.get(id)
  if (item) await repo.put('program_day_exercises', { ...item, template })
}

/** Étoile « prioritaire » : exercice gardé quand la séance est raccourcie. */
export async function setDayExercisePriority(id: string, priority: boolean): Promise<void> {
  const item = await db.program_day_exercises.get(id)
  if (item) await repo.put('program_day_exercises', { ...item, priority })
}

export async function removeDayExercise(id: string) {
  await repo.remove('program_day_exercises', id)
}

export interface ProgramTree {
  program: Program
  days: ProgramDay[]
  exercisesByDay: Map<string, ProgramDayExercise[]>
}

export async function getProgramTree(programId: string): Promise<ProgramTree | null> {
  const program = await db.programs.get(programId)
  if (!program) return null
  const days = (await db.program_days.where('program_id').equals(programId).toArray()).sort(byPosition)
  const items = await db.program_day_exercises.where('day_id').anyOf(days.map((d) => d.id)).toArray()
  const exercisesByDay = new Map(days.map((d) => [d.id, items.filter((i) => i.day_id === d.id).sort(byPosition)]))
  return { program, days, exercisesByDay }
}

export async function getActiveProgram(userId: string): Promise<ProgramTree | null> {
  const active = await db.programs.where('owner_id').equals(userId).filter((p) => p.is_active).first()
  return active ? getProgramTree(active.id) : null
}
