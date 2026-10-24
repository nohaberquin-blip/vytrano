import Dexie, { type Table } from 'dexie'
import type {
  BodyProfile, Exercise, Period, Program, ProgramDay, ProgramDayExercise, ScheduleOverride, TrainingSchedule, UserExercise, WeeklyGoal, WeightEntry, Workout, WorkoutLightening, WorkoutSet,
} from '../domain/types'

export type SyncedTable =
  | 'exercises' | 'user_exercises' | 'programs' | 'program_days'
  | 'program_day_exercises' | 'workouts' | 'workout_sets'
  | 'training_schedules' | 'schedule_overrides' | 'weekly_goals'
  | 'body_profiles' | 'weight_entries' | 'periods' | 'workout_lightenings'

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
  training_schedules!: Table<TrainingSchedule, string>
  schedule_overrides!: Table<ScheduleOverride, string>
  weekly_goals!: Table<WeeklyGoal, string>
  body_profiles!: Table<BodyProfile, string>
  weight_entries!: Table<WeightEntry, string>
  periods!: Table<Period, string>
  workout_lightenings!: Table<WorkoutLightening, string>
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
    this.version(3).stores({
      training_schedules: 'id, user_id',
      schedule_overrides: 'id, user_id, date',
      weekly_goals: 'id, user_id, week_start',
    })
    this.version(4).stores({ body_profiles: 'id, user_id', weight_entries: 'id, user_id, date' })
    this.version(5).stores({ periods: 'id, user_id, start', workout_lightenings: 'id, user_id' })
  }
}

export const db = new MuscuDB()
