'use client'

import { useState, useEffect } from 'react'
import { CreditCard, Plus, CheckCircle2, Play } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'

type Virement = {
  id: string; mois: string; numero_campagne: number; montant_total: number
  nb_virements: number; statut: string; arbitrage_notes: string | null; date_execution: string | null
}
type Ligne = {
  id: string; virement_id: string; beneficiaire: string; montant: number
  reference: string | null; type: string; statut: string
}

function getMois3(): string[] {
  const months = []
  const now = new Date()
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}
function formatMois(m: string): string {
  const [y, mo] = m.split('-')
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

const STATUT_VIREMENT: Record<string, { label: string; color: string; next: string | null; nextLabel: string }> = {
  preparation: { label: 'En préparation', color: 'bg-amber-50 text-amber-600 border-amber-200', next: 'arbitrage',   nextLabel: 'Soumettre à la Direction' },
  arbitrage:   { label: 'Arbitrage',      color: 'bg-purple-50 text-purple-600 border-purple-200', next: 'valide',    nextLabel: 'Valider après arbitrage' },
  valide:      { label: 'Validé',         color: 'bg-blue-50 text-blue-600 border-blue-200',  next: 'execute',   nextLabel: 'Exécuter les virements' },
  execute:     { label: 'Exécuté ✓',     color: 'bg-emerald-50 text-emerald-600 border-emerald-200', next: null, nextLabel: '' },
}

const TYPE_LIGNE = [
  { value: 'fournisseur', label: 'Fournisseur' },
  { value: 'st',          label: 'Sous-traitant' },
  { value: 'salaire',     label: 'Salaire' },
  { value: 'autre',       label: 'Autre' },
]

export default function ReglementsPage() {
  const [virements, setVirements] = useState<Virement[]>([])
  const [lignes, setLignes]       = useState<Ligne[]>([])
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState<Virement | null>(null)
  const [showForm, setShowForm]   = useState(false)
  const [showLigneForm, setShowLigneForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formV, setFormV] = useState({ mois: getMois3()[0], numero_campagne: '1', arbitrage_notes: '' })
  const [formL, setFormL] = useState({ beneficiaire: '', montant: '', reference: '', type: 'fournisseur' })

  async function fetchData() {
    const supabase = createClient()
    const [vRes, lRes] = await Promise.all([
      supabase.schema('app').from('compta_virements').select('*').order('created_at', { ascending: false }),
      supabase.schema('app').from('compta_virement_lignes').select('*').order('created_at'),
    ])
    setVirements((vRes.data ?? []) as Virement[])
    setLignes((lRes.data ?? []) as Ligne[])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  async function createVirement(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const supabase = createClient()
    await supabase.schema('app').from('compta_virements').insert({
      mois: formV.mois, numero_campagne: Number(formV.numero_campagne),
      statut: 'preparation', montant_total: 0, nb_virements: 0,
    })
    setFormV({ mois: getMois3()[0], numero_campagne: '1', arbitrage_notes: '' })
    setShowForm(false)
    setSubmitting(false)
    fetchData()
  }

  async function addLigne(e: React.FormEvent) {
    e.preventDefault()
    if (!selected || !formL.beneficiaire || !formL.montant) return
    setSubmitting(true)
    const supabase = createClient()
    const montant = Number(formL.montant)
    await supabase.schema('app').from('compta_virement_lignes').insert({
      virement_id: selected.id, beneficiaire: formL.beneficiaire,
      montant, reference: formL.reference || null, type: formL.type, statut: 'propose',
    })
    // Update totaux
    const lignesV = [...lignes.filter((l) => l.virement_id === selected.id), { montant }]
    const newTotal = lignesV.reduce((s, l) => s + l.montant, 0)
    await supabase.schema('app').from('compta_virements').update({ montant_total: newTotal, nb_virements: lignesV.length }).eq('id', selected.id)
    setFormL({ beneficiaire: '', montant: '', reference: '', type: 'fournisseur' })
    setShowLigneForm(false)
    setSubmitting(false)
    fetchData()
  }

  async function updateStatut(id: string, statut: string) {
    const supabase = createClient()
    await supabase.schema('app').from('compta_virements').update({
      statut,
      ...(statut === 'execute' ? { date_execution: new Date().toISOString().split('T')[0] } : {}),
    }).eq('id', id)
    if (statut === 'execute') {
      const lignesV = lignes.filter((l) => l.virement_id === id)
      if (lignesV.length > 0) {
        await supabase.schema('app').from('compta_virement_lignes').update({ statut: 'execute' }).eq('virement_id', id)
      }
    }
    setSelected((s) => s?.id === id ? { ...s, statut } : s)
    fetchData()
  }

  async function toggleLigne(id: string, statut: string) {
    const supabase = createClient()
    const newStatut = statut === 'valide' ? 'refuse' : statut === 'refuse' ? 'valide' : 'valide'
    await supabase.schema('app').from('compta_virement_lignes').update({ statut: newStatut }).eq('id', id)
    fetchData()
  }

  const selectedFull    = selected ? virements.find((v) => v.id === selected.id) ?? selected : null
  const lignesSelected  = selectedFull ? lignes.filter((l) => l.virement_id === selectedFull.id) : []
  const totalValide     = lignesSelected.filter((l) => l.statut !== 'refuse').reduce((s, l) => s + l.montant, 0)

  return (
    <div>
      <TopBar title="Règlements" subtitle="Campagnes de virements · Arbitrage · Exécution" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'En préparation', count: virements.filter((v) => v.statut === 'preparation').length, color: 'text-amber-600' },
            { label: 'En arbitrage',   count: virements.filter((v) => v.statut === 'arbitrage').length,   color: 'text-purple-600' },
            { label: 'Validés',        count: virements.filter((v) => v.statut === 'valide').length,      color: 'text-blue-600' },
            { label: 'Exécutés',       count: virements.filter((v) => v.statut === 'execute').length,     color: 'text-emerald-600' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{s.label}</p>
              <p className={`text-2xl font-semibold ${s.color}`}>{s.count}</p>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors">
            <Plus className="w-4 h-4" /> Nouvelle campagne
          </button>
        </div>

        {showForm && (
          <form onSubmit={createVirement} className="bg-white rounded-lg border border-gray-200 shadow-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-teal-500" /> Nouvelle campagne de virements
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Mois *</label>
                <select value={formV.mois} onChange={(e) => setFormV((f) => ({ ...f, mois: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                  {getMois3().map((m) => <option key={m} value={m}>{formatMois(m)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Quinzaine</label>
                <select value={formV.numero_campagne} onChange={(e) => setFormV((f) => ({ ...f, numero_campagne: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                  <option value="1">1ère quinzaine</option>
                  <option value="2">2ème quinzaine</option>
                </select>
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
          <div className="space-y-2">{[1,2].map((i) => <div key={i} className="h-16 bg-white rounded-lg border border-gray-200 animate-pulse" />)}</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Liste campagnes */}
            <div className="lg:col-span-2 space-y-2">
              {virements.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 shadow-card p-10 text-center">
                  <CreditCard className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-700">Aucune campagne</p>
                </div>
              ) : virements.map((v) => {
                const s = STATUT_VIREMENT[v.statut]
                return (
                  <button key={v.id} onClick={() => setSelected(selectedFull?.id === v.id ? null : v)}
                    className={`w-full text-left bg-white rounded-lg border shadow-card p-4 transition-colors ${selectedFull?.id === v.id ? 'border-gray-900' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {v.numero_campagne === 1 ? '1ère' : '2ème'} quinzaine — {formatMois(v.mois)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {v.montant_total.toLocaleString('fr-FR')} € · {v.nb_virements} ligne{v.nb_virements > 1 ? 's' : ''}
                          {v.date_execution ? ` · Exécuté ${new Date(v.date_execution).toLocaleDateString('fr-FR')}` : ''}
                        </p>
                      </div>
                      <span className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${s.color}`}>{s.label}</span>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Détail campagne */}
            {selectedFull && (
              <div className="lg:col-span-3 bg-white rounded-lg border border-gray-200 shadow-card p-5 space-y-4 h-fit">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-semibold text-gray-900">
                      {selectedFull.numero_campagne === 1 ? '1ère' : '2ème'} quinzaine — {formatMois(selectedFull.mois)}
                    </p>
                    <p className="text-xs text-gray-400">Total validé : <span className="font-semibold text-gray-700">{totalValide.toLocaleString('fr-FR')} €</span></p>
                  </div>
                  <button onClick={() => setSelected(null)} className="text-gray-300 hover:text-gray-600 text-lg">×</button>
                </div>

                {/* Statut & action */}
                {(() => {
                  const s = STATUT_VIREMENT[selectedFull.statut]
                  return (
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${s.color}`}>{s.label}</span>
                      {s.next && (
                        <button onClick={() => updateStatut(selectedFull.id, s.next!)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-800">
                          {s.next === 'execute' ? <Play className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                          {s.nextLabel}
                        </button>
                      )}
                    </div>
                  )
                })()}

                {/* Lignes de virements */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-600">Virements ({lignesSelected.length})</p>
                    {['preparation', 'arbitrage'].includes(selectedFull.statut) && (
                      <button onClick={() => setShowLigneForm(!showLigneForm)}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
                        <Plus className="w-3 h-3" /> Ajouter
                      </button>
                    )}
                  </div>

                  {showLigneForm && (
                    <form onSubmit={addLigne} className="bg-gray-50 rounded-lg p-3 space-y-2 mb-3">
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" placeholder="Bénéficiaire *" value={formL.beneficiaire} onChange={(e) => setFormL((f) => ({ ...f, beneficiaire: e.target.value }))}
                          className="border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none" />
                        <input type="number" placeholder="Montant (€) *" value={formL.montant} onChange={(e) => setFormL((f) => ({ ...f, montant: e.target.value }))}
                          className="border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none" />
                        <input type="text" placeholder="Référence" value={formL.reference} onChange={(e) => setFormL((f) => ({ ...f, reference: e.target.value }))}
                          className="border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none" />
                        <select value={formL.type} onChange={(e) => setFormL((f) => ({ ...f, type: e.target.value }))}
                          className="border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none">
                          {TYPE_LIGNE.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button type="button" onClick={() => setShowLigneForm(false)} className="px-2 py-1 text-xs text-gray-600 hover:text-gray-900">Annuler</button>
                        <button type="submit" disabled={submitting || !formL.beneficiaire || !formL.montant}
                          className="px-3 py-1 bg-gray-900 text-white text-xs rounded hover:bg-gray-800 disabled:opacity-50">
                          Ajouter
                        </button>
                      </div>
                    </form>
                  )}

                  {lignesSelected.length === 0 ? (
                    <p className="text-xs text-gray-400">Aucune ligne — cliquez &quot;Ajouter&quot; pour préparer la liste.</p>
                  ) : (
                    <div className="space-y-1">
                      {lignesSelected.map((l) => (
                        <div key={l.id} className={`flex items-center gap-3 py-1.5 px-2 rounded ${l.statut === 'refuse' ? 'opacity-50' : ''}`}>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-800 truncate">{l.beneficiaire}</p>
                            <p className="text-xs text-gray-400">{TYPE_LIGNE.find((t) => t.value === l.type)?.label}{l.reference ? ` · ${l.reference}` : ''}</p>
                          </div>
                          <p className={`text-xs font-semibold flex-shrink-0 ${l.statut === 'refuse' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                            {l.montant.toLocaleString('fr-FR')} €
                          </p>
                          {['preparation', 'arbitrage'].includes(selectedFull.statut) && (
                            <button onClick={() => toggleLigne(l.id, l.statut)}
                              className={`flex-shrink-0 px-2 py-0.5 rounded text-xs border transition-colors ${l.statut === 'refuse' ? 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200' : 'bg-red-50 text-red-500 border-red-200 hover:bg-red-100'}`}>
                              {l.statut === 'refuse' ? 'Réintégrer' : 'Exclure'}
                            </button>
                          )}
                          {l.statut === 'execute' && <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {selectedFull.statut === 'arbitrage' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Notes arbitrage Direction</label>
                    <textarea rows={2} placeholder="Décisions de la Direction sur les priorités..."
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none" />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
