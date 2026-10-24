/** Lit une charge saisie à la française ("62,5") ou à l'anglaise ("62.5"). */
export function parseWeight(input: string): number | null {
  const s = input.trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(s)) return null
  return Number(s)
}

export function formatWeight(n: number): string {
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
}
