'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'
import {
  Plus, X, CheckCircle, Clock, ChevronRight,
  Rocket, FileText, Users, ShieldCheck
} from 'lucide-react'

type Notice = {
  id: string
  projet_nom: string
  lot: string
  contenu: string
  statut: 'brouillon' | 'valide' | 'transmis'
  created_at: string
}

/* Per-project lancement state stored locally for simplicity */
type LancementState = {
  passation_tenue: boolean
  plans_valides_co: boolean
}

const STATUT_COLOR: Record<string, string> = {
  brouillon: 'bg-amber-100 text-amber-700',
  valide:    'bg-green-100 text-green-700',
  transmis:  'bg-blue-100 text-blue-700',
}

const LOTS = ['Cloisonnement', 'Plomberie', 'Électricité', 'CVC', 'Menuiserie', 'Revêtements', 'Plafonds', 'Façades', 'Autre']

type FormState = { projet_nom: string; lot: string; contenu: string }
const EMPTY: FormState = { projet_nom: '', lot: '', contenu: '' }

export default function LancementPage() {
  const supabase = createClient()
  const [notices, setNotices]   = useState<Notice[]>([])
  const [sel, setSel]           = useState<Notice | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState<FormState>(EMPTY)
  const [loading, setLoading]   = useState(true)

  /* Local lancement checklist per project */
  const [states, setStates] = useState<Record<string, LancementState>>({})

  async function fetchNotices() {
    setLoading(true)
    const { data } = await supabase.schema('app').from('dessin_notices')
      .select('*').order('created_at', { ascending: false })
    setNotices((data as Notice[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchNotices()
    const saved = localStorage.getItem('dessin_lancement_states')
    if (saved) setStates(JSON.parse(saved))
  }, [])

  function toggleState(projet: string, key: keyof LancementState) {
    const updated = {
      ...states,
      [projet]: { passation_tenue: false, plans_valides_co: false, ...(states[projet] ?? {}), [key]: !(states[projet]?.[key]) },
    }
    setStates(updated)
    localStorage.setItem('dessin_lancement_states', JSON.stringify(updated))
  }

  async function saveNotice() {
    await supabase.schema('app').from('dessin_notices').insert([form])
    setShowForm(false); setForm(EMPTY); fetchNotices()
  }

  async function updateStatut(id: string, statut: Notice['statut']) {
    await supabase.schema('app').from('dessin_notices').update({ statut }).eq('id', id)
    fetchNotices()
    if (sel?.id === id) setSel({ ...sel, statut })
  }

  async function deleteNotice(id: string) {
    await supabase.schema('app').from('dessin_notices').delete().eq('id', id)
    if (sel?.id === id) setSel(null)
    fetchNotices()
  }

  /* Group by project */
  const projects = [...new Set(notices.map(n => n.projet_nom))]

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar title="Lancement" subtitle="Passation, notices techniques et validation CO" />

      {/* Steps banner */}
      <div className="mx-6 mt-4 bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { icon: <Users className="w-4 h-4" />, label: 'Réunion de passation', desc: 'Contrat signé + Plan de départ' },
            { icon: <FileText className="w-4 h-4" />, label: 'Notices techniques', desc: 'Traduction promesses de vente → notices par lot' },
            { icon: <ShieldCheck className="w-4 h-4" />, label: 'Validation CO', desc: 'Plans soumis au CO pour validation faisabilité terrain' },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                <span className="text-gray-400">{s.icon}</span>
                <div>
                  <p className="text-xs font-semibold text-gray-700">{s.label}</p>
                  <p className="text-xs text-gray-400">{s.desc}</p>
                </div>
              </div>
              {i < 2 && <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />}
            </div>
          ))}
        </div>
      </div>

      <div className="px-6 pt-4 pb-8 flex gap-4">
        {/* Left: project checklists + notice list */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Notices techniques</h3>
            <button onClick={() => { setShowForm(true); setForm(EMPTY) }}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-700">
              <Plus className="w-3 h-3" /> Nouvelle
            </button>
          </div>

          {/* Project lancement checklists */}
          {projects.length > 0 && (
            <div className="space-y-2">
              {projects.map(projet => {
                const st = states[projet] ?? { passation_tenue: false, plans_valides_co: false }
                const noticesProjet = notices.filter(n => n.projet_nom === projet)
                const noticesOk = noticesProjet.some(n => n.statut === 'valide' || n.statut === 'transmis')
                const done = [st.passation_tenue, noticesOk, st.plans_valides_co].filter(Boolean).length
                return (
                  <div key={projet} className="bg-white border border-gray-200 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-gray-800 truncate">{projet}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${done === 3 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {done}/3
                      </span>
                    </div>
                    <div className="space-y-1">
                      {[
                        { key: 'passation_tenue' as const, label: 'Réunion de passation', val: st.passation_tenue },
                        { key: null,                        label: 'Notices créées et validées', val: noticesOk },
                        { key: 'plans_valides_co' as const, label: 'Plans validés CO', val: st.plans_valides_co },
                      ].map(item => (
                        <div key={item.label} className="flex items-center gap-2">
                          {item.key ? (
                            <button onClick={() => toggleState(projet, item.key!)}
                              className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                item.val ? 'bg-violet-600 border-violet-600' : 'border-gray-300 hover:border-violet-400'
                              }`}>
                              {item.val && <CheckCircle className="w-2.5 h-2.5 text-white" />}
                            </button>
                          ) : (
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                              item.val ? 'bg-violet-600 border-violet-600' : 'border-gray-200'
                            }`}>
                              {item.val && <CheckCircle className="w-2.5 h-2.5 text-white" />}
                            </div>
                          )}
                          <span className="text-xs text-gray-600">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Notice list */}
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-4">Chargement…</p>
          ) : notices.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Aucune notice</p>
          ) : (
            <div className="space-y-2">
              {notices.map(n => (
                <button key={n.id} onClick={() => setSel(n)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    sel?.id === n.id ? 'border-gray-900 bg-gray-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{n.projet_nom}</p>
                      <p className="text-xs text-gray-500">Lot : {n.lot}</p>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUT_COLOR[n.statut]}`}>
                      {n.statut}
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
                <h3 className="text-sm font-semibold text-gray-900">Nouvelle notice technique</h3>
                <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-gray-400" /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Projet</label>
                  <input value={form.projet_nom} onChange={e => setForm({ ...form, projet_nom: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Lot</label>
                  <select value={form.lot} onChange={e => setForm({ ...form, lot: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                    <option value="">Sélectionner…</option>
                    {LOTS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Contenu de la notice</label>
                  <textarea value={form.contenu} onChange={e => setForm({ ...form, contenu: e.target.value })}
                    rows={6} placeholder="Détailler les exigences techniques traduites depuis la notice commerciale…"
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none" />
                </div>
              </div>
              <div className="mt-4 flex gap-2 justify-end">
                <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Annuler</button>
                <button onClick={saveNotice} disabled={!form.projet_nom || !form.lot}
                  className="px-4 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40">
                  Enregistrer
                </button>
              </div>
            </div>
          ) : sel ? (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{sel.projet_nom}</h3>
                  <p className="text-sm text-gray-500">Lot : {sel.lot}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUT_COLOR[sel.statut]}`}>{sel.statut}</span>
                  <button onClick={() => deleteNotice(sel.id)} className="p-1 text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                </div>
              </div>

              <div className="p-3 bg-violet-50 border border-violet-100 rounded-lg">
                <p className="text-xs font-medium text-violet-700 mb-1">Collaboration — CO + Économiste</p>
                <p className="text-xs text-violet-600">Traduire les promesses de vente en exigences techniques précises pour ce lot.</p>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-2">Contenu de la notice</p>
                <div className="p-3 bg-gray-50 rounded-lg min-h-[100px]">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{sel.contenu || <span className="text-gray-400 italic">Aucun contenu</span>}</p>
                </div>
              </div>

              <div className="flex gap-2">
                {sel.statut === 'brouillon' && (
                  <button onClick={() => updateStatut(sel.id, 'valide')}
                    className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                    <CheckCircle className="w-4 h-4 inline mr-1" />Valider
                  </button>
                )}
                {sel.statut === 'valide' && (
                  <button onClick={() => updateStatut(sel.id, 'transmis')}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Marquer transmis
                  </button>
                )}
                {sel.statut !== 'brouillon' && (
                  <button onClick={() => updateStatut(sel.id, 'brouillon')}
                    className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                    Repasser en brouillon
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 h-64 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <Rocket className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Sélectionnez une notice ou créez-en une</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
