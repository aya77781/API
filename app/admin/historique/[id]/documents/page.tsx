'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { FileText, FilePlus, Download } from 'lucide-react'
import {
  type ProjetBase, Accordion, SubPageHeader,
  CATEGORIE_LABELS, TYPE_DOC_TO_CATEGORIE,
  formatDate, statutColor,
} from '../_lib/shared'

interface Document {
  id: string
  nom_fichier: string | null
  type_doc: string | null
  categorie: string | null
  storage_path: string | null
  created_at: string
}

interface DocumentSt {
  id: string
  type_document: string | null
  date_depot: string | null
  date_validite: string | null
  fichier_url: string | null
  statut: string | null
  st_id: string | null
  sous_traitants?: { raison_sociale: string | null }[] | { raison_sociale: string | null } | null
}

function stName(d: DocumentSt): string {
  const s = d.sous_traitants
  if (!s) return '—'
  if (Array.isArray(s)) return s[0]?.raison_sociale ?? '—'
  return s.raison_sociale ?? '—'
}

export default function DocumentsPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const projetId = params.id
  const supabase = createClient()
  const { profil, loading: userLoading } = useUser()

  const [projet, setProjet] = useState<ProjetBase | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [docsST, setDocsST] = useState<DocumentSt[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userLoading) return
    if (!profil || !['admin', 'gerant'].includes(profil.role)) {
      router.replace('/login')
    }
  }, [profil, userLoading, router])

  useEffect(() => {
    if (!projetId || userLoading) return
    async function load() {
      const { data: projetData } = await supabase
        .schema('app').from('projets')
        .select('id, nom, reference, statut, archived_at, archived_by, client_nom')
        .eq('id', projetId).single()

      if (!projetData) { setLoading(false); return }
      setProjet(projetData as ProjetBase)

      const [docsRes, consultRes] = await Promise.all([
        supabase.schema('app').from('documents').select('id, nom_fichier, type_doc, categorie, storage_path, created_at')
          .eq('projet_id', projetId).order('created_at', { ascending: false }),
        supabase.schema('app').from('consultations_st').select('st_id').eq('projet_id', projetId),
      ])

      setDocuments((docsRes.data ?? []) as Document[])

      const stIds = Array.from(new Set((consultRes.data ?? []).map((c: { st_id: string | null }) => c.st_id).filter(Boolean))) as string[]
      if (stIds.length > 0) {
        const { data: docsStData } = await supabase
          .schema('app').from('documents_st')
          .select('id, type_document, date_depot, date_validite, fichier_url, statut, st_id, sous_traitants:st_id(raison_sociale)')
          .in('st_id', stIds)
        setDocsST((docsStData ?? []) as DocumentSt[])
      }
      setLoading(false)
    }
    load()
  }, [projetId, userLoading, supabase])

  const grouped = useMemo(() => {
    const buckets: Record<string, Document[]> = {
      contractuel: [], financier: [], plans: [], chantier: [], administratif: [], doe: [], autre: [],
    }
    for (const d of documents) {
      let cat = (d.categorie ?? '').toLowerCase()
      if (!buckets[cat]) cat = TYPE_DOC_TO_CATEGORIE[(d.type_doc ?? '').toLowerCase()] ?? 'autre'
      if (!buckets[cat]) cat = 'autre'
      buckets[cat].push(d)
    }
    return buckets
  }, [documents])

  async function download(path: string | null) {
    if (!path) return
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 60)
    if (error || !data?.signedUrl) {
      window.alert('Téléchargement impossible')
      return
    }
    window.open(data.signedUrl, '_blank')
  }

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!projet) {
    return <div className="p-6 text-sm text-gray-500">Projet introuvable</div>
  }

  const cats: Array<keyof typeof grouped> = ['contractuel', 'financier', 'plans', 'chantier', 'administratif', 'doe', 'autre']

  return (
    <div className="bg-gray-50 min-h-screen pb-12">
      <SubPageHeader projet={projet} sectionTitle="Documents" />

      <div className="p-6 space-y-3">
        {cats.map(cat => (
          <Accordion key={cat} title={CATEGORIE_LABELS[cat]} count={grouped[cat].length} defaultOpen={grouped[cat].length > 0 && cat === 'contractuel'}>
            {grouped[cat].length === 0 ? (
              <p className="px-5 py-4 text-sm text-gray-400">Aucun document</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {grouped[cat].map(d => (
                  <div key={d.id} className="px-5 py-3 flex items-center gap-3">
                    <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate">{d.nom_fichier ?? '—'}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        {d.type_doc && <span>{d.type_doc}</span>}
                        <span>·</span>
                        <span>{formatDate(d.created_at)}</span>
                      </div>
                    </div>
                    {d.storage_path && (
                      <button onClick={() => download(d.storage_path)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                        <Download className="w-3 h-3" /> Télécharger
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Accordion>
        ))}

        <Accordion title="Documents sous-traitants" count={docsST.length}>
          {docsST.length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-400">Aucun document ST</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {docsST.map(d => (
                <div key={d.id} className="px-5 py-3 flex items-center gap-3">
                  <FilePlus className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">
                      {stName(d)} <span className="text-gray-400">·</span> {d.type_document ?? '—'}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      {d.date_depot && <span>Déposé : {formatDate(d.date_depot)}</span>}
                      {d.date_validite && <span>· Valide jusqu'au {formatDate(d.date_validite)}</span>}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${statutColor(d.statut)}`}>{d.statut ?? '—'}</span>
                  {d.fichier_url && (
                    <a href={d.fichier_url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <Download className="w-3 h-3" /> Ouvrir
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </Accordion>
      </div>
    </div>
  )
}
