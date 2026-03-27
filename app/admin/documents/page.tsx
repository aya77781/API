'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, FileText, Download, Upload } from 'lucide-react'
import { DocumentUploadModal } from '@/components/shared/DocumentUploadModal'

interface DocRow {
  id: string
  nom_fichier: string
  type_doc: string
  taille_octets: number | null
  storage_path: string
  created_at: string
  projet_nom: string | null
  uploadeur_nom: string | null
}

const TYPE_LABELS: Record<string, string> = {
  cr: 'Compte-rendu', plan_exe: 'Plan EXE', plan_apd: 'Plan APD', plan_doe: 'Plan DOE',
  devis: 'Devis', contrat: 'Contrat', rapport_bc: 'BC', facture: 'Facture',
  photo: 'Photo', audio_reunion: 'Audio', kbis: 'Kbis', assurance: 'Assurance',
  urssaf: 'Urssaf', rib: 'RIB', autre: 'Autre',
}

function formatSize(n: number | null) {
  if (!n) return '—'
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`
  return `${(n / 1024 / 1024).toFixed(1)} Mo`
}

export default function AdminDocumentsPage() {
  const supabase = createClient()
  const [docs, setDocs] = useState<DocRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)

  useEffect(() => {
    async function load() {
      const [docsRes, usersRes, projetsRes] = await Promise.all([
        supabase.schema('app').from('documents')
          .select('id, nom_fichier, type_doc, taille_octets, storage_path, created_at, uploaded_by, projet_id')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase.schema('app').from('utilisateurs').select('id, prenom, nom'),
        supabase.schema('app').from('projets').select('id, nom'),
      ])

      const usersMap = new Map((usersRes.data ?? []).map(u => [u.id, `${u.prenom} ${u.nom}`]))
      const projetsMap = new Map((projetsRes.data ?? []).map(p => [p.id, p.nom]))

      const rows: DocRow[] = (docsRes.data ?? []).map(d => ({
        ...d,
        uploadeur_nom: d.uploaded_by ? (usersMap.get(d.uploaded_by) ?? null) : null,
        projet_nom: d.projet_id ? (projetsMap.get(d.projet_id) ?? null) : null,
      }))
      setDocs(rows)
      setLoading(false)
    }
    load()
  }, [])

  const filtered = useMemo(() => docs.filter(d => {
    const q = search.toLowerCase()
    const matchSearch = !q || d.nom_fichier.toLowerCase().includes(q) || (d.uploadeur_nom ?? '').toLowerCase().includes(q)
    const matchType = !filterType || d.type_doc === filterType
    return matchSearch && matchType
  }), [docs, search, filterType])

  async function handleDownload(storagePath: string, fileName: string) {
    const { data } = await supabase.storage.from('projets').createSignedUrl(storagePath, 3600)
    if (!data) return
    const a = document.createElement('a'); a.href = data.signedUrl; a.download = fileName; a.target = '_blank'; a.click()
  }

  const typeOptions = [...new Set(docs.map(d => d.type_doc))].sort()

  return (
    <div>
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Documents</h1>
          <p className="text-xs text-gray-400">{docs.length} fichiers uploadés</p>
        </div>
        <button
          onClick={() => setUploadOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          <Upload className="w-3.5 h-3.5" />
          Deposer
        </button>
      </header>

      <div className="p-6 space-y-4">
        {/* Filtres */}
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par nom ou uploadeur…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
            />
          </div>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            <option value="">Tous les types</option>
            {typeOptions.map(t => <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-16">
              <FileText className="w-8 h-8 text-gray-200 mb-2" />
              <p className="text-sm text-gray-400">Aucun document trouvé</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-5 py-3">Fichier</th>
                  <th className="text-left px-5 py-3">Type</th>
                  <th className="text-left px-5 py-3">Projet</th>
                  <th className="text-left px-5 py-3">Uploadé par</th>
                  <th className="text-left px-5 py-3">Taille</th>
                  <th className="text-left px-5 py-3">Date</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900 max-w-[14rem] truncate">{d.nom_fichier}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs bg-gray-100 text-gray-700 font-medium px-2 py-0.5 rounded">
                        {TYPE_LABELS[d.type_doc] ?? d.type_doc}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs max-w-[12rem] truncate">{d.projet_nom ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{d.uploadeur_nom ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{formatSize(d.taille_octets)}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">
                      {new Date(d.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => handleDownload(d.storage_path, d.nom_fichier)}
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <DocumentUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={() => setUploadOpen(false)}
      />
    </div>
  )
}
