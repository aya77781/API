'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'
import {
  Plus, X, CheckCircle, Clock, FileSearch,
  ChevronDown, ChevronUp, AlertCircle
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

type Variante = {
  id: string
  projet_nom: string
  st_nom: string
  lot: string
  description: string
  statut: 'proposee' | 'integree' | 'refusee'
  created_at: string
}

const STATUT_PLAN: Record<string, string> = {
  en_cours: 'bg-amber-100 text-amber-700',
  soumis:   'bg-blue-100 text-blue-700',
  valide:   'bg-green-100 text-green-700',
  refuse:   'bg-red-100 text-red-700',
  archive:  'bg-gray-100 text-gray-500',
}

const STATUT_VAR: Record<string, string> = {
  proposee: 'bg-amber-100 text-amber-700',
  integree: 'bg-green-100 text-green-700',
  refusee:  'bg-red-100 text-red-700',
}

type PlanForm = { projet_nom: string; lot: string; indice: string; description: string }
type VarForm  = { projet_nom: string; st_nom: string; lot: string; description: string }
const EMPTY_PLAN: PlanForm = { projet_nom: '', lot: '', indice: 'A', description: '' }
const EMPTY_VAR:  VarForm  = { projet_nom: '', st_nom: '', lot: '', description: '' }

export default function ConsultationPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<'dce' | 'variantes'>('dce')

  const [plans, setPlans]           = useState<Plan[]>([])
  const [variantes, setVariantes]   = useState<Variante[]>([])
  const [selPlan, setSelPlan]       = useState<Plan | null>(null)
  const [selVar, setSelVar]         = useState<Variante | null>(null)
  const [showPlanForm, setShowPlanForm] = useState(false)
  const [showVarForm, setShowVarForm]   = useState(false)
  const [planForm, setPlanForm]     = useState<PlanForm>(EMPTY_PLAN)
  const [varForm, setVarForm]       = useState<VarForm>(EMPTY_VAR)
  const [loading, setLoading]       = useState(true)

  async function fetchAll() {
    setLoading(true)
    const [{ data: p }, { data: v }] = await Promise.all([
      supabase.schema('app').from('dessin_plans').select('*').eq('phase', 'consultation').order('created_at', { ascending: false }),
      supabase.schema('app').from('dessin_variantes').select('*').order('created_at', { ascending: false }),
    ])
    setPlans((p as Plan[]) ?? [])
    setVariantes((v as Variante[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  async function savePlan() {
    await supabase.schema('app').from('dessin_plans').insert([{ ...planForm, phase: 'consultation', type_plan: 'DCE' }])
    setShowPlanForm(false); setPlanForm(EMPTY_PLAN); fetchAll()
  }

  async function saveVar() {
    await supabase.schema('app').from('dessin_variantes').insert([varForm])
    setShowVarForm(false); setVarForm(EMPTY_VAR); fetchAll()
  }

  async function updatePlanStatut(id: string, statut: Plan['statut']) {
    await supabase.schema('app').from('dessin_plans').update({ statut }).eq('id', id)
    fetchAll(); if (selPlan?.id === id) setSelPlan({ ...selPlan, statut })
  }

  async function updateVarStatut(id: string, statut: Variante['statut']) {
    await supabase.schema('app').from('dessin_variantes').update({ statut }).eq('id', id)
    fetchAll(); if (selVar?.id === id) setSelVar({ ...selVar, statut })
  }

  async function deletePlan(id: string) {
    await supabase.schema('app').from('dessin_plans').delete().eq('id', id)
    if (selPlan?.id === id) setSelPlan(null); fetchAll()
  }

  async function deleteVar(id: string) {
    await supabase.schema('app').from('dessin_variantes').delete().eq('id', id)
    if (selVar?.id === id) setSelVar(null); fetchAll()
  }

  const variantesEnAttente = variantes.filter(v => v.statut === 'proposee').length

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar title="Consultation" subtitle="Dossier DCE et variantes des sous-traitants" />

      {variantesEnAttente > 0 && (
        <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700">
            <span className="font-semibold">{variantesEnAttente} variante(s) ST</span> en attente d'intégration ou de décision.
          </p>
        </div>
      )}

      <div className="px-6 pt-4">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
          {(['dce', 'variantes'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t === 'dce' ? 'Carnet DCE' : `Variantes ST${variantesEnAttente > 0 ? ` (${variantesEnAttente})` : ''}`}
            </button>
          ))}
        </div>
      </div>

      {/* DCE */}
      {tab === 'dce' && (
        <div className="px-6 pt-4 pb-8 flex gap-4">
          <div className="w-80 flex-shrink-0 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Plans DCE</h3>
              <button onClick={() => { setShowPlanForm(true); setPlanForm(EMPTY_PLAN) }}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-700">
                <Plus className="w-3 h-3" /> Ajouter
              </button>
            </div>
            {loading ? <p className="text-sm text-gray-400 text-center py-8">Chargement…</p>
            : plans.length === 0 ? <p className="text-sm text-gray-400 text-center py-8">Aucun plan DCE</p>
            : (
              <div className="space-y-2">
                {plans.map(p => (
                  <button key={p.id} onClick={() => setSelPlan(p)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      selPlan?.id === p.id ? 'border-gray-900 bg-gray-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{p.projet_nom}</p>
                        <p className="text-xs text-gray-500">{p.lot ? `Lot : ${p.lot}` : 'Plan général'} · Ind. {p.indice}</p>
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUT_PLAN[p.statut]}`}>{p.statut}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1">
            {showPlanForm ? (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900">Nouveau plan DCE</h3>
                  <button onClick={() => setShowPlanForm(false)}><X className="w-4 h-4 text-gray-400" /></button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Projet', key: 'projet_nom' },
                    { label: 'Lot', key: 'lot' },
                    { label: 'Indice', key: 'indice' },
                  ].map(({ label, key }) => (
                    <div key={key}>
                      <label className="block text-xs text-gray-500 mb-1">{label}</label>
                      <input value={(planForm as any)[key]} onChange={e => setPlanForm({ ...planForm, [key]: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                    </div>
                  ))}
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Description</label>
                    <textarea value={planForm.description} onChange={e => setPlanForm({ ...planForm, description: e.target.value })}
                      rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none" />
                  </div>
                </div>
                <div className="mt-4 flex gap-2 justify-end">
                  <button onClick={() => setShowPlanForm(false)} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Annuler</button>
                  <button onClick={savePlan} disabled={!planForm.projet_nom}
                    className="px-4 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40">Enregistrer</button>
                </div>
              </div>
            ) : selPlan ? (
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">{selPlan.projet_nom}</h3>
                    <p className="text-sm text-gray-500">DCE · {selPlan.lot || 'Général'} · Indice {selPlan.indice}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUT_PLAN[selPlan.statut]}`}>{selPlan.statut}</span>
                    <button onClick={() => deletePlan(selPlan.id)} className="p-1 text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="p-3 bg-purple-50 border border-purple-100 rounded-lg">
                  <p className="text-xs font-medium text-purple-700 mb-1">Collaboration — Économiste</p>
                  <p className="text-xs text-purple-600">Préparation à partir de l'estimation + permis de construire. Agencement, cloisonnement, réseaux.</p>
                </div>
                {selPlan.description && <p className="text-sm text-gray-700 p-3 bg-gray-50 rounded-lg">{selPlan.description}</p>}
                <div className="flex gap-2">
                  {selPlan.statut === 'en_cours' && (
                    <button onClick={() => updatePlanStatut(selPlan.id, 'soumis')}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Soumettre</button>
                  )}
                  {selPlan.statut === 'soumis' && (
                    <>
                      <button onClick={() => updatePlanStatut(selPlan.id, 'valide')}
                        className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">Valider</button>
                      <button onClick={() => updatePlanStatut(selPlan.id, 'refuse')}
                        className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50">Refuser</button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 h-64 flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <FileSearch className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Sélectionnez un plan DCE</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VARIANTES */}
      {tab === 'variantes' && (
        <div className="px-6 pt-4 pb-8 flex gap-4">
          <div className="w-80 flex-shrink-0 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Variantes ST</h3>
              <button onClick={() => { setShowVarForm(true); setVarForm(EMPTY_VAR) }}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-700">
                <Plus className="w-3 h-3" /> Ajouter
              </button>
            </div>
            {variantes.length === 0 ? <p className="text-sm text-gray-400 text-center py-8">Aucune variante</p>
            : (
              <div className="space-y-2">
                {variantes.map(v => (
                  <button key={v.id} onClick={() => setSelVar(v)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      selVar?.id === v.id ? 'border-gray-900 bg-gray-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{v.projet_nom}</p>
                        <p className="text-xs text-gray-500 truncate">{v.st_nom}{v.lot ? ` · ${v.lot}` : ''}</p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{v.description}</p>
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUT_VAR[v.statut]}`}>{v.statut}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1">
            {showVarForm ? (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900">Nouvelle variante ST</h3>
                  <button onClick={() => setShowVarForm(false)}><X className="w-4 h-4 text-gray-400" /></button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Projet', key: 'projet_nom' },
                    { label: 'Sous-traitant', key: 'st_nom' },
                    { label: 'Lot', key: 'lot' },
                  ].map(({ label, key }) => (
                    <div key={key}>
                      <label className="block text-xs text-gray-500 mb-1">{label}</label>
                      <input value={(varForm as any)[key]} onChange={e => setVarForm({ ...varForm, [key]: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                    </div>
                  ))}
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Description de la variante</label>
                    <textarea value={varForm.description} onChange={e => setVarForm({ ...varForm, description: e.target.value })}
                      rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none" />
                  </div>
                </div>
                <div className="mt-4 flex gap-2 justify-end">
                  <button onClick={() => setShowVarForm(false)} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Annuler</button>
                  <button onClick={saveVar} disabled={!varForm.projet_nom || !varForm.description}
                    className="px-4 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40">Enregistrer</button>
                </div>
              </div>
            ) : selVar ? (
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">{selVar.projet_nom}</h3>
                    <p className="text-sm text-gray-500">{selVar.st_nom}{selVar.lot ? ` · ${selVar.lot}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUT_VAR[selVar.statut]}`}>{selVar.statut}</span>
                    <button onClick={() => deleteVar(selVar.id)} className="p-1 text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="p-3 bg-purple-50 border border-purple-100 rounded-lg">
                  <p className="text-xs font-medium text-purple-700 mb-1">Collaboration — ST + Économiste</p>
                  <p className="text-xs text-purple-600">Intégrer uniquement si validée par l'Économiste. Mettre à jour les plans DCE en conséquence.</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Description</p>
                  <p className="text-sm text-gray-700">{selVar.description}</p>
                </div>
                <div className="flex gap-2">
                  {selVar.statut === 'proposee' && (
                    <>
                      <button onClick={() => updateVarStatut(selVar.id, 'integree')}
                        className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                        <CheckCircle className="w-4 h-4 inline mr-1" />Intégrer
                      </button>
                      <button onClick={() => updateVarStatut(selVar.id, 'refusee')}
                        className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50">Refuser</button>
                    </>
                  )}
                  {selVar.statut === 'integree' && (
                    <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <p className="text-xs text-green-700">Variante intégrée — plans DCE mis à jour.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 h-64 flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <FileSearch className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Sélectionnez une variante ST</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
