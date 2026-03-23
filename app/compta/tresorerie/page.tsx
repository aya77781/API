'use client'

import { useState, useEffect } from 'react'
import { BarChart3, Plus, CheckCircle2, Calculator } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'

type Cloture = {
  id: string; mois: string; statut: string; notes: string | null
  factures_ok: boolean; rapprochement_ok: boolean; tva_calculee: boolean; transmis_expert: boolean
  montant_tva_estime: number | null
}
type Rapprochement = {
  id: string; mois: string; flux_debit: number; flux_credit: number
  factures_liees: number; statut: string; notes: string | null
}

function getMois6(): string[] {
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
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

const CHECKS_CLOTURE = [
  { key: 'factures_ok',       label: 'Toutes les factures récupérées et intégrées' },
  { key: 'rapprochement_ok',  label: 'Rapprochement bancaire effectué (banque lettrée)' },
  { key: 'tva_calculee',      label: 'Estimation de TVA calculée pour M+1' },
  { key: 'transmis_expert',   label: 'Dossier transmis à l\'expert-comptable' },
]

export default function TresoreriePage() {
  const [clotures, setClotures]           = useState<Cloture[]>([])
  const [rapprochements, setRapprochements] = useState<Rapprochement[]>([])
  const [loading, setLoading]             = useState(true)
  const [selected, setSelected]           = useState<Cloture | null>(null)
  const [tab, setTab]                     = useState<'clotures' | 'rapprochements'>('clotures')
  const [showForm, setShowForm]           = useState(false)
  const [showRappForm, setShowRappForm]   = useState(false)
  const [submitting, setSubmitting]       = useState(false)
  const [formMois, setFormMois]           = useState(getMois6()[0])
  const [formTva, setFormTva]             = useState('')
  const [formNotes, setFormNotes]         = useState('')
  const [formR, setFormR] = useState({ mois: getMois6()[0], flux_debit: '', flux_credit: '', factures_liees: '', notes: '' })

  async function fetchData() {
    const supabase = createClient()
    const [cRes, rRes] = await Promise.all([
      supabase.schema('app').from('compta_clotures').select('*').order('mois', { ascending: false }),
      supabase.schema('app').from('compta_rapprochements').select('*').order('mois', { ascending: false }),
    ])
    setClotures((cRes.data ?? []) as Cloture[])
    setRapprochements((rRes.data ?? []) as Rapprochement[])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  async function createCloture(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const supabase = createClient()
    await supabase.schema('app').from('compta_clotures').upsert({
      mois: formMois, statut: 'en_cours',
      montant_tva_estime: formTva ? Number(formTva) : null,
      notes: formNotes || null,
    }, { onConflict: 'mois' })
    setFormMois(getMois6()[0])
    setFormTva('')
    setFormNotes('')
    setShowForm(false)
    setSubmitting(false)
    fetchData()
  }

  async function createRapprochement(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const supabase = createClient()
    await supabase.schema('app').from('compta_rapprochements').insert({
      mois: formR.mois,
      flux_debit: Number(formR.flux_debit) || 0,
      flux_credit: Number(formR.flux_credit) || 0,
      factures_liees: Number(formR.factures_liees) || 0,
      notes: formR.notes || null,
      statut: 'en_cours',
    })
    setFormR({ mois: getMois6()[0], flux_debit: '', flux_credit: '', factures_liees: '', notes: '' })
    setShowRappForm(false)
    setSubmitting(false)
    fetchData()
  }

  async function toggleCheck(id: string, field: string, current: boolean) {
    const supabase = createClient()
    const update: Record<string, unknown> = { [field]: !current }
    // Auto-update statut
    const cl = clotures.find((c) => c.id === id)!
    const newCl = { ...cl, [field]: !current }
    if (newCl.factures_ok && newCl.rapprochement_ok && newCl.tva_calculee && newCl.transmis_expert) {
      update.statut = 'transmis'
    } else if (newCl.factures_ok && newCl.rapprochement_ok && newCl.tva_calculee) {
      update.statut = 'complet'
    } else {
      update.statut = 'en_cours'
    }
    await supabase.schema('app').from('compta_clotures').update(update).eq('id', id)
    setSelected((s) => s ? { ...s, [field]: !current, statut: update.statut as string } : null)
    fetchData()
  }

  async function updateRapprochementStatut(id: string, statut: string) {
    const supabase = createClient()
    await supabase.schema('app').from('compta_rapprochements').update({ statut }).eq('id', id)
    fetchData()
  }

  const selectedFull = selected ? clotures.find((c) => c.id === selected.id) ?? selected : null

  return (
    <div>
      <TopBar title="Trésorerie" subtitle="Rapprochement bancaire · Clôture mensuelle · TVA" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Clôtures transmises</p>
            <p className="text-2xl font-semibold text-emerald-600">{clotures.filter((c) => c.statut === 'transmis').length}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Clôtures en cours</p>
            <p className="text-2xl font-semibold text-amber-600">{clotures.filter((c) => c.statut === 'en_cours').length}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Rapprochements</p>
            <p className="text-2xl font-semibold text-blue-600">{rapprochements.filter((r) => r.statut === 'lettree').length} lettrés</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">TVA estimée (mois)</p>
            <p className="text-2xl font-semibold text-gray-900">
              {(clotures.find((c) => c.mois === getMois6()[0])?.montant_tva_estime ?? 0).toLocaleString('fr-FR')} €
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {[
              { value: 'clotures',         label: '📋 Clôtures mensuelles' },
              { value: 'rapprochements',   label: '🏦 Rapprochements bancaires' },
            ].map((t) => (
              <button key={t.value} onClick={() => { setTab(t.value as typeof tab); setShowForm(false); setShowRappForm(false) }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.value ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <button onClick={() => tab === 'clotures' ? setShowForm(true) : setShowRappForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors">
            <Plus className="w-4 h-4" /> {tab === 'clotures' ? 'Nouvelle clôture' : 'Nouveau rapprochement'}
          </button>
        </div>

        {/* CLOTURES */}
        {tab === 'clotures' && (
          <>
            {showForm && (
              <form onSubmit={createCloture} className="bg-white rounded-lg border border-gray-200 shadow-card p-5 space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-teal-500" /> Nouvelle clôture mensuelle
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Mois *</label>
                    <select value={formMois} onChange={(e) => setFormMois(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                      {getMois6().map((m) => <option key={m} value={m}>{formatMois(m)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">TVA estimée (€)</label>
                    <input type="number" value={formTva} onChange={(e) => setFormTva(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                    <input type="text" value={formNotes} onChange={(e) => setFormNotes(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                </div>
                <div className="flex gap-3 justify-end">
                  <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
                  <button type="submit" disabled={submitting}
                    className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50">
                    {submitting ? 'Création...' : 'Créer'}
                  </button>
                </div>
              </form>
            )}

            {loading ? (
              <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-16 bg-white rounded-lg border border-gray-200 animate-pulse" />)}</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {/* Liste */}
                <div className="lg:col-span-2 space-y-2">
                  {clotures.length === 0 ? (
                    <div className="bg-white rounded-lg border border-gray-200 shadow-card p-10 text-center">
                      <BarChart3 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                      <p className="text-sm font-medium text-gray-700">Aucune clôture</p>
                    </div>
                  ) : clotures.map((c) => {
                    const done = [c.factures_ok, c.rapprochement_ok, c.tva_calculee, c.transmis_expert].filter(Boolean).length
                    return (
                      <button key={c.id} onClick={() => setSelected(selectedFull?.id === c.id ? null : c)}
                        className={`w-full text-left bg-white rounded-lg border shadow-card p-4 transition-colors ${selectedFull?.id === c.id ? 'border-gray-900' : 'border-gray-200 hover:border-gray-300'}`}>
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div>
                            <p className="text-sm font-medium text-gray-900 capitalize">{formatMois(c.mois)}</p>
                            {c.montant_tva_estime && <p className="text-xs text-gray-400">TVA est. {c.montant_tva_estime.toLocaleString('fr-FR')} €</p>}
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.statut === 'transmis' ? 'bg-emerald-50 text-emerald-600' : c.statut === 'complet' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                              {c.statut === 'transmis' ? 'Transmis' : c.statut === 'complet' ? 'Complet' : 'En cours'}
                            </span>
                            <span className="text-xs text-gray-400">{done}/4 étapes</span>
                          </div>
                        </div>
                        <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-teal-500 rounded-full" style={{ width: `${(done / 4) * 100}%` }} />
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Checklist */}
                {selectedFull && (
                  <div className="lg:col-span-3 bg-white rounded-lg border border-gray-200 shadow-card p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-base font-semibold text-gray-900 capitalize">{formatMois(selectedFull.mois)}</p>
                        <p className="text-xs text-gray-400">Clôture mensuelle — checklist</p>
                      </div>
                      <button onClick={() => setSelected(null)} className="text-gray-300 hover:text-gray-600 text-lg">×</button>
                    </div>

                    {selectedFull.montant_tva_estime && (
                      <div className="bg-teal-50 rounded-lg border border-teal-200 p-3 flex items-center gap-3">
                        <Calculator className="w-4 h-4 text-teal-500" />
                        <div>
                          <p className="text-xs font-semibold text-teal-700">TVA estimée</p>
                          <p className="text-sm font-bold text-teal-800">{selectedFull.montant_tva_estime.toLocaleString('fr-FR')} €</p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      {CHECKS_CLOTURE.map((check) => {
                        const val = selectedFull[check.key as keyof Cloture] as boolean
                        return (
                          <label key={check.key} className="flex items-start gap-3 cursor-pointer group">
                            <input type="checkbox" checked={val}
                              onChange={() => toggleCheck(selectedFull.id, check.key, val)}
                              className="w-4 h-4 rounded border-gray-300 text-gray-900 mt-0.5" />
                            <span className={`text-sm leading-relaxed ${val ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                              {check.label}
                            </span>
                            {val && <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto flex-shrink-0 mt-0.5" />}
                          </label>
                        )
                      })}
                    </div>

                    {selectedFull.statut === 'transmis' && (
                      <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-3 text-center">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                        <p className="text-xs font-medium text-emerald-700">Dossier transmis à l&apos;expert-comptable ✓</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* RAPPROCHEMENTS */}
        {tab === 'rapprochements' && (
          <>
            {showRappForm && (
              <form onSubmit={createRapprochement} className="bg-white rounded-lg border border-gray-200 shadow-card p-5 space-y-4">
                <h3 className="text-sm font-semibold text-gray-900">🏦 Nouveau rapprochement bancaire</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Mois *</label>
                    <select value={formR.mois} onChange={(e) => setFormR((f) => ({ ...f, mois: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                      {getMois6().map((m) => <option key={m} value={m}>{formatMois(m)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Flux débit (€)</label>
                    <input type="number" value={formR.flux_debit} onChange={(e) => setFormR((f) => ({ ...f, flux_debit: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Flux crédit (€)</label>
                    <input type="number" value={formR.flux_credit} onChange={(e) => setFormR((f) => ({ ...f, flux_credit: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Factures liées</label>
                    <input type="number" value={formR.factures_liees} onChange={(e) => setFormR((f) => ({ ...f, factures_liees: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                </div>
                <div className="flex gap-3 justify-end">
                  <button type="button" onClick={() => setShowRappForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
                  <button type="submit" disabled={submitting}
                    className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50">
                    {submitting ? 'Enregistrement...' : 'Créer'}
                  </button>
                </div>
              </form>
            )}

            {rapprochements.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 shadow-card p-10 text-center">
                <BarChart3 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700">Aucun rapprochement</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 shadow-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Mois</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Débits</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Crédits</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Solde net</th>
                      <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500">Factures</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {rapprochements.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 capitalize">{formatMois(r.mois)}</td>
                        <td className="px-4 py-3 text-right text-sm text-red-600">{r.flux_debit.toLocaleString('fr-FR')} €</td>
                        <td className="px-4 py-3 text-right text-sm text-emerald-600">{r.flux_credit.toLocaleString('fr-FR')} €</td>
                        <td className={`px-4 py-3 text-right text-sm font-semibold ${r.flux_credit - r.flux_debit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          {(r.flux_credit - r.flux_debit).toLocaleString('fr-FR')} €
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-gray-600">{r.factures_liees}</td>
                        <td className="px-4 py-3 text-right">
                          {r.statut !== 'lettree' ? (
                            <button onClick={() => updateRapprochementStatut(r.id, 'lettree')}
                              className="px-3 py-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100">
                              Marquer lettrée
                            </button>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-600">Lettrée ✓</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
