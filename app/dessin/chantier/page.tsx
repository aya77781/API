'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'
import { useUser } from '@/hooks/useUser'
import {
  Plus, X, ChevronRight, RefreshCw, Hammer,
  Upload, FileText, Search, Eye, CheckCircle,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Plan = {
  id: string
  projet_nom: string
  phase: string
  type_plan: string
  indice: string
  lot: string
  statut: 'en_cours' | 'soumis' | 'valide' | 'refuse' | 'archive'
  description: string
  fichier_path: string | null
  fichier_nom: string | null
  personnes_a_valider: string[] | null
  personnes_a_voir: string[] | null
  created_at: string
}

type Utilisateur = { id: string; prenom: string; nom: string; role: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUT_COLOR: Record<string, string> = {
  en_cours: 'bg-amber-100 text-amber-700',
  soumis:   'bg-blue-100 text-blue-700',
  valide:   'bg-green-100 text-green-700',
  refuse:   'bg-red-100 text-red-700',
  archive:  'bg-gray-100 text-gray-500',
}

const LOTS_EXE = ['Électricité', 'Plafonds', 'Menuiseries', 'Plomberie', 'CVC', 'Revêtements', 'Cloisonnement', 'Façades', 'Autre']
const INDICES  = ['A', 'B', 'C', 'D', 'E', 'F']

type FormState = {
  projet_nom: string
  lot: string
  indice: string
  type_plan: string
  description: string
  personnes_a_valider: string[]
  personnes_a_voir: string[]
  fichier: File | null
  fichier_nom: string | null
}

const EMPTY: FormState = {
  projet_nom: '', lot: '', indice: 'A', type_plan: 'EXE',
  description: '', personnes_a_valider: [], personnes_a_voir: [],
  fichier: null, fichier_nom: null,
}

// ─── UserSearch ───────────────────────────────────────────────────────────────

function UserSearch({ label, color, users, selected, onChange }: {
  label: string
  color: 'purple' | 'sky'
  users: Utilisateur[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [query, setQuery] = useState('')

  const excluded = selected  // already selected in this group
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
          placeholder="Rechercher par nom ou rôle..."
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
            <p className="text-xs text-gray-400 text-center py-3">Aucun résultat</p>
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

// ─── PersonnesBadges (vue détail) ─────────────────────────────────────────────

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

export default function ChantierPage() {
  const supabase = createClient()
  const { user } = useUser()

  const [plans, setPlans]               = useState<Plan[]>([])
  const [users, setUsers]               = useState<Utilisateur[]>([])
  const [sel, setSel]                   = useState<Plan | null>(null)
  const [showForm, setShowForm]         = useState(false)
  const [form, setForm]                 = useState<FormState>(EMPTY)
  const [filterProjet, setFilterProjet] = useState<string>('tous')
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const fileRef                         = useRef<HTMLInputElement>(null)

  async function fetchPlans() {
    setLoading(true)
    const { data } = await supabase.schema('app').from('dessin_plans')
      .select('*').eq('phase', 'chantier').order('created_at', { ascending: false })
    setPlans((data as Plan[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchPlans()
    supabase.schema('app').from('utilisateurs')
      .select('id, prenom, nom, role').eq('actif', true).order('prenom')
      .then(({ data }) => setUsers((data as Utilisateur[]) ?? []))
  }, [])

  async function savePlan() {
    if (!form.projet_nom) return
    setSaving(true)

    let fichier_path: string | null = null

    if (form.fichier) {
      const path = `plans/chantier/${Date.now()}_${form.fichier.name}`
      const { error: uploadErr } = await supabase.storage
        .from('projets').upload(path, form.fichier, { upsert: true })
      if (!uploadErr) fichier_path = path
    }

    await supabase.schema('app').from('dessin_plans').insert([{
      projet_nom:          form.projet_nom,
      phase:               'chantier',
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

    // Notify — "à valider" = high priority
    const alertes = [
      ...form.personnes_a_valider.map(uid => ({
        utilisateur_id: uid,
        type: 'plan_mis_a_jour',
        titre: `Plan à valider — ${form.projet_nom}`,
        message: `${form.type_plan} · Indice ${form.indice}${form.lot ? ` · ${form.lot}` : ''}`,
        priorite: 'high',
        lue: false,
      })),
      ...form.personnes_a_voir.map(uid => ({
        utilisateur_id: uid,
        type: 'plan_mis_a_jour',
        titre: `Nouveau plan à voir — ${form.projet_nom}`,
        message: `${form.type_plan} · Indice ${form.indice}${form.lot ? ` · ${form.lot}` : ''}`,
        priorite: 'normal',
        lue: false,
      })),
    ]

    if (alertes.length && user) {
      await supabase.schema('app').from('alertes').insert(alertes)
    }

    setSaving(false)
    setShowForm(false)
    setForm(EMPTY)
    fetchPlans()
  }

  async function updateStatut(id: string, statut: Plan['statut']) {
    await supabase.schema('app').from('dessin_plans').update({ statut }).eq('id', id)
    fetchPlans()
    if (sel?.id === id) setSel({ ...sel, statut })
  }

  async function addIndice(plan: Plan) {
    const idx  = INDICES.indexOf(plan.indice)
    const next = INDICES[idx + 1]
    if (!next) return
    await supabase.schema('app').from('dessin_plans').update({ statut: 'archive' }).eq('id', plan.id)
    await supabase.schema('app').from('dessin_plans').insert([{
      projet_nom: plan.projet_nom, phase: 'chantier', type_plan: plan.type_plan,
      indice: next, lot: plan.lot, statut: 'en_cours',
      description: `Mise à jour indice ${next}`,
      personnes_a_valider: plan.personnes_a_valider,
      personnes_a_voir:    plan.personnes_a_voir,
      fichier_path: null, fichier_nom: null,
    }])
    fetchPlans()
  }

  async function deletePlan(id: string) {
    await supabase.schema('app').from('dessin_plans').delete().eq('id', id)
    if (sel?.id === id) setSel(null)
    fetchPlans()
  }

  function getFileUrl(path: string) {
    const { data } = supabase.storage.from('projets').getPublicUrl(path)
    return data.publicUrl
  }

  const projects = [...new Set(plans.map(p => p.projet_nom))]
  const filtered = filterProjet === 'tous' ? plans : plans.filter(p => p.projet_nom === filterProjet)

  const byProjectLot = filtered.reduce<Record<string, Plan[]>>((acc, p) => {
    const key = `${p.projet_nom}||${p.lot || 'général'}`
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {})

  const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'

  // Exclude users already picked in the other group
  const usersForValider = users.filter(u => !form.personnes_a_voir.includes(u.id))
  const usersForVoir    = users.filter(u => !form.personnes_a_valider.includes(u.id))

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar title="Chantier" subtitle="Plans d'exécution EXE et gestion des indices" />

      <div className="mx-6 mt-4 bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-3">
        <RefreshCw className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-xs font-semibold text-gray-700">Gestion des indices (A, B, C…)</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Chaque mise à jour terrain (CR de chantier via CO) génère un nouvel indice. L'ancien plan est archivé automatiquement.
          </p>
        </div>
      </div>

      <div className="px-6 pt-4 pb-8 flex gap-4">

        {/* ── Liste ── */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Plans EXE</h3>
            <button onClick={() => { setShowForm(true); setForm(EMPTY); setSel(null) }}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-700">
              <Plus className="w-3 h-3" /> Nouveau
            </button>
          </div>

          {projects.length > 0 && (
            <select value={filterProjet} onChange={e => setFilterProjet(e.target.value)} className={inputClass}>
              <option value="tous">Tous les projets</option>
              {projects.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          )}

          {loading ? (
            <p className="text-sm text-gray-400 text-center py-8">Chargement…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Aucun plan EXE</p>
          ) : (
            <div className="space-y-2">
              {filtered.map(p => {
                const hasValider = p.personnes_a_valider && p.personnes_a_valider.length > 0
                const hasVoir    = p.personnes_a_voir && p.personnes_a_voir.length > 0
                return (
                  <button key={p.id} onClick={() => { setSel(p); setShowForm(false) }}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      sel?.id === p.id ? 'border-gray-900 bg-gray-50 shadow-sm' :
                      p.statut === 'archive' ? 'border-gray-100 bg-gray-50 opacity-60' :
                      'border-gray-200 bg-white hover:border-gray-300'
                    }`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{p.projet_nom}</p>
                        <p className="text-xs text-gray-500">{p.type_plan} · {p.lot || 'Général'}</p>
                        <p className="text-xs text-orange-600 font-semibold mt-0.5">Indice {p.indice}</p>
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUT_COLOR[p.statut]}`}>{p.statut}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {hasValider && (
                        <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                          <CheckCircle className="w-3 h-3" /> {p.personnes_a_valider!.length} à valider
                        </span>
                      )}
                      {hasVoir && (
                        <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 bg-sky-100 text-sky-600 rounded-full">
                          <Eye className="w-3 h-3" /> {p.personnes_a_voir!.length} à voir
                        </span>
                      )}
                      {p.fichier_nom && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                          <FileText className="w-3 h-3" /> {p.fichier_nom}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Détail / Formulaire ── */}
        <div className="flex-1 flex flex-col gap-4">

          {showForm && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Nouveau plan d'exécution</h3>
                <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-gray-400" /></button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Projet</label>
                  <input value={form.projet_nom} onChange={e => setForm({ ...form, projet_nom: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Type</label>
                  <select value={form.type_plan} onChange={e => setForm({ ...form, type_plan: e.target.value })} className={inputClass}>
                    <option value="EXE">EXE — Plan d'exécution</option>
                    <option value="intention">Plan de détail</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Lot</label>
                  <select value={form.lot} onChange={e => setForm({ ...form, lot: e.target.value })} className={inputClass}>
                    <option value="">Sélectionner…</option>
                    {LOTS_EXE.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Indice de départ</label>
                  <select value={form.indice} onChange={e => setForm({ ...form, indice: e.target.value })} className={inputClass}>
                    {INDICES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
              </div>

              {/* Deux zones de tagging */}
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
                  <UserSearch
                    label="Personnes à valider"
                    color="purple"
                    users={usersForValider}
                    selected={form.personnes_a_valider}
                    onChange={ids => setForm({ ...form, personnes_a_valider: ids })}
                  />
                </div>
                <div className="bg-sky-50 border border-sky-100 rounded-xl p-3">
                  <UserSearch
                    label="Personnes à voir"
                    color="sky"
                    users={usersForVoir}
                    selected={form.personnes_a_voir}
                    onChange={ids => setForm({ ...form, personnes_a_voir: ids })}
                  />
                </div>
              </div>

              {/* Upload plan */}
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Plan (fichier)</label>
                <input ref={fileRef} type="file" className="hidden"
                  accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg"
                  onChange={e => {
                    const f = e.target.files?.[0] ?? null
                    setForm({ ...form, fichier: f, fichier_nom: f?.name ?? null })
                    e.target.value = ''
                  }} />
                {form.fichier ? (
                  <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-sm text-gray-700 truncate">{form.fichier.name}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">{(form.fichier.size / 1024).toFixed(0)} Ko</span>
                    </div>
                    <button onClick={() => setForm({ ...form, fichier: null, fichier_nom: null })}
                      className="text-gray-400 hover:text-red-500 ml-2 flex-shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-2 w-full border border-dashed border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-500 hover:border-gray-400 hover:bg-gray-50 transition-colors justify-center">
                    <Upload className="w-4 h-4" />
                    Joindre un plan (PDF, DWG, image…)
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={2} className={`${inputClass} resize-none`} />
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <button onClick={() => setShowForm(false)}
                  className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                  Annuler
                </button>
                <button onClick={savePlan} disabled={!form.projet_nom || saving}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40">
                  {saving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  Enregistrer
                </button>
              </div>
            </div>
          )}

          {/* Détail */}
          {!showForm && sel && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{sel.projet_nom}</h3>
                  <p className="text-sm text-gray-500">{sel.type_plan} · {sel.lot || 'Général'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUT_COLOR[sel.statut]}`}>{sel.statut}</span>
                  <button onClick={() => deletePlan(sel.id)} className="p-1 text-gray-400 hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Indice timeline */}
              <div className="flex items-center gap-2">
                {INDICES.slice(0, INDICES.indexOf(sel.indice) + 2).map((ind, i) => {
                  const past    = i < INDICES.indexOf(sel.indice)
                  const current = ind === sel.indice
                  return (
                    <div key={ind} className="flex items-center gap-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                        current ? 'border-orange-500 bg-orange-50 text-orange-700' :
                        past    ? 'border-green-400 bg-green-50 text-green-700' :
                        'border-dashed border-gray-300 text-gray-400'
                      }`}>{ind}</div>
                      {i < INDICES.indexOf(sel.indice) + 1 && <ChevronRight className="w-3 h-3 text-gray-300" />}
                    </div>
                  )
                })}
              </div>

              {/* Fichier */}
              {sel.fichier_path && sel.fichier_nom && (
                <a href={getFileUrl(sel.fichier_path)} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                  <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <span className="text-sm text-gray-700 flex-1 truncate">{sel.fichier_nom}</span>
                  <span className="text-xs text-gray-400">Ouvrir</span>
                </a>
              )}

              {/* Personnes tagées */}
              {((sel.personnes_a_valider?.length ?? 0) > 0 || (sel.personnes_a_voir?.length ?? 0) > 0) && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
                    <PersonnesBadges ids={sel.personnes_a_valider ?? []} users={users} color="purple" label="À valider" />
                  </div>
                  <div className="bg-sky-50 border border-sky-100 rounded-xl p-3">
                    <PersonnesBadges ids={sel.personnes_a_voir ?? []} users={users} color="sky" label="À voir" />
                  </div>
                </div>
              )}

              {sel.description && (
                <p className="text-sm text-gray-700 p-3 bg-gray-50 rounded-lg">{sel.description}</p>
              )}

              <div className="flex gap-2 flex-wrap">
                {sel.statut === 'en_cours' && (
                  <button onClick={() => updateStatut(sel.id, 'soumis')}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Soumettre</button>
                )}
                {sel.statut === 'soumis' && (
                  <>
                    <button onClick={() => updateStatut(sel.id, 'valide')}
                      className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">Valider</button>
                    <button onClick={() => updateStatut(sel.id, 'refuse')}
                      className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50">Refuser</button>
                  </>
                )}
                {sel.statut === 'valide' && INDICES.indexOf(sel.indice) < INDICES.length - 1 && (
                  <button onClick={() => addIndice(sel)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600">
                    <RefreshCw className="w-4 h-4" /> Nouvel indice {INDICES[INDICES.indexOf(sel.indice) + 1]}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Vue par projet / lot */}
          {!showForm && Object.keys(byProjectLot).length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Vue par projet / lot</h3>
              <div className="space-y-3">
                {Object.entries(byProjectLot).map(([key, plansList]) => {
                  const [projet, lot] = key.split('||')
                  return (
                    <div key={key} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800">{projet} — {lot}</p>
                      </div>
                      <div className="flex gap-1">
                        {plansList.map(p => (
                          <span key={p.id} onClick={() => { setSel(p); setShowForm(false) }}
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer ${
                              p.statut === 'archive'  ? 'bg-gray-200 text-gray-500' :
                              p.statut === 'valide'   ? 'bg-green-100 text-green-700' :
                              p.statut === 'en_cours' ? 'bg-orange-100 text-orange-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>{p.indice}</span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {!sel && !showForm && (
            <div className="bg-white rounded-xl border border-gray-200 h-48 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <Hammer className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Sélectionnez un plan EXE</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
