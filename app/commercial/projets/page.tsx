'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, FolderOpen, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { fetchMyProjets } from '@/hooks/useMyProjets'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'
import { StatutBadge, StatutCommercialBadge } from '@/components/ui/Badge'
import {
  formatCurrency,
  formatDateShort,
  PHASE_ORDER,
  STATUT_COMMERCIAL_LABELS,
  STATUT_COMMERCIAL_ORDER,
  cn,
} from '@/lib/utils'
import type { Projet } from '@/types/database'

type StatutCommercial = Projet['statut_commercial']

export default function CommercialProjetsList() {
  const { user, loading } = useUser()
  const [projets, setProjets] = useState<Projet[]>([])
  const [fetching, setFetching] = useState(true)
  const [toDelete, setToDelete] = useState<Projet | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!user) return
    fetchMyProjets(user.id)
      .then(setProjets)
      .catch(console.error)
      .finally(() => setFetching(false))
  }, [user])

  const handleStatutChange = async (projetId: string, next: StatutCommercial) => {
    const previous = projets
    setProjets(p => p.map(x => (x.id === projetId ? { ...x, statut_commercial: next } : x)))
    const supabase = createClient()
    const { error } = await supabase
      .schema('app')
      .from('projets')
      .update({ statut_commercial: next })
      .eq('id', projetId)
    if (error) {
      console.error(error)
      setProjets(previous)
      alert('Impossible de modifier le statut : ' + error.message)
    }
  }

  const handleDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase
      .schema('app')
      .from('projets')
      .delete()
      .eq('id', toDelete.id)
    setDeleting(false)
    if (error) {
      console.error(error)
      alert('Impossible de supprimer le projet : ' + error.message)
      return
    }
    setProjets(p => p.filter(x => x.id !== toDelete.id))
    setToDelete(null)
  }

  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <TopBar
        title="Mes projets"
        subtitle={`${projets.length} dossier${projets.length !== 1 ? 's' : ''} suivi${projets.length !== 1 ? 's' : ''}`}
      />
      <div className="p-6 space-y-3">
        <div className="flex justify-end">
          <Link
            href="/commercial/projets/nouveau"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nouveau projet
          </Link>
        </div>
        {projets.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-16 text-center">
            <FolderOpen className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-sm font-medium text-gray-700">Aucun projet</p>
            <p className="text-xs text-gray-400 mt-1">
              Les dossiers que vous suivez apparaîtront ici.
            </p>
          </div>
        ) : (
          projets.map(projet => (
            <ProjetCard
              key={projet.id}
              projet={projet}
              onStatutChange={handleStatutChange}
              onAskDelete={() => setToDelete(projet)}
            />
          ))
        )}
      </div>

      {toDelete && (
        <ConfirmDeleteModal
          projet={toDelete}
          deleting={deleting}
          onCancel={() => (deleting ? null : setToDelete(null))}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}

interface ProjetCardProps {
  projet: Projet
  onStatutChange: (id: string, next: StatutCommercial) => void
  onAskDelete: () => void
}

function ProjetCard({ projet, onStatutChange, onAskDelete }: ProjetCardProps) {
  const router = useRouter()
  const phaseIdx    = PHASE_ORDER.indexOf(projet.statut)
  const safeIdx     = phaseIdx === -1 ? PHASE_ORDER.length - 1 : phaseIdx
  const progression = Math.round(((safeIdx + 1) / PHASE_ORDER.length) * 100)

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/commercial/projets/${projet.id}`)}
      onKeyDown={e => {
        if (e.key === 'Enter') router.push(`/commercial/projets/${projet.id}`)
      }}
      className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {projet.reference && <span className="text-xs text-gray-400 font-mono">{projet.reference}</span>}
            <StatutBadge statut={projet.statut} />
            <StatutCommercialDropdown
              value={projet.statut_commercial}
              onChange={next => onStatutChange(projet.id, next)}
            />
          </div>
          <p className="text-sm font-semibold text-gray-900 truncate">{projet.nom}</p>
          {projet.client_nom && <p className="text-xs text-gray-500 mt-0.5">{projet.client_nom}</p>}
        </div>
        <div className="flex items-start gap-2 flex-shrink-0">
          <div className="text-right space-y-1">
            {projet.budget_total && <p className="text-sm font-semibold text-gray-900">{formatCurrency(projet.budget_total)}</p>}
            {projet.date_livraison && <p className="text-xs text-gray-400">Livraison {formatDateShort(projet.date_livraison)}</p>}
          </div>
          <CardMenu
            onEdit={() => router.push(`/commercial/projets/${projet.id}/modifier`)}
            onDelete={onAskDelete}
          />
        </div>
      </div>
      <div className="mt-3">
        <div className="flex gap-0.5">
          {PHASE_ORDER.map((_, i) => (
            <div key={i} className={`flex-1 h-1 rounded-full ${i <= safeIdx ? 'bg-gray-900' : 'bg-gray-100'}`} />
          ))}
        </div>
        <p className="mt-1 text-xs text-gray-400">{progression}% du cycle</p>
      </div>
    </div>
  )
}

// ─── Dropdown statut commercial ────────────────────────────────────────────

function StatutCommercialDropdown({
  value,
  onChange,
}: {
  value: StatutCommercial
  onChange: (next: StatutCommercial) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center"
      >
        <StatutCommercialBadge statut={value} className="cursor-pointer hover:opacity-80" />
        <ChevronDown className="w-3 h-3 text-gray-400 -ml-1" />
      </button>
      {open && (
        <div className="absolute left-0 mt-1 z-20 w-52 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
          {STATUT_COMMERCIAL_ORDER.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => {
                onChange(s as StatutCommercial)
                setOpen(false)
              }}
              className={cn(
                'w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50',
                s === value && 'font-semibold text-gray-900',
              )}
            >
              {STATUT_COMMERCIAL_LABELS[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Menu carte (modifier / supprimer) ─────────────────────────────────────

function CardMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600"
        aria-label="Actions"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 z-20 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onEdit()
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
          >
            <Pencil className="w-3.5 h-3.5" /> Modifier
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onDelete()
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-3.5 h-3.5" /> Supprimer
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Modale de confirmation suppression ────────────────────────────────────

function ConfirmDeleteModal({
  projet,
  deleting,
  onCancel,
  onConfirm,
}: {
  projet: Projet
  deleting: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-4 h-4 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900">Supprimer ce projet ?</h3>
            <p className="text-xs text-gray-500 mt-1">
              {projet.reference ? `${projet.reference} — ` : ''}{projet.nom}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Cette action est définitive. Toutes les données associées (lots, documents, plannings…) peuvent être supprimées également selon les règles de la base.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50"
          >
            {deleting ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  )
}
