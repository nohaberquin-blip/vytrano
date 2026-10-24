import { useLiveQuery } from 'dexie-react-hooks'

/** Lecture réactive de la base locale : le composant se met à jour à chaque écriture. */
export function useLive<T>(query: () => Promise<T>, deps: unknown[]): T | undefined {
  return useLiveQuery(query, deps)
}
