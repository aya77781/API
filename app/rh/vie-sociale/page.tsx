'use client'

import { useState, useEffect } from 'react'
import { Users, Plus, Calendar, BookOpen, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'

type Entretien = {
  id: string; employe_nom: string; type: string
  date_prevu: string | null; date_realise: string | null
  statut: string; compte_rendu: string | null; created_at: string
}

type Formation = {
  id: string; employe_nom: string; intitule: string
  organisme: string | null; duree_jours: number | null; cout: number | null
  financement: string | null; statut: string; date_prevue: string | null; notes: string | null
}

const TYPE_ENTRETIEN = [
  { value: 'annuel',        label: 'Entretien annuel' },
  { value: 'mi_annuel',     label: 'Mi-annuel' },
  { value: 'periode_essai', label: 'Période d\'essai' },
  { value: 'autre',         label: 'Autre' },
]

const STATUT_FORMATION: Record<string, string> = {
  identifie:       'bg-gray-100 text-gray-600 border-gray-200',
  dossier_en_cours:'bg-blue-50 text-blue-600 border-blue-200',
  valide:          'bg-emerald-50 text-emerald-600 border-emerald-200',
  en_cours:        'bg-purple-50 text-purple-600 border-purple-200',
  termine:         'bg-gray-100 text-gray-500 border-gray-200',
  refuse:          'bg-red-50 text-red-500 border-red-200',
}
const LABEL_FORMATION: Record<string, string> = {
  identifie: 'Identifié', dossier_en_cours: 'Dossier en cours',
  valide: 'Validé', en_cours: 'En cours', termine: 'Terminé', refuse: 'Refusé',
}

const FINANCEMENT_OPTIONS = ['OPCO', 'CPF', 'Auto-financement', 'Plan de formation', 'Autre']

export default function VieSocialePage() {
  const [entretiens, setEntretiens]   = useState<Entretien[]>([])
  const [formations, setFormations]   = useState<Formation[]>([])
  const [loading, setLoading]         = useState(true)
  const [tab, setTab]                 = useState<'entretiens' | 'formations'>('entretiens')
  const [showForm, setShowForm]       = useState(false)
  const [submitting, setSubmitting]   = useState(false)
  const [formE, setFormE] = useState({ employe_nom: '', type: 'annuel', date_prevu: '', compte_rendu: '' })
  const [formF, setFormF] = useState({ employe_nom: '', intitule: '', organisme: '', duree_jours: '', cout: '', financement: '', date_prevue: '', notes: '' })

  async function fetchData() {
    const supabase = createClient()
    const [eRes, fRes] = await Promise.all([
      supabase.schema('app').from('rh_entretiens').select('*').order('date_prevu', { ascending: false }),
      supabase.schema('app').from('rh_formations').select('*').order('created_at', { ascending: false }),
    ])
    setEntretiens((eRes.data ?? []) as Entretien[])
    setFormations((fRes.data ?? []) as Formation[])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  async function submitEntretien(e: React.FormEvent) {
    e.preventDefault()
    if (!formE.employe_nom) return
    setSubmitting(true)
    const supabase = createClient()
    await supabase.schema('app').from('rh_entretiens').insert({
      employe_nom: formE.employe_nom, type: formE.type,
      date_prevu: formE.date_prevu || null,
      compte_rendu: formE.compte_rendu || null, statut: 'planifie',
    })
    setFormE({ employe_nom: '', type: 'annuel', date_prevu: '', compte_rendu: '' })
    setShowForm(false)
    setSubmitting(false)
    fetchData()
  }

  async function submitFormation(e: React.FormEvent) {
    e.preventDefault()
    if (!formF.employe_nom || !formF.intitule) return
    setSubmitting(true)
    const supabase = createClient()
    await supabase.schema('app').from('rh_formations').insert({
      employe_nom: formF.employe_nom, intitule: formF.intitule,
      organisme: formF.organisme || null,
      duree_jours: formF.duree_jours ? Number(formF.duree_jours) : null,
      cout: formF.cout ? Number(formF.cout) : null,
      financement: formF.financement || null,
      date_prevue: formF.date_prevue || null,
      notes: formF.notes || null, statut: 'identifie',
    })
    setFormF({ employe_nom: '', intitule: '', organisme: '', duree_jours: '', cout: '', financement: '', date_prevue: '', notes: '' })
    setShowForm(false)
    setSubmitting(false)
    fetchData()
  }

  async function updateEntretienStatut(id: string, statut: string) {
    const supabase = createClient()
    await supabase.schema('app').from('rh_entretiens').update({ statut, ...(statut === 'realise' ? { date_realise: new Date().toISOString() } : {}) }).eq('id', id)
    fetchData()
  }

  async function updateFormationStatut(id: string, statut: string) {
    const supabase = createClient()
    await supabase.schema('app').from('rh_formations').update({ statut }).eq('id', id)
    fetchData()
  }

  return (
    <div>
      <TopBar title="Vie Sociale" subtitle="Contractualisation, entretiens & formations" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Entretiens planifiés</p>
            <p className="text-2xl font-semibold text-purple-600">{entretiens.filter((e) => e.statut === 'planifie').length}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Entretiens réalisés</p>
            <p className="text-2xl font-semibold text-emerald-600">{entretiens.filter((e) => e.statut === 'realise').length}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Formations en cours</p>
            <p className="text-2xl font-semibold text-blue-600">{formations.filter((f) => ['dossier_en_cours', 'valide', 'en_cours'].includes(f.statut)).length}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Budget formations</p>
            <p className="text-2xl font-semibold text-gray-900">
              {formations.filter((f) => f.cout && f.statut !== 'refuse').reduce((s, f) => s + (f.cout ?? 0), 0).toLocaleString('fr-FR')} €
            </p>
          </div>
        </div>

        {/* Tabs + bouton */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {[{ value: 'entretiens', label: '📅 Entretiens' }, { value: 'formations', label: '📚 Formations' }].map((t) => (
              <button key={t.value} onClick={() => { setTab(t.value as typeof tab); setShowForm(false) }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.value ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors">
            <Plus className="w-4 h-4" /> {tab === 'entretiens' ? 'Planifier entretien' : 'Ajouter formation'}
          </button>
        </div>

        {/* ENTRETIENS */}
        {tab === 'entretiens' && (
          <>
            {showForm && (
              <form onSubmit={submitEntretien} className="bg-white rounded-lg border border-gray-200 shadow-card p-5 space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Calendar className="w-4 h-4 text-purple-500" /> Planifier un entretien</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Collaborateur *</label>
                    <input type="text" value={formE.employe_nom} onChange={(e) => setFormE((f) => ({ ...f, employe_nom: e.target.value }))} placeholder="Nom Prénom"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                    <select value={formE.type} onChange={(e) => setFormE((f) => ({ ...f, type: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                      {TYPE_ENTRETIEN.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Date prévue</label>
                    <input type="date" value={formE.date_prevu} onChange={(e) => setFormE((f) => ({ ...f, date_prevu: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                </div>
                <div className="flex gap-3 justify-end">
                  <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
                  <button type="submit" disabled={submitting || !formE.employe_nom}
                    className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50">
                    {submitting ? 'Enregistrement...' : 'Planifier'}
                  </button>
                </div>
              </form>
            )}

            {loading ? (
              <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-16 bg-white rounded-lg border border-gray-200 animate-pulse" />)}</div>
            ) : entretiens.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 shadow-card p-10 text-center">
                <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700">Aucun entretien planifié</p>
              </div>
            ) : (
              <div className="space-y-2">
                {entretiens.map((e) => (
                  <div key={e.id} className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{e.employe_nom}</p>
                        <p className="text-xs text-gray-400">
                          {TYPE_ENTRETIEN.find((t) => t.value === e.type)?.label}
                          {e.date_prevu ? ` · ${new Date(e.date_prevu).toLocaleDateString('fr-FR')}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${e.statut === 'planifie' ? 'bg-blue-50 text-blue-600' : e.statut === 'realise' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                          {e.statut === 'planifie' ? 'Planifié' : e.statut === 'realise' ? 'Réalisé' : 'Annulé'}
                        </span>
                        {e.statut === 'planifie' && (
                          <button onClick={() => updateEntretienStatut(e.id, 'realise')}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors">
                            <CheckCircle2 className="w-3 h-3" /> Réalisé
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* FORMATIONS */}
        {tab === 'formations' && (
          <>
            {showForm && (
              <form onSubmit={submitFormation} className="bg-white rounded-lg border border-gray-200 shadow-card p-5 space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><BookOpen className="w-4 h-4 text-blue-500" /> Nouvelle formation</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Collaborateur *</label>
                    <input type="text" value={formF.employe_nom} onChange={(e) => setFormF((f) => ({ ...f, employe_nom: e.target.value }))} placeholder="Nom Prénom"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Intitulé *</label>
                    <input type="text" value={formF.intitule} onChange={(e) => setFormF((f) => ({ ...f, intitule: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Organisme</label>
                    <input type="text" value={formF.organisme} onChange={(e) => setFormF((f) => ({ ...f, organisme: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Financement</label>
                    <select value={formF.financement} onChange={(e) => setFormF((f) => ({ ...f, financement: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                      <option value="">Sélectionner...</option>
                      {FINANCEMENT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Coût (€)</label>
                    <input type="number" value={formF.cout} onChange={(e) => setFormF((f) => ({ ...f, cout: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Date prévue</label>
                    <input type="date" value={formF.date_prevue} onChange={(e) => setFormF((f) => ({ ...f, date_prevue: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                </div>
                <div className="flex gap-3 justify-end">
                  <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
                  <button type="submit" disabled={submitting || !formF.employe_nom || !formF.intitule}
                    className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50">
                    {submitting ? 'Enregistrement...' : 'Ajouter'}
                  </button>
                </div>
              </form>
            )}

            {loading ? (
              <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-16 bg-white rounded-lg border border-gray-200 animate-pulse" />)}</div>
            ) : formations.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 shadow-card p-10 text-center">
                <BookOpen className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700">Aucune formation enregistrée</p>
              </div>
            ) : (
              <div className="space-y-2">
                {formations.map((f) => (
                  <div key={f.id} className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-gray-900">{f.intitule}</p>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${STATUT_FORMATION[f.statut] ?? ''}`}>
                            {LABEL_FORMATION[f.statut] ?? f.statut}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">
                          {f.employe_nom}
                          {f.organisme ? ` · ${f.organisme}` : ''}
                          {f.cout ? ` · ${f.cout.toLocaleString('fr-FR')} €` : ''}
                          {f.financement ? ` · ${f.financement}` : ''}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {f.statut === 'identifie' && (
                          <button onClick={() => updateFormationStatut(f.id, 'dossier_en_cours')}
                            className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100">
                            Monter dossier
                          </button>
                        )}
                        {f.statut === 'dossier_en_cours' && (
                          <button onClick={() => updateFormationStatut(f.id, 'valide')}
                            className="px-3 py-1.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100">
                            Validé ✓
                          </button>
                        )}
                        {f.statut === 'valide' && (
                          <button onClick={() => updateFormationStatut(f.id, 'en_cours')}
                            className="px-3 py-1.5 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100">
                            Démarrer
                          </button>
                        )}
                        {f.statut === 'en_cours' && (
                          <button onClick={() => updateFormationStatut(f.id, 'termine')}
                            className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-200">
                            Terminée ✓
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
