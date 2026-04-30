'use client'

import { useEffect, useMemo, useState } from 'react'
import { TrendingUp, TrendingDown, Wallet, Receipt, Users, Building2 } from 'lucide-react'
import { TopBar } from '@/components/co/TopBar'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

/* ── Types ── */

type Projet = {
  id: string
  nom: string
  statut: string | null
  budget_client_ht: number | null
}
type Revenu = {
  projet_id: string | null
  montant_ht: number
  date_facture: string | null
  date_encaissement: string | null
  statut: string
}
type Depense = {
  projet_id: string | null
  montant_ht: number
  date_paiement: string | null
  statut: string
  categorie: string | null
}
type Salaire = {
  net_a_payer: number | null
  mois: string
}

const STATUT_BADGE: Record<string, string> = {
  avant_projet: 'bg-gray-100 text-gray-600',
  en_cours:     'bg-blue-50 text-blue-600',
  chantier:     'bg-orange-50 text-orange-600',
  cloture:      'bg-emerald-50 text-emerald-600',
}

const STATUT_LABEL: Record<string, string> = {
  avant_projet: 'Avant-projet',
  en_cours:     'En cours',
  chantier:     'Chantier',
  cloture:      'Cloture',
}

function formatEUR(n: number | null | undefined) {
  if (n == null) return '--'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

const ANNEE_COURANTE = new Date().getFullYear()
const isThisYear = (date: string | null) => !!date && date.slice(0, 4) === String(ANNEE_COURANTE)

/* ── Component ── */

export default function FinancePage() {
  const supabase = createClient()
  const [projets, setProjets] = useState<Projet[]>([])
  const [revenus, setRevenus] = useState<Revenu[]>([])
  const [depenses, setDepenses] = useState<Depense[]>([])
  const [salaires, setSalaires] = useState<Salaire[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('projets').select('id,nom,statut,budget_client_ht'),
      supabase.from('revenus').select('projet_id,montant_ht,date_facture,date_encaissement,statut'),
      supabase.from('depenses').select('projet_id,montant_ht,date_paiement,statut,categorie'),
      supabase.from('salaires').select('net_a_payer,mois'),
    ]).then(([projRes, revRes, depRes, salRes]) => {
      setProjets((projRes.data ?? []) as Projet[])
      setRevenus((revRes.data ?? []) as Revenu[])
      setDepenses((depRes.data ?? []) as Depense[])
      setSalaires((salRes.data ?? []) as Salaire[])
      setLoading(false)
    })
  }, [supabase])

  /* ── KPI globaux ── */

  const caEncaisseAnnee = useMemo(
    () => revenus
      .filter(r => r.statut === 'encaisse' && isThisYear(r.date_encaissement))
      .reduce((s, r) => s + Number(r.montant_ht ?? 0), 0),
    [revenus],
  )

  const depensesChantiers = useMemo(
    () => depenses
      .filter(d => d.statut === 'paye' && isThisYear(d.date_paiement) && d.categorie !== 'general')
      .reduce((s, d) => s + Number(d.montant_ht ?? 0), 0),
    [depenses],
  )

  const depensesGenerales = useMemo(
    () => depenses
      .filter(d => d.statut === 'paye' && isThisYear(d.date_paiement) && d.categorie === 'general')
      .reduce((s, d) => s + Number(d.montant_ht ?? 0), 0),
    [depenses],
  )

  const totalDepenses = depensesChantiers + depensesGenerales

  const masseSalarialeYTD = useMemo(
    () => salaires
      .filter(s => s.mois?.startsWith(String(ANNEE_COURANTE)))
      .reduce((s, x) => s + Number(x.net_a_payer ?? 0), 0),
    [salaires],
  )

  const moisEcoulesYTD = new Date().getMonth() + 1
  const masseSalarialeAnnualisee = moisEcoulesYTD > 0 ? (masseSalarialeYTD / moisEcoulesYTD) * 12 : 0

  const margeNette = caEncaisseAnnee - totalDepenses - masseSalarialeAnnualisee

  /* ── Synthèse projet par projet ── */

  const projetsAgreg = useMemo(() => {
    return projets.map(p => {
      const revsP = revenus.filter(r => r.projet_id === p.id)
      const ca_encaisse_ht = revsP
        .filter(r => r.statut === 'encaisse')
        .reduce((s, r) => s + Number(r.montant_ht ?? 0), 0)
      const ca_facture_ht = revsP
        .filter(r => r.statut === 'facture' || r.statut === 'encaisse')
        .reduce((s, r) => s + Number(r.montant_ht ?? 0), 0)
      const budget = Number(p.budget_client_ht ?? 0)
      const ca_restant_ht = Math.max(0, budget - ca_facture_ht)
      const depenses_directes_ht = depenses
        .filter(d => d.projet_id === p.id && d.statut === 'paye')
        .reduce((s, d) => s + Number(d.montant_ht ?? 0), 0)
      const marge_brute_ht = budget - depenses_directes_ht
      return {
        id: p.id,
        nom: p.nom,
        statut: p.statut ?? '',
        budget_client_ht: p.budget_client_ht,
        ca_encaisse_ht,
        ca_restant_ht,
        depenses_directes_ht,
        marge_brute_ht,
      }
    }).sort((a, b) => (a.marge_brute_ht ?? 0) - (b.marge_brute_ht ?? 0))
  }, [projets, revenus, depenses])

  return (
    <div>
      <TopBar title="Finance" subtitle="Vue d'ensemble financiere de l'entreprise" />
      <div className="p-4 sm:p-6 space-y-6">

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <KpiCard
            icon={Wallet}
            label="CA encaisse"
            value={formatEUR(caEncaisseAnnee)}
            sub={`Annee ${ANNEE_COURANTE}`}
            color="blue"
            loading={loading}
          />
          <KpiCard
            icon={Receipt}
            label="Total depenses"
            value={formatEUR(totalDepenses)}
            sub="Chantiers + generales"
            color="amber"
            loading={loading}
          />
          <KpiCard
            icon={Users}
            label="Masse salariale"
            value={formatEUR(masseSalarialeAnnualisee)}
            sub={`Annualisee (${formatEUR(masseSalarialeYTD)} YTD)`}
            color="purple"
            loading={loading}
          />
          <KpiCard
            icon={margeNette >= 0 ? TrendingUp : TrendingDown}
            label="Marge nette estimee"
            value={formatEUR(margeNette)}
            sub={margeNette >= 0 ? 'Positive' : 'Negative'}
            color={margeNette >= 0 ? 'emerald' : 'red'}
            loading={loading}
            highlight
          />
        </div>

        {/* ── Tableau projets ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-gray-400" />
              Projets ({projetsAgreg.length})
            </h2>
            <span className="text-[10px] text-gray-400">Trie par marge croissante</span>
          </div>

          {loading ? (
            <div className="p-5 space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
            </div>
          ) : projetsAgreg.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-400">Aucun projet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">
                    <th className="px-5 py-2.5 text-left">Projet</th>
                    <th className="px-3 py-2.5 text-left">Statut</th>
                    <th className="px-3 py-2.5 text-right">Budget HT</th>
                    <th className="px-3 py-2.5 text-right">CA encaisse</th>
                    <th className="px-3 py-2.5 text-right">Depenses</th>
                    <th className="px-5 py-2.5 text-right">Marge brute</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {projetsAgreg.map(p => {
                    const marge = p.marge_brute_ht ?? 0
                    return (
                      <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 font-medium text-gray-900 whitespace-nowrap">{p.nom}</td>
                        <td className="px-3 py-3">
                          <span className={cn(
                            'inline-block text-[10px] font-medium px-2 py-0.5 rounded',
                            STATUT_BADGE[p.statut] ?? 'bg-gray-100 text-gray-500',
                          )}>
                            {STATUT_LABEL[p.statut] ?? p.statut}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right text-gray-700 whitespace-nowrap">{formatEUR(p.budget_client_ht)}</td>
                        <td className="px-3 py-3 text-right text-gray-700 whitespace-nowrap">{formatEUR(p.ca_encaisse_ht)}</td>
                        <td className="px-3 py-3 text-right text-gray-700 whitespace-nowrap">{formatEUR(p.depenses_directes_ht)}</td>
                        <td className={cn(
                          'px-5 py-3 text-right font-semibold whitespace-nowrap',
                          marge > 0 ? 'text-emerald-600' : marge < 0 ? 'text-red-500' : 'text-gray-500',
                        )}>
                          {formatEUR(p.marge_brute_ht)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Repartition des charges ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Repartition des charges</h2>
          </div>
          <div className="divide-y divide-gray-50">
            <ChargeRow label="Depenses chantiers"  value={depensesChantiers}        loading={loading} />
            <ChargeRow label="Depenses generales"  value={depensesGenerales}        loading={loading} />
            <ChargeRow label="Masse salariale YTD" value={masseSalarialeYTD}        loading={loading} />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Sub components ── */

function KpiCard({ icon: Icon, label, value, sub, color, loading, highlight }: {
  icon: React.ElementType
  label: string
  value: string
  sub: string
  color: 'blue' | 'amber' | 'purple' | 'emerald' | 'red'
  loading: boolean
  highlight?: boolean
}) {
  const colorClasses: Record<string, string> = {
    blue:    'bg-blue-50 text-blue-600',
    amber:   'bg-amber-50 text-amber-600',
    purple:  'bg-purple-50 text-purple-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    red:     'bg-red-50 text-red-500',
  }
  return (
    <div className={cn(
      'bg-white rounded-xl border shadow-sm p-4',
      highlight && (color === 'emerald' ? 'border-emerald-200' : 'border-red-200'),
      !highlight && 'border-gray-200',
    )}>
      <div className="flex items-center gap-3">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', colorClasses[color])}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
          {loading ? (
            <div className="h-5 w-20 bg-gray-100 rounded animate-pulse mt-1" />
          ) : (
            <p className={cn(
              'text-base font-bold mt-0.5 truncate',
              highlight && (color === 'emerald' ? 'text-emerald-600' : 'text-red-500'),
              !highlight && 'text-gray-900',
            )}>{value}</p>
          )}
        </div>
      </div>
      <p className="text-[10px] text-gray-400 mt-2">{sub}</p>
    </div>
  )
}

function ChargeRow({ label, value, loading }: {
  label: string
  value: number | null | undefined
  loading: boolean
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <span className="text-sm text-gray-600">{label}</span>
      {loading ? (
        <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
      ) : (
        <span className="text-sm font-semibold text-gray-900">{formatEUR(value)}</span>
      )}
    </div>
  )
}
