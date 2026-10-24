/** Texte saisi → nombre (virgule acceptée) ; '' → null ; texte invalide → NaN. */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(',', '.')
  return t === '' ? null : Number(t)
}

/** Message d'erreur si `n` n'est pas dans [min, max] (null est accepté). */
export function rangeError(n: number | null, min: number, max: number, message: string): string | null {
  return n !== null && (Number.isNaN(n) || n < min || n > max) ? message : null
}

export const fmtInt = (n: number) => n.toLocaleString('fr-FR')
