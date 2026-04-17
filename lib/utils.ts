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
