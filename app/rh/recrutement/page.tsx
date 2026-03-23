'use client'

import { useState, useEffect } from 'react'
import { UserPlus, Plus, Star, Phone, Mail, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'

type Candidat = {
  id: string; nom: string; prenom: string; poste: string; email: string | null
  telephone: string | null; source: string | null; statut: string
  soft_skills_score: number | null; notes: string | null; date_entretien: string | null
  created_at: string
}

const STATUTS = [
  { value: 'nouveau',        label: 'Nouveau',        color: 'bg-gray-100 text-gray-600 border-gray-200' },
  { value: 'preselectionne', label: 'Présélectionné', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  { value: 'entretien',      label: 'Entretien',      color: 'bg-purple-50 text-purple-600 border-purple-200' },
  { value: 'shortlist',      label: 'Shortlist',      color: 'bg-amber-50 text-amber-600 border-amber-200' },
  { value: 'retenu',         label: 'Retenu ✓',       color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  { value: 'refuse',         label: 'Refusé',         color: 'bg-red-50 text-red-500 border-red-200' },
]

const SOURCES = ['LinkedIn', 'Indeed', 'Recommandation', 'Site API', 'Candidature spontanée', 'Autre']
const POSTES  = ['Chargé d\'Opérations', 'Économiste', 'Dessinateur', 'Commercial', 'RH', 'CHO', 'Autre']

const PIPELINE = ['nouveau', 'preselectionne', 'entretien', 'shortlist', 'retenu']

export default function RecrutementPage() {
  const [candidats, setCandidats] = useState<Candidat[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [selected, setSelected]   = useState<Candidat | null>(null)
  const [filter, setFilter]       = useState<string>('actifs')
  const [form, setForm] = useState({
    nom: '', prenom: '', poste: '', email: '', telephone: '',
    source: '', statut: 'nouveau', soft_skills_score: '', notes: '',
  })
  const [submitting, setSubmitting] = useState(false)

  async function fetchData() {
    const supabase = createClient()
    const { data } = await supabase.schema('app').from('rh_candidats').select('*').order('created_at', { ascending: false })
    setCandidats((data ?? []) as Candidat[])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nom || !form.prenom || !form.poste) return
    setSubmitting(true)
    const supabase = createClient()
    await supabase.schema('app').from('rh_candidats').insert({
      nom: form.nom, prenom: form.prenom, poste: form.poste,
      email: form.email || null, telephone: form.telephone || null,
      source: form.source || null, statut: form.statut,
      soft_skills_score: form.soft_skills_score ? Number(form.soft_skills_score) : null,
      notes: form.notes || null,
    })
    setForm({ nom: '', prenom: '', poste: '', email: '', telephone: '', source: '', statut: 'nouveau', soft_skills_score: '', notes: '' })
    setShowForm(false)
    setSubmitting(false)
    fetchData()
  }

  async function updateStatut(id: string, statut: string) {
    const supabase = createClient()
    await supabase.schema('app').from('rh_candidats').update({ statut }).eq('id', id)
    if (selected?.id === id) setSelected((s) => s ? { ...s, statut } : null)
    fetchData()
  }

  const filtered = filter === 'actifs'
    ? candidats.filter((c) => !['retenu', 'refuse', 'abandonne'].includes(c.statut))
    : filter === 'archives'
    ? candidats.filter((c) => ['retenu', 'refuse', 'abandonne'].includes(c.statut))
    : candidats

  // Pipeline counts
  const pipelineCounts = PIPELINE.reduce<Record<string, number>>((acc, s) => {
    acc[s] = candidats.filter((c) => c.statut === s).length
    return acc
  }, {})

  return (
    <div>
      <TopBar title="Recrutement" subtitle="Sourcing, présélection & suivi des candidats" />

      <div className="p-6 space-y-6">
        {/* Pipeline visuel */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-card p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Pipeline de recrutement</p>
          <div className="flex items-center gap-0">
            {PIPELINE.map((s, i) => {
              const info = STATUTS.find((st) => st.value === s)!
              const count = pipelineCounts[s] ?? 0
              return (
                <div key={s} className="flex items-center flex-1 min-w-0">
                  <button
                    onClick={() => setFilter(s)}
                    className={`flex-1 text-center py-3 px-2 rounded-lg transition-colors ${filter === s ? 'bg-gray-900 text-white' : 'hover:bg-gray-50'}`}
                  >
                    <p className="text-lg font-bold">{count}</p>
                    <p className="text-xs text-gray-400 truncate">{info.label}</p>
                  </button>
                  {i < PIPELINE.length - 1 && <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />}
                </div>
              )
            })}
          </div>
        </div>

        {/* Filtres + bouton */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            {[
              { value: 'actifs', label: 'Actifs' },
              { value: 'archives', label: 'Archivés' },
              { value: 'tous', label: 'Tous' },
            ].map((f) => (
              <button key={f.value} onClick={() => setFilter(f.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filter === f.value ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                {f.label}
              </button>
            ))}
          </div>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors">
            <Plus className="w-4 h-4" /> Nouveau candidat
          </button>
        </div>

        {/* Formulaire */}
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 shadow-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-indigo-500" /> Nouveau candidat
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Prénom *</label>
                <input type="text" value={form.prenom} onChange={(e) => setForm((f) => ({ ...f, prenom: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nom *</label>
                <input type="text" value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Poste visé *</label>
                <select value={form.poste} onChange={(e) => setForm((f) => ({ ...f, poste: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                  <option value="">Sélectionner...</option>
                  {POSTES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Téléphone</label>
                <input type="tel" value={form.telephone} onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Source</label>
                <select value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                  <option value="">Non précisée</option>
                  {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Statut initial</label>
                <select value={form.statut} onChange={(e) => setForm((f) => ({ ...f, statut: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                  {STATUTS.filter((s) => !['retenu', 'refuse'].includes(s.value)).map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Score soft skills (1–5)</label>
                <input type="number" min={1} max={5} value={form.soft_skills_score}
                  onChange={(e) => setForm((f) => ({ ...f, soft_skills_score: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2}
                placeholder="Impressions, points forts, points faibles..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none" />
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">Annuler</button>
              <button type="submit" disabled={submitting || !form.nom || !form.prenom || !form.poste}
                className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors">
                {submitting ? 'Enregistrement...' : 'Ajouter'}
              </button>
            </div>
          </form>
        )}

        {/* Liste + détail */}
        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="bg-white rounded-lg border border-gray-200 h-16 animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-10 text-center">
            <UserPlus className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">Aucun candidat</p>
            <p className="text-xs text-gray-400 mt-1">Ajoutez votre premier candidat pour commencer.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Liste */}
            <div className="lg:col-span-3 space-y-2">
              {filtered.map((c) => {
                const s = STATUTS.find((st) => st.value === c.statut) ?? STATUTS[0]
                return (
                  <button key={c.id} onClick={() => setSelected(selected?.id === c.id ? null : c)}
                    className={`w-full text-left bg-white rounded-lg border shadow-card p-4 transition-colors ${selected?.id === c.id ? 'border-gray-900' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-semibold text-indigo-600 flex-shrink-0">
                        {c.prenom[0]}{c.nom[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{c.prenom} {c.nom}</p>
                        <p className="text-xs text-gray-400">{c.poste}{c.source ? ` · ${c.source}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {c.soft_skills_score && (
                          <div className="flex items-center gap-0.5">
                            {[1,2,3,4,5].map((n) => (
                              <Star key={n} className={`w-3 h-3 ${n <= c.soft_skills_score! ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
                            ))}
                          </div>
                        )}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${s.color}`}>{s.label}</span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Détail */}
            {selected && (
              <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 shadow-card p-5 space-y-4 h-fit">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-base font-semibold text-gray-900">{selected.prenom} {selected.nom}</p>
                    <p className="text-sm text-gray-500">{selected.poste}</p>
                  </div>
                  <button onClick={() => setSelected(null)} className="text-gray-300 hover:text-gray-600 text-lg leading-none">×</button>
                </div>

                {(selected.email || selected.telephone) && (
                  <div className="space-y-1">
                    {selected.email && <p className="text-xs text-gray-500 flex items-center gap-1.5"><Mail className="w-3 h-3" />{selected.email}</p>}
                    {selected.telephone && <p className="text-xs text-gray-500 flex items-center gap-1.5"><Phone className="w-3 h-3" />{selected.telephone}</p>}
                  </div>
                )}

                {selected.notes && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 leading-relaxed">{selected.notes}</p>
                  </div>
                )}

                {/* Avancement statut */}
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-2">Avancer dans le pipeline</p>
                  <div className="flex flex-wrap gap-2">
                    {STATUTS.filter((s) => s.value !== selected.statut).map((s) => (
                      <button key={s.value} onClick={() => updateStatut(selected.id, s.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors hover:opacity-80 ${s.color}`}>
                        → {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
