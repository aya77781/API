'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useUser } from '@/hooks/useUser'
import { useDocuments, type DocumentGED } from '@/hooks/useDocuments'
import { DocumentUploadModal } from '@/components/shared/DocumentUploadModal'
import {
  FileText, Download, Upload, Search, Filter,
  FolderOpen, Clock, Eye,
} from 'lucide-react'

/* ── Constants ─────────────────────────────────────────────── */

const TYPE_LABELS: Record<string, string> = {
  cr:           'Compte-rendu',
  plan_exe:     'Plan EXE',
  plan_apd:     'Plan APD',
  plan_doe:     'Plan DOE',
  cctp:         'CCTP',
  devis:        'Devis',
  contrat:      'Contrat',
  rapport_bc:   'Rapport BC',
  facture:      'Facture',
  photo:        'Photo',
  audio_reunion:'Audio réunion',
  kbis:         'Kbis',
  assurance:    'Assurance',
  urssaf:       'Urssaf',
  rib:          'RIB',
  autre:        'Autre',
}

const DOSSIER_LABELS: Record<string, string> = {
  '00_client':       '00 · Client',
  '01_etudes':       '01 · Études',
  '02_commercial':   '02 · Commercial',
  '03_contractuels': '03 · Contractuels',
  '04_conception':   '04 · Conception',
  '05_urbanisme':    '05 · Urbanisme',
  '06_preparation':  '06 · Préparation',
  '07_chantier':     '07 · Chantier',
  '08_facturation':  '08 · Facturation',
  '09_gpa':          '09 · GPA',
  '10_sav':          '10 · SAV',
}

const TYPE_ICON_COLOR: Record<string, string> = {
  cr:           'bg-blue-100 text-blue-700',
  plan_exe:     'bg-violet-100 text-violet-700',
  plan_apd:     'bg-violet-100 text-violet-700',
  plan_doe:     'bg-indigo-100 text-indigo-700',
  cctp:         'bg-sky-100 text-sky-700',
  devis:        'bg-green-100 text-green-700',
  contrat:      'bg-amber-100 text-amber-700',
  rapport_bc:   'bg-cyan-100 text-cyan-700',
  facture:      'bg-red-100 text-red-700',
  photo:        'bg-pink-100 text-pink-700',
  audio_reunion:'bg-purple-100 text-purple-700',
  kbis:         'bg-orange-100 text-orange-700',
  assurance:    'bg-orange-100 text-orange-700',
  urssaf:       'bg-orange-100 text-orange-700',
  rib:          'bg-teal-100 text-teal-700',
  autre:        'bg-gray-100 text-gray-600',
}

const ROLE_COLORS: Record<string, string> = {
  co:               'bg-blue-500',
  commercial:       'bg-green-500',
  economiste:       'bg-purple-500',
  dessinatrice:     'bg-violet-500',
  comptable:        'bg-amber-500',
  gerant:           'bg-red-500',
  admin:            'bg-gray-700',
  rh:               'bg-pink-500',
  cho:              'bg-teal-500',
  assistant_travaux:'bg-orange-500',
  st:               'bg-orange-600',
  controle:         'bg-cyan-600',
  client:           'bg-slate-500',
}

/* ── Helpers ─────────────────────────────────────────────────── */

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
}

