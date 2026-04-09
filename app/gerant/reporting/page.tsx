'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  TrendingUp, TrendingDown, Wallet, Receipt, Users,
  AlertTriangle, Loader2, Building2, Shield, Clock,
} from 'lucide-react'
import { TopBar } from '@/components/co/TopBar'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

/* ── Types ── */

type Revenu = {
  id: string
  projet_id: string
  montant_ht: number
  date_facture: string | null
  date_encaissement: string | null
  statut: string
}
type Depense = {
  id: string
  projet_id: string | null
  montant_ht: number
  date_facture: string | null
  date_paiement: string | null
  statut: string
}
type Projet = {
  id: string
  nom: string
  statut: string
  budget_client_ht: number | null
}
type Caution = {
  id: string
  date_echeance: string
  montant: number
  statut: string
  fournisseur_id: string
}
type Salaire = {
  mois: string
  salaire_brut: number
  charges_patronales: number
}

type Periode = 'mois' | 'trimestre' | 'annee'

/* ── Helpers ── */

function fmt(n: number) {
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €'
}
function isInRange(date: string | null, start: Date, end: Date) {
  if (!date) return false
  const d = new Date(date).getTime()
  return d >= start.getTime() && d <= end.getTime()
}
function startOf(periode: Periode): Date {
  const now = new Date()
  if (periode === 'mois')      return new Date(now.getFullYear(), now.getMonth(), 1)
  if (periode === 'trimestre') return new Date(now.getFullYear(), now.getMonth() - 2, 1)
  return new Date(now.getFullYear(), 0, 1)
}

/* ── Component ── */

