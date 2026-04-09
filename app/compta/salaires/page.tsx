'use client'

import { useEffect, useMemo, useState } from 'react'
import { BadgeEuro, Loader2, Save, Check, Wand2, CheckCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'

type Employe = { id: string; nom: string; prenom: string; poste: string | null; actif: boolean }
type Salaire = {
  id: string
  employe_id: string
  mois: string
  salaire_brut: number
  charges_patronales: number
  net_a_payer: number
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

type Row = {
  employe_id: string
  brut: string
  charges: string
  net: string
  existing: Salaire | null
  saving?: boolean
  saved?: boolean
}

export default function SalairesPage() {
  const supabase = createClient()
  const [mois, setMois] = useState(moisCourant())
  const [employes, setEmployes] = useState<Employe[]>([])
  const [rows, setRows] = useState<Record<string, Row>>({})
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [paying, setPaying] = useState(false)

  async function load() {
    setLoading(true)
    const [eRes, sRes] = await Promise.all([
      supabase.from('employes').select('*').eq('actif', true).order('nom'),
      supabase.from('salaires').select('*').eq('mois', moisToDate(mois)),
    ])
    const emps = (eRes.data ?? []) as Employe[]
    const sals = (sRes.data ?? []) as Salaire[]
    setEmployes(emps)

    const next: Record<string, Row> = {}
    emps.forEach(e => {
      const existing = sals.find(s => s.employe_id === e.id) ?? null
      next[e.id] = {
        employe_id: e.id,
        brut:    existing ? String(existing.salaire_brut) : '',
        charges: existing ? String(existing.charges_patronales) : '',
        net:     existing ? String(existing.net_a_payer) : '',
        existing,
      }
    })
    setRows(next)
    setLoading(false)
  }

  useEffect(() => { load() /* eslint-disable-next-line */ }, [mois])

  function updateRow(id: string, patch: Partial<Row>) {
    setRows(r => ({ ...r, [id]: { ...r[id], ...patch, saved: false } }))
  }

  async function saveRow(id: string) {
    const row = rows[id]
    if (!row.brut || !row.net) return
    updateRow(id, { saving: true })

    const payload = {
      employe_id: id,
      mois: moisToDate(mois),
      salaire_brut: Number(row.brut),
      charges_patronales: Number(row.charges || 0),
      net_a_payer: Number(row.net),
      statut: row.existing?.statut ?? 'en_attente',
    }

    const { error } = row.existing
      ? await supabase.from('salaires').update(payload).eq('id', row.existing.id)
      : await supabase.from('salaires').insert(payload)

    updateRow(id, { saving: false, saved: !error })
    if (!error) load()
  }

  // Generer le mois : pre-remplit les lignes manquantes
  async function genererMois() {
    setGenerating(true)
    const aCreer = employes.filter(e => !rows[e.id]?.existing)
    if (aCreer.length === 0) {
      setGenerating(false)
      return
    }
    const payload = aCreer.map(e => ({
      employe_id: e.id,
      mois: moisToDate(mois),
      salaire_brut: 0,
      charges_patronales: 0,
      net_a_payer: 0,
      statut: 'en_attente',
    }))
    await supabase.from('salaires').insert(payload)
    setGenerating(false)
    load()
  }

  // Tout marquer paye
  async function toutMarquerPaye() {
    if (!confirm('Marquer tous les salaires du mois comme payés ?')) return
    setPaying(true)
    const today = new Date().toISOString().slice(0, 10)
    const ids = Object.values(rows).map(r => r.existing?.id).filter(Boolean) as string[]
    if (ids.length === 0) {
      setPaying(false)
      return
    }
    await supabase.from('salaires')
      .update({ statut: 'paye', date_paiement: today })
      .in('id', ids)
    setPaying(false)
    load()
  }

  const totalBrut = useMemo(
    () => Object.values(rows).reduce((s, r) => s + (Number(r.brut) || 0), 0),
    [rows]
  )
  const totalCharges = useMemo(
    () => Object.values(rows).reduce((s, r) => s + (Number(r.charges) || 0), 0),
    [rows]
  )
  const totalNet = useMemo(
    () => Object.values(rows).reduce((s, r) => s + (Number(r.net) || 0), 0),
    [rows]
  )
  const totalMasse = totalBrut + totalCharges

  const nbExistants = Object.values(rows).filter(r => r.existing).length
  const nbAttente = Object.values(rows).filter(r => r.existing?.statut !== 'paye' && r.existing).length

  return (
    <div>
      <TopBar title="Salaires" subtitle="Saisie mensuelle des paies par employé" />
      <div className="p-6 space-y-6">

        {/* Header : mois + actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-gray-600">Mois</label>
            <input
              type="month"
              value={mois}
              onChange={(e) => setMois(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white"
            />
            <span className="text-sm text-gray-500 capitalize">{formatMois(mois)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={genererMois}
              disabled={generating || loading || nbExistants === employes.length}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-40"
              title="Pre-remplit les lignes manquantes pour les employes actifs"
            >
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              Générer le mois
            </button>
            <button
              onClick={toutMarquerPaye}
              disabled={paying || nbAttente === 0}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40"
            >
              {paying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
              Tout marquer payé
            </button>
          </div>
        </div>

        {/* Tableau */}
        {loading ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Loader2 className="w-6 h-6 text-gray-400 mx-auto animate-spin" />
          </div>
        ) : employes.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <BadgeEuro className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">Aucun employé actif</p>
            <p className="text-xs text-gray-400 mt-1">Ajoutez des employés dans la table employes pour démarrer.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-left text-xs font-medium text-gray-500">
                  <th className="px-4 py-3">Employé</th>
                  <th className="px-4 py-3">Poste</th>
                  <th className="px-4 py-3 text-right">Brut (€)</th>
                  <th className="px-4 py-3 text-right">Charges (€)</th>
                  <th className="px-4 py-3 text-right">Net (€)</th>
                  <th className="px-4 py-3 text-right">Statut</th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {employes.map(e => {
                  const row = rows[e.id]
                  if (!row) return null
                  return (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{e.prenom} {e.nom}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{e.poste ?? '—'}</td>
                      <td className="px-4 py-3">
                        <input
                          type="number" step="0.01" value={row.brut}
                          onChange={(ev) => updateRow(e.id, { brut: ev.target.value })}
                          className="w-28 text-right border border-gray-200 rounded px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number" step="0.01" value={row.charges}
                          onChange={(ev) => updateRow(e.id, { charges: ev.target.value })}
                          className="w-28 text-right border border-gray-200 rounded px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number" step="0.01" value={row.net}
                          onChange={(ev) => updateRow(e.id, { net: ev.target.value })}
                          className="w-28 text-right border border-gray-200 rounded px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          row.existing?.statut === 'paye'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}>
                          {row.existing?.statut === 'paye' ? 'Payé' : 'En attente'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => saveRow(e.id)}
                          disabled={row.saving || !row.brut}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-900 text-white rounded hover:bg-gray-800 disabled:opacity-40"
                        >
                          {row.saving
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : row.saved
                              ? <Check className="w-3 h-3" />
                              : <Save className="w-3 h-3" />}
                          Enregistrer
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-100">
                <tr className="text-xs font-semibold text-gray-700">
                  <td className="px-4 py-3" colSpan={2}>Totaux</td>
                  <td className="px-4 py-3 text-right">{fmt(totalBrut)}</td>
                  <td className="px-4 py-3 text-right">{fmt(totalCharges)}</td>
                  <td className="px-4 py-3 text-right">{fmt(totalNet)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Recap masse salariale */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard label="Masse salariale brute" value={totalBrut} />
          <SummaryCard label="Charges patronales" value={totalCharges} />
          <SummaryCard label="Coût total employeur" value={totalMasse} highlight />
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-200'}`}>
      <p className={`text-xs font-medium ${highlight ? 'text-gray-400' : 'text-gray-500'}`}>{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${highlight ? 'text-white' : 'text-gray-900'}`}>
        {value.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
      </p>
    </div>
  )
}
