import { useLiveQuery } from 'dexie-react-hooks'
import { db, type OutboxEntry, type SyncedTable } from './db'
import { supabase } from './supabase'
import { getCurrentUser } from './repo'

type SyncError = { message: string; code?: string } | null

export interface SyncClient {
  upsert(table: SyncedTable, rows: Record<string, unknown>[]): Promise<{ error: SyncError }>
  delete(table: SyncedTable, ids: string[]): Promise<{ error: SyncError }>
}

/**
 * Codes Postgres d'erreurs qui ne disparaîtront pas en réessayant (contraintes, types, schéma).
 * 42501 (RLS) n'en fait pas partie : il apparaît aussi quand la session a expiré.
 */
const isPermanent = (e: NonNullable<SyncError>) => !!e.code && e.code !== '42501' && /^(22|23|42)/.test(e.code)

export function createSync(client: SyncClient) {
  let running: Promise<void> | null = null
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let kickTimer: ReturnType<typeof setTimeout> | undefined

  let stopped = false

  async function flushOnce(): Promise<boolean> {
    const userId = getCurrentUser()
    if (!userId) return true
    for (;;) {
      // Arrêt, déconnexion ou changement de compte : on ne continue pas avec une autre session.
      if (stopped || getCurrentUser() !== userId) return true
      const entries = await db.outbox.where('dead').equals(0).filter((e) => e.user_id === userId).sortBy('seq')
      if (entries.length === 0) return true
      // Lot = entrées consécutives de même table et même opération.
      const batch: OutboxEntry[] = [entries[0]]
      for (const e of entries.slice(1)) {
        if (e.table !== batch[0].table || e.op !== batch[0].op || batch.length >= 100) break
        batch.push(e)
      }
      const { table, op } = batch[0]
      const { error } = op === 'upsert'
        ? await client.upsert(table, batch.map((e) => e.row))
        : await client.delete(table, batch.map((e) => e.key))
      const seqs = batch.map((e) => e.seq!)
      if (!error) {
        await db.outbox.bulkDelete(seqs)
      } else if (isPermanent(error) && batch.length > 1) {
        // On réessaie un par un pour isoler la ligne fautive.
        for (const e of batch) {
          const r = op === 'upsert' ? await client.upsert(table, [e.row]) : await client.delete(table, [e.key])
          if (!r.error) await db.outbox.delete(e.seq!)
          else if (isPermanent(r.error)) await db.outbox.update(e.seq!, { dead: 1 })
          else { await db.outbox.update(e.seq!, { attempts: e.attempts + 1 }); return false }
        }
      } else if (isPermanent(error)) {
        console.error('Synchronisation refusée', table, error)
        await db.outbox.update(seqs[0], { dead: 1 })
      } else {
        await db.outbox.bulkUpdate(seqs.map((s, i) => ({ key: s, changes: { attempts: batch[i].attempts + 1 } })))
        return false
      }
    }
  }

  async function flush(): Promise<void> {
    if (running) return running
    running = (async () => {
      const ok = await flushOnce().catch(() => false)
      clearTimeout(retryTimer)
      if (!ok) {
        const uid = getCurrentUser()
        const first = await db.outbox.where('dead').equals(0).filter((e) => e.user_id === uid).first()
        if (!first) return
        const delay = Math.min(2 ** (first?.attempts ?? 1), 60) * 1000
        retryTimer = setTimeout(() => void flush(), delay)
      }
    })().finally(() => { running = null })
    return running
  }

  function kick() {
    clearTimeout(kickTimer)
    kickTimer = setTimeout(() => void flush(), 300)
  }
  // Seule une nouvelle valeur de ligne relance l'envoi ; pas les compteurs mis à jour par flush lui-même.
  const onUpdating = (mods: object) => { if ('row' in mods) kick() }

  /** Lance la synchronisation en continu ; renvoie la fonction d'arrêt. */
  function start(): () => void {
    stopped = false
    const onOnline = () => void flush()
    window.addEventListener('online', onOnline)
    db.outbox.hook('creating', kick)
    db.outbox.hook('updating', onUpdating)
    void flush()
    return () => {
      stopped = true
      window.removeEventListener('online', onOnline)
      db.outbox.hook('creating').unsubscribe(kick)
      db.outbox.hook('updating').unsubscribe(onUpdating)
      clearTimeout(retryTimer)
      clearTimeout(kickTimer)
    }
  }

  return { flush, start }
}

export const supabaseSyncClient: SyncClient = {
  async upsert(table, rows) {
    const { error } = await supabase.from(table).upsert(rows)
    return { error }
  },
  async delete(table, ids) {
    const { error } = await supabase.from(table).delete().in('id', ids)
    return { error }
  },
}

export function useSyncStatus(): { pending: number; failed: number } {
  const uid = getCurrentUser()
  return useLiveQuery(
    async () => ({
      pending: await db.outbox.where('dead').equals(0).filter((e) => e.user_id === uid).count(),
      failed: await db.outbox.where('dead').equals(1).filter((e) => e.user_id === uid).count(),
    }),
    [],
    { pending: 0, failed: 0 },
  )
}
