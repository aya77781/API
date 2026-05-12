'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { FolderOpen, MapPin, User, Calendar, ChevronRight, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'
import { StatutBadge } from '@/components/ui/Badge'
import { formatCurrency, formatDateShort } from '@/lib/utils'
import type { Projet } from '@/types/database'

export default function ComptaProjetsList() {
  const [projets, setProjets] = useState<Projet[]>([])
  const [fetching, setFetching] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatut, setFilterStatut] = useState<string>('actifs')

  useEffect(() => {
    const supabase = createClient()
    supabase
      .schema('app')
      .from('projets')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setProjets((data ?? []) as Projet[])
        setFetching(false)
      })
  }, [])

  const filtered = useMemo(() => {
    return projets.filter(p => {
      if (filterStatut === 'actifs' && ['termine', 'archive'].includes(p.statut)) return false
      if (filterStatut === 'termines' && !['termine', 'archive'].includes(p.statut)) return false
      if (search) {
        const q = search.toLowerCase()
        const hay = `${p.nom} ${p.reference ?? ''} ${p.client_nom ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [projets, search, filterStatut])

  if (fetching) {
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
        subtitle={`${filtered.length} projet${filtered.length !== 1 ? 's' : ''} · vue compta transverse`}
      />
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par nom, référence, client..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <select
            value={filterStatut}
            onChange={e => setFilterStatut(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            <option value="actifs">Projets actifs</option>
            <option value="termines">Terminés / archivés</option>
            <option value="all">Tous les projets</option>
          </select>
        </div>

        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-16 text-center">
              <FolderOpen className="w-12 h-12 text-gray-200 mx-auto mb-4" />
              <p className="text-sm font-medium text-gray-700">
                {projets.length === 0 ? 'Aucun projet créé' : 'Aucun résultat'}
              </p>
            </div>
          ) : (
            filtered.map(projet => <ProjetCard key={projet.id} projet={projet} />)
          )}
        </div>
      </div>
    </div>
  )
}

function ProjetCard({ projet }: { projet: Projet }) {
  return (
    <Link
      href={`/compta/projets/${projet.id}`}
      className="block bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all group"
    >
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
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right space-y-1">
            {projet.budget_total && <p className="text-sm font-semibold text-gray-900">{formatCurrency(projet.budget_total)}</p>}
            {projet.date_livraison && (
              <div className="flex items-center gap-1 justify-end">
                <Calendar className="w-3 h-3 text-gray-400" />
                <p className="text-xs text-gray-400">{formatDateShort(projet.date_livraison)}</p>
              </div>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-600 transition-colors" />
        </div>
      </div>
    </Link>
  )
}
