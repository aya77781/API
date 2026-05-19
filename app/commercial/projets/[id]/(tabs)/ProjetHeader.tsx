'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { ArrowLeft, Pencil } from 'lucide-react'
import { StatutBadge, StatutCommercialBadge } from '@/components/ui/Badge'

interface ProjetHeaderProps {
  projet: {
    id: string
    nom: string
    reference: string | null
    client_nom: string | null
    statut: string
    statut_commercial: string
  }
}

export function ProjetHeader({ projet }: ProjetHeaderProps) {
  const pathname = usePathname()
  const onModifier = pathname.endsWith('/modifier')

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-start gap-4">
        <Link
          href="/commercial/projets"
          className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors flex-shrink-0 mt-0.5"
          aria-label="Retour à la liste"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {projet.reference && (
              <span className="text-xs text-gray-400 font-mono">{projet.reference}</span>
            )}
            <StatutBadge statut={projet.statut} />
            <StatutCommercialBadge statut={projet.statut_commercial} />
          </div>
          <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">{projet.nom}</h1>
          {projet.client_nom && (
            <p className="text-sm text-gray-500 mt-0.5 truncate">{projet.client_nom}</p>
          )}
        </div>
        {!onModifier && (
          <Link
            href={`/commercial/projets/${projet.id}/modifier`}
            className="inline-flex items-center gap-2 px-3 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors flex-shrink-0"
          >
            <Pencil className="w-4 h-4" />
            <span className="hidden sm:inline">Modifier</span>
          </Link>
        )}
      </div>
    </div>
  )
}
