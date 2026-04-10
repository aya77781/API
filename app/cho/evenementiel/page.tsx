'use client'

import { useState, useEffect } from 'react'
import { Calendar, Plus, CheckCircle2, Users, MapPin, Euro } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'

type Evenement = {
  id: string
  titre: string
  type: string
  date_prevue: string | null
  lieu: string | null
  budget: number | null
  budget_valide: boolean
  statut: string
  participants: string[] | null
  description: string | null
  created_at: string
}

const TYPE_OPTIONS = [
  { value: 'repas', label: 'Repas d\'équipe' },
  { value: 'seminaire', label: 'Séminaire' },
  { value: 'team_building', label: 'Team Building' },
  { value: 'celebration', label: 'Célébration' },
  { value: 'autre', label: 'Autre' },
]

const STATUT_COLOR: Record<string, string> = {
  planifie: 'bg-blue-50 text-blue-600 border-blue-200',
  confirme: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  en_cours: 'bg-purple-50 text-purple-600 border-purple-200',
  termine: 'bg-gray-100 text-gray-500 border-gray-200',
  annule: 'bg-red-50 text-red-400 border-red-200',
}

const STATUT_LABEL: Record<string, string> = {
  planifie: 'Planifié',
  confirme: 'Confirmé',
  en_cours: 'En cours',
  termine: 'Terminé',
  annule: 'Annulé',
}

const POLES = ['Toute l\'équipe', 'Économie', 'Dessin', 'Opérations', 'Commercial', 'Direction']

