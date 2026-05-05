'use client'

import { useState, useTransition, useRef } from 'react'
import { Plus, Trash2, GripVertical, Loader2 } from 'lucide-react'
import { addNotice, updateNotice, deleteNotice, reorderNotices } from '@/app/_actions/conception'
import type { NoticeCommerciale } from '@/lib/conception/types'

export function NoticesCommercialesEditor({
  projetId,
  initialNotices,
}: {
  projetId: string
  initialNotices: NoticeCommerciale[]
}) {
  const [notices, setNotices] = useState(initialNotices)
  const [pending, startTransition] = useTransition()
  const dragId = useRef<string | null>(null)
  const saveTimers = useRef<Record<string, NodeJS.Timeout>>({})

  function patch(id: string, key: 'lot_nom' | 'contenu_texte', value: string) {
    setNotices(prev => prev.map(n => n.id === id ? { ...n, [key]: value } : n))
    if (saveTimers.current[id]) clearTimeout(saveTimers.current[id])
    saveTimers.current[id] = setTimeout(() => {
      startTransition(() => { updateNotice(id, projetId, { [key]: value }) })
    }, 800)
  }

  function ajouter() {
    startTransition(async () => {
      const created = await addNotice(projetId, 'Nouveau lot')
      setNotices(prev => [...prev, created as NoticeCommerciale])
    })
  }

  function supprimer(id: string) {
    setNotices(prev => prev.filter(n => n.id !== id))
    startTransition(() => { deleteNotice(id, projetId) })
  }

  function onDragStart(id: string) { dragId.current = id }
  function onDragOver(e: React.DragEvent, overId: string) {
    e.preventDefault()
    if (!dragId.current || dragId.current === overId) return
    setNotices(prev => {
      const fromIdx = prev.findIndex(n => n.id === dragId.current)
      const toIdx = prev.findIndex(n => n.id === overId)
      if (fromIdx < 0 || toIdx < 0) return prev
      const next = [...prev]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      return next
    })
  }
  function onDragEnd() {
    dragId.current = null
    startTransition(() => { reorderNotices(projetId, notices.map(n => n.id)) })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
      <p className="text-xs text-gray-500 italic">
        Vos promesses au client. La Dessinatrice et l&apos;Économiste s&apos;en serviront comme source de vérité.
      </p>

      {notices.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Aucune notice.</p>
      ) : (
        <ul className="space-y-2">
          {notices.map(n => (
            <li
              key={n.id}
              draggable
              onDragStart={() => onDragStart(n.id)}
              onDragOver={e => onDragOver(e, n.id)}
              onDragEnd={onDragEnd}
              className="flex items-start gap-2 border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors bg-gray-50/50"
            >
              <GripVertical className="w-4 h-4 text-gray-300 mt-1 cursor-grab flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <input
                  value={n.lot_nom}
                  onChange={e => patch(n.id, 'lot_nom', e.target.value)}
                  placeholder="Nom du lot"
                  className="w-full text-sm font-semibold text-gray-900 border-0 bg-transparent focus:outline-none focus:ring-2 focus:ring-gray-900 rounded px-1 py-0.5"
                />
                <textarea
                  rows={2}
                  value={n.contenu_texte}
                  onChange={e => patch(n.id, 'contenu_texte', e.target.value)}
                  placeholder="Contenu de la notice…"
                  className="w-full text-sm text-gray-700 border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                />
              </div>
              <button onClick={() => supprimer(n.id)} className="p-1.5 text-gray-400 hover:text-red-500 flex-shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={ajouter}
        disabled={pending}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 border border-dashed border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50"
      >
        {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        Ajouter une notice
      </button>
    </div>
  )
}
