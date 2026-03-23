'use client'

import { useState, useEffect } from 'react'
import { Home, Plus, CheckCircle2, Clock, Wrench, Coffee } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'

type Signalement = {
  id: string
  type: string
  description: string
  zone: string | null
  statut: string
  priorite: string
  created_at: string
  traite_le: string | null
}

const TYPES_CADRE = [
  { value: 'panne', label: 'Panne / Dysfonctionnement', emoji: '🔧' },
  { value: 'materiel', label: 'Besoin matériel', emoji: '📦' },
  { value: 'autre', label: 'Autre (déco, confort...)', emoji: '✨' },
]

const ZONES = ['Open space', 'Salle de réunion', 'Cuisine', 'Sanitaires', 'Entrée', 'Bureau direction', 'Extérieur']

const PRIORITE_COLOR: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  normal: 'bg-gray-100 text-gray-600 border-gray-200',
  low: 'bg-blue-50 text-blue-600 border-blue-200',
}

const STATUT_COLOR: Record<string, string> = {
  ouvert: 'bg-red-50 text-red-600 border-red-200',
  en_traitement: 'bg-amber-50 text-amber-600 border-amber-200',
  resolu: 'bg-emerald-50 text-emerald-600 border-emerald-200',
}

const checklist = [
  { id: 'cafe', label: 'Café / boissons disponibles', emoji: '☕' },
  { id: 'fournitures', label: 'Fournitures bureau OK', emoji: '📎' },
  { id: 'clim', label: 'Climatisation fonctionnelle', emoji: '❄️' },
  { id: 'wifi', label: 'WiFi & réseau OK', emoji: '📶' },
  { id: 'cuisine', label: 'Cuisine propre & équipée', emoji: '🍽️' },
  { id: 'eclairage', label: 'Éclairage fonctionnel', emoji: '💡' },
]

