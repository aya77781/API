'use client'

import { useState, useEffect } from 'react'
import { CreditCard, Plus, CheckCircle2, X, Euro } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'

type NDF = {
  id: string; employe_nom: string; pole: string | null; mois: string
  montant_total: number; statut: string; justificatifs_ok: boolean
  notes: string | null; date_validation: string | null; created_at: string
}

const POLES = ['Économie', 'Dessin', 'Opérations', 'Commercial', 'Direction', 'RH', 'CHO']

const STATUT_NDF: Record<string, { label: string; color: string }> = {
  en_attente: { label: 'En attente',  color: 'bg-amber-50 text-amber-600 border-amber-200' },
  valide:     { label: 'Validée',     color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  refuse:     { label: 'Refusée',     color: 'bg-red-50 text-red-500 border-red-200' },
  paye:       { label: 'Payée',       color: 'bg-gray-100 text-gray-500 border-gray-200' },
}

function getMois(): string[] {
  const months = []
  const now = new Date()
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

function formatMois(m: string): string {
  const [y, mo] = m.split('-')
  const d = new Date(Number(y), Number(mo) - 1, 1)
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

export default function PaieEtFraisPage() {
  const [ndfs, setNdfs]             = useState<NDF[]>([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [filter, setFilter]         = useState<string>('en_attente')
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    employe_nom: '', pole: '', mois: getMois()[0],
    montant_total: '', justificatifs_ok: false, notes: '',
  })

  async function fetchData() {
    const supabase = createClient()
    const { data } = await supabase.schema('app').from('rh_ndf').select('*').order('created_at', { ascending: false })
    setNdfs((data ?? []) as NDF[])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.employe_nom || !form.montant_total) return
    setSubmitting(true)
    const supabase = createClient()
    await supabase.schema('app').from('rh_ndf').insert({
      employe_nom: form.employe_nom, pole: form.pole || null, mois: form.mois,
      montant_total: Number(form.montant_total), justificatifs_ok: form.justificatifs_ok,
      notes: form.notes || null, statut: 'en_attente',
    })
    setForm({ employe_nom: '', pole: '', mois: getMois()[0], montant_total: '', justificatifs_ok: false, notes: '' })
    setShowForm(false)
    setSubmitting(false)
    fetchData()
  }

  async function updateStatut(id: string, statut: string) {
    const supabase = createClient()
    await supabase.schema('app').from('rh_ndf').update({
      statut,
      ...(statut === 'valide' ? { date_validation: new Date().toISOString() } : {}),
    }).eq('id', id)
    fetchData()
  }

  const filtered = filter === 'tous' ? ndfs : ndfs.filter((n) => n.statut === filter)

  const totalEnAttente = ndfs.filter((n) => n.statut === 'en_attente').reduce((s, n) => s + n.montant_total, 0)
  const totalMois = ndfs.filter((n) => n.mois === getMois()[0]).reduce((s, n) => s + n.montant_total, 0)

  // Regrouper par mois pour la vue paie
  const parMois = getMois().reduce<Record<string, NDF[]>>((acc, m) => {
    acc[m] = ndfs.filter((n) => n.mois === m)
    return acc
  }, {})

  return (
    <div>
      <TopBar title="Paie & Frais" subtitle="Variables de paie · Notes de frais (NDF)" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">NDF en attente</p>
            <p className="text-2xl font-semibold text-amber-600">{ndfs.filter((n) => n.statut === 'en_attente').length}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Montant en attente</p>
            <p className="text-2xl font-semibold text-amber-600">{totalEnAttente.toLocaleString('fr-FR')} €</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">NDF ce mois</p>
            <p className="text-2xl font-semibold text-gray-900">{ndfs.filter((n) => n.mois === getMois()[0]).length}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total ce mois</p>
            <p className="text-2xl font-semibold text-gray-900">{totalMois.toLocaleString('fr-FR')} €</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* NDF */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: 'en_attente', label: 'En attente' },
                  { value: 'valide',     label: 'Validées' },
                  { value: 'paye',       label: 'Payées' },
                  { value: 'tous',       label: 'Toutes' },
                ].map((f) => (
                  <button key={f.value} onClick={() => setFilter(f.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filter === f.value ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    {f.label}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors">
                <Plus className="w-4 h-4" /> Saisir une NDF
              </button>
            </div>

            {showForm && (
              <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 shadow-card p-5 space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-amber-500" /> Nouvelle note de frais
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Collaborateur *</label>
                    <input type="text" value={form.employe_nom} onChange={(e) => setForm((f) => ({ ...f, employe_nom: e.target.value }))} placeholder="Nom Prénom"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Pôle</label>
                    <select value={form.pole} onChange={(e) => setForm((f) => ({ ...f, pole: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                      <option value="">Non précisé</option>
                      {POLES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Mois *</label>
                    <select value={form.mois} onChange={(e) => setForm((f) => ({ ...f, mois: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                      {getMois().map((m) => <option key={m} value={m}>{formatMois(m)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Montant total (€) *</label>
                    <input type="number" step="0.01" value={form.montant_total} onChange={(e) => setForm((f) => ({ ...f, montant_total: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.justificatifs_ok} onChange={(e) => setForm((f) => ({ ...f, justificatifs_ok: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 text-gray-900" />
                  <span className="text-sm text-gray-600">Justificatifs vérifiés et conformes</span>
                </label>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                  <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none" />
                </div>
                <div className="flex gap-3 justify-end">
                  <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
                  <button type="submit" disabled={submitting || !form.employe_nom || !form.montant_total}
                    className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50">
                    {submitting ? 'Enregistrement...' : 'Saisir'}
                  </button>
                </div>
              </form>
            )}

            {loading ? (
              <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-16 bg-white rounded-lg border border-gray-200 animate-pulse" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 shadow-card p-10 text-center">
                <CreditCard className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700">Aucune NDF dans cette catégorie</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((n) => {
                  const s = STATUT_NDF[n.statut] ?? { label: n.statut, color: 'bg-gray-100 text-gray-600' }
                  return (
                    <div key={n.id} className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium text-gray-900">{n.employe_nom}</p>
                            {n.pole && <span className="text-xs text-gray-400">· {n.pole}</span>}
                            <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${s.color}`}>{s.label}</span>
                            {n.justificatifs_ok && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                          </div>
                          <p className="text-xs text-gray-400">
                            {formatMois(n.mois)} · <span className="font-semibold text-gray-700">{n.montant_total.toLocaleString('fr-FR')} €</span>
                          </p>
                        </div>
                        {n.statut === 'en_attente' && (
                          <div className="flex gap-2 flex-shrink-0">
                            <button onClick={() => updateStatut(n.id, 'valide')}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100">
                              <CheckCircle2 className="w-3 h-3" /> Valider
                            </button>
                            <button onClick={() => updateStatut(n.id, 'refuse')}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100">
                              <X className="w-3 h-3" /> Refuser
                            </button>
                          </div>
                        )}
                        {n.statut === 'valide' && (
                          <button onClick={() => updateStatut(n.id, 'paye')}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-100 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-200">
                            <Euro className="w-3 h-3" /> Marquer payée
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Tableau de paie mensuel */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">Tableau de paie mensuel</h2>
            {getMois().slice(0, 3).map((mois) => {
              const ndfsMois = parMois[mois] ?? []
              const total = ndfsMois.reduce((s, n) => s + n.montant_total, 0)
              return (
                <div key={mois} className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-700 capitalize">{formatMois(mois)}</p>
                    <p className="text-xs font-semibold text-gray-900">{total.toLocaleString('fr-FR')} €</p>
                  </div>
                  {ndfsMois.length === 0 ? (
                    <p className="text-xs text-gray-400">Aucune NDF</p>
                  ) : (
                    <div className="space-y-1">
                      {ndfsMois.map((n) => (
                        <div key={n.id} className="flex justify-between text-xs">
                          <span className="text-gray-600 truncate flex-1 mr-2">{n.employe_nom}</span>
                          <span className={`font-medium flex-shrink-0 ${n.statut === 'paye' ? 'text-emerald-600' : n.statut === 'refuse' ? 'text-red-500 line-through' : 'text-gray-700'}`}>
                            {n.montant_total.toLocaleString('fr-FR')} €
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
