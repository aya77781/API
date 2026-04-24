'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FolderOpen, FolderPlus, CheckCircle2, Clock, TrendingUp, ChevronRight, ListTodo, Circle, Calendar, RotateCw, MoreHorizontal, Trash2 } from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { fetchProjects } from '@/hooks/useProjects'
import { useTaches, type Tache, type TacheStatut, type TacheUrgence } from '@/hooks/useTaches'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'
import { formatCurrency, formatDateShort, cn } from '@/lib/utils'
import type { Projet } from '@/types/database'
import { RecentDocumentNotifs } from '@/components/shared/RecentDocumentNotifs'

const PHASES_COMMERCIAL = ['Analyse', 'Chiffrage', 'Contrat', 'Passation', 'Lancement'] as const

const PHASE_FILTERS = [
  { label: 'Tous',       value: null },
  { label: 'Analyse',    value: 'Analyse' },
  { label: 'Chiffrage',  value: 'Chiffrage' },
  { label: 'Contrat',    value: 'Contrat' },
  { label: 'Passation',  value: 'Passation' },
  { label: 'Lancement',  value: 'Lancement' },
]

export default function DashboardClient() {
  const { user, profil, loading } = useUser()
  const [projets,  setProjets]  = useState<Projet[]>([])
  const [fetching, setFetching] = useState(true)
  const [filtre,   setFiltre]   = useState<string | null>(null)
  const dateLabel = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  useEffect(() => {
    if (!user) return
    fetchProjects(user.id)
      .then(setProjets)
      .catch(console.error)
      .finally(() => setFetching(false))
  }, [user])

  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    )
  }

  const st = (p: { statut: string }) => p.statut.toLowerCase()
  const actifs    = projets.filter((p) => !['lancement', 'termine', 'cloture', 'gpa'].includes(st(p)))
  const enChiffrage = projets.filter((p) => st(p) === 'analyse')
  const enPassation = projets.filter((p) => st(p) === 'passation')
  const lances      = projets.filter((p) => st(p) === 'lancement')

  const projetsFiltres = filtre
    ? projets.filter((p) => st(p) === (filtre === 'Chiffrage' || filtre === 'Contrat' ? 'analyse' : filtre.toLowerCase()))
    : projets

  return (
    <div>
      <TopBar
        title="Mes projets"
        subtitle={`${profil ? `Bonjour, ${profil.prenom} · ` : ''}${projets.length} dossier${projets.length !== 1 ? 's' : ''}${dateLabel ? ` · ${dateLabel}` : ''}`}
      />

      <div className="p-6 space-y-6">

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Dossiers actifs" value={actifs.length} subtitle="En cours"
            iconBg="#DBEAFE" iconColor="#3B82F6" icon={<FolderOpen className="w-5 h-5" />} />
          <KpiCard label="En chiffrage" value={enChiffrage.length} subtitle="Devis en cours"
            iconBg="#FEF3C7" iconColor="#F59E0B" icon={<Clock className="w-5 h-5" />} />
          <KpiCard label="En passation" value={enPassation.length} subtitle="Transfert au CO"
            iconBg="#EDE9FE" iconColor="#8B5CF6" icon={<TrendingUp className="w-5 h-5" />} />
          <KpiCard label="Lances" value={lances.length} subtitle="Projet operationnel"
            iconBg="#D1FAE5" iconColor="#10B981" icon={<CheckCircle2 className="w-5 h-5" />} />
        </div>

        {/* Widget taches juste sous les stats */}
        <TachesOverview />

        {/* Filtres + bouton Nouveau dossier */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {PHASE_FILTERS.map((f) => {
              const active = filtre === f.value
              return (
                <button
                  key={f.label}
                  onClick={() => setFiltre(f.value)}
                  className={cn(
                    'px-5 py-2 text-sm font-medium rounded-full transition-colors',
                    active
                      ? 'text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50',
                  )}
                  style={active ? { backgroundColor: '#1B2A4A' } : undefined}
                >
                  {f.label}
                </button>
              )
            })}
          </div>
          <Link
            href="/commercial/projets/nouveau"
            className="inline-flex items-center gap-2 px-6 py-3 text-white text-sm font-semibold rounded-lg shadow-sm hover:opacity-90 transition-opacity flex-shrink-0"
            style={{ backgroundColor: '#F59E0B' }}
          >
            <FolderPlus className="w-4 h-4" />
            Nouveau dossier
          </Link>
        </div>

        {/* Liste */}
        {projetsFiltres.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-3">
            {projetsFiltres.map((projet) => (
              <ProjetCard key={projet.id} projet={projet} />
            ))}
          </div>
        )}

        <RecentDocumentNotifs roleBase="commercial" />
      </div>
    </div>
  )
}