export default function EvenementielPage() {
  const [evenements, setEvenements] = useState<Evenement[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<string>('actifs')
  const [form, setForm] = useState({
    titre: '', type: 'repas', date_prevue: '', lieu: '',
    budget: '', participants: [] as string[], description: '',
  })
  const [submitting, setSubmitting] = useState(false)

  async function fetchData() {
    const supabase = createClient()
    const { data } = await supabase
      .schema('app')
      .from('cho_evenements')
      .select('*')
      .order('date_prevue', { ascending: true })
    setEvenements((data ?? []) as Evenement[])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.titre.trim()) return
    setSubmitting(true)
    const supabase = createClient()
    await supabase.schema('app').from('cho_evenements').insert({
      titre: form.titre,
      type: form.type,
      date_prevue: form.date_prevue || null,
      lieu: form.lieu || null,
      budget: form.budget ? Number(form.budget) : null,
      participants: form.participants.length > 0 ? form.participants : null,
      description: form.description || null,
      statut: 'planifie',
    })
    setForm({ titre: '', type: 'repas', date_prevue: '', lieu: '', budget: '', participants: [], description: '' })
    setShowForm(false)
    setSubmitting(false)
    fetchData()
  }

  async function updateStatut(id: string, statut: string) {
    const supabase = createClient()
    await supabase.schema('app').from('cho_evenements').update({ statut }).eq('id', id)
    fetchData()
  }

  const filtered = filter === 'actifs'
    ? evenements.filter((e) => !['termine', 'annule'].includes(e.statut))
    : filter === 'historique'
    ? evenements.filter((e) => ['termine', 'annule'].includes(e.statut))
    : evenements

  const aVenir = evenements.filter((e) => {
    if (!e.date_prevue || ['termine', 'annule'].includes(e.statut)) return false
    return new Date(e.date_prevue) >= new Date()
  }).length

  function toggleParticipant(pole: string) {
    setForm((f) => ({
      ...f,
      participants: f.participants.includes(pole)
        ? f.participants.filter((p) => p !== pole)
        : [...f.participants, pole],
    }))
  }

  return (
    <div>
      <TopBar title="Événementiel" subtitle="Repas, séminaires & team building" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">À venir</p>
            <p className="text-2xl font-semibold text-blue-600">{aVenir}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total planifiés</p>
            <p className="text-2xl font-semibold text-gray-900">
              {evenements.filter((e) => e.statut !== 'annule').length}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Budget total</p>
            <p className="text-2xl font-semibold text-gray-900">
              {evenements
                .filter((e) => e.budget && e.statut !== 'annule')
                .reduce((sum, e) => sum + (e.budget ?? 0), 0)
                .toLocaleString('fr-FR')}{' '}
              <span className="text-base text-gray-400">€</span>
            </p>
          </div>
        </div>

        {/* Filtres + bouton */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {[
              { value: 'actifs', label: 'Actifs' },
              { value: 'historique', label: 'Historique' },
              { value: 'tous', label: 'Tous' },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filter === f.value
                    ? 'bg-gray-900 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Planifier un événement
          </button>
        </div>

        {/* Formulaire */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-lg border border-gray-200 shadow-card p-5 space-y-4"
          >
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-500" />
              Nouvel événement
            </h3>

            {/* Type */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Type d&apos;événement</label>
              <div className="flex flex-wrap gap-2">
                {TYPE_OPTIONS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, type: t.value }))}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      form.type === t.value
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Titre</label>
                <input
                  type="text"
                  value={form.titre}
                  onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))}
                  placeholder="Ex: Repas fin de chantier Résidence X"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date prévue</label>
                <input
                  type="date"
                  value={form.date_prevue}
                  onChange={(e) => setForm((f) => ({ ...f, date_prevue: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Lieu</label>
                <input
                  type="text"
                  value={form.lieu}
                  onChange={(e) => setForm((f) => ({ ...f, lieu: e.target.value }))}
                  placeholder="Restaurant, salle de réunion..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Budget (€)</label>
                <input
                  type="number"
                  value={form.budget}
                  onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
                  placeholder="0"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Participants</label>
              <div className="flex flex-wrap gap-2">
                {POLES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => toggleParticipant(p)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      form.participants.includes(p)
                        ? 'bg-blue-900 text-white border-blue-900'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes / Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                placeholder="Informations complémentaires..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting || !form.titre.trim()}
                className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Enregistrement...' : 'Créer l\'événement'}
              </button>
            </div>
          </form>
        )}

        {/* Liste */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 h-24 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-10 text-center">
            <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">Aucun événement</p>
            <p className="text-xs text-gray-400 mt-1">Planifiez le prochain événement de l&apos;équipe.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((e) => {
              const typeInfo = TYPE_OPTIONS.find((t) => t.value === e.type)
              const isPast = e.date_prevue ? new Date(e.date_prevue) < new Date() : false
              return (
                <div
                  key={e.id}
                  className="bg-white rounded-lg border border-gray-200 shadow-card p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-5 h-5 text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-semibold text-gray-900">{e.titre}</span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${STATUT_COLOR[e.statut] ?? ''}`}
                          >
                            {STATUT_LABEL[e.statut]}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                          {e.date_prevue && (
                            <span className={`flex items-center gap-1 ${isPast && e.statut !== 'termine' ? 'text-red-500' : ''}`}>
                              <Calendar className="w-3 h-3" />
                              {new Date(e.date_prevue).toLocaleDateString('fr-FR', {
                                day: 'numeric', month: 'long', year: 'numeric'
                              })}
                            </span>
                          )}
                          {e.lieu && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {e.lieu}
                            </span>
                          )}
                          {e.budget && (
                            <span className="flex items-center gap-1">
                              <Euro className="w-3 h-3" />
                              {e.budget.toLocaleString('fr-FR')} €
                            </span>
                          )}
                          {e.participants && e.participants.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {e.participants.join(', ')}
                            </span>
                          )}
                        </div>
                        {e.description && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-1">{e.description}</p>
                        )}
                      </div>
                    </div>
                    {!['termine', 'annule'].includes(e.statut) && (
                      <div className="flex gap-2 flex-shrink-0">
                        {e.statut === 'planifie' && (
                          <button
                            onClick={() => updateStatut(e.id, 'confirme')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Confirmer
                          </button>
                        )}
                        <button
                          onClick={() => updateStatut(e.id, 'termine')}
                          className="px-3 py-1.5 text-xs bg-gray-50 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          Terminé
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
