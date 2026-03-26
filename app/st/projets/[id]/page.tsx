'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { useUser } from '@/hooks/useUser'
import { useSTProjects, type STReserve, type STDocument } from '@/hooks/useSTProjects'
import { useSTUpload } from '@/hooks/useSTUpload'
import {
  ArrowLeft, CheckCircle, Clock, AlertTriangle, Upload,
  FileText, Download, Eye, X, Bell, Shield, Hammer,
  ChevronRight, RefreshCw, Building2, Camera
} from 'lucide-react'
import Link from 'next/link'

/* ── Types ──────────────────────────────────────────────── */
type Tab = 'lot' | 'depot' | 'recus' | 'reserves' | 'notifs'

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'lot',      label: 'Mon lot',             icon: <Building2 className="w-4 h-4" />  },
  { key: 'depot',    label: 'Documents à déposer', icon: <Upload className="w-4 h-4" />     },
  { key: 'recus',    label: 'Documents reçus',     icon: <Download className="w-4 h-4" />   },
  { key: 'reserves', label: 'Réserves',            icon: <Hammer className="w-4 h-4" />     },
  { key: 'notifs',   label: 'Notifications',       icon: <Bell className="w-4 h-4" />       },
]

const PIECES_ADMIN = [
  { key: 'kbis',      label: 'Kbis',                   note: 'Moins de 3 mois',  required: true  },
  { key: 'urssaf',    label: 'Attestation URSSAF',     note: 'Moins de 6 mois',  required: true  },
  { key: 'rc_pro',    label: 'Assurance RC Pro',       note: 'Date de validité', required: true  },
  { key: 'decennale', label: 'Assurance Décennale',    note: 'Date de validité', required: true  },
  { key: 'rib',       label: 'RIB',                    note: 'Dernier en date',  required: true  },
]

/* ── Helpers ────────────────────────────────────────────── */
function daysUntil(date: string) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
}

function statutDoc(doc: STDocument | undefined, type: string): 'valide' | 'expire' | 'manquant' | 'en_attente' {
  if (!doc) return 'manquant'
  if (doc.statut === 'expire') return 'expire'
  if (doc.date_expiration && daysUntil(doc.date_expiration) < 0) return 'expire'
  if (doc.statut === 'valide') return 'valide'
  return 'en_attente'
}