export default function CadreViePage() {
  const [signalements, setSignalements] = useState<Signalement[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<string>('actifs')
  const [checklistState, setChecklistState] = useState<Record<string, boolean>>({})
  const [form, setForm] = useState({
    type: 'panne', description: '', zone: '', priorite: 'normal',
  })
  const [submitting, setSubmitting] = useState(false)

  async function fetchData() {
    const supabase = createClient()
    const { data } = await supabase
      .schema('app')
      .from('cho_signalements')
      .select('*')
      .in('type', ['panne', 'materiel', 'autre'])
      .order('created_at', { ascending: false })
    setSignalements((data ?? []) as Signalement[])
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
    // Restore checklist from localStorage
    const saved = localStorage.getItem('cho_cadre_checklist')
    if (saved) setChecklistState(JSON.parse(saved))
  }, [])

  function toggleChecklist(id: string) {
    setChecklistState((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      localStorage.setItem('cho_cadre_checklist', JSON.stringify(next))
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.description.trim()) return
    setSubmitting(true)
    const supabase = createClient()
    await supabase.schema('app').from('cho_signalements').insert({
      type: form.type,
      description: form.description,
      zone: form.zone || null,
      priorite: form.priorite,
      statut: 'ouvert',
    })
    setForm({ type: 'panne', description: '', zone: '', priorite: 'normal' })
    setShowForm(false)
    setSubmitting(false)
    fetchData()
  }

  async function updateStatut(id: string, statut: string) {
    const supabase = createClient()
    await supabase
      .schema('app')
      .from('cho_signalements')
      .update({ statut, traite_le: statut === 'resolu' ? new Date().toISOString() : null })
      .eq('id', id)
    fetchData()
  }

  const filtered = filter === 'actifs'
    ? signalements.filter((s) => s.statut !== 'resolu')
    : filter === 'resolu'
    ? signalements.filter((s) => s.statut === 'resolu')
    : signalements

  const ouverts = signalements.filter((s) => s.statut === 'ouvert').length
  const enTraitement = signalements.filter((s) => s.statut === 'en_traitement').length
  const checkOk = Object.values(checklistState).filter(Boolean).length

  return (
    <div>
      <TopBar title="Cadre de Vie" subtitle="Environnement de travail & maintenance" />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Colonne gauche : signalements */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Pannes ouvertes</p>
                <p className="text-2xl font-semibold text-red-600">{ouverts}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">En traitement</p>
                <p className="text-2xl font-semibold text-amber-600">{enTraitement}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Résolus</p>
                <p className="text-2xl font-semibold text-emerald-600">
                  {signalements.filter((s) => s.statut === 'resolu').length}
                </p>
              </div>
            </div>

            {/* Filtres + bouton */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {[
                  { value: 'actifs', label: 'En cours' },
                  { value: 'resolu', label: 'Résolus' },
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
                Signaler un problème
              </button>
            </div>

            {/* Formulaire */}
            {showForm && (
              <form
                onSubmit={handleSubmit}
                className="bg-white rounded-lg border border-gray-200 shadow-card p-5 space-y-4"
              >
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-emerald-500" />
                  Nouveau signalement
                </h3>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">Type</label>
                  <div className="flex flex-wrap gap-2">
                    {TYPES_CADRE.map((t) => (
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
                        {t.emoji} {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Zone</label>
                    <select
                      value={form.zone}
                      onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    >
                      <option value="">Sélectionner...</option>
                      {ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Priorité</label>
                    <select
                      value={form.priorite}
                      onChange={(e) => setForm((f) => ({ ...f, priorite: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    >
                      <option value="urgent">Urgent</option>
                      <option value="high">Élevée</option>
                      <option value="normal">Normale</option>
                      <option value="low">Faible</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={3}
                    placeholder="Décrivez le problème ou le besoin..."
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

            {/* Liste signalements */}
            {loading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-white rounded-lg border border-gray-200 h-20 animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 shadow-card p-10 text-center">
                <Home className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700">Aucun signalement</p>
                <p className="text-xs text-gray-400 mt-1">Les locaux sont opérationnels !</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((s) => (
                  <div key={s.id} className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
                    <div className="flex items-start gap-3 justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${STATUT_COLOR[s.statut] ?? ''}`}>
                            {s.statut === 'ouvert' ? 'Ouvert' : s.statut === 'en_traitement' ? 'En traitement' : 'Résolu'}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${PRIORITE_COLOR[s.priorite] ?? ''}`}>
                            {s.priorite}
                          </span>
                          {s.zone && <span className="text-xs text-gray-400">📍 {s.zone}</span>}
                        </div>
                        <p className="text-sm text-gray-800">{s.description}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(s.created_at).toLocaleDateString('fr-FR')}
                          {s.traite_le && ` · Résolu le ${new Date(s.traite_le).toLocaleDateString('fr-FR')}`}
                        </p>
                      </div>
                      {s.statut !== 'resolu' && (
                        <div className="flex gap-2 flex-shrink-0">
                          {s.statut === 'ouvert' && (
                            <button
                              onClick={() => updateStatut(s.id, 'en_traitement')}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                            >
                              <Clock className="w-3 h-3" /> Traiter
                            </button>
                          )}
                          <button
                            onClick={() => updateStatut(s.id, 'resolu')}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Résolu
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Colonne droite : checklist */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Checklist confort</h2>
            <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4 space-y-3">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-500">
                  {checkOk}/{checklist.length} points validés
                </p>
                <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${(checkOk / checklist.length) * 100}%` }}
                  />
                </div>
              </div>
              {checklist.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={!!checklistState[item.id]}
                    onChange={() => toggleChecklist(item.id)}
                    className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                  />
                  <span className={`text-sm flex items-center gap-1.5 ${checklistState[item.id] ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                    {item.emoji} {item.label}
                  </span>
                </label>
              ))}
            </div>

            {checkOk === checklist.length && (
              <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-4 text-center">
                <Coffee className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                <p className="text-xs font-medium text-emerald-700">Locaux 100% opérationnels !</p>
              </div>
            )}

            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-600 mb-2">Zones à surveiller</p>
              {ZONES.map((zone) => {
                const count = signalements.filter((s) => s.zone === zone && s.statut !== 'resolu').length
                return count > 0 ? (
                  <div key={zone} className="flex items-center justify-between py-1">
                    <span className="text-xs text-gray-600">{zone}</span>
                    <span className="text-xs font-medium text-red-600">{count} signalement{count > 1 ? 's' : ''}</span>
                  </div>
                ) : null
              })}
              {signalements.filter((s) => s.statut !== 'resolu').length === 0 && (
                <p className="text-xs text-gray-400">Tout va bien dans tous les espaces.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
