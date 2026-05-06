'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Upload, X, Plus, Trash2, Search, Check, AlertCircle } from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ClientSupp {
  nom: string
  email: string
  tel: string
}

interface Utilisateur {
  id: string
  prenom: string
  nom: string
  role: string
}

type BudgetMode = 'saisir' | 'non_transmis' | 'fourchette' | 'enveloppe'

interface FormData {
  // Step 1 - Identité
  nom: string
  type_chantier: string
  adresse: string
  description: string
  urgence: boolean
  nature_projet: string
  surface_m2: string
  programme: string[]
  // Step 2 - Client
  client_nom: string
  client_email: string
  client_tel: string
  client_adresse: string
  foncier: string
  surface_fonciere: string
  parcelles_cadastrales: string[]
  contraintes_reglementaires: string[]
  clients_supplementaires: ClientSupp[]
  // Step 3 - Budget & Planning
  budget_mode: BudgetMode
  budget_total: string
  budget_min: string
  budget_max: string
  budget_enveloppe: string
  budget_precision: string
  date_debut: string
  date_livraison: string
  maturite_client: string
  source_client: string
  apporteur_present: boolean
  apporteur_affaire: string
  apporteur_email: string
  apporteur_tel: string
  apporteur_pourcentage: string
  type_financement: string[]
  honoraires_ht: string
  duree_chantier_semaines: string
  // Step 4 - Psychologie
  q1: string
  q2: string
  q3: string[]
  q4: string[]
  q5: string
  // Step 5 - Équipe
  co_id: string
  economiste_id: string
  dessinatrice_id: string
  at_id: string
  extra_membres: string[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TYPES_CHANTIER = [
  'Bureaux', 'ERP', 'Entrepôt', 'Commerce', 'Industrie',
  'Logements', 'Équipement sportif', 'Autre à préciser',
]

const NATURES_PROJET = ['Neuf', 'Réhabilitation', 'Extension', 'Rénovation', 'Aménagement intérieur', 'Aménagement extérieur', 'Autre à préciser']
const PROGRAMME_OPTIONS = ['ICPE', 'ERP', 'ERT', 'Autre à préciser']
const FONCIER_OPTIONS = ['Existant', 'En acquisition', 'Bail a construire', 'Autre à préciser']
const CONTRAINTES_REGLEMENTAIRES = ['PPR', 'ABF', 'ZPPAUP', 'ZNIEFF', 'NATURA 2000', 'PNR', 'Autre à préciser']
const TYPES_FINANCEMENT = ['CPI', 'CBI', 'Prêt classique', 'Subventions', 'Levée de fonds', 'Autre à préciser']

const ABBREVIATIONS: Record<string, string> = {
  'ERP': "Établissement Recevant du Public",
  'ICPE': "Installation Classée pour la Protection de l'Environnement",
  'ERT': "Établissement Recevant des Travailleurs",
  'PPR': "Plan de Prévention des Risques",
  'ABF': "Architecte des Bâtiments de France",
  'ZPPAUP': "Zone de Protection du Patrimoine Architectural, Urbain et Paysager",
  'ZNIEFF': "Zone Naturelle d'Intérêt Écologique, Faunistique et Floristique",
  'NATURA 2000': "Réseau européen de sites naturels protégés",
  'PNR': "Parc Naturel Régional",
  'CPI': "Contrat de Promotion Immobilière",
  'CBI': "Contrat de Bail à Construction",
}

function AbbrHint({ term }: { term: string }) {
  const def = ABBREVIATIONS[term]
  if (!def) return null
  return (
    <span title={def} className="inline-flex text-gray-400 hover:text-gray-700 cursor-help" aria-label={def}>
      <AlertCircle className="w-3.5 h-3.5" />
    </span>
  )
}

const SOURCES_CLIENT = [
  'Recommandation', 'Ancien client', 'Prospection commerciale',
  "Appel d'offres", 'Site web / réseaux', 'Autre à préciser',
]

const MATURITES = [
  'Projet très clair (peu de modifs attendues)',
  'Projet défini mais ajustements probables',
  "Projet encore flou (risque d'avenants élevé)",
  'Autre à préciser',
]

const Q1_OPTIONS = [
  'Très réactif', 'Peu disponible', 'Décide vite',
  'Indécis (beaucoup de retours)', "Passe par un intermédiaire", 'Autre à préciser',
]

const Q2_OPTIONS = [
  'Standard', 'Élevé (attentif aux détails)',
  'Très élevé (perfectionniste)', 'Focalisé uniquement sur le budget',
  'Autre à préciser',
]

const Q3_OPTIONS = [
  'Date de livraison impérative', "Travaux hors heures d'ouverture",
  'Bâtiment occupé pendant les travaux', 'Contrainte saisonnière', 'Aucune contrainte',
  'Autre à préciser',
]

const Q4_OPTIONS = [
  "Client a eu des problèmes avec d'autres entreprises",
  "Budget serré (risque d'avenants)",
  'Décisions collectives (plusieurs interlocuteurs)',
  'Délais très courts', 'Contraintes techniques complexes',
  'Riverains / voisinage sensible',
  'Autre à préciser',
]

// ─── Shared styles ───────────────────────────────────────────────────────────

const inputClass =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder-gray-300'

const btnPrimary =
  'inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

const btnSecondary =
  'inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50'

// ─── Shared UI ───────────────────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {children}
    </div>
  )
}

