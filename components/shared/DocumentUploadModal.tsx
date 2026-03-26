'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useDocuments } from '@/hooks/useDocuments'
import { useUser } from '@/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import {
  X, Upload, FileText, Users, Check, File,
  FileSpreadsheet, Image, Music, Video, Archive,
} from 'lucide-react'

/* ── Constants ─────────────────────────────────────────────── */

const TYPE_DOCS = [
  { value: 'cr',           label: 'Compte-rendu',               ged: '07_chantier'    },
  { value: 'plan_exe',     label: 'Plan EXE',                   ged: '07_chantier'    },
  { value: 'plan_apd',     label: 'Plan APD',                   ged: '04_conception'  },
  { value: 'plan_doe',     label: 'Plan DOE',                   ged: '09_gpa'         },
  { value: 'cctp',         label: 'CCTP',                       ged: '06_preparation' },
  { value: 'devis',        label: 'Devis',                      ged: '02_commercial'  },
  { value: 'contrat',      label: 'Contrat',                    ged: '03_contractuels' },
  { value: 'rapport_bc',   label: 'Rapport bureau de contrôle', ged: '07_chantier'    },
  { value: 'facture',      label: 'Facture',                    ged: '08_facturation' },
  { value: 'photo',        label: 'Photo terrain',              ged: '07_chantier'    },
  { value: 'audio_reunion',label: 'Audio réunion',              ged: '07_chantier'    },
  { value: 'kbis',         label: 'Kbis',                       ged: '00_client'      },
  { value: 'assurance',    label: 'Assurance',                  ged: '00_client'      },
  { value: 'urssaf',       label: 'Urssaf',                     ged: '00_client'      },
  { value: 'rib',          label: 'RIB',                        ged: '00_client'      },
  { value: 'autre',        label: 'Autre',                      ged: ''               },
]

const DOSSIERS_GED = [
  { value: '00_client',       label: '00 — Éléments client'  },
  { value: '01_etudes',       label: '01 — Études'           },
  { value: '02_commercial',   label: '02 — Commercial'       },
  { value: '03_contractuels', label: '03 — Contractuels'     },
  { value: '04_conception',   label: '04 — Conception'       },
  { value: '05_urbanisme',    label: '05 — Urbanisme'        },
  { value: '06_preparation',  label: '06 — Préparation'      },
  { value: '07_chantier',     label: '07 — Chantier'         },
  { value: '08_facturation',  label: '08 — Facturation'      },
  { value: '09_gpa',          label: '09 — GPA'              },
  { value: '10_sav',          label: '10 — SAV'              },
]

