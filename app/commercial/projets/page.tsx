'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FolderOpen } from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { fetchMyProjets } from '@/hooks/useMyProjets'
import { TopBar } from '@/components/co/TopBar'
import { StatutBadge } from '@/components/ui/Badge'
import { formatCurrency, formatDateShort, PHASE_ORDER } from '@/lib/utils'
import type { Projet } from '@/types/database'

export default function CommercialProjetsList() {
  const { user, loading } = useUser()
  const [projets, setProjets] = useState<Projet[]>([])
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (!user) return
    fetchMyProjets(user.id)
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

  return (
    <div>
      <TopBar
        title="Mes projets"
        subtitle={`${projets.length} dossier${projets.length !== 1 ? 's' : ''} suivi${projets.length !== 1 ? 's' : ''}`}
      />
      <div className="p-6 space-y-3">
        {projets.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-16 text-center">
            <FolderOpen className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-sm font-medium text-gray-700">Aucun projet</p>
            <p className="text-xs text-gray-400 mt-1">
              Les dossiers que vous suivez apparaîtront ici.
            </p>
          </div>
        ) : (
          projets.map(projet => <ProjetCard key={projet.id} projet={projet} />)
        )}
      </div>
    </div>
  )
}

function ProjetCard({ projet }: { projet: Projet }) {
  const phaseIdx    = PHASE_ORDER.indexOf(projet.statut)
  const safeIdx     = phaseIdx === -1 ? PHASE_ORDER.length - 1 : phaseIdx
  const progression = Math.round(((safeIdx + 1) / PHASE_ORDER.length) * 100)

  return (
    <Link href={`/commercial/projets/${projet.id}`}>
      <div className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-all">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {projet.reference && <span className="text-xs text-gray-400 font-mono">{projet.reference}</span>}
              <StatutBadge statut={projet.statut} />
            </div>
            <p className="text-sm font-semibold text-gray-900 truncate">{projet.nom}</p>
            {projet.client_nom && <p className="text-xs text-gray-500 mt-0.5">{projet.client_nom}</p>}
          </div>
          <div className="text-right flex-shrink-0 space-y-1">
            {projet.budget_total && <p className="text-sm font-semibold text-gray-900">{formatCurrency(projet.budget_total)}</p>}
            {projet.date_livraison && <p className="text-xs text-gray-400">Livraison {formatDateShort(projet.date_livraison)}</p>}
          </div>
        </div>
        <div className="mt-3">
          <div className="flex gap-0.5">
            {PHASE_ORDER.map((_, i) => (
              <div key={i} className={`flex-1 h-1 rounded-full ${i <= safeIdx ? 'bg-gray-900' : 'bg-gray-100'}`} />
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-400">{progression}% du cycle</p>
        </div>
      </div>
    </Link>
  )
}
