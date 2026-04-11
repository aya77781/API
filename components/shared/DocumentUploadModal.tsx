'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useDocuments } from '@/hooks/useDocuments'
import { useUser } from '@/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import { searchDossiers, getChildren, getDossierTree } from '@/lib/documents/searchDossiers'
import type { Dossier, TreeNode } from '@/lib/documents/searchDossiers'
import {
  X, Upload, FileText, Users, Check,
  FileSpreadsheet, Image, Music, Video, Archive,
  Search, FolderOpen, FolderClosed, ChevronLeft, ChevronRight,
} from 'lucide-react'

/* ── Constants ─────────────────────────────────────────────── */

const GROUPES_INFORM = [
  {
    key: 'interne',
    label: 'Equipe interne',
    roles: ['co', 'commercial', 'economiste', 'dessinatrice', 'comptable',
            'gerant', 'admin', 'rh', 'cho', 'assistant_travaux'],
  },
  { key: 'st',      label: 'ST',                   roles: ['st']        },
  { key: 'client',  label: 'Client',                roles: ['client']    },
  { key: 'controle',label: 'Bureau de controle',    roles: ['controle']  },
  {
    key: 'tous',
    label: 'Tout le monde',
    roles: ['co', 'commercial', 'economiste', 'dessinatrice', 'comptable',
            'gerant', 'admin', 'rh', 'cho', 'assistant_travaux',
            'st', 'client', 'controle'],
  },
]

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

const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.dwg,.mp3,.mp4,.webm,.zip,.rar'
const MAX_SIZE = 100 * 1024 * 1024

/* ── Types ──────────────────────────────────────────────────── */

interface Utilisateur { id: string; prenom: string; nom: string; role: string }
interface ProjetOption { id: string; nom: string; reference: string | null }

export interface DocumentUploadModalProps {
  open: boolean
  onClose: () => void
  onSuccess: (documentId?: string) => void
  projetId?: string
  nomProjet?: string
  lotId?: string
  dossierGedDefault?: string
}

/* ── Helpers ────────────────────────────────────────────────── */

