'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FileWarning } from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'
import { StatutBadge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import type { Avenant } from '@/types/database'

interface AvenantAvecProjet extends Avenant {
  projet_nom: string
  projet_reference: string | null
  projet_statut: string
}

const STATUT_LABELS: Record<string, { label: string; color: string }> = {
  ouvert:        { label: 'À chiffrer',    color: 'bg-amber-50 text-amber-700 border-amber-200' },
  chiffre:       { label: 'Chiffré',       color: 'bg-blue-50 text-blue-700 border-blue-200' },
  valide_co:     { label: 'Validé CO',     color: 'bg-purple-50 text-purple-700 border-purple-200' },
  valide_client: { label: 'Validé client', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  refuse:        { label: 'Refusé',        color: 'bg-red-50 text-red-700 border-red-200' },
}

export default function AvenantsPage() {
  const { user, loading } = useUser()
  const [avenants, setAvenants] = useState<AvenantAvecProjet[]>([])
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const supabase = createClient()
      const { data: projets } = await supabase
        .schema('app')
        .from('projets')
        .select('id, nom, reference, statut')
        .eq('economiste_id', user.id)

      if (!projets?.length) { setFetching(false); return }

      const projetIds = projets.map((p) => p.id)
      const { data: avs } = await supabase
        .schema('app')
        .from('avenants')
        .select('*')
        .in('projet_id', projetIds)
        .order('created_at', { ascending: false })

      const enriched: AvenantAvecProjet[] = (avs ?? []).map((a) => {
        const projet = projets.find((p) => p.id === a.projet_id)
        return {
          ...(a as Avenant),
          projet_nom:       projet?.nom ?? '—',
          projet_reference: projet?.reference ?? null,
          projet_statut:    projet?.statut ?? '—',
        }
      })

      setAvenants(enriched)
      setFetching(false)
    })()
  }, [user])

  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    )
  }

  const ouverts  = avenants.filter((a) => a.statut === 'ouvert')
  const autres   = avenants.filter((a) => a.statut !== 'ouvert')

  return (
    <div>
      <TopBar
        title="Avenants"
        subtitle={`${ouverts.length} à chiffrer · ${avenants.length} au total`}
      />

      <div className="p-6 space-y-6">

        {avenants.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-16 text-center">
            <FileWarning className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-sm font-medium text-gray-700">Aucun avenant</p>
            <p className="text-xs text-gray-400 mt-1">
              Les avenants apparaîtront ici depuis les pages projets.
            </p>
          </div>
        ) : (
          <>
            {ouverts.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-gray-700">À chiffrer</h2>
                {ouverts.map((a) => <AvenantCard key={a.id} avenant={a} />)}
              </div>
            )}
            {autres.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-gray-700">Historique</h2>
                {autres.map((a) => <AvenantCard key={a.id} avenant={a} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function AvenantCard({ avenant }: { avenant: AvenantAvecProjet }) {
  const statut = STATUT_LABELS[avenant.statut] ?? { label: avenant.statut, color: 'bg-gray-50 text-gray-600 border-gray-200' }

  return (
    <Link href={`/economiste/projets/${avenant.projet_id}`}>
      <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4 hover:border-gray-300 transition-all">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {avenant.projet_reference && (
                <span className="text-xs text-gray-400 font-mono">{avenant.projet_reference}</span>
              )}
              <StatutBadge statut={avenant.projet_statut} />
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${statut.color}`}>
                {statut.label}
              </span>
              <span className="text-xs text-gray-400">AVN-{String(avenant.numero).padStart(2, '0')}</span>
            </div>
            <p className="text-sm font-semibold text-gray-900 truncate">{avenant.projet_nom}</p>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{avenant.description}</p>
          </div>
          <div className="text-right flex-shrink-0">
            {avenant.montant_ht ? (
              <p className="text-sm font-semibold text-gray-900">
                {formatCurrency(avenant.montant_ht)}
              </p>
            ) : (
              <p className="text-xs text-gray-400">À chiffrer</p>
            )}
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date(avenant.created_at).toLocaleDateString('fr-FR')}
            </p>
          </div>
        </div>
      </div>
    </Link>
  )
}