/* ── KPI Card ── */

function KpiCard({ label, value, subtitle, iconBg, iconColor, icon }: {
  label: string; value: number; subtitle: string
  iconBg: string; iconColor: string; icon: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-[#E8ECF0] p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#9CA3AF', letterSpacing: '0.5px' }}>{label}</p>
          <p className="mt-2 text-4xl font-bold leading-none" style={{ color: '#1A202C' }}>{value}</p>
          <p className="mt-2 text-sm" style={{ color: '#9CA3AF' }}>{subtitle}</p>
        </div>
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: iconBg, color: iconColor }}>
          {icon}
        </div>
      </div>
    </div>
  )
}

/* ── Widget : Apercu des taches ── */

const URGENCE_STYLE: Record<string, { label: string; className: string }> = {
  faible:   { label: 'Faible',   className: 'bg-emerald-100 text-emerald-700' },
  normal:   { label: 'Moyenne',  className: 'bg-amber-100 text-amber-700' },
  urgent:   { label: 'Elevee',   className: 'bg-violet-100 text-violet-700' },
  critique: { label: 'Critique', className: 'bg-red-100 text-red-700' },
}

const STATUT_STYLE: Record<string, { label: string; className: string }> = {
  a_faire:    { label: 'A faire',    className: 'bg-gray-100 text-gray-700' },
  en_cours:   { label: 'En cours',   className: 'bg-blue-100 text-blue-700' },
  en_attente: { label: 'En attente', className: 'bg-amber-50 text-amber-700' },
  fait:       { label: 'Fait',       className: 'bg-emerald-100 text-emerald-700' },
}

function dueTag(date_echeance: string | null): { label: string; className: string } | null {
  if (!date_echeance) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(date_echeance); due.setHours(0, 0, 0, 0)
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return { label: 'En retard', className: 'bg-red-100 text-red-700' }
  if (diffDays === 0) return { label: "Aujourd'hui", className: 'bg-amber-100 text-amber-700' }
  if (diffDays <= 2) return { label: 'A risque', className: 'bg-amber-100 text-amber-700' }
  if (diffDays <= 7) return { label: `Dans ${diffDays}j`, className: 'bg-blue-100 text-blue-700' }
  return null
}

function formatEcheance(date_echeance: string | null): string {
  if (!date_echeance) return '--'
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(date_echeance); due.setHours(0, 0, 0, 0)
  const formatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
  if (today.getTime() === due.getTime()) return `Aujourd'hui — ${formatter.format(due)}`
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
  if (tomorrow.getTime() === due.getTime()) return `Demain — ${formatter.format(due)}`
  return formatter.format(due)
}

function Avatar({ prenom, nom, color = 'amber' }: { prenom: string; nom: string; color?: string }) {
  const colors: Record<string, string> = {
    amber: 'bg-amber-100 text-amber-700',
    blue: 'bg-blue-100 text-blue-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    violet: 'bg-violet-100 text-violet-700',
    pink: 'bg-pink-100 text-pink-700',
  }
  return (
    <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0', colors[color] ?? colors.amber)}>
      {prenom[0]?.toUpperCase()}{nom[0]?.toUpperCase()}
    </div>
  )
}

const STATUT_CYCLE: Record<TacheStatut, TacheStatut> = {
  a_faire: 'en_cours',
  en_cours: 'fait',
  en_attente: 'fait',
  fait: 'a_faire',
}

const URGENCE_CYCLE: Record<TacheUrgence, TacheUrgence> = {
  faible: 'normal',
  normal: 'urgent',
  urgent: 'critique',
  critique: 'faible',
}

function isRelanceRecente(date_rappel: string | null): boolean {
  if (!date_rappel) return false
  const days = (Date.now() - new Date(date_rappel).getTime()) / (1000 * 60 * 60 * 24)
  return days >= 0 && days <= 7
}

