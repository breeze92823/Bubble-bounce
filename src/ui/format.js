// Number formats shared by the HUD, windows and world texts (UI_SPEC §Number formatting).
const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx']
export function abbreviate(n) {
  let i = 0
  while (Math.abs(n) >= 1000 && i < UNITS.length - 1) {
    n /= 1000
    i++
  }
  if (i === 0) return String(Math.floor(n))
  return (Math.floor(n * 10) / 10).toFixed(1).replace(/\.0$/, '') + UNITS[i] // 459.9K, 2.5M, 10M
}
export const commas = (n) => Math.floor(n).toLocaleString('en-US')
