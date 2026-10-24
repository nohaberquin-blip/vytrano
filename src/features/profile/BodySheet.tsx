import { useState } from 'react'
import { Sheet } from '../../app/Sheet'
import { saveBodyProfile } from '../../data/body'
import { toISODate } from '../../domain/calendar'
import { ACTIVITY_LABELS, GOALS, SEX_LABELS, ageOn } from '../../domain/needs'
import type { Activity, BodyProfile, Goal, Sex } from '../../domain/types'
import { useUserId } from '../auth/AuthProvider'
import { parseNumber, rangeError } from './numberField'

/** Fiche personnelle : sexe, naissance, taille, activité, séances par semaine, objectif. */
export function BodySheet({ profile, defaultSessions, onClose }: {
  profile: BodyProfile | undefined
  /** Jours cochés dans le calendrier, pour pré-remplir les séances. */
  defaultSessions: number | null
  onClose(): void
}) {
  const userId = useUserId()
  const [sex, setSex] = useState<Sex | ''>(profile?.sex ?? '')
  const [birth, setBirth] = useState(profile?.birth_date ?? '')
  const [height, setHeight] = useState(profile?.height_cm == null ? '' : String(profile.height_cm).replace('.', ','))
  const [activity, setActivity] = useState<Activity | ''>(profile?.activity ?? '')
  const [sessions, setSessions] = useState(String(profile?.sessions_per_week ?? defaultSessions ?? ''))
  const [goal, setGoal] = useState<Goal | ''>(profile?.goal ?? '')

  const today = toISODate(new Date())
  const age = /^\d{4}-\d{2}-\d{2}$/.test(birth) ? ageOn(birth, today) : null
  const heightCm = parseNumber(height)
  const sessionsN = parseNumber(sessions)
  const errors = {
    age: rangeError(age, 13, 100, 'Âge : 13 à 100 ans'),
    height: rangeError(heightCm, 120, 230, 'Taille : 120 à 230 cm'),
    sessions: rangeError(sessionsN, 0, 14, 'Séances : 0 à 14') ?? (sessionsN !== null && !Number.isInteger(sessionsN) ? 'Séances : 0 à 14' : null),
  }
  const invalid = Object.values(errors).some(Boolean)

  async function save() {
    await saveBodyProfile(userId, {
      sex: sex || null, birth_date: age === null ? null : birth, height_cm: heightCm, activity: activity || null,
      sessions_per_week: sessionsN, goal: goal || null,
    })
    onClose()
  }

  return (
    <Sheet title="Ma fiche" onClose={onClose}>
      <label className="field"><span>Sexe</span>
        <select aria-label="Sexe" className="input" value={sex} onChange={(e) => setSex(e.target.value as Sex | '')}>
          <option value="">—</option>
          {(Object.keys(SEX_LABELS) as Sex[]).map((s) => <option key={s} value={s}>{SEX_LABELS[s]}</option>)}
        </select>
      </label>
      <label className="field"><span>Date de naissance {age !== null && !errors.age && <>· <span className="muted">{`${age} ans`}</span></>}</span>
        <input aria-label="Date de naissance" className="input" type="date" max={today} value={birth} onChange={(e) => setBirth(e.target.value)} />
      </label>
      {errors.age && <p className="error">{errors.age}</p>}
      <label className="field"><span>Taille (cm)</span>
        <input aria-label="Taille (cm)" className="input num" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} />
      </label>
      {errors.height && <p className="error">{errors.height}</p>}
      <fieldset className="field choice-list">
        <legend>Activité au quotidien (hors musculation)</legend>
        {(Object.keys(ACTIVITY_LABELS) as Activity[]).map((a) => (
          <label key={a} className="choice">
            <input type="radio" name="activity" checked={activity === a} onChange={() => setActivity(a)} />
            <span><strong>{ACTIVITY_LABELS[a].label}</strong> <span className="muted small">{ACTIVITY_LABELS[a].hint}</span></span>
          </label>
        ))}
      </fieldset>
      <label className="field"><span>Séances par semaine</span>
        <input aria-label="Séances par semaine" className="input num" inputMode="numeric" value={sessions} onChange={(e) => setSessions(e.target.value)} />
      </label>
      {errors.sessions && <p className="error">{errors.sessions}</p>}
      <label className="field"><span>Objectif</span>
        <select aria-label="Objectif" className="input" value={goal} onChange={(e) => setGoal(e.target.value as Goal | '')}>
          <option value="">—</option>
          {(Object.keys(GOALS) as Goal[]).map((g) => <option key={g} value={g}>{GOALS[g].label}</option>)}
        </select>
      </label>
      <button className="btn primary block" disabled={invalid} onClick={save}>Enregistrer</button>
    </Sheet>
  )
}
