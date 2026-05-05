'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { CreditCard, Plus, CheckCircle2, X, AlertTriangle, Euro, Landmark, ArrowUpRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'
import { Abbr } from '@/components/shared/Abbr'

type ST = { id: string; nom: string; corps_etat: string | null }
type Caution = {
  id: string; st_id: string; banque: string | null; montant: number
  date_emission: string | null; date_fin_gpa: string | null; statut: string; notes: string | null
}
type Facture = {
  id: string; st_id: string; numero_facture: string | null; montant_ht: number
  date_facture: string | null; prorata_paye: boolean; montant_conforme: boolean
  avenants_inclus: boolean; statut: string; notes: string | null
}

const STATUT_CAUTION: Record<string, { label: string; color: string }> = {
  active:   { label: 'Active',   color: 'bg-blue-50 text-blue-600 border-blue-200' },
  liberee:  { label: 'Libérée', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  expiree:  { label: 'Expirée', color: 'bg-gray-100 text-gray-500 border-gray-200' },
}

const STATUT_FACTURE: Record<string, { label: string; color: string }> = {
  a_verifier:  { label: 'À vérifier',   color: 'bg-amber-50 text-amber-600 border-amber-200' },
  bon_a_payer: { label: 'Bon a payer',  color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  refuse:      { label: 'Refusée',      color: 'bg-red-50 text-red-500 border-red-200' },
  paye:        { label: 'Payée',        color: 'bg-gray-100 text-gray-500 border-gray-200' },
}

export default function AdminFinancierePage() {
  const [sts, setSTs]           = useState<ST[]>([])
  const [cautions, setCautions] = useState<Caution[]>([])
  const [factures, setFactures] = useState<Facture[]>([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState<'prorata_cautions' | 'factures'>('factures')
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formC, setFormC] = useState({ st_id: '', banque: '', montant: '', date_emission: '', date_fin_gpa: '', notes: '' })
  const [formF, setFormF] = useState({ st_id: '', numero_facture: '', montant_ht: '', date_facture: '', notes: '' })

  async function fetchData() {
    const supabase = createClient()
    const [stRes, cauRes, facRes] = await Promise.all([
      supabase.schema('app').from('at_sous_traitants').select('id,nom,corps_etat').order('nom'),
      supabase.schema('app').from('at_cautions').select('*').order('created_at', { ascending: false }),
      supabase.schema('app').from('at_factures').select('*').order('created_at', { ascending: false }),
    ])
    setSTs((stRes.data ?? []) as ST[])
    setCautions((cauRes.data ?? []) as Caution[])
    setFactures((facRes.data ?? []) as Facture[])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  async function submitCaution(e: React.FormEvent) {
    e.preventDefault()
    if (!formC.st_id || !formC.montant) return
    setSubmitting(true)
    const supabase = createClient()
    await supabase.schema('app').from('at_cautions').insert({
      st_id: formC.st_id, banque: formC.banque || null, montant: Number(formC.montant),
      date_emission: formC.date_emission || null, date_fin_gpa: formC.date_fin_gpa || null,
      notes: formC.notes || null, statut: 'active',
    })
    setFormC({ st_id: '', banque: '', montant: '', date_emission: '', date_fin_gpa: '', notes: '' })
    setShowForm(false)
    setSubmitting(false)
    fetchData()
  }

  async function submitFacture(e: React.FormEvent) {
    e.preventDefault()
    if (!formF.st_id || !formF.montant_ht) return
    setSubmitting(true)
    const supabase = createClient()
    await supabase.schema('app').from('at_factures').insert({
      st_id: formF.st_id, numero_facture: formF.numero_facture || null,
      montant_ht: Number(formF.montant_ht), date_facture: formF.date_facture || null,
      notes: formF.notes || null, statut: 'a_verifier',
    })
    setFormF({ st_id: '', numero_facture: '', montant_ht: '', date_facture: '', notes: '' })
    setShowForm(false)
    setSubmitting(false)
    fetchData()
  }

  async function updateCautionStatut(id: string, statut: string) {
    const supabase = createClient()
    await supabase.schema('app').from('at_cautions').update({ statut }).eq('id', id)
    fetchData()
  }

  async function toggleFactureCheck(id: string, field: string, current: boolean) {
    const supabase = createClient()
    await supabase.schema('app').from('at_factures').update({ [field]: !current }).eq('id', id)
    fetchData()
  }

  async function validateFacture(id: string) {
    const supabase = createClient()
    await supabase.schema('app').from('at_factures').update({ statut: 'bon_a_payer' }).eq('id', id)
    fetchData()
  }

  async function refuserFacture(id: string) {
    const supabase = createClient()
    await supabase.schema('app').from('at_factures').update({ statut: 'refuse' }).eq('id', id)
    fetchData()
  }

  const stName = (id: string) => sts.find((s) => s.id === id)?.nom ?? 'Sous-traitant inconnu'

  const now = new Date()
  const cautionsAliberer = cautions.filter((c) => c.statut === 'active' && c.date_fin_gpa && new Date(c.date_fin_gpa) <= now)
  const totalCautions = cautions.filter((c) => c.statut === 'active').reduce((s, c) => s + c.montant, 0)

  return (
    <div>
      <TopBar title="Admin Financiere" subtitle="Compte prorata · Cautions · Controle factures" />

      <div className="p-6 space-y-6">
        {/* Lien compte prorata */}
        <Link href="/at/compte-prorata"
          className="flex items-center justify-between gap-3 px-4 py-3 bg-white rounded-lg border border-gray-200 shadow-card hover:border-gray-300 transition-colors group">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: '#FAEEDA', color: '#854F0B' }}>
              <Landmark className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Compte prorata</p>
              <p className="text-xs text-gray-400">Depenses d&apos;Interet Commun (<Abbr k="DIC" />) et repartition par <Abbr k="ST" /></p>
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-gray-900 transition-colors" />
        </Link>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Cautions actives</p>
            <p className="text-2xl font-semibold text-blue-600">{cautions.filter((c) => c.statut === 'active').length}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total cautionné</p>
            <p className="text-2xl font-semibold text-gray-900">{totalCautions.toLocaleString('fr-FR')} €</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Factures à vérifier</p>
            <p className={`text-2xl font-semibold ${factures.filter((f) => f.statut === 'a_verifier').length > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
              {factures.filter((f) => f.statut === 'a_verifier').length}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1"><Abbr k="GPA" /> à libérer</p>
            <p className={`text-2xl font-semibold ${cautionsAliberer.length > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{cautionsAliberer.length}</p>
          </div>
        </div>

        {/* Alerte GPA */}
        {cautionsAliberer.length > 0 && (
          <div className="bg-red-50 rounded-lg border border-red-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <p className="text-sm font-semibold text-red-700">
                {cautionsAliberer.length} caution{cautionsAliberer.length > 1 ? 's' : ''} à libérer — <Abbr k="GPA" /> terminée
              </p>
            </div>
            {cautionsAliberer.map((c) => (
              <p key={c.id} className="text-xs text-red-600">
                · {stName(c.st_id)} — {c.montant.toLocaleString('fr-FR')} € — <Abbr k="GPA" /> expirée {c.date_fin_gpa ? new Date(c.date_fin_gpa).toLocaleDateString('fr-FR') : ''}
              </p>
            ))}
          </div>
        )}

        {/* Tabs + bouton */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {([
              { value: 'factures',          label: <>Factures <Abbr k="ST" /></> },
              { value: 'prorata_cautions',  label: 'Cautions bancaires' },
            ] as Array<{ value: string; label: React.ReactNode }>).map((t) => (
              <button key={t.value} onClick={() => { setTab(t.value as typeof tab); setShowForm(false) }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.value ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors">
            <Plus className="w-4 h-4" /> {tab === 'factures' ? 'Saisir une facture' : 'Saisir une caution'}
          </button>
        </div>

        {/* FACTURES */}
        {tab === 'factures' && (
          <>
            {showForm && (
              <form onSubmit={submitFacture} className="bg-white rounded-lg border border-gray-200 shadow-card p-5 space-y-4">
                <h3 className="text-sm font-semibold text-gray-900">Nouvelle facture <Abbr k="ST" /></h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Sous-traitant *</label>
                    <select value={formF.st_id} onChange={(e) => setFormF((f) => ({ ...f, st_id: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                      <option value="">Sélectionner...</option>
                      {sts.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">N° facture</label>
                    <input type="text" value={formF.numero_facture} onChange={(e) => setFormF((f) => ({ ...f, numero_facture: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Montant <Abbr k="HT" /> (€) *</label>
                    <input type="number" value={formF.montant_ht} onChange={(e) => setFormF((f) => ({ ...f, montant_ht: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Date facture</label>
                    <input type="date" value={formF.date_facture} onChange={(e) => setFormF((f) => ({ ...f, date_facture: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                </div>
                <div className="flex gap-3 justify-end">
                  <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
                  <button type="submit" disabled={submitting || !formF.st_id || !formF.montant_ht}
                    className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50">
                    {submitting ? 'Enregistrement...' : 'Saisir'}
                  </button>
                </div>
              </form>
            )}

            {loading ? (
              <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-20 bg-white rounded-lg border border-gray-200 animate-pulse" />)}</div>
            ) : factures.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 shadow-card p-10 text-center">
                <CreditCard className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700">Aucune facture</p>
              </div>
            ) : (
              <div className="space-y-3">
                {factures.map((f) => {
                  const s = STATUT_FACTURE[f.statut]
                  const allOk = f.prorata_paye && f.montant_conforme && f.avenants_inclus
                  return (
                    <div key={f.id} className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-semibold text-gray-900">{stName(f.st_id)}</p>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${s.color}`}>{s.label}</span>
                          </div>
                          <p className="text-xs text-gray-400">
                            {f.numero_facture ?? 'Sans numéro'}
                            {f.date_facture ? ` · ${new Date(f.date_facture).toLocaleDateString('fr-FR')}` : ''}
                            {' · '}<span className="font-semibold text-gray-700">{f.montant_ht.toLocaleString('fr-FR')} € <Abbr k="HT" /></span>
                          </p>
                        </div>
                        {f.statut === 'a_verifier' && (
                          <div className="flex gap-2 flex-shrink-0">
                            <button onClick={() => validateFacture(f.id)} disabled={!allOk}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed">
                              <CheckCircle2 className="w-3 h-3" /> Bon à payer
                            </button>
                            <button onClick={() => refuserFacture(f.id)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100">
                              <X className="w-3 h-3" /> Refuser
                            </button>
                          </div>
                        )}
                      </div>
                      {/* Contrôles */}
                      {f.statut === 'a_verifier' && (
                        <div className="flex gap-4 pt-2 border-t border-gray-50">
                          {[
                            { key: 'prorata_paye', label: 'Prorata payé', val: f.prorata_paye },
                            { key: 'montant_conforme', label: 'Montant conforme', val: f.montant_conforme },
                            { key: 'avenants_inclus', label: 'Avenants inclus', val: f.avenants_inclus },
                          ].map((ctrl) => (
                            <label key={ctrl.key} className="flex items-center gap-1.5 cursor-pointer">
                              <input type="checkbox" checked={ctrl.val}
                                onChange={() => toggleFactureCheck(f.id, ctrl.key, ctrl.val)}
                                className="w-3.5 h-3.5 rounded border-gray-300 text-gray-900" />
                              <span className={`text-xs ${ctrl.val ? 'text-emerald-600 font-medium' : 'text-gray-500'}`}>{ctrl.label}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* CAUTIONS */}
        {tab === 'prorata_cautions' && (
          <>
            {showForm && (
              <form onSubmit={submitCaution} className="bg-white rounded-lg border border-gray-200 shadow-card p-5 space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Landmark className="w-4 h-4 text-gray-400" /> Nouvelle caution bancaire</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Sous-traitant *</label>
                    <select value={formC.st_id} onChange={(e) => setFormC((f) => ({ ...f, st_id: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                      <option value="">Sélectionner...</option>
                      {sts.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Banque</label>
                    <input type="text" value={formC.banque} onChange={(e) => setFormC((f) => ({ ...f, banque: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Montant (€) *</label>
                    <input type="number" value={formC.montant} onChange={(e) => setFormC((f) => ({ ...f, montant: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Date émission</label>
                    <input type="date" value={formC.date_emission} onChange={(e) => setFormC((f) => ({ ...f, date_emission: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Date fin <Abbr k="GPA" /></label>
                    <input type="date" value={formC.date_fin_gpa} onChange={(e) => setFormC((f) => ({ ...f, date_fin_gpa: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                </div>
                <div className="flex gap-3 justify-end">
                  <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
                  <button type="submit" disabled={submitting || !formC.st_id || !formC.montant}
                    className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50">
                    {submitting ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            )}

            {loading ? (
              <div className="space-y-2">{[1,2].map((i) => <div key={i} className="h-16 bg-white rounded-lg border border-gray-200 animate-pulse" />)}</div>
            ) : cautions.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 shadow-card p-10 text-center">
                <Euro className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700">Aucune caution enregistrée</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cautions.map((c) => {
                  const s = STATUT_CAUTION[c.statut]
                  const gpaPast = c.date_fin_gpa && new Date(c.date_fin_gpa) <= now && c.statut === 'active'
                  return (
                    <div key={c.id} className={`bg-white rounded-lg border shadow-card p-4 ${gpaPast ? 'border-red-200' : 'border-gray-200'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-semibold text-gray-900">{stName(c.st_id)}</p>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${s.color}`}>{s.label}</span>
                            {gpaPast && <span className="text-xs font-medium text-red-600">⚠ À libérer</span>}
                          </div>
                          <p className="text-xs text-gray-400">
                            {c.banque ? `${c.banque} · ` : ''}<span className="font-semibold text-gray-700">{c.montant.toLocaleString('fr-FR')} €</span>
                            {c.date_emission ? ` · Émise ${new Date(c.date_emission).toLocaleDateString('fr-FR')}` : ''}
                            {c.date_fin_gpa ? <> · <Abbr k="GPA" /> {new Date(c.date_fin_gpa).toLocaleDateString('fr-FR')}</> : ''}
                          </p>
                        </div>
                        {c.statut === 'active' && (
                          <button onClick={() => updateCautionStatut(c.id, 'liberee')}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 flex-shrink-0">
                            <CheckCircle2 className="w-3 h-3" /> Libérer
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
