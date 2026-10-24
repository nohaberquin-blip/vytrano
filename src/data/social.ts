import type { Profile } from '../domain/types'
import { supabase } from './supabase'

/** Fonctions sociales : appels réseau directs, rien n'est mis en file hors ligne. */

export interface FeedEntry {
  id: string
  user_id: string
  username: string
  display_name: string | null
  day_name: string
  started_at: string
  finished_at: string
  exercise_count: number
  duration_min: number
  reaction_count: number
  reacted_by_me: boolean
}

const FEED_CACHE = 'muscu.feed'
export const FEED_PAGE = 20

/** Le cache est rattaché à un utilisateur : sur un appareil partagé, personne ne voit le fil d'un autre. */
export function cachedFeed(userId: string): FeedEntry[] {
  try {
    const cached = JSON.parse(localStorage.getItem(FEED_CACHE) ?? 'null') as { user_id: string; entries: FeedEntry[] } | null
    return cached?.user_id === userId ? cached.entries : []
  } catch {
    return []
  }
}

export function storeFeed(userId: string, entries: FeedEntry[]) {
  try { localStorage.setItem(FEED_CACHE, JSON.stringify({ user_id: userId, entries })) } catch { /* cache facultatif */ }
}

export async function fetchFeed(userId: string, before?: string): Promise<FeedEntry[]> {
  let q = supabase.from('friend_feed').select('*').order('finished_at', { ascending: false }).limit(FEED_PAGE)
  if (before) q = q.lt('finished_at', before)
  const { data, error } = await q
  if (error) throw error
  if (!before) storeFeed(userId, data as FeedEntry[])
  return data as FeedEntry[]
}

export async function toggleReaction(userId: string, workoutId: string, reacted: boolean) {
  const { error } = reacted
    ? await supabase.from('reactions').insert({ workout_id: workoutId, user_id: userId })
    : await supabase.from('reactions').delete().eq('workout_id', workoutId).eq('user_id', userId)
  return { error }
}

export async function searchProfiles(q: string): Promise<Profile[]> {
  const { data, error } = await supabase.rpc('search_profiles', { q })
  if (error) throw error
  return data as Profile[]
}

export async function sendRequest(userId: string, otherId: string) {
  const { error } = await supabase.from('friendships').insert({ requester_id: userId, addressee_id: otherId })
  return { error }
}

export async function respondRequest(friendshipId: string, accept: boolean) {
  const { error } = accept
    ? await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId)
    : await supabase.from('friendships').delete().eq('id', friendshipId)
  return { error }
}

export async function removeFriend(friendshipId: string) {
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId)
  return { error }
}

export interface Friendship {
  id: string
  status: 'pending' | 'accepted'
  other: Pick<Profile, 'user_id' | 'username' | 'display_name'>
}

export async function listFriendships(userId: string) {
  const { data, error } = await supabase.from('friendships').select('id, requester_id, addressee_id, status')
  if (error) throw error
  const otherIds = data.map((f) => (f.requester_id === userId ? f.addressee_id : f.requester_id))
  const { data: profiles, error: e2 } = otherIds.length
    ? await supabase.from('profiles').select('user_id, username, display_name').in('user_id', otherIds)
    : { data: [], error: null }
  if (e2) throw e2
  const byId = new Map((profiles ?? []).map((p) => [p.user_id, p]))
  const rows = data.map((f) => ({
    id: f.id as string,
    status: f.status as Friendship['status'],
    mine: f.requester_id === userId,
    other: byId.get(f.requester_id === userId ? f.addressee_id : f.requester_id) ?? { user_id: '', username: '?', display_name: null },
  }))
  return {
    incoming: rows.filter((r) => r.status === 'pending' && !r.mine),
    outgoing: rows.filter((r) => r.status === 'pending' && r.mine),
    friends: rows.filter((r) => r.status === 'accepted').sort((a, b) => a.other.username.localeCompare(b.other.username)),
  }
}

export async function countIncoming(userId: string): Promise<number> {
  const { count, error } = await supabase.from('friendships').select('id', { count: 'exact', head: true })
    .eq('addressee_id', userId).eq('status', 'pending')
  if (error) throw error
  return count ?? 0
}

export async function fetchWorkoutDetail(workoutId: string) {
  const { data: sets, error } = await supabase.from('workout_sets').select('*').eq('workout_id', workoutId).order('position')
  if (error) throw error
  const ids = [...new Set(sets.map((s) => s.exercise_id as string))]
  const { data: exercises, error: e2 } = ids.length
    ? await supabase.from('exercises').select('id, name').in('id', ids)
    : { data: [], error: null }
  if (e2) throw e2
  const names = new Map((exercises ?? []).map((e) => [e.id, e.name as string]))
  return ids.map((id) => ({
    exerciseId: id,
    name: names.get(id) ?? 'Exercice',
    sets: sets.filter((s) => s.exercise_id === id && s.done).map((s) => ({ reps: s.reps as number, weight: Number(s.weight) })),
  }))
}
