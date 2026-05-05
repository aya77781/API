'use client'

import { useEffect, useState, useMemo, useRef, useTransition } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@/hooks/useUser'
import {
  ArrowLeft, Lightbulb, FileText, Award, FolderInput, Scale, Building2, Stamp, Hammer, FolderCheck, FileWarning,
  ChevronDown, Eye, Upload, CheckCircle, Plus, X, Pencil, Trash2,
  FolderOpen, Download, Search, Send, MessageSquare, Calculator, Clock, Loader2, Inbox,
} from 'lucide-react'
import { livrerDemande, marquerEnCours } from '@/app/_actions/conception'
import { createClient } from '@/lib/supabase/client'
import { Abbr } from '@/components/shared/Abbr'
import { StatutBadge } from '@/components/ui/Badge'
import { formatCurrency, PHASE_ORDER } from '@/lib/utils'
import DceComparatifDetail from '@/components/economiste/DceComparatifDetail'

// ─── Types ────────────────────────────────────────────────────────────────────

type Projet = {
  id: string; nom: string; reference: string | null; type_chantier: string | null
  surface_m2: number | null; adresse: string | null; statut: string
  budget_total: number | null; client_nom: string | null
  date_debut: string | null; date_livraison: string | null
  co_id: string | null; commercial_id: string | null
  economiste_id: string | null; dessinatrice_id: string | null
}

type Plan = {
  id: string; projet_nom: string; phase: string; type_plan: string
  indice: string; lot: string | null; statut: string; description: string | null
  fichier_path: string | null; fichier_nom: string | null
  personnes_a_valider: string[] | null; personnes_a_voir: string[] | null
  economiste_id: string | null; created_at: string
}

type Utilisateur = { id: string; prenom: string; nom: string; role: string }
type LotOption   = { id: string; corps_etat: string }
type PublicLot   = { id: string; nom: string; ordre: number; nb_offres: number }
type Commentaire = { id: string; plan_id: string; utilisateur_id: string; contenu: string; created_at: string }

