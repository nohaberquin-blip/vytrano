import { PERIOD_DAYS } from '../domain/cycle'
import type { Period } from '../domain/types'
import { getBodyProfile } from './body'
import { stableId } from './calendar'
import { db } from './db'
import { repo } from './repo'

/** Règles notées, de la plus ancienne à la plus récente. */
export async function listPeriods(userId: string): Promise<Period[]> {
  const all = await db.periods.where('user_id').equals(userId).toArray()
  return all.sort((a, b) => a.start.localeCompare(b.start))
}

/** Un début par date (id fixe) : noter à nouveau le même jour remplace la durée. */
export async function startPeriod(userId: string, start: string, days: number = PERIOD_DAYS): Promise<void> {
  await repo.put<Period>('periods', { id: stableId('period', userId, start), user_id: userId, start, days })
}

export async function setPeriodDays(id: string, days: number): Promise<void> {
  const period = await db.periods.get(id)
  if (period) await repo.put<Period>('periods', { ...period, days })
}

export const removePeriod = (id: string) => repo.remove('periods', id)

/** Le mode règles n'existe que pour un profil « Femme ». */
export async function isFemale(userId: string): Promise<boolean> {
  return (await getBodyProfile(userId))?.sex === 'female'
}
