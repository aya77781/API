'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Pencil, Trash2, ChevronDown, ChevronRight,
  Loader2, FolderOpen, FileText, MoreVertical, X,
} from 'lucide-react'
import {
  getLotTree, createChapitre, createOuvrage, updateItem, deleteItem,
  type BiblioItem,
} from '@/app/_actions/biblio'

const UNITES = ['u', 'ml', 'm2', 'm3', 'kg', 'h', 'jour', 'forfait', 'ens', 'ft'] as const

function uniteLabel(u: string | null): string {
  if (!u) return ''
  if (u === 'm2') return 'm²'
  if (u === 'm3') return 'm³'
  return u
}

function formatPrice(p: number | null): string {
  if (p === null || p === undefined) return '—'
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(p) + ' EUR'
}

export default function LotDetailPage() {
  const params = useParams()
  const router = useRouter()
  const lotId = params.lotId as string

  const [items, setItems] = useState<BiblioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [editingLot, setEditingLot] = useState(false)
  const [lotName, setLotName] = useState('')
  const [pending, startTransition] = useTransition()

  // Modal nouveau chapitre / ouvrage
  const [modal, setModal] = useState<
    | { kind: 'chapitre'; parentId: string }
    | { kind: 'ouvrage'; parentId: string; existing?: BiblioItem }
    | null
  >(null)

  async function reload() {
    setLoading(true)
    try {
      const tree = await getLotTree(lotId)
      setItems(tree)
      // Expand all chapitres by default
      setExpanded(new Set(tree.filter((i) => i.type === 'chapitre').map((i) => i.id)))
      const lot = tree.find((i) => i.id === lotId)
      if (lot) setLotName(lot.designation)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { reload() }, [lotId])

  const lot = items.find((i) => i.id === lotId) ?? null

  // Tree par parent_id
  const byParent = useMemo(() => {
    const map = new Map<string | null, BiblioItem[]>()
    items.forEach((it) => {
      const p = it.parent_id ?? null
      if (!map.has(p)) map.set(p, [])
      map.get(p)!.push(it)
    })
    map.forEach((arr) => arr.sort((a, b) => a.ordre - b.ordre))
    return map
  }, [items])

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleDelete(item: BiblioItem) {
    const what =
      item.type === 'lot' ? `Supprimer ce lot ?` :
      item.type === 'chapitre' ? `Supprimer ce chapitre et tous ses ouvrages ?` :
      `Supprimer cet ouvrage ?`
    if (!confirm(what)) return
    try {
      await deleteItem(item.id)
      if (item.id === lotId) router.push('/economiste/bibliotheque/lots')
      else await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur a la suppression')
    }
  }

  async function handleRenameLot() {
    if (!lotName.trim() || !lot || lotName === lot.designation) {
      setEditingLot(false)
      return
    }
    try {
      await updateItem(lot.id, { designation: lotName.trim() })
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setEditingLot(false)
    }
  }

  function renderItem(item: BiblioItem, level: number) {
    if (item.type === 'chapitre') {
      const children = byParent.get(item.id) ?? []
      const isOpen = expanded.has(item.id)
      const ouvrageCount = children.filter((c) => c.type === 'ouvrage').length
      return (
        <div key={item.id} className="border-t border-gray-100">
          <div
            className="group flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 cursor-pointer"
            style={{ paddingLeft: `${12 + level * 16}px` }}
            onClick={() => toggle(item.id)}
          >
            {isOpen ? (
              <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            )}
            <FolderOpen className="w-4 h-4 text-gray-500 flex-shrink-0" />
            {item.source_code && (
              <span className="text-xs font-mono text-gray-400 flex-shrink-0">{item.source_code}</span>
            )}
            <span className="text-sm font-medium text-gray-800 flex-1 min-w-0 truncate">
              {item.designation}
            </span>
            <span className="text-xs text-gray-400 flex-shrink-0 mr-2">
              {ouvrageCount} ouvrage{ouvrageCount > 1 ? 's' : ''}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); setModal({ kind: 'ouvrage', parentId: item.id }) }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50"
              title="Ajouter un ouvrage dans ce chapitre"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(item) }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
              title="Supprimer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          {isOpen && children.map((c) => renderItem(c, level + 1))}
        </div>
      )
    }

    // Ouvrage
    return (
      <div
        key={item.id}
        className="group flex items-start gap-2 px-3 py-2 border-t border-gray-50 hover:bg-gray-50"
        style={{ paddingLeft: `${28 + level * 16}px` }}
      >
        <FileText className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-0.5" />
        {item.source_code && (
          <span className="text-[11px] font-mono text-gray-400 flex-shrink-0 mt-0.5 w-16">{item.source_code}</span>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-800 truncate">{item.designation}</p>
          {item.detail && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 whitespace-pre-line">{item.detail}</p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {item.unite && (
            <span className="text-xs text-gray-500 w-12 text-right">{uniteLabel(item.unite)}</span>
          )}
          <span className="text-sm text-gray-700 tabular-nums w-24 text-right">
            {formatPrice(item.prix_ref)}
          </span>
          <button
            onClick={() => setModal({ kind: 'ouvrage', parentId: item.parent_id!, existing: item })}
            className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-gray-700"
            title="Modifier"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleDelete(item)}
            className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-600"
            title="Supprimer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Chargement du lot...
      </div>
    )
  }

  if (!lot) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-3">Lot introuvable</p>
          <Link href="/economiste/bibliotheque/lots" className="text-sm text-blue-600 hover:text-blue-800">
            Retour a la liste
          </Link>
        </div>
      </div>
    )
  }

  const directChildren = byParent.get(lotId) ?? []
  const totalOuvrages = items.filter((i) => i.type === 'ouvrage').length
  const totalChapitres = items.filter((i) => i.type === 'chapitre').length

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-5">
          <Link
            href="/economiste/bibliotheque/lots"
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Retour aux lots
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {editingLot ? (
                <input
                  autoFocus
                  type="text"
                  value={lotName}
                  onChange={(e) => setLotName(e.target.value)}
                  onBlur={handleRenameLot}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur()
                    if (e.key === 'Escape') { setLotName(lot.designation); setEditingLot(false) }
                  }}
                  className="text-xl font-semibold text-gray-900 border-b-2 border-blue-500 focus:outline-none bg-transparent w-full"
                />
              ) : (
                <h1
                  onClick={() => setEditingLot(true)}
                  className="text-xl font-semibold text-gray-900 cursor-text hover:text-gray-700"
                  title="Cliquer pour renommer"
                >
                  {lot.source_code && <span className="text-sm font-mono text-gray-400 mr-2">{lot.source_code}</span>}
                  {lot.designation}
                </h1>
              )}
              <p className="text-xs text-gray-500 mt-1">
                {totalChapitres} chapitre{totalChapitres > 1 ? 's' : ''} · {totalOuvrages} ouvrage{totalOuvrages > 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setModal({ kind: 'chapitre', parentId: lotId })}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50"
              >
                <Plus className="w-4 h-4" />
                Nouveau chapitre
              </button>
              <button
                onClick={() => handleDelete(lot)}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                title="Supprimer le lot"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-3 text-sm mb-4">{error}</div>
        )}

        {directChildren.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-lg p-10 text-center">
            <FolderOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-4">Ce lot ne contient aucun chapitre</p>
            <button
              onClick={() => setModal({ kind: 'chapitre', parentId: lotId })}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Creer le premier chapitre
            </button>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg">
            {directChildren.map((c) => renderItem(c, 0))}
          </div>
        )}
      </main>

      {/* Modal nouveau / edition */}
      {modal && (
        <ItemModal
          modal={modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); reload() }}
        />
      )}
    </div>
  )
}

