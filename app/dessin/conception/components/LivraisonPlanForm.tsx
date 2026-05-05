'use client'

import { useState, useTransition, useRef } from 'react'
import { Upload, FileText, X, Loader2, CheckCircle, Play } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { livrerDemande, marquerEnCours } from '@/app/_actions/conception'
import { useRouter } from 'next/navigation'
import { labelType } from '@/lib/conception/types'

type Demande = {
  id: string
  type: string | null
  version: number | null
  statut: string | null
  livrable_url: string | null
  livrable_3d_url: string | null
  notes_livreur: string | null
  projet_id: string
}

const MAX_SIZE = 50 * 1024 * 1024

export function LivraisonPlanForm({ demande }: { demande: Demande }) {
  const supabase = createClient()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const file3dRef = useRef<HTMLInputElement>(null)
  const [filePlan, setFilePlan] = useState<File | null>(null)
  const [file3d, setFile3d] = useState<File | null>(null)
  const [notes, setNotes] = useState(demande.notes_livreur ?? '')
  const [pending, startTransition] = useTransition()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dejaLivre = demande.statut === 'livree'

  async function uploadFile(f: File, prefix: string): Promise<string | null> {
    if (f.size > MAX_SIZE) {
      throw new Error(`Fichier trop volumineux (max ${MAX_SIZE / 1024 / 1024} Mo)`)
    }
    const path = `conception/${demande.projet_id}/${demande.id}/${prefix}_${Date.now()}_${f.name}`
    const { error } = await supabase.storage.from('projets').upload(path, f, { upsert: true })
    if (error) throw error
    const { data } = supabase.storage.from('projets').getPublicUrl(path)
    return data.publicUrl
  }

  function clic_marquer_en_cours() {
    startTransition(async () => {
      await marquerEnCours(demande.id)
      router.refresh()
    })
  }

  async function livrer() {
    setError(null)
    setUploading(true)
    try {
      let planUrl = demande.livrable_url
      let plan3dUrl = demande.livrable_3d_url
      if (filePlan) planUrl = await uploadFile(filePlan, 'plan')
      if (file3d) plan3dUrl = await uploadFile(file3d, '3d')

      if (!planUrl) {
        setUploading(false)
        setError('Le plan principal est requis avant la livraison')
        return
      }

      startTransition(async () => {
        await livrerDemande({
          demandeId: demande.id,
          livrableUrl: planUrl,
          livrable3dUrl: plan3dUrl,
          notes: notes || null,
        })
        setUploading(false)
        router.push('/dessin/conception')
      })
    } catch (e) {
      setUploading(false)
      setError((e as Error).message)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">{labelType(demande.type)}</p>
        {demande.statut === 'en_attente' && !dejaLivre && (
          <button
            onClick={clic_marquer_en_cours}
            disabled={pending}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-50 disabled:opacity-50"
          >
            <Play className="w-3 h-3" /> Marquer en cours
          </button>
        )}
      </div>

      {dejaLivre && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <p className="text-sm text-green-700">Demande déjà livrée. Vous pouvez remplacer les fichiers ci-dessous si nécessaire.</p>
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Plan principal (PDF / DWG, 50 Mo max)</label>
        <input ref={fileRef} type="file" className="hidden" accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg"
               onChange={e => { const f = e.target.files?.[0] ?? null; setFilePlan(f); e.target.value = '' }} />
        {filePlan ? (
          <FilePill name={filePlan.name} size={filePlan.size} onRemove={() => setFilePlan(null)} />
        ) : demande.livrable_url ? (
          <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <a href={demande.livrable_url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline truncate">
              <FileText className="w-3.5 h-3.5 inline mr-1.5" />Plan déjà uploadé
            </a>
            <button type="button" onClick={() => fileRef.current?.click()} className="text-xs text-blue-600 hover:underline">Remplacer</button>
          </div>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 w-full border border-dashed border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-500 hover:border-gray-400 hover:bg-gray-50 justify-center">
            <Upload className="w-4 h-4" /> Sélectionner un fichier
          </button>
        )}
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Vue 3D (optionnel)</label>
        <input ref={file3dRef} type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.glb,.gltf"
               onChange={e => { const f = e.target.files?.[0] ?? null; setFile3d(f); e.target.value = '' }} />
        {file3d ? (
          <FilePill name={file3d.name} size={file3d.size} onRemove={() => setFile3d(null)} />
        ) : demande.livrable_3d_url ? (
          <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <a href={demande.livrable_3d_url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline truncate">
              <FileText className="w-3.5 h-3.5 inline mr-1.5" />Vue 3D uploadée
            </a>
            <button type="button" onClick={() => file3dRef.current?.click()} className="text-xs text-blue-600 hover:underline">Remplacer</button>
          </div>
        ) : (
          <button type="button" onClick={() => file3dRef.current?.click()}
                  className="flex items-center gap-2 w-full border border-dashed border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-500 hover:border-gray-400 hover:bg-gray-50 justify-center">
            <Upload className="w-4 h-4" /> Sélectionner une vue 3D
          </button>
        )}
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Notes pour le Commercial</label>
        <textarea
          rows={3}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Choix techniques, points d'attention…"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none placeholder-gray-300"
        />
      </div>

      {error && <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      <div className="flex justify-end gap-2">
        <button
          onClick={livrer}
          disabled={pending || uploading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-40"
        >
          {(pending || uploading) ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          Livrer au Commercial
        </button>
      </div>
    </div>
  )
}

function FilePill({ name, size, onRemove }: { name: string; size: number; onRemove: () => void }) {
  return (
    <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <span className="text-sm text-gray-700 truncate">{name}</span>
        <span className="text-xs text-gray-400 flex-shrink-0">{(size / 1024).toFixed(0)} Ko</span>
      </div>
      <button onClick={onRemove} className="text-gray-400 hover:text-red-500 ml-2"><X className="w-4 h-4" /></button>
    </div>
  )
}
