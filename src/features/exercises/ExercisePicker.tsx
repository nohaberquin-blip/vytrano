import { useState } from 'react'
import { db } from '../../data/db'
import { repo } from '../../data/repo'
import { useLive } from '../../data/useLive'
import type { Exercise } from '../../domain/types'
import { useUserId } from '../auth/AuthProvider'

export const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export function ExercisePicker({ onPick, exclude = [] }: { onPick(e: Exercise): void; exclude?: string[] }) {
  const userId = useUserId()
  const [q, setQ] = useState('')
  const all = useLive(() => db.exercises.toArray(), []) ?? []
  const nq = normalize(q)
  const matches = all
    .filter((e) => (e.owner_id === null || e.owner_id === userId) && !exclude.includes(e.id))
    .filter((e) => !nq || normalize(e.name).includes(nq) || normalize(e.muscle_group ?? '').includes(nq))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  const exact = all.some((e) => normalize(e.name) === nq && (e.owner_id === null || e.owner_id === userId))

  async function create() {
    const ex = await repo.put<Exercise>('exercises', { id: crypto.randomUUID(), owner_id: userId, name: q.trim(), muscle_group: null })
    onPick(ex)
  }

  return (
    <div>
      <input className="input" placeholder="Rechercher un exercice" aria-label="Rechercher un exercice" value={q}
        onChange={(e) => setQ(e.target.value)} autoFocus />
      <ul className="list" style={{ marginTop: 10 }}>
        {nq && !exact && q.trim().length <= 60 && (
          <li><button className="list-item" onClick={create}><strong>Créer « {q.trim()} »</strong><span>＋</span></button></li>
        )}
        {matches.map((e) => (
          <li key={e.id}>
            <button className="list-item" onClick={() => onPick(e)}>
              <span>{e.name}</span><span className="muted small">{e.muscle_group ?? 'Perso'}</span>
            </button>
          </li>
        ))}
      </ul>
      {all.length === 0 && <p className="empty">Catalogue pas encore chargé. Connecte-toi à internet une première fois.</p>}
    </div>
  )
}
