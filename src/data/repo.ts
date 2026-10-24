import { db, type SyncedTable } from './db'
import { supabase } from './supabase'
import { DEFAULT_FICHE, type UserExercise } from '../domain/types'

type Row = { id: string; updated_at?: string }

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
      if (pending) await db.outbox.update(pending.seq!, { row: stamped })
      else await db.outbox.add({ table, op: 'upsert', key: row.id, row: stamped, attempts: 0, dead: 0 })
    })
    return stamped
  },

  async remove(table: SyncedTable, id: string): Promise<void> {
    await db.transaction('rw', db.table(table), db.outbox, async () => {
      await db.table(table).delete(id)
      await db.outbox.add({ table, op: 'delete', key: id, row: { id }, attempts: 0, dead: 0 })
    })
  },
}

export interface PullSource {
  fetch(table: SyncedTable, userId: string, parentIds?: string[]): Promise<Row[]>
}

const NUMERIC: Partial<Record<SyncedTable, string[]>> = {
  user_exercises: ['current_weight', 'increment'],
  workout_sets: ['weight'],
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
]

/** Recopie les données serveur de l'utilisateur dans la base locale, sans écraser les écritures en attente. */
export async function pull(userId: string, source: PullSource = supabaseSource): Promise<void> {
  const ids: Partial<Record<SyncedTable, string[]>> = {}
  for (const { table, parent } of PULL_ORDER) {
    const remote = await source.fetch(table, userId, parent ? ids[parent] ?? [] : undefined)
    for (const col of NUMERIC[table] ?? []) {
      for (const r of remote as Record<string, unknown>[]) r[col] = Number(r[col])
    }
    ids[table] = remote.map((r) => r.id)
    await db.transaction('rw', db.table(table), db.outbox, async () => {
      const pendingKeys = new Set(
        (await db.outbox.where('dead').equals(0).filter((e) => e.table === table).toArray()).map((e) => e.key),
      )
      const remoteIds = new Set(remote.map((r) => r.id))
      const local = (await db.table(table).toArray()) as Row[]
      const localById = new Map(local.map((r) => [r.id, r]))
      const toPut = remote.filter((r) => {
        if (pendingKeys.has(r.id)) return false
        const l = localById.get(r.id)
        return !l || !l.updated_at || !r.updated_at || r.updated_at >= l.updated_at
      })
      // Les exercices du catalogue partagé ne sont jamais supprimés localement par erreur :
      // seules les lignes de l'utilisateur absentes du serveur le sont.
      const toDelete = local
        .filter((l) => !remoteIds.has(l.id) && !pendingKeys.has(l.id))
        .map((l) => l.id)
      await db.table(table).bulkPut(toPut)
      await db.table(table).bulkDelete(toDelete)
    })
  }
}

const OWNER_COL: Partial<Record<SyncedTable, string>> = {
  user_exercises: 'user_id', programs: 'owner_id', workouts: 'user_id',
}
const PARENT_COL: Partial<Record<SyncedTable, string>> = {
  program_days: 'program_id', program_day_exercises: 'day_id', workout_sets: 'workout_id',
}

const supabaseSource: PullSource = {
  async fetch(table, userId, parentIds) {
    if (table === 'exercises') {
      const { data, error } = await supabase.from('exercises').select('*').or(`owner_id.is.null,owner_id.eq.${userId}`)
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
