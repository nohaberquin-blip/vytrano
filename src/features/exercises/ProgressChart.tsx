import { useUnit } from '../../app/units'
import { noon } from '../../domain/calendar'
import { formatWeight } from '../../domain/parseWeight'
import type { Point } from '../../domain/records'

const W = 320
const H = 160
const PAD = { left: 40, right: 8, top: 10, bottom: 22 }
const dayNum = (date: string) => Math.round(noon(date).getTime() / 86_400_000)
const short = (date: string) => noon(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

/** Un point par séance (1RM estimé ou charge max), reliés ; les séances records en couleur d'accent. */
export function ProgressChart({ points, metric }: { points: Point[]; metric: 'e1rm' | 'weight' }) {
  const { toDisplay } = useUnit()
  const values = points.map((p) => toDisplay(p[metric]))
  const lo = Math.floor(Math.min(...values) - 2)
  const hi = Math.ceil(Math.max(...values) + 2)
  const first = points[0].date
  const last = points[points.length - 1].date
  const span = Math.max(1, dayNum(last) - dayNum(first))
  const x = (d: string) => PAD.left + ((dayNum(d) - dayNum(first)) / span) * (W - PAD.left - PAD.right)
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom)
  return (
    <svg className="weight-chart progress-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Courbe de progression"
      data-points={points.length} data-records={points.filter((p) => p.record).length}>
      <line className="axis" x1={PAD.left} x2={W - PAD.right} y1={y(lo)} y2={y(lo)} />
      <line className="axis" x1={PAD.left} x2={W - PAD.right} y1={y(hi)} y2={y(hi)} />
      <text className="label" x={PAD.left - 6} y={y(hi) + 4} textAnchor="end">{formatWeight(hi)}</text>
      <text className="label" x={PAD.left - 6} y={y(lo) + 4} textAnchor="end">{formatWeight(lo)}</text>
      <text className="label" x={PAD.left} y={H - 4}>{short(first)}</text>
      <text className="label" x={W - PAD.right} y={H - 4} textAnchor="end">{short(last)}</text>
      <polyline className="avg" points={points.map((p) => `${x(p.date)},${y(toDisplay(p[metric]))}`).join(' ')} />
      {points.map((p) => (
        <circle key={p.date} className={p.record ? 'dot record' : 'dot'} cx={x(p.date)} cy={y(toDisplay(p[metric]))} r={p.record ? 4.5 : 3} />
      ))}
    </svg>
  )
}
