'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Wallet, X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'

type Revenu = {
  id: string
  projet_id: string
  libelle: string
  type: string
  montant_ht: number
  tva_pct: number
  date_facture: string | null
  date_encaissement: string | null
  statut: string
  reference_facture: string | null
}
type Projet = { id: string; nom: string; budget_client_ht: number | null }

const TYPES = ['acompte', 'situation', 'solde', 'autre']
const STATUTS = ['en_attente', 'facture', 'encaisse']
const STATUT_LABEL: Record<string, string> = {
  en_attente: 'En attente', facture: 'Facturé', encaisse: 'Encaissé',
}
const STATUT_BADGE: Record<string, string> = {
  en_attente: 'bg-gray-100 text-gray-600 border border-gray-200',
  facture:    'bg-amber-50 text-amber-700 border border-amber-200',
  encaisse:   'bg-emerald-50 text-emerald-700 border border-emerald-200',
}

function fmt(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €'
}

export default function RevenusPage() {
  const supabase = createClient()
  const [revenus, setRevenus] = useState<Revenu[]>([])
  const [projets, setProjets] = useState<Projet[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filterProjet, setFilterProjet] = useState<string>('all')
  const [filterStatut, setFilterStatut] = useState<string>('all')

  async function load() {
    setLoading(true)
    const [r, p] = await Promise.all([
      supabase.from('revenus').select('*').order('date_facture', { ascending: false, nullsFirst: false }),
      supabase.from('projets').select('id,nom,budget_client_ht').order('nom'),
    ])
    setRevenus((r.data ?? []) as Revenu[])
    setProjets((p.data ?? []) as Projet[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // Mise a jour du statut directement depuis le tableau
  async function updateStatut(id: string, newStatut: string) {
    // Optimistic update : on met a jour l'UI tout de suite
    setRevenus(prev => prev.map(r => r.id === id ? { ...r, statut: newStatut } : r))
    // Si on passe en encaisse et qu'il n'y a pas de date d'encaissement, on la met a aujourd'hui
    const updates: Record<string, string | null> = { statut: newStatut }
    if (newStatut === 'encaisse') {
      const r = revenus.find(x => x.id === id)
      if (r && !r.date_encaissement) updates.date_encaissement = new Date().toISOString().slice(0, 10)
    }
    const { error } = await supabase.from('revenus').update(updates).eq('id', id)
    if (error) { alert('Erreur : ' + error.message); load() }
  }

  const projetNom = (id: string) => projets.find(p => p.id === id)?.nom ?? '—'

  const filtered = useMemo(() => revenus.filter(r => {
    if (filterProjet !== 'all' && r.projet_id !== filterProjet) return false
    if (filterStatut !== 'all' && r.statut !== filterStatut) return false
    return true
  }), [revenus, filterProjet, filterStatut])

  const totalEncaisse = filtered.filter(r => r.statut === 'encaisse').reduce((s, r) => s + Number(r.montant_ht), 0)
  const totalAttente  = filtered.filter(r => r.statut !== 'encaisse').reduce((s, r) => s + Number(r.montant_ht), 0)

  // Recouvrement par projet
  const recouvrement = useMemo(() => {
    return projets.map(p => {
      const encaisse = revenus
        .filter(r => r.projet_id === p.id && r.statut === 'encaisse')
        .reduce((s, r) => s + Number(r.montant_ht), 0)
      const budget = Number(p.budget_client_ht) || 0
      const taux = budget > 0 ? (encaisse / budget) * 100 : 0
      return { projet: p, encaisse, budget, taux }
    }).filter(x => x.budget > 0 || x.encaisse > 0)
      .sort((a, b) => b.encaisse - a.encaisse)
  }, [projets, revenus])

  return (
    <div>
      <TopBar title="Revenus" subtitle="Encaissements clients : acomptes, situations, soldes" />
      <div className="p-6 space-y-6">

        {/* KPI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <KpiCard label="Total encaissé" value={totalEncaisse} accent="emerald" />
          <KpiCard label="En attente d'encaissement" value={totalAttente} accent="amber" />
        </div>

        {/* Filtres + bouton */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={filterProjet}
              onChange={(e) => setFilterProjet(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            >
              <option value="all">Tous projets</option>
              {projets.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
            </select>
            <select
              value={filterStatut}
              onChange={(e) => setFilterStatut(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            >
              <option value="all">Tous statuts</option>
              {STATUTS.map(s => <option key={s} value={s}>{STATUT_LABEL[s]}</option>)}
            </select>
            <span className="text-xs text-gray-400">{filtered.length} ligne{filtered.length > 1 ? 's' : ''}</span>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-4 h-4" /> Nouveau revenu
          </button>
        </div>

        {/* Tableau */}
        {loading ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Loader2 className="w-6 h-6 text-gray-400 mx-auto animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Wallet className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">Aucun revenu</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-left text-xs font-medium text-gray-500">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Réf.</th>
                  <th className="px-4 py-3">Libellé</th>
                  <th className="px-4 py-3">Projet</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Montant HT</th>
                  <th className="px-4 py-3 text-right">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600">{r.date_facture ? new Date(r.date_facture).toLocaleDateString('fr-FR') : '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{r.reference_facture ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{r.libelle}</td>
                    <td className="px-4 py-3 text-gray-600">{projetNom(r.projet_id)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{r.type}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{fmt(Number(r.montant_ht))}</td>
                    <td className="px-4 py-3 text-right">
                      <select
                        value={r.statut}
                        onChange={(e) => updateStatut(r.id, e.target.value)}
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-900/10 ${STATUT_BADGE[r.statut]}`}
                      >
                        {STATUTS.map(s => <option key={s} value={s}>{STATUT_LABEL[s]}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Recouvrement par projet */}
        {recouvrement.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Taux de recouvrement par projet</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {recouvrement.map(({ projet, encaisse, budget, taux }) => (
                <div key={projet.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <p className="text-sm font-medium text-gray-900 truncate">{projet.nom}</p>
                    <div className="flex items-center gap-3 flex-shrink-0 text-xs">
                      <span className="text-gray-500">{fmt(encaisse)} / {fmt(budget)}</span>
                      <span className={`font-semibold ${taux >= 100 ? 'text-emerald-600' : taux >= 50 ? 'text-amber-600' : 'text-gray-600'}`}>
                        {taux.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${taux >= 100 ? 'bg-emerald-500' : taux >= 50 ? 'bg-amber-500' : 'bg-gray-400'}`}
                      style={{ width: `${Math.min(100, taux)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <RevenuForm
          projets={projets}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load() }}
        />
      )}
    </div>
  )
}

function KpiCard({ label, value, accent }: { label: string; value: number; accent: 'emerald' | 'amber' }) {
  const colors = accent === 'emerald'
    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
    : 'bg-amber-50 border-amber-200 text-amber-700'
  return (
    <div className={`rounded-lg border p-4 ${colors}`}>
      <p className="text-xs font-medium opacity-80">{label}</p>
      <p className="text-2xl font-semibold mt-1">{fmt(value)}</p>
    </div>
  )
}

function RevenuForm({ projets, onClose, onSaved }: { projets: Projet[]; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    libelle: '', projet_id: '', type: 'acompte',
    montant_ht: '', tva_pct: '20',
    date_facture: new Date().toISOString().slice(0, 10),
    date_encaissement: '',
    statut: 'facture',
    reference_facture: '',
  })

  function update<K extends keyof typeof form>(key: K, val: string) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.projet_id) { setError('Le projet est requis.'); return }
    if (!form.libelle.trim()) { setError('Le libellé est requis.'); return }
    if (!form.montant_ht || isNaN(Number(form.montant_ht))) { setError('Montant invalide.'); return }
    setSaving(true)
    const { error: err } = await supabase.from('revenus').insert({
      projet_id: form.projet_id,
      libelle: form.libelle.trim(),
      type: form.type,
      montant_ht: Number(form.montant_ht),
      tva_pct: Number(form.tva_pct),
      date_facture: form.date_facture || null,
      date_encaissement: form.date_encaissement || null,
      statut: form.statut,
      reference_facture: form.reference_facture.trim() || null,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">Nouveau revenu</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <Field label="Projet">
            <select value={form.projet_id} onChange={(e) => update('projet_id', e.target.value)} className="input" required>
              <option value="">— Sélectionner —</option>
              {projets.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
            </select>
          </Field>
          <Field label="Libellé">
            <input value={form.libelle} onChange={(e) => update('libelle', e.target.value)} className="input" placeholder="Acompte 30% - Villa Prado" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select value={form.type} onChange={(e) => update('type', e.target.value)} className="input">
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Référence facture">
              <input value={form.reference_facture} onChange={(e) => update('reference_facture', e.target.value)} className="input" placeholder="FA-2026-041" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Montant HT (€)">
              <input type="number" step="0.01" value={form.montant_ht} onChange={(e) => update('montant_ht', e.target.value)} className="input" required />
            </Field>
            <Field label="TVA %">
              <input type="number" step="0.1" value={form.tva_pct} onChange={(e) => update('tva_pct', e.target.value)} className="input" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date facture">
              <input type="date" value={form.date_facture} onChange={(e) => update('date_facture', e.target.value)} className="input" />
            </Field>
            <Field label="Date encaissement">
              <input type="date" value={form.date_encaissement} onChange={(e) => update('date_encaissement', e.target.value)} className="input" />
            </Field>
          </div>
          <Field label="Statut">
            <select value={form.statut} onChange={(e) => update('statut', e.target.value)} className="input">
              {STATUTS.map(s => <option key={s} value={s}>{STATUT_LABEL[s]}</option>)}
            </select>
          </Field>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Enregistrer
            </button>
          </div>
        </form>
      </div>
      <style jsx>{`
        :global(.input) {
          width: 100%;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          border: 1px solid rgb(229 231 235);
          border-radius: 0.5rem;
          background: white;
        }
        :global(.input:focus) {
          outline: none;
          box-shadow: 0 0 0 2px rgb(17 24 39 / 0.1);
        }
      `}</style>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  )
}