function CheckboxGroup({ options, values, onChange }: { options: string[]; values: string[]; onChange: (v: string[]) => void }) {
  function toggle(opt: string) {
    onChange(values.includes(opt) ? values.filter(v => v !== opt) : [...values, opt])
  }
  return (
    <div className="space-y-2">
      {options.map(opt => (
        <label key={opt} className="flex items-start gap-2.5 cursor-pointer">
          <input type="checkbox" checked={values.includes(opt)} onChange={() => toggle(opt)} className="mt-0.5 accent-gray-900" />
          <span className="text-sm text-gray-700 inline-flex items-center gap-1.5">
            {opt}
            <AbbrHint term={opt} />
          </span>
        </label>
      ))}
    </div>
  )
}

function SelectWithPrecision({ value, options, onChange, placeholder = 'Précisez...' }: { value: string; options: string[]; onChange: (v: string) => void; placeholder?: string }) {
  const isAutre = value === 'Autre à préciser' || value.startsWith('Autre à préciser: ')
  const baseValue = isAutre ? 'Autre à préciser' : value
  const autreText = value.startsWith('Autre à préciser: ') ? value.slice('Autre à préciser: '.length) : ''
  return (
    <div className="space-y-2">
      <select value={baseValue} onChange={e => onChange(e.target.value)} className={inputClass}>
        <option value="">-- Selectionner --</option>
        {options.map(o => <option key={o} value={o} title={ABBREVIATIONS[o] ?? ''}>{o}</option>)}
      </select>
      {isAutre && (
        <input
          type="text"
          value={autreText}
          onChange={e => onChange(e.target.value ? `Autre à préciser: ${e.target.value}` : 'Autre à préciser')}
          placeholder={placeholder}
          autoFocus
          className={inputClass}
        />
      )}
    </div>
  )
}

