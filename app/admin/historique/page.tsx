'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { Search, Archive, MapPin, Calendar, Building2 } from 'lucide-react'

interface ProjetArchive {
  id: string
  nom: string
  reference: string | null
  type_chantier: string | null
  adresse: string | null
  budget_total: number | null
  date_debut: string | null
  date_livraison: string | null
  archived_at: string | null
  archived_by: string | null
  client_nom: string | null
}

function formatBudget(n: number | null) {
  if (!n) return '—'
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n) + ' €'
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AdminHistoriquePage() {
  const router = useRouter()
  const supabase = createClient()
  const { profil, loading: userLoading } = useUser()
  const [projets, setProjets] = useState<ProjetArchive[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (userLoading) return
    if (!profil || !['admin', 'gerant'].includes(profil.role)) {
      router.replace('/login')
      return
    }
    async function load() {
      const { data } = await supabase
        .schema('app')
        .from('projets')
        .select('id, nom, reference, type_chantier, adresse, budget_total, date_debut, date_livraison, archived_at, archived_by, client_nom')
        .eq('statut', 'archive')
        .order('archived_at', { ascending: false })
      setProjets((data ?? []) as ProjetArchive[])
      setLoading(false)
    }
    load()
  }, [profil, userLoading, router, supabase])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return projets
    return projets.filter(p =>
      (p.nom ?? '').toLowerCase().includes(q)
      || (p.client_nom ?? '').toLowerCase().includes(q)
      || (p.adresse ?? '').toLowerCase().includes(q),
    )
  }, [projets, search])

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Historique</h1>
          <p className="text-xs text-gray-400">{projets.length} projet{projets.length > 1 ? 's' : ''} archivé{projets.length > 1 ? 's' : ''}</p>
        </div>
      </header>

      <div className="p-6 space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom, client ou adresse…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col items-center py-20">
            <Archive className="w-10 h-10 text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">Aucun projet archivé</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(p => (
              <button
                key={p.id}
                onClick={() => router.push(`/admin/historique/${p.id}`)}
                className="text-left bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:border-gray-300 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-3 gap-2">
                  <div className="flex-1 min-w-0">
                    {p.reference && (
                      <p className="text-xs text-gray-400 font-mono truncate">{p.reference}</p>
                    )}
                    <h3 className="text-sm font-semibold text-gray-900 truncate">{p.nom}</h3>
                  </div>
                  <span className="bg-gray-200 text-gray-600 rounded-full px-3 py-0.5 text-xs font-medium flex-shrink-0">
                    ARCHIVÉ
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-gray-500">
                  {p.client_nom && (
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{p.client_nom}</span>
                    </div>
                  )}
                  {p.type_chantier && (
                    <div className="text-gray-600">
                      <span className="text-xs font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                        {p.type_chantier}
                      </span>
                    </div>
                  )}
                  {p.adresse && (
                    <div className="flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{p.adresse}</span>
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    <span>{formatDate(p.date_debut)} → {formatDate(p.date_livraison)}</span>
                  </div>
                  <span className="font-semibold text-gray-900">{formatBudget(p.budget_total)}</span>
                </div>

                {p.archived_at && (
                  <p className="mt-2 text-[11px] text-gray-400">
                    Archivé le {formatDate(p.archived_at)}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
