'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'
import {
  Plus, X, CheckCircle, Clock, ChevronRight,
  Lightbulb, FileText, Award, AlertCircle
} from 'lucide-react'

type Plan = {
  id: string
  projet_nom: string
  phase: string
  type_plan: 'intention' | 'proposition' | 'APD'
  indice: string
  statut: 'en_cours' | 'soumis' | 'valide' | 'refuse' | 'archive'
  description: string
  lot: string
  created_at: string
}

const STEPS: { key: Plan['type_plan']; label: string; desc: string; icon: React.ReactNode }[] = [
  { key: 'intention',   label: 'Imagination',  desc: 'Premier plan d\'intention basé sur projets similaires', icon: <Lightbulb className="w-4 h-4" /> },
  { key: 'proposition', label: 'Affinage',      desc: 'Deuxième proposition enrichie après retours client',    icon: <FileText className="w-4 h-4" />   },
  { key: 'APD',         label: 'Plan APD',      desc: 'Plan de départ définitif — annexé au contrat signé',   icon: <Award className="w-4 h-4" />     },
]

const STATUT_COLOR: Record<string, string> = {
  en_cours: 'bg-amber-100 text-amber-700',
  soumis:   'bg-blue-100 text-blue-700',
  valide:   'bg-green-100 text-green-700',
  refuse:   'bg-red-100 text-red-700',
  archive:  'bg-gray-100 text-gray-500',
}

type FormState = { projet_nom: string; type_plan: Plan['type_plan']; indice: string; description: string; lot: string }
const EMPTY: FormState = { projet_nom: '', type_plan: 'intention', indice: 'A', description: '', lot: '' }

export default function ConceptionPage() {
  const supabase = createClient()
  const [plans, setPlans]       = useState<Plan[]>([])
  const [sel, setSel]           = useState<Plan | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState<FormState>(EMPTY)
  const [filter, setFilter]     = useState<string>('tous')
  const [loading, setLoading]   = useState(true)

  async function fetchPlans() {
    setLoading(true)
    const { data } = await supabase.schema('app').from('dessin_plans')
      .select('*').eq('phase', 'conception').order('created_at', { ascending: false })
    setPlans((data as Plan[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchPlans() }, [])

  async function savePlan() {
    await supabase.schema('app').from('dessin_plans').insert([{ ...form, phase: 'conception' }])
    setShowForm(false); setForm(EMPTY); fetchPlans()
  }

  async function updateStatut(id: string, statut: Plan['statut']) {
    await supabase.schema('app').from('dessin_plans').update({ statut }).eq('id', id)
    fetchPlans()
    if (sel?.id === id) setSel({ ...sel, statut })
  }

  async function deletePlan(id: string) {
    await supabase.schema('app').from('dessin_plans').delete().eq('id', id)
    if (sel?.id === id) setSel(null)
    fetchPlans()
  }

  /* Group plans by project */
  const projects = [...new Set(plans.map(p => p.projet_nom))]
  const filtered = filter === 'tous' ? plans : plans.filter(p => p.type_plan === filter)

  /* APD validated projects */
  const apdValides = plans.filter(p => p.type_plan === 'APD' && p.statut === 'valide').map(p => p.projet_nom)

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar title="Conception" subtitle="Imagination, affinage itératif et Plan APD" />

      {/* Steps banner */}
      <div className="mx-6 mt-4 bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                <span className="text-gray-400">{s.icon}</span>
                <div>
                  <p className="text-xs font-semibold text-gray-700">Étape {i + 1} — {s.label}</p>
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
            <span className="font-semibold">{apdValides.length} projet(s)</span> avec APD validé : {apdValides.join(', ')}. Prêts pour la phase Lancement.
          </p>
        </div>
      )}

      <div className="px-6 pt-4 pb-8 flex gap-4">
        {/* List */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Plans de conception</h3>
            <button onClick={() => { setShowForm(true); setForm(EMPTY) }}
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
            <p className="text-sm text-gray-400 text-center py-8">Chargement…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Aucun plan</p>
          ) : (
            <div className="space-y-2">
              {filtered.map(p => (
                <button key={p.id} onClick={() => setSel(p)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    sel?.id === p.id ? 'border-gray-900 bg-gray-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{p.projet_nom}</p>
                      <p className="text-xs text-gray-500">{p.type_plan} · Indice {p.indice}</p>
                      {p.description && <p className="text-xs text-gray-400 truncate mt-0.5">{p.description}</p>}
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUT_COLOR[p.statut]}`}>
                      {p.statut}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail / Form */}
        <div className="flex-1">
          {showForm ? (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900">Nouveau plan de conception</h3>
                <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-gray-400" /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Projet</label>
                  <input value={form.projet_nom} onChange={e => setForm({ ...form, projet_nom: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Type de plan</label>
                  <select value={form.type_plan} onChange={e => setForm({ ...form, type_plan: e.target.value as Plan['type_plan'] })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                    <option value="intention">Intention (Étape 1)</option>
                    <option value="proposition">Proposition (Étape 2)</option>
                    <option value="APD">APD — Plan de départ (Étape 3)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Indice</label>
                  <input value={form.indice} onChange={e => setForm({ ...form, indice: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Lot concerné</label>
                  <input value={form.lot} onChange={e => setForm({ ...form, lot: e.target.value })}
                    placeholder="ex: Électricité"
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Description</label>
                  <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                    rows={3}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none" />
                </div>
              </div>
              <div className="mt-4 flex gap-2 justify-end">
                <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Annuler</button>
                <button onClick={savePlan} disabled={!form.projet_nom}
                  className="px-4 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40">
                  Enregistrer
                </button>
              </div>
            </div>
          ) : sel ? (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{sel.projet_nom}</h3>
                  <p className="text-sm text-gray-500">{sel.type_plan} · Indice {sel.indice}{sel.lot ? ` · ${sel.lot}` : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUT_COLOR[sel.statut]}`}>{sel.statut}</span>
                  <button onClick={() => deletePlan(sel.id)} className="p-1 text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
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
                  {sel.type_plan === 'proposition' && 'Commercial + Économiste — retours réunion et détails'}
                  {sel.type_plan === 'APD'         && 'Commercial — validation finale, annexion au contrat'}
                </p>
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
                    <button onClick={() => updateStatut(sel.id, 'valide')}
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
                {sel.statut === 'valide' && sel.type_plan === 'APD' && (
                  <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg w-full">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <p className="text-xs text-green-700 font-medium">APD validé — ce projet peut passer en phase Lancement.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 h-64 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <Lightbulb className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Sélectionnez un plan de conception</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
