'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'
import {
  Plus, X, CheckCircle, Clock, Hammer,
  ChevronRight, AlertCircle, RefreshCw
} from 'lucide-react'

type Plan = {
  id: string
  projet_nom: string
  phase: string
  type_plan: string
  indice: string
  lot: string
  statut: 'en_cours' | 'soumis' | 'valide' | 'refuse' | 'archive'
  description: string
  created_at: string
}

const STATUT_COLOR: Record<string, string> = {
  en_cours: 'bg-amber-100 text-amber-700',
  soumis:   'bg-blue-100 text-blue-700',
  valide:   'bg-green-100 text-green-700',
  refuse:   'bg-red-100 text-red-700',
  archive:  'bg-gray-100 text-gray-500',
}

const LOTS_EXE = ['Électricité', 'Plafonds', 'Menuiseries', 'Plomberie', 'CVC', 'Revêtements', 'Cloisonnement', 'Façades', 'Autre']
const INDICES  = ['A', 'B', 'C', 'D', 'E', 'F']

type FormState = { projet_nom: string; lot: string; indice: string; type_plan: string; description: string }
const EMPTY: FormState = { projet_nom: '', lot: '', indice: 'A', type_plan: 'EXE', description: '' }

export default function ChantierPage() {
  const supabase = createClient()
  const [plans, setPlans]           = useState<Plan[]>([])
  const [sel, setSel]               = useState<Plan | null>(null)
  const [showForm, setShowForm]     = useState(false)
  const [form, setForm]             = useState<FormState>(EMPTY)
  const [filterProjet, setFilterProjet] = useState<string>('tous')
  const [loading, setLoading]       = useState(true)

  async function fetchPlans() {
    setLoading(true)
    const { data } = await supabase.schema('app').from('dessin_plans')
      .select('*').eq('phase', 'chantier').order('created_at', { ascending: false })
    setPlans((data as Plan[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchPlans() }, [])

  async function savePlan() {
    await supabase.schema('app').from('dessin_plans').insert([{ ...form, phase: 'chantier' }])
    setShowForm(false); setForm(EMPTY); fetchPlans()
  }

  async function updateStatut(id: string, statut: Plan['statut']) {
    await supabase.schema('app').from('dessin_plans').update({ statut }).eq('id', id)
    fetchPlans(); if (sel?.id === id) setSel({ ...sel, statut })
  }

  async function addIndice(plan: Plan) {
    const idx = INDICES.indexOf(plan.indice)
    const next = INDICES[idx + 1]
    if (!next) return
    // Archive current, create new with next indice
    await supabase.schema('app').from('dessin_plans').update({ statut: 'archive' }).eq('id', plan.id)
    await supabase.schema('app').from('dessin_plans').insert([{
      projet_nom: plan.projet_nom, phase: 'chantier', type_plan: plan.type_plan,
      indice: next, lot: plan.lot, statut: 'en_cours', description: `Mise à jour indice ${next}`,
    }])
    fetchPlans()
  }

  async function deletePlan(id: string) {
    await supabase.schema('app').from('dessin_plans').delete().eq('id', id)
    if (sel?.id === id) setSel(null); fetchPlans()
  }

  const projects = [...new Set(plans.map(p => p.projet_nom))]
  const filtered = filterProjet === 'tous' ? plans : plans.filter(p => p.projet_nom === filterProjet)

  /* Group by project + lot for index view */
  const byProjectLot = filtered.reduce<Record<string, Plan[]>>((acc, p) => {
    const key = `${p.projet_nom}||${p.lot || 'général'}`
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar title="Chantier" subtitle="Plans d'exécution EXE et gestion des indices" />

      {/* Info banner */}
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
        {/* List */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Plans EXE</h3>
            <button onClick={() => { setShowForm(true); setForm(EMPTY) }}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-700">
              <Plus className="w-3 h-3" /> Nouveau
            </button>
          </div>

          {/* Filter by project */}
          {projects.length > 0 && (
            <select value={filterProjet} onChange={e => setFilterProjet(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-900">
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
              {filtered.map(p => (
                <button key={p.id} onClick={() => setSel(p)}
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
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail / Form */}
        <div className="flex-1 flex flex-col gap-4">
          {showForm ? (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900">Nouveau plan d'exécution</h3>
                <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-gray-400" /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Projet</label>
                  <input value={form.projet_nom} onChange={e => setForm({ ...form, projet_nom: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Type</label>
                  <select value={form.type_plan} onChange={e => setForm({ ...form, type_plan: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                    <option value="EXE">EXE — Plan d'exécution</option>
                    <option value="intention">Plan de détail</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Lot</label>
                  <select value={form.lot} onChange={e => setForm({ ...form, lot: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                    <option value="">Sélectionner…</option>
                    {LOTS_EXE.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Indice de départ</label>
                  <select value={form.indice} onChange={e => setForm({ ...form, indice: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                    {INDICES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Description</label>
                  <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                    rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none" />
                </div>
              </div>
              <div className="mt-4 flex gap-2 justify-end">
                <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Annuler</button>
                <button onClick={savePlan} disabled={!form.projet_nom}
                  className="px-4 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40">Enregistrer</button>
              </div>
            </div>
          ) : sel ? (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{sel.projet_nom}</h3>
                  <p className="text-sm text-gray-500">{sel.type_plan} · {sel.lot || 'Général'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUT_COLOR[sel.statut]}`}>{sel.statut}</span>
                  <button onClick={() => deletePlan(sel.id)} className="p-1 text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                </div>
              </div>

              {/* Indice display */}
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

              <div className="p-3 bg-orange-50 border border-orange-100 rounded-lg">
                <p className="text-xs font-medium text-orange-700 mb-1">Collaboration — ST (Sous-traitants) + CO</p>
                <p className="text-xs text-orange-600">Plans de détail pour les artisans (électricité, plafonds, menuiseries). Mise à jour selon CR de chantier CO.</p>
              </div>

              {sel.description && <p className="text-sm text-gray-700 p-3 bg-gray-50 rounded-lg">{sel.description}</p>}

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
          ) : null}

          {/* Index view */}
          {!showForm && Object.keys(byProjectLot).length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Vue par projet / lot</h3>
              <div className="space-y-3">
                {Object.entries(byProjectLot).map(([key, plansList]) => {
                  const [projet, lot] = key.split('||')
                  const active = plansList.filter(p => p.statut !== 'archive')
                  return (
                    <div key={key} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800">{projet} — {lot}</p>
                      </div>
                      <div className="flex gap-1">
                        {plansList.map(p => (
                          <span key={p.id} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer ${
                            p.statut === 'archive'  ? 'bg-gray-200 text-gray-500' :
                            p.statut === 'valide'   ? 'bg-green-100 text-green-700' :
                            p.statut === 'en_cours' ? 'bg-orange-100 text-orange-700' :
                            'bg-blue-100 text-blue-700'
                          }`} onClick={() => setSel(p)}>{p.indice}</span>
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