export default function ReportingPage() {
  const supabase = createClient()
  const [revenus, setRevenus] = useState<Revenu[]>([])
  const [depenses, setDepenses] = useState<Depense[]>([])
  const [projets, setProjets] = useState<Projet[]>([])
  const [cautions, setCautions] = useState<Caution[]>([])
  const [salaires, setSalaires] = useState<Salaire[]>([])
  const [loading, setLoading] = useState(true)
  const [periode, setPeriode] = useState<Periode>('annee')

  useEffect(() => {
    async function load() {
      const [r, d, p, c, s] = await Promise.all([
        supabase.from('revenus').select('id,projet_id,montant_ht,date_facture,date_encaissement,statut'),
        supabase.from('depenses').select('id,projet_id,montant_ht,date_facture,date_paiement,statut'),
        supabase.from('projets').select('id,nom,statut,budget_client_ht'),
        supabase.from('cautions').select('id,date_echeance,montant,statut,fournisseur_id'),
        supabase.from('salaires').select('mois,salaire_brut,charges_patronales'),
      ])
      setRevenus((r.data ?? []) as Revenu[])
      setDepenses((d.data ?? []) as Depense[])
      setProjets((p.data ?? []) as Projet[])
      setCautions((c.data ?? []) as Caution[])
      setSalaires((s.data ?? []) as Salaire[])
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line

  const start = startOf(periode)
  const end = new Date()

  /* ── KPI calculs ── */
  const caEncaisse = useMemo(() =>
    revenus
      .filter(r => r.statut === 'encaisse' && isInRange(r.date_encaissement, start, end))
      .reduce((s, r) => s + Number(r.montant_ht), 0),
    [revenus, periode] // eslint-disable-line
  )
  const totalDepenses = useMemo(() =>
    depenses
      .filter(d => d.statut === 'paye' && isInRange(d.date_paiement, start, end))
      .reduce((s, d) => s + Number(d.montant_ht), 0),
    [depenses, periode] // eslint-disable-line
  )
  const masseSalariale = useMemo(() =>
    salaires
      .filter(s => isInRange(s.mois, start, end))
      .reduce((s, x) => s + Number(x.salaire_brut) + Number(x.charges_patronales), 0),
    [salaires, periode] // eslint-disable-line
  )
  const tresorerie = caEncaisse - totalDepenses - masseSalariale
  const margePct = caEncaisse > 0 ? (tresorerie / caEncaisse) * 100 : 0

  /* ── CA mensuel sur 12 mois glissants ── */
  const caMensuel = useMemo(() => {
    const months: { label: string; ca: number; depenses: number }[] = []
    const now = new Date()
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const label = d.toLocaleDateString('fr-FR', { month: 'short' })
      const ca = revenus
        .filter(r => r.statut === 'encaisse' && r.date_encaissement && new Date(r.date_encaissement) >= d && new Date(r.date_encaissement) < next)
        .reduce((s, r) => s + Number(r.montant_ht), 0)
      const dep = depenses
        .filter(x => x.statut === 'paye' && x.date_paiement && new Date(x.date_paiement) >= d && new Date(x.date_paiement) < next)
        .reduce((s, x) => s + Number(x.montant_ht), 0)
      months.push({ label, ca, depenses: dep })
    }
    return months
  }, [revenus, depenses])

  /* ── Top projets par marge ── */
  const topProjets = useMemo(() => {
    return projets.map(p => {
      const ca = revenus
        .filter(r => r.projet_id === p.id && r.statut === 'encaisse')
        .reduce((s, r) => s + Number(r.montant_ht), 0)
      const dep = depenses
        .filter(d => d.projet_id === p.id && d.statut === 'paye')
        .reduce((s, d) => s + Number(d.montant_ht), 0)
      const marge = ca - dep
      const margePct = ca > 0 ? (marge / ca) * 100 : 0
      return { projet: p, ca, dep, marge, margePct }
    }).filter(x => x.ca > 0).sort((a, b) => b.marge - a.marge)
  }, [projets, revenus, depenses])

  const top5 = topProjets.slice(0, 5)
  const flop5 = [...topProjets].reverse().slice(0, 5)

  /* ── Alertes ── */
  const alertes = useMemo(() => {
    const result: { type: 'projet' | 'caution' | 'facture'; severite: 'rouge' | 'orange'; titre: string; sub: string }[] = []

    // Projets a marge faible
    topProjets.filter(p => p.margePct < 10 && p.ca > 0).forEach(p => {
      result.push({
        type: 'projet',
        severite: p.margePct < 0 ? 'rouge' : 'orange',
        titre: p.projet.nom,
        sub: `Marge ${p.margePct.toFixed(0)}% (${fmt(p.marge)})`,
      })
    })

    // Cautions a echeance < 30j
    cautions.filter(c => c.statut === 'active').forEach(c => {
      const days = Math.ceil((new Date(c.date_echeance).getTime() - Date.now()) / 86400000)
      if (days < 30) {
        result.push({
          type: 'caution',
          severite: days < 0 ? 'rouge' : 'orange',
          titre: `Caution ${fmt(Number(c.montant))}`,
          sub: days < 0 ? `Échue depuis ${Math.abs(days)}j` : `Échéance dans ${days}j`,
        })
      }
    })

    // Factures clients impayees > 60j
    revenus.filter(r => r.statut !== 'encaisse' && r.date_facture).forEach(r => {
      const days = Math.floor((Date.now() - new Date(r.date_facture!).getTime()) / 86400000)
      if (days > 60) {
        result.push({
          type: 'facture',
          severite: days > 90 ? 'rouge' : 'orange',
          titre: `Facture impayée ${fmt(Number(r.montant_ht))}`,
          sub: `${days} jours sans encaissement`,
        })
      }
    })

    return result
  }, [topProjets, cautions, revenus])

  return (
    <div>
      <TopBar title="Reporting" subtitle="Vision strategique de l'activité" />
      <div className="p-4 sm:p-6 space-y-6">

        {/* Sélecteur période */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1 w-fit">
          {(['mois', 'trimestre', 'annee'] as Periode[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriode(p)}
              className={cn(
                'px-4 py-1.5 text-xs font-medium rounded-md transition-colors capitalize',
                periode === p ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900',
              )}
            >
              {p === 'mois' ? 'Mois courant' : p === 'trimestre' ? 'Trimestre' : 'Année'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Loader2 className="w-6 h-6 text-gray-400 mx-auto animate-spin" />
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <KpiCard icon={Wallet}     label="Chiffre d'affaires" value={fmt(caEncaisse)}  sub="CA encaissé" color="blue" />
              <KpiCard icon={Receipt}    label="Dépenses"           value={fmt(totalDepenses + masseSalariale)} sub={`dont ${fmt(masseSalariale)} salaires`} color="amber" />
              <KpiCard icon={tresorerie >= 0 ? TrendingUp : TrendingDown} label="Trésorerie nette" value={fmt(tresorerie)} sub={`${margePct.toFixed(1)}% de marge`} color={tresorerie >= 0 ? 'emerald' : 'red'} highlight />
              <KpiCard icon={Building2}  label="Projets actifs"     value={`${projets.filter(p => !['cloture','annule'].includes(p.statut)).length}`} sub={`${projets.length} au total`} color="purple" />
            </div>

            {/* Graph CA + Top projets */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="px-5 py-3 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-gray-900">Évolution CA / Dépenses (12 mois)</h2>
                </div>
                <div className="p-5">
                  <LineChart data={caMensuel} />
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="px-5 py-3 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-gray-900">Top 5 projets / marge</h2>
                </div>
                <div className="divide-y divide-gray-50">
                  {top5.length === 0 ? (
                    <p className="px-5 py-6 text-xs text-gray-400 text-center">Aucune donnée</p>
                  ) : top5.map(p => (
                    <div key={p.projet.id} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-gray-900 truncate flex-1">{p.projet.nom}</p>
                        <span className={cn('text-xs font-bold flex-shrink-0', p.marge >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                          {p.margePct.toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400">{fmt(p.marge)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Flop projets + Alertes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                  <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                  <h2 className="text-sm font-semibold text-gray-900">Projets les moins rentables</h2>
                </div>
                <div className="divide-y divide-gray-50">
                  {flop5.length === 0 ? (
                    <p className="px-5 py-6 text-xs text-gray-400 text-center">Aucune donnée</p>
                  ) : flop5.map(p => (
                    <div key={p.projet.id} className="px-5 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">{p.projet.nom}</p>
                        <p className="text-[10px] text-gray-400">{fmt(p.ca)} CA · {fmt(p.dep)} dépenses</p>
                      </div>
                      <span className={cn('text-xs font-bold', p.marge >= 0 ? 'text-amber-600' : 'text-red-500')}>
                        {p.margePct.toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <h2 className="text-sm font-semibold text-gray-900">Alertes critiques ({alertes.length})</h2>
                </div>
                <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
                  {alertes.length === 0 ? (
                    <p className="px-5 py-6 text-xs text-gray-400 text-center">Aucune alerte</p>
                  ) : alertes.map((a, i) => {
                    const Icon = a.type === 'projet' ? Building2 : a.type === 'caution' ? Shield : Clock
                    return (
                      <div key={i} className="px-5 py-3 flex items-start gap-3">
                        <div className={cn(
                          'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
                          a.severite === 'rouge' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-600',
                        )}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-900 truncate">{a.titre}</p>
                          <p className="text-[10px] text-gray-400">{a.sub}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ── KPI Card ── */

function KpiCard({ icon: Icon, label, value, sub, color, highlight }: {
  icon: React.ElementType
  label: string
  value: string
  sub: string
  color: 'blue' | 'amber' | 'purple' | 'emerald' | 'red'
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
          <p className={cn(
            'text-base font-bold mt-0.5 truncate',
            highlight && (color === 'emerald' ? 'text-emerald-600' : 'text-red-500'),
            !highlight && 'text-gray-900',
          )}>{value}</p>
        </div>
      </div>
      <p className="text-[10px] text-gray-400 mt-2">{sub}</p>
    </div>
  )
}

/* ── Mini SVG Line Chart (CA vs Dépenses) ── */

function LineChart({ data }: { data: { label: string; ca: number; depenses: number }[] }) {
  const W = 600
  const H = 220
  const PAD = { top: 20, right: 16, bottom: 30, left: 50 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const max = Math.max(1, ...data.flatMap(d => [d.ca, d.depenses]))
  const xStep = innerW / Math.max(1, data.length - 1)

  function pathFor(key: 'ca' | 'depenses') {
    return data.map((d, i) => {
      const x = PAD.left + i * xStep
      const y = PAD.top + innerH - (d[key] / max) * innerH
      return `${i === 0 ? 'M' : 'L'}${x},${y}`
    }).join(' ')
  }

  // Y axis ticks
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    y: PAD.top + innerH - t * innerH,
    label: fmt(max * t),
  }))

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ minWidth: '500px' }}>
        {/* Grille horizontale */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={t.y} y2={t.y} stroke="#f3f4f6" strokeWidth="1" />
            <text x={PAD.left - 6} y={t.y + 3} fontSize="9" textAnchor="end" fill="#9ca3af">{t.label}</text>
          </g>
        ))}

        {/* Aire CA */}
        <path
          d={`${pathFor('ca')} L ${PAD.left + (data.length - 1) * xStep},${PAD.top + innerH} L ${PAD.left},${PAD.top + innerH} Z`}
          fill="rgb(16 185 129 / 0.1)"
        />
        {/* Ligne CA */}
        <path d={pathFor('ca')} fill="none" stroke="rgb(16 185 129)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Points CA */}
        {data.map((d, i) => (
          <circle key={`ca-${i}`} cx={PAD.left + i * xStep} cy={PAD.top + innerH - (d.ca / max) * innerH} r="3" fill="rgb(16 185 129)" />
        ))}

        {/* Ligne depenses */}
        <path d={pathFor('depenses')} fill="none" stroke="rgb(239 68 68)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 3" />
        {data.map((d, i) => (
          <circle key={`dep-${i}`} cx={PAD.left + i * xStep} cy={PAD.top + innerH - (d.depenses / max) * innerH} r="2.5" fill="rgb(239 68 68)" />
        ))}

        {/* Labels X */}
        {data.map((d, i) => (
          <text key={`l-${i}`} x={PAD.left + i * xStep} y={H - PAD.bottom + 14} fontSize="9" textAnchor="middle" fill="#9ca3af">
            {d.label}
          </text>
        ))}
      </svg>

      <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-500">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 bg-emerald-500" /> Chiffre d&apos;affaires
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 bg-red-500" style={{ borderTop: '2px dashed' }} /> Dépenses
        </div>
      </div>
    </div>
  )
}
