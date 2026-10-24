import Dexie, { type Table } from 'dexie'
import type { Exercise, Program, ProgramDay, ProgramDayExercise, UserExercise, Workout, WorkoutSet } from '../domain/types'

export type SyncedTable =
  | 'exercises' | 'user_exercises' | 'programs' | 'program_days'
  | 'program_day_exercises' | 'workouts' | 'workout_sets'

export interface OutboxEntry {
  seq?: number
  table: SyncedTable
  op: 'upsert' | 'delete'
  key: string
  row: Record<string, unknown>
  attempts: number
  /** Utilisateur qui a fait l'écriture : seul lui peut l'envoyer. */
  user_id: string | null
  /** 1 = refusé définitivement par le serveur, mis de côté (index Dexie : pas de booléen). */
  dead: 0 | 1
}

class MuscuDB extends Dexie {
  exercises!: Table<Exercise, string>
  user_exercises!: Table<UserExercise, string>
  programs!: Table<Program, string>
  program_days!: Table<ProgramDay, string>
  program_day_exercises!: Table<ProgramDayExercise, string>
  workouts!: Table<Workout, string>
  workout_sets!: Table<WorkoutSet, string>
  outbox!: Table<OutboxEntry, number>

  constructor() {
    super('muscu')
    this.version(1).stores({
      exercises: 'id, owner_id',
      user_exercises: 'id, user_id, exercise_id',
      programs: 'id, owner_id',
      program_days: 'id, program_id',
      program_day_exercises: 'id, day_id, exercise_id',
      workouts: 'id, user_id, status, finished_at',
      workout_sets: 'id, workout_id, exercise_id',
      outbox: '++seq, [table+key], dead',
    })
    this.version(2).stores({ outbox: '++seq, [table+key], dead, user_id' })
  }
}

export const db = new MuscuDB()
