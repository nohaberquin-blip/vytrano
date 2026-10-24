export type Unit = 'kg' | 'lb'

export interface Profile {
  user_id: string
  username: string
  display_name: string | null
  share_workouts: boolean
  unit: Unit
}

export interface Exercise {
  id: string
  owner_id: string | null
  name: string
  muscle_group: string | null
  updated_at?: string
}

export interface UserExercise {
  id: string
  user_id: string
  exercise_id: string
  current_weight: number
  sets: number
  target_reps: number
  increment: number
  updated_at?: string
}

export interface Program {
  id: string
  owner_id: string
  name: string
  is_active: boolean
  share_code: string | null
  updated_at?: string
}

export interface ProgramDay {
  id: string
  program_id: string
  position: number
  name: string
  updated_at?: string
}

export interface ProgramDayExercise {
  id: string
  day_id: string
  exercise_id: string
  position: number
  updated_at?: string
}

export type WorkoutStatus = 'in_progress' | 'done'

export interface Workout {
  id: string
  user_id: string
  program_day_id: string | null
  started_at: string
  finished_at: string | null
  status: WorkoutStatus
  updated_at?: string
}

export interface WorkoutSet {
  id: string
  workout_id: string
  exercise_id: string
  position: number
  target_reps: number
  reps: number
  weight: number
  done: boolean
  updated_at?: string
}

export const DEFAULT_FICHE = { current_weight: 0, sets: 3, target_reps: 10, increment: 2.5 } as const
