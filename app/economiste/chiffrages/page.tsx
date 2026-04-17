'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  FolderOpen,
  FileWarning,
  Clock,
  TrendingUp,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Send,
  FileSignature,
  FileInput,
  FilePlus2,
  X,
} from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'
import { STATUTS_TERMINES } from '@/lib/utils'

/* ─── Types ─────────────────────────────────────────────────────────────── */

type ProjetBase = {
  id: string
  nom: string
  statut: string
  economiste_id: string | null
  date_livraison: string | null
}

type ProjetPublic = {
  id: string
  budget_client_ht: number | null
}

type LotRow = {
  id: string
  projet_id: string
  nom: string | null
  ordre: number | null
  total_ht: number | null
  planning_debut: string | null
  planning_fin: string | null
}

type DceAcces = {
  id: string
  lot_id: string
  projet_id: string
  st_nom: string | null
  st_societe: string | null
  statut: string
  date_limite: string | null
  token: string | null
}

type DevisRow = {
  id: string
  lot_id: string | null
  projet_id: string | null
  montant_ht: number | null
  statut: string
  st_nom: string | null
  numero: string | null
  created_at: string
  updated_at: string | null
}

type AvenantRow = {
  id: string
  projet_id: string
  lot_id: string | null
  statut: string
  montant_ht: number | null
  titre: string | null
  created_at: string
}

type LotATraiter = {
  lot_id: string
  lot_nom: string
  projet_id: string
  projet_nom: string
  date_livraison: string | null
}

type DceLigne = {
  acces_id: string
  lot_id: string
  projet_id: string
  projet_nom: string
  lot_nom: string
  st_label: string
  statut: string
  date_limite: string | null
  token: string | null
}

type MargeLigne = {
  projet_id: string
  projet_nom: string
  budget: number | null
  cout_st: number
  marge_eur: number | null
  marge_pct: number | null
  statut: string
}

type ActiviteLigne = {
  id: string
  type: 'devis_soumis' | 'st_retenu' | 'avenant' | 'devis_signe'
  description: string
  date: string
}

