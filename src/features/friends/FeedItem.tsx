import { useState } from 'react'
import type { FeedEntry } from '../../data/social'

export function timeAgo(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (min < 60) return `il y a ${Math.max(min, 1)} min`
  const h = Math.round(min / 60)
  if (h < 24) return `il y a ${h} h`
  const d = Math.round(h / 24)
  if (d < 7) return `il y a ${d} j`
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export function Avatar({ name }: { name: string }) {
  return <span className="avatar" aria-hidden>{name.slice(0, 1).toUpperCase()}</span>
}

export function FeedItem({ entry, onReact, onOpen }: {
  entry: FeedEntry
  onReact(workoutId: string, reacted: boolean): Promise<{ error: unknown }>
  onOpen(): void
}) {
  const [reacted, setReacted] = useState(entry.reacted_by_me)
  const [count, setCount] = useState(entry.reaction_count)

  async function react() {
    const next = !reacted
    setReacted(next)
    setCount((c) => c + (next ? 1 : -1))
    const { error } = await onReact(entry.id, next)
    if (error) {
      setReacted(!next)
      setCount((c) => c - (next ? 1 : -1))
    }
  }

  return (
    <article className="card">
      <div className="row">
        <Avatar name={entry.username} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong>{entry.username}</strong>
          <div className="muted small">{timeAgo(entry.finished_at)}</div>
        </div>
      </div>
      <button className="list-item" style={{ marginTop: 10, marginBottom: 8 }} onClick={onOpen}>
        <span>
          <strong>{entry.day_name}</strong><br />
          <span className="muted small">{entry.exercise_count} exercice{entry.exercise_count > 1 ? 's' : ''} · {entry.duration_min} min</span>
        </span>
        <span className="muted">›</span>
      </button>
      <button className={reacted ? 'btn react on' : 'btn react'} aria-pressed={reacted} onClick={react}>
        💪 {count}
      </button>
    </article>
  )
}