const POLES = [
  { key: 'co',           label: 'CO',          roles: ['co']              },
  { key: 'commercial',   label: 'Commercial',  roles: ['commercial']      },
  { key: 'economiste',   label: 'Économiste',  roles: ['economiste']      },
  { key: 'dessinatrice', label: 'Dessinatrice',roles: ['dessinatrice']    },
  { key: 'comptable',    label: 'Comptable',   roles: ['comptable']       },
  { key: 'direction',    label: 'Direction',   roles: ['gerant', 'admin'] },
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

export interface DocumentUploadModalProps {
  open: boolean
  onClose: () => void
  onSuccess: (documentId?: string) => void
  projetId: string
  nomProjet?: string
  lotId?: string
  typeDocDefault?: string
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
  if (['jpg','jpeg','png','gif','webp'].includes(ext))
    return <Image className="w-5 h-5 text-pink-500" />
  if (['mp3','wav','ogg'].includes(ext))
    return <Music className="w-5 h-5 text-purple-500" />
  if (['mp4','webm','mov'].includes(ext))
    return <Video className="w-5 h-5 text-blue-500" />
  if (['xls','xlsx','csv'].includes(ext))
    return <FileSpreadsheet className="w-5 h-5 text-green-600" />
  if (['zip','rar','7z'].includes(ext))
    return <Archive className="w-5 h-5 text-amber-500" />
  return <FileText className="w-5 h-5 text-gray-500" />
}

/* ═══════════════════════════════════════════════════════════ */

export function DocumentUploadModal({
  open, onClose, onSuccess, projetId, nomProjet = '', lotId,
  typeDocDefault, dossierGedDefault,
}: DocumentUploadModalProps) {
  const { user, profil } = useUser()
  const { uploadDocument } = useDocuments()
  const supabase = createClient()

  const [file, setFile]         = useState<File | null>(null)
  const [drag, setDrag]         = useState(false)
  const [typeDoc, setTypeDoc]   = useState(typeDocDefault ?? '')
  const [dossierGed, setDossierGed] = useState(dossierGedDefault ?? '')
  const [selectedUsers, setSelectedUsers] = useState<Utilisateur[]>([])
  const [selectedPoles, setSelectedPoles] = useState<string[]>([])
  const [message, setMessage]   = useState('')
  const [search, setSearch]     = useState('')
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([])
  const [usersLoaded, setUsersLoaded] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError]       = useState('')
  const [done, setDone]         = useState(false)
  const [uploadedDocId, setUploadedDocId] = useState<string | undefined>(undefined)
  const fileRef = useRef<HTMLInputElement>(null)

  /* Load utilisateurs on mount */
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
    if (open) loadUtilisateurs()
  }, [open, loadUtilisateurs])

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

  function onTypeChange(val: string) {
    setTypeDoc(val)
    if (!dossierGedDefault) {
      const suggestion = TYPE_DOCS.find(t => t.value === val)?.ged ?? ''
      if (suggestion) setDossierGed(suggestion)
    }
  }

  function toggleUser(u: Utilisateur) {
    setSelectedUsers(prev =>
      prev.find(x => x.id === u.id)
        ? prev.filter(x => x.id !== u.id)
        : [...prev, u]
    )
  }

  function togglePole(pole: typeof POLES[0]) {
    const isActive = selectedPoles.includes(pole.key)
    if (isActive) {
      setSelectedPoles(prev => prev.filter(k => k !== pole.key))
      setSelectedUsers(prev => prev.filter(u => !pole.roles.includes(u.role)))
    } else {
      setSelectedPoles(prev => [...prev, pole.key])
      const poleUsers = utilisateurs.filter(u => pole.roles.includes(u.role))
      setSelectedUsers(prev => {
        const ids = new Set(prev.map(x => x.id))
        return [...prev, ...poleUsers.filter(u => !ids.has(u.id))]
      })
    }
  }

  async function handleSubmit() {
    if (!user || !profil) return
    if (!file) { setError('Veuillez sélectionner un fichier'); return }
    if (!typeDoc) { setError('Veuillez choisir un type de document'); return }
    if (!dossierGed) { setError('Veuillez choisir un dossier'); return }

    setUploading(true)
    setError('')
    setProgress(0)

    const { error: err, documentId: docId } = await uploadDocument(
      {
        file,
        projetId,
        lotId,
        typeDoc,
        dossierGed,
        tagsUtilisateurs: selectedUsers.map(u => ({ id: u.id, role: u.role })),
        messageDepot: message,
        userId: user.id,
        userPrenom: profil.prenom,
        userNom: profil.nom,
        userRole: profil.role,
        nomProjet,
      },
      setProgress,
    )

    setUploading(false)
    if (err) { setError(err); setProgress(0); return }
    setUploadedDocId(docId)
    setDone(true)
  }

  function reset() {
    setFile(null)
    setTypeDoc(typeDocDefault ?? '')
    setDossierGed(dossierGedDefault ?? '')
    setSelectedUsers([])
    setSelectedPoles([])
    setMessage('')
    setSearch('')
    setError('')
    setProgress(0)
    setDone(false)
    setUploadedDocId(undefined)
  }

  function handleClose() {
    if (uploading) return
    reset()
    onClose()
  }

  const filteredUsers = utilisateurs.filter(u =>
    u.id !== user?.id &&
    `${u.prenom} ${u.nom} ${u.role}`.toLowerCase().includes(search.toLowerCase())
  )

  const isPoleActive = (pole: typeof POLES[0]) => {
    const members = utilisateurs.filter(u => pole.roles.includes(u.role))
    return members.length > 0 && members.every(m => selectedUsers.find(x => x.id === m.id))
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-[560px] max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900">Déposer un document</h2>
          <button onClick={handleClose} disabled={uploading}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress bar */}
        {uploading && (
          <div className="h-1 bg-gray-100 flex-shrink-0">
            <div
              className="h-full bg-green-500 transition-all duration-300 ease-out"
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
              <p className="text-base font-semibold text-gray-900 mb-1">Document déposé</p>
              <p className="text-sm text-gray-500 mb-6">
                {selectedUsers.length > 0
                  ? `${selectedUsers.length} personne(s) notifiée(s)`
                  : 'Enregistré dans la GED du projet'}
              </p>
              <div className="flex gap-3">
                <button onClick={reset}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
                  Déposer un autre
                </button>
                <button onClick={() => { const id = uploadedDocId; reset(); onSuccess(id); onClose() }}
                  className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700">
                  Fermer
                </button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">

              {/* ── Section A : Fichier ── */}
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
                            className="h-full bg-green-500 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                    {!uploading && (
                      <button onClick={() => setFile(null)}
                        className="p-1 text-gray-400 hover:text-gray-700 flex-shrink-0">
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
                      <span className="text-gray-900 font-medium">cliquer pour sélectionner</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      PDF, Word, Excel, Images, DWG, MP3, MP4, ZIP · max 100 Mo
                    </p>
                  </div>
                )}
                <input ref={fileRef} type="file" accept={ACCEPT} className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
              </div>

              {/* ── Section B : Classifier ── */}
              <div className="px-6 py-5 space-y-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Classifier
                </p>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Type de document <span className="text-red-500">*</span>
                  </label>
                  <select value={typeDoc} onChange={e => onTypeChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                    <option value="" disabled>Sélectionner un type</option>
                    {TYPE_DOCS.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Dossier du projet <span className="text-red-500">*</span>
                    {typeDoc && typeDoc !== 'autre' && (
                      <span className="ml-2 font-normal text-blue-500">· suggestion auto</span>
                    )}
                  </label>
                  <select value={dossierGed} onChange={e => setDossierGed(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                    <option value="" disabled>Sélectionner un dossier</option>
                    {DOSSIERS_GED.map(d => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ── Section C : Taguer & Message ── */}
              <div className="px-6 py-5 space-y-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Qui doit recevoir ce document ?
                </p>

                {/* Selected chips */}
                {selectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedUsers.map(u => (
                      <span key={u.id}
                        className="inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 bg-gray-100 rounded-full text-xs font-medium text-gray-700">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${ROLE_COLORS[u.role] ?? 'bg-gray-500'}`}>
                          {initiales(u.prenom, u.nom)}
                        </span>
                        {u.prenom} {u.nom}
                        <button onClick={() => setSelectedUsers(p => p.filter(x => x.id !== u.id))}
                          className="text-gray-400 hover:text-gray-700 ml-0.5">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Search */}
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher par nom ou rôle..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                />

                {/* Poles */}
                <div className="flex flex-wrap gap-2">
                  {POLES.map(pole => {
                    const active = isPoleActive(pole)
                    return (
                      <button key={pole.key} onClick={() => togglePole(pole)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                          active
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                        }`}>
                        <Users className="w-3 h-3" />
                        {pole.label}
                      </button>
                    )
                  })}
                </div>

                {/* Users list */}
                {filteredUsers.length > 0 && (
                  <div className="space-y-0.5 max-h-36 overflow-y-auto rounded-lg border border-gray-100">
                    {filteredUsers.map(u => {
                      const isSelected = !!selectedUsers.find(x => x.id === u.id)
                      return (
                        <button key={u.id} onClick={() => toggleUser(u)}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                            isSelected ? 'bg-gray-900' : 'hover:bg-gray-50'
                          }`}>
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
                    placeholder="Ajoutez un message pour les destinataires..."
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                  />
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-gray-400">
                      Ce message sera visible dans la notification reçue
                    </p>
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
        {!done && (
          <div className="px-6 py-4 border-t border-gray-100 bg-white flex-shrink-0">
            <button
              onClick={handleSubmit}
              disabled={uploading || !file}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Dépôt en cours…
                </>
              ) : selectedUsers.length > 0 ? (
                `Déposer et notifier ${selectedUsers.length} personne${selectedUsers.length > 1 ? 's' : ''}`
              ) : (
                'Déposer sans notifier'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
