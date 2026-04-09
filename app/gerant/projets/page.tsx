'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FolderOpen, MapPin, User, Calendar, ChevronRight } from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'
import { StatutBadge } from '@/components/ui/Badge'
import { formatCurrency, formatDateShort } from '@/lib/utils'
import type { Projet } from '@/types/database'

export default function GerantProjetsList() {
  const { loading } = useUser()
  const [projets, setProjets] = useState<Projet[]>([])
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.schema('app').from('projets').select('*').order('created_at', { ascending: false })
      .then(({ data }) => {
        setProjets((data ?? []) as Projet[])
        setFetching(false)
      })
  }, [])

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
        title="Projets"
        subtitle={`${projets.length} projet${projets.length !== 1 ? 's' : ''} au total`}
      />
      <div className="p-6 space-y-3">
        {projets.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-16 text-center">
            <FolderOpen className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-sm font-medium text-gray-700">Aucun projet assigné</p>
            <p className="text-xs text-gray-400 mt-1">
              Les projets apparaîtront ici une fois que vous serez ajouté à l&apos;équipe.
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
  return (
    <Link href={`/gerant/projets/${projet.id}`}
      className="block bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all group">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {projet.reference && <span className="text-xs text-gray-400 font-mono">{projet.reference}</span>}
            <StatutBadge statut={projet.statut} />
          </div>
          <p className="text-sm font-semibold text-gray-900 truncate">{projet.nom}</p>
          {projet.client_nom && (
            <div className="flex items-center gap-1 mt-1">
              <User className="w-3 h-3 text-gray-400" />
              <p className="text-xs text-gray-500">{projet.client_nom}</p>
            </div>
          )}
          {projet.adresse && (
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 text-gray-400" />
              <p className="text-xs text-gray-400 truncate">{projet.adresse}</p>
            </div>
          )}
        </div>
        <div className="text-right flex-shrink-0 space-y-1 flex flex-col items-end">
          {projet.budget_total && <p className="text-sm font-semibold text-gray-900">{formatCurrency(projet.budget_total)}</p>}
          {projet.date_livraison && (
            <div className="flex items-center gap-1 justify-end">
              <Calendar className="w-3 h-3 text-gray-400" />
              <p className="text-xs text-gray-400">{formatDateShort(projet.date_livraison)}</p>
            </div>
          )}
          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
        </div>
      </div>
    </Link>
  )
}
