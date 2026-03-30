'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, Search, X, FileText, FolderOpen, MessageSquare, Plus } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useUser } from '@/hooks/useUser'
import { useNotifications } from '@/hooks/useNotifications'
import { NotificationPanel } from '@/components/shared/NotificationPanel'
import { DocumentUploadModal } from '@/components/shared/DocumentUploadModal'
import { createClient } from '@/lib/supabase/client'

interface TopBarProps {
  title?: string
  subtitle?: string
}

interface SearchResult {
  type: 'document' | 'projet'
  id: string
  label: string
  sub: string
  href: string
}

const TYPE_LABELS: Record<string, string> = {
  cr: 'Compte-rendu', plan_exe: 'Plan EXE', plan_apd: 'Plan APD',
  plan_doe: 'Plan DOE', cctp: 'CCTP', devis: 'Devis', contrat: 'Contrat',
  rapport_bc: 'Rapport BC', facture: 'Facture', photo: 'Photo',
  audio_reunion: 'Audio réunion', kbis: 'Kbis', assurance: 'Assurance',
  urssaf: 'Urssaf', rib: 'RIB', autre: 'Autre',
}

export function TopBar({ title, subtitle }: TopBarProps) {
  const { user } = useUser()
  const { unreadCount } = useNotifications(user?.id ?? null)
  const chatCount = 0 // badge chat géré dans la Sidebar, évite le doublon de channel Supabase
  const [panelOpen, setPanelOpen]     = useState(false)
  const [uploadOpen, setUploadOpen]   = useState(false)
  const [searchOpen, setSearchOpen]   = useState(false)
  const [query, setQuery]             = useState('')
  const [results, setResults]         = useState<SearchResult[]>([])
  const [searching, setSearching]     = useState(false)

  const inputRef    = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pathname    = usePathname()
  const router      = useRouter()
  const supabase    = createClient()

  // Derive role base from URL (e.g. /co/dashboard → "co")
  const roleBase = pathname.split('/')[1] ?? 'co'

  // Extract projet_id from URL if on a projet page (e.g. /co/projets/[id]/...)
  const pathParts = pathname.split('/')
  const projetIdFromUrl = pathParts[2] === 'projets' && pathParts[3] ? pathParts[3] : undefined

  // Focus input when search opens
  useEffect(() => {
    if (searchOpen) setTimeout(() => inputRef.current?.focus(), 50)
    else { setQuery(''); setResults([]) }
  }, [searchOpen])

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setSearching(true)

    const term = `%${q.trim()}%`

    const [docsRes, projetsRes] = await Promise.all([
      supabase
        .schema('app')
        .from('documents')
        .select('id, nom_fichier, type_doc, projet_id')
        .ilike('nom_fichier', term)
        .limit(5),
      supabase
        .schema('app')
        .from('projets')
        .select('id, nom, reference')
        .or(`nom.ilike.${term},reference.ilike.${term}`)
        .limit(5),
    ])

    const docResults: SearchResult[] = (docsRes.data ?? []).map(d => ({
      type: 'document',
      id: d.id,
      label: d.nom_fichier,
      sub: TYPE_LABELS[d.type_doc] ?? d.type_doc,
      href: d.projet_id
        ? `/${roleBase}/projets/${d.projet_id}/documents`
        : `/${roleBase}/documents`,
    }))

    const projetResults: SearchResult[] = (projetsRes.data ?? []).map(p => ({
      type: 'projet',
      id: p.id,
      label: p.nom,
      sub: p.reference ?? '',
      href: `/${roleBase}/projets/${p.id}`,
    }))

    setResults([...projetResults, ...docResults])
    setSearching(false)
  }, [roleBase, supabase])

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => runSearch(query), 300)
    return () => clearTimeout(t)
  }, [query, runSearch])

  function handleSelect(href: string) {
    setSearchOpen(false)
    router.push(href)
  }

  return (
    <>
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 relative z-30">
        {/* Title or search input */}
        {searchOpen ? (
          <div ref={containerRef} className="flex-1 flex flex-col relative">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 max-w-lg">
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Escape' && setSearchOpen(false)}
                placeholder="Rechercher un document, projet..."
                className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Results dropdown */}
            {(results.length > 0 || searching) && (
              <div className="absolute top-full left-0 mt-1 w-full max-w-lg bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                {searching ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="w-4 h-4 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
                  </div>
                ) : (
                  <>
                    {results.filter(r => r.type === 'projet').length > 0 && (
                      <>
                        <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Projets</p>
                        {results.filter(r => r.type === 'projet').map(r => (
                          <button key={r.id} onClick={() => handleSelect(r.href)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left transition-colors">
                            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                              <FolderOpen className="w-3.5 h-3.5 text-blue-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{r.label}</p>
                              {r.sub && <p className="text-xs text-gray-400">{r.sub}</p>}
                            </div>
                          </button>
                        ))}
                      </>
                    )}
                    {results.filter(r => r.type === 'document').length > 0 && (
                      <>
                        <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Documents</p>
                        {results.filter(r => r.type === 'document').map(r => (
                          <button key={r.id} onClick={() => handleSelect(r.href)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left transition-colors">
                            <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                              <FileText className="w-3.5 h-3.5 text-gray-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{r.label}</p>
                              <p className="text-xs text-gray-400">{r.sub}</p>
                            </div>
                          </button>
                        ))}
                      </>
                    )}
                    {results.length === 0 && query.length > 1 && !searching && (
                      <p className="px-4 py-6 text-sm text-gray-400 text-center">Aucun résultat pour "{query}"</p>
                    )}
                    <div className="border-t border-gray-100 px-4 py-2">
                      <p className="text-xs text-gray-300">Appuyez sur Échap pour fermer</p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          <div>
            {title && <h1 className="text-base font-semibold text-gray-900">{title}</h1>}
            {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
          </div>
        )}

        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
          <button
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors">
            <Plus className="w-3.5 h-3.5" />
            Deposer
          </button>
          <button
            onClick={() => setSearchOpen(v => !v)}
            className={`p-2 rounded-lg transition-colors ${searchOpen ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}>
            <Search className="w-4 h-4" />
          </button>
          <button
            onClick={() => router.push(`/${roleBase}/chat`)}
            className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <MessageSquare className="w-4 h-4" />
            {chatCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-0.5">
                {chatCount > 99 ? '99+' : chatCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setPanelOpen(true)}
            className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-0.5">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <NotificationPanel
        userId={user?.id ?? null}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
      />

      <DocumentUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={() => setUploadOpen(false)}
        projetId={projetIdFromUrl}
      />
    </>
  )
}
