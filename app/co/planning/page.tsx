'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Calendar, ChevronRight, Building2 } from 'lucide-react'
import { TopBar } from '@/components/co/TopBar'
import { useUser } from '@/hooks/useUser'
import { createClient } from '@/lib/supabase/client'

interface Projet {
  id: string
  nom: string
  reference: string | null
  statut: string
  client_nom: string | null
}

export default function PlanningSelectorPage() {
  const { user } = useUser()
  const [projets, setProjets] = useState<Projet[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    supabase.schema('app').from('projets')
      .select('id, nom, reference, statut, client_nom')
      .or(`co_id.eq.${user.id},economiste_id.eq.${user.id},commercial_id.eq.${user.id}`)
      .order('nom')
      .then(({ data }) => { setProjets((data ?? []) as Projet[]); setLoading(false) })
  }, [user])

  return (
    <div>
      <TopBar title="Planning" subtitle="Selectionnez un projet pour voir son planning" />
      <div className="p-4 sm:p-6">
        <div className="space-y-2">
          {loading ? (
            [1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)
          ) : projets.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-10 text-center">
              <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700">Aucun projet</p>
              <p className="text-xs text-gray-400 mt-1">Vos projets apparaitront ici</p>
            </div>
          ) : (
            projets.map(p => (
              <Link key={p.id} href={`/co/projets/${p.id}/planning`}
                className="w-full flex items-center gap-4 bg-white rounded-lg border border-gray-200 shadow-sm px-5 py-4 hover:border-gray-300 transition-all text-left group">
                <div className="w-10 h-10 rounded-lg bg-gray-900 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{p.nom}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {[p.reference, p.client_nom].filter(Boolean).join(' - ')}
                  </p>
                </div>
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide px-2 py-0.5 bg-gray-100 rounded flex-shrink-0">
                  {p.statut}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
