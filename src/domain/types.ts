import type { SetKind, SetTemplate } from './methods'

export type Unit = 'kg' | 'lb'

export interface Profile {
  user_id: string
  username: string
  display_name: string | null
  share_workouts: boolean
  /** Niveau, série et badges visibles par les amis (désactivé par défaut). */
  share_progress?: boolean
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
  /** Méthode (modèle de séries) ; absente = classique depuis sets × target_reps. */
  template?: SetTemplate | null
  /** Progression automatique (true si absent). */
  auto_progression?: boolean
  /** Arrondi des charges calculées, en kg (2,5 si absent). */
  rounding?: number
  /** Repos de base en secondes ; absent = selon les reps visées. */
  rest_seconds?: number | null
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
  /** Méthode propre à ce jour ; absente = méthode de la fiche. */
  template?: SetTemplate | null
  /** Gardé en priorité quand la séance est raccourcie (temps limité). */
  priority?: boolean
  updated_at?: string
}

export type WorkoutStatus = 'in_progress' | 'done'

export interface Workout {
  id: string
  user_id: string
  program_day_id: string | null
  name: string
  started_at: string
  finished_at: string | null
  status: WorkoutStatus
  /** Temps disponible choisi (minutes) ; absent = séance complète. */
  time_limit?: number | null
  updated_at?: string
}

export interface WorkoutSet {
  id: string
  workout_id: string
  exercise_id: string
  position: number
  /** null = jusqu'à l'échec. */
  target_reps: number | null
  target_reps_max?: number | null
  /** Type de série ; absent = série de travail (séances antérieures aux méthodes). */
  kind?: SetKind
  reps: number
  weight: number
  done: boolean
  updated_at?: string
}

export const DEFAULT_FICHE = { current_weight: 0, sets: 3, target_reps: 10, increment: 2.5 } as const

/** Jours d'entraînement de l'utilisateur (1 = lundi … 7 = dimanche) ; id = user_id. */
export interface TrainingSchedule {
  id: string
  user_id: string
  weekdays: number[]
  /** Date d'activation du calendrier : aucun jour avant n'est « manqué ». */
  since: string
  updated_at?: string
}

/** Exception sur une date : séance ajoutée (`train`) ou jour passé en repos (`rest`, éventuellement reporté). */
export interface ScheduleOverride {
  id: string
  user_id: string
  date: string
  kind: 'train' | 'rest'
  moved_to: string | null
  updated_at?: string
}

/** Objectif de séances d'une semaine précise (week_start = lundi). */
export interface WeeklyGoal {
  id: string
  user_id: string
  week_start: string
  sessions: number
  updated_at?: string
}

export type Sex = 'male' | 'female' | 'unspecified'
export type Activity = 'sedentary' | 'light' | 'active' | 'very_active'
export type Goal = 'bulk' | 'cut' | 'maintain' | 'recomp' | 'strength'

/** Fiche personnelle privée ; id = user_id. Le poids vient de la dernière pesée. */
export interface BodyProfile {
  id: string
  user_id: string
  sex: Sex | null
  birth_date: string | null
  height_cm: number | null
  activity: Activity | null
  sessions_per_week: number | null
  goal: Goal | null
  /** Réglages manuels : null = valeur conseillée. */
  kcal_override: number | null
  protein_per_kg: number | null
  fat_pct: number | null
  updated_at?: string
}

/** Une pesée par jour au plus. */
export interface WeightEntry {
  id: string
  user_id: string
  date: string
  weight_kg: number
  updated_at?: string
}

/** Règles notées (privé) : `days` jours à partir de `start`. */
export interface Period {
  id: string
  user_id: string
  start: string
  days: number
  updated_at?: string
}

/** Séance allégée (privée, contrairement à la séance que les amis peuvent voir) ; id = id de la séance. */
export interface WorkoutLightening {
  id: string
  user_id: string
  mode: Lightening
  updated_at?: string
}

/** Allègement d'une séance : charges −10 % / −20 %, ou 2 séries de travail par exercice. */
export type Lightening = 'minus10' | 'minus20' | 'fewer'

/** Défi personnel ou objectif de séances d'un mois (`month`, une ligne par mois modifié). */
export interface Challenge {
  id: string
  user_id: string
  kind: 'month' | 'sessions' | 'lift'
  exercise_id: string | null
  metric: 'weight' | 'e1rm' | null
  /** Séances, ou kg pour un défi de charge. */
  target: number
  start: string
  end_date: string
  updated_at?: string
}