/* ═══════════════════════════════════════════════════════ */
export default function STProjetPage() {
  const params       = useParams()
  const searchParams = useSearchParams()
  const projetId     = params.id as string
  const defaultLotId = searchParams.get('lot') ?? ''

  const { user } = useUser()
  const { lots, alertes, loading: lotsLoading, fetchLotDetail, markAlerteRead, markAllRead } = useSTProjects(user?.id ?? null)
  const { uploadPieceAdmin, uploadDevis, uploadPhotoReserve } = useSTUpload(user?.id ?? null)

  const [tab, setTab]           = useState<Tab>('lot')
  const [lotId, setLotId]       = useState(defaultLotId)
  const [lotDetail, setLotDetail]   = useState<any>(null)
  const [reserves, setReserves] = useState<STReserve[]>([])
  const [documents, setDocuments]   = useState<STDocument[]>([])
  const [crs, setCrs]           = useState<any[]>([])
  const [loading, setLoading]   = useState(true)

  /* Upload states */
  const [uploading, setUploading] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [expDate, setExpDate]   = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeUploadType, setActiveUploadType] = useState('')

  /* Reserve upload */
  const [photoComment, setPhotoComment] = useState<Record<string, string>>({})
  const reserveFileRef = useRef<HTMLInputElement>(null)
  const [activeReserveId, setActiveReserveId] = useState('')

  const myLots = lots.filter(l => l.projet_id === projetId)
  const currentLot = myLots.find(l => l.id === lotId) ?? myLots[0]
  const projAlertes = alertes.filter(a => a.projet_id === projetId)

  useEffect(() => {
    if (!lotId && myLots.length > 0) setLotId(myLots[0].id)
  }, [myLots])

  useEffect(() => {
    if (!lotId || !projetId) return
    setLoading(true)
    fetchLotDetail(lotId, projetId).then(({ lot, reserves, documents, crs }) => {
      setLotDetail(lot)
      setReserves(reserves)
      setDocuments(documents)
      setCrs(crs)
      setLoading(false)
    })
  }, [lotId, projetId])

  /* ── Admin doc upload ────────────────────────────────── */
  function triggerUpload(type: string) {
    setActiveUploadType(type)
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !currentLot) return
    setUploading(activeUploadType)
    setUploadError('')
    const { error } = await uploadPieceAdmin(file, activeUploadType, projetId, currentLot.id, expDate[activeUploadType])
    setUploading(null)
    if (error) { setUploadError(error); return }
    // Refresh
    const { documents: d } = await fetchLotDetail(currentLot.id, projetId)
    setDocuments(d)
    e.target.value = ''
  }

  /* ── Devis upload ────────────────────────────────────── */
  const devisFileRef = useRef<HTMLInputElement>(null)
  async function handleDevisUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !currentLot) return
    setUploading('devis')
    const { error } = await uploadDevis(file, projetId, currentLot.id)
    setUploading(null)
    if (!error) {
      const { documents: d } = await fetchLotDetail(currentLot.id, projetId)
      setDocuments(d)
    }
    e.target.value = ''
  }

  /* ── Reserve photo upload ────────────────────────────── */
  async function handleReservePhoto(e: React.ChangeEvent<HTMLInputElement>, reserveId: string) {
    const file = e.target.files?.[0]
    if (!file || !currentLot) return
    setUploading(reserveId)
    await uploadPhotoReserve(file, reserveId, projetId, currentLot.id, photoComment[reserveId])
    setUploading(null)
    const { reserves: r } = await fetchLotDetail(currentLot.id, projetId)
    setReserves(r)
    e.target.value = ''
  }

  /* ── Latest doc by type ──────────────────────────────── */
  function latestDoc(type: string): STDocument | undefined {
    return documents.filter(d => d.type === type).sort((a, b) => b.version - a.version)[0]
  }

  const devisVersions = documents.filter(d => d.type === 'devis').sort((a, b) => b.version - a.version)
  const lastDevis     = devisVersions[0]

  if (lotsLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!currentLot) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <p className="text-sm text-gray-500">Projet introuvable ou non assigné.</p>
        <Link href="/st/dashboard" className="mt-3 text-sm text-blue-600 hover:underline">← Retour au tableau de bord</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="h-16 bg-white border-b border-gray-200 flex items-center gap-4 px-6">
        <Link href="/st/dashboard" className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-gray-900 truncate">{currentLot.projet?.nom}</h1>
          <p className="text-xs text-gray-400">{currentLot.projet?.reference} · Lot {currentLot.numero} — {currentLot.corps_etat}</p>
        </div>
        {/* Lot selector if multiple lots */}
        {myLots.length > 1 && (
          <select value={lotId} onChange={e => setLotId(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none">
            {myLots.map(l => <option key={l.id} value={l.id}>Lot {l.numero} — {l.corps_etat}</option>)}
          </select>
        )}
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(t => {
            const badge = t.key === 'notifs' ? projAlertes.filter(a => !a.lu).length : 0
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  tab === t.key ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                {t.icon}
                {t.label}
                {badge > 0 && (
                  <span className="ml-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="p-6">
        {/* ── TAB: MON LOT ─────────────────────────────────── */}
        {tab === 'lot' && (
          <div className="grid grid-cols-3 gap-4">
            {/* Lot info */}
            <div className="col-span-2 space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Lot {currentLot.numero} — {currentLot.corps_etat}</h2>
                    <p className="text-sm text-gray-500 mt-0.5">{currentLot.projet?.nom}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    currentLot.statut === 'en_cours' ? 'bg-green-100 text-green-700' :
                    currentLot.statut === 'retenu'   ? 'bg-amber-100 text-amber-700' :
                    currentLot.statut === 'termine'  ? 'bg-gray-100 text-gray-600'   :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {currentLot.statut?.replace('_', ' ')}
                  </span>
                </div>

                {currentLot.notice_technique && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notice technique</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{currentLot.notice_technique}</p>
                  </div>
                )}

                {currentLot.remarque && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                    <p className="text-xs font-semibold text-amber-700 mb-1">Note du CO</p>
                    <p className="text-sm text-amber-800">{currentLot.remarque}</p>
                  </div>
                )}
              </div>

              {/* Project info */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Informations chantier</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {currentLot.projet?.adresse && (
                    <div className="col-span-2 p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-0.5">Adresse</p>
                      <p className="text-gray-800">{currentLot.projet.adresse}</p>
                    </div>
                  )}
                  {lotDetail?.projets?.date_debut && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-0.5">Début chantier</p>
                      <p className="text-gray-800">{new Date(lotDetail.projets.date_debut).toLocaleDateString('fr-FR')}</p>
                    </div>
                  )}
                  {lotDetail?.projets?.date_livraison && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-0.5">Livraison prévue</p>
                      <p className="text-gray-800">{new Date(lotDetail.projets.date_livraison).toLocaleDateString('fr-FR')}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Contact CO */}
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Contact CO</h3>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-gray-600">CO</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Chargé d'Opérations</p>
                    <p className="text-xs text-gray-400">Responsable du projet</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400">Contactez votre CO via la messagerie interne.</p>
              </div>

              {/* Quick actions */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Actions rapides</h3>
                <div className="space-y-2">
                  {[
                    { label: 'Déposer un document', tab: 'depot' as Tab, icon: <Upload className="w-4 h-4" /> },
                    { label: 'Voir les réserves',   tab: 'reserves' as Tab, icon: <Hammer className="w-4 h-4" /> },
                    { label: 'Plans reçus',         tab: 'recus' as Tab, icon: <FileText className="w-4 h-4" /> },
                  ].map(a => (
                    <button key={a.tab} onClick={() => setTab(a.tab)}
                      className="w-full flex items-center gap-2 p-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg text-left">
                      <span className="text-gray-400">{a.icon}</span>
                      {a.label}
                      <ChevronRight className="w-3 h-3 text-gray-300 ml-auto" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: DOCUMENTS À DÉPOSER ─────────────────────── */}
        {tab === 'depot' && (
          <div className="space-y-6 max-w-3xl">
            {uploadError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {uploadError}
                <button onClick={() => setUploadError('')} className="ml-auto"><X className="w-4 h-4" /></button>
              </div>
            )}

            {/* Hidden inputs */}
            <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleFileChange} />
            <input ref={devisFileRef} type="file" accept=".pdf,.xlsx,.xls" className="hidden" onChange={handleDevisUpload} />

            {/* Section 1: Pièces administratives */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900">Pièces administratives</h3>
              </div>
              <div className="space-y-3">
                {PIECES_ADMIN.map(p => {
                  const doc = latestDoc(p.key)
                  const st  = statutDoc(doc, p.key)
                  return (
                    <div key={p.key} className={`flex items-center gap-4 p-3 rounded-xl border-2 ${
                      st === 'valide'    ? 'border-green-200 bg-green-50'  :
                      st === 'expire'   ? 'border-red-200 bg-red-50'      :
                      st === 'en_attente' ? 'border-amber-200 bg-amber-50' :
                      'border-dashed border-gray-200 bg-gray-50'
                    }`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        st === 'valide'    ? 'bg-green-100' :
                        st === 'expire'   ? 'bg-red-100'   :
                        st === 'en_attente' ? 'bg-amber-100' :
                        'bg-gray-100'
                      }`}>
                        {st === 'valide'    ? <CheckCircle className="w-4 h-4 text-green-600" /> :
                         st === 'expire'   ? <X className="w-4 h-4 text-red-600" />            :
                         st === 'en_attente' ? <Clock className="w-4 h-4 text-amber-600" />     :
                         <Upload className="w-4 h-4 text-gray-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{p.label}</p>
                        <p className="text-xs text-gray-500">{p.note}</p>
                        {doc && (
                          <p className="text-xs text-gray-400 truncate mt-0.5">{doc.nom_fichier}</p>
                        )}
                        {doc?.date_expiration && (
                          <p className={`text-xs font-medium mt-0.5 ${daysUntil(doc.date_expiration) < 30 ? 'text-red-600' : 'text-gray-500'}`}>
                            Expire le {new Date(doc.date_expiration).toLocaleDateString('fr-FR')}
                            {daysUntil(doc.date_expiration) >= 0 && ` (J-${daysUntil(doc.date_expiration)})`}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        {(st === 'valide' || st === 'en_attente') && doc && (
                          <a href={doc.url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100">
                            <Eye className="w-3 h-3" /> Voir
                          </a>
                        )}
                        <div className="flex flex-col gap-1">
                          <input type="date" value={expDate[p.key] ?? ''} onChange={e => setExpDate(prev => ({ ...prev, [p.key]: e.target.value }))}
                            className="border border-gray-200 rounded px-1.5 py-0.5 text-xs" placeholder="Expiration" />
                          <button onClick={() => triggerUpload(p.key)} disabled={uploading === p.key}
                            className={`flex items-center gap-1 px-2 py-1 text-xs rounded-lg font-medium ${
                              st === 'expire' || st === 'manquant'
                                ? 'bg-gray-900 text-white hover:bg-gray-700'
                                : 'text-gray-600 border border-gray-200 hover:bg-gray-100'
                            }`}>
                            {uploading === p.key ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                            {st === 'expire' ? 'Remplacer' : st === 'manquant' ? 'Déposer' : 'Mettre à jour'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Section 2: Devis */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900">Devis / Offre de prix</h3>
              </div>

              {lastDevis ? (
                <div className="space-y-3">
                  <div className={`p-3 rounded-xl border-2 ${
                    lastDevis.statut === 'revision_demandee' ? 'border-orange-200 bg-orange-50' :
                    lastDevis.statut === 'valide' ? 'border-green-200 bg-green-50' :
                    'border-blue-200 bg-blue-50'
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-gray-800">
                        {lastDevis.statut === 'revision_demandee' ? 'Révision demandée' :
                         lastDevis.statut === 'valide' ? 'Devis validé' :
                         'Devis reçu — en analyse par l\'économiste'}
                      </p>
                      <span className="text-xs text-gray-500">v{lastDevis.version}</span>
                    </div>
                    <p className="text-xs text-gray-500">{lastDevis.nom_fichier}</p>
                    {lastDevis.commentaire_co && (
                      <div className="mt-2 p-2 bg-white rounded-lg border border-orange-200">
                        <p className="text-xs text-orange-700 font-medium mb-0.5">Commentaire :</p>
                        <p className="text-xs text-orange-600">{lastDevis.commentaire_co}</p>
                      </div>
                    )}
                  </div>

                  {/* Versions history */}
                  {devisVersions.length > 1 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-2">Versions précédentes :</p>
                      <div className="space-y-1">
                        {devisVersions.slice(1).map(d => (
                          <div key={d.id} className="flex items-center gap-2 text-xs text-gray-500 p-2 bg-gray-50 rounded-lg">
                            <span>v{d.version}</span>
                            <span className="truncate flex-1">{d.nom_fichier}</span>
                            <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Voir</a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {lastDevis.statut !== 'valide' && (
                    <button onClick={() => devisFileRef.current?.click()} disabled={uploading === 'devis'}
                      className="w-full flex items-center justify-center gap-2 py-2 text-sm border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-gray-400 hover:text-gray-700">
                      {uploading === 'devis' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      Déposer une nouvelle version
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  <div onClick={() => devisFileRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors">
                    {uploading === 'devis' ? (
                      <RefreshCw className="w-8 h-8 text-gray-400 mx-auto mb-2 animate-spin" />
                    ) : (
                      <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    )}
                    <p className="text-sm font-medium text-gray-600">Déposer votre devis</p>
                    <p className="text-xs text-gray-400 mt-1">PDF ou Excel uniquement</p>
                  </div>
                </div>
              )}
            </div>

            {/* Section 3: Photos réserves */}
            {reserves.filter(r => r.statut === 'ouvert' || r.statut === 'en_cours').length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Camera className="w-5 h-5 text-gray-500" />
                  <h3 className="text-sm font-semibold text-gray-900">Photos de levée de réserves</h3>
                </div>
                <div className="space-y-3">
                  {reserves.filter(r => r.statut !== 'leve').map(r => (
                    <div key={r.id} className="p-3 border border-gray-200 rounded-xl">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{r.description}</p>
                          {r.localisation && <p className="text-xs text-gray-400">{r.localisation}</p>}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                          r.statut === 'ouvert'       ? 'bg-red-100 text-red-700' :
                          r.statut === 'en_cours'     ? 'bg-amber-100 text-amber-700' :
                          r.statut === 'photo_deposee'? 'bg-blue-100 text-blue-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {r.statut?.replace('_', ' ')}
                        </span>
                      </div>
                      {r.date_echeance && (
                        <p className={`text-xs mb-2 ${daysUntil(r.date_echeance) <= 7 ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                          A corriger avant le {new Date(r.date_echeance).toLocaleDateString('fr-FR')}
                        </p>
                      )}
                      {r.photo_signalement_url && (
                        <a href={r.photo_signalement_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:underline block mb-2">Voir photo signalement →</a>
                      )}
                      <div className="flex gap-2 mt-2">
                        <input placeholder="Commentaire (optionnel)" value={photoComment[r.id] ?? ''}
                          onChange={e => setPhotoComment(prev => ({ ...prev, [r.id]: e.target.value }))}
                          className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none" />
                        <label className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg cursor-pointer font-medium ${
                          uploading === r.id ? 'bg-gray-100 text-gray-400' : 'bg-gray-900 text-white hover:bg-gray-700'
                        }`}>
                          {uploading === r.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                          Photo
                          <input type="file" accept="image/*" className="hidden"
                            onChange={e => handleReservePhoto(e, r.id)} disabled={uploading === r.id} />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: DOCUMENTS REÇUS ─────────────────────────── */}
        {tab === 'recus' && (
          <div className="space-y-5 max-w-3xl">
            {/* Plans */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900">Plans à télécharger</h3>
              </div>
              {documents.filter(d => d.type === 'autre').length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Aucun plan disponible pour l'instant</p>
              ) : (
                <div className="space-y-2">
                  {documents.filter(d => d.type === 'autre').map(d => (
                    <div key={d.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{d.nom_fichier}</p>
                        <p className="text-xs text-gray-400">{new Date(d.created_at).toLocaleDateString('fr-FR')}</p>
                      </div>
                      <a href={d.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-700">
                        <Download className="w-3 h-3" /> Télécharger
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Comptes-rendus */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900">Comptes-rendus</h3>
              </div>
              {crs.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Aucun CR envoyé</p>
              ) : (
                <div className="space-y-2">
                  {crs.map((cr: any) => (
                    <div key={cr.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-gray-600">#{cr.numero}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">CR #{cr.numero} — {cr.type}</p>
                        <p className="text-xs text-gray-400">{new Date(cr.date_reunion).toLocaleDateString('fr-FR')}</p>
                      </div>
                      <span className="text-xs text-green-600 font-medium">Envoyé</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: RÉSERVES ────────────────────────────────── */}
        {tab === 'reserves' && (
          <div className="max-w-3xl">
            {reserves.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <CheckCircle className="w-10 h-10 text-green-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Aucune réserve ouverte.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reserves.map(r => (
                  <div key={r.id} className={`bg-white rounded-xl border-2 p-5 ${
                    r.statut === 'ouvert'        ? 'border-red-200' :
                    r.statut === 'en_cours'      ? 'border-amber-200' :
                    r.statut === 'photo_deposee' ? 'border-blue-200' :
                    'border-green-200'
                  }`}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{r.description}</p>
                        {r.localisation && <p className="text-xs text-gray-500 mt-0.5">{r.localisation}</p>}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${
                        r.statut === 'ouvert'        ? 'bg-red-100 text-red-700' :
                        r.statut === 'en_cours'      ? 'bg-amber-100 text-amber-700' :
                        r.statut === 'photo_deposee' ? 'bg-blue-100 text-blue-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {r.statut === 'ouvert' ? 'Ouverte' : r.statut === 'en_cours' ? 'En cours' :
                         r.statut === 'photo_deposee' ? 'Photo déposée' : 'Levée'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="p-2 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500">Signalée le</p>
                        <p className="text-sm text-gray-700">{new Date(r.date_signalement).toLocaleDateString('fr-FR')}</p>
                      </div>
                      {r.date_echeance && (
                        <div className={`p-2 rounded-lg ${daysUntil(r.date_echeance) <= 7 ? 'bg-red-50' : 'bg-gray-50'}`}>
                          <p className="text-xs text-gray-500">À corriger avant</p>
                          <p className={`text-sm font-medium ${daysUntil(r.date_echeance) <= 7 ? 'text-red-700' : 'text-gray-700'}`}>
                            {new Date(r.date_echeance).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3">
                      {r.photo_signalement_url && (
                        <a href={r.photo_signalement_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">
                          <Eye className="w-3 h-3" /> Photo signalement
                        </a>
                      )}
                      {r.photo_levee_url && (
                        <a href={r.photo_levee_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-blue-600">
                          <CheckCircle className="w-3 h-3" /> Photo correction
                        </a>
                      )}
                      {r.statut !== 'leve' && (
                        <button onClick={() => setTab('depot')}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-700">
                          <Camera className="w-3 h-3" /> Uploader correction
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: NOTIFICATIONS ───────────────────────────── */}
        {tab === 'notifs' && (
          <div className="max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">Historique des notifications</h3>
              {user && projAlertes.some(a => !a.lu) && (
                <button onClick={() => markAllRead(user.id)}
                  className="text-xs text-blue-600 hover:underline">
                  Tout marquer comme lu
                </button>
              )}
            </div>

            {projAlertes.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <Bell className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Aucune notification pour ce projet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {projAlertes.map(a => (
                  <div key={a.id} className={`flex items-start gap-3 p-4 rounded-xl border transition-colors ${
                    a.lu ? 'bg-white border-gray-100' : 'bg-blue-50 border-blue-200'
                  }`}>
                    <div className="mt-0.5 flex-shrink-0">
                      {a.type === 'plan_mis_a_jour'   ? <FileText className="w-4 h-4 text-blue-500" />    :
                       a.type === 'reserve_signalee'  ? <AlertTriangle className="w-4 h-4 text-red-500" /> :
                       a.type === 'devis_demande'     ? <Bell className="w-4 h-4 text-amber-500" />       :
                       a.type === 'reserve_levee'     ? <CheckCircle className="w-4 h-4 text-green-500" /> :
                       <Bell className="w-4 h-4 text-gray-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${a.lu ? 'text-gray-500' : 'text-gray-800 font-medium'}`}>{a.message}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(a.created_at).toLocaleDateString('fr-FR', {
                          weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                    {!a.lu && (
                      <button onClick={() => markAlerteRead(a.id)} className="p-1 text-gray-400 hover:text-gray-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