// ─── Modal creation / edition ───────────────────────────────────────────────
function ItemModal({
  modal,
  onClose,
  onSaved,
}: {
  modal:
    | { kind: 'chapitre'; parentId: string }
    | { kind: 'ouvrage'; parentId: string; existing?: BiblioItem }
  onClose: () => void
  onSaved: () => void
}) {
  const isOuvrage = modal.kind === 'ouvrage'
  const existing = isOuvrage ? modal.existing : undefined
  const [designation, setDesignation] = useState(existing?.designation ?? '')
  const [detail, setDetail] = useState(existing?.detail ?? '')
  const [unite, setUnite] = useState(existing?.unite ?? 'u')
  const [prix, setPrix] = useState(existing?.prix_ref != null ? String(existing.prix_ref) : '')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSave() {
    setError(null)
    if (!designation.trim()) { setError('Designation obligatoire'); return }
    startTransition(async () => {
      try {
        if (modal.kind === 'chapitre') {
          await createChapitre(modal.parentId, designation.trim())
        } else if (existing) {
          await updateItem(existing.id, {
            designation: designation.trim(),
            detail: detail.trim() || null,
            unite,
            prix_ref: prix ? parseFloat(prix.replace(',', '.')) : null,
          })
        } else {
          await createOuvrage({
            parentId: modal.parentId,
            designation: designation.trim(),
            detail: detail.trim() || undefined,
            unite,
            prix_ref: prix ? parseFloat(prix.replace(',', '.')) : undefined,
          })
        }
        onSaved()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur')
      }
    })
  }

  const title =
    modal.kind === 'chapitre' ? 'Nouveau chapitre' :
    existing ? 'Modifier l\'ouvrage' : 'Nouvel ouvrage'

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Designation *</label>
            <input
              autoFocus
              type="text"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder={isOuvrage ? 'ex: Cloison BA13 + isolant 70mm' : 'ex: Cloisons / Doublages'}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500"
            />
          </div>
          {isOuvrage && (
            <>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Detail (optionnel)</label>
                <textarea
                  rows={3}
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  placeholder="Description technique, references, normes..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500 resize-y"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Unite</label>
                  <select
                    value={unite}
                    onChange={(e) => setUnite(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500"
                  >
                    {UNITES.map((u) => <option key={u} value={u}>{uniteLabel(u)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Prix de reference (EUR HT)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={prix}
                    onChange={(e) => setPrix(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500 tabular-nums"
                  />
                </div>
              </div>
            </>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded p-2 text-xs">{error}</div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={!designation.trim() || pending}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-black disabled:opacity-40"
          >
            {pending ? 'Enregistrement...' : (existing ? 'Mettre a jour' : 'Creer')}
          </button>
        </div>
      </div>
    </div>
  )
}
