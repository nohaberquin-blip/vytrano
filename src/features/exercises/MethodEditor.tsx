import { useUnit } from '../../app/units'
import {
  ATTACHED_KINDS, KIND_LABELS, METHOD_LABELS, PRESET_IDS, SET_KINDS, hasWarmup, plannedWeight, presetTemplate,
  templateError, withWarmup, withoutWarmup, type PlannedSet, type PresetId, type SetTemplate,
} from '../../domain/methods'

const toInt = (s: string) => (s.trim() === '' ? null : Number.parseInt(s, 10) || 0)

/** Choix d'une méthode puis réglage série par série (type, reps ou « échec », max, % de la référence). */
export function MethodEditor({ value, reference, rounding, onChange }: {
  value: SetTemplate
  /** Charge de référence (kg), pour l'aperçu des charges. */
  reference: number
  rounding?: number
  onChange(t: SetTemplate): void
}) {
  const { show } = useUnit()
  const warmup = hasWarmup(value)
  const error = templateError(value)

  function choose(method: PresetId) {
    const t = presetTemplate(method)
    onChange(warmup ? withWarmup(t) : t)
  }

  const editSets = (sets: PlannedSet[]) => onChange({ method: 'custom', sets })
  const editSet = (i: number, patch: Partial<PlannedSet>) =>
    editSets(value.sets.map((s, j) => {
      if (j !== i) return s
      const next = { ...s, ...patch }
      if (next.repsMax === undefined) delete next.repsMax
      return next
    }))

  return (
    <div className="method-editor">
      <label className="field"><span>Méthode</span>
        <select aria-label="Méthode" className="input" value={value.method}
          onChange={(e) => e.target.value !== 'custom' && choose(e.target.value as PresetId)}>
          {PRESET_IDS.map((id) => <option key={id} value={id}>{METHOD_LABELS[id]}</option>)}
          {value.method === 'custom' && <option value="custom">{METHOD_LABELS.custom}</option>}
        </select>
      </label>
      <label className="switch">
        <span>Échauffement</span>
        <input type="checkbox" checked={warmup}
          onChange={(e) => onChange(e.target.checked ? withWarmup(value) : withoutWarmup(value))} />
      </label>

      <div className="planned-head muted small" aria-hidden>
        <span>Type</span><span>Reps</span><span>Max</span><span>%</span><span>Charge</span><span />
      </div>
      {value.sets.map((s, i) => (
        <div key={i} className={ATTACHED_KINDS.includes(s.kind) && s.kind !== 'cluster' ? 'planned-row attached' : 'planned-row'}>
          <select aria-label={`Type série ${i + 1}`} className="input" value={s.kind}
            onChange={(e) => editSet(i, { kind: e.target.value as PlannedSet['kind'] })}>
            {SET_KINDS.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
          </select>
          <input aria-label={`Reps série ${i + 1}`} className="input num" inputMode="numeric" placeholder="échec"
            value={s.reps ?? ''} onChange={(e) => editSet(i, { reps: toInt(e.target.value) })} />
          <input aria-label={`Max série ${i + 1}`} className="input num" inputMode="numeric" placeholder="–"
            value={s.repsMax ?? ''} onChange={(e) => editSet(i, { repsMax: toInt(e.target.value) ?? undefined })} />
          <input aria-label={`% série ${i + 1}`} className="input num" inputMode="numeric"
            value={s.pct} onChange={(e) => editSet(i, { pct: toInt(e.target.value) ?? 0 })} />
          <span className="num small">{show(plannedWeight(reference, s.pct, rounding))}</span>
          <button className="btn ghost icon" aria-label={`Retirer la série ${i + 1}`}
            onClick={() => editSets(value.sets.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn ghost small" onClick={() => editSets([...value.sets, { ...value.sets[value.sets.length - 1] ?? { kind: 'work', reps: 8, pct: 100 } }])}>
        ＋ Série
      </button>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  )
}
