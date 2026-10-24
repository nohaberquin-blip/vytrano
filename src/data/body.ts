import type { BodyProfile, WeightEntry } from '../domain/types'
import { stableId } from './calendar'
import { db } from './db'
import { repo } from './repo'

const EMPTY: Omit<BodyProfile, 'id' | 'user_id'> = {
  sex: null, birth_date: null, height_cm: null, activity: null, sessions_per_week: null, goal: null,
  kcal_override: null, protein_per_kg: null, fat_pct: null,
}

export const getBodyProfile = (userId: string): Promise<BodyProfile | undefined> => db.body_profiles.get(userId)

/** Enregistre les champs donnés en gardant les autres. */
export async function saveBodyProfile(userId: string, changes: Partial<Omit<BodyProfile, 'id' | 'user_id'>>): Promise<void> {
  const existing = await getBodyProfile(userId)
  await repo.put<BodyProfile>('body_profiles', { ...EMPTY, ...existing, ...changes, id: userId, user_id: userId })
}

/** Une pesée par jour (id fixe) : une nouvelle pesée le même jour remplace l'ancienne. */
export async function addWeight(userId: string, date: string, weightKg: number): Promise<void> {
  await repo.put<WeightEntry>('weight_entries', { id: stableId(userId, 'weight', date), user_id: userId, date, weight_kg: weightKg })
}

export const removeWeight = (id: string) => repo.remove('weight_entries', id)

export async function listWeights(userId: string): Promise<WeightEntry[]> {
  const all = await db.weight_entries.where('user_id').equals(userId).toArray()
  return all.sort((a, b) => a.date.localeCompare(b.date))
}

export async function latestWeight(userId: string): Promise<WeightEntry | undefined> {
  return (await listWeights(userId)).at(-1)
}
