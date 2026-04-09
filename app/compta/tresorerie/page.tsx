'use client'

import { useEffect, useMemo, useState } from 'react'
import { Calculator, Loader2, Save, Lock, AlertTriangle, CheckCircle2, Banknote } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'

type Rapprochement = {
  id: string
  mois: string
  solde_banque: number | null
  solde_comptable: number | null
  ecart: number | null
  statut: string
  factures_manquantes: string | null
  tva_previsionnelle: number | null
  date_cloture: string | null
}

type Revenu = {
  montant_ht: number
  tva_pct: number
  date_encaissement: string | null
  statut: string
}
type Depense = {
  montant_ht: number
  tva_pct: number
  date_paiement: string | null
  statut: string
}

function moisCourant() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function moisToDate(m: string) { return `${m}-01` }
function formatMois(m: string) {
  const [y, mo] = m.split('-')
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}
function fmt(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €'
}
function isInMonth(date: string | null, mois: string) {
  if (!date) return false
  return date.slice(0, 7) === mois
}

export default function TresoreriePage() {
  const supabase = createClient()
  const [mois, setMois] = useState(moisCourant())
  const [rapp, setRapp] = useState<Rapprochement | null>(null)
  const [revenus, setRevenus] = useState<Revenu[]>([])
  const [depenses, setDepenses] = useState<Depense[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state
  const [soldeBanque, setSoldeBanque] = useState('')
  const [facturesManquantes, setFacturesManquantes] = useState('')

  async function load() {
    setLoading(true)
    const [rRes, revRes, depRes] = await Promise.all([
      supabase.from('rapprochements').select('*').eq('mois', moisToDate(mois)).maybeSingle(),
      supabase.from('revenus').select('montant_ht,tva_pct,date_encaissement,statut'),
      supabase.from('depenses').select('montant_ht,tva_pct,date_paiement,statut'),
    ])

    const r = rRes.data as Rapprochement | null
    setRapp(r)
    setSoldeBanque(r?.solde_banque ? String(r.solde_banque) : '')
    setFacturesManquantes(r?.factures_manquantes ?? '')
    setRevenus((revRes.data ?? []) as Revenu[])
    setDepenses((depRes.data ?? []) as Depense[])
    setLoading(false)
  }

  useEffect(() => { load() /* eslint-disable-next-line */ }, [mois])

  // Solde comptable = SUM(revenus encaissés du mois) - SUM(dépenses payées du mois)
  const soldeComptable = useMemo(() => {
    const encaisse = revenus
      .filter(r => r.statut === 'encaisse' && isInMonth(r.date_encaissement, mois))
      .reduce((s, r) => s + Number(r.montant_ht), 0)
    const paye = depenses
      .filter(d => d.statut === 'paye' && isInMonth(d.date_paiement, mois))
      .reduce((s, d) => s + Number(d.montant_ht), 0)
    return encaisse - paye
  }, [revenus, depenses, mois])

  const ecart = useMemo(() => {
    const sb = Number(soldeBanque) || 0
    return sb - soldeComptable
  }, [soldeBanque, soldeComptable])

  // TVA prévisionnelle
  const tvaCollectee = useMemo(() => revenus
    .filter(r => r.statut === 'encaisse' && isInMonth(r.date_encaissement, mois))
    .reduce((s, r) => s + (Number(r.montant_ht) * Number(r.tva_pct) / 100), 0)
  , [revenus, mois])

  const tvaDeductible = useMemo(() => depenses
    .filter(d => d.statut === 'paye' && isInMonth(d.date_paiement, mois))
    .reduce((s, d) => s + (Number(d.montant_ht) * Number(d.tva_pct) / 100), 0)
  , [depenses, mois])

  const tvaAPayer = tvaCollectee - tvaDeductible

  async function saveRapprochement(cloturer = false) {
    setSaving(true)
    const payload = {
      mois: moisToDate(mois),
      solde_banque: Number(soldeBanque) || 0,
      solde_comptable: soldeComptable,
      ecart,
      factures_manquantes: facturesManquantes || null,
      statut: cloturer ? 'cloture' : 'en_cours',
      ...(cloturer ? { date_cloture: new Date().toISOString().slice(0, 10) } : {}),
    }
    const { error } = rapp
      ? await supabase.from('rapprochements').update(payload).eq('id', rapp.id)
      : await supabase.from('rapprochements').insert(payload)
    setSaving(false)
    if (!error) load()
  }

  async function saveTvaEstimation() {
    setSaving(true)
    const payload = {
      mois: moisToDate(mois),
      tva_previsionnelle: tvaAPayer,
      statut: rapp?.statut ?? 'en_cours',
    }
    const { error } = rapp
      ? await supabase.from('rapprochements').update({ tva_previsionnelle: tvaAPayer }).eq('id', rapp.id)
      : await supabase.from('rapprochements').insert(payload)
    setSaving(false)
    if (!error) load()
  }

  const isCloture = rapp?.statut === 'cloture'

  return (
    <div>
      <TopBar title="Trésorerie" subtitle="Rapprochement bancaire et TVA prévisionnelle" />
      <div className="p-6 space-y-6">

        {/* Sélecteur mois */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-medium text-gray-600">Mois</label>
          <input
            type="month"
            value={mois}
            onChange={(e) => setMois(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white"
          />
          <span className="text-sm text-gray-500 capitalize">{formatMois(mois)}</span>
          {isCloture && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Lock className="w-3 h-3" /> Mois clôturé
            </span>
          )}
        </div>

        {loading ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Loader2 className="w-6 h-6 text-gray-400 mx-auto animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* RAPPROCHEMENT BANCAIRE */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                <Banknote className="w-4 h-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-900">Rapprochement bancaire</h2>
              </div>
              <div className="p-5 space-y-4">
                <Field label="Solde du relevé bancaire (€)">
                  <input
                    type="number"
                    step="0.01"
                    value={soldeBanque}
                    onChange={(e) => setSoldeBanque(e.target.value)}
                    disabled={isCloture}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 disabled:bg-gray-50"
                  />
                </Field>

                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Solde comptable calculé</span>
                    <span className="font-semibold text-gray-900">{fmt(soldeComptable)}</span>
                  </div>
                  <p className="text-[10px] text-gray-400">Σ encaissements - Σ dépenses payées du mois</p>
                </div>

                <div className={`rounded-lg p-3 border ${
                  Math.abs(ecart) < 0.01
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-amber-50 border-amber-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${Math.abs(ecart) < 0.01 ? 'text-emerald-700' : 'text-amber-700'}`}>
                      Écart
                    </span>
                    <span className={`text-lg font-bold ${Math.abs(ecart) < 0.01 ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {ecart >= 0 ? '+' : ''}{fmt(ecart)}
                    </span>
                  </div>
                  {Math.abs(ecart) < 0.01 && (
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] text-emerald-600">
                      <CheckCircle2 className="w-3 h-3" /> Comptes équilibrés
                    </div>
                  )}
                </div>

                {Math.abs(ecart) >= 0.01 && (
                  <Field label="Factures manquantes / notes">
                    <textarea
                      rows={3}
                      value={facturesManquantes}
                      onChange={(e) => setFacturesManquantes(e.target.value)}
                      disabled={isCloture}
                      placeholder="Lister les factures à intégrer pour expliquer l'écart..."
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-900/10 disabled:bg-gray-50"
                    />
                  </Field>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => saveRapprochement(false)}
                    disabled={saving || isCloture}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Enregistrer
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Clôturer le mois ? Cette action verrouille la saisie.')) {
                        saveRapprochement(true)
                      }
                    }}
                    disabled={saving || isCloture}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-40"
                  >
                    <Lock className="w-4 h-4" />
                    Clôturer le mois
                  </button>
                </div>
              </div>
            </div>

            {/* TVA PREVISIONNELLE */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-900">Estimation TVA prévisionnelle</h2>
              </div>
              <div className="p-5 space-y-4">

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-blue-700">TVA collectée</span>
                    <span className="text-sm font-semibold text-blue-900">{fmt(tvaCollectee)}</span>
                  </div>
                  <p className="text-[10px] text-blue-500 mt-0.5">Sur revenus encaissés du mois</p>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-amber-700">TVA déductible</span>
                    <span className="text-sm font-semibold text-amber-900">{fmt(tvaDeductible)}</span>
                  </div>
                  <p className="text-[10px] text-amber-500 mt-0.5">Sur dépenses payées du mois</p>
                </div>

                <div className={`rounded-lg p-4 border-2 ${
                  tvaAPayer >= 0 ? 'bg-gray-900 border-gray-900 text-white' : 'bg-emerald-50 border-emerald-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${tvaAPayer >= 0 ? 'text-gray-300' : 'text-emerald-700'}`}>
                      {tvaAPayer >= 0 ? 'TVA à payer' : 'Crédit de TVA'}
                    </span>
                    <span className={`text-2xl font-bold ${tvaAPayer >= 0 ? 'text-white' : 'text-emerald-700'}`}>
                      {fmt(Math.abs(tvaAPayer))}
                    </span>
                  </div>
                </div>

                {rapp?.tva_previsionnelle != null && (
                  <p className="text-[11px] text-gray-400">
                    Dernière estimation enregistrée : <span className="font-medium text-gray-600">{fmt(Number(rapp.tva_previsionnelle))}</span>
                  </p>
                )}

                <button
                  onClick={saveTvaEstimation}
                  disabled={saving || isCloture}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-40"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Sauvegarder l&apos;estimation
                </button>

                {Math.abs(tvaAPayer) > 5000 && (
                  <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>Montant de TVA significatif : pensez à provisionner la trésorerie.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
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
