'use client'

import { useNotifications } from '@/hooks/useNotifications'
import { useDocuments } from '@/hooks/useDocuments'
import { X, Download, ArrowRight, Bell, CheckCircle, Eye, AlertTriangle, Info } from 'lucide-react'
import Link from 'next/link'

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "A l'instant"
  if (mins < 60) return `Il y a ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Il y a ${hours}h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Hier'
  return `Il y a ${days} jours`
}

const TYPE_BADGE: Record<string, string> = {
  cr: 'CR', plan_exe: 'PL', plan_apd: 'PL', plan_doe: 'PL',
  devis: 'DV', contrat: 'CT', rapport_bc: 'BC', facture: 'FA',
  photo: 'PH', audio_reunion: 'AU', autre: 'DO',
}

function alerteIcon(type: string, priorite: string) {
  if (type === 'plan_mis_a_jour') return priorite === 'high'
    ? <CheckCircle className="w-4 h-4 text-purple-600" />
    : <Eye className="w-4 h-4 text-sky-500" />
  if (priorite === 'high' || priorite === 'urgent')
    return <AlertTriangle className="w-4 h-4 text-red-500" />
  return <Info className="w-4 h-4 text-gray-400" />
}

function alerteBg(priorite: string): string {
  if (priorite === 'high' || priorite === 'urgent') return 'bg-red-50 border-red-100'
  return 'bg-gray-50 border-gray-100'
}

/* ── Component ────────────────────────────────────────────────────────────── */

interface NotificationPanelProps {
  userId: string | null
  open: boolean
  onClose: () => void
}

export function NotificationPanel({ userId, open, onClose }: NotificationPanelProps) {
  const { notifs, alertes, loading, markAllLu, markOneLu, markAlerteRead } = useNotifications(userId)
  const { getSignedUrl } = useDocuments()

  async function handleDownload(storagePath: string, fileName: string) {
    const url = await getSignedUrl(storagePath)
    if (!url) return
    const a = document.createElement('a')
    a.href = url; a.download = fileName; a.target = '_blank'; a.click()
  }

  if (!open) return null

  const totalUnread = notifs.filter(n => !n.lu).length + alertes.filter(a => !a.lue).length

  // Merge and sort by date for a unified feed
  type FeedItem =
    | { kind: 'notif';  data: typeof notifs[0];  date: string }
    | { kind: 'alerte'; data: typeof alertes[0]; date: string }

  const feed: FeedItem[] = [
    ...notifs.map(n => ({ kind: 'notif'  as const, data: n, date: n.created_at })),
    ...alertes.map(a => ({ kind: 'alerte' as const, data: a, date: a.created_at })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div className="fixed right-0 top-0 h-full w-96 z-50 bg-white border-l border-gray-200 shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900">Notifications</h2>
            {totalUnread > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                {totalUnread}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {totalUnread > 0 && (
              <button onClick={markAllLu} className="text-xs text-blue-600 hover:text-blue-800 underline">
                Tout lire
              </button>
            )}
            <button onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Feed */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-14">
              <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
            </div>
          ) : feed.length === 0 ? (
            <div className="text-center py-14 px-6">
              <Bell className="w-8 h-8 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Aucune notification</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {feed.map(item => {

                /* ── Alerte ── */
                if (item.kind === 'alerte') {
                  const a = item.data
                  return (
                    <div key={`alerte-${a.id}`}
                      onClick={() => { if (!a.lue) markAlerteRead(a.id) }}
                      className={`p-4 transition-colors cursor-default ${a.lue ? 'bg-white' : 'bg-blue-50 hover:bg-blue-100/60'}`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0 ${alerteBg(a.priorite)}`}>
                          {alerteIcon(a.type, a.priorite)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800">{a.titre}</p>
                          {a.message && (
                            <p className="text-xs text-gray-500 mt-0.5">{a.message}</p>
                          )}
                          <p className="text-xs text-gray-300 mt-1">{timeAgo(a.created_at)}</p>
                        </div>
                        {!a.lue && (
                          <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />
                        )}
                      </div>
                    </div>
                  )
                }

                /* ── Document notif ── */
                const n = item.data
                return (
                  <div key={`notif-${n.id}`}
                    onClick={() => { if (!n.lu) markOneLu(n.id) }}
                    className={`p-4 transition-colors cursor-default ${n.lu ? 'bg-white' : 'bg-blue-50 hover:bg-blue-100/60'}`}>
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-gray-600">
                          {TYPE_BADGE[n.document?.type_doc ?? ''] ?? 'DO'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        {n.document?.uploadeur && (
                          <p className="text-xs text-gray-600 mb-0.5">
                            <span className="font-semibold">
                              {n.document.uploadeur.prenom} {n.document.uploadeur.nom}
                            </span>
                            {' '}a partagé un document
                          </p>
                        )}
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {n.document?.nom_fichier}
                        </p>
                        {n.projet?.nom && (
                          <p className="text-xs text-gray-400 truncate mt-0.5">{n.projet.nom}</p>
                        )}
                        {n.document?.message_depot && (
                          <p className="text-xs text-gray-500 italic mt-1">"{n.document.message_depot}"</p>
                        )}
                        <p className="text-xs text-gray-300 mt-1">{timeAgo(n.created_at)}</p>
                        <div className="flex items-center gap-4 mt-2">
                          {n.document?.storage_path && (
                            <button
                              onClick={() => handleDownload(n.document!.storage_path, n.document!.nom_fichier)}
                              className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 font-medium">
                              <Download className="w-3 h-3" />
                              Télécharger
                            </button>
                          )}
                          {n.projet?.id && (
                            <Link href={`/co/projets/${n.projet.id}/documents`} onClick={onClose}
                              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                              Voir dans le projet
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          )}
                        </div>
                      </div>
                      {!n.lu && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
