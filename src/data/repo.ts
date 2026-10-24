import { db, type SyncedTable } from './db'
import { supabase } from './supabase'
import { DEFAULT_FICHE, type UserExercise } from '../domain/types'

type Row = { id: string; updated_at?: string }

let currentUser: string | null = null
/** Appelé par l'authentification : les écritures sont rattachées à cet utilisateur. */
export function setCurrentUser(id: string | null) { currentUser = id }
export const getCurrentUser = () => currentUser

/** Colonnes gérées uniquement par le serveur : jamais renvoyées par le client. */
const SERVER_OWNED: Partial<Record<SyncedTable, string[]>> = { programs: ['share_code'] }

function outboxRow(table: SyncedTable, row: Record<string, unknown>) {
  const out = { ...row }
  for (const col of SERVER_OWNED[table] ?? []) delete out[col]
  return out
}

/** Toute écriture utilisateur passe par ici : base locale d'abord, puis file d'envoi. */
export const repo = {
  async put<T extends Row>(table: SyncedTable, row: T): Promise<T> {
    const stamped = { ...row, updated_at: new Date().toISOString() }
    await db.transaction('rw', db.table(table), db.outbox, async () => {
      await db.table(table).put(stamped)
      // Une écriture déjà en attente est mise à jour sur place : l'ordre d'envoi
      // (parent avant enfant) reste celui de la première écriture.
      const pending = await db.outbox
        .where('[table+key]').equals([table, row.id])
        .filter((e) => e.op === 'upsert' && !e.dead)
        .first()
      const sent = outboxRow(table, stamped)
      if (pending) await db.outbox.update(pending.seq!, { row: sent })
      else await db.outbox.add({ table, op: 'upsert', key: row.id, row: sent, attempts: 0, dead: 0, user_id: currentUser })
    })
    return stamped
  },

  async remove(table: SyncedTable, id: string): Promise<void> {
    await db.transaction('rw', db.table(table), db.outbox, async () => {
      await db.table(table).delete(id)
      await db.outbox.add({ table, op: 'delete', key: id, row: { id }, attempts: 0, dead: 0, user_id: currentUser })
    })
  },
}

export interface PullSource {
  fetch(table: SyncedTable, userId: string, parentIds?: string[]): Promise<Row[]>
}

const NUMERIC: Partial<Record<SyncedTable, string[]>> = {
  user_exercises: ['current_weight', 'increment', 'rounding'],
  workout_sets: ['weight'],
  body_profiles: ['height_cm', 'protein_per_kg'],
  weight_entries: ['weight_kg'],
}

/** Ordre parent → enfant : les enfants sont chargés à partir des ids de leurs parents. */
const PULL_ORDER: Array<{ table: SyncedTable; parent?: SyncedTable }> = [
  { table: 'exercises' },
  { table: 'user_exercises' },
  { table: 'programs' },
  { table: 'program_days', parent: 'programs' },
  { table: 'program_day_exercises', parent: 'program_days' },
  { table: 'workouts' },
  { table: 'workout_sets', parent: 'workouts' },
  { table: 'training_schedules' },
  { table: 'schedule_overrides' },
  { table: 'weekly_goals' },
  { table: 'body_profiles' },
  { table: 'weight_entries' },
  { table: 'periods' },
]

/** Recopie les données serveur de l'utilisateur dans la base locale, sans écraser les écritures en attente. */
export async function pull(userId: string, source: PullSource = supabaseSource): Promise<void> {
  // Une ligne écrite après le début du pull peut manquer dans la réponse du serveur
  // tout en étant déjà sortie de l'outbox : on ne la supprime pas.
  const startedAt = Date.now()
  const ids: Partial<Record<SyncedTable, string[]>> = {}
  for (const { table, parent } of PULL_ORDER) {
    const remote = await source.fetch(table, userId, parent ? ids[parent] ?? [] : undefined)
    for (const col of NUMERIC[table] ?? []) {
      for (const r of remote as Record<string, unknown>[]) if (r[col] != null) r[col] = Number(r[col])
    }
    ids[table] = remote.map((r) => r.id)
    await db.transaction('rw', db.table(table), db.outbox, async () => {
      // Entrées en attente ET refusées : la copie locale est alors la seule qui existe.
      const pendingKeys = new Set(
        (await db.outbox.filter((e) => e.table === table).toArray()).map((e) => e.key),
      )
      const remoteIds = new Set(remote.map((r) => r.id))
      const local = (await db.table(table).toArray()) as Row[]
      const localById = new Map(local.map((r) => [r.id, r]))
      const toPut = remote.filter((r) => {
        if (pendingKeys.has(r.id)) return false
        const l = localById.get(r.id)
        return !l || !l.updated_at || !r.updated_at || Date.parse(r.updated_at) >= Date.parse(l.updated_at)
      })
      const toDelete = local
        .filter((l) => !remoteIds.has(l.id) && !pendingKeys.has(l.id))
        .filter((l) => !l.updated_at || Date.parse(l.updated_at) < startedAt)
        .map((l) => l.id)
      await db.table(table).bulkPut(toPut)
      await db.table(table).bulkDelete(toDelete)
    })
  }
}

const OWNER_COL: Partial<Record<SyncedTable, string>> = {
  user_exercises: 'user_id', programs: 'owner_id', workouts: 'user_id',
  training_schedules: 'user_id', schedule_overrides: 'user_id', weekly_goals: 'user_id',
  body_profiles: 'user_id', weight_entries: 'user_id', periods: 'user_id',
}
const PARENT_COL: Partial<Record<SyncedTable, string>> = {
  program_days: 'program_id', program_day_exercises: 'day_id', workout_sets: 'workout_id',
}

const supabaseSource: PullSource = {
  async fetch(table, userId, parentIds) {
    if (table === 'exercises') {
      // Catalogue commun : les exercices de tout le monde.
      const { data, error } = await supabase.from('exercises').select('*')
      if (error) throw error
      return data
    }
    if (parentIds) {
      const out: Row[] = []
      for (let i = 0; i < parentIds.length; i += 200) {
        const { data, error } = await supabase.from(table).select('*').in(PARENT_COL[table]!, parentIds.slice(i, i + 200))
        if (error) throw error
        out.push(...data)
      }
      return out
    }
    const { data, error } = await supabase.from(table).select('*').eq(OWNER_COL[table]!, userId)
    if (error) throw error
    return data
  },
}

/** Fiche de l'utilisateur pour un exercice, créée avec les valeurs par défaut si absente. */
export async function ensureFiche(userId: string, exerciseId: string): Promise<UserExercise> {
  const existing = await db.user_exercises.where('exercise_id').equals(exerciseId).filter((f) => f.user_id === userId).first()
  if (existing) return existing
  return repo.put('user_exercises', { id: crypto.randomUUID(), user_id: userId, exercise_id: exerciseId, ...DEFAULT_FICHE })
}