function initiales(prenom: string, nom: string) {
  return `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase()
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
}

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext))
    return <Image className="w-5 h-5 text-pink-500" />
  if (['mp3', 'wav', 'ogg'].includes(ext))
    return <Music className="w-5 h-5 text-purple-500" />
  if (['mp4', 'webm', 'mov'].includes(ext))
    return <Video className="w-5 h-5 text-blue-500" />
  if (['xls', 'xlsx', 'csv'].includes(ext))
    return <FileSpreadsheet className="w-5 h-5 text-green-600" />
  if (['zip', 'rar', '7z'].includes(ext))
    return <Archive className="w-5 h-5 text-amber-500" />
  return <FileText className="w-5 h-5 text-gray-500" />
}

type Step = 'projet' | 'dossier' | 'upload'

/* ═══════════════════════════════════════════════════════════ */

export function DocumentUploadModal({
  open, onClose, onSuccess, projetId, nomProjet = '', lotId, dossierGedDefault,
}: DocumentUploadModalProps) {
  const { user, profil } = useUser()
  const { uploadDocument } = useDocuments()
  const supabase = createClient()

  /* Step */
  const initialStep: Step = projetId ? 'dossier' : 'projet'
  const [step, setStep] = useState<Step>(initialStep)

  /* Projet selection (when no projetId) */
  const [projets, setProjets]               = useState<ProjetOption[]>([])
  const [projetQuery, setProjetQuery]       = useState('')
  const [selectedProjetId, setSelectedProjetId] = useState(projetId ?? '')
  const [selectedProjetNom, setSelectedProjetNom] = useState(nomProjet)

  /* Dossier selection */
  const [dossierQuery, setDossierQuery]     = useState('')
  const [selectedDossier, setSelectedDossier] = useState<Dossier | null>(
    dossierGedDefault ? { chemin: dossierGedDefault, label: dossierGedDefault, mots_cles: [], roles: [] } : null
  )
  const [treePath, setTreePath] = useState<string[]>([]) // breadcrumb segments
  const [showTreeSidebar, setShowTreeSidebar] = useState(false)

  /* Upload */
  const [file, setFile]                     = useState<File | null>(null)
  const [drag, setDrag]                     = useState(false)
  const [selectedUsers, setSelectedUsers]   = useState<Utilisateur[]>([])
  const [activeGroupes, setActiveGroupes]   = useState<string[]>([])
  const [message, setMessage]               = useState('')
  const [userSearch, setUserSearch]         = useState('')
  const [utilisateurs, setUtilisateurs]     = useState<Utilisateur[]>([])
  const [usersLoaded, setUsersLoaded]       = useState(false)
  const [progress, setProgress]             = useState(0)
  const [uploading, setUploading]           = useState(false)
  const [error, setError]                   = useState('')
  const [done, setDone]                     = useState(false)
  const [uploadedDocId, setUploadedDocId]   = useState<string | undefined>(undefined)
  const fileRef = useRef<HTMLInputElement>(null)
  const dossierInputRef = useRef<HTMLInputElement>(null)

  /* Load projets */
  useEffect(() => {
    if (!open || projetId) return
    supabase
      .schema('app')
      .from('projets')
      .select('id, nom, reference')
      .order('nom')
      .then(({ data }) => setProjets((data ?? []) as ProjetOption[]))
  }, [open, projetId])

  /* Load utilisateurs */
  const loadUtilisateurs = useCallback(async () => {
    if (usersLoaded) return
    const { data } = await supabase
      .schema('app')
      .from('utilisateurs')
      .select('id, prenom, nom, role')
      .eq('actif', true)
      .order('prenom')
    setUtilisateurs((data ?? []) as Utilisateur[])
    setUsersLoaded(true)
  }, [usersLoaded])

  useEffect(() => {
    if (open && step === 'upload') loadUtilisateurs()
  }, [open, step, loadUtilisateurs])

  /* Focus dossier input when entering step */
  useEffect(() => {
    if (step === 'dossier') setTimeout(() => dossierInputRef.current?.focus(), 50)
  }, [step])

  /* ── File ── */
  function handleFile(f: File) {
    if (f.size > MAX_SIZE) { setError('Fichier trop volumineux (max 100 Mo)'); return }
    setFile(f)
    setError('')
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDrag(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  /* ── Groupes ── */
  function toggleGroupe(groupe: typeof GROUPES_INFORM[0]) {
    const isActive = activeGroupes.includes(groupe.key)
    if (isActive) {
      setActiveGroupes(prev => prev.filter(k => k !== groupe.key))
      const otherActiveRoles = new Set(
        GROUPES_INFORM
          .filter(g => g.key !== groupe.key && activeGroupes.includes(g.key))
          .flatMap(g => g.roles)
      )
      setSelectedUsers(prev => prev.filter(u => otherActiveRoles.has(u.role)))
    } else {
      setActiveGroupes(prev => [...prev, groupe.key])
      const groupeUsers = utilisateurs.filter(u => groupe.roles.includes(u.role))
      setSelectedUsers(prev => {
        const ids = new Set(prev.map(x => x.id))
        return [...prev, ...groupeUsers.filter(u => !ids.has(u.id))]
      })
    }
  }

  function toggleUser(u: Utilisateur) {
    setSelectedUsers(prev =>
      prev.find(x => x.id === u.id)
        ? prev.filter(x => x.id !== u.id)
        : [...prev, u]
    )
  }

  /* ── Submit ── */
  async function handleSubmit() {
    if (!user || !profil) return
    if (!file) { setError('Veuillez selectionner un fichier'); return }
    if (!selectedDossier) { setError('Veuillez choisir un dossier'); return }
    if (!selectedProjetId) { setError('Veuillez choisir un projet'); return }

    setUploading(true)
    setError('')
    setProgress(0)

    const { error: err, documentId: docId } = await uploadDocument(
      {
        file,
        projetId: selectedProjetId,
        lotId,
        typeDoc: 'autre',
        dossierGed: selectedDossier.chemin,
        tagsUtilisateurs: selectedUsers.map(u => ({ id: u.id, role: u.role })),
        messageDepot: message,
        userId: user.id,
        userPrenom: profil.prenom,
        userNom: profil.nom,
        userRole: profil.role,
        nomProjet: selectedProjetNom,
      },
      setProgress,
    )

    setUploading(false)
    if (err) { setError(err); setProgress(0); return }
    setUploadedDocId(docId)
    setDone(true)
  }

  /* ── Reset ── */
  function reset() {
    setStep(projetId ? 'dossier' : 'projet')
    setFile(null)
    setDossierQuery('')
    setTreePath([])
    setShowTreeSidebar(false)
    setSelectedDossier(
      dossierGedDefault ? { chemin: dossierGedDefault, label: dossierGedDefault, mots_cles: [], roles: [] } : null
    )
    setSelectedUsers([])
    setActiveGroupes([])
    setMessage('')
    setUserSearch('')
    setError('')
    setProgress(0)
    setDone(false)
    setUploadedDocId(undefined)
    if (!projetId) {
      setProjetQuery('')
      setSelectedProjetId('')
      setSelectedProjetNom('')
    }
  }

  function handleClose() {
    if (uploading) return
    reset()
    onClose()
  }

  /* ── Derived ── */
  const dossierResults = profil
    ? searchDossiers(dossierQuery, profil.role)
    : []

  const filteredProjets = projets.filter(p =>
    `${p.nom} ${p.reference ?? ''}`.toLowerCase().includes(projetQuery.toLowerCase())
  )

  const filteredUsers = utilisateurs.filter(u =>
    u.id !== user?.id &&
    `${u.prenom} ${u.nom} ${u.role}`.toLowerCase().includes(userSearch.toLowerCase())
  )

  if (!open) return null

  /* ═══════════════════ RENDER ═══════════════════ */

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

      <div className={`relative bg-[#fafaf8] rounded-xl shadow-2xl w-full max-h-[92vh] flex overflow-hidden transition-all duration-200 ${
        step === 'dossier' ? 'max-w-[860px]' : 'max-w-[480px]'
      }`}>

        {/* Main column */}
        <div className="flex-1 flex flex-col min-w-0 max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0 bg-white">
          <div className="flex items-center gap-2">
            {step === 'upload' && (
              <button
                onClick={() => setStep('dossier')}
                disabled={uploading}
                className="p-1 text-gray-400 hover:text-gray-700 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="text-base font-semibold text-gray-900">
              {step === 'projet' && 'Choisir un projet'}
              {step === 'dossier' && 'Dans quel dossier ?'}
              {step === 'upload' && (selectedDossier?.label ?? 'Deposer un document')}
            </h2>
          </div>
          <button
            onClick={handleClose}
            disabled={uploading}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress bar */}
        {uploading && (
          <div className="h-1 bg-gray-100 flex-shrink-0">
            <div
              className="h-full bg-gray-900 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Done ── */}
          {done ? (
            <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Check className="w-7 h-7 text-green-600" />
              </div>
              <p className="text-base font-semibold text-gray-900 mb-1">
                Depose dans {selectedDossier?.label ?? 'la GED'}
              </p>
              <p className="text-sm text-gray-500 mb-6">
                {selectedUsers.length > 0
                  ? `${selectedUsers.length} personne${selectedUsers.length > 1 ? 's' : ''} notifiee${selectedUsers.length > 1 ? 's' : ''}`
                  : 'Enregistre dans la GED du projet'}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={reset}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Deposer un autre
                </button>
                <button
                  onClick={() => { const id = uploadedDocId; reset(); onSuccess(id); onClose() }}
                  className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700"
                >
                  Fermer
                </button>
              </div>
            </div>

          /* ── Step: Projet ── */
          ) : step === 'projet' ? (
            <div className="px-6 py-5 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={projetQuery}
                  onChange={e => setProjetQuery(e.target.value)}
                  placeholder="Rechercher un projet..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                />
              </div>
              <div className="space-y-0.5 max-h-72 overflow-y-auto">
                {filteredProjets.map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedProjetId(p.id)
                      setSelectedProjetNom(p.nom)
                      setStep('dossier')
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-gray-100 transition-colors"
                  >
                    <FolderOpen className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.nom}</p>
                      {p.reference && (
                        <p className="text-xs text-gray-400">{p.reference}</p>
                      )}
                    </div>
                  </button>
                ))}
                {filteredProjets.length === 0 && projetQuery.length > 0 && (
                  <p className="py-6 text-center text-sm text-gray-400">Aucun projet trouve</p>
                )}
              </div>
            </div>

          /* ── Step: Dossier ── */
          ) : step === 'dossier' ? (
            <div className="px-6 py-5 space-y-3">
              {selectedProjetNom && (
                <p className="text-xs text-gray-400 mb-1">
                  Projet : <span className="font-medium text-gray-700">{selectedProjetNom}</span>
                </p>
              )}

              {/* Breadcrumb */}
              <div className="flex items-center gap-1 flex-wrap text-xs">
                <button onClick={() => setTreePath([])} className={`font-medium ${treePath.length === 0 ? 'text-gray-900' : 'text-gray-400 hover:text-gray-700'}`}>
                  GED
                </button>
                {treePath.map((seg, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <ChevronRight className="w-3 h-3 text-gray-300" />
                    <button
                      onClick={() => setTreePath(treePath.slice(0, i + 1))}
                      className={`font-medium ${i === treePath.length - 1 ? 'text-gray-900' : 'text-gray-400 hover:text-gray-700'}`}
                    >
                      {seg.replace(/^\d+_/, '').replace(/_/g, ' ')}
                    </button>
                  </span>
                ))}
              </div>

              {/* Liste navigable */}
              <div className="space-y-0.5 max-h-[50vh] overflow-y-auto">
                {(() => {
                  const currentPath = treePath.join('/')
                  const children = profil ? getChildren(currentPath, profil.role) : []
                  if (children.length === 0) {
                    return <p className="py-6 text-center text-sm text-gray-400">Aucun sous-dossier</p>
                  }
                  return children.map(node => {
                    const hasChildren = node.children.length > 0
                    const isLeaf = !hasChildren
                    return (
                      <button
                        key={node.segment}
                        onClick={() => {
                          if (isLeaf && node.dossier) {
                            setSelectedDossier(node.dossier)
                            setTreePath([])
                            setStep('upload')
                          } else if (isLeaf) {
                            setSelectedDossier({ chemin: node.chemin, label: node.label, mots_cles: [], roles: node.roles })
                            setTreePath([])
                            setStep('upload')
                          } else {
                            setTreePath([...treePath, node.segment])
                          }
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-gray-100 transition-colors group"
                      >
                        {hasChildren
                          ? <FolderClosed className="w-4 h-4 text-amber-500 flex-shrink-0" />
                          : <FolderOpen className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        }
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{node.label}</p>
                          {isLeaf && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate">{node.chemin}</p>
                          )}
                        </div>
                        {hasChildren && (
                          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 flex-shrink-0" />
                        )}
                      </button>
                    )
                  })
                })()}
              </div>

              {/* Recherche en bas, secondaire */}
              <div className="pt-2 border-t border-gray-100">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    ref={dossierInputRef}
                    value={dossierQuery}
                    onChange={e => setDossierQuery(e.target.value)}
                    placeholder="Ou rechercher par nom..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                  />
                </div>
                {dossierQuery.length >= 2 && (
                  <div className="mt-2 space-y-0.5 max-h-40 overflow-y-auto">
                    {dossierResults.length === 0 ? (
                      <p className="py-3 text-center text-xs text-gray-400">Aucun resultat</p>
                    ) : (
                      dossierResults.map(d => (
                        <button
                          key={d.chemin}
                          onClick={() => { setSelectedDossier(d); setDossierQuery(''); setStep('upload') }}
                          className="w-full flex items-start gap-3 px-3 py-2 rounded-lg text-left hover:bg-gray-100 transition-colors"
                        >
                          <FolderOpen className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900">{d.label}</p>
                            <p className="text-xs text-gray-400 truncate">{d.chemin}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

          /* ── Step: Upload ── */
          ) : (
            <div className="divide-y divide-gray-100">

              {/* Bandeau dossier */}
              <div className="px-6 py-3 bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <FolderOpen className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{selectedDossier?.label}</p>
                    <p className="text-xs text-gray-400 truncate">{selectedDossier?.chemin}</p>
                  </div>
                </div>
                <button
                  onClick={() => setStep('dossier')}
                  className="text-xs text-gray-500 hover:text-gray-700 ml-3 flex-shrink-0 underline"
                >
                  Changer
                </button>
              </div>

              {/* Fichier */}
              <div className="px-6 py-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Fichier
                </p>
                {file ? (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="flex-shrink-0">{fileIcon(file.name)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatSize(file.size)}</p>
                      {uploading && (
                        <div className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gray-900 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                    {!uploading && (
                      <button onClick={() => setFile(null)} className="p-1 text-gray-400 hover:text-gray-700 flex-shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div
                    onDragOver={e => { e.preventDefault(); setDrag(true) }}
                    onDragLeave={() => setDrag(false)}
                    onDrop={onDrop}
                    onClick={() => fileRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                      drag
                        ? 'border-gray-500 bg-gray-50'
                        : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">
                      Glisser un fichier ici ou{' '}
                      <span className="text-gray-900 font-medium">cliquer pour selectionner</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      PDF, Word, Excel, Images, DWG, ZIP · max 100 Mo
                    </p>
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept={ACCEPT}
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                />
              </div>

              {/* Informer */}
              <div className="px-6 py-5 space-y-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Informer
                </p>

                {/* Group buttons */}
                <div className="flex flex-wrap gap-2">
                  {GROUPES_INFORM.map(groupe => {
                    const active = activeGroupes.includes(groupe.key)
                    return (
                      <button
                        key={groupe.key}
                        onClick={() => toggleGroupe(groupe)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                          active
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        <Users className="w-3 h-3" />
                        {groupe.label}
                      </button>
                    )
                  })}
                </div>

                {/* Selected chips */}
                {selectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedUsers.map(u => (
                      <span
                        key={u.id}
                        className="inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 bg-gray-100 rounded-full text-xs font-medium text-gray-700"
                      >
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${ROLE_COLORS[u.role] ?? 'bg-gray-500'}`}>
                          {initiales(u.prenom, u.nom)}
                        </span>
                        {u.prenom} {u.nom}
                        <button
                          onClick={() => setSelectedUsers(p => p.filter(x => x.id !== u.id))}
                          className="text-gray-400 hover:text-gray-700 ml-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Individual search */}
                <input
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  placeholder="Rechercher par nom..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                />

                {filteredUsers.length > 0 && userSearch && (
                  <div className="space-y-0.5 max-h-36 overflow-y-auto rounded-lg border border-gray-100">
                    {filteredUsers.map(u => {
                      const isSelected = !!selectedUsers.find(x => x.id === u.id)
                      return (
                        <button
                          key={u.id}
                          onClick={() => toggleUser(u)}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                            isSelected ? 'bg-gray-900' : 'hover:bg-gray-50'
                          }`}
                        >
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            isSelected ? 'bg-white text-gray-900' : `${ROLE_COLORS[u.role] ?? 'bg-gray-500'} text-white`
                          }`}>
                            {initiales(u.prenom, u.nom)}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className={`text-sm font-medium block truncate ${isSelected ? 'text-white' : 'text-gray-800'}`}>
                              {u.prenom} {u.nom}
                            </span>
                            <span className={`text-xs ${isSelected ? 'text-gray-300' : 'text-gray-400'}`}>
                              {u.role}
                            </span>
                          </span>
                          {isSelected && <Check className="w-4 h-4 text-white flex-shrink-0" />}
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Message */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Message
                    <span className="ml-2 font-normal text-gray-400">optionnel</span>
                  </label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value.slice(0, 300))}
                    placeholder="Ajouter un message pour les destinataires..."
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none bg-white"
                  />
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-gray-400">Visible dans la notification recue</p>
                    <p className="text-xs text-gray-400">{message.length}/300</p>
                  </div>
                </div>

                {error && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!done && step === 'upload' && (
          <div className="px-6 py-4 border-t border-gray-100 bg-white flex-shrink-0">
            <button
              onClick={handleSubmit}
              disabled={uploading || !file}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Depot en cours...
                </>
              ) : selectedUsers.length > 0 ? (
                `Deposer et notifier ${selectedUsers.length} personne${selectedUsers.length > 1 ? 's' : ''}`
              ) : (
                'Deposer et notifier'
              )}
            </button>
          </div>
        )}

        </div>{/* end main column */}

        {/* Sidebar arborescence */}
        {step === 'dossier' && profil && (
          <TreeSidebar
            userRole={profil.role}
            onSelect={(d) => {
              setSelectedDossier(d)
              setStep('upload')
            }}
          />
        )}

      </div>
    </div>
  )
}

