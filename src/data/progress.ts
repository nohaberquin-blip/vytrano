import { progress, type Progress } from '../domain/streak'
import type { Workout } from '../domain/types'
import { loadCalendarInput } from './calendar'
import { db } from './db'
import { updateProfile } from './profile'
import { supabase } from './supabase'

/**
 * Série, niveau et badges de l'utilisateur, recalculés depuis la base locale.
 * `finishing` : séance comptée comme terminée (pour connaître le gain avant de l'enregistrer).
 */
export async function loadProgress(userId: string, today: string, finishing?: Workout): Promise<Progress> {
  const done = await db.workouts.where('user_id').equals(userId).filter((w) => w.status === 'done' && w.id !== finishing?.id).toArray()
  const workouts = finishing ? [...done, { ...finishing, status: 'done' as const }] : done
  const input = await loadCalendarInput(userId, today)
  return progress(workouts, input && { ...input, workouts }, today)
}

export interface ProgressCard { level: number; title: string; streak: number; badges: string[] }

/** Résumé partagé avec les amis : jamais l'historique, seulement niveau, titre, série et badges (du plus ancien au plus récent). */
export const cardOf = (p: Progress): ProgressCard => ({
  level: p.level, title: p.title, streak: p.streak,
  badges: [...p.badges].sort((a, b) => a.date.localeCompare(b.date)).map((b) => b.id),
})

/** Écrit la carte sur le serveur (partage activé seulement ; le serveur refuse sinon). */
export async function publishCard(userId: string, p: Progress) {
  return supabase.from('progress_cards').upsert({ user_id: userId, ...cardOf(p), updated_at: new Date().toISOString() })
}

/** Publie la carte si elle a changé depuis la dernière publication réussie de cet appareil (`publish` : l'envoi, remplaçable). */
export async function refreshCard(userId: string, p: Progress, publish = publishCard): Promise<void> {
  if (!cardChanged(userId, p)) return
  const { error } = await publish(userId, p)
  if (!error) remember(userId, cardOf(p))
}

export async function removeCard(userId: string) {
  const res = await supabase.from('progress_cards').delete().eq('user_id', userId)
  if (!res.error) remember(userId, null)
  return res
}

/** Dernière carte publiée depuis cet appareil : on ne republie que ce qui a changé (série tombée à 0…). */
const cardKey = (userId: string) => `vytrano.card.${userId}`
function remember(userId: string, card: ProgressCard | null) {
  try {
    if (card) localStorage.setItem(cardKey(userId), JSON.stringify(card))
    else localStorage.removeItem(cardKey(userId))
  } catch { /* stockage indisponible : la carte sera republiée à chaque fois */ }
}
function cardChanged(userId: string, p: Progress): boolean {
  try { return localStorage.getItem(cardKey(userId)) !== JSON.stringify(cardOf(p)) } catch { return true }
}

/**
 * Partage du résumé avec les amis. Activer : le réglage puis la carte.
 * Désactiver : la carte d'abord (plus personne ne la voit), puis le réglage.
 */
export async function setShareProgress(userId: string, on: boolean, p: Progress): Promise<{ error: unknown }> {
  if (on) {
    const { error } = await updateProfile(userId, { share_progress: true })
    if (error) return { error }
    const res = await publishCard(userId, p)
    if (!res.error) remember(userId, cardOf(p))
    return { error: res.error }
  }
  const { error } = await removeCard(userId)
  if (error) return { error }
  return { error: (await updateProfile(userId, { share_progress: false })).error }
}

/** Cartes des amis qui partagent (les autres sont absents de la carte renvoyée). */
export async function fetchFriendCards(ids: string[]): Promise<Map<string, ProgressCard>> {
  if (ids.length === 0) return new Map()
  const { data, error } = await supabase.from('progress_cards').select('user_id, level, title, streak, badges').in('user_id', ids)
  if (error || !data) return new Map()
  return new Map((data as (ProgressCard & { user_id: string })[]).map(({ user_id, ...card }) => [user_id, card]))
}
