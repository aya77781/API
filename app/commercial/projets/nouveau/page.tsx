'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronRight, Upload, X, Plus, Trash2, Search } from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ClientSupp {
  nom: string
  email: string
  tel: string
}

interface Step1Data {
  nom: string
  type_chantier: string
  adresse: string
  description: string
  urgence: boolean
  nature_projet: string
  surface_m2: string
  programme: string[]
}

interface Step2Data {
  client_nom: string
  client_email: string
  client_tel: string
  client_adresse: string
  foncier: string
  surface_fonciere: string
  parcelles_cadastrales: string
  contraintes_reglementaires: string[]
  clients_supplementaires: ClientSupp[]
}

interface Step3Data {
  budget_total: string
  date_debut: string
  date_livraison: string
  maturite_client: string
  source_client: string
  apporteur_affaire: string
  type_financement: string[]
  honoraires_ht: string
  duree_chantier_semaines: string
}

interface Step4Data {
  q1: string
  q2: string
  q3: string[]
  q4: string[]
  q5: string
}

interface Step5Data {
  co_id: string
  economiste_id: string
  dessinatrice_id: string
  extra_membres: string[]
  files: File[]
}

interface Utilisateur {
  id: string
  prenom: string
  nom: string
  role: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TYPES_CHANTIER = [
  'Bureaux', 'ERP', 'Entrepôt', 'Commerce', 'Industrie',
  'Logements', 'Équipement sportif', 'Autre',
]

const NATURES_PROJET = ['Neuf', 'Réhabilitation', 'Extension']

const PROGRAMME_OPTIONS = ['ICPE', 'ERP', 'ERT']

const FONCIER_OPTIONS = ['Existant', 'En acquisition']

const CONTRAINTES_REGLEMENTAIRES = ['PPR', 'ABF', 'ZPPAUP', 'ZNIEFF', 'NATURA 2000', 'PNR']

const TYPES_FINANCEMENT = ['CPI', 'CBI', 'Prêt classique', 'Subventions', 'Levée de fonds']

const SOURCES_CLIENT = [
  'Recommandation', 'Ancien client', 'Prospection commerciale',
  "Appel d'offres", 'Site web / réseaux', 'Autre',
]

const MATURITES = [
  'Projet très clair (peu de modifs attendues)',
  'Projet défini mais ajustements probables',
  "Projet encore flou (risque d'avenants élevé)",
]

const Q1_OPTIONS = [
  'Très réactif',
  'Peu disponible',
  'Décide vite',
  'Indécis (beaucoup de retours)',
  "Passe par un intermédiaire",
  'Autre',
]

const Q2_OPTIONS = [
  'Standard',
  'Élevé (attentif aux détails)',
  'Très élevé (perfectionniste)',
  'Focalisé uniquement sur le budget',
]

const Q3_OPTIONS = [
  'Date de livraison impérative',
  "Travaux hors heures d'ouverture",
  'Bâtiment occupé pendant les travaux',
  'Contrainte saisonnière',
  'Aucune contrainte',
]

const Q4_OPTIONS = [
  "Client a eu des problèmes avec d'autres entreprises",
  "Budget serré (risque d'avenants)",
  'Décisions collectives (plusieurs interlocuteurs)',
  'Délais très courts',
  'Contraintes techniques complexes',
  'Riverains / voisinage sensible',
]

const STEPS = [
  'Identité',
  'Clients',
  'Budget & Planning',
  'Psychologie client',
  'Équipe & Docs',
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

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8 flex-wrap gap-y-4">
      {STEPS.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors',
                done ? 'bg-emerald-500 text-white' : active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'
              )}>
                {done ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span className={cn('mt-1.5 text-xs font-medium whitespace-nowrap', active ? 'text-gray-900' : 'text-gray-400')}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('w-12 h-px mb-4 mx-2', i < current ? 'bg-emerald-400' : 'bg-gray-200')} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function RadioGroup({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      {options.map(opt => (
        <label key={opt} className="flex items-start gap-2.5 cursor-pointer">
          <input type="radio" checked={value === opt} onChange={() => onChange(opt)} className="mt-0.5 accent-gray-900" />
          <span className="text-sm text-gray-700">{opt}</span>
        </label>
      ))}
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
          <span className="text-sm text-gray-700">{opt}</span>
        </label>
      ))}
    </div>
  )
}

function QuestionBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-800">{label}</p>
      {children}
    </div>
  )
}

// ─── Step 1: Identité du projet ───────────────────────────────────────────────

function Step1Form({ data, onChange, onNext }: { data: Step1Data; onChange: (d: Partial<Step1Data>) => void; onNext: () => void }) {
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onNext()
  }
  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h2 className="text-sm font-semibold text-gray-900">Identité du projet</h2>

      <Field label="Nom du projet" required>
        <input type="text" required value={data.nom} onChange={e => onChange({ nom: e.target.value })}
          placeholder="Ex : Rénovation bureaux Zone Industrielle" className={inputClass} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Type de chantier">
          <select value={data.type_chantier} onChange={e => onChange({ type_chantier: e.target.value })} className={inputClass}>
            <option value="">— Sélectionner —</option>
            {TYPES_CHANTIER.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Urgence">
          <div className="flex items-center gap-3 h-[38px]">
            <button
              type="button"
              onClick={() => onChange({ urgence: !data.urgence })}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0',
                data.urgence ? 'bg-red-500' : 'bg-gray-200'
              )}
            >
              <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                data.urgence ? 'translate-x-6' : 'translate-x-1')} />
            </button>
            <span className="text-sm text-gray-600">{data.urgence ? 'Urgent' : 'Normal'}</span>
          </div>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Nature du projet">
          <select value={data.nature_projet} onChange={e => onChange({ nature_projet: e.target.value })} className={inputClass}>
            <option value="">— Sélectionner —</option>
            {NATURES_PROJET.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
        <Field label="Surface du projet (m²)">
          <input type="number" min={0} value={data.surface_m2} onChange={e => onChange({ surface_m2: e.target.value })}
            placeholder="Ex : 850" className={inputClass} />
        </Field>
      </div>

      <Field label="Adresse du chantier" required>
        <input type="text" required value={data.adresse} onChange={e => onChange({ adresse: e.target.value })}
          placeholder="Ex : 12 rue de la Paix, 75001 Paris" className={inputClass} />
      </Field>

      <Field label="Programme">
        <CheckboxGroup options={PROGRAMME_OPTIONS} values={data.programme} onChange={v => onChange({ programme: v })} />
      </Field>

      <Field label="Numéro d'affaire">
        <input type="text" disabled value="Auto-généré à la création" className={cn(inputClass, 'bg-gray-50 text-gray-400 cursor-not-allowed')} />
      </Field>

      <Field label="Description du projet">
        <textarea value={data.description} onChange={e => onChange({ description: e.target.value })}
          placeholder="Contexte, objectifs, spécificités du projet..." rows={3}
          className={cn(inputClass, 'resize-none')} />
      </Field>

      <div className="flex justify-end pt-2">
        <button type="submit" className={btnPrimary}>
          Suivant <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </form>
  )
}

// ─── Step 2: Clients ──────────────────────────────────────────────────────────

