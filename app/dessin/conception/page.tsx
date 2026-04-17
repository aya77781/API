'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'
import { useUser } from '@/hooks/useUser'
import {
  Plus, X, CheckCircle, Clock, ChevronRight, ChevronDown,
  Lightbulb, FileText, Award, AlertCircle,
  Upload, Search, Eye, Pencil, Trash2,
  MessageSquare, Send, Calculator, FolderOpen
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Plan = {
  id: string
  projet_nom: string
  phase: string
  type_plan: 'intention' | 'proposition' | 'APD'
  indice: string
  statut: 'en_cours' | 'soumis' | 'valide' | 'refuse' | 'archive'
  description: string
  lot: string
  fichier_path: string | null
  fichier_nom: string | null
  personnes_a_valider: string[] | null
  personnes_a_voir: string[] | null
  economiste_id: string | null
  created_at: string
}

type Utilisateur = { id: string; prenom: string; nom: string; role: string }

type Commentaire = {
  id: string
  plan_id: string
  utilisateur_id: string
  contenu: string
  created_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS: { key: Plan['type_plan']; label: string; desc: string; icon: React.ReactNode }[] = [
  { key: 'intention',   label: 'Imagination',  desc: 'Premier plan d\'intention base sur projets similaires', icon: <Lightbulb className="w-4 h-4" /> },
  { key: 'proposition', label: 'Affinage',      desc: 'Deuxieme proposition enrichie apres retours client',    icon: <FileText className="w-4 h-4" />   },
  { key: 'APD',         label: 'Plan APD',      desc: 'Plan de depart definitif — annexe au contrat signe',   icon: <Award className="w-4 h-4" />     },
]

const STATUT_COLOR: Record<string, string> = {
  en_cours: 'bg-amber-100 text-amber-700',
  soumis:   'bg-blue-100 text-blue-700',
  valide:   'bg-green-100 text-green-700',
  refuse:   'bg-red-100 text-red-700',
  archive:  'bg-gray-100 text-gray-500',
}

type FormState = {
  projet_nom: string
  type_plan: Plan['type_plan']
  indice: string
  description: string
  lot: string
  personnes_a_valider: string[]
  personnes_a_voir: string[]
  fichier: File | null
  fichier_nom: string | null
}

const EMPTY: FormState = {
  projet_nom: '', type_plan: 'intention', indice: 'A', description: '', lot: '',
  personnes_a_valider: [], personnes_a_voir: [],
  fichier: null, fichier_nom: null,
}

type ProjetOption = { id: string; nom: string; reference: string | null }
type LotOption    = { id: string; corps_etat: string }

// ─── UserSearch ───────────────────────────────────────────────────────────────

function UserSearch({ label, color, users, selected, onChange }: {
  label: string
  color: 'purple' | 'sky'
  users: Utilisateur[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [query, setQuery] = useState('')

  const filtered = users.filter(u => {
    if (!query.trim()) return true
    return `${u.prenom} ${u.nom}`.toLowerCase().includes(query.toLowerCase()) ||
           u.role.toLowerCase().includes(query.toLowerCase())
  })

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
  }

  const pillClass = color === 'purple'
    ? 'bg-purple-100 text-purple-800 border border-purple-200'
    : 'bg-sky-100 text-sky-800 border border-sky-200'

  const badgeClass = color === 'purple'
    ? 'bg-purple-600 text-white'
    : 'bg-sky-500 text-white'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 mb-1">
        {color === 'purple'
          ? <CheckCircle className="w-3.5 h-3.5 text-purple-600" />
          : <Eye className="w-3.5 h-3.5 text-sky-500" />}
        <label className={`text-xs font-semibold ${color === 'purple' ? 'text-purple-700' : 'text-sky-600'}`}>
          {label}
        </label>
        {selected.length > 0 && (
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${badgeClass}`}>{selected.length}</span>
        )}
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1">
          {selected.map(id => {
            const u = users.find(u => u.id === id)
            if (!u) return null
            return (
              <span key={id} className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${pillClass}`}>
                {u.prenom} {u.nom}
                <button onClick={() => toggle(id)} className="hover:opacity-70 ml-0.5">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            )
          })}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher par nom ou role..."
          className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 placeholder-gray-300"
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {query.trim() && (
        <div className="border border-gray-100 rounded-lg bg-gray-50 max-h-36 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">Aucun resultat</p>
          ) : (
            filtered.map(u => (
              <label key={u.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-100 transition-colors">
                <input type="checkbox" checked={selected.includes(u.id)} onChange={() => toggle(u.id)} className="accent-gray-900 flex-shrink-0" />
                <span className="text-sm text-gray-700 flex-1">{u.prenom} {u.nom}</span>
                <span className="text-xs text-gray-400">{u.role}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── PersonnesBadges (vue detail) ─────────────────────────────────────────────

function PersonnesBadges({ ids, users, color, label }: {
  ids: string[]
  users: Utilisateur[]
  color: 'purple' | 'sky'
  label: string
}) {
  if (!ids.length) return null
  const pillClass = color === 'purple'
    ? 'bg-purple-50 text-purple-800 border border-purple-100'
    : 'bg-sky-50 text-sky-800 border border-sky-100'
  const dotClass = color === 'purple' ? 'bg-purple-400' : 'bg-sky-400'
  const Icon = color === 'purple' ? CheckCircle : Eye
  const iconClass = color === 'purple' ? 'text-purple-500' : 'text-sky-500'

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className={`w-3.5 h-3.5 ${iconClass}`} />
        <p className={`text-xs font-semibold ${color === 'purple' ? 'text-purple-700' : 'text-sky-600'}`}>{label}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ids.map(id => {
          const u = users.find(u => u.id === id)
          if (!u) return null
          return (
            <span key={id} className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full ${pillClass}`}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotClass}`} />
              {u.prenom} {u.nom}
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConceptionPage() {
  const supabase = createClient()
  const { user } = useUser()

  const [plans, setPlans]           = useState<Plan[]>([])
  const [users, setUsers]           = useState<Utilisateur[]>([])
  const [sel, setSel]               = useState<Plan | null>(null)
  const [showForm, setShowForm]     = useState(false)
  const [editMode, setEditMode]     = useState(false)
  const [form, setForm]             = useState<FormState>(EMPTY)
  const [filter, setFilter]         = useState<string>('tous')
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [projets, setProjets]       = useState<ProjetOption[]>([])
  const [lots, setLots]             = useState<LotOption[]>([])
  const [formProjetId, setFormProjetId] = useState('')
  const fileRef                     = useRef<HTMLInputElement>(null)
  const [commentaires, setCommentaires] = useState<Commentaire[]>([])
  const [newComment, setNewComment]     = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const commentEndRef                   = useRef<HTMLDivElement>(null)
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set())
  const [showValidateModal, setShowValidateModal] = useState(false)
  const [selectedEcoId, setSelectedEcoId]         = useState('')
  const [validating, setValidating]               = useState(false)

  async function fetchCommentaires(planId: string) {
    const { data } = await supabase.schema('app').from('dessin_plan_commentaires')
      .select('*').eq('plan_id', planId).order('created_at', { ascending: true })
    setCommentaires((data as Commentaire[]) ?? [])
  }

  async function sendComment() {
    if (!sel || !newComment.trim() || !user) return
    setSendingComment(true)

    // Trouver l'utilisateur correspondant au user auth
    const { data: util } = await supabase.schema('app').from('utilisateurs')
      .select('id').eq('email', user.email).single()

    if (util) {
      await supabase.schema('app').from('dessin_plan_commentaires').insert([{
        plan_id: sel.id,
        utilisateur_id: util.id,
        contenu: newComment.trim(),
      }])
      setNewComment('')
      await fetchCommentaires(sel.id)
      setTimeout(() => commentEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }

    setSendingComment(false)
  }

  // Charger les commentaires quand on selectionne un plan
  useEffect(() => {
    if (sel) {
      fetchCommentaires(sel.id)
      // Ouvrir automatiquement le dossier du plan selectionne
      setOpenFolders(prev => {
        if (prev.has(sel.projet_nom)) return prev
        const next = new Set(prev)
        next.add(sel.projet_nom)
        return next
      })
    } else {
      setCommentaires([])
    }
    setNewComment('')
  }, [sel?.id])

  async function fetchPlans() {
    setLoading(true)
    const { data } = await supabase.schema('app').from('dessin_plans')
      .select('*').eq('phase', 'conception').order('created_at', { ascending: false })
    setPlans((data as Plan[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchPlans()
    supabase.schema('app').from('projets')
      .select('id, nom, reference')
      .order('nom')
      .then(({ data }) => setProjets((data ?? []) as ProjetOption[]))
    supabase.schema('app').from('utilisateurs')
      .select('id, prenom, nom, role').eq('actif', true).order('prenom')
      .then(({ data }) => setUsers((data as Utilisateur[]) ?? []))
  }, [])

  useEffect(() => {
    setForm(f => ({ ...f, lot: '' }))
    setLots([])
    if (!formProjetId) return
    supabase.schema('app').from('lots')
      .select('id, corps_etat')
      .eq('projet_id', formProjetId)
      .order('numero')
      .then(({ data }) => setLots((data ?? []) as LotOption[]))
  }, [formProjetId])

  function resetForm() {
    setForm(EMPTY)
    setFormProjetId('')
    setLots([])
    setShowForm(false)
  }

  async function savePlan() {
    if (!formProjetId) return
    setSaving(true)

    let fichier_path: string | null = null

    if (form.fichier) {
      const path = `plans/conception/${Date.now()}_${form.fichier.name}`
      const { error: uploadErr } = await supabase.storage
        .from('projets').upload(path, form.fichier, { upsert: true })
      if (!uploadErr) fichier_path = path
    }

    await supabase.schema('app').from('dessin_plans').insert([{
      projet_nom:          form.projet_nom,
      phase:               'conception',
      type_plan:           form.type_plan,
      indice:              form.indice,
      lot:                 form.lot,
      statut:              'en_cours',
      description:         form.description,
      personnes_a_valider: form.personnes_a_valider.length > 0 ? form.personnes_a_valider : null,
      personnes_a_voir:    form.personnes_a_voir.length > 0 ? form.personnes_a_voir : null,
      fichier_path,
      fichier_nom: form.fichier?.name ?? null,
    }])

    // Alertes pour les personnes taguees
    const alertes = [
      ...form.personnes_a_valider.map(uid => ({
        utilisateur_id: uid,
        type: 'plan_mis_a_jour',
        titre: `Plan a valider — ${form.projet_nom}`,
        message: `${form.type_plan} · Indice ${form.indice}${form.lot ? ` · ${form.lot}` : ''}`,
        priorite: 'high',
        lue: false,
      })),
      ...form.personnes_a_voir.map(uid => ({
        utilisateur_id: uid,
        type: 'plan_mis_a_jour',
        titre: `Nouveau plan a voir — ${form.projet_nom}`,
        message: `${form.type_plan} · Indice ${form.indice}${form.lot ? ` · ${form.lot}` : ''}`,
        priorite: 'normal',
        lue: false,
      })),
    ]

    if (alertes.length && user) {
      await supabase.schema('app').from('alertes').insert(alertes)
    }

    setSaving(false)
    resetForm()
    fetchPlans()
  }

  async function updateStatut(id: string, statut: Plan['statut']) {
    await supabase.schema('app').from('dessin_plans').update({ statut }).eq('id', id)
    fetchPlans()
    if (sel?.id === id) setSel({ ...sel, statut })
  }

  async function validateWithEconomiste() {
    if (!sel || !selectedEcoId) return
    setValidating(true)

    // Valider le plan + assigner l'economiste
    await supabase.schema('app').from('dessin_plans')
      .update({ statut: 'valide', economiste_id: selectedEcoId })
      .eq('id', sel.id)

    // Notifier l'economiste (alerte haute priorite)
    await supabase.schema('app').from('alertes').insert([{
      utilisateur_id: selectedEcoId,
      type: 'plan_mis_a_jour',
      titre: `Plan valide a consulter — ${sel.projet_nom}`,
      message: `${sel.type_plan} · Indice ${sel.indice}${sel.lot ? ` · ${sel.lot}` : ''} — fichier disponible dans Documents`,
      priorite: 'high',
      lue: false,
    }])

    // Si le plan a un fichier, creer une entree document visible par l'economiste
    if (sel.fichier_path && sel.fichier_nom) {
      await supabase.schema('app').from('documents').insert([{
        nom_fichier: `[Plan] ${sel.projet_nom} — ${sel.type_plan} Ind.${sel.indice}`,
        storage_path: sel.fichier_path,
        type_doc: 'plan',
        categorie: 'conception',
        role_source: 'dessin',
        uploaded_by: user?.id ?? null,
        tags_utilisateurs: [selectedEcoId],
        visible_roles: ['economiste'],
        message_depot: `Plan ${sel.type_plan} indice ${sel.indice} valide pour ${sel.projet_nom}`,
        statut: 'actif',
      }])
    }

    setValidating(false)
    setShowValidateModal(false)
    setSelectedEcoId('')
    setSel({ ...sel, statut: 'valide', economiste_id: selectedEcoId })
    fetchPlans()
  }

  async function updatePlan() {
    if (!sel) return
    setSaving(true)

    let fichier_path = sel.fichier_path
    let fichier_nom  = sel.fichier_nom

    if (form.fichier) {
      const path = `plans/conception/${Date.now()}_${form.fichier.name}`
      const { error: uploadErr } = await supabase.storage
        .from('projets').upload(path, form.fichier, { upsert: true })
      if (!uploadErr) {
        fichier_path = path
        fichier_nom  = form.fichier.name
      }
    }

    await supabase.schema('app').from('dessin_plans').update({
      type_plan:           form.type_plan,
      indice:              form.indice,
      lot:                 form.lot,
      description:         form.description,
      personnes_a_valider: form.personnes_a_valider.length > 0 ? form.personnes_a_valider : null,
      personnes_a_voir:    form.personnes_a_voir.length > 0 ? form.personnes_a_voir : null,
      fichier_path,
      fichier_nom,
    }).eq('id', sel.id)

    setSaving(false)
    setEditMode(false)
    fetchPlans()
    setSel(null)
  }

  function startEdit(plan: Plan) {
    setEditMode(true)
    setShowForm(false)
    setForm({
      projet_nom:          plan.projet_nom,
      type_plan:           plan.type_plan,
      indice:              plan.indice,
      description:         plan.description || '',
      lot:                 plan.lot || '',
      personnes_a_valider: plan.personnes_a_valider ?? [],
      personnes_a_voir:    plan.personnes_a_voir ?? [],
      fichier:             null,
      fichier_nom:         plan.fichier_nom,
    })
  }

  async function deletePlan(id: string) {
    await supabase.schema('app').from('dessin_plans').delete().eq('id', id)
    if (sel?.id === id) setSel(null)
    setEditMode(false)
    fetchPlans()
  }

  function getFileUrl(path: string) {
    const { data } = supabase.storage.from('projets').getPublicUrl(path)
    return data.publicUrl
  }

  const filtered = filter === 'tous' ? plans : plans.filter(p => p.type_plan === filter)

  // Grouper par projet
  const grouped = filtered.reduce<Record<string, Plan[]>>((acc, p) => {
    if (!acc[p.projet_nom]) acc[p.projet_nom] = []
    acc[p.projet_nom].push(p)
    return acc
  }, {})
  const projetNames = Object.keys(grouped)

  function toggleFolder(nom: string) {
    setOpenFolders(prev => {
      const next = new Set(prev)
      if (next.has(nom)) next.delete(nom)
      else next.add(nom)
      return next
    })
  }

  const apdValides = plans.filter(p => p.type_plan === 'APD' && p.statut === 'valide').map(p => p.projet_nom)

  const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'

  // Exclude users already picked in the other group
  const usersForValider = users.filter(u => !form.personnes_a_voir.includes(u.id))
  const usersForVoir    = users.filter(u => !form.personnes_a_valider.includes(u.id))

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar title="Conception" subtitle="Imagination, affinage iteratif et Plan APD" />

      {/* Steps banner */}
      <div className="mx-6 mt-4 bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                <span className="text-gray-400">{s.icon}</span>
                <div>
                  <p className="text-xs font-semibold text-gray-700">Etape {i + 1} — {s.label}</p>
                  <p className="text-xs text-gray-400">{s.desc}</p>
                </div>
              </div>
              {i < STEPS.length - 1 && <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />}
            </div>
          ))}
        </div>
      </div>

      {/* APD validated alert */}
      {apdValides.length > 0 && (
        <div className="mx-6 mt-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
          <p className="text-sm text-green-700">
            <span className="font-semibold">{apdValides.length} projet(s)</span> avec APD valide : {apdValides.join(', ')}. Prets pour la phase Lancement.
          </p>
        </div>
      )}

      <div className="px-6 pt-4 pb-8 flex gap-4">
        {/* List */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Plans de conception</h3>
            <button onClick={() => { setShowForm(true); setForm(EMPTY); setFormProjetId(''); setSel(null) }}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-700">
              <Plus className="w-3 h-3" /> Nouveau
            </button>
          </div>

          {/* Filter */}
          <div className="flex gap-1 flex-wrap">
            {['tous', 'intention', 'proposition', 'APD'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                  filter === f ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}>
                {f === 'tous' ? 'Tous' : f}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-sm text-gray-400 text-center py-8">Chargement...</p>
          ) : projetNames.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Aucun plan</p>
          ) : (
            <div className="space-y-2">
              {projetNames.map(nom => {
                const plansProjet = grouped[nom]
                const isOpen = openFolders.has(nom)
                const hasSel = plansProjet.some(p => p.id === sel?.id)
                const totalValider = plansProjet.reduce((n, p) => n + (p.personnes_a_valider?.length ?? 0), 0)
                const totalVoir    = plansProjet.reduce((n, p) => n + (p.personnes_a_voir?.length ?? 0), 0)
                const types = [...new Set(plansProjet.map(p => p.type_plan))]

                return (
                  <div key={nom} className={`rounded-xl border transition-all ${
                    hasSel ? 'border-gray-900 shadow-sm' : 'border-gray-200'
                  } bg-white overflow-hidden`}>
                    {/* En-tete dossier */}
                    <button
                      onClick={() => toggleFolder(nom)}
                      className="w-full text-left px-3 py-2.5 flex items-center gap-2 hover:bg-gray-50 transition-colors"
                    >
                      <FolderOpen className={`w-4 h-4 flex-shrink-0 ${isOpen ? 'text-amber-500' : 'text-gray-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900 truncate">{nom}</p>
                          <span className="text-xs text-gray-400 flex-shrink-0">{plansProjet.length} plan{plansProjet.length > 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {types.map(t => (
                            <span key={t} className="text-xs text-gray-400">{t}</span>
                          ))}
                          {totalValider > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                              <CheckCircle className="w-2.5 h-2.5" /> {totalValider}
                            </span>
                          )}
                          {totalVoir > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 bg-sky-100 text-sky-600 rounded-full">
                              <Eye className="w-2.5 h-2.5" /> {totalVoir}
                            </span>
                          )}
                        </div>
                      </div>
                      {isOpen
                        ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                    </button>

                    {/* Plans du dossier */}
                    {isOpen && (
                      <div className="border-t border-gray-100">
                        {plansProjet.map(p => {
                          const hasValider = p.personnes_a_valider && p.personnes_a_valider.length > 0
                          const hasVoir    = p.personnes_a_voir && p.personnes_a_voir.length > 0
                          return (
                            <button key={p.id} onClick={() => { setSel(p); setShowForm(false); setEditMode(false) }}
                              className={`w-full text-left px-3 py-2.5 border-b border-gray-50 last:border-b-0 transition-colors ${
                                sel?.id === p.id ? 'bg-gray-100' : 'hover:bg-gray-50'
                              }`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 pl-6">
                                  <p className="text-sm text-gray-800">{p.type_plan} · Indice {p.indice}{p.lot ? ` · ${p.lot}` : ''}</p>
                                  {p.description && <p className="text-xs text-gray-400 truncate mt-0.5">{p.description}</p>}
                                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                    {hasValider && (
                                      <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                                        <CheckCircle className="w-2.5 h-2.5" /> {p.personnes_a_valider!.length} a valider
                                      </span>
                                    )}
                                    {hasVoir && (
                                      <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 bg-sky-100 text-sky-600 rounded-full">
                                        <Eye className="w-2.5 h-2.5" /> {p.personnes_a_voir!.length} a voir
                                      </span>
                                    )}
                                    {p.fichier_nom && (
                                      <span className="inline-flex items-center gap-0.5 text-xs text-gray-400">
                                        <FileText className="w-2.5 h-2.5" /> {p.fichier_nom}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUT_COLOR[p.statut]}`}>
                                  {p.statut}
                                </span>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Detail / Form */}
        <div className="flex-1">
          {showForm ? (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Nouveau plan de conception</h3>
                <button onClick={resetForm}><X className="w-4 h-4 text-gray-400" /></button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Projet</label>
                  <select
                    value={formProjetId}
                    onChange={e => {
                      const p = projets.find(x => x.id === e.target.value)
                      setFormProjetId(e.target.value)
                      setForm(f => ({ ...f, projet_nom: p?.nom ?? '' }))
                    }}
                    className={`${inputClass} bg-white`}
                  >
                    <option value="">Choisir un projet...</option>
                    {projets.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.reference ? `${p.reference} — ` : ''}{p.nom}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Type de plan</label>
                  <select value={form.type_plan} onChange={e => setForm({ ...form, type_plan: e.target.value as Plan['type_plan'] })}
                    className={`${inputClass} bg-white`}>
                    <option value="intention">Intention (Etape 1)</option>
                    <option value="proposition">Proposition (Etape 2)</option>
                    <option value="APD">APD — Plan de depart (Etape 3)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Indice</label>
                  <input value={form.indice} onChange={e => setForm({ ...form, indice: e.target.value })}
                    className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Lot concerne</label>
                  {lots.length > 0 ? (
                    <select
                      value={form.lot}
                      onChange={e => setForm({ ...form, lot: e.target.value })}
                      className={`${inputClass} bg-white`}
                    >
                      <option value="">Tous les lots</option>
                      {lots.map(l => (
                        <option key={l.id} value={l.corps_etat}>{l.corps_etat}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={form.lot}
                      onChange={e => setForm({ ...form, lot: e.target.value })}
                      placeholder={formProjetId ? 'Aucun lot trouve — saisir manuellement' : 'Choisir un projet d\'abord'}
                      disabled={!formProjetId}
                      className={`${inputClass} disabled:bg-gray-50 disabled:text-gray-400`}
                    />
                  )}
                </div>
              </div>

              {/* Upload plan */}
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Plan (fichier)</label>
                <input ref={fileRef} type="file" className="hidden"
                  accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg"
                  onChange={e => {
                    const f = e.target.files?.[0] ?? null
                    setForm(prev => ({ ...prev, fichier: f, fichier_nom: f?.name ?? null }))
                    e.target.value = ''
                  }} />
                {form.fichier ? (
                  <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-sm text-gray-700 truncate">{form.fichier.name}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">{(form.fichier.size / 1024).toFixed(0)} Ko</span>
                    </div>
                    <button onClick={() => setForm(prev => ({ ...prev, fichier: null, fichier_nom: null }))}
                      className="text-gray-400 hover:text-red-500 ml-2 flex-shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-2 w-full border border-dashed border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-500 hover:border-gray-400 hover:bg-gray-50 transition-colors justify-center">
                    <Upload className="w-4 h-4" />
                    Joindre un plan (PDF, DWG, image...)
                  </button>
                )}
              </div>

              {/* Personnes a valider / a voir */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
                  <UserSearch
                    label="Personnes a valider"
                    color="purple"
                    users={usersForValider}
                    selected={form.personnes_a_valider}
                    onChange={ids => setForm(prev => ({ ...prev, personnes_a_valider: ids }))}
                  />
                </div>
                <div className="bg-sky-50 border border-sky-100 rounded-xl p-3">
                  <UserSearch
                    label="Personnes a voir"
                    color="sky"
                    users={usersForVoir}
                    selected={form.personnes_a_voir}
                    onChange={ids => setForm(prev => ({ ...prev, personnes_a_voir: ids }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className={`${inputClass} resize-none`} />
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <button onClick={resetForm} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Annuler</button>
                <button onClick={savePlan} disabled={!formProjetId || saving}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40">
                  {saving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  Enregistrer
                </button>
              </div>
            </div>
          ) : sel && editMode ? (
            /* ── Mode edition ── */
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Modifier — {sel.projet_nom}</h3>
                <button onClick={() => setEditMode(false)}><X className="w-4 h-4 text-gray-400" /></button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Type de plan</label>
                  <select value={form.type_plan} onChange={e => setForm({ ...form, type_plan: e.target.value as Plan['type_plan'] })}
                    className={`${inputClass} bg-white`}>
                    <option value="intention">Intention (Etape 1)</option>
                    <option value="proposition">Proposition (Etape 2)</option>
                    <option value="APD">APD — Plan de depart (Etape 3)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Indice</label>
                  <input value={form.indice} onChange={e => setForm({ ...form, indice: e.target.value })}
                    className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Lot concerne</label>
                  <input value={form.lot} onChange={e => setForm({ ...form, lot: e.target.value })}
                    className={inputClass} />
                </div>
              </div>

              {/* Upload plan (remplacement) */}
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Plan (fichier)</label>
                <input ref={fileRef} type="file" className="hidden"
                  accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg"
                  onChange={e => {
                    const f = e.target.files?.[0] ?? null
                    setForm(prev => ({ ...prev, fichier: f, fichier_nom: f?.name ?? null }))
                    e.target.value = ''
                  }} />
                {form.fichier ? (
                  <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-sm text-gray-700 truncate">{form.fichier.name}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">{(form.fichier.size / 1024).toFixed(0)} Ko</span>
                    </div>
                    <button onClick={() => setForm(prev => ({ ...prev, fichier: null, fichier_nom: sel.fichier_nom }))}
                      className="text-gray-400 hover:text-red-500 ml-2 flex-shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : form.fichier_nom ? (
                  <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-sm text-gray-700 truncate">{form.fichier_nom}</span>
                      <span className="text-xs text-gray-400">Fichier actuel</span>
                    </div>
                    <button type="button" onClick={() => fileRef.current?.click()}
                      className="text-xs text-blue-600 hover:text-blue-700 ml-2 flex-shrink-0">
                      Remplacer
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-2 w-full border border-dashed border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-500 hover:border-gray-400 hover:bg-gray-50 transition-colors justify-center">
                    <Upload className="w-4 h-4" />
                    Joindre un plan (PDF, DWG, image...)
                  </button>
                )}
              </div>

              {/* Personnes a valider / a voir */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
                  <UserSearch
                    label="Personnes a valider"
                    color="purple"
                    users={usersForValider}
                    selected={form.personnes_a_valider}
                    onChange={ids => setForm(prev => ({ ...prev, personnes_a_valider: ids }))}
                  />
                </div>
                <div className="bg-sky-50 border border-sky-100 rounded-xl p-3">
                  <UserSearch
                    label="Personnes a voir"
                    color="sky"
                    users={usersForVoir}
                    selected={form.personnes_a_voir}
                    onChange={ids => setForm(prev => ({ ...prev, personnes_a_voir: ids }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={3} className={`${inputClass} resize-none`} />
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <button onClick={() => setEditMode(false)}
                  className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Annuler</button>
                <button onClick={updatePlan} disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40">
                  {saving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  Sauvegarder
                </button>
              </div>
            </div>

          ) : sel ? (
            /* ── Vue detail ── */
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{sel.projet_nom}</h3>
                  <p className="text-sm text-gray-500">{sel.type_plan} · Indice {sel.indice}{sel.lot ? ` · ${sel.lot}` : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUT_COLOR[sel.statut]}`}>{sel.statut}</span>
                  <button onClick={() => startEdit(sel)} className="p-1 text-gray-400 hover:text-blue-600" title="Modifier">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => deletePlan(sel.id)} className="p-1 text-gray-400 hover:text-red-500" title="Supprimer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Timeline position */}
              <div className="flex items-center gap-2">
                {STEPS.map((s, i) => {
                  const active = s.key === sel.type_plan
                  const done   = STEPS.findIndex(st => st.key === sel.type_plan) > i
                  return (
                    <div key={s.key} className="flex items-center gap-2">
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        active ? 'bg-gray-900 text-white' : done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {done && !active ? <CheckCircle className="w-3 h-3" /> : null}
                        {s.label}
                      </div>
                      {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-gray-300" />}
                    </div>
                  )
                })}
              </div>

              {/* Fichier joint */}
              {sel.fichier_path && sel.fichier_nom && (
                <a href={getFileUrl(sel.fichier_path)} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                  <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <span className="text-sm text-gray-700 flex-1 truncate">{sel.fichier_nom}</span>
                  <span className="text-xs text-gray-400">Ouvrir</span>
                </a>
              )}

              {/* Personnes taguees */}
              {((sel.personnes_a_valider?.length ?? 0) > 0 || (sel.personnes_a_voir?.length ?? 0) > 0) && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
                    <PersonnesBadges ids={sel.personnes_a_valider ?? []} users={users} color="purple" label="A valider" />
                  </div>
                  <div className="bg-sky-50 border border-sky-100 rounded-xl p-3">
                    <PersonnesBadges ids={sel.personnes_a_voir ?? []} users={users} color="sky" label="A voir" />
                  </div>
                </div>
              )}

              {sel.description && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Description</p>
                  <p className="text-sm text-gray-700">{sel.description}</p>
                </div>
              )}

              {/* Collaboration note */}
              <div className="p-3 bg-violet-50 border border-violet-100 rounded-lg">
                <p className="text-xs font-medium text-violet-700 mb-1">Collaboration</p>
                <p className="text-xs text-violet-600">
                  {sel.type_plan === 'intention'   && 'Commercial — analyse du besoin client'}
                  {sel.type_plan === 'proposition' && 'Commercial + Economiste — retours reunion et details'}
                  {sel.type_plan === 'APD'         && 'Commercial — validation finale, annexion au contrat'}
                </p>
              </div>

              {/* Commentaires */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                  <MessageSquare className="w-4 h-4 text-gray-500" />
                  <h4 className="text-xs font-semibold text-gray-700">Commentaires</h4>
                  {commentaires.length > 0 && (
                    <span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded-full font-medium">{commentaires.length}</span>
                  )}
                </div>

                <div className="max-h-64 overflow-y-auto px-4 py-3 space-y-3">
                  {commentaires.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">Aucun commentaire pour le moment</p>
                  ) : (
                    commentaires.map(c => {
                      const u = users.find(u => u.id === c.utilisateur_id)
                      const initials = u ? `${u.prenom[0]}${u.nom[0]}`.toUpperCase() : '??'
                      const isValider = sel.personnes_a_valider?.includes(c.utilisateur_id)
                      const isVoir    = sel.personnes_a_voir?.includes(c.utilisateur_id)
                      return (
                        <div key={c.id} className="flex gap-2.5">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            isValider ? 'bg-purple-100 text-purple-700' :
                            isVoir    ? 'bg-sky-100 text-sky-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-gray-800">
                                {u ? `${u.prenom} ${u.nom}` : 'Utilisateur'}
                              </span>
                              {isValider && (
                                <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded-full">valideur</span>
                              )}
                              {isVoir && (
                                <span className="text-xs px-1.5 py-0.5 bg-sky-100 text-sky-600 rounded-full">observateur</span>
                              )}
                              <span className="text-xs text-gray-400">
                                {new Date(c.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">{c.contenu}</p>
                          </div>
                        </div>
                      )
                    })
                  )}
                  <div ref={commentEndRef} />
                </div>

                {/* Zone de saisie */}
                <div className="border-t border-gray-200 px-4 py-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment() } }}
                      placeholder="Ecrire un commentaire..."
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 placeholder-gray-300"
                    />
                    <button
                      onClick={sendComment}
                      disabled={!newComment.trim() || sendingComment}
                      className="px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40 flex items-center gap-1.5"
                    >
                      {sendingComment
                        ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : <Send className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                {sel.statut === 'en_cours' && (
                  <button onClick={() => updateStatut(sel.id, 'soumis')}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Soumettre pour validation
                  </button>
                )}
                {sel.statut === 'soumis' && (
                  <>
                    <button onClick={() => { setSelectedEcoId(''); setShowValidateModal(true) }}
                      className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                      <CheckCircle className="w-4 h-4 inline mr-1" />Valider
                    </button>
                    <button onClick={() => updateStatut(sel.id, 'refuse')}
                      className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
                      Refuser
                    </button>
                  </>
                )}
                {sel.statut === 'refuse' && (
                  <button onClick={() => updateStatut(sel.id, 'en_cours')}
                    className="px-3 py-1.5 text-sm border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50">
                    Reprendre
                  </button>
                )}
                {sel.statut === 'valide' && (
                  <>
                    {sel.economiste_id && (() => {
                      const eco = users.find(u => u.id === sel.economiste_id)
                      return eco ? (
                        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-lg w-full">
                          <Calculator className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-semibold text-emerald-700">Economiste notifie</p>
                            <p className="text-xs text-emerald-600">{eco.prenom} {eco.nom} — plan transmis dans ses documents et notifications</p>
                          </div>
                        </div>
                      ) : null
                    })()}
                    {sel.type_plan === 'APD' && (
                      <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg w-full">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <p className="text-xs text-green-700 font-medium">APD valide — ce projet peut passer en phase Lancement.</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 h-64 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <Lightbulb className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Selectionnez un plan de conception</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modale validation + choix economiste ── */}
      {showValidateModal && sel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Valider le plan</h3>
                <p className="text-xs text-gray-500 mt-0.5">{sel.projet_nom} — {sel.type_plan} Indice {sel.indice}</p>
              </div>
              <button onClick={() => setShowValidateModal(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Fichier concerne */}
              {sel.fichier_nom && (
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-700 truncate">{sel.fichier_nom}</span>
                </div>
              )}

              {/* Choix economiste */}
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 mb-2">
                  <Calculator className="w-4 h-4 text-emerald-600" />
                  Economiste a notifier *
                </label>
                <p className="text-xs text-gray-400 mb-2">
                  L'economiste recevra le plan dans ses documents et une notification haute priorite.
                </p>
                <select
                  value={selectedEcoId}
                  onChange={e => setSelectedEcoId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                >
                  <option value="">Choisir un economiste...</option>
                  {users
                    .filter(u => u.role.toLowerCase().includes('economiste') || u.role.toLowerCase().includes('eco'))
                    .map(u => (
                      <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>
                    ))
                  }
                  {/* Separateur si d'autres users */}
                  {users.filter(u => !u.role.toLowerCase().includes('economiste') && !u.role.toLowerCase().includes('eco')).length > 0 && (
                    <option disabled>── Autres utilisateurs ──</option>
                  )}
                  {users
                    .filter(u => !u.role.toLowerCase().includes('economiste') && !u.role.toLowerCase().includes('eco'))
                    .map(u => (
                      <option key={u.id} value={u.id}>{u.prenom} {u.nom} ({u.role})</option>
                    ))
                  }
                </select>
              </div>

              {/* Resume */}
              {selectedEcoId && (() => {
                const eco = users.find(u => u.id === selectedEcoId)
                return eco ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                    <p className="text-xs text-emerald-700">
                      <span className="font-semibold">{eco.prenom} {eco.nom}</span> sera notifie et recevra le plan directement dans ses documents et notifications.
                    </p>
                  </div>
                ) : null
              })()}
            </div>

            <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => setShowValidateModal(false)}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
              >
                Annuler
              </button>
              <button
                onClick={validateWithEconomiste}
                disabled={!selectedEcoId || validating}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-40"
              >
                {validating
                  ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <CheckCircle className="w-4 h-4" />}
                Valider et notifier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
