import { formatClock } from '../../domain/rest'
import type { RestTimer } from './useRestTimer'

/** Barre de repos fixée en bas de la séance : temps restant, série suivante, ajustements. */
export function RestBar({ rest, remaining, overtime, adjust, stop }: RestTimer) {
  if (!rest) return null
  const done = remaining === 0
  return (
    <div className={done ? 'rest-bar done' : 'rest-bar'} role="timer" aria-label="Repos">
      <div className="rest-progress" aria-hidden>
        <span style={{ width: `${done ? 0 : Math.min(100, (remaining / Math.max(1, rest.total)) * 100)}%` }} />
      </div>
      <div className="row between">
        <div style={{ minWidth: 0 }}>
          {done
            ? <p className="rest-time num">C'est reparti ! <span className="rest-over">+{formatClock(overtime)}</span></p>
            : <p className="rest-time num">{formatClock(remaining)}</p>}
          <p className="rest-next small">Ensuite : {rest.next}</p>
        </div>
        {done && <button className="btn" onClick={stop}>Fermer</button>}
      </div>
      {!done && (
        <div className="rest-actions">
          <button className="btn" onClick={() => adjust(-15)}>−15 s</button>
          <button className="btn" onClick={() => adjust(15)}>+15 s</button>
          <button className="btn" onClick={() => adjust(30)}>+30 s</button>
          <button className="btn" onClick={stop}>Passer</button>
        </div>
      )}
    </div>
  )
}
