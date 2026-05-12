'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { StatutBadge } from '@/components/ui/Badge'
import { formatCurrency, PHASE_ORDER } from '@/lib/utils'

type ProjetHeaderProps = {
  projet: {
    nom: string
    reference: string | null
    type_chantier: string | null
    statut: string
    client_nom: string | null
    budget_total: number | null
    surface_m2?: number | null
  }
  backHref: string
  backLabel?: string
  showSurface?: boolean
}

export function ProjetHeader({
  projet,
  backHref,
  backLabel = 'Mes projets',
  showSurface = false,
}: ProjetHeaderProps) {
  const phaseIdx = PHASE_ORDER.indexOf(projet.statut)
  const safeIdx = phaseIdx === -1 ? PHASE_ORDER.length - 1 : phaseIdx

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link
            href={backHref}
            className="mt-1 flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {backLabel}
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              {projet.reference && (
                <span className="text-xs text-gray-400 font-mono">{projet.reference}</span>
              )}
              <StatutBadge statut={projet.statut} />
              {projet.type_chantier && (
                <span className="text-xs text-gray-400">{projet.type_chantier}</span>
              )}
            </div>
            <h1 className="text-base font-semibold text-gray-900">{projet.nom}</h1>
            {projet.client_nom && (
              <p className="text-xs text-gray-500 mt-0.5">{projet.client_nom}</p>
            )}
          </div>
        </div>
        <div className="hidden md:flex items-center gap-6 text-xs text-gray-500 flex-shrink-0">
          {projet.budget_total && (
            <span>
              Budget :{' '}
              <span className="font-semibold text-gray-900">
                {formatCurrency(projet.budget_total)}
              </span>
            </span>
          )}
          {showSurface && projet.surface_m2 && (
            <span>{projet.surface_m2} m2</span>
          )}
        </div>
      </div>
      <div className="mt-4 flex gap-0.5">
        {PHASE_ORDER.map((_, i) => (
          <div key={i} className="flex-1">
            <div
              className={`h-1.5 rounded-full ${i <= safeIdx ? 'bg-gray-900' : 'bg-gray-100'}`}
            />
          </div>
        ))}
      </div>
    </header>
  )
}
