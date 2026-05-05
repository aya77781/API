'use client'

import Link from 'next/link'
import { Calendar, Clock, FileText, Calculator, Pencil } from 'lucide-react'
import { labelType, labelVersion, type DemandeType } from '@/lib/conception/types'

export type DemandeCardData = {
  id: string
  projet_nom: string
  type: DemandeType | string | null
  version: number | null
  statut: string | null
  date_demande: string | null
  date_livraison_souhaitee: string | null
  date_livraison_prevue: string | null
  demandeur_nom?: string | null
  message_demandeur?: string | null
}

function joursRestants(dateIso: string | null): { label: string; tone: 'vert' | 'orange' | 'rouge' | 'gris' } {
  if (!dateIso) return { label: '—', tone: 'gris' }
  const target = new Date(dateIso).getTime()
  const now = Date.now()
  const days = Math.ceil((target - now) / 86400000)
  if (days < 0) return { label: `Retard ${Math.abs(days)}j`, tone: 'rouge' }
  if (days <= 4) return { label: `J-${days}`, tone: 'orange' }
  return { label: `J-${days}`, tone: 'vert' }
}

const TONE_CLS = {
  vert: 'bg-green-50 text-green-700 border-green-200',
  orange: 'bg-amber-50 text-amber-700 border-amber-200',
  rouge: 'bg-red-50 text-red-700 border-red-200',
  gris: 'bg-gray-50 text-gray-500 border-gray-200',
}

export function DemandeCard({
  demande,
  href,
  isPlan = false,
}: {
  demande: DemandeCardData
  href: string
  isPlan?: boolean
}) {
  const Icon = isPlan ? Pencil : Calculator
  const dateLimite = demande.date_livraison_souhaitee ?? demande.date_livraison_prevue
  const j = joursRestants(dateLimite)

  return (
    <Link href={href} className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-900 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
            isPlan ? 'bg-violet-50 text-violet-600' : 'bg-emerald-50 text-emerald-600'
          }`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-gray-900 truncate">{demande.projet_nom}</p>
              <span className="px-1.5 py-0.5 text-xs font-bold rounded bg-gray-900 text-white">
                {labelVersion(demande.version, demande.type === 'plan_apd' || demande.type === 'chiffrage_apd')}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{labelType(demande.type)}</p>
            {demande.demandeur_nom && (
              <p className="text-xs text-gray-400 mt-0.5">Par {demande.demandeur_nom}</p>
            )}
            {demande.message_demandeur && (
              <p className="text-xs text-gray-600 mt-1 line-clamp-2">{demande.message_demandeur}</p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className={`px-2 py-0.5 text-xs rounded-full border font-medium ${TONE_CLS[j.tone]}`}>
            <Clock className="w-3 h-3 inline mr-1" />{j.label}
          </span>
          {dateLimite && (
            <span className="text-xs text-gray-400 inline-flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(dateLimite).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