type FormState = {
  indice: string; lot: string; description: string
  personnes_a_valider: string[]; personnes_a_voir: string[]
  fichier: File | null; fichier_nom: string | null
}
const EMPTY: FormState = {
  indice: 'A', lot: '', description: '',
  personnes_a_valider: [], personnes_a_voir: [],
  fichier: null, fichier_nom: null,
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS: { id: string; label: React.ReactNode; icon: typeof Lightbulb; phase: string; type_plan: string }[] = [
  { id: 'APS',         label: <Abbr k="APS" />,                 icon: Lightbulb,   phase: 'conception',   type_plan: 'APS' },
  { id: 'APD',         label: <Abbr k="APD" />,                 icon: FileText,    phase: 'conception',   type_plan: 'APD' },
  { id: 'PC',          label: <Abbr k="PC" />,                  icon: Stamp,       phase: 'conception',   type_plan: 'PC' },
  { id: 'AT',          label: <abbr title="Autorisation de Travaux" className="cursor-help no-underline border-b border-dotted border-gray-400 hover:border-current">AT</abbr>, icon: Award, phase: 'conception', type_plan: 'AT' },
  { id: 'DCE',         label: <Abbr k="DCE" />,                 icon: FolderInput, phase: 'consultation', type_plan: 'DCE' },
  { id: 'EXE',         label: <Abbr k="EXE" />,                 icon: Hammer,      phase: 'chantier',     type_plan: 'EXE' },
  { id: 'DOE',         label: <Abbr k="DOE" />,                 icon: FolderCheck, phase: 'cloture',      type_plan: 'DOE' },
  { id: 'avenant',     label: 'Avenant',                        icon: FileWarning, phase: 'chantier',     type_plan: 'avenant' },
  { id: 'comparatif',  label: <>Comparatif <Abbr k="ST" /></>,  icon: Scale,       phase: '',             type_plan: '' },
]

const STATUT_COLOR: Record<string, string> = {
  en_cours: 'bg-amber-100 text-amber-700', soumis: 'bg-blue-100 text-blue-700',
  valide: 'bg-green-100 text-green-700', refuse: 'bg-red-100 text-red-700',
  archive: 'bg-gray-100 text-gray-500',
}

// ─── UserSearch ───────────────────────────────────────────────────────────────

function UserSearch({ label, color, users, selected, onChange }: {
  label: string; color: 'purple' | 'sky'; users: Utilisateur[]; selected: string[]; onChange: (ids: string[]) => void
}) {
  const [query, setQuery] = useState('')
  const filtered = users.filter(u => !query.trim() ||
    `${u.prenom} ${u.nom}`.toLowerCase().includes(query.toLowerCase()) ||
    u.role.toLowerCase().includes(query.toLowerCase()))
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
  const pillClass = color === 'purple' ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-sky-100 text-sky-800 border border-sky-200'
  const badgeClass = color === 'purple' ? 'bg-purple-600 text-white' : 'bg-sky-500 text-white'
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 mb-1">
        {color === 'purple' ? <CheckCircle className="w-3.5 h-3.5 text-purple-600" /> : <Eye className="w-3.5 h-3.5 text-sky-500" />}
        <label className={`text-xs font-semibold ${color === 'purple' ? 'text-purple-700' : 'text-sky-600'}`}>{label}</label>
        {selected.length > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${badgeClass}`}>{selected.length}</span>}
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1">
          {selected.map(id => { const u = users.find(u => u.id === id); if (!u) return null; return (
            <span key={id} className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${pillClass}`}>
              {u.prenom} {u.nom}
              <button onClick={() => toggle(id)} className="hover:opacity-70 ml-0.5"><X className="w-2.5 h-2.5" /></button>
            </span>
          )})}
        </div>
      )}
      {users.length === 0 ? (
        <p className="text-xs text-gray-400 italic px-1 py-1.5">Aucun membre dans ce projet</p>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher..."
              className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 placeholder-gray-300" />
            {query && <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>}
          </div>
          <div className="border border-gray-100 rounded-lg bg-gray-50 max-h-36 overflow-y-auto">
            {filtered.length === 0 ? <p className="text-xs text-gray-400 text-center py-3">Aucun resultat</p>
            : filtered.map(u => (
              <label key={u.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-100 transition-colors">
                <input type="checkbox" checked={selected.includes(u.id)} onChange={() => toggle(u.id)} className="accent-gray-900 flex-shrink-0" />
                <span className="text-sm text-gray-700 flex-1">{u.prenom} {u.nom}</span>
                <span className="text-xs text-gray-400">{u.role}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// Mapping onglet → type de demande commerciale (plan_*)
const DEMANDE_TYPE_FOR_TAB: Record<string, string> = {
  APS: 'plan_intention',
  APD: 'plan_proposition',
  AT: 'plan_apd',
}

type DemandePlan = {
  id: string
  projet_id: string
  type: string | null
  statut: string | null
  version: number | null
  message_demandeur: string | null
  date_livraison_souhaitee: string | null
  date_livraison_prevue: string | null
  demandeur_id: string | null
  livrable_url: string | null
}

export default function DessinProjetDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const id = params.id as string
  const supabase = useMemo(() => createClient(), [])
  const { user } = useUser()

  const [projet, setProjet]         = useState<Projet | null>(null)
  const [plans, setPlans]           = useState<Plan[]>([])
  const [users, setUsers]           = useState<Utilisateur[]>([])
  const [lots, setLots]             = useState<LotOption[]>([])
  const [loading, setLoading]       = useState(true)
  const [activeTab, setActiveTab]   = useState(() => searchParams?.get('tab') || 'APS')

  // Demandes commerciales (plan_*)
  const [demandesPlan, setDemandesPlan] = useState<DemandePlan[]>([])
  const [showLivrerModal, setShowLivrerModal] = useState<DemandePlan | null>(null)
  const [livrerPlanId, setLivrerPlanId] = useState<string>('')
  const [livrerPending, startLivrerTransition] = useTransition()
  const [livrerToast, setLivrerToast] = useState<string | null>(null)

  // Form
  const [showForm, setShowForm]     = useState(false)
  const [editPlan, setEditPlan]     = useState<Plan | null>(null)
  const [form, setForm]             = useState<FormState>(EMPTY)
  const [saving, setSaving]         = useState(false)
  const fileRef                     = useRef<HTMLInputElement>(null)

  // Detail
  const [selPlan, setSelPlan]       = useState<Plan | null>(null)
  const [commentaires, setCommentaires] = useState<Commentaire[]>([])
  const [newComment, setNewComment] = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const commentEndRef               = useRef<HTMLDivElement>(null)

  // Validation modale
  const [showValidateModal, setShowValidateModal] = useState(false)
  const [selectedEcoId, setSelectedEcoId]         = useState('')
  const [validating, setValidating]               = useState(false)

  // ── Load ──
  async function refresh() {
    const [{ data: projData }, { data: plansData }, { data: usersData }, { data: demData }] = await Promise.all([
      supabase.schema('app').from('projets').select('*').eq('id', id).single(),
      supabase.schema('app').from('dessin_plans').select('*').order('created_at', { ascending: false }),
      supabase.schema('app').from('utilisateurs').select('id, prenom, nom, role').eq('actif', true),
      supabase.schema('app').from('demandes_travail')
        .select('id, projet_id, type, statut, version, message_demandeur, date_livraison_souhaitee, date_livraison_prevue, demandeur_id, livrable_url')
        .eq('projet_id', id)
        .in('type', ['plan_intention', 'plan_proposition', 'plan_apd'])
        .order('date_demande', { ascending: false }),
    ])
    const proj = projData as Projet | null
    setProjet(proj)
    const allPlans = (plansData ?? []) as Plan[]
    if (proj) setPlans(allPlans.filter(p => p.projet_nom.toLowerCase() === proj.nom.toLowerCase()))
    setUsers((usersData as Utilisateur[]) ?? [])
    setDemandesPlan((demData ?? []) as DemandePlan[])
  }

  useEffect(() => {
    async function load() {
      await refresh()
      setLoading(false)
    }
    load()
  }, [id])

  useEffect(() => {
    if (!projet) return
    supabase.schema('app').from('lots').select('id, corps_etat').eq('projet_id', projet.id).order('numero')
      .then(({ data }) => setLots((data ?? []) as LotOption[]))
  }, [projet?.id])

  // ── Commentaires ──
  async function fetchCommentaires(planId: string) {
    const { data } = await supabase.schema('app').from('dessin_plan_commentaires')
      .select('*').eq('plan_id', planId).order('created_at', { ascending: true })
    setCommentaires((data as Commentaire[]) ?? [])
  }
  async function sendComment() {
    if (!selPlan || !newComment.trim() || !user) return
    setSendingComment(true)
    const { data: util } = await supabase.schema('app').from('utilisateurs').select('id').eq('email', user.email).single()
    if (util) {
      await supabase.schema('app').from('dessin_plan_commentaires').insert([{ plan_id: selPlan.id, utilisateur_id: util.id, contenu: newComment.trim() }])
      setNewComment('')
      await fetchCommentaires(selPlan.id)
      setTimeout(() => commentEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
    setSendingComment(false)
  }
  useEffect(() => {
    if (selPlan) fetchCommentaires(selPlan.id)
    else setCommentaires([])
    setNewComment('')
  }, [selPlan?.id])

  // ── CRUD ──
  function getPhaseForTab() { return TABS.find(t => t.id === activeTab)?.phase ?? 'conception' }
  function getTypePlanForTab() { return TABS.find(t => t.id === activeTab)?.type_plan ?? activeTab }

  function resetForm() { setForm(EMPTY); setShowForm(false); setEditPlan(null) }

  async function savePlan() {
    if (!projet) return
    setSaving(true)
    let fichier_path: string | null = null
    if (form.fichier) {
      const path = `plans/${getPhaseForTab()}/${Date.now()}_${form.fichier.name}`
      const { error } = await supabase.storage.from('projets').upload(path, form.fichier, { upsert: true })
      if (!error) fichier_path = path
    }
    await supabase.schema('app').from('dessin_plans').insert([{
      projet_nom: projet.nom, phase: getPhaseForTab(), type_plan: getTypePlanForTab(),
      indice: form.indice, lot: form.lot, statut: 'en_cours', description: form.description,
      fichier_path, fichier_nom: form.fichier?.name ?? null,
      personnes_a_valider: form.personnes_a_valider.length > 0 ? form.personnes_a_valider : null,
      personnes_a_voir: form.personnes_a_voir.length > 0 ? form.personnes_a_voir : null,
    }])
    // Alertes
    const alertes = [
      ...form.personnes_a_valider.map(uid => ({ utilisateur_id: uid, type: 'plan_mis_a_jour', titre: `Plan a valider — ${projet.nom}`, message: `${getTypePlanForTab()} · Indice ${form.indice}${form.lot ? ` · ${form.lot}` : ''}`, priorite: 'high', lue: false })),
      ...form.personnes_a_voir.map(uid => ({ utilisateur_id: uid, type: 'plan_mis_a_jour', titre: `Nouveau plan a voir — ${projet.nom}`, message: `${getTypePlanForTab()} · Indice ${form.indice}${form.lot ? ` · ${form.lot}` : ''}`, priorite: 'normal', lue: false })),
    ]
    if (alertes.length && user) await supabase.schema('app').from('alertes').insert(alertes)
    setSaving(false); resetForm(); await refresh()
  }

  async function updatePlan() {
    if (!editPlan) return
    setSaving(true)
    let fichier_path = editPlan.fichier_path
    let fichier_nom  = editPlan.fichier_nom
    if (form.fichier) {
      const path = `plans/${getPhaseForTab()}/${Date.now()}_${form.fichier.name}`
      const { error } = await supabase.storage.from('projets').upload(path, form.fichier, { upsert: true })
      if (!error) { fichier_path = path; fichier_nom = form.fichier.name }
    }
    await supabase.schema('app').from('dessin_plans').update({
      indice: form.indice, lot: form.lot, description: form.description,
      personnes_a_valider: form.personnes_a_valider.length > 0 ? form.personnes_a_valider : null,
      personnes_a_voir: form.personnes_a_voir.length > 0 ? form.personnes_a_voir : null,
      fichier_path, fichier_nom,
    }).eq('id', editPlan.id)
    setSaving(false); resetForm(); setSelPlan(null); await refresh()
  }

  function startEdit(plan: Plan) {
    setEditPlan(plan); setShowForm(true); setSelPlan(null)
    setForm({ indice: plan.indice, lot: plan.lot || '', description: plan.description || '',
      personnes_a_valider: plan.personnes_a_valider ?? [], personnes_a_voir: plan.personnes_a_voir ?? [],
      fichier: null, fichier_nom: plan.fichier_nom })
  }

  async function updateStatut(planId: string, statut: string) {
    await supabase.schema('app').from('dessin_plans').update({ statut }).eq('id', planId)
    await refresh()
    if (selPlan?.id === planId) setSelPlan({ ...selPlan, statut })
  }

  async function deletePlan(planId: string) {
    await supabase.schema('app').from('dessin_plans').delete().eq('id', planId)
    if (selPlan?.id === planId) setSelPlan(null)
    await refresh()
  }

  async function validateWithEconomiste() {
    if (!selPlan || !selectedEcoId) return
    setValidating(true)
    await supabase.schema('app').from('dessin_plans').update({ statut: 'valide', economiste_id: selectedEcoId }).eq('id', selPlan.id)
    await supabase.schema('app').from('alertes').insert([{
      utilisateur_id: selectedEcoId, type: 'plan_mis_a_jour',
      titre: `Plan valide a consulter — ${selPlan.projet_nom}`,
      message: `${selPlan.type_plan} · Indice ${selPlan.indice}${selPlan.lot ? ` · ${selPlan.lot}` : ''}`,
      priorite: 'high', lue: false,
    }])
    if (selPlan.fichier_path && selPlan.fichier_nom) {
      await supabase.schema('app').from('documents').insert([{
        nom_fichier: `[Plan] ${selPlan.projet_nom} — ${selPlan.type_plan} Ind.${selPlan.indice}`,
        storage_path: selPlan.fichier_path, type_doc: 'plan', categorie: 'conception',
        role_source: 'dessin', uploaded_by: user?.id ?? null,
        tags_utilisateurs: [selectedEcoId], visible_roles: ['economiste'],
        message_depot: `Plan ${selPlan.type_plan} indice ${selPlan.indice} valide pour ${selPlan.projet_nom}`, statut: 'actif',
      }])
    }
    setValidating(false); setShowValidateModal(false); setSelectedEcoId('')
    setSelPlan({ ...selPlan, statut: 'valide', economiste_id: selectedEcoId })
    await refresh()
  }

  function getFileUrl(path: string) { return supabase.storage.from('projets').getPublicUrl(path).data.publicUrl }

  // ── Derived ──
  function getTabPlans(): Plan[] {
    if (activeTab === 'comparatif') return []
    if (activeTab === 'DCE') return plans.filter(p => p.phase === 'consultation' || p.type_plan === 'DCE')
    return plans.filter(p => p.type_plan === activeTab)
  }

  const tabPlans = getTabPlans()
  const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'
  const projetMemberIds = projet
    ? [projet.co_id, projet.commercial_id, projet.economiste_id, projet.dessinatrice_id].filter((x): x is string => !!x)
    : []
  const projetUsers = users.filter(u => projetMemberIds.includes(u.id))
  const usersForValider = projetUsers.filter(u => !form.personnes_a_voir.includes(u.id))
  const usersForVoir    = projetUsers.filter(u => !form.personnes_a_valider.includes(u.id))

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" /></div>
  if (!projet) return <div className="p-6 text-center text-sm text-gray-500">Projet introuvable. <Link href="/dessin/projets" className="underline">Retour</Link></div>

  const phaseIdx = PHASE_ORDER.indexOf(projet.statut)
  const safeIdx  = phaseIdx === -1 ? PHASE_ORDER.length - 1 : phaseIdx

  return (
    <div>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Link href="/dessin/projets" className="mt-1 flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0">
              <ArrowLeft className="w-3.5 h-3.5" /> Mes projets
            </Link>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                {projet.reference && <span className="text-xs text-gray-400 font-mono">{projet.reference}</span>}
                <StatutBadge statut={projet.statut} />
                {projet.type_chantier && <span className="text-xs text-gray-400">{projet.type_chantier}</span>}
              </div>
              <h1 className="text-base font-semibold text-gray-900">{projet.nom}</h1>
              {projet.client_nom && <p className="text-xs text-gray-500 mt-0.5">{projet.client_nom}</p>}
            </div>
          </div>
          <div className="hidden md:flex items-center gap-6 text-xs text-gray-500 flex-shrink-0">
            {projet.budget_total && <span>Budget : <span className="font-semibold text-gray-900">{formatCurrency(projet.budget_total)}</span></span>}
            {projet.surface_m2 && <span>{projet.surface_m2} m2</span>}
          </div>
        </div>
        <div className="mt-4 flex gap-0.5">
          {PHASE_ORDER.map((_, i) => <div key={i} className="flex-1"><div className={`h-1.5 rounded-full ${i <= safeIdx ? 'bg-gray-900' : 'bg-gray-100'}`} /></div>)}
        </div>
      </header>

      {/* Onglets */}
      <div className="bg-white border-b border-gray-200">
        <nav className="flex px-6 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon
            const count = tab.id === 'comparatif' ? 0 : (tab.id === 'DCE'
              ? plans.filter(p => p.phase === 'consultation' || p.type_plan === 'DCE').length
              : plans.filter(p => p.type_plan === tab.id).length)
            return (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); setShowForm(false); setSelPlan(null); setEditPlan(null) }}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                {count > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}>{count}</span>}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Contenu */}
      <div className="p-6">
        {/* Banniere demandes commerciales pour cet onglet */}
        {(() => {
          const demandeType = DEMANDE_TYPE_FOR_TAB[activeTab]
          if (!demandeType) return null
          const demandesActives = demandesPlan.filter(d => d.type === demandeType && (d.statut === 'en_attente' || d.statut === 'en_cours'))
          if (demandesActives.length === 0) return null
          return (
            <div className="mb-4 space-y-2">
              {demandesActives.map(d => {
                const dem = users.find(u => u.id === d.demandeur_id)
                const dateLim = d.date_livraison_souhaitee ?? d.date_livraison_prevue
                const enCours = d.statut === 'en_cours'
                const labelV = d.type === 'plan_apd' ? 'APD' : `V${d.version ?? 1}`
                return (
                  <div key={d.id} className={`rounded-xl border p-3 flex items-start justify-between gap-3 ${
                    enCours ? 'bg-amber-50 border-amber-200' : 'bg-violet-50 border-violet-200'
                  }`}>
                    <div className="flex items-start gap-2 min-w-0">
                      <Inbox className={`w-4 h-4 flex-shrink-0 mt-0.5 ${enCours ? 'text-amber-600' : 'text-violet-600'}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">
                          Demande {labelV} de {dem ? `${dem.prenom} ${dem.nom}` : 'commercial'}
                          <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${enCours ? 'bg-amber-200 text-amber-800' : 'bg-violet-200 text-violet-800'}`}>
                            {enCours ? 'En cours' : 'A traiter'}
                          </span>
                          {dateLim && <span className="ml-2 text-xs text-gray-500"><Clock className="w-3 h-3 inline" /> avant le {new Date(dateLim).toLocaleDateString('fr-FR')}</span>}
                        </p>
                        {d.message_demandeur && <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{d.message_demandeur}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {d.statut === 'en_attente' && (
                        <button
                          onClick={() => startLivrerTransition(async () => { await marquerEnCours(d.id); await refresh() })}
                          disabled={livrerPending}
                          className="px-2.5 py-1 text-xs text-amber-700 border border-amber-300 rounded-lg hover:bg-amber-100 disabled:opacity-50"
                        >
                          Marquer en cours
                        </button>
                      )}
                      <button
                        onClick={() => { setShowLivrerModal(d); setLivrerPlanId('') }}
                        className="px-2.5 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 inline-flex items-center gap-1"
                      >
                        <Send className="w-3 h-3" /> Livrer la demande
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()}

        {activeTab === 'comparatif' ? (
          <TabComparatifReadonly projetId={projet.id} projetNom={projet.nom} projetReference={projet.reference} />
        ) : (
          <div className="flex gap-4">
            {/* ── Liste plans + bouton nouveau ── */}
            <div className="w-80 flex-shrink-0 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">Plans {getTypePlanForTab()}</h3>
                <button onClick={() => { resetForm(); setShowForm(true); setSelPlan(null) }}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-700">
                  <Plus className="w-3 h-3" /> Nouveau
                </button>
              </div>

              {tabPlans.length === 0 && !showForm ? (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                  <FolderOpen className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-xs text-gray-400">Aucun plan {getTypePlanForTab()}</p>
                  <button onClick={() => { resetForm(); setShowForm(true) }}
                    className="mt-3 text-xs text-gray-600 underline hover:text-gray-900">Creer le premier</button>
                </div>
              ) : (
                <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-300px)]">
                  {tabPlans.map(p => {
                    const hasV = p.personnes_a_valider && p.personnes_a_valider.length > 0
                    const hasO = p.personnes_a_voir && p.personnes_a_voir.length > 0
                    return (
                      <button key={p.id} onClick={() => { setSelPlan(p); setShowForm(false); setEditPlan(null) }}
                        className={`w-full text-left p-3 rounded-xl border transition-all ${
                          selPlan?.id === p.id ? 'border-gray-900 bg-gray-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm text-gray-800">Indice {p.indice}{p.lot ? ` · ${p.lot}` : ''}</p>
                            {p.description && <p className="text-xs text-gray-400 truncate mt-0.5">{p.description}</p>}
                          </div>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUT_COLOR[p.statut] ?? 'bg-gray-100 text-gray-500'}`}>{p.statut}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          {hasV && <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full"><CheckCircle className="w-2.5 h-2.5" /> {p.personnes_a_valider!.length}</span>}
                          {hasO && <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 bg-sky-100 text-sky-600 rounded-full"><Eye className="w-2.5 h-2.5" /> {p.personnes_a_voir!.length}</span>}
                          {p.fichier_nom && <span className="inline-flex items-center gap-0.5 text-xs text-gray-400"><FileText className="w-2.5 h-2.5" /> {p.fichier_nom}</span>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ── Panneau droit : form ou detail ── */}
            <div className="flex-1 min-w-0">
              {showForm ? (
                /* ── Formulaire creation / edition ── */
                <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">
                      {editPlan ? `Modifier — ${editPlan.type_plan} Ind.${editPlan.indice}` : `Nouveau plan ${getTypePlanForTab()}`}
                    </h3>
                    <button onClick={resetForm}><X className="w-4 h-4 text-gray-400" /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Indice</label>
                      <input value={form.indice} onChange={e => setForm({ ...form, indice: e.target.value })} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Lot</label>
                      {lots.length > 0 ? (
                        <select value={form.lot} onChange={e => setForm({ ...form, lot: e.target.value })} className={`${inputClass} bg-white`}>
                          <option value="">Tous les lots</option>
                          {lots.map(l => <option key={l.id} value={l.corps_etat}>{l.corps_etat}</option>)}
                        </select>
                      ) : (
                        <input value={form.lot} onChange={e => setForm({ ...form, lot: e.target.value })} placeholder="Saisir le lot" className={inputClass} />
                      )}
                    </div>
                  </div>

                  {/* Upload */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">Plan (fichier)</label>
                    <input ref={fileRef} type="file" className="hidden" accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg"
                      onChange={e => { const f = e.target.files?.[0] ?? null; setForm(prev => ({ ...prev, fichier: f, fichier_nom: f?.name ?? null })); e.target.value = '' }} />
                    {form.fichier ? (
                      <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="text-sm text-gray-700 truncate">{form.fichier.name}</span>
                          <span className="text-xs text-gray-400 flex-shrink-0">{(form.fichier.size / 1024).toFixed(0)} Ko</span>
                        </div>
                        <button onClick={() => setForm(prev => ({ ...prev, fichier: null, fichier_nom: editPlan?.fichier_nom ?? null }))} className="text-gray-400 hover:text-red-500 ml-2"><X className="w-4 h-4" /></button>
                      </div>
                    ) : form.fichier_nom ? (
                      <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="text-sm text-gray-700 truncate">{form.fichier_nom}</span>
                          <span className="text-xs text-gray-400">Fichier actuel</span>
                        </div>
                        <button type="button" onClick={() => fileRef.current?.click()} className="text-xs text-blue-600 hover:text-blue-700 ml-2">Remplacer</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => fileRef.current?.click()}
                        className="flex items-center gap-2 w-full border border-dashed border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-500 hover:border-gray-400 hover:bg-gray-50 transition-colors justify-center">
                        <Upload className="w-4 h-4" /> Joindre un plan (PDF, DWG, image...)
                      </button>
                    )}
                  </div>

                  {/* Tags */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
                      <UserSearch label="Personnes a valider" color="purple" users={usersForValider}
                        selected={form.personnes_a_valider} onChange={ids => setForm(prev => ({ ...prev, personnes_a_valider: ids }))} />
                    </div>
                    <div className="bg-sky-50 border border-sky-100 rounded-xl p-3">
                      <UserSearch label="Personnes a voir" color="sky" users={usersForVoir}
                        selected={form.personnes_a_voir} onChange={ids => setForm(prev => ({ ...prev, personnes_a_voir: ids }))} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Description</label>
                    <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className={`${inputClass} resize-none`} />
                  </div>
                  <div className="flex gap-2 justify-end pt-1">
                    <button onClick={resetForm} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Annuler</button>
                    <button onClick={editPlan ? updatePlan : savePlan} disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40">
                      {saving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                      {editPlan ? 'Sauvegarder' : 'Enregistrer'}
                    </button>
                  </div>
                </div>

              ) : selPlan ? (
                /* ── Detail plan ── */
                <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">{selPlan.type_plan} — Indice {selPlan.indice}</h3>
                      <p className="text-sm text-gray-500">{selPlan.lot || 'General'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUT_COLOR[selPlan.statut] ?? 'bg-gray-100 text-gray-500'}`}>{selPlan.statut}</span>
                      <button onClick={() => startEdit(selPlan)} className="p-1 text-gray-400 hover:text-blue-600" title="Modifier"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => deletePlan(selPlan.id)} className="p-1 text-gray-400 hover:text-red-500" title="Supprimer"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>

                  {/* Fichier */}
                  {selPlan.fichier_path && selPlan.fichier_nom && (
                    <a href={getFileUrl(selPlan.fichier_path)} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-colors">
                      <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0"><p className="text-sm font-medium text-blue-700 truncate">{selPlan.fichier_nom}</p></div>
                      <Download className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    </a>
                  )}

                  {/* Personnes taguees */}
                  {((selPlan.personnes_a_valider?.length ?? 0) > 0 || (selPlan.personnes_a_voir?.length ?? 0) > 0) && (
                    <div className="grid grid-cols-2 gap-3">
                      {(selPlan.personnes_a_valider?.length ?? 0) > 0 && (
                        <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
                          <div className="flex items-center gap-1.5 mb-1.5"><CheckCircle className="w-3.5 h-3.5 text-purple-500" /><p className="text-xs font-semibold text-purple-700">A valider</p></div>
                          <div className="flex flex-wrap gap-1.5">
                            {selPlan.personnes_a_valider!.map(uid => { const u = users.find(u => u.id === uid); return u ? (
                              <span key={uid} className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full bg-purple-50 text-purple-800 border border-purple-100"><span className="w-1.5 h-1.5 rounded-full bg-purple-400" />{u.prenom} {u.nom}</span>
                            ) : null })}
                          </div>
                        </div>
                      )}
                      {(selPlan.personnes_a_voir?.length ?? 0) > 0 && (
                        <div className="bg-sky-50 border border-sky-100 rounded-xl p-3">
                          <div className="flex items-center gap-1.5 mb-1.5"><Eye className="w-3.5 h-3.5 text-sky-500" /><p className="text-xs font-semibold text-sky-600">A voir</p></div>
                          <div className="flex flex-wrap gap-1.5">
                            {selPlan.personnes_a_voir!.map(uid => { const u = users.find(u => u.id === uid); return u ? (
                              <span key={uid} className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full bg-sky-50 text-sky-800 border border-sky-100"><span className="w-1.5 h-1.5 rounded-full bg-sky-400" />{u.prenom} {u.nom}</span>
                            ) : null })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Economiste */}
                  {selPlan.economiste_id && (() => { const eco = users.find(u => u.id === selPlan.economiste_id); return eco ? (
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                      <Calculator className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <p className="text-xs text-emerald-700">Economiste notifie : <span className="font-semibold">{eco.prenom} {eco.nom}</span></p>
                    </div>
                  ) : null })()}

                  {selPlan.description && <div className="p-3 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500 mb-1">Description</p><p className="text-sm text-gray-700">{selPlan.description}</p></div>}

                  {/* Commentaires */}
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                      <MessageSquare className="w-4 h-4 text-gray-500" />
                      <h4 className="text-xs font-semibold text-gray-700">Commentaires</h4>
                      {commentaires.length > 0 && <span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded-full font-medium">{commentaires.length}</span>}
                    </div>
                    <div className="max-h-48 overflow-y-auto px-4 py-3 space-y-3">
                      {commentaires.length === 0 ? <p className="text-xs text-gray-400 text-center py-4">Aucun commentaire</p>
                      : commentaires.map(c => { const u = users.find(u => u.id === c.utilisateur_id); const initials = u ? `${u.prenom[0]}${u.nom[0]}`.toUpperCase() : '??'; return (
                        <div key={c.id} className="flex gap-2.5">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 bg-gray-100 text-gray-600">{initials}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-gray-800">{u ? `${u.prenom} ${u.nom}` : 'Utilisateur'}</span>
                              <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">{c.contenu}</p>
                          </div>
                        </div>
                      )})}
                      <div ref={commentEndRef} />
                    </div>
                    <div className="border-t border-gray-200 px-4 py-3">
                      <div className="flex gap-2">
                        <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment() } }}
                          placeholder="Ecrire un commentaire..." className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 placeholder-gray-300" />
                        <button onClick={sendComment} disabled={!newComment.trim() || sendingComment}
                          className="px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40 flex items-center gap-1.5">
                          {sendingComment ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-wrap">
                    {selPlan.statut === 'en_cours' && (
                      <button onClick={() => updateStatut(selPlan.id, 'soumis')} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Soumettre pour validation</button>
                    )}
                    {selPlan.statut === 'soumis' && (
                      <>
                        <button onClick={() => { setSelectedEcoId(''); setShowValidateModal(true) }} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"><CheckCircle className="w-4 h-4 inline mr-1" />Valider</button>
                        <button onClick={() => updateStatut(selPlan.id, 'refuse')} className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50">Refuser</button>
                      </>
                    )}
                    {selPlan.statut === 'refuse' && (
                      <button onClick={() => updateStatut(selPlan.id, 'en_cours')} className="px-3 py-1.5 text-sm border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50">Reprendre</button>
                    )}
                    {selPlan.statut === 'valide' && selPlan.type_plan === 'APD' && (
                      <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg w-full">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <p className="text-xs text-green-700 font-medium"><Abbr k="APD" /> valide — ce projet peut passer en phase Lancement.</p>
                      </div>
                    )}
                  </div>
                </div>

              ) : (
                <div className="bg-white rounded-xl border border-gray-200 h-64 flex items-center justify-center">
                  <div className="text-center text-gray-400">
                    <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Selectionnez un plan ou creez-en un nouveau</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Modale validation + economiste ── */}
      {showValidateModal && selPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Valider le plan</h3>
                <p className="text-xs text-gray-500 mt-0.5">{selPlan.type_plan} Indice {selPlan.indice}</p>
              </div>
              <button onClick={() => setShowValidateModal(false)} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              {selPlan.fichier_nom && (
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-700 truncate">{selPlan.fichier_nom}</span>
                </div>
              )}
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 mb-2">
                  <Calculator className="w-4 h-4 text-emerald-600" /> Economiste a notifier *
                </label>
                <p className="text-xs text-gray-400 mb-2">L'economiste recevra le plan dans ses documents et une notification.</p>
                <select value={selectedEcoId} onChange={e => setSelectedEcoId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                  <option value="">Choisir un economiste...</option>
                  {users.filter(u => u.role.toLowerCase().includes('economiste') || u.role.toLowerCase().includes('eco')).map(u => (
                    <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>
                  ))}
                  {users.filter(u => !u.role.toLowerCase().includes('economiste') && !u.role.toLowerCase().includes('eco')).length > 0 && (
                    <option disabled>── Autres ──</option>
                  )}
                  {users.filter(u => !u.role.toLowerCase().includes('economiste') && !u.role.toLowerCase().includes('eco')).map(u => (
                    <option key={u.id} value={u.id}>{u.prenom} {u.nom} ({u.role})</option>
                  ))}
                </select>
              </div>
              {selectedEcoId && (() => { const eco = users.find(u => u.id === selectedEcoId); return eco ? (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                  <p className="text-xs text-emerald-700"><span className="font-semibold">{eco.prenom} {eco.nom}</span> sera notifie.</p>
                </div>
              ) : null })()}
            </div>
            <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setShowValidateModal(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
              <button onClick={validateWithEconomiste} disabled={!selectedEcoId || validating}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-40">
                {validating ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Valider et notifier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale livrer une demande commerciale */}
      {showLivrerModal && (() => {
        const dem = showLivrerModal
        const tabForType = dem.type === 'plan_intention' ? 'APS' : dem.type === 'plan_proposition' ? 'APD' : 'AT'
        const plansEligibles = plans.filter(p => p.type_plan === tabForType && p.fichier_path)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
              <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Livrer la demande</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{dem.type === 'plan_apd' ? 'APD' : `V${dem.version ?? 1}`} — onglet {tabForType}</p>
                </div>
                <button onClick={() => setShowLivrerModal(null)} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-5 space-y-4">
                {plansEligibles.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800">
                      Aucun plan {tabForType} avec fichier disponible. Cree d&apos;abord un plan dans l&apos;onglet {tabForType} (bouton « Nouveau »), puis reviens ici pour le livrer.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-gray-500">Selectionne le plan a transmettre au commercial. Il sera attache a la proposition correspondante.</p>
                    <select value={livrerPlanId} onChange={e => setLivrerPlanId(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                      <option value="">Choisir un plan...</option>
                      {plansEligibles.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.type_plan} Ind.{p.indice}{p.lot ? ` · ${p.lot}` : ''} — {p.fichier_nom ?? 'plan'}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                {livrerToast && <div className="text-xs px-2.5 py-1.5 rounded-lg bg-violet-100 text-violet-900">{livrerToast}</div>}
              </div>
              <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
                <button onClick={() => setShowLivrerModal(null)} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
                <button
                  onClick={() => {
                    if (!livrerPlanId) { setLivrerToast('Choisir un plan'); return }
                    const plan = plans.find(p => p.id === livrerPlanId)
                    if (!plan?.fichier_path) { setLivrerToast('Plan sans fichier'); return }
                    const url = supabase.storage.from('projets').getPublicUrl(plan.fichier_path).data.publicUrl
                    setLivrerToast(null)
                    startLivrerTransition(async () => {
                      try {
                        await livrerDemande({
                          demandeId: dem.id,
                          livrableUrl: url,
                          notes: `Plan ${plan.type_plan} indice ${plan.indice}${plan.lot ? ` · ${plan.lot}` : ''}`,
                        })
                        setShowLivrerModal(null)
                        setLivrerPlanId('')
                        await refresh()
                      } catch (e) {
                        setLivrerToast((e as Error).message)
                      }
                    })
                  }}
                  disabled={livrerPending || !livrerPlanId || plansEligibles.length === 0}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-40"
                >
                  {livrerPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Livrer au commercial
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ─── Comparatif ST (lecture seule) ────────────────────────────────────────────

function TabComparatifReadonly({ projetId, projetNom, projetReference }: { projetId: string; projetNom: string; projetReference: string | null }) {
  const supabase = useMemo(() => createClient(), [])
  const [lots, setLots] = useState<PublicLot[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLotId, setSelectedLotId] = useState('')

  useEffect(() => {
    async function loadLots() {
      const { data: lotsData } = await supabase.from('lots').select('id, nom, ordre').eq('projet_id', projetId).order('ordre', { ascending: true })
      const rawLots = (lotsData ?? []) as Array<{ id: string; nom: string; ordre: number }>
      const { data: accesData } = await supabase.from('dce_acces_st').select('lot_id, statut').eq('projet_id', projetId).in('statut', ['soumis', 'retenu', 'refuse'])
      const cnt = new Map<string, number>()
      ;(accesData ?? []).forEach((a: any) => cnt.set(a.lot_id, (cnt.get(a.lot_id) ?? 0) + 1))
      const enriched = rawLots.map(l => ({ ...l, nb_offres: cnt.get(l.id) ?? 0 }))
      setLots(enriched); setSelectedLotId(enriched[0]?.id || ''); setLoading(false)
    }
    loadLots()
  }, [projetId, supabase])

  if (loading) return <div className="text-sm text-gray-400 py-10 text-center">Chargement...</div>
  if (lots.length === 0) return (
    <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
      <Scale className="w-10 h-10 text-gray-200 mx-auto mb-3" />
      <p className="text-sm font-medium text-gray-700">Aucun lot disponible</p>
      <p className="text-xs text-gray-400 mt-1">Les lots apparaitront ici une fois crees par l'economiste.</p>
    </div>
  )

  const selectedLot = lots.find(l => l.id === selectedLotId) ?? lots[0]

  return (
    <div className="space-y-4">
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
        <Eye className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-xs font-semibold text-amber-700">Mode consultation</p>
          <p className="text-xs text-amber-600 mt-0.5">Visualisez les offres des sous-traitants pour adapter vos plans.</p>
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium mr-1">Lot :</span>
          {lots.map(l => (
            <button key={l.id} onClick={() => setSelectedLotId(l.id)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5 ${l.id === selectedLot.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'}`}>
              <span className="font-mono text-[10px] opacity-70">L{String(l.ordre + 1).padStart(2, '0')}</span>
              {l.nom}
              {l.nb_offres > 0 && <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${l.id === selectedLot.id ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-700'}`}>{l.nb_offres}</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
          <span className="text-xs font-mono font-semibold text-gray-400">LOT {String(selectedLot.ordre + 1).padStart(2, '0')}</span>
          <span className="text-sm font-medium text-gray-900">{selectedLot.nom}</span>
          {selectedLot.nb_offres > 0 && <span className="text-xs px-2 py-0.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-full font-medium">{selectedLot.nb_offres} offre{selectedLot.nb_offres > 1 ? 's' : ''}</span>}
        </div>
        <div className="px-5 pb-5 pt-4">
          <DceComparatifDetail lotId={selectedLot.id} projetId={projetId} projetNom={projetNom} projetReference={projetReference} lotNom={selectedLot.nom} />
        </div>
      </div>
    </div>
  )
}
