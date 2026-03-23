'use client'

import { useState, useEffect } from 'react'
import { Heart, AlertTriangle, Plus, CheckCircle2, Clock, MessageSquare } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'

type Signalement = {
  id: string
  type: string
  description: string
  pole: string | null
  statut: string
  priorite: string
  created_at: string
}

const POLES = ['Économie', 'Dessin', 'Opérations', 'Commercial', 'Direction', 'Tous']
const TYPES = [
  { value: 'tension', label: 'Tension interpersonnelle' },
  { value: 'feedback', label: 'Feedback / Retour' },
  { value: 'autre', label: 'Autre' },
]
const PRIORITES = [
  { value: 'urgent', label: 'Urgent', color: 'text-red-600' },
  { value: 'high', label: 'Élevée', color: 'text-orange-600' },
  { value: 'normal', label: 'Normale', color: 'text-gray-600' },
  { value: 'low', label: 'Faible', color: 'text-blue-600' },
]

const STATUT_COLOR: Record<string, string> = {
  ouvert: 'bg-red-50 text-red-600 border-red-200',
  en_traitement: 'bg-amber-50 text-amber-600 border-amber-200',
  resolu: 'bg-emerald-50 text-emerald-600 border-emerald-200',
}

const STATUT_LABEL: Record<string, string> = {
  ouvert: 'Ouvert',
  en_traitement: 'En traitement',
  resolu: 'Résolu',
}

export default function ClimatSocialPage() {
  const [signalements, setSignalements] = useState<Signalement[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type: 'tension', description: '', pole: '', priorite: 'normal' })
  const [submitting, setSubmitting] = useState(false)
  const [filter, setFilter] = useState<'tous' | 'ouvert' | 'en_traitement' | 'resolu'>('tous')

  async function fetchData() {
    const supabase = createClient()
    const { data } = await supabase
      .schema('app')
      .from('cho_signalements')
      .select('*')
      .in('type', ['tension', 'feedback', 'autre'])
      .order('created_at', { ascending: false })
    setSignalements((data ?? []) as Signalement[])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.description.trim()) return
    setSubmitting(true)
    const supabase = createClient()
    await supabase.schema('app').from('cho_signalements').insert({
      type: form.type,
      description: form.description,
      pole: form.pole || null,
      priorite: form.priorite,
      statut: 'ouvert',
    })
    setForm({ type: 'tension', description: '', pole: '', priorite: 'normal' })
    setShowForm(false)
    setSubmitting(false)
    fetchData()
  }

  async function updateStatut(id: string, statut: string) {
    const supabase = createClient()
    await supabase.schema('app').from('cho_signalements').update({ statut }).eq('id', id)
    fetchData()
  }

  const filtered = filter === 'tous' ? signalements : signalements.filter((s) => s.statut === filter)
  const ouverts = signalements.filter((s) => s.statut === 'ouvert').length
  const enTraitement = signalements.filter((s) => s.statut === 'en_traitement').length

  return (
    <div>
      <TopBar title="Climat Social" subtitle="Ambiance & Médiation interne" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Signalements ouverts</p>
            <p className="text-2xl font-semibold text-red-600">{ouverts}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">En traitement</p>
            <p className="text-2xl font-semibold text-amber-600">{enTraitement}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Résolus (total)</p>
            <p className="text-2xl font-semibold text-emerald-600">
              {signalements.filter((s) => s.statut === 'resolu').length}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          {/* Filtres */}
          <div className="flex gap-2">
            {(['tous', 'ouvert', 'en_traitement', 'resolu'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filter === f
                    ? 'bg-gray-900 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {f === 'tous' ? 'Tous' : STATUT_LABEL[f]}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nouveau signalement
          </button>
        </div>

        {/* Formulaire */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-lg border border-gray-200 shadow-card p-5 space-y-4"
          >
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Heart className="w-4 h-4 text-pink-500" />
              Nouveau signalement Climat Social
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Pôle concerné</label>
                <select
                  value={form.pole}
                  onChange={(e) => setForm((f) => ({ ...f, pole: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="">Non spécifié</option>
                  {POLES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Priorité</label>
              <div className="flex gap-2">
                {PRIORITES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, priorite: p.value }))}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      form.priorite === p.value
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder="Décrivez la situation..."
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
                disabled={submitting || !form.description.trim()}
                className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Envoi...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        )}

        {/* Liste */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 h-20 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-10 text-center">
            <MessageSquare className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">Aucun signalement</p>
            <p className="text-xs text-gray-400 mt-1">
              {filter === 'tous' ? 'Le climat social est au beau fixe !' : 'Aucun signalement dans cette catégorie.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((s) => (
              <div key={s.id} className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${STATUT_COLOR[s.statut] ?? ''}`}
                      >
                        {STATUT_LABEL[s.statut]}
                      </span>
                      <span className="text-xs text-gray-400">
                        {s.type === 'tension' ? 'Tension' : s.type === 'feedback' ? 'Feedback' : 'Autre'}
                      </span>
                      {s.pole && <span className="text-xs text-gray-400">· {s.pole}</span>}
                      <span className={`text-xs font-medium ${
                        s.priorite === 'urgent' ? 'text-red-600' :
                        s.priorite === 'high' ? 'text-orange-600' : 'text-gray-400'
                      }`}>
                        {s.priorite === 'urgent' ? '🔴 Urgent' : s.priorite === 'high' ? '🟠 Élevée' : ''}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800">{s.description}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(s.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric', month: 'long', year: 'numeric'
                      })}
                    </p>
                  </div>
                  {/* Actions statut */}
                  {s.statut !== 'resolu' && (
                    <div className="flex gap-2 flex-shrink-0">
                      {s.statut === 'ouvert' && (
                        <button
                          onClick={() => updateStatut(s.id, 'en_traitement')}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                        >
                          <Clock className="w-3 h-3" />
                          Traiter
                        </button>
                      )}
                      <button
                        onClick={() => updateStatut(s.id, 'resolu')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Résolu
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