function CheckboxGroupWithPrecision({ options, values, onChange, placeholder = 'Précisez le type...' }: { options: string[]; values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  function isChecked(opt: string) {
    return values.some(v => v === opt || v.startsWith(`${opt}: `))
  }
  function getPrecision(opt: string) {
    const found = values.find(v => v.startsWith(`${opt}: `))
    return found ? found.slice(`${opt}: `.length) : ''
  }
  function toggle(opt: string) {
    if (isChecked(opt)) {
      onChange(values.filter(v => v !== opt && !v.startsWith(`${opt}: `)))
    } else {
      onChange([...values, opt])
    }
  }
  function setPrecision(opt: string, text: string) {
    const filtered = values.filter(v => v !== opt && !v.startsWith(`${opt}: `))
    onChange([...filtered, text ? `${opt}: ${text}` : opt])
  }
  return (
    <div className="space-y-2">
      {options.map(opt => {
        const checked = isChecked(opt)
        return (
          <div key={opt}>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input type="checkbox" checked={checked} onChange={() => toggle(opt)} className="mt-0.5 accent-gray-900" />
              <span className="text-sm text-gray-700 inline-flex items-center gap-1.5">
                {opt}
                <AbbrHint term={opt} />
              </span>
            </label>
            {checked && (
              <input
                type="text"
                value={getPrecision(opt)}
                onChange={e => setPrecision(opt, e.target.value)}
                placeholder={placeholder}
                className="mt-2 ml-6 w-[calc(100%-1.5rem)] px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder-gray-300"
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function RadioGroup({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  const hasAutre = options.includes('Autre à préciser')
  const isAutreSelected = hasAutre && (value === 'Autre à préciser' || value.startsWith('Autre à préciser: '))
  const autreText = value.startsWith('Autre à préciser: ') ? value.slice('Autre à préciser: '.length) : ''
  return (
    <div className="space-y-2">
      {options.map(opt => {
        const checked = opt === 'Autre à préciser' ? isAutreSelected : value === opt
        return (
          <div key={opt}>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input type="radio" checked={checked} onChange={() => onChange(opt)} className="mt-0.5 accent-gray-900" />
              <span className="text-sm text-gray-700">{opt}</span>
            </label>
            {opt === 'Autre à préciser' && isAutreSelected && (
              <input
                type="text"
                value={autreText}
                onChange={e => onChange(e.target.value ? `Autre à préciser: ${e.target.value}` : 'Autre à préciser')}
                placeholder="Précisez..."
                autoFocus
                className="mt-2 ml-6 w-[calc(100%-1.5rem)] px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder-gray-300"
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

const ROLE_GROUPS: Record<string, string> = {
  admin: 'Équipe', co: 'Équipe', gerant: 'Équipe', commercial: 'Équipe',
  economiste: 'Équipe', dessinatrice: 'Équipe', assistant_travaux: 'Équipe',
  comptable: 'Équipe', rh: 'Équipe', cho: 'Équipe',
  st: 'ST', controle: 'Bureau de contrôle', client: 'Client',
}
const GROUP_ORDER = ['Équipe', 'ST', 'Bureau de contrôle', 'Client', 'Autres']

function MembresSearch({ candidates, selected, onToggle }: {
  candidates: Utilisateur[]
  selected: string[]
  onToggle: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const filtered = query.trim()
    ? candidates.filter(u =>
        `${u.prenom} ${u.nom}`.toLowerCase().includes(query.toLowerCase()) ||
        u.role.toLowerCase().includes(query.toLowerCase())
      )
    : candidates

  const grouped = filtered.reduce<Record<string, Utilisateur[]>>((acc, u) => {
    const g = ROLE_GROUPS[u.role] || 'Autres'
    ;(acc[g] ||= []).push(u)
    return acc
  }, {})

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Membres supplementaires au groupe chat</p>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <input
          type="text" value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher par nom ou role..."
          className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder-gray-300"
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map(id => {
            const u = candidates.find(c => c.id === id)
            if (!u) return null
            return (
              <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-900 text-white text-xs rounded-full">
                {u.prenom} {u.nom}
                <button onClick={() => onToggle(id)} className="ml-0.5 hover:text-gray-300"><X className="w-3 h-3" /></button>
              </span>
            )
          })}
        </div>
      )}
      <div className="border border-gray-100 rounded-lg bg-gray-50 max-h-64 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">Aucun resultat</p>
        ) : (
          GROUP_ORDER.filter(g => grouped[g]?.length).map(group => (
            <div key={group}>
              <div className="sticky top-0 px-3 py-1.5 bg-gray-100 border-b border-gray-200 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                {group} <span className="text-gray-400 normal-case font-normal">({grouped[group].length})</span>
              </div>
              {grouped[group].map(u => (
                <label key={u.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-100 transition-colors">
                  <input type="checkbox" checked={selected.includes(u.id)} onChange={() => onToggle(u.id)} className="accent-gray-900 flex-shrink-0" />
                  <span className="text-sm text-gray-700 flex-1">{u.prenom} {u.nom}</span>
                  <span className="text-xs text-gray-400">{u.role}</span>
                </label>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parsePsychologie(text: string | null): { q1: string; q2: string } {
  const result = { q1: '', q2: '' }
  if (!text) return result
  for (const line of text.split('\n')) {
    if (line.startsWith('Communication : ')) result.q1 = line.replace('Communication : ', '')
    if (line.startsWith('Exigence : ')) result.q2 = line.replace('Exigence : ', '')
  }
  return result
}

function parseAlertes(text: string | null): { q3: string[]; q4: string[] } {
  const result: { q3: string[]; q4: string[] } = { q3: [], q4: [] }
  if (!text) return result
  for (const line of text.split('\n')) {
    if (line.startsWith('Contraintes planning : ')) {
      result.q3 = line.replace('Contraintes planning : ', '').split(', ')
    }
    if (line.startsWith('Points de vigilance : ')) {
      result.q4 = line.replace('Points de vigilance : ', '').split(', ')
    }
  }
  return result
}

function safeJson(raw: string | null): Record<string, unknown> {
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { return {} }
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ModifierProjetPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useUser()
  const id = params.id as string
  const fileRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [reference, setReference] = useState('')
  const [newFiles, setNewFiles] = useState<File[]>([])

  const [form, setForm] = useState<FormData>({
    nom: '', type_chantier: '', adresse: '', description: '', urgence: false,
    nature_projet: '', surface_m2: '', programme: [],
    client_nom: '', client_email: '', client_tel: '', client_adresse: '',
    foncier: '', surface_fonciere: '', parcelles_cadastrales: [''], contraintes_reglementaires: [],
    clients_supplementaires: [],
    budget_mode: 'saisir', budget_total: '', budget_min: '', budget_max: '', budget_enveloppe: '', budget_precision: '', date_debut: '', date_livraison: '', maturite_client: '',
    source_client: '', apporteur_present: false, apporteur_affaire: '', apporteur_email: '', apporteur_tel: '', apporteur_pourcentage: '', type_financement: [], honoraires_ht: '', duree_chantier_semaines: '',
    q1: '', q2: '', q3: [], q4: [], q5: '',
    co_id: '', economiste_id: '', dessinatrice_id: '', at_id: '', extra_membres: [],
  })

  // Team options
  const [cos, setCos] = useState<Utilisateur[]>([])
  const [economistes, setEconomistes] = useState<Utilisateur[]>([])
  const [dessinatrices, setDessinatrices] = useState<Utilisateur[]>([])
  const [ats, setAts] = useState<Utilisateur[]>([])
  const [allUsers, setAllUsers] = useState<Utilisateur[]>([])

  function update(patch: Partial<FormData>) {
    setForm(f => ({ ...f, ...patch }))
    setSaved(false)
  }

  // Load project and users
  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.push('/login'); return }

      const [projetRes, usersRes] = await Promise.all([
        supabase.schema('app').from('projets').select('*').eq('id', id).eq('commercial_id', authUser.id).single(),
        supabase.schema('app').from('utilisateurs').select('id, prenom, nom, role').eq('actif', true).order('prenom'),
      ])

      if (projetRes.error || !projetRes.data) { router.push('/commercial/dashboard'); return }

      const p = projetRes.data
      const remarque = safeJson(p.remarque as string | null)
      const psych = parsePsychologie(p.psychologie_client)
      const alertes = parseAlertes(p.alertes_cles)

      setReference(p.reference ?? '')
      setForm({
        nom: p.nom ?? '',
        type_chantier: p.type_chantier ?? '',
        adresse: p.adresse ?? '',
        description: (remarque.description as string) ?? '',
        urgence: !!(remarque.urgence),
        nature_projet: (remarque.nature_projet as string) ?? '',
        surface_m2: p.surface_m2 ? String(p.surface_m2) : '',
        programme: Array.isArray(remarque.programme) ? remarque.programme as string[] : [],
        client_nom: p.client_nom ?? '',
        client_email: p.client_email ?? '',
        client_tel: p.client_tel ?? '',
        client_adresse: (remarque.client_adresse as string) ?? '',
        foncier: (remarque.foncier as string) ?? '',
        surface_fonciere: remarque.surface_fonciere ? String(remarque.surface_fonciere) : '',
        parcelles_cadastrales: (() => {
          const raw = (remarque.parcelles_cadastrales as string) ?? ''
          const arr = raw.split(',').map(s => s.trim()).filter(Boolean)
          return arr.length ? arr : ['']
        })(),
        contraintes_reglementaires: Array.isArray(remarque.contraintes_reglementaires) ? remarque.contraintes_reglementaires as string[] : [],
        clients_supplementaires: Array.isArray(remarque.clients_supplementaires) ? remarque.clients_supplementaires as ClientSupp[] : [],
        budget_mode: ((['saisir', 'non_transmis', 'fourchette', 'enveloppe'] as const).includes(remarque.budget_mode as BudgetMode) ? remarque.budget_mode : 'saisir') as BudgetMode,
        budget_total: p.budget_total ? String(p.budget_total) : '',
        budget_min: remarque.budget_min != null ? String(remarque.budget_min) : '',
        budget_max: remarque.budget_max != null ? String(remarque.budget_max) : '',
        budget_enveloppe: remarque.budget_enveloppe != null ? String(remarque.budget_enveloppe) : '',
        budget_precision: (remarque.budget_precision as string) ?? '',
        date_debut: p.date_debut ?? '',
        date_livraison: p.date_livraison ?? '',
        maturite_client: (remarque.maturite_client as string) ?? '',
        source_client: (remarque.source_client as string) ?? '',
        apporteur_present: typeof remarque.apporteur_present === 'boolean' ? remarque.apporteur_present : !!remarque.apporteur_affaire,
        apporteur_affaire: (remarque.apporteur_affaire as string) ?? '',
        apporteur_email: (remarque.apporteur_email as string) ?? '',
        apporteur_tel: (remarque.apporteur_tel as string) ?? '',
        apporteur_pourcentage: remarque.apporteur_pourcentage != null ? String(remarque.apporteur_pourcentage) : '',
        type_financement: Array.isArray(remarque.type_financement) ? remarque.type_financement as string[] : [],
        honoraires_ht: remarque.honoraires_ht ? String(remarque.honoraires_ht) : '',
        duree_chantier_semaines: remarque.duree_chantier_semaines ? String(remarque.duree_chantier_semaines) : '',
        q1: psych.q1,
        q2: psych.q2,
        q3: alertes.q3,
        q4: alertes.q4,
        q5: p.infos_hors_contrat ?? '',
        co_id: p.co_id ?? '',
        economiste_id: p.economiste_id ?? '',
        dessinatrice_id: (remarque.dessinatrice_id as string) ?? '',
        at_id: (remarque.at_id as string) ?? '',
        extra_membres: Array.isArray(remarque.extra_membres) ? remarque.extra_membres as string[] : [],
      })

      if (usersRes.data) {
        const users = usersRes.data as Utilisateur[]
        setCos(users.filter(u => u.role === 'co'))
        setEconomistes(users.filter(u => u.role === 'economiste'))
        setDessinatrices(users.filter(u => u.role === 'dessinatrice'))
        setAts(users.filter(u => u.role === 'assistant_travaux'))
        setAllUsers(users)
      }

      setLoading(false)
    }
    load()
  }, [id])

  async function handleSave() {
    if (!user || !form.co_id) return
    setSaving(true)
    setError('')

    const supabase = createClient()

    try {
      // Build psychologie & alertes
      const psychLines: string[] = []
      if (form.q1) psychLines.push(`Communication : ${form.q1}`)
      if (form.q2) psychLines.push(`Exigence : ${form.q2}`)
      if (form.maturite_client) psychLines.push(`Maturite : ${form.maturite_client}`)

      const alertLines: string[] = []
      if (form.q3.length) alertLines.push(`Contraintes planning : ${form.q3.join(', ')}`)
      if (form.q4.length) alertLines.push(`Points de vigilance : ${form.q4.join(', ')}`)
      if (form.urgence) alertLines.push('URGENT')

      const budgetMin = form.budget_min ? parseFloat(form.budget_min) : null
      const budgetMax = form.budget_max ? parseFloat(form.budget_max) : null
      const budgetEnv = form.budget_enveloppe ? parseFloat(form.budget_enveloppe) : null
      const budgetSaisir = form.budget_total ? parseFloat(form.budget_total) : null
      const budgetTotalNumeric =
        form.budget_mode === 'saisir' ? budgetSaisir
        : form.budget_mode === 'fourchette' ? (budgetMin != null && budgetMax != null ? (budgetMin + budgetMax) / 2 : (budgetMin ?? budgetMax))
        : form.budget_mode === 'enveloppe' ? budgetEnv
        : null

      const remarque = JSON.stringify({
        description: form.description || null,
        urgence: form.urgence,
        nature_projet: form.nature_projet || null,
        programme: form.programme.length ? form.programme : null,
        clients_supplementaires: form.clients_supplementaires.filter(c => c.nom),
        client_adresse: form.client_adresse || null,
        foncier: form.foncier || null,
        surface_fonciere: form.surface_fonciere ? parseFloat(form.surface_fonciere) : null,
        parcelles_cadastrales: form.parcelles_cadastrales.map(p => p.trim()).filter(Boolean).join(', ') || null,
        contraintes_reglementaires: form.contraintes_reglementaires.length ? form.contraintes_reglementaires : null,
        source_client: form.source_client || null,
        apporteur_present: form.apporteur_present,
        apporteur_affaire: form.apporteur_present ? (form.apporteur_affaire || null) : null,
        apporteur_email: form.apporteur_present ? (form.apporteur_email || null) : null,
        apporteur_tel: form.apporteur_present ? (form.apporteur_tel || null) : null,
        apporteur_pourcentage: form.apporteur_present && form.apporteur_pourcentage ? parseFloat(form.apporteur_pourcentage) : null,
        maturite_client: form.maturite_client || null,
        type_financement: form.type_financement.length ? form.type_financement : null,
        honoraires_ht: form.honoraires_ht ? parseFloat(form.honoraires_ht) : null,
        duree_chantier_semaines: form.duree_chantier_semaines ? parseInt(form.duree_chantier_semaines) : null,
        budget_mode: form.budget_mode,
        budget_min: budgetMin,
        budget_max: budgetMax,
        budget_enveloppe: budgetEnv,
        budget_precision: form.budget_precision || null,
        dessinatrice_id: form.dessinatrice_id || null,
        at_id: form.at_id || null,
        extra_membres: form.extra_membres,
      })

      const { error: errUpdate } = await supabase.schema('app').from('projets')
        .update({
          nom: form.nom,
          type_chantier: form.type_chantier || null,
          adresse: form.adresse,
          budget_total: budgetTotalNumeric,
          surface_m2: form.surface_m2 ? parseFloat(form.surface_m2) : null,
          date_debut: form.date_debut || null,
          date_livraison: form.date_livraison || null,
          co_id: form.co_id,
          economiste_id: form.economiste_id || null,
          client_nom: form.client_nom,
          client_email: form.client_email || null,
          client_tel: form.client_tel || null,
          psychologie_client: psychLines.join('\n') || null,
          alertes_cles: alertLines.join('\n') || null,
          infos_hors_contrat: form.q5 || null,
          remarque,
        })
        .eq('id', id)

      if (errUpdate) throw new Error(errUpdate.message)

      // Sync chat_membres : ajoute les membres de l'equipe (CO, eco, dessi, AT, extras) au groupe chat
      let { data: grp } = await supabase.schema('app').from('chat_groupes')
        .select('id').eq('projet_id', id).eq('type', 'projet').maybeSingle()
      // Cree le groupe si absent (cas des projets crees sans groupe initial)
      if (!grp) {
        const { data: projetRow } = await supabase.schema('app').from('projets')
          .select('reference, nom').eq('id', id).single()
        const r = projetRow as { reference: string | null; nom: string } | null
        const groupName = `${r?.reference ?? r?.nom ?? 'Projet'} — ${r?.nom ?? ''} — Général`
        const { data: newGrp } = await supabase.schema('app').from('chat_groupes')
          .insert({ nom: groupName, type: 'projet', projet_id: id, cree_par: user.id, actif: true } as never)
          .select('id').single()
        grp = newGrp as { id: string } | null
      }
      if (grp) {
        const teamIds = Array.from(new Set([
          user.id,  // l'utilisateur qui edite (commercial) reste admin du groupe
          form.co_id, form.economiste_id, form.dessinatrice_id, form.at_id,
          ...form.extra_membres,
        ].filter(Boolean))) as string[]
        const { data: existingMembers } = await supabase.schema('app').from('chat_membres')
          .select('utilisateur_id').eq('groupe_id', grp.id)
        const existingSet = new Set(((existingMembers ?? []) as { utilisateur_id: string }[]).map((m) => m.utilisateur_id))
        const toAdd = teamIds.filter((uid) => !existingSet.has(uid))
        if (toAdd.length > 0) {
          await supabase.schema('app').from('chat_membres').insert(
            toAdd.map((uid) => ({ groupe_id: grp!.id, utilisateur_id: uid, est_admin: uid === user.id })),
          )
        }
      }

      // Upload new files
      if (newFiles.length) {
        for (const file of newFiles) {
          const path = `${id}/00_client/${file.name}`
          const { error: uploadErr } = await supabase.storage.from('projets').upload(path, file, { upsert: true })
          if (!uploadErr) {
            await supabase.schema('app').from('documents').insert({
              projet_id: id,
              uploaded_by: user.id,
              nom_fichier: file.name,
              type_doc: 'autre',
              storage_path: path,
              taille_octets: file.size,
              tags: [],
            })
          }
        }
        setNewFiles([])
      }

      setSaved(true)
      setSaving(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.')
      setSaving(false)
    }
  }

  // Client supplementaire helpers
  function addClient() { update({ clients_supplementaires: [...form.clients_supplementaires, { nom: '', email: '', tel: '' }] }) }
  function removeClient(i: number) { update({ clients_supplementaires: form.clients_supplementaires.filter((_, idx) => idx !== i) }) }
  function updateClient(i: number, patch: Partial<ClientSupp>) {
    const updated = form.clients_supplementaires.map((c, idx) => idx === i ? { ...c, ...patch } : c)
    update({ clients_supplementaires: updated })
  }

  // Extra membres
  const coreIds = new Set([form.co_id, form.economiste_id, form.dessinatrice_id, form.at_id].filter(Boolean))
  const extraCandidates = allUsers.filter(u => !coreIds.has(u.id))
  function toggleExtra(uid: string) {
    const cur = form.extra_membres
    update({ extra_membres: cur.includes(uid) ? cur.filter(x => x !== uid) : [...cur, uid] })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fafaf8] py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/commercial/projets/${id}`}
              className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Modifier le projet</h1>
              {reference && <p className="text-xs text-gray-400 font-mono">{reference}</p>}
            </div>
          </div>
          <button onClick={handleSave} disabled={saving || !form.co_id || !form.nom || !form.adresse || !form.client_nom} className={btnPrimary}>
            {saving ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Enregistrement...</>
            ) : saved ? (
              <><Check className="w-4 h-4" /> Enregistre</>
            ) : (
              <><Save className="w-4 h-4" /> Enregistrer</>
            )}
          </button>
        </div>

        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
        )}

        {saved && (
          <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
            Modifications enregistrees avec succes.
          </div>
        )}

        {/* ─── Section 1: Identité ─── */}
        <Section title="Identite du projet">
          <Field label="Nom du projet" required>
            <input type="text" required value={form.nom} onChange={e => update({ nom: e.target.value })}
              placeholder="Ex : Renovation bureaux Zone Industrielle" className={inputClass} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Type de chantier">
              <SelectWithPrecision value={form.type_chantier} options={TYPES_CHANTIER} onChange={v => update({ type_chantier: v })} placeholder="Precisez le type de chantier..." />
            </Field>
            <Field label="Urgence">
              <div className="flex items-center gap-3 h-[38px]">
                <button type="button" onClick={() => update({ urgence: !form.urgence })}
                  className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0',
                    form.urgence ? 'bg-red-500' : 'bg-gray-200')}>
                  <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                    form.urgence ? 'translate-x-6' : 'translate-x-1')} />
                </button>
                <span className="text-sm text-gray-600">{form.urgence ? 'Urgent' : 'Normal'}</span>
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Nature du projet">
              <SelectWithPrecision value={form.nature_projet} options={NATURES_PROJET} onChange={v => update({ nature_projet: v })} placeholder="Precisez la nature du projet..." />
            </Field>
            <Field label="Surface du projet (m2)">
              <input type="number" min={0} value={form.surface_m2} onChange={e => update({ surface_m2: e.target.value })}
                placeholder="Ex : 850" className={inputClass} />
            </Field>
          </div>

          <Field label="Adresse du chantier" required>
            <input type="text" required value={form.adresse} onChange={e => update({ adresse: e.target.value })}
              placeholder="Ex : 12 rue de la Paix, 75001 Paris" className={inputClass} />
          </Field>

          <Field label="Programme">
            <CheckboxGroupWithPrecision options={PROGRAMME_OPTIONS} values={form.programme} onChange={v => update({ programme: v })} />
          </Field>

          {reference && (
            <Field label="Numero d'affaire">
              <input type="text" disabled value={reference} className={cn(inputClass, 'bg-gray-50 text-gray-400 cursor-not-allowed')} />
            </Field>
          )}

          <Field label="Description du projet">
            <textarea value={form.description} onChange={e => update({ description: e.target.value })}
              placeholder="Contexte, objectifs, specificites du projet..." rows={3}
              className={cn(inputClass, 'resize-none')} />
          </Field>
        </Section>

        {/* ─── Section 2: Client ─── */}
        <Section title="Informations client">
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Client principal</p>
            <Field label="Nom / Raison sociale" required>
              <input type="text" required value={form.client_nom} onChange={e => update({ client_nom: e.target.value })} className={inputClass} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Email">
                <input type="email" value={form.client_email} onChange={e => update({ client_email: e.target.value })} className={inputClass} />
              </Field>
              <Field label="Telephone">
                <input type="tel" value={form.client_tel} onChange={e => update({ client_tel: e.target.value })} className={inputClass} />
              </Field>
            </div>
            <Field label="Adresse du client">
              <input type="text" value={form.client_adresse} onChange={e => update({ client_adresse: e.target.value })}
                placeholder="Si differente de l'adresse chantier" className={inputClass} />
            </Field>
          </div>

          {/* Foncier & Reglementaire */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Foncier & Reglementaire</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Foncier">
                <SelectWithPrecision value={form.foncier} options={FONCIER_OPTIONS} onChange={v => update({ foncier: v })} placeholder="Precisez le foncier..." />
              </Field>
              <Field label="Surface fonciere (m2)">
                <input type="number" min={0} value={form.surface_fonciere} onChange={e => update({ surface_fonciere: e.target.value })}
                  placeholder="Ex : 2000" className={inputClass} />
              </Field>
            </div>
            <Field label="Numero de parcelles cadastrales">
              <div className="space-y-2">
                {form.parcelles_cadastrales.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={p}
                      onChange={e => {
                        const next = [...form.parcelles_cadastrales]
                        next[i] = e.target.value
                        update({ parcelles_cadastrales: next })
                      }}
                      placeholder="Ex : AB-0123"
                      className={inputClass}
                    />
                    {form.parcelles_cadastrales.length > 1 && (
                      <button
                        type="button"
                        onClick={() => update({ parcelles_cadastrales: form.parcelles_cadastrales.filter((_, idx) => idx !== i) })}
                        className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                        aria-label="Supprimer cette parcelle"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => update({ parcelles_cadastrales: [...form.parcelles_cadastrales, ''] })}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter une parcelle
                </button>
              </div>
            </Field>
            <Field label="Contraintes reglementaires">
              <CheckboxGroupWithPrecision options={CONTRAINTES_REGLEMENTAIRES} values={form.contraintes_reglementaires} onChange={v => update({ contraintes_reglementaires: v })} placeholder="Precisez la contrainte..." />
            </Field>
          </div>

          {/* Contacts supplementaires */}
          {form.clients_supplementaires.map((c, i) => (
            <div key={i} className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Contact {i + 2}</p>
                <button type="button" onClick={() => removeClient(i)} className="text-gray-400 hover:text-red-500 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <Field label="Nom / Raison sociale">
                <input type="text" value={c.nom} onChange={e => updateClient(i, { nom: e.target.value })} className={inputClass} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Email">
                  <input type="email" value={c.email} onChange={e => updateClient(i, { email: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Telephone">
                  <input type="tel" value={c.tel} onChange={e => updateClient(i, { tel: e.target.value })} className={inputClass} />
                </Field>
              </div>
            </div>
          ))}

          <button type="button" onClick={addClient}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors border border-dashed border-gray-300 rounded-lg px-4 py-2.5 w-full justify-center hover:border-gray-400 hover:bg-gray-50">
            <Plus className="w-4 h-4" /> Ajouter un contact supplementaire
          </button>
        </Section>

        {/* ─── Section 3: Budget & Planning ─── */}
        <Section title="Budget & Planning">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Budget travaux estime (EUR)">
              <div className="space-y-2">
                <select
                  value={form.budget_mode}
                  onChange={e => update({ budget_mode: e.target.value as BudgetMode })}
                  className={inputClass}
                >
                  <option value="saisir">Saisir un montant</option>
                  <option value="non_transmis">Non transmis</option>
                  <option value="fourchette">Fourchette</option>
                  <option value="enveloppe">Enveloppe de travaux</option>
                </select>
                {form.budget_mode === 'saisir' && (
                  <input type="number" min={0} value={form.budget_total}
                    onChange={e => update({ budget_total: e.target.value })}
                    placeholder="Ex : 250000" className={inputClass} />
                )}
                {form.budget_mode === 'fourchette' && (
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" min={0} value={form.budget_min}
                      onChange={e => update({ budget_min: e.target.value })}
                      placeholder="Min (EUR)" className={inputClass} />
                    <input type="number" min={0} value={form.budget_max}
                      onChange={e => update({ budget_max: e.target.value })}
                      placeholder="Max (EUR)" className={inputClass} />
                  </div>
                )}
                {form.budget_mode === 'enveloppe' && (
                  <>
                    <input type="number" min={0} value={form.budget_enveloppe}
                      onChange={e => update({ budget_enveloppe: e.target.value })}
                      placeholder="Montant enveloppe (EUR)" className={inputClass} />
                    <input type="text" value={form.budget_precision}
                      onChange={e => update({ budget_precision: e.target.value })}
                      placeholder="Precision (postes inclus, conditions...)" className={inputClass} />
                  </>
                )}
              </div>
            </Field>
            <Field label="Honoraires HT (EUR)">
              <input type="number" min={0} value={form.honoraires_ht} onChange={e => update({ honoraires_ht: e.target.value })}
                placeholder="Ex : 35000" className={inputClass} />
            </Field>
          </div>

          <Field label="Type de financement">
            <CheckboxGroupWithPrecision options={TYPES_FINANCEMENT} values={form.type_financement} onChange={v => update({ type_financement: v })} placeholder="Précisez..." />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Date de debut souhaitee">
              <input type="date" value={form.date_debut} onChange={e => update({ date_debut: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Date de livraison prevue">
              <input type="date" value={form.date_livraison} onChange={e => update({ date_livraison: e.target.value })} className={inputClass} />
            </Field>
          </div>

          <Field label="Duree chantier estimee (semaines)">
            <input type="number" min={1} value={form.duree_chantier_semaines} onChange={e => update({ duree_chantier_semaines: e.target.value })}
              placeholder="Ex : 24" className={inputClass} />
          </Field>

          <Field label="Source du client">
            <SelectWithPrecision value={form.source_client} options={SOURCES_CLIENT} onChange={v => update({ source_client: v })} placeholder="Precisez la source..." />
          </Field>

          <Field label="Apporteur d'affaires">
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={form.apporteur_present === true}
                    onChange={() => update({ apporteur_present: true })} className="accent-gray-900" />
                  <span className="text-sm text-gray-700">Oui</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={form.apporteur_present === false}
                    onChange={() => update({ apporteur_present: false, apporteur_affaire: '', apporteur_email: '', apporteur_tel: '', apporteur_pourcentage: '' })} className="accent-gray-900" />
                  <span className="text-sm text-gray-700">Non</span>
                </label>
              </div>
              {form.apporteur_present && (
                <div className="space-y-3 bg-white border border-gray-200 rounded-lg p-3">
                  <input type="text" value={form.apporteur_affaire}
                    onChange={e => update({ apporteur_affaire: e.target.value })}
                    placeholder="Nom / Societe" className={inputClass} />
                  <div className="grid grid-cols-2 gap-3">
                    <input type="email" value={form.apporteur_email}
                      onChange={e => update({ apporteur_email: e.target.value })}
                      placeholder="Email" className={inputClass} />
                    <input type="tel" value={form.apporteur_tel}
                      onChange={e => update({ apporteur_tel: e.target.value })}
                      placeholder="Telephone" className={inputClass} />
                  </div>
                  <div className="relative">
                    <input type="number" min={0} max={100} step="0.01" value={form.apporteur_pourcentage}
                      onChange={e => update({ apporteur_pourcentage: e.target.value })}
                      placeholder="Pourcentage de commission" className={cn(inputClass, 'pr-8')} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
                  </div>
                </div>
              )}
            </div>
          </Field>

          <Field label="Maturite du projet">
            <RadioGroup options={MATURITES} value={form.maturite_client} onChange={v => update({ maturite_client: v })} />
          </Field>
        </Section>

        {/* ─── Section 4: Psychologie client ─── */}
        <Section title="Profil & psychologie client">
          <p className="text-xs text-gray-400">Ces informations guident le CO dans sa relation avec le client.</p>

          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-800">Q1 -- Comment le client communique-t-il ?</p>
            <RadioGroup options={Q1_OPTIONS} value={form.q1} onChange={v => update({ q1: v })} />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-800">Q2 -- Niveau d&apos;exigence du client ?</p>
            <RadioGroup options={Q2_OPTIONS} value={form.q2} onChange={v => update({ q2: v })} />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-800">Q3 -- Contraintes de planning particulieres ?</p>
            <CheckboxGroupWithPrecision options={Q3_OPTIONS} values={form.q3} onChange={v => update({ q3: v })} placeholder="Précisez..." />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-800">Q4 -- Points de vigilance ?</p>
            <CheckboxGroupWithPrecision options={Q4_OPTIONS} values={form.q4} onChange={v => update({ q4: v })} placeholder="Précisez..." />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-800">Q5 -- Informations hors-contrat importantes pour le CO</p>
            <textarea value={form.q5} onChange={e => update({ q5: e.target.value })}
              placeholder="Tout ce que vous savez sur ce projet et qui n'est pas ecrit dans le contrat..." rows={4}
              className={cn(inputClass, 'resize-none')} />
          </div>
        </Section>

        {/* ─── Section 5: Équipe & Documents ─── */}
        <Section title="Equipe & Documents">
          <div className="space-y-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Equipe principale</p>

            <Field label="CO (Charge d'Operations)" required>
              <select required value={form.co_id} onChange={e => update({ co_id: e.target.value })} className={inputClass}>
                <option value="">-- Selectionner un CO --</option>
                {cos.map(u => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Economiste">
                <select value={form.economiste_id} onChange={e => update({ economiste_id: e.target.value })} className={inputClass}>
                  <option value="">-- Selectionner --</option>
                  {economistes.map(u => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
                </select>
              </Field>
              <Field label="Dessinatrice">
                <select value={form.dessinatrice_id} onChange={e => update({ dessinatrice_id: e.target.value })} className={inputClass}>
                  <option value="">-- Selectionner --</option>
                  {dessinatrices.map(u => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Assistant(e) Travaux">
              <select value={form.at_id} onChange={e => update({ at_id: e.target.value })} className={inputClass}>
                <option value="">-- Selectionner --</option>
                {ats.map(u => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
              </select>
            </Field>
          </div>

          {extraCandidates.length > 0 && (
            <MembresSearch candidates={extraCandidates} selected={form.extra_membres} onToggle={toggleExtra} />
          )}

          {/* New documents */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ajouter des documents</p>
            {newFiles.map((f, i) => (
              <div key={i} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{f.name}</p>
                  <p className="text-xs text-gray-400">{(f.size / 1024).toFixed(0)} Ko</p>
                </div>
                <button type="button" onClick={() => setNewFiles(files => files.filter((_, idx) => idx !== i))}
                  className="ml-3 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <input ref={fileRef} type="file" multiple className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
              onChange={e => { if (e.target.files) { setNewFiles(prev => [...prev, ...Array.from(e.target.files!)]); e.target.value = '' } }} />
            <button type="button" onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors border border-dashed border-gray-300 rounded-lg px-4 py-2.5 w-full justify-center hover:border-gray-400 hover:bg-gray-50">
              <Upload className="w-4 h-4" /> Ajouter des documents
            </button>
          </div>
        </Section>

        {/* Bottom save bar */}
        <div className="flex justify-between items-center pb-8">
          <Link href={`/commercial/projets/${id}`} className={btnSecondary}>
            <ArrowLeft className="w-4 h-4" /> Retour
          </Link>
          <button onClick={handleSave} disabled={saving || !form.co_id || !form.nom || !form.adresse || !form.client_nom} className={btnPrimary}>
            {saving ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Enregistrement...</>
            ) : saved ? (
              <><Check className="w-4 h-4" /> Enregistre</>
            ) : (
              <><Save className="w-4 h-4" /> Enregistrer</>
            )}
          </button>
        </div>

      </div>
    </div>
  )
}
