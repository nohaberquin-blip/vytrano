import { useEffect, useState } from 'react'
import { parseWeight } from '../../domain/parseWeight'

/**
 * Saisie d'une charge qui accepte la virgule. `value` est en unité d'affichage ;
 * `onChange` reçoit null tant que le texte n'est pas une charge valide.
 */
export function WeightInput({ value, onChange, id, label, className = 'input' }: {
  value: number | null; onChange(v: number | null): void; id?: string; label?: string; className?: string
}) {
  const [text, setText] = useState(() => (value === null ? '' : String(value).replace('.', ',')))
  useEffect(() => {
    // Valeur changée de l'extérieur : on resynchronise le texte. null = saisie en cours invalide, on n'y touche pas.
    if (value !== null && parseWeight(text) !== value) setText(String(value).replace('.', ','))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <input id={id} aria-label={label} className={className} inputMode="decimal" value={text}
      onFocus={(e) => e.target.select()}
      onChange={(e) => { setText(e.target.value); onChange(parseWeight(e.target.value)) }} />
  )
}
