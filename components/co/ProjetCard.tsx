'use client'

import Link from 'next/link'
import { Calendar, Euro, MapPin, ChevronRight } from 'lucide-react'
import { StatutBadge } from '@/components/ui/Badge'
import { formatCurrency, formatDateShort, PHASE_ORDER } from '@/lib/utils'
import type { Projet } from '@/types/database'

interface ProjetCardProps {
  projet: Projet
}

export function ProjetCard({ projet }: ProjetCardProps) {
  const phaseIndex = PHASE_ORDER.indexOf(projet.statut)
  const safeIndex = phaseIndex === -1 ? PHASE_ORDER.length - 1 : phaseIndex
  const progression = Math.round(((safeIndex + 1) / PHASE_ORDER.length) * 100)

  return (
    <Link href={`/co/projets/${projet.id}/${projet.statut}`}>
      <div className="bg-white rounded-lg border border-gray-200 shadow-card hover:shadow-card-hover transition-all duration-200 p-5 group">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {projet.reference && (
                <p className="text-xs text-gray-400 font-mono">{projet.reference}</p>
              )}
              <StatutBadge statut={projet.statut} />
            </div>
            <h3 className="font-semibold text-gray-900 text-sm leading-snug truncate">
              {projet.nom}
            </h3>
            {projet.client_nom && (
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                {projet.client_nom}
              </p>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 flex-shrink-0 mt-1 transition-colors" />
        </div>

        {/* Barre de progression des phases */}
        <div className="mt-4">
          <div className="flex gap-0.5">
            {PHASE_ORDER.map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-1 rounded-full transition-colors ${
                  i <= safeIndex ? 'bg-gray-900' : 'bg-gray-100'
                }`}
              />
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-400">{progression}% du cycle projet</p>
        </div>

        {/* Méta */}
        <div className="mt-3 flex items-center gap-4 flex-wrap">
          {projet.budget_total && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Euro className="w-3 h-3" />
              <span>{formatCurrency(projet.budget_total)}</span>
            </div>
          )}
          {projet.date_livraison && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Calendar className="w-3 h-3" />
              <span>Livraison : {formatDateShort(projet.date_livraison)}</span>
            </div>
          )}
          {projet.adresse && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <MapPin className="w-3 h-3" />
              <span className="truncate max-w-[140px]">{projet.adresse}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
