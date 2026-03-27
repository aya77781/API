'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@/hooks/useUser'
import { useDocuments, type DocumentGED, type NotifDocumentRow } from '@/hooks/useDocuments'
import { DocumentUploadModal } from '@/components/shared/DocumentUploadModal'
import {
  FileText, Download, Check, FolderOpen,
  CheckCheck, ExternalLink, Clock, Upload,
} from 'lucide-react'
import Link from 'next/link'

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

const ROLE_COLORS: Record<string, string> = {
  co:                'bg-blue-500',
  commercial:        'bg-green-500',
  economiste:        'bg-purple-500',
  dessinatrice:      'bg-violet-500',
  comptable:         'bg-amber-500',
  gerant:            'bg-red-500',
  admin:             'bg-gray-700',
  rh:                'bg-pink-500',
  cho:               'bg-teal-500',
  assistant_travaux: 'bg-orange-500',
  st:                'bg-orange-600',
  controle:          'bg-cyan-600',
  client:            'bg-slate-500',
}

/* ── Helpers ─────────────────────────────────────────────────── */

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

function formatSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
}

/* ── Props ───────────────────────────────────────────────────── */

interface DocumentsPageProps {
  /** e.g. 'co', 'st', 'at', etc. — used to build "Voir dans le projet" links (optional) */
  roleBase?: string
}

/* ═════════════════════════════════════════════════════════════ */

