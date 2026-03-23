'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'
import {
  CheckCircle, Clock, AlertTriangle, XCircle,
  ChevronRight, Plus, X, Euro, Shield, FileCheck,
  Building2, Calendar, Banknote, Lock, Unlock
} from 'lucide-react'

/* ── Types ─────────────────────────────────────────────── */
type Facture = {
  id: string
  st_nom: string
  projet_nom: string
  numero_facture: string
  montant_ht: number
  mois: string
  prorata_paye: boolean
  montant_conforme: boolean
  avenants_inclus: boolean
  statut: 'a_verifier' | 'bon_a_payer' | 'refuse' | 'paye'
  created_at: string
}

type Caution = {
  id: string
  st_nom: string
  projet_nom: string
  banque: string
  montant: number
  date_emission: string
  date_fin_gpa: string
  statut: 'active' | 'liberee' | 'expiree'
  created_at: string
}

/* ── Helpers ────────────────────────────────────────────── */
const STATUT_FACTURE: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  a_verifier: { label: 'À vérifier',  color: 'bg-amber-100 text-amber-700',  icon: <Clock className="w-3 h-3" /> },
  bon_a_payer: { label: 'Bon à payer', color: 'bg-blue-100 text-blue-700',   icon: <CheckCircle className="w-3 h-3" /> },
  refuse:      { label: 'Refusée',     color: 'bg-red-100 text-red-700',     icon: <XCircle className="w-3 h-3" /> },
  paye:        { label: 'Payée',       color: 'bg-green-100 text-green-700', icon: <CheckCircle className="w-3 h-3" /> },
}

const STATUT_CAUTION: Record<string, { label: string; color: string }> = {
  active:   { label: 'Active',   color: 'bg-green-100 text-green-700' },
  liberee:  { label: 'Libérée',  color: 'bg-gray-100 text-gray-600'   },
  expiree:  { label: 'Expirée',  color: 'bg-red-100 text-red-700'     },
}

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / 86400000)
}

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

/* ── Form defaults ──────────────────────────────────────── */
const EMPTY_FAC: Omit<Facture, 'id' | 'created_at'> = {
  st_nom: '', projet_nom: '', numero_facture: '', montant_ht: 0,
  mois: new Date().toISOString().slice(0, 7),
  prorata_paye: false, montant_conforme: false, avenants_inclus: false,
  statut: 'a_verifier',
}

const EMPTY_CAU: Omit<Caution, 'id' | 'created_at'> = {
  st_nom: '', projet_nom: '', banque: '', montant: 0,
  date_emission: new Date().toISOString().slice(0, 10),
  date_fin_gpa: '',
  statut: 'active',
}

