'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, ArrowLeft } from 'lucide-react'

/* ───── Types ─────────────────────────────────────────────────── */

export interface ProjetBase {
  id: string
  nom: string
  reference: string | null
  statut: string | null
  archived_at: string | null
  archived_by: string | null
  client_nom: string | null
}

export interface Projet extends ProjetBase {
  type_chantier: string | null
  adresse: string | null
  surface_m2: number | null
  budget_total: number | null
  date_debut: string | null
  date_livraison: string | null
  date_signature: string | null
  co_id: string | null
  commercial_id: string | null
  economiste_id: string | null
  dessinatrice_id: string | null
  client_email: string | null
  client_tel: string | null
  clients_supplementaires: unknown
  psychologie_client: string | null
  infos_hors_contrat: string | null
  alertes_cles: string | null
  remarque: string | null
  apporteur_affaire: string | null
  urgence: string | null
  maturite_client: string | null
  source_client: string | null
}

export interface Utilisateur {
  id: string
  prenom: string
  nom: string
  role: string
  email: string
}

/* ───── Constants ─────────────────────────────────────────────── */

export const ROLE_LABELS: Record<string, string> = {
  co: "Chargé d'opérations",
  commercial: "Commercial / Chargé d'affaires",
  economiste: 'Économiste',
  dessinatrice: 'Dessinatrice',
  comptable: 'Comptable',
  gerant: 'Gérant',
  admin: 'Administrateur',
  rh: 'RH',
  cho: 'CHO',
  assistant_travaux: 'Assistant Travaux',
  st: 'Sous-traitant',
}

export const CATEGORIE_LABELS: Record<string, string> = {
  contractuel: 'Contractuel',
  financier: 'Financier',
  plans: 'Plans',
  chantier: 'Chantier',
  administratif: 'Administratif',
  doe: 'DOE',
  autre: 'Autre',
}

export const TYPE_DOC_TO_CATEGORIE: Record<string, string> = {
  contrat: 'contractuel', devis: 'contractuel', cgv: 'contractuel',
  facture: 'financier', devis_recu: 'financier',
  plan_apd: 'plans', plan_exe: 'plans', plan_doe: 'plans',
  cr: 'chantier', audio_reunion: 'chantier', photo: 'chantier',
  kbis: 'administratif', assurance: 'administratif', urssaf: 'administratif', rib: 'administratif',
  doe: 'doe',
}

export const PHASE_LABELS: Record<string, string> = {
  conception: 'Conception',
  lancement: 'Lancement',
  consultation: 'Consultation',
  chantier: 'Chantier',
  cloture: 'Clôture',
}

/* ───── Helpers ───────────────────────────────────────────────── */

export function formatBudget(n: number | null | undefined) {
  if (!n && n !== 0) return '—'
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n) + ' €'
}

export function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function statutColor(statut: string | null | undefined): string {
  const s = (statut ?? '').toLowerCase()
  if (['valide', 'complet', 'attribue', 'signe', 'ok', 'termine'].some(k => s.includes(k))) return 'bg-green-100 text-green-700'
  if (['cours', 'attente', 'pending', 'consulte'].some(k => s.includes(k))) return 'bg-orange-100 text-orange-700'
  if (['refus', 'expire', 'rejet', 'manquant'].some(k => s.includes(k))) return 'bg-red-100 text-red-700'
  return 'bg-gray-100 text-gray-600'
}

/* ───── UI primitives ─────────────────────────────────────────── */

type IconType = React.ComponentType<{ className?: string }>

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>{children}</div>
}

export function CardTitle({ icon: Icon, title, count }: { icon: IconType; title: string; count?: number }) {
  return (
    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-gray-500" />
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      </div>
      {typeof count === 'number' && (
        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{count}</span>
      )}
    </div>
  )
}

export function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm text-gray-900">{value || '—'}</p>
    </div>
  )
}

export function Accordion({
  title, count, children, defaultOpen = false,
}: { title: string; count: number; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
          <span className="text-sm font-semibold text-gray-900">{title}</span>
          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{count}</span>
        </div>
      </button>
      {open && <div className="border-t border-gray-100">{children}</div>}
    </div>
  )
}

/* ───── Sub-page header ───────────────────────────────────────── */

export function SubPageHeader({
  projet, sectionTitle,
}: {
  projet: ProjetBase | null
  sectionTitle: string
}) {
  if (!projet) return null
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-5">
      <Link href={`/admin/historique/${projet.id}`}
        className="text-xs text-gray-500 hover:text-gray-900 inline-flex items-center gap-1 mb-2">
        <ArrowLeft className="w-3.5 h-3.5" /> Retour au projet
      </Link>
      <div className="flex items-center gap-3 flex-wrap">
        {projet.reference && <span className="text-xs font-mono text-gray-400">{projet.reference}</span>}
        <h1 className="text-xl font-semibold text-gray-900 truncate">{projet.nom}</h1>
        <span className="bg-gray-200 text-gray-600 rounded-full px-3 py-1 text-sm font-medium">ARCHIVÉ</span>
        <span className="text-sm text-gray-400">·</span>
        <span className="text-sm font-medium text-gray-700">{sectionTitle}</span>
      </div>
    </header>
  )
}
