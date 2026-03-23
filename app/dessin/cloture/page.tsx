'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'
import {
  Plus, X, CheckCircle, Clock, FolderCheck,
  FileText, Layers, ClipboardList
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

type ChecklistItem = { key: string; label: string; section: string }

const CHECKLIST: ChecklistItem[] = [
  /* Récolement */
  { key: 'recolement_realise',   label: 'Plans de récolement produits',        section: 'Récolement DOE'     },
  { key: 'modifications_terrain', label: 'Modifications terrain intégrées',    section: 'Récolement DOE'     },
  /* Synthèse */
  { key: 'synthese_creee',       label: 'Synthèse globale créée',              section: 'Synthèse finale'    },
  { key: 'tous_plans_regroupes', label: 'Tous les plans d\'exécution regroupés', section: 'Synthèse finale'  },
  /* Avenants / Réserves */
  { key: 'avenants_integres',    label: 'Avenants intégrés',                   section: 'Avenants / Réserves' },
  { key: 'reserves_corrigees',   label: 'Réserves / malfaçons corrigées',      section: 'Avenants / Réserves' },
  { key: 'doe_final_transmis',   label: 'DOE final transmis au CO',            section: 'Avenants / Réserves' },
]

type ClotureState = Record<string, boolean>
type FormState = { projet_nom: string; lot: string; indice: string; description: string }
const EMPTY: FormState = { projet_nom: '', lot: '', indice: 'A', description: '' }

export default function CloturePage() {
  const supabase = createClient()
  const [plans, setPlans]           = useState<Plan[]>([])
  const [selPlan, setSelPlan]       = useState<Plan | null>(null)
  const [showForm, setShowForm]     = useState(false)
  const [form, setForm]             = useState<FormState>(EMPTY)
  const [loading, setLoading]       = useState(true)

  /* Per-project checklist stored in localStorage */
  const [states, setStates] = useState<Record<string, ClotureState>>({})

  async function fetchPlans() {
    setLoading(true)
    const { data } = await supabase.schema('app').from('dessin_plans')
      .select('*').eq('phase', 'cloture').order('created_at', { ascending: false })
    setPlans((data as Plan[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchPlans()
    const saved = localStorage.getItem('dessin_cloture_states')
    if (saved) setStates(JSON.parse(saved))
  }, [])

  function toggleCheck(projet: string, key: string) {
    const current = states[projet] ?? {}
    const updated = { ...states, [projet]: { ...current, [key]: !current[key] } }
    setStates(updated)
    localStorage.setItem('dessin_cloture_states', JSON.stringify(updated))
  }

  function getProgress(projet: string) {
    const st = states[projet] ?? {}
    const done = CHECKLIST.filter(c => st[c.key]).length
    return { done, total: CHECKLIST.length, pct: Math.round((done / CHECKLIST.length) * 100) }
  }

  async function savePlan() {
    await supabase.schema('app').from('dessin_plans').insert([{ ...form, phase: 'cloture', type_plan: 'DOE' }])
    setShowForm(false); setForm(EMPTY); fetchPlans()
  }

  async function updateStatut(id: string, statut: Plan['statut']) {
    await supabase.schema('app').from('dessin_plans').update({ statut }).eq('id', id)
    fetchPlans(); if (selPlan?.id === id) setSelPlan({ ...selPlan, statut })
  }

  async function deletePlan(id: string) {
    await supabase.schema('app').from('dessin_plans').delete().eq('id', id)
    if (selPlan?.id === id) setSelPlan(null); fetchPlans()
  }

  const projects = [...new Set(plans.map(p => p.projet_nom))]
  const sections = [...new Set(CHECKLIST.map(c => c.section))]

  const SECTION_ICON: Record<string, React.ReactNode> = {
    'Récolement DOE':      <FileText className="w-4 h-4 text-green-500" />,
    'Synthèse finale':     <Layers className="w-4 h-4 text-blue-500" />,
    'Avenants / Réserves': <ClipboardList className="w-4 h-4 text-orange-500" />,
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar title="Clôture" subtitle="Plans DOE, synthèse finale et gestion des avenants" />

      <div className="px-6 pt-4 pb-8 flex gap-4">
        {/* Left: project checklists */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Projets en clôture</h3>
            <button onClick={() => { setShowForm(true); setForm(EMPTY) }}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-700">
              <Plus className="w-3 h-3" /> Nouveau DOE
            </button>
          </div>

          {/* Project progress cards */}
          {projects.map(projet => {
            const { done, total, pct } = getProgress(projet)
            const complete = done === total
            return (
              <div key={projet}
                onClick={() => setSelPlan(null)}
                className="bg-white border border-gray-200 rounded-xl p-3 cursor-pointer hover:border-gray-300 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-800 truncate">{projet}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${complete ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {done}/{total}
                  </span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${complete ? 'bg-green-500' : 'bg-violet-500'}`}
                    style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-gray-400 mt-1">{pct}% complété</p>
              </div>
            )
          })}

          {/* Plan list */}
          {loading ? <p className="text-sm text-gray-400 text-center py-4">Chargement…</p>
          : plans.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">Aucun plan DOE</p>
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
                      <p className="text-xs text-gray-500">{p.type_plan} · {p.lot || 'Général'} · Ind. {p.indice}</p>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                      p.statut === 'valide' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>{p.statut}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: checklist or plan detail */}
        <div className="flex-1 flex flex-col gap-4">
          {showForm ? (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900">Nouveau plan DOE</h3>
                <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-gray-400" /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Projet', key: 'projet_nom' },
                  { label: 'Lot / Section', key: 'lot' },
                  { label: 'Indice', key: 'indice' },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label className="block text-xs text-gray-500 mb-1">{label}</label>
                    <input value={(form as any)[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                ))}
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
          ) : selPlan ? (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{selPlan.projet_nom}</h3>
                  <p className="text-sm text-gray-500">{selPlan.type_plan} · {selPlan.lot || 'Général'} · Indice {selPlan.indice}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    selPlan.statut === 'valide' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>{selPlan.statut}</span>
                  <button onClick={() => deletePlan(selPlan.id)} className="p-1 text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="p-3 bg-green-50 border border-green-100 rounded-lg">
                <p className="text-xs font-medium text-green-700 mb-1">Collaboration — CO + Client</p>
                <p className="text-xs text-green-600">Plans As-built reflétant exactement le travail rendu. Intégrer avenants et réserves validées.</p>
              </div>
              {selPlan.description && <p className="text-sm text-gray-700 p-3 bg-gray-50 rounded-lg">{selPlan.description}</p>}
              <div className="flex gap-2">
                {selPlan.statut === 'en_cours' && (
                  <button onClick={() => updateStatut(selPlan.id, 'soumis')}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Soumettre</button>
                )}
                {selPlan.statut === 'soumis' && (
                  <>
                    <button onClick={() => updateStatut(selPlan.id, 'valide')}
                      className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                      <CheckCircle className="w-4 h-4 inline mr-1" />Valider
                    </button>
                    <button onClick={() => updateStatut(selPlan.id, 'refuse')}
                      className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50">Refuser</button>
                  </>
                )}
              </div>
            </div>
          ) : null}

          {/* Project checklist selector */}
          {!showForm && projects.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Checklist de clôture par projet</h3>

              {projects.map(projet => {
                const { done, total, pct } = getProgress(projet)
                const complete = done === total
                const st = states[projet] ?? {}
                return (
                  <div key={projet} className="mb-5 last:mb-0">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-gray-800">{projet}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${complete ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {pct}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
                      <div className={`h-full rounded-full ${complete ? 'bg-green-500' : 'bg-violet-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                    {sections.map(section => (
                      <div key={section} className="mb-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          {SECTION_ICON[section]}
                          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{section}</p>
                        </div>
                        <div className="space-y-1.5 pl-6">
                          {CHECKLIST.filter(c => c.section === section).map(item => (
                            <label key={item.key} className="flex items-center gap-2 cursor-pointer group">
                              <div
                                className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                  st[item.key] ? 'bg-violet-600 border-violet-600' : 'border-gray-300 group-hover:border-violet-400'
                                }`}
                                onClick={() => toggleCheck(projet, item.key)}>
                                {st[item.key] && <CheckCircle className="w-2.5 h-2.5 text-white" />}
                              </div>
                              <span className="text-sm text-gray-700">{item.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                    {complete && (
                      <div className="mt-3 flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-200">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <p className="text-xs text-green-700 font-medium">DOE complet — prêt à être transmis.</p>
                      </div>
                    )}
                  </div>
                )
              })}

              {projects.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Aucun projet en clôture</p>
              )}
            </div>
          )}

          {!selPlan && !showForm && projects.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 h-48 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <FolderCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Créez un plan DOE pour commencer</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
