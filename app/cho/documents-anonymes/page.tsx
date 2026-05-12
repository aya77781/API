'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Camera, Download, Trash2, Loader2,
  EyeOff, MailOpen, Heart, X,
} from 'lucide-react'

const BUCKET = 'documents-anonymes'

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
  signedUrl?:    string | null
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
  const [lightbox, setLightbox]       = useState<DocAnonyme | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .schema('app')
      .from('documents_anonymes' as never)
      .select('*')
      .order('created_at', { ascending: false })
    const list = (data as DocAnonyme[] | null) ?? []

    // Genere les signed URLs pour afficher les vignettes
    const withUrls = await Promise.all(list.map(async d => {
      const { data: sig } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(d.storage_path, 3600)
      return { ...d, signedUrl: sig?.signedUrl ?? null }
    }))
    setDocs(withUrls)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleDownload(doc: DocAnonyme) {
    const url = doc.signedUrl ?? (await supabase.storage
      .from(BUCKET)
      .createSignedUrl(doc.storage_path, 60)).data?.signedUrl
    if (!url) return
    if (!doc.lu) await markLu(doc.id)
    const a = document.createElement('a')
    a.href = url
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
    if (!confirm('Supprimer definitivement cette photo ?')) return
    await supabase.storage.from(BUCKET).remove([doc.storage_path])
    await supabase
      .schema('app')
      .from('documents_anonymes' as never)
      .delete()
      .eq('id', doc.id)
    setDocs(prev => prev.filter(d => d.id !== doc.id))
    if (lightbox?.id === doc.id) setLightbox(null)
  }

  function openLightbox(doc: DocAnonyme) {
    setLightbox(doc)
    if (!doc.lu) markLu(doc.id)
  }

  const filtered = docs.filter(d => filter === 'unread' ? !d.lu : true)
  const unreadCount = docs.filter(d => !d.lu).length

  return (
    <div>
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center">
            <Camera className="w-4.5 h-4.5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900 flex items-center gap-1.5">
              Devine qui c'est <Heart className="w-3.5 h-3.5 text-purple-500" />
            </h1>
            <p className="text-xs text-gray-400">
              Photos d'enfance transmises anonymement par l'equipe
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <span className="text-xs bg-red-500 text-white font-bold px-2.5 py-1 rounded-full">
            {unreadCount} nouvelle{unreadCount > 1 ? 's' : ''}
          </span>
        )}
      </header>

      <div className="p-6 space-y-5">
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-start gap-2 text-xs text-purple-900">
          <EyeOff className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Confidentialite garantie</p>
            <p className="mt-0.5">
              Toutes les photos sont converties en noir et blanc avant transmission.
              L'identite des deposants n'est pas enregistree. Vous etes le seul a y avoir acces.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium ${
              filter === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Toutes ({docs.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium ${
              filter === 'unread'
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Nouvelles ({unreadCount})
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-14 text-center">
            <Camera className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              {docs.length === 0 ? 'Aucune photo pour le moment' : 'Aucune photo dans ce filtre'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filtered.map(doc => (
              <div
                key={doc.id}
                className={`group relative bg-white rounded-xl border overflow-hidden hover:shadow-lg transition-all ${
                  doc.lu ? 'border-gray-200' : 'border-purple-300 ring-2 ring-purple-100'
                }`}
              >
                {!doc.lu && (
                  <span className="absolute top-2 left-2 z-10 text-[10px] bg-purple-600 text-white font-bold px-2 py-0.5 rounded-full shadow">
                    Nouveau
                  </span>
                )}
                <button
                  onClick={() => openLightbox(doc)}
                  className="block w-full aspect-square bg-gray-900 overflow-hidden"
                >
                  {doc.signedUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={doc.signedUrl}
                      alt="Photo d'enfance anonyme"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Camera className="w-8 h-8 text-gray-700" />
                    </div>
                  )}
                </button>
                <div className="p-3 space-y-2">
                  {doc.message ? (
                    <p className="text-xs text-gray-700 italic line-clamp-2">"{doc.message}"</p>
                  ) : (
                    <p className="text-xs text-gray-400 italic">Aucun indice</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-400">{timeAgo(doc.created_at)}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDownload(doc)}
                        title="Telecharger"
                        className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(doc)}
                        title="Supprimer"
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6"
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
          <div onClick={e => e.stopPropagation()} className="max-w-3xl w-full space-y-4">
            {lightbox.signedUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={lightbox.signedUrl}
                alt="Photo d'enfance"
                className="max-h-[75vh] w-full object-contain rounded-lg"
              />
            )}
            {lightbox.message && (
              <div className="bg-white/10 backdrop-blur rounded-lg px-4 py-3">
                <p className="text-xs text-white/60 mb-1">Indice du deposant</p>
                <p className="text-sm text-white italic">"{lightbox.message}"</p>
              </div>
            )}
            <div className="flex items-center justify-between text-xs text-white/50">
              <span className="flex items-center gap-1.5">
                <EyeOff className="w-3.5 h-3.5" /> Anonyme - {timeAgo(lightbox.created_at)}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(lightbox)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white text-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  Telecharger
                </button>
                {!lightbox.lu && (
                  <button
                    onClick={() => { markLu(lightbox.id); setLightbox({ ...lightbox, lu: true }) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white text-xs"
                  >
                    <MailOpen className="w-3.5 h-3.5" />
                    Marquer lu
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