function initiales(prenom: string, nom: string) {
  return `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase()
}

/* ═════════════════════════════════════════════════════════════ */

export default function DocumentsPage() {
  const params   = useParams()
  const projetId = params.id as string

  const { user } = useUser()
  const { fetchDocumentsProjet, markDocumentLu, getSignedUrl } = useDocuments()

  const [documents, setDocuments] = useState<DocumentGED[]>([])
  const [loading, setLoading]     = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [search, setSearch]       = useState('')
  const [filterDossier, setFilterDossier] = useState('')
  const [filterType, setFilterType]       = useState('')

  async function loadDocs() {
    setLoading(true)
    const docs = await fetchDocumentsProjet(projetId)
    setDocuments(docs)
    setLoading(false)
  }

  useEffect(() => { loadDocs() }, [projetId])

  function handleModalClose() {
    setModalOpen(false)
    loadDocs()
  }

  async function handleDownload(storagePath: string, fileName: string) {
    const url = await getSignedUrl(storagePath)
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.target = '_blank'
    a.click()
  }

  async function handleMarkLu(docId: string) {
    if (!user) return
    await markDocumentLu(docId, user.id)
    setDocuments(prev =>
      prev.map(d => d.id === docId
        ? {
            ...d,
            notifs: d.notifs?.map(n =>
              n.destinataire_id === user.id ? { ...n, lu: true } : n
            ),
          }
        : d
      )
    )
  }

  function isUnread(doc: DocumentGED) {
    if (!user) return false
    return doc.notifs?.some(n => n.destinataire_id === user.id && !n.lu) ?? false
  }

  /* Filters */
  const filtered = documents.filter(d => {
    if (filterDossier && d.dossier_ged !== filterDossier) return false
    if (filterType && d.type_doc !== filterType) return false
    if (search && !d.nom_fichier.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  /* Group by dossier_ged when no filter */
  const grouped = filterDossier
    ? { [filterDossier]: filtered }
    : filtered.reduce<Record<string, DocumentGED[]>>((acc, d) => {
        if (!acc[d.dossier_ged]) acc[d.dossier_ged] = []
        acc[d.dossier_ged].push(d)
        return acc
      }, {})

  const dossierKeys = Object.keys(grouped).sort()
  const unreadTotal = documents.filter(d => isUnread(d)).length

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">GED — Documents du projet</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {documents.length} document(s)
            {unreadTotal > 0 && (
              <span className="ml-2 text-blue-600 font-medium">· {unreadTotal} non lu(s)</span>
            )}
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium">
          <Upload className="w-3.5 h-3.5" />
          Déposer un document
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom..."
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        {/* Dossier filter */}
        <select
          value={filterDossier}
          onChange={e => setFilterDossier(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
          <option value="">Tous les dossiers</option>
          {Object.entries(DOSSIER_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>

        {/* Type filter */}
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
          <option value="">Tous les types</option>
          {Object.entries(TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-14 text-center">
          <FolderOpen className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            {documents.length === 0
              ? 'Aucun document déposé pour ce projet'
              : 'Aucun résultat pour ces filtres'}
          </p>
          {documents.length === 0 && (
            <button
              onClick={() => setModalOpen(true)}
              className="mt-4 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors">
              Déposer le premier document
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {dossierKeys.map(dossier => (
            <div key={dossier}>
              {/* Dossier header */}
              <div className="flex items-center gap-2 mb-3">
                <FolderOpen className="w-4 h-4 text-gray-400" />
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {DOSSIER_LABELS[dossier] ?? dossier}
                </h3>
                <span className="text-xs text-gray-300">({grouped[dossier].length})</span>
              </div>

              {/* Documents list */}
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50 overflow-hidden">
                {grouped[dossier].map(doc => {
                  const unread = isUnread(doc)
                  return (
                    <div
                      key={doc.id}
                      onClick={() => { if (unread) handleMarkLu(doc.id) }}
                      className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${
                        unread ? 'bg-blue-50 hover:bg-blue-100/60' : 'hover:bg-gray-50'
                      } cursor-default`}
                    >
                      {/* Type badge */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${TYPE_ICON_COLOR[doc.type_doc] ?? 'bg-gray-100 text-gray-600'}`}>
                        {(TYPE_LABELS[doc.type_doc]?.slice(0, 2) ?? 'DO').toUpperCase()}
                      </div>

                      {/* Name + meta */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-medium truncate ${unread ? 'text-gray-900' : 'text-gray-700'}`}>
                            {doc.nom_fichier}
                          </p>
                          {unread && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-gray-400">
                            {TYPE_LABELS[doc.type_doc] ?? doc.type_doc}
                          </span>
                          {doc.uploadeur && (
                            <span className="text-xs text-gray-400">
                              · {doc.uploadeur.prenom} {doc.uploadeur.nom}
                            </span>
                          )}
                          <span className="text-xs text-gray-300">
                            · {new Date(doc.created_at).toLocaleDateString('fr-FR', {
                              day: 'numeric', month: 'short', year: 'numeric'
                            })}
                          </span>
                        </div>
                        {doc.message_depot && (
                          <p className="text-xs text-gray-400 italic truncate mt-0.5">
                            "{doc.message_depot}"
                          </p>
                        )}
                      </div>

                      {/* Tagged users avatars */}
                      {doc.tags_utilisateurs && doc.tags_utilisateurs.length > 0 && (
                        <div className="flex items-center -space-x-1.5 flex-shrink-0">
                          {doc.tags_utilisateurs.slice(0, 4).map((uid, i) => (
                            <div key={uid}
                              className="w-6 h-6 rounded-full bg-gray-300 border-2 border-white flex items-center justify-center text-xs font-bold text-white"
                              style={{ zIndex: 4 - i }}>
                              {doc.tags_roles?.[0]
                                ? (ROLE_COLORS[doc.tags_roles[i] ?? doc.tags_roles[0]] ?? 'bg-gray-400')
                                : ''}
                            </div>
                          ))}
                          {doc.tags_utilisateurs.length > 4 && (
                            <div className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs text-gray-600 font-bold">
                              +{doc.tags_utilisateurs.length - 4}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {doc.storage_path && (
                          <button
                            onClick={e => { e.stopPropagation(); handleDownload(doc.storage_path, doc.nom_fichier) }}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors font-medium">
                            <Download className="w-3 h-3" />
                            Télécharger
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload modal */}
      <DocumentUploadModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={loadDocs}
        projetId={projetId}
      />
    </div>
  )
}