function TachesOverview() {
  const { user, profil } = useUser()
  const { fetchMesTaches, updateTache, updateStatut, deleteTache } = useTaches()
  const [taches, setTaches] = useState<Tache[]>([])
  const [loading, setLoading] = useState(true)
  const [openMenu, setOpenMenu] = useState<{ id: string; top: number; right: number } | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    fetchMesTaches(user.id, 'commercial')
      .then(setTaches)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user, fetchMesTaches])

  async function cycleStatut(t: Tache) {
    const next = STATUT_CYCLE[t.statut]
    setTaches(prev => prev.map(x => x.id === t.id ? { ...x, statut: next } : x))
    await updateStatut(t.id, next)
  }

  async function cycleUrgence(t: Tache) {
    const next = URGENCE_CYCLE[t.urgence]
    setTaches(prev => prev.map(x => x.id === t.id ? { ...x, urgence: next } : x))
    await updateTache(t.id, { urgence: next })
  }

  async function relancer(t: Tache) {
    if (!user || !profil) return
    const now = new Date().toISOString()

    // 1. MAJ date_rappel pour le tag visuel
    setTaches(prev => prev.map(x => x.id === t.id ? { ...x, date_rappel: now } : x))
    await updateTache(t.id, { date_rappel: now })

    // 2. Envoi des notifications a toute l equipe taguee + assignee
    const supabase = createClient()
    const destinataires = new Set<string>()
    if (t.assignee_a) destinataires.add(t.assignee_a)
    for (const uid of t.tags_utilisateurs ?? []) destinataires.add(uid)
    destinataires.delete(user.id) // ne pas se notifier soi-meme

    // Si tag_tous, ajouter tous les utilisateurs actifs
    if (t.tag_tous) {
      const { data: allUsers } = await supabase.schema('app').from('utilisateurs')
        .select('id').eq('actif', true).neq('id', user.id)
      for (const u of allUsers ?? []) destinataires.add(u.id)
    }

    // Si tags_roles, ajouter tous les utilisateurs ayant ces roles
    if ((t.tags_roles ?? []).length > 0) {
      const { data: roleUsers } = await supabase.schema('app').from('utilisateurs')
        .select('id').eq('actif', true).in('role', t.tags_roles).neq('id', user.id)
      for (const u of roleUsers ?? []) destinataires.add(u.id)
    }

    if (destinataires.size > 0) {
      const dateStr = t.date_echeance ? new Date(t.date_echeance).toLocaleDateString('fr-FR') : 'non definie'
      await supabase.schema('app').from('alertes').insert(
        Array.from(destinataires).map(uid => ({
          utilisateur_id: uid,
          type: 'tache',
          titre: `${profil.prenom} ${profil.nom} relance la tache`,
          message: `${t.titre} - Echeance : ${dateStr}`,
          priorite: t.urgence === 'critique' ? 'urgent' : 'normal',
          lue: false,
        }))
      )
      setToast(`Relance envoyee a ${destinataires.size} personne${destinataires.size > 1 ? 's' : ''}`)
    } else {
      setToast('Tag "Relance" ajoute (aucun destinataire a notifier)')
    }
    setTimeout(() => setToast(null), 3500)
    setOpenMenu(null)
  }

  async function supprimer(t: Tache) {
    if (!confirm(`Supprimer la tache "${t.titre}" ?`)) return
    setTaches(prev => prev.filter(x => x.id !== t.id))
    await deleteTache(t.id)
    setOpenMenu(null)
  }

  const aFaire = taches.filter(t => t.statut !== 'fait').slice(0, 8)
  const total = taches.filter(t => t.statut !== 'fait').length

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-card overflow-hidden relative">
      {/* Toast */}
      {toast && (
        <div className="absolute top-3 right-3 z-30 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 flex items-center gap-2 shadow-sm">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListTodo className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-900">A faire</h2>
          <span className="text-sm text-gray-400">({total})</span>
        </div>
        <Link href="/commercial/todo" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
          Voir toutes →
        </Link>
      </div>

      {loading ? (
        <div className="px-5 py-8 text-center">
          <div className="w-4 h-4 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin mx-auto" />
        </div>
      ) : aFaire.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-700">Aucune tache en cours</p>
          <p className="text-sm text-gray-400 mt-0.5">Tout est a jour</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-2.5 w-8" />
                <th className="px-4 py-2.5">Tache</th>
                <th className="px-4 py-2.5 w-44">Cree par</th>
                <th className="px-4 py-2.5 w-48">Partage avec</th>
                <th className="px-4 py-2.5 w-36">Echeance</th>
                <th className="px-4 py-2.5 w-28">Priorite</th>
                <th className="px-4 py-2.5">Statut</th>
                <th className="px-4 py-2.5 w-12 text-right">Options</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {aFaire.map(t => {
                const urg = URGENCE_STYLE[t.urgence] ?? URGENCE_STYLE.normal
                const stat = STATUT_STYLE[t.statut] ?? STATUT_STYLE.a_faire
                const due = dueTag(t.date_echeance)
                const createur = t.createur ?? (t.creee_par === user?.id && profil ? { id: user.id, prenom: profil.prenom, nom: profil.nom } : null)
                const partages = t.destinataires ?? []
                const tagsRoles = t.tags_roles ?? []
                const relance = isRelanceRecente(t.date_rappel)
                return (
                  <tr key={t.id} className="hover:bg-gray-50/60 transition-colors group">
                    {/* Check */}
                    <td className="px-4 py-2.5">
                      <button onClick={() => cycleStatut(t)} title="Changer statut">
                        {t.statut === 'fait'
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          : <Circle className="w-4 h-4 text-gray-300 hover:text-gray-500 transition-colors" />}
                      </button>
                    </td>

                    {/* Tache */}
                    <td className="px-4 py-2.5">
                      <p className="text-sm text-gray-900 truncate">{t.titre}</p>
                      {t.projet && <p className="text-xs text-gray-400 truncate mt-0.5">{t.projet.nom}</p>}
                    </td>

                    {/* Cree par */}
                    <td className="px-4 py-2.5">
                      {createur ? (
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar prenom={createur.prenom} nom={createur.nom} color="amber" />
                          <span className="text-sm text-gray-700 truncate">{createur.prenom} {createur.nom}</span>
                        </div>
                      ) : <span className="text-sm text-gray-300">--</span>}
                    </td>

                    {/* Partage avec */}
                    <td className="px-4 py-2.5">
                      {partages.length === 0 && tagsRoles.length === 0 && !t.tag_tous ? (
                        <span className="text-sm text-gray-300">--</span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {/* Avatars empiles */}
                          {partages.length > 0 && (
                            <div className="flex -space-x-1.5">
                              {partages.slice(0, 3).map((u, i) => (
                                <div key={u.id} className="ring-2 ring-white rounded-full" style={{ zIndex: 10 - i }}>
                                  <Avatar prenom={u.prenom} nom={u.nom} color={['blue', 'emerald', 'violet', 'pink'][i % 4]} />
                                </div>
                              ))}
                              {partages.length > 3 && (
                                <div className="w-6 h-6 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[10px] font-semibold text-gray-600">
                                  +{partages.length - 3}
                                </div>
                              )}
                            </div>
                          )}
                          {/* Tags roles */}
                          {tagsRoles.slice(0, 2).map(r => (
                            <span key={r} className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-gray-600 capitalize">
                              {r}
                            </span>
                          ))}
                          {t.tag_tous && (
                            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-violet-100 text-violet-700">
                              Tous
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Echeance */}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Calendar className="w-3 h-3 text-gray-300" />
                        <span className="truncate">{formatEcheance(t.date_echeance)}</span>
                      </div>
                    </td>

                    {/* Priorite (cliquable) */}
                    <td className="px-4 py-2.5">
                      <button onClick={() => cycleUrgence(t)} title="Changer priorite"
                        className={cn('inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full hover:opacity-80 transition-opacity', urg.className)}>
                        {urg.label}
                      </button>
                    </td>

                    {/* Statut multi-tags (cliquable pour cycler) */}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1 flex-wrap">
                        <button onClick={() => cycleStatut(t)} title="Changer statut"
                          className={cn('inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full hover:opacity-80 transition-opacity', stat.className)}>
                          {stat.label}
                        </button>
                        {due && (
                          <span className={cn('inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full', due.className)}>
                            {due.label}
                          </span>
                        )}
                        {relance && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-orange-100 text-orange-700">
                            <RotateCw className="w-2.5 h-2.5" /> Relance
                          </span>
                        )}
                        {t.projet && (
                          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full bg-indigo-50 text-indigo-700">
                            Projet
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Options */}
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={(e) => {
                          if (openMenu?.id === t.id) {
                            setOpenMenu(null)
                          } else {
                            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
                            setOpenMenu({ id: t.id, top: rect.bottom + 4, right: window.innerWidth - rect.right })
                          }
                        }}
                        className="p-1 text-gray-300 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Menu options - position fixed pour echapper au clipping */}
      {openMenu && (() => {
        const t = aFaire.find(x => x.id === openMenu.id)
        if (!t) return null
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(null)} />
            <div className="fixed z-50 w-48 bg-white border border-gray-200 rounded-lg shadow-xl py-1"
              style={{ top: openMenu.top, right: openMenu.right }}>
              <button onClick={() => relancer(t)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">
                <RotateCw className="w-3.5 h-3.5 text-orange-500" /> Relancer
              </button>
              <button onClick={() => { cycleStatut(t); setOpenMenu(null) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Changer statut
              </button>
              <button onClick={() => { cycleUrgence(t); setOpenMenu(null) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">
                <TrendingUp className="w-3.5 h-3.5 text-violet-500" /> Changer priorite
              </button>
              <div className="border-t border-gray-100 my-1" />
              <button onClick={() => supprimer(t)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 text-left">
                <Trash2 className="w-3.5 h-3.5" /> Supprimer
              </button>
            </div>
          </>
        )
      })()}
    </div>
  )
}

function ProjetCard({ projet }: { projet: Projet }) {
  const STATUT_TO_PHASE: Record<string, string> = {
    analyse: 'Analyse', lancement: 'Lancement', passation: 'Passation',
  }
  const phaseCom = STATUT_TO_PHASE[projet.statut] ?? projet.statut ?? 'Analyse'
  const phaseComIdx = PHASES_COMMERCIAL.indexOf(phaseCom as typeof PHASES_COMMERCIAL[number])
  const safePhaseIdx = phaseComIdx === -1 ? 0 : phaseComIdx

  return (
    <Link href={`/commercial/projets/${projet.id}`} className="block">
      <div className="bg-white rounded-xl border border-[#E8ECF0] hover:shadow-md transition-shadow px-6 py-5"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div className="flex items-start justify-between gap-6">
          {/* Cote gauche */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              {projet.reference && (
                <span className="text-sm font-mono" style={{ color: '#9CA3AF' }}>{projet.reference}</span>
              )}
              <span className="text-sm" style={{ color: '#6B7280' }}>{phaseCom}</span>
            </div>
            <h3 className="text-lg font-bold truncate" style={{ color: '#1A202C' }}>{projet.nom}</h3>
            {projet.client_nom && (
              <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>{projet.client_nom}</p>
            )}

            {/* Stepper phases */}
            <div className="mt-4 flex items-center gap-1.5 flex-wrap">
              {PHASES_COMMERCIAL.map((phase, i) => (
                <div key={phase} className="flex items-center gap-1.5">
                  <span className={cn(
                    'px-2.5 py-1 rounded text-sm font-medium',
                    i === safePhaseIdx ? 'text-white' : '',
                  )}
                  style={{
                    backgroundColor: i === safePhaseIdx ? '#1B2A4A' : 'transparent',
                    color: i === safePhaseIdx ? '#FFFFFF' : i < safePhaseIdx ? '#1A202C' : '#9CA3AF',
                  }}>
                    {phase}
                  </span>
                  {i < PHASES_COMMERCIAL.length - 1 && (
                    <span className="text-base" style={{ color: '#9CA3AF' }}>›</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Cote droit */}
          <div className="text-right flex-shrink-0 space-y-1 pt-1">
            {projet.budget_total && (
              <p className="text-xl font-bold" style={{ color: '#1A202C' }}>
                {formatCurrency(projet.budget_total)}
              </p>
            )}
            {projet.date_livraison && (
              <p className="text-sm" style={{ color: '#9CA3AF' }}>
                Livraison {formatDateShort(projet.date_livraison)}
              </p>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

function EmptyState() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-card p-16 text-center">
      <FolderOpen className="w-12 h-12 text-gray-200 mx-auto mb-4" />
      <p className="text-sm font-medium text-gray-700">Aucun dossier</p>
      <p className="text-sm text-gray-400 mt-1 mb-6">
        Vous n&apos;avez pas encore de projets dans cette catégorie.
      </p>
      <Link
        href="/commercial/projets/nouveau"
        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
      >
        <FolderPlus className="w-4 h-4" />
        Créer mon premier dossier
      </Link>
    </div>
  )
}
