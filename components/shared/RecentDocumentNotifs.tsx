'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { FileText, Download, CheckCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'

interface NotifItem {
  id: string
  lu: boolean
  created_at: string
  document: {
    nom_fichier: string
    storage_path: string
    type_doc: string
    message_depot: string | null
    uploadeur: { prenom: string; nom: string } | null
  } | null
  projet: { id: string; nom: string } | null
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
  return new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

interface Props {
  roleBase: string
}

export function RecentDocumentNotifs({ roleBase }: Props) {
  const supabase = createClient()
  const { user } = useUser()
  const [notifs, setNotifs] = useState<NotifItem[]>([])
  const [loading, setLoading] = useState(true)

  const userId = user?.id ?? null

  const fetchNotifs = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .schema('app')
      .from('notifs_documents')
      .select(`
        id, lu, created_at,
        document:documents(
          nom_fichier, storage_path, type_doc, message_depot,
          uploadeur:utilisateurs!uploaded_by(prenom, nom)
        ),
        projet:projets(id, nom)
      `)
      .eq('destinataire_id', userId)
      .order('created_at', { ascending: false })
      .limit(6)
    setNotifs((data ?? []) as NotifItem[])
    setLoading(false)
  }, [userId])

  useEffect(() => {
    fetchNotifs()
    if (!userId) return
    const channel = supabase
      .channel(`dash_notifs_${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'app', table: 'notifs_documents',
        filter: `destinataire_id=eq.${userId}`,
      }, () => fetchNotifs())
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'app', table: 'notifs_documents',
        filter: `destinataire_id=eq.${userId}`,
      }, () => fetchNotifs())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, fetchNotifs])

  async function markAllLu() {
    if (!user) return
    await supabase
      .schema('app')
      .from('notifs_documents')
      .update({ lu: true, lu_le: new Date().toISOString() })
      .eq('destinataire_id', user.id)
      .eq('lu', false)
    setNotifs(prev => prev.map(n => ({ ...n, lu: true })))
  }

  async function markOneLu(id: string) {
    await supabase
      .schema('app')
      .from('notifs_documents')
      .update({ lu: true, lu_le: new Date().toISOString() })
      .eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, lu: true } : n))
  }

  async function handleDownload(storagePath: string, fileName: string) {
    const { data, error } = await supabase.storage.from('projets').createSignedUrl(storagePath, 3600)
    if (error || !data) return
    const a = document.createElement('a')
    a.href = data.signedUrl
    a.download = fileName
    a.target = '_blank'
    a.click()
  }

  const unread = notifs.filter(n => !n.lu).length

  return (
    <div className="bg-white rounded-lg border border-gray-200 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-700">Documents reçus</h2>
          {unread > 0 && (
            <span className="min-w-[1.25rem] h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
              {unread}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {unread > 0 && (
            <button
              onClick={markAllLu}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 font-medium">
              <CheckCheck className="w-3.5 h-3.5" />
              Tout lu
            </button>
          )}
          <Link href={`/${roleBase}/documents`}
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
            Voir tout →
          </Link>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
        </div>
      ) : notifs.length === 0 ? (
        <div className="py-8 text-center">
          <FileText className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-xs text-gray-400">Aucun document reçu</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {notifs.map(n => (
            <div
              key={n.id}
              onClick={() => { if (!n.lu) markOneLu(n.id) }}
              className={`flex items-start gap-3 px-4 py-3 cursor-default transition-colors ${
                n.lu ? 'hover:bg-gray-50' : 'bg-blue-50 hover:bg-blue-100/50'
              }`}
            >
              <div className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <FileText className="w-3.5 h-3.5 text-gray-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs truncate ${n.lu ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>
                  {n.document?.nom_fichier}
                </p>
                {n.document?.uploadeur && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {n.document.uploadeur.prenom} {n.document.uploadeur.nom}
                    {n.projet?.nom && <> · {n.projet.nom}</>}
                  </p>
                )}
                <p className="text-xs text-gray-300 mt-0.5">{timeAgo(n.created_at)}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 self-center">
                {!n.lu && (
                  <span className="w-2 h-2 bg-blue-500 rounded-full" />
                )}
                {n.document?.storage_path && (
                  <button
                    onClick={e => { e.stopPropagation(); handleDownload(n.document!.storage_path, n.document!.nom_fichier) }}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
                    <Download className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