/* ═══════════════════════════════════════════════════════ */
export default function GestionSTPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<'factures' | 'cautions'>('factures')

  /* ── Factures state ─────────────────────────────────── */
  const [factures, setFactures]     = useState<Facture[]>([])
  const [selFac, setSelFac]         = useState<Facture | null>(null)
  const [showFacForm, setShowFacForm] = useState(false)
  const [facForm, setFacForm]       = useState<Omit<Facture,'id'|'created_at'>>(EMPTY_FAC)
  const [filterFac, setFilterFac]   = useState<string>('tous')
  const [loadingFac, setLoadingFac] = useState(true)

  /* ── Cautions state ─────────────────────────────────── */
  const [cautions, setCautions]     = useState<Caution[]>([])
  const [selCau, setSelCau]         = useState<Caution | null>(null)
  const [showCauForm, setShowCauForm] = useState(false)
  const [cauForm, setCauForm]       = useState<Omit<Caution,'id'|'created_at'>>(EMPTY_CAU)
  const [loadingCau, setLoadingCau] = useState(true)

  /* ── Fetch ──────────────────────────────────────────── */
  async function fetchFactures() {
    setLoadingFac(true)
    const { data } = await supabase.schema('app').from('at_factures').select('*').order('created_at', { ascending: false })
    setFactures((data as Facture[]) ?? [])
    setLoadingFac(false)
  }

  async function fetchCautions() {
    setLoadingCau(true)
    const { data } = await supabase.schema('app').from('compta_cautions').select('*').order('created_at', { ascending: false })
    setCautions((data as Caution[]) ?? [])
    setLoadingCau(false)
  }

  useEffect(() => { fetchFactures(); fetchCautions() }, [])

  /* ── Facture actions ────────────────────────────────── */
  async function saveFacture() {
    const payload = { ...facForm }
    if (payload.prorata_paye && payload.montant_conforme && payload.avenants_inclus) {
      payload.statut = 'bon_a_payer'
    }
    await supabase.schema('app').from('at_factures').insert([payload])
    setShowFacForm(false); setFacForm(EMPTY_FAC); fetchFactures()
  }

  async function updateCheck(id: string, field: 'prorata_paye' | 'montant_conforme' | 'avenants_inclus', val: boolean) {
    const fac = factures.find(f => f.id === id)!
    const updated = { ...fac, [field]: val }
    const newStatut = (updated.prorata_paye && updated.montant_conforme && updated.avenants_inclus)
      ? 'bon_a_payer' : 'a_verifier'
    await supabase.schema('app').from('at_factures').update({ [field]: val, statut: newStatut }).eq('id', id)
    fetchFactures()
    if (selFac?.id === id) setSelFac({ ...selFac, [field]: val, statut: newStatut as Facture['statut'] })
  }

  async function refuserFacture(id: string) {
    await supabase.schema('app').from('at_factures').update({ statut: 'refuse' }).eq('id', id)
    fetchFactures()
    if (selFac?.id === id) setSelFac({ ...selFac, statut: 'refuse' })
  }

  async function marquerPayee(id: string) {
    await supabase.schema('app').from('at_factures').update({ statut: 'paye' }).eq('id', id)
    fetchFactures()
    if (selFac?.id === id) setSelFac({ ...selFac, statut: 'paye' })
  }

  async function deleteFacture(id: string) {
    await supabase.schema('app').from('at_factures').delete().eq('id', id)
    if (selFac?.id === id) setSelFac(null)
    fetchFactures()
  }

  /* ── Caution actions ────────────────────────────────── */
  async function saveCaution() {
    await supabase.schema('app').from('compta_cautions').insert([cauForm])
    setShowCauForm(false); setCauForm(EMPTY_CAU); fetchCautions()
  }

  async function libererCaution(id: string) {
    await supabase.schema('app').from('compta_cautions').update({ statut: 'liberee' }).eq('id', id)
    fetchCautions()
    if (selCau?.id === id) setSelCau({ ...selCau, statut: 'liberee' })
  }

  async function deleteCaution(id: string) {
    await supabase.schema('app').from('compta_cautions').delete().eq('id', id)
    if (selCau?.id === id) setSelCau(null)
    fetchCautions()
  }

  /* ── Computed ────────────────────────────────────────── */
  const filteredFac = filterFac === 'tous' ? factures : factures.filter(f => f.statut === filterFac)
  const cautionsAlert = cautions.filter(c => c.statut === 'active' && c.date_fin_gpa && daysUntil(c.date_fin_gpa) <= 30)
  const totalBap = factures.filter(f => f.statut === 'bon_a_payer').reduce((s, f) => s + (f.montant_ht ?? 0), 0)
  const totalCautions = cautions.filter(c => c.statut === 'active').reduce((s, c) => s + (c.montant ?? 0), 0)

  /* ─────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar title="Gestion ST" subtitle="Suivi des sous-traitants — factures et cautions" />

      {/* Alerts */}
      {cautionsAlert.length > 0 && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700">
            <span className="font-semibold">{cautionsAlert.length} caution(s)</span> arrivent à expiration GPA dans moins de 30 jours.
          </p>
        </div>
      )}

      {/* Summary cards */}
      <div className="px-6 pt-4 grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <FileCheck className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Factures Bon à payer</p>
            <p className="text-xl font-bold text-gray-900">{fmt(totalBap)}</p>
            <p className="text-xs text-gray-400">{factures.filter(f => f.statut === 'bon_a_payer').length} facture(s)</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
            <Shield className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Cautions actives</p>
            <p className="text-xl font-bold text-gray-900">{fmt(totalCautions)}</p>
            <p className="text-xs text-gray-400">{cautions.filter(c => c.statut === 'active').length} caution(s)</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-5">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
          {(['factures', 'cautions'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t === 'factures' ? 'Factures ST' : 'Cautions bancaires'}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB: FACTURES ─────────────────────────────────── */}
      {tab === 'factures' && (
        <div className="px-6 pt-4 pb-8 flex gap-4">
          {/* List */}
          <div className="w-80 flex-shrink-0 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Factures ST</h3>
              <button onClick={() => { setShowFacForm(true); setFacForm(EMPTY_FAC) }}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-700">
                <Plus className="w-3 h-3" /> Nouvelle
              </button>
            </div>

            {/* Filter pills */}
            <div className="flex gap-1 flex-wrap">
              {['tous', 'a_verifier', 'bon_a_payer', 'refuse', 'paye'].map(s => (
                <button key={s} onClick={() => setFilterFac(s)}
                  className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                    filterFac === s ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}>
                  {s === 'tous' ? 'Tous' : STATUT_FACTURE[s]?.label}
                </button>
              ))}
            </div>

            {loadingFac ? (
              <p className="text-sm text-gray-400 text-center py-8">Chargement…</p>
            ) : filteredFac.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Aucune facture</p>
            ) : (
              <div className="space-y-2">
                {filteredFac.map(f => {
                  const s = STATUT_FACTURE[f.statut]
                  return (
                    <button key={f.id} onClick={() => setSelFac(f)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        selFac?.id === f.id
                          ? 'border-gray-900 bg-gray-50 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{f.st_nom}</p>
                          <p className="text-xs text-gray-500 truncate">{f.projet_nom}</p>
                          <p className="text-xs text-gray-400 mt-1">{f.numero_facture} · {f.mois}</p>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="text-sm font-bold text-gray-900">{fmt(f.montant_ht)}</p>
                          <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium ${s.color}`}>
                            {s.icon} {s.label}
                          </span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Detail */}
          <div className="flex-1">
            {showFacForm ? (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900">Nouvelle facture ST</h3>
                  <button onClick={() => setShowFacForm(false)}><X className="w-4 h-4 text-gray-400" /></button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Sous-traitant', key: 'st_nom' },
                    { label: 'Projet', key: 'projet_nom' },
                    { label: 'N° Facture', key: 'numero_facture' },
                    { label: 'Mois', key: 'mois', type: 'month' },
                  ].map(({ label, key, type }) => (
                    <div key={key}>
                      <label className="block text-xs text-gray-500 mb-1">{label}</label>
                      <input type={type ?? 'text'} value={(facForm as any)[key]}
                        onChange={e => setFacForm({ ...facForm, [key]: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Montant HT (€)</label>
                    <input type="number" value={facForm.montant_ht}
                      onChange={e => setFacForm({ ...facForm, montant_ht: +e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-medium text-gray-700">Contrôles de conformité</p>
                  {[
                    { key: 'prorata_paye', label: 'Prorata temporis payé' },
                    { key: 'montant_conforme', label: 'Montant conforme au marché' },
                    { key: 'avenants_inclus', label: 'Avenants inclus' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={(facForm as any)[key]}
                        onChange={e => setFacForm({ ...facForm, [key]: e.target.checked })}
                        className="w-4 h-4 rounded" />
                      <span className="text-sm text-gray-700">{label}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-4 flex gap-2 justify-end">
                  <button onClick={() => setShowFacForm(false)} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Annuler</button>
                  <button onClick={saveFacture} disabled={!facForm.st_nom || !facForm.numero_facture}
                    className="px-4 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40">
                    Enregistrer
                  </button>
                </div>
              </div>
            ) : selFac ? (
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">{selFac.st_nom}</h3>
                    <p className="text-sm text-gray-500">{selFac.projet_nom} · {selFac.numero_facture}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${STATUT_FACTURE[selFac.statut].color}`}>
                      {STATUT_FACTURE[selFac.statut].icon} {STATUT_FACTURE[selFac.statut].label}
                    </span>
                    <button onClick={() => deleteFacture(selFac.id)} className="p-1 text-gray-400 hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Amount */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Euro className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Montant HT</p>
                    <p className="text-xl font-bold text-gray-900">{fmt(selFac.montant_ht)}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-xs text-gray-500">Mois</p>
                    <p className="text-sm font-semibold text-gray-700">{selFac.mois}</p>
                  </div>
                </div>

                {/* Contrôles */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Contrôles de conformité</p>
                  <div className="space-y-3">
                    {[
                      { key: 'prorata_paye' as const,     label: 'Prorata temporis payé',       desc: 'Vérification du calcul au prorata' },
                      { key: 'montant_conforme' as const,  label: 'Montant conforme au marché',  desc: 'Contrôle avec le marché et les avenants' },
                      { key: 'avenants_inclus' as const,   label: 'Avenants inclus',             desc: 'Tous les avenants signés sont intégrés' },
                    ].map(({ key, label, desc }) => {
                      const checked = selFac[key]
                      return (
                        <label key={key} className="flex items-center gap-3 cursor-pointer group">
                          <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors flex-shrink-0 ${
                            checked ? 'bg-teal-600 border-teal-600' : 'border-gray-300 group-hover:border-teal-400'
                          }`}
                            onClick={() => updateCheck(selFac.id, key, !checked)}>
                            {checked && <CheckCircle className="w-3 h-3 text-white" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800">{label}</p>
                            <p className="text-xs text-gray-400">{desc}</p>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>

                {/* Progress */}
                {(() => {
                  const done = [selFac.prorata_paye, selFac.montant_conforme, selFac.avenants_inclus].filter(Boolean).length
                  const all  = done === 3
                  return (
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Conformité</span>
                        <span>{done}/3 contrôles</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${all ? 'bg-teal-500' : 'bg-amber-400'}`}
                          style={{ width: `${(done / 3) * 100}%` }} />
                      </div>
                    </div>
                  )
                })()}

                {/* Actions */}
                {selFac.statut !== 'paye' && selFac.statut !== 'refuse' && (
                  <div className="flex gap-2">
                    <button onClick={() => refuserFacture(selFac.id)}
                      className="flex-1 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
                      Refuser
                    </button>
                    {selFac.statut === 'bon_a_payer' && (
                      <button onClick={() => marquerPayee(selFac.id)}
                        className="flex-1 px-3 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center justify-center gap-1">
                        <CheckCircle className="w-4 h-4" /> Marquer payée
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 h-64 flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <FileCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Sélectionnez une facture</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: CAUTIONS ─────────────────────────────────── */}
      {tab === 'cautions' && (
        <div className="px-6 pt-4 pb-8 flex gap-4">
          {/* List */}
          <div className="w-80 flex-shrink-0 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Registre des cautions</h3>
              <button onClick={() => { setShowCauForm(true); setCauForm(EMPTY_CAU) }}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-700">
                <Plus className="w-3 h-3" /> Nouvelle
              </button>
            </div>

            {loadingCau ? (
              <p className="text-sm text-gray-400 text-center py-8">Chargement…</p>
            ) : cautions.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Aucune caution</p>
            ) : (
              <div className="space-y-2">
                {cautions.map(c => {
                  const days = c.date_fin_gpa ? daysUntil(c.date_fin_gpa) : null
                  const alert = c.statut === 'active' && days !== null && days <= 30
                  return (
                    <button key={c.id} onClick={() => setSelCau(c)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        selCau?.id === c.id
                          ? 'border-gray-900 bg-gray-50 shadow-sm'
                          : alert
                          ? 'border-red-200 bg-red-50 hover:border-red-300'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{c.st_nom}</p>
                          <p className="text-xs text-gray-500 truncate">{c.projet_nom}</p>
                          <p className="text-xs text-gray-400 mt-1">{c.banque}</p>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="text-sm font-bold text-gray-900">{fmt(c.montant)}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUT_CAUTION[c.statut].color}`}>
                            {STATUT_CAUTION[c.statut].label}
                          </span>
                          {alert && <p className="text-xs text-red-600 font-semibold mt-0.5">GPA J-{days}</p>}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Detail / Form */}
          <div className="flex-1">
            {showCauForm ? (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900">Nouvelle caution bancaire</h3>
                  <button onClick={() => setShowCauForm(false)}><X className="w-4 h-4 text-gray-400" /></button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Sous-traitant', key: 'st_nom' },
                    { label: 'Projet', key: 'projet_nom' },
                    { label: 'Banque', key: 'banque' },
                    { label: 'Date émission', key: 'date_emission', type: 'date' },
                    { label: 'Date fin GPA', key: 'date_fin_gpa', type: 'date' },
                  ].map(({ label, key, type }) => (
                    <div key={key}>
                      <label className="block text-xs text-gray-500 mb-1">{label}</label>
                      <input type={type ?? 'text'} value={(cauForm as any)[key]}
                        onChange={e => setCauForm({ ...cauForm, [key]: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Montant (€)</label>
                    <input type="number" value={cauForm.montant}
                      onChange={e => setCauForm({ ...cauForm, montant: +e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                </div>
                <div className="mt-4 flex gap-2 justify-end">
                  <button onClick={() => setShowCauForm(false)} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Annuler</button>
                  <button onClick={saveCaution} disabled={!cauForm.st_nom || !cauForm.banque}
                    className="px-4 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40">
                    Enregistrer
                  </button>
                </div>
              </div>
            ) : selCau ? (
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">{selCau.st_nom}</h3>
                    <p className="text-sm text-gray-500">{selCau.projet_nom}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUT_CAUTION[selCau.statut].color}`}>
                      {STATUT_CAUTION[selCau.statut].label}
                    </span>
                    <button onClick={() => deleteCaution(selCau.id)} className="p-1 text-gray-400 hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg flex items-center gap-3">
                    <Banknote className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Montant</p>
                      <p className="text-lg font-bold text-gray-900">{fmt(selCau.montant)}</p>
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Banque</p>
                      <p className="text-sm font-semibold text-gray-900">{selCau.banque}</p>
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Date émission</p>
                      <p className="text-sm font-semibold text-gray-900">{selCau.date_emission}</p>
                    </div>
                  </div>
                  <div className={`p-3 rounded-lg flex items-center gap-3 ${
                    selCau.date_fin_gpa && selCau.statut === 'active' && daysUntil(selCau.date_fin_gpa) <= 30
                      ? 'bg-red-50 border border-red-200'
                      : 'bg-gray-50'
                  }`}>
                    <Calendar className={`w-5 h-5 ${
                      selCau.date_fin_gpa && selCau.statut === 'active' && daysUntil(selCau.date_fin_gpa) <= 30
                        ? 'text-red-400' : 'text-gray-400'
                    }`} />
                    <div>
                      <p className="text-xs text-gray-500">Fin GPA</p>
                      <p className={`text-sm font-semibold ${
                        selCau.date_fin_gpa && selCau.statut === 'active' && daysUntil(selCau.date_fin_gpa) <= 30
                          ? 'text-red-700' : 'text-gray-900'
                      }`}>{selCau.date_fin_gpa || '—'}</p>
                      {selCau.date_fin_gpa && selCau.statut === 'active' && (
                        <p className={`text-xs font-medium ${daysUntil(selCau.date_fin_gpa) <= 30 ? 'text-red-600' : 'text-gray-400'}`}>
                          J{daysUntil(selCau.date_fin_gpa) >= 0 ? `-${daysUntil(selCau.date_fin_gpa)}` : `+${Math.abs(daysUntil(selCau.date_fin_gpa))}`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* GPA alert */}
                {selCau.date_fin_gpa && selCau.statut === 'active' && daysUntil(selCau.date_fin_gpa) <= 30 && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-700">
                      La période de garantie arrive à échéance dans <strong>{Math.max(0, daysUntil(selCau.date_fin_gpa))} jour(s)</strong>.
                      Procéder à la libération si les conditions sont remplies.
                    </p>
                  </div>
                )}

                {/* Action */}
                {selCau.statut === 'active' && (
                  <button onClick={() => libererCaution(selCau.id)}
                    className="w-full flex items-center justify-center gap-2 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700">
                    <Unlock className="w-4 h-4" /> Libérer la caution
                  </button>
                )}
                {selCau.statut === 'liberee' && (
                  <div className="flex items-center justify-center gap-2 py-2 text-sm text-gray-500 bg-gray-50 rounded-lg">
                    <Lock className="w-4 h-4" /> Caution libérée
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 h-64 flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <Shield className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Sélectionnez une caution</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