// Statuts termines : source unique = lib/utils.ts STATUTS_TERMINES.
// Tous les statuts DB sont desormais lowercase canoniques (check constraint).

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function fmtEurHT(n: number | null | undefined): string {
  const v = Number(n ?? 0)
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(v)} € HT`
}

function fmtDateShort(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso))
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const d = new Date(iso)
  const now = new Date()
  d.setHours(0, 0, 0, 0)
  now.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function relativeDate(iso: string): string {
  const d = new Date(iso).getTime()
  const now = Date.now()
  const diffMin = Math.round((now - d) / 60000)
  if (diffMin < 1) return 'à l’instant'
  if (diffMin < 60) return `il y a ${diffMin} min`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `il y a ${diffH} h`
  const diffJ = Math.round(diffH / 24)
  if (diffJ === 1) return 'hier'
  if (diffJ < 7) return `il y a ${diffJ} jours`
  const diffSem = Math.round(diffJ / 7)
  if (diffSem < 5) return `il y a ${diffSem} sem`
  return fmtDateShort(iso)
}

function delaiColor(days: number | null): { label: string; cls: string } {
  if (days === null) return { label: '—', cls: 'text-gray-400' }
  if (days < 0) return { label: 'Expiré', cls: 'text-red-600 font-medium' }
  if (days < 2) return { label: `Dans ${days} j`, cls: 'text-red-600 font-medium' }
  if (days <= 5) return { label: `Dans ${days} j`, cls: 'text-amber-600 font-medium' }
  return { label: `Dans ${days} j`, cls: 'text-emerald-600 font-medium' }
}

function margeStyle(pct: number | null): { rowBg: string; badgeBg: string; badgeColor: string; icon: boolean } {
  if (pct === null) return { rowBg: '', badgeBg: '#F1EFE8', badgeColor: '#888780', icon: false }
  if (pct < 10) return { rowBg: 'bg-[#FCEBEB]', badgeBg: '#FCEBEB', badgeColor: '#A32D2D', icon: true }
  if (pct <= 20) return { rowBg: '', badgeBg: '#FAEEDA', badgeColor: '#854F0B', icon: false }
  return { rowBg: 'bg-[#EAF3DE]', badgeBg: '#EAF3DE', badgeColor: '#3B6D11', icon: false }
}

function stLabel(a: { st_societe?: string | null; st_nom?: string | null }): string {
  return a.st_societe || a.st_nom || 'ST'
}

/* ─── Composant principal ──────────────────────────────────────────────── */

export default function ChiffragesDashboardPage() {
  const { user, loading: userLoading } = useUser()
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Données brutes
  const [projetsActifs, setProjetsActifs] = useState<ProjetBase[]>([])
  const [budgetById, setBudgetById] = useState<Map<string, number | null>>(new Map())
  const [lots, setLots] = useState<LotRow[]>([])
  const [lotIdsAvecLignes, setLotIdsAvecLignes] = useState<Set<string>>(new Set())
  const [dceList, setDceList] = useState<DceAcces[]>([])
  const [devisList, setDevisList] = useState<DevisRow[]>([])
  const [avenantsList, setAvenantsList] = useState<AvenantRow[]>([])

  // UI state
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)
  const [relancerCible, setRelancerCible] = useState<DceLigne | null>(null)
  const [relancerEnvoi, setRelancerEnvoi] = useState(false)

  /* ─── Fetch ──────────────────────────────────────────────────────────── */

  const load = useCallback(async () => {
    if (!user) return
    setFetching(true)
    setError(null)
    const supabase = createClient()

    try {
      // 1. Projets de l'économiste — on garde tout sauf les statuts "fermés"
      const { data: projetsData, error: pErr } = await supabase
        .schema('app')
        .from('projets')
        .select('id, nom, statut, economiste_id, date_livraison')
        .eq('economiste_id', user.id)

      if (pErr) throw new Error(pErr.message)

      const projets = ((projetsData ?? []) as ProjetBase[])
        .filter((p) => !STATUTS_TERMINES.includes(p.statut))
      setProjetsActifs(projets)

      if (projets.length === 0) {
        setBudgetById(new Map())
        setLots([])
        setLotIdsAvecLignes(new Set())
        setDceList([])
        setDevisList([])
        setAvenantsList([])
        setFetching(false)
        return
      }

      const projetIds = projets.map((p) => p.id)

      // 2. Budgets (public.projets) + lots + chiffrage_lignes + dce + devis + avenants en parallèle
      const [budgetsRes, lotsRes, lignesRes, dceRes, devisRes, avenantsRes] = await Promise.all([
        supabase.from('projets' as never).select('id, budget_client_ht').in('id', projetIds),
        supabase
          .from('lots' as never)
          .select('id, projet_id, nom, ordre, total_ht, planning_debut, planning_fin')
          .in('projet_id', projetIds),
        supabase.from('chiffrage_lignes' as never).select('lot_id').in('projet_id', projetIds),
        supabase
          .from('dce_acces_st' as never)
          .select('id, lot_id, projet_id, st_nom, st_societe, statut, date_limite, token')
          .in('projet_id', projetIds),
        supabase
          .from('devis' as never)
          .select('id, lot_id, projet_id, montant_ht, statut, st_nom, numero, created_at, updated_at')
          .in('projet_id', projetIds),
        supabase
          .schema('app')
          .from('avenants')
          .select('id, projet_id, lot_id, statut, montant_ht, titre, created_at')
          .in('projet_id', projetIds),
      ])

      const bMap = new Map<string, number | null>()
      ;((budgetsRes.data ?? []) as ProjetPublic[]).forEach((p) => bMap.set(p.id, p.budget_client_ht))
      setBudgetById(bMap)

      setLots(((lotsRes.data ?? []) as LotRow[]).slice())

      const lotSet = new Set<string>()
      ;((lignesRes.data ?? []) as { lot_id: string }[]).forEach((l) => lotSet.add(l.lot_id))
      setLotIdsAvecLignes(lotSet)

      setDceList(((dceRes.data ?? []) as DceAcces[]).slice())
      setDevisList(((devisRes.data ?? []) as DevisRow[]).slice())
      setAvenantsList(((avenantsRes.data ?? []) as AvenantRow[]).slice())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement')
    } finally {
      setFetching(false)
    }
  }, [user])

  useEffect(() => {
    if (user) load()
  }, [user, load])

  /* ─── Calculs dérivés ────────────────────────────────────────────────── */

  const projetById = useMemo(() => {
    const m = new Map<string, ProjetBase>()
    projetsActifs.forEach((p) => m.set(p.id, p))
    return m
  }, [projetsActifs])

  const lotById = useMemo(() => {
    const m = new Map<string, LotRow>()
    lots.forEach((l) => m.set(l.id, l))
    return m
  }, [lots])

  // Métrique 1
  const nbProjetsActifs = projetsActifs.length

  // Métrique 2 & Section 2 — Lots sans chiffrage
  const lotsATraiter: LotATraiter[] = useMemo(() => {
    return lots
      .filter((l) => !lotIdsAvecLignes.has(l.id))
      .map((l) => {
        const p = projetById.get(l.projet_id)
        return {
          lot_id: l.id,
          lot_nom: l.nom ?? 'Lot sans nom',
          projet_id: l.projet_id,
          projet_nom: p?.nom ?? '—',
          date_livraison: p?.date_livraison ?? null,
        }
      })
      .sort((a, b) => {
        if (!a.date_livraison) return 1
        if (!b.date_livraison) return -1
        return new Date(a.date_livraison).getTime() - new Date(b.date_livraison).getTime()
      })
  }, [lots, lotIdsAvecLignes, projetById])

  // Métrique 3 & Section 3 — DCE en attente
  const dceEnAttente: DceLigne[] = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return dceList
      .filter((a) => ['envoye', 'ouvert', 'en_cours'].includes(a.statut))
      .map((a) => {
        const p = projetById.get(a.projet_id)
        const l = lotById.get(a.lot_id)
        return {
          acces_id: a.id,
          lot_id: a.lot_id,
          projet_id: a.projet_id,
          projet_nom: p?.nom ?? '—',
          lot_nom: l?.nom ?? 'Lot',
          st_label: stLabel(a),
          statut: a.statut,
          date_limite: a.date_limite,
          token: a.token,
        }
      })
      .sort((a, b) => {
        if (!a.date_limite) return 1
        if (!b.date_limite) return -1
        return new Date(a.date_limite).getTime() - new Date(b.date_limite).getTime()
      })
  }, [dceList, projetById, lotById])

  const nbDevisEnAttente = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return dceList.filter((a) => {
      if (!['envoye', 'ouvert'].includes(a.statut)) return false
      if (!a.date_limite) return true
      return new Date(a.date_limite) >= today
    }).length
  }, [dceList])

  // Section 4 — Marges par projet
  const margesLignes: MargeLigne[] = useMemo(() => {
    return projetsActifs
      .map((p) => {
        const budget = budgetById.get(p.id) ?? null
        const coutSt = devisList
          .filter((d) => d.projet_id === p.id && ['signe', 'envoye'].includes(d.statut))
          .reduce((s, d) => s + (Number(d.montant_ht) || 0), 0)

        const margeEur = budget !== null ? budget - coutSt : null
        const margePct = budget && budget > 0 && coutSt > 0 ? (margeEur! / budget) * 100 : null

        return {
          projet_id: p.id,
          projet_nom: p.nom,
          budget,
          cout_st: coutSt,
          marge_eur: margeEur,
          marge_pct: coutSt > 0 ? margePct : null,
          statut: p.statut,
        }
      })
      .sort((a, b) => a.projet_nom.localeCompare(b.projet_nom))
  }, [projetsActifs, budgetById, devisList])

  const totalBudget = margesLignes.reduce((s, m) => s + (m.budget ?? 0), 0)
  const totalCoutSt = margesLignes.reduce((s, m) => s + m.cout_st, 0)
  const totalMargeEur = totalBudget - totalCoutSt
  const totalMargePct = totalBudget > 0 ? (totalMargeEur / totalBudget) * 100 : null

  // Métrique 4 — Marge moyenne des projets avec ST retenu
  const margeMoyenne = useMemo(() => {
    const avecSt = margesLignes.filter((m) => m.marge_pct !== null)
    if (avecSt.length === 0) return null
    return avecSt.reduce((s, m) => s + (m.marge_pct ?? 0), 0) / avecSt.length
  }, [margesLignes])

  // Section 5 — Activité récente
  const activiteRecente: ActiviteLigne[] = useMemo(() => {
    const items: ActiviteLigne[] = []

    devisList.forEach((d) => {
      const p = d.projet_id ? projetById.get(d.projet_id) : null
      const lot = d.lot_id ? lotById.get(d.lot_id) : null
      const lotSuffix = lot?.nom ? ` · Lot ${lot.nom}` : ''
      const projetSuffix = p?.nom ? ` · ${p.nom}` : ''
      const dateRef = d.updated_at ?? d.created_at

      if (d.statut === 'signe') {
        items.push({
          id: `devis-signe-${d.id}`,
          type: 'devis_signe',
          description: `Devis signé${lotSuffix}${projetSuffix}`,
          date: dateRef,
        })
      } else if (d.statut === 'envoye') {
        items.push({
          id: `devis-envoye-${d.id}`,
          type: 'st_retenu',
          description: `ST retenu${lotSuffix}${projetSuffix}`,
          date: dateRef,
        })
      } else if (d.statut === 'brouillon') {
        items.push({
          id: `devis-soumis-${d.id}`,
          type: 'devis_soumis',
          description: `${d.st_nom ?? 'Un ST'} a soumis son offre${lotSuffix}`,
          date: dateRef,
        })
      }
    })

    avenantsList.forEach((a) => {
      const p = projetById.get(a.projet_id)
      const titreFr = a.titre ? ` · ${a.titre}` : ''
      items.push({
        id: `avenant-${a.id}`,
        type: 'avenant',
        description: `Avenant créé${titreFr}${p?.nom ? ` · ${p.nom}` : ''}`,
        date: a.created_at,
      })
    })

    return items.sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime()).slice(0, 8)
  }, [devisList, avenantsList, projetById, lotById])

  /* ─── Actions ────────────────────────────────────────────────────────── */

  async function handleRelance() {
    if (!relancerCible || !relancerCible.token) {
      setToast({ kind: 'err', msg: 'Token manquant, impossible de relancer' })
      return
    }
    setRelancerEnvoi(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('dce_acces_st' as never)
      .update({ statut: 'envoye' } as never)
      .eq('id', relancerCible.acces_id)
    setRelancerEnvoi(false)
    if (error) {
      setToast({ kind: 'err', msg: error.message })
      return
    }
    setToast({ kind: 'ok', msg: `Lien renvoyé à ${relancerCible.st_label}` })
    setRelancerCible(null)
    load()
  }

  async function copierLien(token: string | null) {
    if (!token) {
      setToast({ kind: 'err', msg: 'Lien indisponible' })
      return
    }
    const url = `${window.location.origin}/dce/${token}`
    try {
      await navigator.clipboard.writeText(url)
      setToast({ kind: 'ok', msg: 'Lien copié' })
    } catch {
      setToast({ kind: 'err', msg: 'Copie impossible' })
    }
  }

  /* ─── Render ─────────────────────────────────────────────────────────── */

  if (userLoading || fetching) {
    return (
      <div>
        <TopBar title="Chiffrages" subtitle="Pilotage des chiffrages et consultations" />
        <div className="p-6 space-y-6">
          <SectionSkeleton rows={4} grid />
          <SectionSkeleton rows={3} />
          <SectionSkeleton rows={3} />
          <SectionSkeleton rows={4} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <TopBar title="Chiffrages" />
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Erreur de chargement</p>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
            </div>
            <button onClick={() => load()} className="text-xs text-red-700 underline">
              Réessayer
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <TopBar
        title="Chiffrages"
        subtitle={`${nbProjetsActifs} projet${nbProjetsActifs > 1 ? 's' : ''} actif${nbProjetsActifs > 1 ? 's' : ''} · pilotage`}
      />

      <div className="p-6 space-y-8">
        {/* ─── Section 1 — Métriques ────────────────────────────────── */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Metric
            label="Projets actifs"
            value={nbProjetsActifs.toString()}
            subtitle="Assignés à vous"
            icon={<FolderOpen className="w-4 h-4" />}
          />
          <Metric
            label="Lots à chiffrer"
            value={lotsATraiter.length.toString()}
            subtitle="Sans chiffrage"
            icon={<FileWarning className="w-4 h-4" />}
            accent={lotsATraiter.length > 0 ? 'amber' : 'default'}
          />
          <Metric
            label="Devis en attente"
            value={nbDevisEnAttente.toString()}
            subtitle="Réponses attendues"
            icon={<Clock className="w-4 h-4" />}
            accent={nbDevisEnAttente > 0 ? 'blue' : 'default'}
          />
          <Metric
            label="Marge moyenne"
            value={margeMoyenne !== null ? `${margeMoyenne.toFixed(1)} %` : '—'}
            subtitle="Sur projets en cours"
            icon={<TrendingUp className="w-4 h-4" />}
            accent={margeMoyenne === null ? 'default' : margeMoyenne < 10 ? 'red' : 'green'}
          />
        </section>

        {/* ─── Section 2 — À faire maintenant ─────────────────────── */}
        <section>
          <SectionHeader title="À faire maintenant" count={lotsATraiter.length} />
          <div className="bg-white rounded-lg border border-gray-200 shadow-card overflow-hidden">
            {lotsATraiter.length === 0 ? (
              <div className="py-10 px-6 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm text-gray-700">Tous les lots ont un chiffrage — bien joué !</p>
              </div>
            ) : (
              lotsATraiter.slice(0, 8).map((l, idx) => (
                <div
                  key={l.lot_id}
                  className={`flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors ${
                    idx !== lotsATraiter.slice(0, 8).length - 1 ? 'border-b border-gray-100' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">
                      <span className="font-medium">{l.projet_nom}</span>
                      <span className="text-gray-300 mx-1.5">·</span>
                      <span className="text-gray-600">{l.lot_nom}</span>
                    </p>
                  </div>
                  <div className="text-xs text-gray-500 w-28 text-right flex-shrink-0">
                    {fmtDateShort(l.date_livraison)}
                  </div>
                  <Link
                    href={`/economiste/projets/${l.projet_id}?tab=chiffrage&lot=${l.lot_id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-black transition-colors flex-shrink-0"
                  >
                    Chiffrer <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              ))
            )}
            {lotsATraiter.length > 8 && (
              <div className="px-4 py-2 text-xs text-gray-400 text-center border-t border-gray-100 bg-gray-50">
                + {lotsATraiter.length - 8} autres lots
              </div>
            )}
          </div>
        </section>

        {/* ─── Section 3 — En attente de réponse ST ──────────────── */}
        <section>
          <SectionHeader title="En attente de réponse ST" count={dceEnAttente.length} />
          <div className="bg-white rounded-lg border border-gray-200 shadow-card overflow-hidden">
            {dceEnAttente.length === 0 ? (
              <div className="py-10 px-6 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm text-gray-700">Aucune consultation en attente</p>
              </div>
            ) : (
              dceEnAttente.slice(0, 10).map((d, idx) => {
                const days = daysUntil(d.date_limite)
                const delai = delaiColor(days)
                const expire = days !== null && days < 0
                return (
                  <div
                    key={d.acces_id}
                    className={`flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors ${
                      idx !== dceEnAttente.slice(0, 10).length - 1 ? 'border-b border-gray-100' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate">
                        <span className="font-medium">{d.projet_nom}</span>
                        <span className="text-gray-300 mx-1.5">·</span>
                        <span className="text-gray-600">{d.lot_nom}</span>
                      </p>
                    </div>
                    <div className="text-xs text-gray-600 w-32 truncate flex-shrink-0">{d.st_label}</div>
                    <div className="w-28 text-right flex-shrink-0 flex items-center justify-end gap-1.5">
                      {expire && (
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                          style={{ background: '#FCEBEB', color: '#A32D2D' }}
                        >
                          Expiré
                        </span>
                      )}
                      {!expire && <span className={`text-xs ${delai.cls}`}>{delai.label}</span>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => copierLien(d.token)}
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                        title="Copier le lien DCE"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setRelancerCible(d)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                      >
                        <Send className="w-3 h-3" /> Relancer
                      </button>
                    </div>
                  </div>
                )
              })
            )}
            {dceEnAttente.length > 10 && (
              <div className="px-4 py-2 text-xs text-gray-400 text-center border-t border-gray-100 bg-gray-50">
                + {dceEnAttente.length - 10} autres consultations
              </div>
            )}
          </div>
        </section>

        {/* ─── Section 4 — Marges par projet ─────────────────────── */}
        <section>
          <SectionHeader title="Marges par projet" />
          <div className="bg-white rounded-lg border border-gray-200 shadow-card overflow-hidden">
            {margesLignes.length === 0 ? (
              <div className="py-10 px-6 text-center">
                <p className="text-sm text-gray-500">Aucun projet actif</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Projet</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Budget client</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Coût ST retenu</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Marge €</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Marge %</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {margesLignes.map((m) => {
                      const s = margeStyle(m.marge_pct)
                      return (
                        <tr key={m.projet_id} className={`border-b border-gray-100 last:border-0 ${s.rowBg}`}>
                          <td className="px-4 py-3">
                            <Link
                              href={`/economiste/projets/${m.projet_id}`}
                              className="text-gray-900 font-medium hover:underline"
                            >
                              {m.projet_nom}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700 tabular-nums">
                            {m.budget !== null ? fmtEurHT(m.budget) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700 tabular-nums">
                            {m.cout_st > 0 ? fmtEurHT(m.cout_st) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700 tabular-nums">
                            {m.marge_eur !== null && m.cout_st > 0 ? fmtEurHT(m.marge_eur) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {m.marge_pct !== null ? (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium tabular-nums"
                                style={{ background: s.badgeBg, color: s.badgeColor }}
                              >
                                {m.marge_pct.toFixed(1)}%
                                {s.icon && <AlertTriangle className="w-3 h-3" />}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                              style={{ background: '#F1EFE8', color: '#5F5E5A' }}
                            >
                              {m.statut}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2 border-gray-200 font-medium">
                      <td className="px-4 py-3 text-gray-900">Total</td>
                      <td className="px-4 py-3 text-right text-gray-900 tabular-nums">{fmtEurHT(totalBudget)}</td>
                      <td className="px-4 py-3 text-right text-gray-900 tabular-nums">{fmtEurHT(totalCoutSt)}</td>
                      <td className="px-4 py-3 text-right text-gray-900 tabular-nums">{fmtEurHT(totalMargeEur)}</td>
                      <td className="px-4 py-3 text-right text-gray-900 tabular-nums">
                        {totalMargePct !== null ? `${totalMargePct.toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-4 py-3" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* ─── Section 5 — Activité récente ──────────────────────── */}
        <section>
          <SectionHeader title="Activité récente" />
          <div className="bg-white rounded-lg border border-gray-200 shadow-card overflow-hidden">
            {activiteRecente.length === 0 ? (
              <div className="py-10 px-6 text-center">
                <p className="text-sm text-gray-500">Aucune activité récente</p>
              </div>
            ) : (
              activiteRecente.map((a, idx) => (
                <div
                  key={a.id}
                  className={`flex items-center gap-3 px-4 py-3 ${
                    idx !== activiteRecente.length - 1 ? 'border-b border-gray-100' : ''
                  }`}
                >
                  <ActiviteIcon type={a.type} />
                  <p className="flex-1 text-sm text-gray-700 truncate">{a.description}</p>
                  <span className="text-xs text-gray-400 flex-shrink-0">{relativeDate(a.date)}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* ─── Modal Relance ──────────────────────────────────────── */}
      {relancerCible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRelancerCible(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Relancer {relancerCible.st_label}</h2>
              <button onClick={() => setRelancerCible(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-gray-600">
              Voulez-vous renvoyer le lien DCE à <span className="font-medium">{relancerCible.st_label}</span> pour le lot{' '}
              <span className="font-medium">{relancerCible.lot_nom}</span> ?
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => copierLien(relancerCible.token)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
              >
                <Copy className="w-3.5 h-3.5" /> Copier le lien
              </button>
              <div className="flex-1" />
              <button
                onClick={() => setRelancerCible(null)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Annuler
              </button>
              <button
                onClick={handleRelance}
                disabled={relancerEnvoi}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-black disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {relancerEnvoi ? 'Envoi...' : 'Renvoyer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Toast ──────────────────────────────────────────────── */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium ${
            toast.kind === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}
          onAnimationEnd={() => setTimeout(() => setToast(null), 2500)}
        >
          {toast.msg}
          <button onClick={() => setToast(null)} className="ml-3 opacity-70 hover:opacity-100">
            <X className="w-3.5 h-3.5 inline" />
          </button>
        </div>
      )}
    </div>
  )
}

/* ─── Sous-composants ──────────────────────────────────────────────────── */

function Metric({
  label,
  value,
  subtitle,
  icon,
  accent = 'default',
}: {
  label: string
  value: string
  subtitle: string
  icon: React.ReactNode
  accent?: 'default' | 'amber' | 'blue' | 'red' | 'green'
}) {
  const accentColor =
    accent === 'red' ? 'text-red-600' :
    accent === 'green' ? 'text-emerald-600' :
    accent === 'amber' ? 'text-amber-600' :
    accent === 'blue' ? 'text-blue-600' :
    'text-gray-900'

  return (
    <div
      className="rounded-lg border border-gray-200 p-4"
      style={{ background: 'var(--color-background-secondary, #F7F6F2)' }}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-500">{label}</p>
          <p className={`mt-1 text-[24px] leading-none font-medium ${accentColor} tabular-nums`}>{value}</p>
          <p className="mt-1 text-[12px] text-gray-500">{subtitle}</p>
        </div>
        <div className="p-1.5 rounded-md bg-white/60 text-gray-500 flex-shrink-0">{icon}</div>
      </div>
    </div>
  )
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h2 className="text-[14px] font-medium text-gray-800">{title}</h2>
      {typeof count === 'number' && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium tabular-nums">
          {count}
        </span>
      )}
    </div>
  )
}

function ActiviteIcon({ type }: { type: ActiviteLigne['type'] }) {
  const wrap = 'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0'
  if (type === 'devis_soumis') {
    return (
      <div className={`${wrap} bg-blue-50 text-blue-600`}>
        <FileInput className="w-3.5 h-3.5" />
      </div>
    )
  }
  if (type === 'st_retenu') {
    return (
      <div className={`${wrap} bg-emerald-50 text-emerald-600`}>
        <CheckCircle2 className="w-3.5 h-3.5" />
      </div>
    )
  }
  if (type === 'avenant') {
    return (
      <div className={`${wrap} bg-amber-50 text-amber-600`}>
        <FilePlus2 className="w-3.5 h-3.5" />
      </div>
    )
  }
  return (
    <div className={`${wrap} bg-purple-50 text-purple-600`}>
      <FileSignature className="w-3.5 h-3.5" />
    </div>
  )
}

function SectionSkeleton({ rows = 3, grid = false }: { rows?: number; grid?: boolean }) {
  if (grid) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
            <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
            <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
          </div>
        ))}
      </div>
    )
  }
  return (
    <div>
      <div className="h-4 w-40 bg-gray-200 rounded animate-pulse mb-3" />
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="h-4 flex-1 bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
