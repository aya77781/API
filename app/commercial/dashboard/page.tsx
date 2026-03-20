'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FolderOpen, FolderPlus, CheckCircle2, Clock, TrendingUp } from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { fetchProjects } from '@/hooks/useProjects'
import { StatCard } from '@/components/co/StatCard'
import { TopBar } from '@/components/co/TopBar'
import { StatutBadge } from '@/components/ui/Badge'
import { formatCurrency, formatDateShort, PHASE_ORDER } from '@/lib/utils'
import type { Projet } from '@/types/database'

const PHASE_FILTERS = [
  { label: 'Tous',       value: null },
  { label: 'En cours',   value: 'en_cours' },
  { label: 'Passation',  value: 'passation' },
  { label: 'Achats',     value: 'achats' },
  { label: 'Chantier',   value: 'chantier' },
  { label: 'Clôture',    value: 'cloture' },
  { label: 'Archivés',   value: 'termine' },
]

function getProgression(statut: string): number {
  const idx = PHASE_ORDER.indexOf(statut)
  const safe = idx === -1 ? PHASE_ORDER.length - 1 : idx
  return Math.round(((safe + 1) / PHASE_ORDER.length) * 100)
}

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

  const actifs    = projets.filter((p) => !['cloture', 'gpa', 'termine'].includes(p.statut))
  const passation = projets.filter((p) => p.statut === 'passation')
  const cloturer  = projets.filter((p) => ['cloture', 'gpa', 'termine'].includes(p.statut))

  const projetsFiltres = filtre
    ? filtre === 'en_cours'
      ? projets.filter((p) => !['cloture', 'gpa', 'termine'].includes(p.statut))
      : projets.filter((p) => p.statut === filtre)
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
            label="En passation"
            value={passation.length}
            subtitle="En attente CO"
            icon={Clock}
            color="amber"
          />
          <StatCard
            label="Total dossiers"
            value={projets.length}
            subtitle="Tous statuts"
            icon={TrendingUp}
            color="purple"
          />
          <StatCard
            label="Clôturés"
            value={cloturer.length}
            subtitle="GPA ou terminés"
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
      </div>
    </div>
  )
}

function ProjetCard({ projet }: { projet: Projet }) {
  const progression = getProgression(projet.statut)
  const phaseIdx = PHASE_ORDER.indexOf(projet.statut)
  const safeIdx  = phaseIdx === -1 ? PHASE_ORDER.length - 1 : phaseIdx

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

        {/* Barre de progression */}
        <div className="mt-4">
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