export function DocumentsPage({ roleBase }: DocumentsPageProps) {
  const { user } = useUser()
  const {
    getSignedUrl,
    fetchDocumentsRecus,
    fetchDocumentsDeposes,
    markLu,
    markAllLu,
  } = useDocuments()

  const [tab, setTab]   = useState<'recus' | 'deposes'>('recus')
  const [modalOpen, setModalOpen] = useState(false)

  async function handleDownload(storagePath: string, fileName: string) {
    const url = await getSignedUrl(storagePath)
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.target = '_blank'
    a.click()
  }
  const [recus, setRecus]   = useState<NotifDocumentRow[]>([])
  const [deposes, setDeposes] = useState<DocumentGED[]>([])
  const [loading, setLoading] = useState(true)

  /* Filters for "Déposés" tab */
  const [filterProjet, setFilterProjet] = useState('')
  const [filterType, setFilterType]     = useState('')
  const [filterDossier, setFilterDossier] = useState('')

  async function loadAll() {
    if (!user) return
    setLoading(true)
    const [r, d] = await Promise.all([
      fetchDocumentsRecus(user.id),
      fetchDocumentsDeposes(user.id),
    ])
    setRecus(r)
    setDeposes(d)
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [user])

  async function handleMarkLu(notifId: string) {
    await markLu(notifId)
    setRecus(prev => prev.map(n => n.id === notifId ? { ...n, lu: true } : n))
  }

  async function handleMarkAllLu() {
    if (!user) return
    await markAllLu(user.id)
    setRecus(prev => prev.map(n => ({ ...n, lu: true })))
  }

  const unreadCount = recus.filter(n => !n.lu).length

  /* Filters for Déposés */
  const projets = [...new Map(
    deposes.map(d => [d.projet?.id, d.projet])
  ).values()].filter(Boolean)

  const filteredDeposes = deposes.filter(d => {
    if (filterProjet && d.projet?.id !== filterProjet) return false
    if (filterType   && d.type_doc   !== filterType)   return false
    if (filterDossier && d.dossier_ged !== filterDossier) return false
    return true
  })

  const ROLES_WITH_PROJET_DETAIL = ['co', 'commercial', 'economiste', 'st']

  function projetLink(projetId: string) {
    if (!roleBase || !ROLES_WITH_PROJET_DETAIL.includes(roleBase)) return null
    if (roleBase === 'co') return `/co/projets/${projetId}/documents`
    return `/${roleBase}/projets/${projetId}`
  }

  return (
    <div>
      {/* Page header */}
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Documents</h1>
          <p className="text-xs text-gray-400">Tous les documents partagés avec moi ou déposés par moi</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
        >
          <Upload className="w-3.5 h-3.5" />
          Déposer un document
        </button>
      </header>

      <div className="p-6 space-y-5">
        {/* Tabs */}
        <div className="flex items-center border-b border-gray-200">
          {([
            { key: 'recus',   label: 'Reçus',   count: unreadCount   },
            { key: 'deposes', label: 'Déposés', count: deposes.length },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
              {t.count > 0 && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                  t.key === 'recus' && unreadCount > 0
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab : Reçus ── */}
        {tab === 'recus' && (
          <div className="space-y-4">
            {unreadCount > 0 && (
              <div className="flex justify-end">
                <button onClick={handleMarkAllLu}
                  className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 font-medium">
                  <CheckCheck className="w-3.5 h-3.5" />
                  Tout marquer comme lu
                </button>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
              </div>
            ) : recus.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-14 text-center">
                <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Aucun document reçu</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50 overflow-hidden">
                {recus.map(n => {
                  const link = n.projet?.id ? projetLink(n.projet.id) : null
                  return (
                    <div
                      key={n.id}
                      onClick={() => { if (!n.lu) handleMarkLu(n.id) }}
                      className={`flex items-start gap-4 px-5 py-4 transition-colors cursor-default ${
                        n.lu ? '' : 'bg-blue-50 hover:bg-blue-100/50'
                      }`}
                    >
                      {/* Icon */}
                      <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <FileText className="w-4 h-4 text-gray-500" />
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Sender */}
                        {n.document?.uploadeur && (
                          <p className="text-xs text-gray-500 mb-0.5">
                            <span className="font-semibold text-gray-700">
                              {n.document.uploadeur.prenom} {n.document.uploadeur.nom}
                            </span>
                            {' '}a partagé un document
                          </p>
                        )}
                        {/* File name */}
                        <p className={`text-sm truncate ${n.lu ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>
                          {n.document?.nom_fichier}
                        </p>
                        {/* Project */}
                        {n.projet?.nom && (
                          <p className="text-xs text-gray-400 mt-0.5">Projet : {n.projet.nom}</p>
                        )}
                        {/* Message */}
                        {n.document?.message_depot && (
                          <p className="text-xs text-gray-500 italic mt-1">"{n.document.message_depot}"</p>
                        )}
                        {/* Date */}
                        <p className="text-xs text-gray-300 mt-1">{timeAgo(n.created_at)}</p>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0 self-center">
                        {!n.lu && (
                          <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">
                            Non lu
                          </span>
                        )}
                        {n.document?.storage_path && (
                          <button
                            onClick={e => { e.stopPropagation(); handleDownload(n.document!.storage_path, n.document!.nom_fichier) }}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 font-medium">
                            <Download className="w-3 h-3" />
                            Télécharger
                          </button>
                        )}
                        {link && (
                          <Link href={link}
                            onClick={e => { e.stopPropagation(); if (!n.lu) handleMarkLu(n.id) }}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 font-medium">
                            <ExternalLink className="w-3 h-3" />
                            Voir
                          </Link>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Tab : Déposés ── */}
        {tab === 'deposes' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <select value={filterProjet} onChange={e => setFilterProjet(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                <option value="">Tous les projets</option>
                {projets.map(p => p && (
                  <option key={p.id} value={p.id}>{p.nom}</option>
                ))}
              </select>
              <select value={filterType} onChange={e => setFilterType(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                <option value="">Tous les types</option>
                {Object.entries(TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <select value={filterDossier} onChange={e => setFilterDossier(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                <option value="">Tous les dossiers</option>
                {Object.entries(DOSSIER_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
              </div>
            ) : filteredDeposes.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-14 text-center">
                <FolderOpen className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-500">
                  {deposes.length === 0 ? 'Aucun document déposé' : 'Aucun résultat'}
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50 overflow-hidden">
                {filteredDeposes.map(doc => {
                  const destinatairesCount = doc.tags_utilisateurs?.length ?? 0
                  const roles = doc.tags_roles ?? []
                  const link = doc.projet?.id ? projetLink(doc.projet.id) : null
                  return (
                    <div key={doc.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-gray-500" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{doc.nom_fichier}</p>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                          {doc.projet?.nom && <span>{doc.projet.nom}</span>}
                          <span>·</span>
                          <span>{TYPE_LABELS[doc.type_doc] ?? doc.type_doc}</span>
                          <span>·</span>
                          <span>{DOSSIER_LABELS[doc.dossier_ged] ?? doc.dossier_ged}</span>
                          <span>·</span>
                          <span>{new Date(doc.created_at).toLocaleDateString('fr-FR', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}</span>
                          {doc.taille_octets && (
                            <><span>·</span><span>{formatSize(doc.taille_octets)}</span></>
                          )}
                        </div>
                      </div>

                      {/* Destinataires avatars */}
                      {destinatairesCount > 0 && (
                        <div className="flex items-center -space-x-1.5 flex-shrink-0">
                          {roles.slice(0, 3).map((r, i) => (
                            <div key={i}
                              className={`w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white ${ROLE_COLORS[r] ?? 'bg-gray-400'}`}
                              style={{ zIndex: 3 - i }}>
                            </div>
                          ))}
                          {destinatairesCount > 3 && (
                            <div className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs text-gray-600 font-bold">
                              +{destinatairesCount - 3}
                            </div>
                          )}
                        </div>
                      )}

                      {/* OneDrive sync status */}
                      <div className={`flex items-center gap-1 text-xs flex-shrink-0 ${
                        doc.onedrive_sync ? 'text-green-600' : 'text-gray-400'
                      }`}>
                        {doc.onedrive_sync
                          ? <><Check className="w-3 h-3" /> Synchronisé</>
                          : <><Clock className="w-3 h-3" /> En attente</>
                        }
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleDownload(doc.storage_path, doc.nom_fichier)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 font-medium">
                          <Download className="w-3 h-3" />
                          Télécharger
                        </button>
                        {link && (
                          <Link href={link}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 font-medium">
                            <ExternalLink className="w-3 h-3" />
                            Projet
                          </Link>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <DocumentUploadModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={loadAll}
        projetId=""
      />
    </div>
  )
}
