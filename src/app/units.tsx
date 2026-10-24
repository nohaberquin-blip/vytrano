import { createContext, useContext } from 'react'
import type { Unit } from '../domain/types'
import { round2 } from '../domain/progression'
import { formatWeight } from '../domain/parseWeight'

const LB_PER_KG = 2.20462

/** Les charges sont stockées en kg ; l'unité ne change que l'affichage et la saisie. */
export const UnitContext = createContext<Unit>('kg')

export function useUnit() {
  const unit = useContext(UnitContext)
  const toDisplay = (kg: number) => (unit === 'kg' ? kg : Math.round(kg * LB_PER_KG * 10) / 10)
  return {
    unit,
    toDisplay,
    toKg: (n: number) => (unit === 'kg' ? n : round2(n / LB_PER_KG)),
    show: (kg: number) => `${formatWeight(toDisplay(kg))} ${unit}`,
  }
}
