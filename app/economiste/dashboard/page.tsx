'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  FolderOpen, FileWarning, CheckCircle2, TrendingUp,
  AlertTriangle, Bell, Clock, X, Inbox, Calculator,
} from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { StatCard } from '@/components/co/StatCard'
import { TopBar } from '@/components/co/TopBar'
import { StatutBadge } from '@/components/ui/Badge'
import { formatCurrency, formatDateShort, PHASE_ORDER, STATUTS_TERMINES } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { Alerte } from '@/types/database'
import { RecentDocumentNotifs } from '@/components/shared/RecentDocumentNotifs'
import { Abbr } from '@/components/shared/Abbr'

// ─── Types locaux ─────────────────────────────────────────────────────────────

interface LotMin {
  id: string
  notice_technique: string | null
  statut: string
}

interface AvenantMin {
  id: string
  statut: string
}

interface ProjetDashboard {
  id: string
  nom: string
  reference: string | null
  statut: string
  budget_total: number | null
  date_livraison: string | null
  client_nom: string | null
  lots: LotMin[]
  avenants: AvenantMin[]
}

interface DemandeChiffrage {
  id: string
  projet_id: string
  type: string | null
  statut: string | null
  version: number | null
  message_demandeur: string | null
  date_livraison_souhaitee: string | null
  date_livraison_prevue: string | null
  date_demande: string | null
  demandeur_id: string | null
  projet?: { id: string; nom: string; reference: string | null } | { id: string; nom: string; reference: string | null }[] | null
}

const LABEL_TYPE_CHIFFRAGE: Record<string, string> = {
  estimation_initiale: 'Estimation initiale (V1)',
  chiffrage_proposition: 'Chiffrage affine (V2+)',
  chiffrage_apd: 'Chiffrage APD (final)',
}

// ─── Priorité alertes ────────────────────────────────────────────────────────

const PRIORITE_ORDER: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 }

