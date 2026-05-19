import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | null): string {
  if (amount === null) return '—'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: string | null): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatDateShort(date: string | null): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(new Date(date))
}

// Source de verite unique pour les statuts projet : lowercase canoniques.
// Aligne sur la contrainte CHECK app.projets_statut_check.
export const STATUT_LABELS: Record<string, string> = {
  analyse: 'Analyse',
  lancement: 'Lancement',
  passation: 'Passation',
  achats: 'Achats',
  installation: 'Installation',
  chantier: 'Chantier',
  controle: 'Contrôle',
  cloture: 'Clôture',
  gpa: 'GPA',
  termine: 'Terminé',
}

export const STATUT_COLORS: Record<string, string> = {
  analyse: 'bg-slate-100 text-slate-700',
  lancement: 'bg-sky-100 text-sky-700',
  passation: 'bg-indigo-100 text-indigo-700',
  achats: 'bg-amber-100 text-amber-700',
  installation: 'bg-blue-100 text-blue-700',
  chantier: 'bg-emerald-100 text-emerald-700',
  controle: 'bg-purple-100 text-purple-700',
  cloture: 'bg-gray-100 text-gray-600',
  gpa: 'bg-red-100 text-red-700',
  termine: 'bg-gray-100 text-gray-500',
}

export const PHASE_ORDER = [
  'analyse',
  'lancement',
  'passation',
  'achats',
  'installation',
  'chantier',
  'controle',
  'cloture',
  'gpa',
  'termine',
]

// Statuts terminaux (projet ferme) — a exclure des dashboards actifs.
export const STATUTS_TERMINES = ['cloture', 'gpa', 'termine']

// ─── Statuts CRM commercial ────────────────────────────────────────────────
// Pipeline de vente, independant du cycle projet (statut ci-dessus).
export const STATUT_COMMERCIAL_LABELS: Record<string, string> = {
  nouveau: 'Nouveau',
  contacte: 'Contacté',
  qualifie: 'Qualifié',
  proposition_envoyee: 'Proposition envoyée',
  en_negociation: 'En négociation',
  gagne: 'Gagné',
  perdu: 'Perdu',
  en_pause: 'En pause',
}

export const STATUT_COMMERCIAL_COLORS: Record<string, string> = {
  nouveau: 'bg-slate-100 text-slate-700',
  contacte: 'bg-sky-100 text-sky-700',
  qualifie: 'bg-indigo-100 text-indigo-700',
  proposition_envoyee: 'bg-violet-100 text-violet-700',
  en_negociation: 'bg-amber-100 text-amber-700',
  gagne: 'bg-emerald-100 text-emerald-700',
  perdu: 'bg-red-100 text-red-700',
  en_pause: 'bg-gray-100 text-gray-500',
}

export const STATUT_COMMERCIAL_ORDER = [
  'nouveau',
  'contacte',
  'qualifie',
  'proposition_envoyee',
  'en_negociation',
  'gagne',
  'perdu',
  'en_pause',
]

// ─── Semaines ──────────────────────────────────────────────────────────────
// Retourne le lundi (00:00 local) de la semaine contenant `date`.
export function getMondayOf(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() // 0 = dimanche, 1 = lundi, ..., 6 = samedi
  const offset = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + offset)
  return d
}

// Format ISO "YYYY-MM-DD" pour stockage en base.
export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Format affichage "Sem. du 11 mai".
export function formatSemaineDebut(mondayISO: string): string {
  const d = new Date(mondayISO + 'T00:00:00')
  return `Sem. du ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
}

// Numero de semaine simple (jours depuis le 1er janvier / 7).
// Aligne avec l'affichage S{n} utilise dans Preparation.
export function weekNumberOf(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1)
  const diff = date.getTime() - start.getTime()
  return Math.ceil(diff / (7 * 24 * 60 * 60 * 1000))
}

export function shortSemaineLabel(mondayISO: string): string {
  const d = new Date(mondayISO + 'T00:00:00')
  return `S${weekNumberOf(d)}`
}

// Liste de N semaines passees + future, autour du lundi actuel.
export function listSemaines(weeksBefore = 4, weeksAfter = 3): string[] {
  const monday = getMondayOf(new Date())
  const arr: string[] = []
  for (let i = -weeksBefore; i <= weeksAfter; i++) {
    const m = new Date(monday)
    m.setDate(m.getDate() + i * 7)
    arr.push(toISODate(m))
  }
  return arr
}
