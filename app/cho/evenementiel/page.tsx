'use client'

import { useState, useEffect } from 'react'
import { Calendar, Plus, CheckCircle2, Users, MapPin, Euro, Lightbulb, ThumbsUp, Check, X, MessageSquare, Loader2, Cake, Gift } from 'lucide-react'
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

        {/* Anniversaires */}
        <AnniversairesSection />

        {/* Boîte aux idées */}
        <BoiteIdees />
      </div>
    </div>
  )
}

/* ────────────────────── ANNIVERSAIRES ────────────────────── */

type Membre = { id: string; prenom: string | null; nom: string | null; role: string | null; date_naissance: string | null }

function AnniversairesSection() {
  const supabase = createClient()
  const [membres, setMembres] = useState<Membre[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .schema('app')
      .from('utilisateurs')
      .select('id,prenom,nom,role,date_naissance')
      .eq('actif', true)
      .not('date_naissance', 'is', null)
      .then(({ data }) => {
        setMembres((data ?? []) as Membre[])
        setLoading(false)
      })
  }, [])

  const today = new Date()
  const todayMD = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  // Trier par prochain anniversaire
  const sorted = [...membres]
    .map(m => {
      const dn = new Date(m.date_naissance!)
      const md = `${String(dn.getMonth() + 1).padStart(2, '0')}-${String(dn.getDate()).padStart(2, '0')}`
      const thisYear = new Date(today.getFullYear(), dn.getMonth(), dn.getDate())
      let next = thisYear
      if (thisYear < today && md !== todayMD) {
        next = new Date(today.getFullYear() + 1, dn.getMonth(), dn.getDate())
      }
      const daysUntil = Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      const age = next.getFullYear() - dn.getFullYear()
      const isToday = md === todayMD
      return { ...m, daysUntil, age, isToday, nextDate: next, md }
    })
    .sort((a, b) => a.daysUntil - b.daysUntil)

  const anniversairesAujourdhui = sorted.filter(m => m.isToday)
  const prochains = sorted.filter(m => !m.isToday).slice(0, 8)

  return (
    <div className="mt-10">
      <div className="flex items-center gap-2 mb-4">
        <Cake className="w-4 h-4 text-pink-500" />
        <h2 className="text-base font-semibold text-gray-900">Anniversaires</h2>
      </div>

      {loading ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <Loader2 className="w-5 h-5 text-gray-400 mx-auto animate-spin" />
        </div>
      ) : membres.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <Cake className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Aucune date de naissance renseignée</p>
          <p className="text-xs text-gray-400 mt-1">Les membres peuvent renseigner leur date de naissance dans Paramètres.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Aujourd'hui */}
          {anniversairesAujourdhui.length > 0 && (
            <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Gift className="w-4 h-4 text-pink-600" />
                <p className="text-sm font-semibold text-pink-800">
                  Aujourd'hui !
                </p>
              </div>
              <div className="space-y-2">
                {anniversairesAujourdhui.map(m => (
                  <div key={m.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center text-xs font-semibold text-pink-700 flex-shrink-0">
                      {(m.prenom?.[0] ?? '').toUpperCase()}{(m.nom?.[0] ?? '').toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-pink-900">{m.prenom} {m.nom}</p>
                      <p className="text-xs text-pink-600">{m.age} ans · {m.role ?? ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prochains */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-left text-xs font-medium text-gray-500">
                  <th className="px-4 py-3">Membre</th>
                  <th className="px-4 py-3">Rôle</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Âge</th>
                  <th className="px-4 py-3 text-right">Dans</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {prochains.map(m => (
                  <tr key={m.id} className={`hover:bg-gray-50 ${m.daysUntil <= 7 ? 'bg-amber-50/30' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-semibold text-gray-600 flex-shrink-0">
                          {(m.prenom?.[0] ?? '').toUpperCase()}{(m.nom?.[0] ?? '').toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-900">{m.prenom} {m.nom}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{m.role ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {m.nextDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{m.age} ans</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-xs font-medium ${
                        m.daysUntil <= 3 ? 'text-pink-600' : m.daysUntil <= 7 ? 'text-amber-600' : 'text-gray-500'
                      }`}>
                        {m.daysUntil === 0 ? "Aujourd'hui" : m.daysUntil === 1 ? 'Demain' : `${m.daysUntil}j`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

/* ────────────────────── BOÎTE AUX IDÉES ────────────────────── */

type Idee = {
  id: string
  user_id: string
  texte: string
  categorie: string
  votes: number
  statut: 'nouvelle' | 'retenue' | 'planifiee' | 'rejetee'
  reponse_cho: string | null
  created_at: string
}

const CAT_LABELS: Record<string, string> = {
  evenement: 'Événement',
  amelioration: 'Amélioration',
  team_building: 'Team building',
  autre: 'Autre',
}

const STATUT_IDEE: Record<string, { label: string; style: string }> = {
  nouvelle:  { label: 'Nouvelle',  style: 'bg-blue-50 text-blue-700 border-blue-200' },
  retenue:   { label: 'Retenue',   style: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  planifiee: { label: 'Planifiée', style: 'bg-purple-50 text-purple-700 border-purple-200' },
  rejetee:   { label: 'Rejetée',   style: 'bg-gray-100 text-gray-500 border-gray-200' },
}

function BoiteIdees() {
  const supabase = createClient()
  const [idees, setIdees] = useState<Idee[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [newTexte, setNewTexte] = useState('')
  const [newCat, setNewCat] = useState('evenement')
  const [saving, setSaving] = useState(false)
  const [repondre, setRepondre] = useState<string | null>(null)
  const [reponseText, setReponseText] = useState('')

  async function load() {
    const { data } = await supabase
      .from('boite_idees')
      .select('*')
      .order('created_at', { ascending: false })
    setIdees((data ?? []) as Idee[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function soumettre() {
    if (!newTexte.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    await supabase.from('boite_idees').insert({
      user_id: user.id,
      texte: newTexte.trim(),
      categorie: newCat,
    })
    setNewTexte('')
    setShowNew(false)
    setSaving(false)
    load()
  }

  async function voter(id: string) {
    const idee = idees.find(i => i.id === id)
    if (!idee) return
    await supabase.from('boite_idees').update({ votes: idee.votes + 1 }).eq('id', id)
    setIdees(prev => prev.map(i => i.id === id ? { ...i, votes: i.votes + 1 } : i))
  }

  async function changerStatut(id: string, statut: string) {
    await supabase.from('boite_idees').update({ statut }).eq('id', id)
    load()
  }

  async function envoyerReponse(id: string) {
    if (!reponseText.trim()) return
    await supabase.from('boite_idees').update({ reponse_cho: reponseText.trim() }).eq('id', id)
    setRepondre(null)
    setReponseText('')
    load()
  }

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-500" />
          <h2 className="text-base font-semibold text-gray-900">Propositions de l'équipe</h2>
          <span className="text-xs text-gray-400">{idees.filter(i => i.statut === 'nouvelle').length} nouvelle{idees.filter(i => i.statut === 'nouvelle').length > 1 ? 's' : ''}</span>
        </div>
        <button
          onClick={() => setShowNew(!showNew)}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800"
        >
          <Plus className="w-4 h-4" /> Nouvelle idée
        </button>
      </div>

      {/* Formulaire nouvelle idée */}
      {showNew && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 space-y-3">
          <textarea
            value={newTexte}
            onChange={e => setNewTexte(e.target.value)}
            placeholder="Décrivez votre idée... (sortie d'équipe, amélioration, activité...)"
            rows={2}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none"
          />
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {Object.entries(CAT_LABELS).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setNewCat(val)}
                  className={`px-2.5 py-1 text-xs rounded-full border transition ${
                    newCat === val ? 'bg-gray-900 text-white border-gray-900' : 'text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowNew(false)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-900">Annuler</button>
              <button
                onClick={soumettre}
                disabled={saving || !newTexte.trim()}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50"
              >
                {saving && <Loader2 className="w-3 h-3 animate-spin" />} Soumettre
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Liste des idées */}
      {loading ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <Loader2 className="w-5 h-5 text-gray-400 mx-auto animate-spin" />
        </div>
      ) : idees.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <Lightbulb className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Aucune proposition pour le moment</p>
          <p className="text-xs text-gray-400 mt-1">Les employés peuvent proposer des idées depuis n'importe quelle interface.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {idees.map(idee => {
            const st = STATUT_IDEE[idee.statut]
            return (
              <div key={idee.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  {/* Vote */}
                  <button
                    onClick={() => voter(idee.id)}
                    className="flex flex-col items-center gap-0.5 pt-0.5 flex-shrink-0 text-gray-400 hover:text-amber-600 transition"
                    title="Voter pour cette idée"
                  >
                    <ThumbsUp className="w-4 h-4" />
                    <span className="text-xs font-semibold">{idee.votes}</span>
                  </button>
                  {/* Contenu */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium border ${st.style}`}>{st.label}</span>
                      <span className="text-[10px] text-gray-400">{CAT_LABELS[idee.categorie] ?? idee.categorie}</span>
                      <span className="text-[10px] text-gray-300">
                        {new Date(idee.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800">{idee.texte}</p>
                    {idee.reponse_cho && (
                      <div className="mt-2 bg-gray-50 rounded px-3 py-2">
                        <p className="text-xs text-gray-500">
                          <span className="font-medium">CHO :</span> {idee.reponse_cho}
                        </p>
                      </div>
                    )}
                    {repondre === idee.id && (
                      <div className="mt-2 flex gap-2">
                        <input
                          value={reponseText}
                          onChange={e => setReponseText(e.target.value)}
                          placeholder="Votre réponse..."
                          className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-300"
                          onKeyDown={e => e.key === 'Enter' && envoyerReponse(idee.id)}
                        />
                        <button onClick={() => envoyerReponse(idee.id)} className="px-2 py-1 text-xs bg-gray-900 text-white rounded hover:bg-gray-800">
                          Envoyer
                        </button>
                        <button onClick={() => { setRepondre(null); setReponseText('') }} className="px-2 py-1 text-xs text-gray-400 hover:text-gray-700">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  {/* Actions CHO */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => { setRepondre(idee.id); setReponseText(idee.reponse_cho ?? '') }}
                      className="p-1 text-gray-400 hover:text-gray-700"
                      title="Répondre"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                    {idee.statut === 'nouvelle' && (
                      <>
                        <button onClick={() => changerStatut(idee.id, 'retenue')} className="p-1 text-gray-400 hover:text-emerald-600" title="Retenir">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => changerStatut(idee.id, 'rejetee')} className="p-1 text-gray-400 hover:text-red-500" title="Rejeter">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    {idee.statut === 'retenue' && (
                      <button onClick={() => changerStatut(idee.id, 'planifiee')} className="p-1 text-gray-400 hover:text-purple-600" title="Marquer planifiée">
                        <Calendar className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
