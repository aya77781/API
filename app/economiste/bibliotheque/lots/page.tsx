'use client'

import { useEffect, useState, useTransition, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Search, FolderOpen, ChevronRight, Trash2, X, Loader2 } from 'lucide-react'
import {
  listLots, createLot, deleteItem,
  type BiblioLotSummary,
} from '@/app/_actions/biblio'

export default function BibliothequeLotsPage() {
  const router = useRouter()
  const [lots, setLots] = useState<BiblioLotSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    setLoading(true)
    try {
      const data = await listLots()
      setLots(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { reload() }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return lots
    const s = search.toLowerCase()
    return lots.filter((l) =>
      l.designation.toLowerCase().includes(s) ||
      (l.source_code ?? '').toLowerCase().includes(s),
    )
  }, [lots, search])

  function handleCreate() {
    if (!newName.trim()) return
    setError(null)
    startTransition(async () => {
      try {
        const { id } = await createLot(newName.trim())
        setShowCreate(false)
        setNewName('')
        router.push(`/economiste/bibliotheque/lots/${id}`)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur a la creation')
      }
    })
  }

  async function handleDelete(id: string, nom: string) {
    if (!confirm(`Supprimer le lot "${nom}" et tous ses chapitres / ouvrages ?`)) return
    try {
      await deleteItem(id)
      setLots((prev) => prev.filter((l) => l.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur a la suppression')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-5">
          <h1 className="text-xl font-semibold text-gray-900">Bibliotheque - Lots types</h1>
          <p className="text-xs text-gray-500 mt-1">
            Catalogue de lots, chapitres et ouvrages reutilisables. Snapshot independant de chaque affaire.
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-4">
        {/* Barre d'actions */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un lot..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-md focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-black"
          >
            <Plus className="w-4 h-4" />
            Nouveau lot
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-3 text-sm">{error}</div>
        )}

        {/* Liste */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Chargement...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-lg p-10 text-center">
            <FolderOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              {search ? 'Aucun lot ne correspond a votre recherche' : 'Aucun lot dans la bibliotheque pour le moment'}
            </p>
            {!search && (
              <button
                onClick={() => setShowCreate(true)}
                className="mt-4 text-sm text-blue-600 hover:text-blue-800"
              >
                Creer le premier lot
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {filtered.map((lot) => (
              <div key={lot.id} className="group flex items-center gap-4 px-5 py-4 hover:bg-gray-50">
                <Link
                  href={`/economiste/bibliotheque/lots/${lot.id}`}
                  className="flex-1 min-w-0 flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-50 transition-colors">
                    <FolderOpen className="w-5 h-5 text-gray-500 group-hover:text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {lot.source_code && (
                        <span className="text-xs font-mono text-gray-400">{lot.source_code}</span>
                      )}
                      <p className="text-sm font-medium text-gray-900 truncate">{lot.designation}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {lot.nb_chapitres} chapitre{lot.nb_chapitres > 1 ? 's' : ''} · {lot.nb_ouvrages} ouvrage{lot.nb_ouvrages > 1 ? 's' : ''}
                    </p>
                  </div>
                </Link>
                <button
                  onClick={() => handleDelete(lot.id, lot.designation)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-opacity"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <Link
                  href={`/economiste/bibliotheque/lots/${lot.id}`}
                  className="text-gray-300 group-hover:text-gray-500"
                >
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>
        )}

        {/* Modal creation */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg w-full max-w-md shadow-xl">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-900">Nouveau lot</h2>
                <button onClick={() => setShowCreate(false)} className="p-1 text-gray-400 hover:text-gray-700">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 space-y-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Designation du lot</label>
                  <input
                    autoFocus
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
                    placeholder="ex: Plomberie / Sanitaires"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  Annuler
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim() || pending}
                  className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-black disabled:opacity-40"
                >
                  {pending ? 'Creation...' : 'Creer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
