'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Calculator } from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'
import { StatutBadge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import type { ChiffrageVersion } from '@/types/database'

interface ChiffrageAvecProjet extends ChiffrageVersion {
  projet_nom: string
  projet_reference: string | null
  projet_statut: string
}

export default function ChiffragesPage() {
  const { user, loading } = useUser()
  const [chiffrages, setChiffrages] = useState<ChiffrageAvecProjet[]>([])
  const [fetching,   setFetching]   = useState(true)

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
      const { data: versions } = await supabase
        .schema('app')
        .from('chiffrage_versions')
        .select('*')
        .in('projet_id', projetIds)
        .order('created_at', { ascending: false })

      const enriched: ChiffrageAvecProjet[] = (versions ?? []).map((v) => {
        const projet = projets.find((p) => p.id === v.projet_id)
        return {
          ...(v as ChiffrageVersion),
          projet_nom:       projet?.nom ?? '—',
          projet_reference: projet?.reference ?? null,
          projet_statut:    projet?.statut ?? '—',
        }
      })

      setChiffrages(enriched)
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

  return (
    <div>
      <TopBar
        title="Chiffrages"
        subtitle={`${chiffrages.length} version${chiffrages.length !== 1 ? 's' : ''}`}
      />

      <div className="p-6 space-y-3">
        {chiffrages.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-16 text-center">
            <Calculator className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-sm font-medium text-gray-700">Aucun chiffrage</p>
            <p className="text-xs text-gray-400 mt-1">
              Les versions de chiffrage apparaîtront ici depuis les pages projets.
            </p>
          </div>
        ) : (
          chiffrages.map((c) => (
            <Link key={c.id} href={`/economiste/projets/${c.projet_id}`}>
              <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4 hover:border-gray-300 transition-all">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {c.projet_reference && (
                        <span className="text-xs text-gray-400 font-mono">{c.projet_reference}</span>
                      )}
                      <StatutBadge statut={c.projet_statut} />
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                        c.statut === 'actif'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-gray-50 text-gray-500 border-gray-200'
                      }`}>
                        {c.statut === 'actif' ? 'Actif' : 'Archivé'} · v{c.version}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 truncate">{c.projet_nom}</p>
                    {c.motif_revision && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{c.motif_revision}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-gray-900">
                      {formatCurrency(c.montant_total)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(c.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