function Step2Form({ data, onChange, onNext, onBack }: {
  data: Step2Data
  onChange: (d: Partial<Step2Data>) => void
  onNext: () => void
  onBack: () => void
}) {
  function addClient() {
    onChange({ clients_supplementaires: [...data.clients_supplementaires, { nom: '', email: '', tel: '' }] })
  }
  function removeClient(i: number) {
    onChange({ clients_supplementaires: data.clients_supplementaires.filter((_, idx) => idx !== i) })
  }
  function updateClient(i: number, patch: Partial<ClientSupp>) {
    const updated = data.clients_supplementaires.map((c, idx) => idx === i ? { ...c, ...patch } : c)
    onChange({ clients_supplementaires: updated })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onNext()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h2 className="text-sm font-semibold text-gray-900">Informations client</h2>

      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Client principal</p>
        <Field label="Nom / Raison sociale" required>
          <input type="text" required value={data.client_nom} onChange={e => onChange({ client_nom: e.target.value })} className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Email">
            <input type="email" value={data.client_email} onChange={e => onChange({ client_email: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Téléphone">
            <input type="tel" value={data.client_tel} onChange={e => onChange({ client_tel: e.target.value })} className={inputClass} />
          </Field>
        </div>

        <Field label="Adresse du client">
          <input type="text" value={data.client_adresse} onChange={e => onChange({ client_adresse: e.target.value })}
            placeholder="Si différente de l'adresse chantier" className={inputClass} />
        </Field>
      </div>

      {/* Foncier & Réglementaire */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Foncier & Réglementaire</p>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Foncier">
            <select value={data.foncier} onChange={e => onChange({ foncier: e.target.value })} className={inputClass}>
              <option value="">— Sélectionner —</option>
              {FONCIER_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </Field>
          <Field label="Surface foncière (m²)">
            <input type="number" min={0} value={data.surface_fonciere} onChange={e => onChange({ surface_fonciere: e.target.value })}
              placeholder="Ex : 2000" className={inputClass} />
          </Field>
        </div>

        <Field label="Numéro de parcelles cadastrales">
          <input type="text" value={data.parcelles_cadastrales} onChange={e => onChange({ parcelles_cadastrales: e.target.value })}
            placeholder="Ex : AB-0123, AB-0124" className={inputClass} />
        </Field>

        <Field label="Contraintes réglementaires">
          <CheckboxGroup options={CONTRAINTES_REGLEMENTAIRES} values={data.contraintes_reglementaires} onChange={v => onChange({ contraintes_reglementaires: v })} />
        </Field>
      </div>

      {data.clients_supplementaires.map((c, i) => (
        <div key={i} className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-4 relative">
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
            <Field label="Téléphone">
              <input type="tel" value={c.tel} onChange={e => updateClient(i, { tel: e.target.value })} className={inputClass} />
            </Field>
          </div>
        </div>
      ))}

      <button type="button" onClick={addClient}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors border border-dashed border-gray-300 rounded-lg px-4 py-2.5 w-full justify-center hover:border-gray-400 hover:bg-gray-50">
        <Plus className="w-4 h-4" />
        Ajouter un contact supplémentaire
      </button>

      <div className="flex justify-between pt-2">
        <button type="button" onClick={onBack} className={btnSecondary}>Retour</button>
        <button type="submit" className={btnPrimary}>Suivant <ChevronRight className="w-4 h-4" /></button>
      </div>
    </form>
  )
}

// ─── Step 3: Budget & Planning ─────────────────────────────────────────────────

function Step3Form({ data, onChange, onNext, onBack }: {
  data: Step3Data
  onChange: (d: Partial<Step3Data>) => void
  onNext: () => void
  onBack: () => void
}) {
  return (
    <div className="space-y-5">
      <h2 className="text-sm font-semibold text-gray-900">Budget & Planning</h2>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Budget travaux estimé (€)">
          <input type="number" min={0} value={data.budget_total} onChange={e => onChange({ budget_total: e.target.value })}
            placeholder="Ex : 250000" className={inputClass} />
        </Field>
        <Field label="Honoraires HT (€)">
          <input type="number" min={0} value={data.honoraires_ht} onChange={e => onChange({ honoraires_ht: e.target.value })}
            placeholder="Ex : 35000" className={inputClass} />
        </Field>
      </div>

      <Field label="Type de financement">
        <CheckboxGroup options={TYPES_FINANCEMENT} values={data.type_financement} onChange={v => onChange({ type_financement: v })} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Date de début souhaitée">
          <input type="date" value={data.date_debut} onChange={e => onChange({ date_debut: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Date de livraison prévue">
          <input type="date" value={data.date_livraison} onChange={e => onChange({ date_livraison: e.target.value })} className={inputClass} />
        </Field>
      </div>

      <Field label="Durée chantier estimée (semaines)">
        <input type="number" min={1} value={data.duree_chantier_semaines} onChange={e => onChange({ duree_chantier_semaines: e.target.value })}
          placeholder="Ex : 24" className={inputClass} />
      </Field>

      <Field label="Source du client">
        <select value={data.source_client} onChange={e => onChange({ source_client: e.target.value })} className={inputClass}>
          <option value="">— Sélectionner —</option>
          {SOURCES_CLIENT.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>

      <Field label="Apporteur d'affaires">
        <input type="text" value={data.apporteur_affaire} onChange={e => onChange({ apporteur_affaire: e.target.value })}
          placeholder="Nom de la personne ou société ayant apporté le projet" className={inputClass} />
      </Field>

      <Field label="Maturité du projet">
        <div className="space-y-2 pt-1">
          {MATURITES.map(m => (
            <label key={m} className="flex items-start gap-2.5 cursor-pointer">
              <input type="radio" checked={data.maturite_client === m} onChange={() => onChange({ maturite_client: m })} className="mt-0.5 accent-gray-900" />
              <span className="text-sm text-gray-700">{m}</span>
            </label>
          ))}
        </div>
      </Field>

      <div className="flex justify-between pt-2">
        <button type="button" onClick={onBack} className={btnSecondary}>Retour</button>
        <button type="button" onClick={onNext} className={btnPrimary}>Suivant <ChevronRight className="w-4 h-4" /></button>
      </div>
    </div>
  )
}

// ─── Step 4: Psychologie client ────────────────────────────────────────────────

function Step4Form({ data, onChange, onNext, onBack }: {
  data: Step4Data
  onChange: (d: Partial<Step4Data>) => void
  onNext: () => void
  onBack: () => void
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold text-gray-900">Profil & psychologie client</h2>
      <p className="text-xs text-gray-400">Ces informations guident le CO dans sa relation avec le client.</p>

      <QuestionBlock label="Q1 — Comment le client communique-t-il ?">
        <RadioGroup options={Q1_OPTIONS} value={data.q1} onChange={v => onChange({ q1: v })} />
      </QuestionBlock>

      <QuestionBlock label="Q2 — Niveau d'exigence du client ?">
        <RadioGroup options={Q2_OPTIONS} value={data.q2} onChange={v => onChange({ q2: v })} />
      </QuestionBlock>

      <QuestionBlock label="Q3 — Contraintes de planning particulières ?">
        <CheckboxGroup options={Q3_OPTIONS} values={data.q3} onChange={v => onChange({ q3: v })} />
      </QuestionBlock>

      <QuestionBlock label="Q4 — Points de vigilance ?">
        <CheckboxGroup options={Q4_OPTIONS} values={data.q4} onChange={v => onChange({ q4: v })} />
      </QuestionBlock>

      <QuestionBlock label="Q5 — Informations hors-contrat importantes pour le CO">
        <textarea value={data.q5} onChange={e => onChange({ q5: e.target.value })}
          placeholder="Tout ce que vous savez sur ce projet et qui n'est pas écrit dans le contrat..." rows={4}
          className={cn(inputClass, 'resize-none')} />
      </QuestionBlock>

      <div className="flex justify-between pt-2">
        <button type="button" onClick={onBack} className={btnSecondary}>Retour</button>
        <button type="button" onClick={onNext} className={btnPrimary}>Suivant <ChevronRight className="w-4 h-4" /></button>
      </div>
    </div>
  )
}

// ─── Membres search ───────────────────────────────────────────────────────────

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

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Membres supplémentaires au groupe chat</p>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher par nom ou rôle..."
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
                <button onClick={() => onToggle(id)} className="ml-0.5 hover:text-gray-300">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )
          })}
        </div>
      )}
      <div className="border border-gray-100 rounded-lg bg-gray-50 max-h-44 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">Aucun résultat</p>
        ) : (
          filtered.map(u => (
            <label key={u.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-100 transition-colors">
              <input type="checkbox" checked={selected.includes(u.id)} onChange={() => onToggle(u.id)} className="accent-gray-900 flex-shrink-0" />
              <span className="text-sm text-gray-700 flex-1">{u.prenom} {u.nom}</span>
              <span className="text-xs text-gray-400">{u.role}</span>
            </label>
          ))
        )}
      </div>
    </div>
  )
}

