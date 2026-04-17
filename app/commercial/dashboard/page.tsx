'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FolderOpen, FolderPlus, CheckCircle2, Clock, TrendingUp, ChevronRight } from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { fetchProjects } from '@/hooks/useProjects'
import { StatCard } from '@/components/co/StatCard'
import { TopBar } from '@/components/co/TopBar'
import { StatutBadge } from '@/components/ui/Badge'
import { formatCurrency, formatDateShort } from '@/lib/utils'
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

export default function CommercialDashboard() {
  const { user, profil, loading } = useUser()
  const [projets,  setProjets]  = useState<Projet[]>([])
  const [fetching, setFetching] = useState(true)
  const [filtre,   setFiltre]   = useState<string | null>(null)

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
        subtitle={`${profil ? `Bonjour, ${profil.prenom} · ` : ''}${projets.length} dossier${projets.length !== 1 ? 's' : ''} · ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
      />

      <div className="p-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Dossiers actifs"
            value={actifs.length}
            subtitle="En cours"
            icon={FolderOpen}
            color="blue"
          />
          <StatCard
            label="En chiffrage"
            value={enChiffrage.length}
            subtitle="Devis en cours"
            icon={Clock}
            color="amber"
          />
          <StatCard
            label="En passation"
            value={enPassation.length}
            subtitle="Transfert au CO"
            icon={TrendingUp}
            color="purple"
          />
          <StatCard
            label="Lances"
            value={lances.length}
            subtitle="Projet operationnel"
            icon={CheckCircle2}
            color="green"
          />
        </div>

        {/* Bouton + Filtres */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-1 flex-wrap">
            {PHASE_FILTERS.map((f) => (
              <button
                key={f.label}
                onClick={() => setFiltre(f.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  filtre === f.value
                    ? 'bg-gray-900 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <Link
            href="/commercial/projets/nouveau"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors flex-shrink-0"
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

function ProjetCard({ projet }: { projet: Projet }) {
  // Map DB lowercase statut to display phase label
  const STATUT_TO_PHASE: Record<string, string> = {
    analyse: 'Analyse', lancement: 'Lancement', passation: 'Passation',
  }
  const phaseCom = STATUT_TO_PHASE[projet.statut] ?? projet.statut ?? 'Analyse'
  const phaseComIdx = PHASES_COMMERCIAL.indexOf(phaseCom as typeof PHASES_COMMERCIAL[number])
  const safePhaseIdx = phaseComIdx === -1 ? 0 : phaseComIdx

  return (
    <Link href={`/commercial/projets/${projet.id}`}>
      <div className="bg-white rounded-lg border border-gray-200 shadow-card hover:border-gray-300 transition-all p-5 group">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {projet.reference && (
                <span className="text-xs text-gray-400 font-mono">{projet.reference}</span>
              )}
              <StatutBadge statut={projet.statut} />
            </div>
            <h3 className="font-semibold text-gray-900 text-sm truncate">{projet.nom}</h3>
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

        {/* Phase commerciale */}
        <div className="mt-4">
          <div className="flex items-center gap-1">
            {PHASES_COMMERCIAL.map((phase, i) => (
              <div key={phase} className="flex items-center gap-1">
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                  i < safePhaseIdx ? 'bg-emerald-100 text-emerald-700' :
                  i === safePhaseIdx ? 'bg-gray-900 text-white' :
                  'bg-gray-100 text-gray-400'
                }`}>
                  {phase}
                </span>
                {i < PHASES_COMMERCIAL.length - 1 && (
                  <ChevronRight className={`w-3 h-3 flex-shrink-0 ${i < safePhaseIdx ? 'text-emerald-400' : 'text-gray-200'}`} />
                )}
              </div>
            ))}
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
      <p className="text-xs text-gray-400 mt-1 mb-6">
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