function sortAlertes(alertes: Alerte[]): Alerte[] {
  return [...alertes].sort(
    (a, b) => (PRIORITE_ORDER[a.priorite] ?? 99) - (PRIORITE_ORDER[b.priorite] ?? 99)
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EconomisteDashboard() {
  const { user, profil, loading } = useUser()

  const [projets,  setProjets]  = useState<ProjetDashboard[]>([])
  const [alertes,  setAlertes]  = useState<Alerte[]>([])
  const [demandes, setDemandes] = useState<DemandeChiffrage[]>([])
  const [demandeurs, setDemandeurs] = useState<Map<string, { prenom: string; nom: string }>>(new Map())
  const [fetching, setFetching] = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  const fetchData = useCallback(async (userId: string) => {
    setFetching(true)
    setError(null)
    try {
      const supabase = createClient()
      const [projetsRes, lotsRes, avenantsRes, alertesRes] = await Promise.all([
        supabase
          .schema('app')
          .from('projets')
          .select('id, nom, reference, statut, budget_total, date_livraison, client_nom')
          .eq('economiste_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .schema('app')
          .from('lots')
          .select('id, projet_id, notice_technique, statut'),
        supabase
          .schema('app')
          .from('avenants')
          .select('id, projet_id, statut')
          .eq('statut', 'ouvert'),
        supabase
          .schema('app')
          .from('alertes')
          .select('*')
          .eq('utilisateur_id', userId)
          .eq('lue', false)
          .order('created_at', { ascending: false }),
      ])

      if (projetsRes.error) throw new Error(projetsRes.error.message)
      if (lotsRes.error)    throw new Error(lotsRes.error.message)
      if (avenantsRes.error) throw new Error(avenantsRes.error.message)
      if (alertesRes.error) throw new Error(alertesRes.error.message)

      const projetsData   = (projetsRes.data   ?? []) as { id: string; nom: string; reference: string | null; statut: string; budget_total: number | null; date_livraison: string | null; client_nom: string | null }[]
      const lotsData      = (lotsRes.data      ?? []) as (LotMin & { projet_id: string })[]
      const avenantsData  = (avenantsRes.data  ?? []) as (AvenantMin & { projet_id: string })[]

      const enriched: ProjetDashboard[] = projetsData.map((p) => ({
        ...p,
        lots:     lotsData.filter((l) => l.projet_id === p.id),
        avenants: avenantsData.filter((a) => a.projet_id === p.id),
      }))

      setProjets(enriched)
      setAlertes(sortAlertes((alertesRes.data ?? []) as Alerte[]))

      // Demandes de chiffrage adressees a l'economiste (via profil.id = utilisateurs.id)
      if (profil?.id) {
        const { data: demData } = await supabase.schema('app').from('demandes_travail')
          .select('id, projet_id, type, statut, version, message_demandeur, date_livraison_souhaitee, date_livraison_prevue, date_demande, demandeur_id, projet:projets(id, nom, reference)')
          .eq('destinataire_id', profil.id)
          .in('type', ['estimation_initiale', 'chiffrage_proposition', 'chiffrage_apd'])
          .in('statut', ['en_attente', 'en_cours'])
          .order('date_livraison_souhaitee', { ascending: true, nullsFirst: false })
        const demList = (demData ?? []) as DemandeChiffrage[]
        setDemandes(demList)

        const demandeurIds = Array.from(new Set(demList.map(d => d.demandeur_id).filter(Boolean))) as string[]
        if (demandeurIds.length) {
          const { data: usersData } = await supabase.schema('app').from('utilisateurs')
            .select('id, prenom, nom').in('id', demandeurIds)
          setDemandeurs(new Map((usersData ?? []).map(u => [u.id, { prenom: u.prenom, nom: u.nom }])))
        } else {
          setDemandeurs(new Map())
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors du chargement')
    } finally {
      setFetching(false)
    }
  }, [profil?.id])

  useEffect(() => {
    if (!user) return
    fetchData(user.id)
  }, [user, fetchData])

  async function marquerLu(alerteId: string) {
    const supabase = createClient()
    await supabase.schema('app').from('alertes').update({ lue: true }).eq('id', alerteId)
    setAlertes((prev) => prev.filter((a) => a.id !== alerteId))
  }

  // ── Calculs ──────────────────────────────────────────────────────────────

  const actifs = projets.filter((p) => !STATUTS_TERMINES.includes(p.statut))

  const lotsAChiffrer = projets.reduce((acc, p) => {
    return acc + p.lots.filter((l) => !l.notice_technique).length
  }, 0)

  const avenantsOuverts = projets.reduce((acc, p) => {
    return acc + p.avenants.filter((a) => a.statut === 'ouvert').length
  }, 0)

  const parStatut = PHASE_ORDER.reduce<Record<string, number>>((acc, phase) => {
    acc[phase] = projets.filter((p) => p.statut === phase).length
    return acc
  }, {})

  const projetsRecents = projets.slice(0, 5)

  const now = Date.now()
  const in30days = now + 30 * 24 * 60 * 60 * 1000
  const projetsAlerte = actifs.filter(
    (p) => p.date_livraison && new Date(p.date_livraison).getTime() < in30days
  )

  // ── States de chargement ─────────────────────────────────────────────────

  if (loading || fetching) return <DashboardSkeleton />

  if (error) {
    return (
      <div>
        <TopBar title="Tableau de bord" />
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800">Erreur de chargement</p>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
            </div>
            <button
              onClick={() => user && fetchData(user.id)}
              className="ml-auto text-xs text-red-700 underline"
            >
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
        title="Tableau de bord"
        subtitle={`${profil ? `Bonjour, ${profil.prenom} · ` : ''}${projets.length} dossier${projets.length !== 1 ? 's' : ''} · ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
      />

      <div className="p-6 space-y-8">

        {/* ── KPIs ─────────────────────────────────────────────────────────── */}
        <section>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Projets actifs"
              value={actifs.length}
              subtitle="Assignés à vous"
              icon={FolderOpen}
              color="blue"
            />
            <StatCard
              label="Lots à chiffrer"
              value={lotsAChiffrer}
              subtitle="Sans notice technique"
              icon={Bell}
              color={lotsAChiffrer > 0 ? 'amber' : 'default'}
            />
            <StatCard
              label="Avenants en attente"
              value={avenantsOuverts}
              subtitle="Statut ouvert"
              icon={FileWarning}
              color={avenantsOuverts > 0 ? 'purple' : 'default'}
            />
            <StatCard
              label="Marge moyenne"
              value="— %"
              subtitle="Données insuffisantes"
              icon={TrendingUp}
              color="green"
            />
          </div>
        </section>

        {/* ── Demandes de chiffrage du commercial ──────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Inbox className="w-4 h-4 text-emerald-600" />
              Demandes de chiffrage
              {demandes.length > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-600 text-white font-bold">{demandes.length}</span>
              )}
            </h2>
          </div>
          {demandes.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-sm text-gray-400 italic">
              Aucune demande en attente. Tu seras notifie ici quand un commercial te demandera une estimation.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {demandes.map(d => {
                const projet = Array.isArray(d.projet) ? d.projet[0] : d.projet
                const dem = d.demandeur_id ? demandeurs.get(d.demandeur_id) : null
                const dateLim = d.date_livraison_souhaitee ?? d.date_livraison_prevue
                const days = dateLim ? Math.ceil((new Date(dateLim).getTime() - Date.now()) / 86400000) : null
                const labelV = d.type === 'chiffrage_apd' ? 'APD' : `V${d.version ?? 1}`
                const tone = d.statut === 'en_cours'
                  ? 'bg-amber-50 border-amber-200'
                  : days != null && days < 0 ? 'bg-red-50 border-red-200'
                  : days != null && days <= 4 ? 'bg-orange-50 border-orange-200'
                  : 'bg-emerald-50 border-emerald-200'
                const dotCls = d.statut === 'en_cours' ? 'bg-amber-500' :
                  days != null && days < 0 ? 'bg-red-500' :
                  days != null && days <= 4 ? 'bg-orange-500' : 'bg-emerald-500'
                return (
                  <Link
                    key={d.id}
                    href={`/economiste/projets/${d.projet_id}?tab=chiffrage`}
                    className={`block rounded-xl border p-4 hover:shadow-md transition-all ${tone}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Calculator className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-gray-900 text-white">{labelV}</span>
                        <span className={`w-2 h-2 rounded-full ${dotCls}`} />
                        <span className="text-xs text-gray-600">{d.statut === 'en_cours' ? 'En cours' : 'A traiter'}</span>
                      </div>
                      {dateLim && (
                        <span className="text-xs text-gray-500 inline-flex items-center gap-1 flex-shrink-0">
                          <Clock className="w-3 h-3" />
                          {days != null && days < 0 ? `Retard ${Math.abs(days)}j` : days != null ? `J-${days}` : '—'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {projet?.reference ? `${projet.reference} — ` : ''}{projet?.nom ?? '—'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{LABEL_TYPE_CHIFFRAGE[d.type ?? ''] ?? d.type}</p>
                    {dem && <p className="text-xs text-gray-400 mt-1">Par {dem.prenom} {dem.nom}</p>}
                    {d.message_demandeur && (
                      <p className="text-xs text-gray-600 mt-2 line-clamp-2">{d.message_demandeur}</p>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Répartition par phase ─────────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Répartition par phase</h2>
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-5">
            <div className="grid grid-cols-4 lg:grid-cols-7 gap-3">
              {PHASE_ORDER.map((phase) => (
                <div key={phase} className="text-center">
                  <div className="w-10 h-10 mx-auto rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center">
                    <span className="text-lg font-semibold text-gray-900">
                      {parStatut[phase] ?? 0}
                    </span>
                  </div>
                  <StatutBadge statut={phase} className="mt-2" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Liste projets ──────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Mes projets</h2>
              <Link href="/economiste/projets" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
                Voir tout →
              </Link>
            </div>

            {projetsRecents.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 shadow-card p-10 text-center">
                <FolderOpen className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700">Aucun projet assigné</p>
                <p className="text-xs text-gray-400 mt-1">
                  Les projets apparaîtront ici une fois assignés par le commercial.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {projetsRecents.map((projet) => (
                  <ProjetRow key={projet.id} projet={projet} />
                ))}
              </div>
            )}
          </div>

          {/* ── Panneau droit ──────────────────────────────────────────────── */}
          <div className="space-y-4">
            <RecentDocumentNotifs roleBase="economiste" />

            {/* Alertes du jour */}
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Alertes du jour</h2>

              {alertes.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 shadow-card p-6 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-700">Tout est à jour</p>
                  <p className="text-xs text-gray-400 mt-1">Aucune alerte non lue</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {alertes.slice(0, 5).map((a) => (
                    <div
                      key={a.id}
                      className={`rounded-lg border p-3 ${
                        a.priorite === 'urgent' ? 'border-red-200 bg-red-50' :
                        a.priorite === 'high'   ? 'border-amber-200 bg-amber-50' :
                        'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${
                          a.priorite === 'urgent' ? 'text-red-500' :
                          a.priorite === 'high'   ? 'text-amber-500' : 'text-gray-400'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">{a.titre}</p>
                          {a.message && (
                            <p className="text-xs text-gray-400 truncate">{a.message}</p>
                          )}
                        </div>
                        <button
                          onClick={() => marquerLu(a.id)}
                          className="ml-1 p-0.5 rounded hover:bg-black/10 transition-colors flex-shrink-0"
                          title="Marquer comme lu"
                        >
                          <X className="w-3 h-3 text-gray-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Attention requise — projets proches de l'échéance */}
            {projetsAlerte.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Attention requise</h2>
                <div className="space-y-2">
                  {projetsAlerte.map((projet) => (
                    <Link
                      key={projet.id}
                      href={`/economiste/projets/${projet.id}`}
                      className="block bg-white rounded-lg border border-amber-200 shadow-card p-4 hover:border-amber-300 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <Clock className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{projet.nom}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Livraison : {projet.date_livraison
                              ? new Date(projet.date_livraison).toLocaleDateString('fr-FR')
                              : '—'}
                          </p>
                        </div>
                        <StatutBadge statut={projet.statut} />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Principe */}
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
              <div className="flex items-start gap-3">
                <TrendingUp className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-gray-600">Principe API</p>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                    L&apos;IA prépare les notices · vous validez les chiffrages · le <Abbr k="CO" /> pilote.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Carte projet ─────────────────────────────────────────────────────────────

function ProjetRow({ projet }: { projet: ProjetDashboard }) {
  const phaseIdx  = PHASE_ORDER.indexOf(projet.statut)
  const safeIdx   = phaseIdx === -1 ? PHASE_ORDER.length - 1 : phaseIdx
  const progression = Math.round(((safeIdx + 1) / PHASE_ORDER.length) * 100)

  const lotsAChiffrer    = projet.lots.filter((l) => !l.notice_technique).length
  const avenantsUrgents  = projet.avenants.filter((a) => a.statut === 'ouvert').length

  return (
    <Link href={`/economiste/projets/${projet.id}`}>
      <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4 hover:border-gray-300 transition-all">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {projet.reference && (
                <span className="text-xs text-gray-400 font-mono">{projet.reference}</span>
              )}
              <StatutBadge statut={projet.statut} />
              {lotsAChiffrer > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-600 border border-orange-200 rounded-full text-xs font-medium">
                  <FileWarning className="w-3 h-3" />
                  Chiffrage à soumettre
                </span>
              )}
              {avenantsUrgents > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded-full text-xs font-medium">
                  <AlertTriangle className="w-3 h-3" />
                  Avenant urgent
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-gray-900 truncate">{projet.nom}</p>
            {projet.client_nom && (
              <p className="text-xs text-gray-500 mt-0.5">{projet.client_nom}</p>
            )}
          </div>
          <div className="text-right flex-shrink-0 space-y-1">
            {projet.budget_total && (
              <p className="text-sm font-semibold text-gray-900">
                {formatCurrency(projet.budget_total)}
              </p>
            )}
            {projet.date_livraison && (
              <p className="text-xs text-gray-400">
                Livraison {formatDateShort(projet.date_livraison)}
              </p>
            )}
          </div>
        </div>

        {/* Barre de progression */}
        <div className="mt-3">
          <div className="flex gap-0.5">
            {PHASE_ORDER.map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-1 rounded-full ${i <= safeIdx ? 'bg-gray-900' : 'bg-gray-100'}`}
              />
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-400">{progression}% du cycle</p>
        </div>
      </div>
    </Link>
  )
}

// ─── Skeleton loading ────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div>
      <div className="h-16 bg-white border-b border-gray-200 px-6 flex items-center">
        <div className="h-4 w-40 bg-gray-200 rounded animate-pulse" />
      </div>
      <div className="p-6 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
              <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
              <div className="h-7 w-16 bg-gray-200 rounded animate-pulse" />
              <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
        {/* Phase */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="grid grid-cols-7 gap-3">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
                <div className="h-3 w-12 bg-gray-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
        {/* Projets */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                <div className="flex justify-between">
                  <div className="space-y-2">
                    <div className="h-3 w-32 bg-gray-200 rounded animate-pulse" />
                    <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
                  </div>
                  <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                </div>
                <div className="h-1 bg-gray-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
                <div className="h-3 w-32 bg-gray-200 rounded animate-pulse" />
                <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
