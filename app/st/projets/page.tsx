'use client'

import Link from 'next/link'
import { ChevronRight, Building2, ArrowLeft } from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { useSTProjects } from '@/hooks/useSTProjects'

export default function STProjetsListPage() {
  const { user } = useUser()
  const { lots, loading } = useSTProjects(user?.id ?? null)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="h-16 bg-white border-b border-gray-200 flex items-center gap-4 px-6">
        <Link href="/st/dashboard" className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-base font-semibold text-gray-900">Mes projets</h1>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
          </div>
        ) : lots.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Building2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Aucun projet attribué pour l&apos;instant</p>
            <p className="text-xs text-gray-400 mt-1">Vous serez notifié dès qu&apos;un projet vous est attribué.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {lots.map((lot) => (
              <Link key={lot.id} href={`/st/projets/${lot.projet_id}?lot=${lot.id}`}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-gray-300 transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{lot.projet?.nom || '—'}</p>
                    {lot.projet?.reference && (
                      <p className="text-xs text-gray-400">{lot.projet.reference}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded bg-orange-50 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-orange-600">{lot.numero}</span>
                  </div>
                  <p className="text-sm text-gray-700 font-medium truncate">{lot.corps_etat}</p>
                </div>
                {lot.projet?.adresse && (
                  <p className="text-xs text-gray-400 mb-3 truncate">{lot.projet.adresse}</p>
                )}
                <div className="flex items-center gap-1 text-xs text-gray-400 group-hover:text-gray-600 mt-1">
                  <span>Ouvrir le dossier</span>
                  <ChevronRight className="w-3 h-3" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
