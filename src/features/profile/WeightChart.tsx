import { useUnit } from '../../app/units'
import { addDays, noon } from '../../domain/calendar'
import { rollingAverage } from '../../domain/needs'
import type { WeightEntry } from '../../domain/types'
import { formatWeight } from '../../domain/parseWeight'

const W = 320
const H = 160
const PAD = { left: 40, right: 8, top: 10, bottom: 22 }
const dayNum = (date: string) => Math.round(noon(date).getTime() / 86_400_000)
const short = (date: string) => noon(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

/** Pesées (points) et moyenne sur 7 jours (ligne) entre `from` et `today` ; `from` null = depuis la première. */
export function WeightChart({ entries, from, today }: { entries: WeightEntry[]; from: string | null; today: string }) {
  const { toDisplay } = useUnit()
  const avg = rollingAverage(entries)
  const start = from ?? entries[0]?.date ?? today
  const inRange = (d: string) => d >= start && d <= today
  const points = entries.filter((e) => inRange(e.date))
  const line = avg.filter((a) => inRange(a.date))

  if (points.length === 0) {
    return <p className="muted small" role="img" aria-label="Courbe du poids" data-points="0">Aucune pesée sur cette période.</p>
  }
  const values = [...points.map((p) => toDisplay(p.weight_kg)), ...line.map((a) => toDisplay(a.avg))]
  const lo = Math.floor(Math.min(...values) - 1)
  const hi = Math.ceil(Math.max(...values) + 1)
  const span = Math.max(1, dayNum(today) - dayNum(start))
  const x = (d: string) => PAD.left + ((dayNum(d) - dayNum(start)) / span) * (W - PAD.left - PAD.right)
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom)

  return (
    <svg className="weight-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Courbe du poids" data-points={points.length}>
      <line className="axis" x1={PAD.left} x2={W - PAD.right} y1={y(lo)} y2={y(lo)} />
      <line className="axis" x1={PAD.left} x2={W - PAD.right} y1={y(hi)} y2={y(hi)} />
      <text className="label" x={PAD.left - 6} y={y(hi) + 4} textAnchor="end">{formatWeight(hi)}</text>
      <text className="label" x={PAD.left - 6} y={y(lo) + 4} textAnchor="end">{formatWeight(lo)}</text>
      <text className="label" x={PAD.left} y={H - 4}>{short(start)}</text>
      <text className="label" x={W - PAD.right} y={H - 4} textAnchor="end">{short(today)}</text>
      {line.length > 1 && (
        <polyline className="avg" points={line.map((a) => `${x(a.date)},${y(toDisplay(a.avg))}`).join(' ')} />
      )}
      {points.map((p) => <circle key={p.id} className="dot" cx={x(p.date)} cy={y(toDisplay(p.weight_kg))} r={3} />)}
    </svg>
  )
}

export const PERIODS = [
  { label: '1 mois', days: 30 },
  { label: '3 mois', days: 90 },
  { label: '1 an', days: 365 },
  { label: 'Tout', days: null },
] as const

export const periodStart = (today: string, days: number | null) => (days === null ? null : addDays(today, -days))