// ─── Step 5: Équipe & Documents ────────────────────────────────────────────────

function Step5Form({ data, onChange, step1, onBack, onSubmit, loading }: {
  data: Step5Data
  onChange: (d: Partial<Step5Data>) => void
  step1: Step1Data
  onBack: () => void
  onSubmit: () => void
  loading: boolean
}) {
  const [cos, setCos] = useState<Utilisateur[]>([])
  const [economistes, setEconomistes] = useState<Utilisateur[]>([])
  const [dessinatrices, setDessinatrices] = useState<Utilisateur[]>([])
  const [allUsers, setAllUsers] = useState<Utilisateur[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: users } = await supabase.schema('app').from('utilisateurs')
        .select('id, prenom, nom, role').eq('actif', true).order('prenom')
      if (!users) return
      setCos(users.filter((u: Utilisateur) => u.role === 'co'))
      setEconomistes(users.filter((u: Utilisateur) => u.role === 'economiste'))
      setDessinatrices(users.filter((u: Utilisateur) => u.role === 'dessinatrice'))
      setAllUsers(users)
    }
    load()
  }, [])

  const coreIds = new Set([data.co_id, data.economiste_id, data.dessinatrice_id].filter(Boolean))
  const extraCandidates = allUsers.filter(u => !coreIds.has(u.id))

  function toggleExtra(id: string) {
    const cur = data.extra_membres
    onChange({ extra_membres: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] })
  }

  function addFiles(newFiles: FileList) {
    onChange({ files: [...data.files, ...Array.from(newFiles)] })
  }

  function removeFile(i: number) {
    onChange({ files: data.files.filter((_, idx) => idx !== i) })
  }

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold text-gray-900">Équipe & Documents</h2>

      {/* Recap rapide */}
      <div className="bg-gray-50 rounded-lg border border-gray-100 px-4 py-3 space-y-1">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Récapitulatif</p>
        <div className="flex gap-2 text-sm"><span className="text-gray-400 w-28">Projet</span><span className="text-gray-900 font-medium">{step1.nom}</span></div>
        <div className="flex gap-2 text-sm"><span className="text-gray-400 w-28">Adresse</span><span className="text-gray-900">{step1.adresse}</span></div>
        {step1.urgence && (
          <div className="flex gap-2 text-sm"><span className="text-gray-400 w-28">Urgence</span><span className="text-red-600 font-medium">Urgent</span></div>
        )}
      </div>

      {/* Équipe principale */}
      <div className="space-y-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Équipe principale</p>

        <Field label="CO (Chargé d'Opérations)" required>
          <select required value={data.co_id} onChange={e => onChange({ co_id: e.target.value })} className={inputClass}>
            <option value="">— Sélectionner un CO —</option>
            {cos.map(u => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Économiste">
            <select value={data.economiste_id} onChange={e => onChange({ economiste_id: e.target.value })} className={inputClass}>
              <option value="">— Sélectionner —</option>
              {economistes.map(u => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
            </select>
          </Field>
          <Field label="Dessinatrice">
            <select value={data.dessinatrice_id} onChange={e => onChange({ dessinatrice_id: e.target.value })} className={inputClass}>
              <option value="">— Sélectionner —</option>
              {dessinatrices.map(u => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
            </select>
          </Field>
        </div>
      </div>

      {/* Membres supplémentaires */}
      {extraCandidates.length > 0 && (
        <MembresSearch
          candidates={extraCandidates}
          selected={data.extra_membres}
          onToggle={toggleExtra}
        />
      )}

      {/* Documents */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Documents initiaux (optionnel)</p>

        {data.files.map((f, i) => (
          <div key={i} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-700 truncate">{f.name}</p>
              <p className="text-xs text-gray-400">{(f.size / 1024).toFixed(0)} Ko</p>
            </div>
            <button type="button" onClick={() => removeFile(i)} className="ml-3 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}

        <input ref={fileRef} type="file" multiple className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
          onChange={e => { if (e.target.files) { addFiles(e.target.files); e.target.value = '' } }} />
        <button type="button" onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors border border-dashed border-gray-300 rounded-lg px-4 py-2.5 w-full justify-center hover:border-gray-400 hover:bg-gray-50">
          <Upload className="w-4 h-4" />
          Ajouter des documents
        </button>
      </div>

      <div className="flex justify-between pt-2">
        <button type="button" onClick={onBack} disabled={loading} className={btnSecondary}>Retour</button>
        <button type="button" onClick={onSubmit} disabled={loading || !data.co_id} className={btnPrimary}>
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Création en cours...
            </>
          ) : (
            <>Créer le projet <Check className="w-4 h-4" /></>
          )}
        </button>
      </div>
    </div>
  )
}

// ─── Page principale ───────────────────────────────────────────────────────────

export default function NouveauProjetPage() {
  const router = useRouter()
  const { user } = useUser()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [step1, setStep1] = useState<Step1Data>({ nom: '', type_chantier: '', adresse: '', description: '', urgence: false, nature_projet: '', surface_m2: '', programme: [] })
  const [step2, setStep2] = useState<Step2Data>({ client_nom: '', client_email: '', client_tel: '', client_adresse: '', foncier: '', surface_fonciere: '', parcelles_cadastrales: '', contraintes_reglementaires: [], clients_supplementaires: [] })
  const [step3, setStep3] = useState<Step3Data>({ budget_total: '', date_debut: '', date_livraison: '', maturite_client: '', source_client: '', apporteur_affaire: '', type_financement: [], honoraires_ht: '', duree_chantier_semaines: '' })
  const [step4, setStep4] = useState<Step4Data>({ q1: '', q2: '', q3: [], q4: [], q5: '' })
  const [step5, setStep5] = useState<Step5Data>({ co_id: '', economiste_id: '', dessinatrice_id: '', extra_membres: [], files: [] })

  function buildPsychologie(): string {
    const lines: string[] = []
    if (step4.q1) lines.push(`Communication : ${step4.q1}`)
    if (step4.q2) lines.push(`Exigence : ${step4.q2}`)
    if (step3.maturite_client) lines.push(`Maturité : ${step3.maturite_client}`)
    return lines.join('\n')
  }

  function buildAlertes(): string {
    const lines: string[] = []
    if (step4.q3.length) lines.push(`Contraintes planning : ${step4.q3.join(', ')}`)
    if (step4.q4.length) lines.push(`Points de vigilance : ${step4.q4.join(', ')}`)
    if (step1.urgence) lines.push('URGENT')
    return lines.join('\n')
  }

  async function handleSubmit() {
    if (!user || !step5.co_id) return
    setSubmitting(true)
    setError('')

    const supabase = createClient()

    try {
      // 1. Créer le projet
      const remarque = JSON.stringify({
        description: step1.description || null,
        urgence: step1.urgence,
        nature_projet: step1.nature_projet || null,
        programme: step1.programme.length ? step1.programme : null,
        clients_supplementaires: step2.clients_supplementaires.filter(c => c.nom),
        client_adresse: step2.client_adresse || null,
        foncier: step2.foncier || null,
        surface_fonciere: step2.surface_fonciere ? parseFloat(step2.surface_fonciere) : null,
        parcelles_cadastrales: step2.parcelles_cadastrales || null,
        contraintes_reglementaires: step2.contraintes_reglementaires.length ? step2.contraintes_reglementaires : null,
        source_client: step3.source_client || null,
        apporteur_affaire: step3.apporteur_affaire || null,
        maturite_client: step3.maturite_client || null,
        type_financement: step3.type_financement.length ? step3.type_financement : null,
        honoraires_ht: step3.honoraires_ht ? parseFloat(step3.honoraires_ht) : null,
        duree_chantier_semaines: step3.duree_chantier_semaines ? parseInt(step3.duree_chantier_semaines) : null,
        dessinatrice_id: step5.dessinatrice_id || null,
        extra_membres: step5.extra_membres,
      })

      const { data: projet, error: errProjet } = await supabase.schema('app').from('projets')
        .insert({
          nom: step1.nom,
          type_chantier: step1.type_chantier || null,
          adresse: step1.adresse,
          budget_total: step3.budget_total ? parseFloat(step3.budget_total) : null,
          surface_m2: step1.surface_m2 ? parseFloat(step1.surface_m2) : null,
          date_debut: step3.date_debut || null,
          date_livraison: step3.date_livraison || null,
          co_id: step5.co_id,
          economiste_id: step5.economiste_id || null,
          commercial_id: user.id,
          client_nom: step2.client_nom,
          client_email: step2.client_email || null,
          client_tel: step2.client_tel || null,
          psychologie_client: buildPsychologie() || null,
          alertes_cles: buildAlertes() || null,
          infos_hors_contrat: step4.q5 || null,
          remarque,
          statut: 'Analyse',
          phase: 'aps',
        })
        .select('id, nom, reference')
        .single()

      if (errProjet || !projet) throw new Error(errProjet?.message ?? 'Erreur création projet')

      const projetId = projet.id
      const reference = projet.reference ?? projet.nom

      // 2. Créer le groupe de chat
      const { data: groupe } = await supabase.schema('app').from('chat_groupes')
        .insert({
          nom: `${reference} — ${projet.nom} — Général`,
          type: 'projet',
          projet_id: projetId,
          cree_par: user.id,
          actif: true,
        })
        .select('id')
        .single()

      if (groupe) {
        // 3. Membres du groupe
        const memberIds = Array.from(new Set([
          user.id,
          step5.co_id,
          step5.economiste_id,
          step5.dessinatrice_id,
          ...step5.extra_membres,
        ].filter(Boolean))) as string[]

        await supabase.schema('app').from('chat_membres').insert(
          memberIds.map(uid => ({
            groupe_id: groupe.id,
            utilisateur_id: uid,
            est_admin: uid === user.id,
          }))
        )

        // 4. Premier message
        await supabase.schema('app').from('chat_messages').insert({
          groupe_id: groupe.id,
          auteur_id: user.id,
          contenu: `Projet ${reference} créé. Bienvenue à l'équipe !`,
          mentions: null,
        })
      }

      // 5. Alertes
      const alertes: { utilisateur_id: string; type: string; titre: string; message: string; priorite: string; lue: boolean; projet_id: string }[] = []

      alertes.push({
        projet_id: projetId,
        utilisateur_id: step5.co_id,
        type: 'passation',
        titre: 'Nouveau projet à prendre en charge',
        message: `${projet.nom} — Réunion de passation à planifier`,
        priorite: 'high',
        lue: false,
      })

      if (step5.economiste_id) alertes.push({
        projet_id: projetId,
        utilisateur_id: step5.economiste_id,
        type: 'affectation',
        titre: 'Vous êtes affecté à un nouveau projet',
        message: `${projet.nom} (${reference})`,
        priorite: 'normal',
        lue: false,
      })

      if (step5.dessinatrice_id) alertes.push({
        projet_id: projetId,
        utilisateur_id: step5.dessinatrice_id,
        type: 'affectation',
        titre: 'Vous êtes affecté à un nouveau projet',
        message: `${projet.nom} (${reference})`,
        priorite: 'normal',
        lue: false,
      })

      for (const uid of step5.extra_membres) {
        alertes.push({
          projet_id: projetId,
          utilisateur_id: uid,
          type: 'affectation',
          titre: 'Vous avez été ajouté au projet',
          message: `${projet.nom} (${reference})`,
          priorite: 'normal',
          lue: false,
        })
      }

      if (alertes.length) await supabase.schema('app').from('alertes').insert(alertes)

      // 6. Upload documents
      if (step5.files.length) {
        for (const file of step5.files) {
          const path = `${projetId}/00_client/${file.name}`
          const { error: uploadErr } = await supabase.storage.from('projets').upload(path, file, { upsert: true })
          if (!uploadErr) {
            await supabase.schema('app').from('documents').insert({
              projet_id: projetId,
              uploaded_by: user.id,
              nom_fichier: file.name,
              type_doc: 'autre',
              storage_path: path,
              taille_octets: file.size,
              tags: [],
            })
          }
        }
      }

      // 7. Redirect
      router.push(`/commercial/projets/${projetId}?created=1&ref=${encodeURIComponent(reference)}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#fafaf8] py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-lg font-semibold text-gray-900">Nouveau projet</h1>
          <p className="text-sm text-gray-400 mt-1">Créez un dossier en 5 étapes</p>
        </div>

        <Stepper current={step} />

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
          {error && (
            <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {step === 0 && (
            <Step1Form data={step1} onChange={d => setStep1(s => ({ ...s, ...d }))} onNext={() => setStep(1)} />
          )}
          {step === 1 && (
            <Step2Form data={step2} onChange={d => setStep2(s => ({ ...s, ...d }))} onNext={() => setStep(2)} onBack={() => setStep(0)} />
          )}
          {step === 2 && (
            <Step3Form data={step3} onChange={d => setStep3(s => ({ ...s, ...d }))} onNext={() => setStep(3)} onBack={() => setStep(1)} />
          )}
          {step === 3 && (
            <Step4Form data={step4} onChange={d => setStep4(s => ({ ...s, ...d }))} onNext={() => setStep(4)} onBack={() => setStep(2)} />
          )}
          {step === 4 && (
            <Step5Form
              data={step5}
              onChange={d => setStep5(s => ({ ...s, ...d }))}
              step1={step1}
              onBack={() => setStep(3)}
              onSubmit={handleSubmit}
              loading={submitting}
            />
          )}
        </div>
      </div>
    </div>
  )
}