/* ── Tree Sidebar ── */

function TreeSidebar({ userRole, onSelect }: {
  userRole: string
  onSelect: (d: Dossier) => void
}) {
  const tree = getDossierTree(userRole)

  return (
    <div className="w-[340px] flex-shrink-0 border-l border-gray-200 bg-white flex flex-col max-h-[92vh]">
      <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Arborescence GED</p>
        <p className="text-[10px] text-gray-400 mt-0.5">Cliquez sur un dossier pour le selectionner</p>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {tree.map(node => (
          <TreeBranch key={node.segment} node={node} depth={0} onSelect={onSelect} />
        ))}
      </div>
    </div>
  )
}

function TreeBranch({ node, depth, onSelect }: {
  node: TreeNode; depth: number; onSelect: (d: Dossier) => void
}) {
  const [open, setOpen] = useState(depth === 0)
  const hasChildren = node.children.length > 0
  const isLeaf = !hasChildren

  function handleClick() {
    if (isLeaf) {
      const d: Dossier = node.dossier ?? { chemin: node.chemin, label: node.label, mots_cles: [], roles: node.roles }
      onSelect(d)
    } else {
      setOpen(!open)
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        className={`w-full flex items-center gap-1.5 py-1.5 px-2 rounded-md text-left transition-colors hover:bg-gray-100 group`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <ChevronRight className={`w-3 h-3 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}
        {isLeaf
          ? <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          : open
            ? <FolderOpen className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            : <FolderClosed className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
        }
        <span className={`text-xs truncate ${isLeaf ? 'text-gray-600 group-hover:text-gray-900' : 'font-medium text-gray-800'}`}>
          {node.label}
        </span>
      </button>
      {open && hasChildren && (
        <div>
          {node.children.map(child => (
            <TreeBranch key={child.segment} node={child} depth={depth + 1} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  )
}
