/** Texte saisi → nombre (virgule acceptée) ; '' → null ; texte invalide → NaN. */
export function parseNumber(text: string): number | null {
  const t = text.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.')
  return t === '' ? null : Number(t)
}

/** Message d'erreur si `n` n'est pas dans [min, max] (null est accepté). */
export function rangeError(n: number | null, min: number, max: number, message: string): string | null {
  return n !== null && (Number.isNaN(n) || n < min || n > max) ? message : null
}

/** Comme `rangeError`, mais refuse aussi les décimales. */
export function intRangeError(n: number | null, min: number, max: number, message: string): string | null {
  return n !== null && !Number.isInteger(n) ? message : rangeError(n, min, max, message)
}

export const fmtInt = (n: number) => n.toLocaleString('fr-FR')
