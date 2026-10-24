import { useState } from 'react'
import { Sheet } from '../../app/Sheet'
import { saveBodyProfile } from '../../data/body'
import { toISODate } from '../../domain/calendar'
import { DEFAULT_FAT_PCT, GOALS, computeNeeds } from '../../domain/needs'
import type { BodyProfile } from '../../domain/types'
import { useUserId } from '../auth/AuthProvider'
import { fmtInt, parseNumber, rangeError } from './numberField'

const show = (n: number | null) => (n === null ? '' : String(n).replace('.', ','))

/** Réglage manuel des calories, protéines (g/kg) et lipides (%) ; les glucides prennent le reste. */
export function AdjustSheet({ profile, weightKg, onClose }: { profile: BodyProfile | undefined; weightKg: number; onClose(): void }) {
  const userId = useUserId()
  const [kcal, setKcal] = useState(show(profile?.kcal_override ?? null))
  const [protein, setProtein] = useState(show(profile?.protein_per_kg ?? null))
  const [fat, setFat] = useState(show(profile?.fat_pct ?? null))

  const values = { kcal_override: parseNumber(kcal), protein_per_kg: parseNumber(protein), fat_pct: parseNumber(fat) }
  const errors = [
    rangeError(values.kcal_override, 1000, 6000, 'Calories : 1 000 à 6 000'),
    rangeError(values.protein_per_kg, 1, 3, 'Protéines : 1 à 3 g/kg'),
    rangeError(values.fat_pct, 15, 40, 'Lipides : 15 à 40 %'),
  ].filter(Boolean)
  const base = profile ?? { id: userId, user_id: userId, sex: null, birth_date: null, height_cm: null, activity: null, sessions_per_week: null, goal: null, kcal_override: null, protein_per_kg: null, fat_pct: null }
  const preview = errors.length ? null : computeNeeds({ ...base, ...values }, weightKg, toISODate(new Date()))

  async function save(changes: typeof values) {
    await saveBodyProfile(userId, changes)
    onClose()
  }

  return (
    <Sheet title="Ajuster mes besoins" onClose={onClose}>
      <label className="field"><span>Calories par jour</span>
        <input aria-label="Calories par jour" className="input num" inputMode="numeric" placeholder="Auto" value={kcal} onChange={(e) => setKcal(e.target.value)} />
      </label>
      <label className="field"><span>Protéines (g par kg)</span>
        <input aria-label="Protéines (g par kg)" className="input num" inputMode="decimal"
          placeholder={String(base.goal ? GOALS[base.goal].proteinPerKg : 1.6).replace('.', ',')} value={protein} onChange={(e) => setProtein(e.target.value)} />
      </label>
      <label className="field"><span>Lipides (% des calories)</span>
        <input aria-label="Lipides (% des calories)" className="input num" inputMode="numeric" placeholder={String(DEFAULT_FAT_PCT)} value={fat} onChange={(e) => setFat(e.target.value)} />
      </label>
      {errors.map((e) => <p key={e} className="error">{e}</p>)}
      {preview?.kcal != null && (
        <p className="banner num">
          {fmtInt(preview.kcal)} kcal · Protéines : {preview.protein} g · Lipides : {preview.fat} g · Glucides : {preview.carbs} g
        </p>
      )}
      <button className="btn primary block" disabled={errors.length > 0} onClick={() => save(values)}>Enregistrer</button>
      <button className="btn ghost block" style={{ marginTop: 8 }}
        onClick={() => save({ kcal_override: null, protein_per_kg: null, fat_pct: null })}>Revenir aux valeurs conseillées</button>
    </Sheet>
  )
}
