'use client'

import { useState, useEffect } from 'react'
import { UserCheck, Plus, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'

type Onboarding = {
  id: string; employe_nom: string; employe_prenom: string; poste: string
  date_arrivee: string; statut: string; notes: string | null
  bureau_pret: boolean; pc_pret: boolean; acces_logiciels: boolean
  mutuelle_inscrit: boolean; cibtp_inscrit: boolean; rup_mis_a_jour: boolean; contrat_signe: boolean
  carte_btp_demandee: boolean; carte_btp_recue: boolean
  livret_remis: boolean; presentation_equipe: boolean
}

const CHECKLIST_SECTIONS = [
  {
    id: 'logistique',
    label: '🖥️ Installation logistique',
    fields: [
      { key: 'bureau_pret',       label: 'Bureau / poste de travail prêt' },
      { key: 'pc_pret',           label: 'PC/Mac configuré et fonctionnel' },
      { key: 'acces_logiciels',   label: 'Accès logiciels et outils configurés' },
    ],
  },
  {
    id: 'admin',
    label: '📋 Administratif',
    fields: [
      { key: 'mutuelle_inscrit',  label: 'Inscription mutuelle effectuée' },
      { key: 'cibtp_inscrit',     label: 'Inscription CIBTP effectuée' },
      { key: 'rup_mis_a_jour',    label: 'RUP (Registre Unique du Personnel) mis à jour' },
      { key: 'contrat_signe',     label: 'Contrat de travail signé' },
    ],
  },
  {
    id: 'btp',
    label: '🪪 Carte BTP',
    fields: [
      { key: 'carte_btp_demandee', label: 'Carte BTP demandée (photo + ID transmis)' },
      { key: 'carte_btp_recue',    label: 'Carte BTP reçue et remise au salarié' },
    ],
  },
  {
    id: 'accompagnement',
    label: '🤝 Accompagnement',
    fields: [
      { key: 'livret_remis',          label: 'Livret d\'accueil remis et expliqué' },
      { key: 'presentation_equipe',   label: 'Présentation à l\'équipe et visite des locaux' },
    ],
  },
]

const POSTES = ['Chargé d\'Opérations', 'Économiste', 'Dessinateur', 'Commercial', 'RH', 'CHO', 'Autre']

function progress(o: Onboarding): number {
  const total = 11
  const done = [
    o.bureau_pret, o.pc_pret, o.acces_logiciels,
    o.mutuelle_inscrit, o.cibtp_inscrit, o.rup_mis_a_jour, o.contrat_signe,
    o.carte_btp_demandee, o.carte_btp_recue,
    o.livret_remis, o.presentation_equipe,
  ].filter(Boolean).length
  return Math.round((done / total) * 100)
}

export default function OnboardingPage() {
  const [onboardings, setOnboardings] = useState<Onboarding[]>([])
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [selected, setSelected]       = useState<Onboarding | null>(null)
  const [filter, setFilter]           = useState<string>('en_cours')
  const [form, setForm] = useState({ employe_prenom: '', employe_nom: '', poste: '', date_arrivee: '', notes: '' })
  const [submitting, setSubmitting]   = useState(false)

  async function fetchData() {
    const supabase = createClient()
    const { data } = await supabase.schema('app').from('rh_onboarding').select('*').order('date_arrivee', { ascending: false })
    setOnboardings((data ?? []) as Onboarding[])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.employe_nom || !form.employe_prenom || !form.date_arrivee) return
    setSubmitting(true)
    const supabase = createClient()
    await supabase.schema('app').from('rh_onboarding').insert({
      employe_nom: form.employe_nom, employe_prenom: form.employe_prenom,
      poste: form.poste, date_arrivee: form.date_arrivee,
      notes: form.notes || null, statut: 'en_cours',
    })
    setForm({ employe_prenom: '', employe_nom: '', poste: '', date_arrivee: '', notes: '' })
    setShowForm(false)
    setSubmitting(false)
    fetchData()
  }

  async function toggleField(id: string, field: string, current: boolean) {
    const supabase = createClient()
    await supabase.schema('app').from('rh_onboarding').update({ [field]: !current }).eq('id', id)
    setSelected((s) => s ? { ...s, [field]: !current } : null)
    fetchData()
  }

  async function markTermine(id: string) {
    const supabase = createClient()
    await supabase.schema('app').from('rh_onboarding').update({ statut: 'termine' }).eq('id', id)
    setSelected(null)
    fetchData()
  }

  const filtered = filter === 'en_cours'
    ? onboardings.filter((o) => o.statut === 'en_cours')
    : filter === 'termine'
    ? onboardings.filter((o) => o.statut === 'termine')
    : onboardings

  const selectedFull = selected ? onboardings.find((o) => o.id === selected.id) ?? selected : null

  return (
    <div>
      <TopBar title="Onboarding" subtitle="Installation, administratif & accompagnement" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">En cours</p>
            <p className="text-2xl font-semibold text-emerald-600">{onboardings.filter((o) => o.statut === 'en_cours').length}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Terminés</p>
            <p className="text-2xl font-semibold text-gray-600">{onboardings.filter((o) => o.statut === 'termine').length}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Progression moy.</p>
            <p className="text-2xl font-semibold text-gray-900">
              {onboardings.filter((o) => o.statut === 'en_cours').length > 0
                ? Math.round(onboardings.filter((o) => o.statut === 'en_cours').reduce((s, o) => s + progress(o), 0) / onboardings.filter((o) => o.statut === 'en_cours').length)
                : 0}%
            </p>
          </div>
        </div>

        {/* Filtres + bouton */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {[{ value: 'en_cours', label: 'En cours' }, { value: 'termine', label: 'Terminés' }, { value: 'tous', label: 'Tous' }].map((f) => (
              <button key={f.value} onClick={() => setFilter(f.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filter === f.value ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                {f.label}
              </button>
            ))}
          </div>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors">
            <Plus className="w-4 h-4" /> Nouvel onboarding
          </button>
        </div>

        {/* Formulaire */}
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 shadow-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-500" /> Nouvel onboarding
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Prénom *</label>
                <input type="text" value={form.employe_prenom} onChange={(e) => setForm((f) => ({ ...f, employe_prenom: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nom *</label>
                <input type="text" value={form.employe_nom} onChange={(e) => setForm((f) => ({ ...f, employe_nom: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Poste</label>
                <select value={form.poste} onChange={(e) => setForm((f) => ({ ...f, poste: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                  <option value="">Sélectionner...</option>
                  {POSTES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date d&apos;arrivée *</label>
                <input type="date" value={form.date_arrivee} onChange={(e) => setForm((f) => ({ ...f, date_arrivee: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">Annuler</button>
              <button type="submit" disabled={submitting || !form.employe_nom || !form.employe_prenom || !form.date_arrivee}
                className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors">
                {submitting ? 'Enregistrement...' : 'Créer'}
              </button>
            </div>
          </form>
        )}

        {/* Liste + checklist */}
        {loading ? (
          <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="bg-white rounded-lg border border-gray-200 h-20 animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-10 text-center">
            <UserCheck className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">Aucun onboarding</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Liste */}
            <div className="lg:col-span-2 space-y-2">
              {filtered.map((o) => {
                const pct = progress(o)
                return (
                  <button key={o.id} onClick={() => setSelected(selectedFull?.id === o.id ? null : o)}
                    className={`w-full text-left bg-white rounded-lg border shadow-card p-4 transition-colors ${selectedFull?.id === o.id ? 'border-gray-900' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-semibold text-emerald-600 flex-shrink-0">
                        {o.employe_prenom[0]}{o.employe_nom[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{o.employe_prenom} {o.employe_nom}</p>
                        <p className="text-xs text-gray-400">
                          {o.poste} · {new Date(o.date_arrivee).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      <span className={`flex-shrink-0 text-xs font-semibold ${pct === 100 ? 'text-emerald-600' : 'text-gray-500'}`}>{pct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Checklist détail */}
            {selectedFull && (
              <div className="lg:col-span-3 bg-white rounded-lg border border-gray-200 shadow-card p-5 space-y-5 h-fit">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-semibold text-gray-900">{selectedFull.employe_prenom} {selectedFull.employe_nom}</p>
                    <p className="text-xs text-gray-400">{selectedFull.poste} · Arrivée {new Date(selectedFull.date_arrivee).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <button onClick={() => setSelected(null)} className="text-gray-300 hover:text-gray-600 text-lg">×</button>
                </div>

                {CHECKLIST_SECTIONS.map((section) => (
                  <div key={section.id}>
                    <p className="text-xs font-semibold text-gray-600 mb-2">{section.label}</p>
                    <div className="space-y-2">
                      {section.fields.map((field) => {
                        const val = selectedFull[field.key as keyof Onboarding] as boolean
                        return (
                          <label key={field.key} className="flex items-center gap-3 cursor-pointer group">
                            <input type="checkbox" checked={val}
                              onChange={() => toggleField(selectedFull.id, field.key, val)}
                              className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900" />
                            <span className={`text-sm ${val ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                              {field.label}
                            </span>
                            {val && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 ml-auto flex-shrink-0" />}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {selectedFull.statut === 'en_cours' && progress(selectedFull) === 100 && (
                  <button onClick={() => markTermine(selectedFull.id)}
                    className="w-full py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Marquer l&apos;onboarding comme terminé
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
