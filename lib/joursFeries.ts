// Jours feries francais (metropole) — pour l'affichage du calendrier des heures.

function paques(year: number): Date {
  // Algorithme de Meeus/Jones/Butcher
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + days)
  return r
}

function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

const cache = new Map<number, Map<string, string>>()

export function joursFeriesFR(year: number): Map<string, string> {
  const cached = cache.get(year)
  if (cached) return cached
  const p = paques(year)
  const items: [Date, string][] = [
    [new Date(year, 0, 1),  "Jour de l'an"],
    [addDays(p, 1),          'Lundi de Paques'],
    [new Date(year, 4, 1),   'Fete du Travail'],
    [new Date(year, 4, 8),   'Victoire 1945'],
    [addDays(p, 39),         "Jeudi de l'Ascension"],
    [addDays(p, 50),         'Lundi de Pentecote'],
    [new Date(year, 6, 14),  'Fete nationale'],
    [new Date(year, 7, 15),  'Assomption'],
    [new Date(year, 10, 1),  'Toussaint'],
    [new Date(year, 10, 11), 'Armistice 1918'],
    [new Date(year, 11, 25), 'Noel'],
  ]
  const map = new Map<string, string>()
  for (const [d, label] of items) map.set(dateKey(d), label)
  cache.set(year, map)
  return map
}

export function isFerie(date: Date): string | null {
  const map = joursFeriesFR(date.getFullYear())
  return map.get(dateKey(date)) ?? null
}

export function isWeekend(date: Date): boolean {
  const d = date.getDay()
  return d === 0 || d === 6
}

export { dateKey }
