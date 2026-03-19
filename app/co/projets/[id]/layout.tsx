import { createClient } from '@/lib/supabase/server'
import { PhaseNav } from '@/components/co/PhaseNav'
import { TopBar } from '@/components/co/TopBar'
import { StatutBadge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import type { Projet } from '@/types/database'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface ProjetLayoutProps {
  children: React.ReactNode
  params: { id: string }
}

export default async function ProjetLayout({ children, params }: ProjetLayoutProps) {
  const supabase = createClient()

  const { data: projet } = await supabase
    .schema('app')
    .from('projets')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!projet) notFound()

  const p = projet as Projet

  return (
    <div>
      <TopBar
        title={p.nom}
        subtitle={[p.reference, p.client_nom].filter(Boolean).join(' · ')}
      />

      {/* En-tête projet */}
      <div className="bg-white border-b border-gray-100 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/co/dashboard"
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Tableau de bord
            </Link>
            <span className="text-gray-200">·</span>
            <StatutBadge statut={p.statut} />
            {p.type_chantier && (
              <span className="text-xs text-gray-400">{p.type_chantier}</span>
            )}
          </div>
          <div className="flex items-center gap-6 text-xs text-gray-500">
            {p.surface_m2 && (
              <span>
                <span className="font-semibold text-gray-900">{p.surface_m2} m²</span>
              </span>
            )}
            {p.budget_total && (
              <span>
                Budget :{' '}
                <span className="font-semibold text-gray-900">
                  {formatCurrency(p.budget_total)}
                </span>
              </span>
            )}
            {p.date_livraison && (
              <span>
                Livraison :{' '}
                <span className="font-semibold text-gray-900">
                  {new Date(p.date_livraison).toLocaleDateString('fr-FR')}
                </span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Navigation des phases */}
      <PhaseNav projetId={params.id} statutActuel={p.statut} />

      {/* Contenu de la phase */}
      <div className="p-6">{children}</div>
    </div>
  )
}
