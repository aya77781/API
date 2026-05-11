'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  ShieldCheck, FileText, Download, Trash2, Loader2,
  EyeOff, MailOpen, Filter,
} from 'lucide-react'

const BUCKET = 'documents-anonymes'

const CATEGORIE_LABELS: Record<string, string> = {
  signalement: 'Signalement',
  suggestion:  'Suggestion',
  reclamation: 'Reclamation',
  temoignage:  'Temoignage',
  autre:       'Autre',
}

const CATEGORIE_COLORS: Record<string, string> = {
  signalement: 'bg-red-100 text-red-700',
  suggestion:  'bg-blue-100 text-blue-700',
  reclamation: 'bg-orange-100 text-orange-700',
  temoignage:  'bg-purple-100 text-purple-700',
  autre:       'bg-gray-100 text-gray-700',
}

interface DocAnonyme {
  id:            string
  nom_fichier:   string
  fichier_url:   string
  storage_path:  string
  taille_octets: number | null
  mime_type:     string | null
  categorie:     string | null
  message:       string | null
  lu:            boolean
  lu_at:         string | null
  created_at:    string
}

function formatSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "A l'instant"
  if (mins < 60) return `Il y a ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Il y a ${hours}h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Hier'
  return new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function Page() {
  const supabase = createClient()
  const [docs, setDocs]               = useState<DocAnonyme[]>([])
  const [loading, setLoading]         = useState(true)
  const [filter, setFilter]           = useState<'all' | 'unread'>('all')
  const [filterCat, setFilterCat]     = useState<string>('')

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .schema('app')
      .from('documents_anonymes' as never)
      .select('*')
      .order('created_at', { ascending: false })
    setDocs((data as DocAnonyme[] | null) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleDownload(doc: DocAnonyme) {
    const { data } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(doc.storage_path, 60)
    if (!data?.signedUrl) return
    if (!doc.lu) await markLu(doc.id)
    const a = document.createElement('a')
    a.href = data.signedUrl
    a.download = doc.nom_fichier
    a.target = '_blank'
    a.click()
  }

  async function markLu(id: string) {
    await supabase
      .schema('app')
      .from('documents_anonymes' as never)
      .update({ lu: true, lu_at: new Date().toISOString() } as never)
      .eq('id', id)
    setDocs(prev => prev.map(d => d.id === id ? { ...d, lu: true, lu_at: new Date().toISOString() } : d))
  }

  async function handleDelete(doc: DocAnonyme) {
    if (!confirm('Supprimer definitivement ce document anonyme ?')) return
    await supabase.storage.from(BUCKET).remove([doc.storage_path])
    await supabase
      .schema('app')
      .from('documents_anonymes' as never)
      .delete()
      .eq('id', doc.id)
    setDocs(prev => prev.filter(d => d.id !== doc.id))
  }

  const filtered = docs.filter(d => {
    if (filter === 'unread' && d.lu) return false
    if (filterCat && d.categorie !== filterCat) return false
    return true
  })

  const unreadCount = docs.filter(d => !d.lu).length

  return (
    <div>
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center">
            <ShieldCheck className="w-4.5 h-4.5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900">Depots anonymes</h1>
            <p className="text-xs text-gray-400">
              Documents transmis anonymement par les sous-traitants
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <span className="text-xs bg-red-500 text-white font-bold px-2.5 py-1 rounded-full">
            {unreadCount} non lu{unreadCount > 1 ? 's' : ''}
          </span>
        )}
      </header>

      <div className="p-6 space-y-5">
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-start gap-2 text-xs text-purple-900">
          <EyeOff className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Confidentialite garantie</p>
            <p className="mt-0.5">
              L'identite des deposants n'est pas enregistree. Vous etes le seul a pouvoir consulter ces documents.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Filter className="w-3.5 h-3.5" />
            Filtres :
          </div>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium ${
              filter === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Tous ({docs.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium ${
              filter === 'unread'
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Non lus ({unreadCount})
          </button>
          <select
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            <option value="">Toutes categories</option>
            {Object.entries(CATEGORIE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-14 text-center">
            <ShieldCheck className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              {docs.length === 0 ? 'Aucun depot anonyme pour le moment' : 'Aucun resultat'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50 overflow-hidden">
            {filtered.map(doc => (
              <div
                key={doc.id}
                className={`px-5 py-4 transition-colors ${
                  doc.lu ? '' : 'bg-purple-50/40 hover:bg-purple-50/70'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FileText className="w-4 h-4 text-gray-500" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {doc.categorie && (
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          CATEGORIE_COLORS[doc.categorie] ?? 'bg-gray-100 text-gray-700'
                        }`}>
                          {CATEGORIE_LABELS[doc.categorie] ?? doc.categorie}
                        </span>
                      )}
                      {!doc.lu && (
                        <span className="text-[11px] bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full">
                          Non lu
                        </span>
                      )}
                      <span className="text-[11px] text-gray-400">{timeAgo(doc.created_at)}</span>
                    </div>

                    <p className={`text-sm mt-1.5 truncate ${doc.lu ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>
                      {doc.nom_fichier}
                    </p>

                    {doc.message && (
                      <p className="text-xs text-gray-600 italic mt-1.5 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                        "{doc.message}"
                      </p>
                    )}

                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400">
                      <span className="flex items-center gap-1">
                        <EyeOff className="w-3 h-3" />
                        Anonyme
                      </span>
                      {doc.taille_octets && <span>{formatSize(doc.taille_octets)}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!doc.lu && (
                      <button
                        onClick={() => markLu(doc.id)}
                        title="Marquer comme lu"
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 font-medium"
                      >
                        <MailOpen className="w-3 h-3" />
                        Lu
                      </button>
                    )}
                    <button
                      onClick={() => handleDownload(doc)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-100 font-medium"
                    >
                      <Download className="w-3 h-3" />
                      Telecharger
                    </button>
                    <button
                      onClick={() => handleDelete(doc)}
                      title="Supprimer"
                      className="flex items-center justify-center w-8 h-8 text-red-500 border border-red-100 rounded-lg hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
