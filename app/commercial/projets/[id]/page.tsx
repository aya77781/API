'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, MapPin, Building2, Ruler, Calendar, Euro,
  User, Users, Phone, Mail, Layers, AlertTriangle, Info, Pencil,
  ChevronRight, Check, X, Upload, Camera, MessageSquare,
  Image as ImageIcon, FileText, Paperclip, Download, Trash2,
  CalendarDays, Send, Plus, ExternalLink, Lightbulb, Calculator, Loader2, ChevronDown,
} from 'lucide-react'
import { creerDemande } from '@/app/_actions/conception'
import { planTypeForVersion, chiffrageTypeForVersion, type Version } from '@/lib/conception/types'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { StatutBadge } from '@/components/ui/Badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Projet, Lot } from '@/types/database'

// ─── Types drawer ────────────────────────────────────────────────────────────

type DrawerType =
  | 'PHOTOS_COMMENTAIRE'
  | 'LISTE_DOCS'
  | 'UPLOAD_DOC'
  | 'UPLOAD_DOCS_NOMMES'
  | 'COMMENTAIRE_SEUL'
  | 'REUNION'
  | 'REUNION_CR'

interface ChecklistItemDef {
  key: string
  label: string
  type: DrawerType
  docLabel?: string
  placeholder?: string
  defaultList?: string[]
  explainable?: boolean
  explainPlaceholder?: string
}

// ─── Items par phase ─────────────────────────────────────────────────────────

// Labels affichés → valeurs DB lowercase (contrainte CHECK sur app.projets.statut)
const PHASES_COMMERCIAL = ['Analyse', 'Conception', 'Chiffrage', 'Contrat', 'Passation', 'Lancement'] as const
const PHASE_TO_STATUT: Record<string, string> = {
  'Analyse': 'analyse', 'Conception': 'analyse', 'Chiffrage': 'analyse', 'Contrat': 'analyse',
  'Passation': 'passation', 'Lancement': 'lancement',
}

const CHECKLIST_PAR_PHASE: Record<string, ChecklistItemDef[]> = {
  Analyse: [
    { key: 'visite_site', label: 'Visite du site effectuee', type: 'PHOTOS_COMMENTAIRE' },
    {
      key: 'besoins_client', label: 'Besoins client identifies', type: 'LISTE_DOCS',
      defaultList: [
        'Type de projet defini (neuf/rehab/extension)',
        'Surface confirmee',
        'Programme fonctionnel recueilli',
        'Contraintes planning notees',
        'Budget enveloppe discute',
      ],
    },
    {
      key: 'faisabilite', label: 'Faisabilite technique validee', type: 'LISTE_DOCS',
      defaultList: [
        'Acces chantier verifie',
        'Contraintes structurelles identifiees',
        'Contraintes reglementaires verifiees (PC, ERP...)',
        'Avis economiste recueilli',
      ],
    },
    { key: 'dossier_consultation', label: 'Dossier de consultation prepare', type: 'UPLOAD_DOC', docLabel: 'Dossier de consultation' },
  ],
  Conception: [
    { key: 'brief_client', label: 'Brief client renseigne (besoin, contraintes, budget)', type: 'COMMENTAIRE_SEUL',
      placeholder: 'Synthese du brief saisi sur la page Conception (besoin exprime, contraintes, style, budget evoque, delais).' },
    { key: 'notices_commerciales', label: 'Notices commerciales redigees', type: 'COMMENTAIRE_SEUL',
      placeholder: 'Liste des promesses faites au client par lot (cuisine, suite parentale, menuiseries, etc.).' },
    { key: 'plan_v1', label: 'Plan V1 recu de la dessinatrice', type: 'UPLOAD_DOC', docLabel: 'Plan V1' },
    { key: 'estim_v1', label: 'Estimation V1 recue de l\'economiste', type: 'COMMENTAIRE_SEUL',
      placeholder: 'Montant et hypotheses de l\'estimation initiale.' },
    { key: 'envoi_v1', label: 'Proposition V1 envoyee au client', type: 'COMMENTAIRE_SEUL',
      placeholder: 'Date d\'envoi, canal, remarques.' },
    { key: 'retour_v1', label: 'Retour client V1 enregistre', type: 'COMMENTAIRE_SEUL',
      placeholder: 'Acceptee / a affiner / refusee + commentaire client.' },
    { key: 'apd_signe', label: 'APD signe (V3 acceptee)', type: 'UPLOAD_DOC', docLabel: 'APD signe' },
  ],
  Chiffrage: [
    { key: 'devis_final', label: "Devis final valide avec l'Economiste", type: 'UPLOAD_DOC', docLabel: 'Devis final PDF' },
    {
      key: 'validation_technique', label: 'Validation technique effectuee', type: 'LISTE_DOCS',
      defaultList: [
        'Faisabilite technique confirmee',
        'Prix coherents avec le marche',
        'Qualites proposees validees',
        'Delais realistes confirmes',
      ],
    },
    {
      key: 'decision_globale', label: 'Decision globale prise', type: 'COMMENTAIRE_SEUL',
      placeholder: 'Decrivez la decision prise, les conditions, les ajustements...',
    },
  ],
  Contrat: [
    { key: 'devis_signe', label: 'Devis signé', type: 'UPLOAD_DOC', docLabel: 'Devis signé', explainable: true, explainPlaceholder: 'Précisions sur le devis (montant, conditions, réserves...)' },
    { key: 'plans_signes', label: 'Plans signés', type: 'UPLOAD_DOCS_NOMMES', explainable: true, explainPlaceholder: 'Précisions sur les plans signés (versions, indices, remarques...)' },
    { key: 'ppe_planning', label: 'PPE — Planning prévisionnel', type: 'UPLOAD_DOC', docLabel: 'Planning prévisionnel (PPE)', explainable: true, explainPlaceholder: 'Précisions sur le planning (jalons, contraintes, hypothèses...)' },
  ],
  Passation: [
    { key: 'reunion_passation', label: 'Reunion de passation planifiee avec le CO', type: 'REUNION' },
    {
      key: 'infos_hors_contrat', label: 'Infos hors-contrat transmises', type: 'COMMENTAIRE_SEUL',
      placeholder: 'Notes confidentielles sur le client, historique relationnel, points de vigilance, informations contextuelles importantes pour le CO...',
    },
    { key: 'visite_terrain_co', label: 'Visite terrain commune avec le CO effectuee', type: 'PHOTOS_COMMENTAIRE' },
  ],
  Lancement: [
    { key: 'reunion_co', label: 'Reunion de lancement CO effectuee', type: 'REUNION_CR' },
    { key: 'notices_transformees', label: 'Notices transformees en notices techniques', type: 'UPLOAD_DOC', docLabel: 'Notices techniques validees' },
  ],
}

// ─── Types DB ────────────────────────────────────────────────────────────────

interface DocEntry { nom: string; url: string }
interface ListeEntry { label: string; checked: boolean }

interface ChecklistPreuve {
  id: string
  projet_id: string
  checklist_item: string
  phase: string
  completed: boolean
  completed_at: string | null
  completed_by: string | null
  commentaire: string
  photos_urls: string[]
  docs_urls: DocEntry[]
  liste_items: ListeEntry[]
  date_evenement: string | null
  participants: string[]
  cr_url: string | null
}

// ─── Propositions ────────────────────────────────────────────────────────────

interface Proposition {
  id: string
  projet_id: string
  numero: number
  type: string
  montant_ht: number | null
  date_envoi: string | null
  date_retour: string | null
  statut: string
  motif_refus: string | null
  commentaire: string | null
  document_url: string | null
  created_at: string
}

const PROP_TYPES = [
  { value: 'proposition_1', label: 'Proposition 1' },
  { value: 'proposition_2', label: 'Proposition 2' },
  { value: 'devis_final', label: 'Devis final' },
  { value: 'avenant', label: 'Avenant' },
]

const PROP_STATUTS = [
  { value: 'en_preparation', label: 'En preparation' },
  { value: 'envoyee', label: 'Envoyee' },
  { value: 'acceptee', label: 'Acceptee' },
  { value: 'refusee', label: 'Refusee' },
  { value: 'en_negociation', label: 'En negociation' },
]

const PROP_STATUT_STYLE: Record<string, string> = {
  en_preparation: 'bg-gray-100 text-gray-600',
  envoyee: 'bg-[#E6F1FB] text-[#185FA5]',
  acceptee: 'bg-[#EAF3DE] text-[#3B6D11]',
  refusee: 'bg-[#FCEBEB] text-[#A32D2D]',
  en_negociation: 'bg-[#FAEEDA] text-[#854F0B]',
}

const PROP_TYPE_LABEL: Record<string, string> = {
  proposition_1: 'Proposition 1',
  proposition_2: 'Proposition 2',
  devis_final: 'Devis final',
  avenant: 'Avenant',
}

// ─── Project detail ──────────────────────────────────────────────────────────

interface ProjetDetail extends Projet {
  co: { prenom: string; nom: string } | null
  economiste: { prenom: string; nom: string } | null
  lots: Lot[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUT_LOT_COLOR: Record<string, string> = {
  en_attente: 'bg-gray-100 text-gray-600', consultation: 'bg-blue-50 text-blue-700',
  negociation: 'bg-amber-50 text-amber-700', retenu: 'bg-emerald-50 text-emerald-700',
  en_cours: 'bg-emerald-100 text-emerald-800', termine: 'bg-gray-200 text-gray-500',
}
const STATUT_LOT_LABEL: Record<string, string> = {
  en_attente: 'En attente', consultation: 'Consultation', negociation: 'Negociation',
  retenu: 'Retenu', en_cours: 'En cours', termine: 'Termine',
}

const inputClass = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder-gray-300'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return <div><p className="text-xs text-gray-400 mb-0.5">{label}</p><p className="text-sm text-gray-900">{value}</p></div>
}

function hasPreuveData(p: ChecklistPreuve | undefined): boolean {
  if (!p) return false
  return !!(p.commentaire || p.photos_urls?.length || p.docs_urls?.length || p.cr_url || p.date_evenement)
}

// ─── Sub-sections du drawer ──────────────────────────────────────────────────

function PhotosSection({ photos, projetId, itemKey, preuveId, onUpdate }: {
  photos: string[]; projetId: string; itemKey: string; preuveId: string
  onUpdate: (urls: string[]) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleUpload(files: FileList) {
    setUploading(true)
    const supabase = createClient()
    const newUrls: string[] = []
    for (const file of Array.from(files)) {
      const path = `${projetId}/${itemKey}/${Date.now()}_${file.name}`
      const { error } = await supabase.storage.from('checklist-photos').upload(path, file, { upsert: true })
      if (!error) {
        const { data } = supabase.storage.from('checklist-photos').getPublicUrl(path)
        newUrls.push(data.publicUrl)
      }
    }
    const updated = [...photos, ...newUrls]
    await supabase.schema('app').from('checklist_preuves').update({ photos_urls: updated }).eq('id', preuveId)
    onUpdate(updated)
    setUploading(false)
  }

  async function handleRemove(url: string) {
    const supabase = createClient()
    const match = url.match(/checklist-photos\/(.+)$/)
    if (match) await supabase.storage.from('checklist-photos').remove([match[1]])
    const updated = photos.filter(p => p !== url)
    await supabase.schema('app').from('checklist_preuves').update({ photos_urls: updated }).eq('id', preuveId)
    onUpdate(updated)
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
        <Camera className="w-3.5 h-3.5" /> Photos ({photos.length})
      </p>
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((url, i) => (
            <div key={i} className="relative group">
              <button onClick={() => setLightbox(url)} className="block"><img src={url} alt="" className="w-20 h-20 rounded-lg object-cover border border-gray-200" /></button>
              <button onClick={() => handleRemove(url)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
            </div>
          ))}
        </div>
      )}
      <input ref={fileRef} type="file" multiple accept="image/*" className="hidden" onChange={e => { if (e.target.files?.length) { handleUpload(e.target.files); e.target.value = '' } }} />
      <button onClick={() => fileRef.current?.click()} disabled={uploading}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 border border-dashed border-gray-300 rounded-lg px-4 py-2.5 w-full justify-center hover:border-gray-400 hover:bg-gray-50 disabled:opacity-50">
        {uploading ? <><span className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" /> Upload...</> : <><Upload className="w-4 h-4" /> Ajouter des photos</>}
      </button>
      {lightbox && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white/80 hover:text-white" onClick={() => setLightbox(null)}><X className="w-6 h-6" /></button>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-lg" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}

function CommentaireSection({ value, preuveId, placeholder, onUpdate }: {
  value: string; preuveId: string; placeholder?: string; onUpdate: (v: string) => void
}) {
  const [text, setText] = useState(value)
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleChange(v: string) {
    setText(v)
    if (debRef.current) clearTimeout(debRef.current)
    debRef.current = setTimeout(async () => {
      const supabase = createClient()
      await supabase.schema('app').from('checklist_preuves').update({ commentaire: v }).eq('id', preuveId)
      onUpdate(v)
    }, 1000)
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
        <MessageSquare className="w-3.5 h-3.5" /> Commentaire
      </p>
      <textarea value={text} onChange={e => handleChange(e.target.value)}
        placeholder={placeholder || 'Ajouter un commentaire...'} rows={4}
        className={`${inputClass} resize-none min-h-[80px]`} />
      <p className="text-[10px] text-gray-300">Enregistrement automatique</p>
    </div>
  )
}

function ListeSection({ items, preuveId, onUpdate }: {
  items: ListeEntry[]; preuveId: string; onUpdate: (v: ListeEntry[]) => void
}) {
  const [newLabel, setNewLabel] = useState('')
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [editLabel, setEditLabel] = useState('')

  async function save(updated: ListeEntry[]) {
    const supabase = createClient()
    await supabase.schema('app').from('checklist_preuves').update({ liste_items: updated }).eq('id', preuveId)
    onUpdate(updated)
  }

  function toggle(idx: number) {
    save(items.map((it, i) => i === idx ? { ...it, checked: !it.checked } : it))
  }

  function addItem() {
    const label = newLabel.trim()
    if (!label) return
    save([...items, { label, checked: false }])
    setNewLabel('')
  }

  function removeItem(idx: number) {
    save(items.filter((_, i) => i !== idx))
  }

  function startEdit(idx: number) {
    setEditIdx(idx)
    setEditLabel(items[idx].label)
  }

  function confirmEdit() {
    if (editIdx === null) return
    const label = editLabel.trim()
    if (!label) { setEditIdx(null); return }
    save(items.map((it, i) => i === editIdx ? { ...it, label } : it))
    setEditIdx(null)
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Points a verifier</p>
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2 py-1 group">
          <button onClick={() => toggle(i)}
            className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${it.checked ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 group-hover:border-gray-400'}`}>
            {it.checked && <Check className="w-2.5 h-2.5 text-white" />}
          </button>
          {editIdx === i ? (
            <input type="text" value={editLabel} onChange={e => setEditLabel(e.target.value)}
              onBlur={confirmEdit} onKeyDown={e => { if (e.key === 'Enter') confirmEdit(); if (e.key === 'Escape') setEditIdx(null) }}
              autoFocus className={`${inputClass} flex-1 !py-1 text-sm`} />
          ) : (
            <button onClick={() => startEdit(i)}
              className={`text-sm text-left flex-1 ${it.checked ? 'text-gray-400 line-through' : 'text-gray-700'} hover:text-gray-900`}>
              {it.label}
            </button>
          )}
          <button onClick={() => removeItem(i)}
            className="p-0.5 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      ))}

      {/* Ajout */}
      <div className="flex items-center gap-2 pt-1">
        <input type="text" value={newLabel} onChange={e => setNewLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addItem() }}
          placeholder="Ajouter un point..." className={`${inputClass} flex-1 !py-1.5 text-sm`} />
        <button onClick={addItem} disabled={!newLabel.trim()}
          className="px-2.5 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-800 disabled:opacity-30 flex-shrink-0">
          Ajouter
        </button>
      </div>

      <p className="text-[10px] text-gray-400 pt-1">{items.filter(i => i.checked).length} / {items.length}</p>
    </div>
  )
}

function UploadDocSection({ docs, preuveId, projetId, itemKey, label, multiple, onUpdate }: {
  docs: DocEntry[]; preuveId: string; projetId: string; itemKey: string
  label: string; multiple?: boolean; onUpdate: (v: DocEntry[]) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [nomDoc, setNomDoc] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function doUpload(file: File, nom: string) {
    setUploading(true)
    const supabase = createClient()
    const path = `${projetId}/${itemKey}/${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('checklist-docs').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('checklist-docs').getPublicUrl(path)
      const entry: DocEntry = { nom, url: data.publicUrl }
      const updated = multiple ? [...docs, entry] : [entry]
      await supabase.schema('app').from('checklist_preuves').update({ docs_urls: updated }).eq('id', preuveId)
      onUpdate(updated)
    }
    setUploading(false)
    setPendingFile(null)
    setNomDoc('')
  }

  function handleFileSelect(files: FileList) {
    const file = files[0]
    if (!file) return
    if (multiple) {
      setPendingFile(file)
      setNomDoc(file.name.replace(/\.[^.]+$/, ''))
    } else {
      doUpload(file, label)
    }
  }

  async function handleRemove(url: string) {
    const supabase = createClient()
    const match = url.match(/checklist-docs\/(.+)$/)
    if (match) await supabase.storage.from('checklist-docs').remove([match[1]])
    const updated = docs.filter(d => d.url !== url)
    await supabase.schema('app').from('checklist_preuves').update({ docs_urls: updated }).eq('id', preuveId)
    onUpdate(updated)
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
        <FileText className="w-3.5 h-3.5" /> {multiple ? 'Documents' : label}
      </p>

      {docs.length > 0 && (
        <div className="space-y-1.5">
          {docs.map((d, i) => (
            <div key={i} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-700 flex-1 truncate">{d.nom}</span>
              <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600"><Download className="w-3.5 h-3.5" /></a>
              <button onClick={() => handleRemove(d.url)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      )}

      {/* Modal nom pour docs nommes */}
      {multiple && pendingFile && (
        <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
          <p className="text-xs text-gray-500">Nom du document :</p>
          <input type="text" value={nomDoc} onChange={e => setNomDoc(e.target.value)} className={inputClass} placeholder="Ex: Plans RDC signes" />
          <div className="flex gap-2">
            <button onClick={() => { if (nomDoc.trim()) doUpload(pendingFile, nomDoc.trim()) }}
              disabled={!nomDoc.trim() || uploading}
              className="flex-1 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg disabled:opacity-50">
              {uploading ? 'Upload...' : 'Enregistrer'}
            </button>
            <button onClick={() => { setPendingFile(null); setNomDoc('') }} className="px-3 py-1.5 bg-white border border-gray-200 text-xs text-gray-600 rounded-lg">Annuler</button>
          </div>
        </div>
      )}

      {(!multiple || !pendingFile) && (docs.length === 0 || multiple) && (
        <>
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" className="hidden"
            onChange={e => { if (e.target.files?.length) { handleFileSelect(e.target.files); e.target.value = '' } }} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 border border-dashed border-gray-300 rounded-lg px-4 py-2.5 w-full justify-center hover:border-gray-400 hover:bg-gray-50 disabled:opacity-50">
            {uploading ? <><span className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" /> Upload...</> : <><Upload className="w-4 h-4" /> {multiple ? 'Ajouter un document' : `Uploader : ${label}`}</>}
          </button>
        </>
      )}
    </div>
  )
}

function ReunionSection({ preuve, preuveId, projetNom, withCR, onUpdate }: {
  preuve: ChecklistPreuve; preuveId: string; projetNom: string; withCR?: boolean
  onUpdate: (patch: Partial<ChecklistPreuve>) => void
}) {
  const [date, setDate] = useState(preuve.date_evenement || '')
  const [participants, setParticipants] = useState<string[]>(preuve.participants || [])
  const [emailInput, setEmailInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function addParticipant() {
    const email = emailInput.trim()
    if (email && !participants.includes(email)) {
      setParticipants([...participants, email])
      setEmailInput('')
    }
  }

  function removeParticipant(email: string) {
    setParticipants(participants.filter(p => p !== email))
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    await supabase.schema('app').from('checklist_preuves')
      .update({ date_evenement: date || null, participants })
      .eq('id', preuveId)
    onUpdate({ date_evenement: date || null, participants })
    setSaving(false)
  }

  async function handleSendInvitations() {
    if (!date || participants.length === 0) return
    setSending(true)
    try {
      await fetch('https://apiprojet.app.n8n.cloud/webhook/invitation-reunion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projet_nom: projetNom,
          date_evenement: date,
          participants,
          type: preuve.checklist_item === 'reunion_passation' ? 'passation' : 'lancement',
        }),
      })
      setSent(true)
      setTimeout(() => setSent(false), 3000)
    } catch { /* ignore */ }
    setSending(false)
  }

  async function handleUploadCR(files: FileList) {
    const file = files[0]
    if (!file) return
    const supabase = createClient()
    const path = `${preuve.projet_id}/${preuve.checklist_item}/cr_${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('checklist-docs').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('checklist-docs').getPublicUrl(path)
      await supabase.schema('app').from('checklist_preuves').update({ cr_url: data.publicUrl }).eq('id', preuveId)
      onUpdate({ cr_url: data.publicUrl })
    }
  }

  return (
    <div className="space-y-5">
      {/* Date */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
          <CalendarDays className="w-3.5 h-3.5" /> Date
        </p>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputClass} />
      </div>

      {/* Participants */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" /> Participants
        </p>
        {participants.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {participants.map(email => (
              <span key={email} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">
                {email}
                <button onClick={() => removeParticipant(email)} className="hover:text-red-500"><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addParticipant() } }}
            placeholder="email@exemple.com" className={`${inputClass} flex-1`} />
          <button onClick={addParticipant} disabled={!emailInput.trim()}
            className="px-3 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200 disabled:opacity-50">Ajouter</button>
        </div>
      </div>

      {/* Boutons save + envoyer */}
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving}
          className="flex-1 px-3 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50">
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
        <button onClick={handleSendInvitations} disabled={sending || !date || participants.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-sm text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50">
          {sending ? <span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" /> : sent ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Send className="w-3.5 h-3.5" />}
          {sent ? 'Envoye' : 'Invitations'}
        </button>
      </div>

      {/* CR upload (REUNION_CR only) */}
      {withCR && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Compte-rendu
          </p>
          {preuve.cr_url ? (
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-700 flex-1 truncate">Compte-rendu</span>
              <a href={preuve.cr_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600"><Download className="w-3.5 h-3.5" /></a>
            </div>
          ) : (
            <>
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={e => { if (e.target.files?.length) handleUploadCR(e.target.files) }} />
              <button onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 border border-dashed border-gray-300 rounded-lg px-4 py-2.5 w-full justify-center hover:border-gray-400 hover:bg-gray-50">
                <Upload className="w-4 h-4" /> Uploader le compte-rendu
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Drawer principal ────────────────────────────────────────────────────────

function ChecklistDrawer({ item, preuve, projetId, projetNom, onClose, onUpdate }: {
  item: ChecklistItemDef; preuve: ChecklistPreuve; projetId: string; projetNom: string
  onClose: () => void; onUpdate: (updated: ChecklistPreuve) => void
}) {
  const { user } = useUser()

  async function handleToggle() {
    const newVal = !preuve.completed
    const supabase = createClient()
    await supabase.schema('app').from('checklist_preuves').update({
      completed: newVal,
      completed_at: newVal ? new Date().toISOString() : null,
      completed_by: newVal && user ? user.id : null,
    }).eq('id', preuve.id)
    onUpdate({ ...preuve, completed: newVal, completed_at: newVal ? new Date().toISOString() : null, completed_by: newVal && user ? user.id : null })
  }

  function patchPreuve(patch: Partial<ChecklistPreuve>) {
    onUpdate({ ...preuve, ...patch })
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-[420px] max-w-full bg-white shadow-xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">{item.label}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-gray-400 uppercase">Phase : {preuve.phase}</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${preuve.completed ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                {preuve.completed ? 'Complete' : 'A faire'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {/* Type-specific content */}
          {item.type === 'PHOTOS_COMMENTAIRE' && (
            <>
              <PhotosSection photos={preuve.photos_urls || []} projetId={projetId} itemKey={item.key} preuveId={preuve.id}
                onUpdate={urls => patchPreuve({ photos_urls: urls })} />
              <CommentaireSection value={preuve.commentaire || ''} preuveId={preuve.id}
                onUpdate={v => patchPreuve({ commentaire: v })} />
            </>
          )}

          {item.type === 'LISTE_DOCS' && (
            <>
              <ListeSection items={preuve.liste_items?.length ? preuve.liste_items : (item.defaultList || []).map(l => ({ label: l, checked: false }))}
                preuveId={preuve.id} onUpdate={v => patchPreuve({ liste_items: v })} />
              <UploadDocSection docs={preuve.docs_urls || []} preuveId={preuve.id} projetId={projetId} itemKey={item.key}
                label="Document justificatif" multiple onUpdate={v => patchPreuve({ docs_urls: v })} />
            </>
          )}

          {item.type === 'UPLOAD_DOC' && (
            <>
              <UploadDocSection docs={preuve.docs_urls || []} preuveId={preuve.id} projetId={projetId} itemKey={item.key}
                label={item.docLabel || 'Document'} onUpdate={v => patchPreuve({ docs_urls: v })} />
              {item.explainable && (
                <CommentaireSection value={preuve.commentaire || ''} preuveId={preuve.id}
                  placeholder={item.explainPlaceholder || 'Ajouter une explication...'}
                  onUpdate={v => patchPreuve({ commentaire: v })} />
              )}
            </>
          )}

          {item.type === 'UPLOAD_DOCS_NOMMES' && (
            <>
              <UploadDocSection docs={preuve.docs_urls || []} preuveId={preuve.id} projetId={projetId} itemKey={item.key}
                label="Documents" multiple onUpdate={v => patchPreuve({ docs_urls: v })} />
              {item.explainable && (
                <CommentaireSection value={preuve.commentaire || ''} preuveId={preuve.id}
                  placeholder={item.explainPlaceholder || 'Ajouter une explication...'}
                  onUpdate={v => patchPreuve({ commentaire: v })} />
              )}
            </>
          )}

          {item.type === 'COMMENTAIRE_SEUL' && (
            <CommentaireSection value={preuve.commentaire || ''} preuveId={preuve.id} placeholder={item.placeholder}
              onUpdate={v => patchPreuve({ commentaire: v })} />
          )}

          {(item.type === 'REUNION' || item.type === 'REUNION_CR') && (
            <>
              <ReunionSection preuve={preuve} preuveId={preuve.id} projetNom={projetNom}
                withCR={item.type === 'REUNION_CR'} onUpdate={patch => patchPreuve(patch)} />
              <CommentaireSection value={preuve.commentaire || ''} preuveId={preuve.id}
                placeholder={item.type === 'REUNION' ? "Ordre du jour..." : "Notes de reunion..."} onUpdate={v => patchPreuve({ commentaire: v })} />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-3">
          <button onClick={handleToggle}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              preuve.completed
                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                : 'bg-gray-900 text-white hover:bg-gray-800'
            }`}>
            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${preuve.completed ? 'bg-emerald-500 border-emerald-500' : 'border-white/50'}`}>
              {preuve.completed && <Check className="w-2.5 h-2.5 text-white" />}
            </div>
            {preuve.completed ? 'Marquer incomplet' : 'Marquer complete'}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Fermer</button>
        </div>
      </div>
    </>
  )
}

// ─── Propositions Tab ────────────────────────────────────────────────────────

function NewPropositionModal({ projetId, nextNumero, onClose, onCreated }: {
  projetId: string; nextNumero: number; onClose: () => void; onCreated: (p: Proposition) => void
}) {
  const [type, setType] = useState('proposition_1')
  const [montant, setMontant] = useState('')
  const [dateEnvoi, setDateEnvoi] = useState(new Date().toISOString().split('T')[0])
  const [statut, setStatut] = useState('en_preparation')
  const [motifRefus, setMotifRefus] = useState('')
  const [commentaire, setCommentaire] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleCreate() {
    setSaving(true)
    const supabase = createClient()
    let docUrl: string | null = null

    if (file) {
      const path = `${projetId}/${Date.now()}_${file.name}`
      const { error } = await supabase.storage.from('propositions').upload(path, file, { upsert: true })
      if (!error) {
        const { data } = supabase.storage.from('propositions').getPublicUrl(path)
        docUrl = data.publicUrl
      }
    }

    const { data, error } = await supabase.schema('app').from('propositions').insert({
      projet_id: projetId,
      numero: nextNumero,
      type,
      montant_ht: montant ? parseFloat(montant) : null,
      date_envoi: dateEnvoi || null,
      statut,
      motif_refus: statut === 'refusee' ? motifRefus || null : null,
      commentaire: commentaire || null,
      document_url: docUrl,
    }).select().single()

    if (!error && data) onCreated(data as Proposition)
    setSaving(false)
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Nouvelle proposition</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="px-5 py-5 space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Type</label>
              <select value={type} onChange={e => setType(e.target.value)} className={inputClass}>
                {PROP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Montant HT</label>
              <input type="number" min={0} value={montant} onChange={e => setMontant(e.target.value)} placeholder="Ex : 85000" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Date d&apos;envoi</label>
              <input type="date" value={dateEnvoi} onChange={e => setDateEnvoi(e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Statut</label>
              <select value={statut} onChange={e => setStatut(e.target.value)} className={inputClass}>
                {PROP_STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            {statut === 'refusee' && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Motif du refus</label>
                <textarea value={motifRefus} onChange={e => setMotifRefus(e.target.value)} rows={2} placeholder="Raison du refus client..." className={`${inputClass} resize-none`} />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Commentaire</label>
              <textarea value={commentaire} onChange={e => setCommentaire(e.target.value)} rows={3} placeholder="Notes internes..." className={`${inputClass} resize-none`} />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Document PDF</label>
              {file ? (
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-700 flex-1 truncate">{file.name}</span>
                  <button onClick={() => setFile(null)} className="text-gray-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <>
                  <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]) }} />
                  <button onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 border border-dashed border-gray-300 rounded-lg px-4 py-2.5 w-full justify-center hover:border-gray-400 hover:bg-gray-50">
                    <Upload className="w-4 h-4" /> Ajouter un PDF
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="px-5 py-4 border-t border-gray-100">
            <button onClick={handleCreate} disabled={saving}
              className="w-full px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50">
              {saving ? 'Creation...' : 'Creer la proposition'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Banniere phase Conception ────────────────────────────────────────────────

function ConceptionBanner({
  projetId, dessinatriceId, economisteId,
}: {
  projetId: string
  dessinatriceId: string | null
  economisteId: string | null
}) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [demandes, setDemandes] = useState<Array<{ id: string; type: string | null; statut: string | null; version: number | null }>>([])
  const [propositions, setPropositions] = useState<Array<{ id: string; numero: number; type: string | null; statut: string | null; montant_total_ht: number | null; is_archived: boolean | null }>>([])
  const [pending, setPending] = useState<'plan' | 'chiffrage' | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  async function fetchData() {
    setLoading(true)
    const [{ data: dem }, { data: props }] = await Promise.all([
      supabase.schema('app').from('demandes_travail')
        .select('id, type, statut, version')
        .eq('projet_id', projetId)
        .in('type', ['plan_intention','plan_proposition','plan_apd','estimation_initiale','chiffrage_proposition','chiffrage_apd']),
      supabase.schema('app').from('propositions')
        .select('id, numero, type, statut, montant_total_ht, is_archived')
        .eq('projet_id', projetId)
        .order('numero'),
    ])
    setDemandes(dem ?? [])
    setPropositions(props ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [projetId])

  const propActive = propositions.find(p => !p.is_archived) ?? null
  const versionActive = (propActive?.numero ?? 1) as Version
  const versionIsAPD = propActive?.type === 'finale'
  const labelV = versionIsAPD ? 'APD' : `V${versionActive}`
  const planEnCours = demandes.find(d => d.type?.startsWith('plan_') && d.version === versionActive && (d.statut === 'en_attente' || d.statut === 'en_cours'))
  const chiffrageEnCours = demandes.find(d => (d.type?.includes('chiffrage') || d.type?.includes('estimation')) && d.version === versionActive && (d.statut === 'en_attente' || d.statut === 'en_cours'))
  const planLivre = demandes.find(d => d.type?.startsWith('plan_') && d.version === versionActive && d.statut === 'livree')
  const chiffrageLivre = demandes.find(d => (d.type?.includes('chiffrage') || d.type?.includes('estimation')) && d.version === versionActive && d.statut === 'livree')

  async function declencher(mode: 'plan' | 'chiffrage') {
    const dest = mode === 'plan' ? dessinatriceId : economisteId
    const role = mode === 'plan' ? 'dessinatrice' : 'economiste'
    if (!dest) { setToast(`Aucune ${role} assignee au projet`); setTimeout(() => setToast(null), 3000); return }
    setPending(mode)
    try {
      await creerDemande({
        projetId,
        type: mode === 'plan' ? planTypeForVersion(versionActive, versionIsAPD) : chiffrageTypeForVersion(versionActive, versionIsAPD),
        version: versionActive,
        isAPD: versionIsAPD,
        destinataireId: dest,
        message: `Demande lancee depuis le suivi commercial (${labelV})`,
      })
      setToast(`Demande envoyee a la ${role}`)
      await fetchData()
    } catch (e) {
      setToast((e as Error).message)
    }
    setPending(null)
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-violet-600 text-white flex items-center justify-center flex-shrink-0">
            <Lightbulb className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-violet-900">Phase Conception</p>
            <p className="text-xs text-violet-700">
              Brief client, notices, demandes Plan/Estim, retour client. Version active : <span className="font-bold">{labelV}</span>.
            </p>
          </div>
        </div>
        <Link href={`/commercial/projets/${projetId}/conception`}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-xs font-medium rounded-lg hover:bg-violet-700 flex-shrink-0">
          Ouvrir la page Conception <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <button
          onClick={() => declencher('plan')}
          disabled={!!planEnCours || pending === 'plan' || loading}
          className="flex items-center gap-2 bg-white border border-violet-200 hover:border-violet-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg p-2.5 text-left transition-colors"
        >
          <Pencil className="w-4 h-4 text-violet-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">
              {pending === 'plan' ? 'Envoi...' :
                planLivre && !planEnCours ? `Plan ${labelV} livre` :
                planEnCours ? `Plan en attente (${planEnCours.statut === 'en_cours' ? 'en cours' : 'en attente'})` :
                'Demander un plan a la dessinatrice'}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {dessinatriceId ? (planLivre && !planEnCours ? 'Cliquer pour voir / re-demander' : `Envoi rapide ${labelV}`) : 'Aucune dessinatrice assignee'}
            </p>
          </div>
          {pending === 'plan' ? <Loader2 className="w-4 h-4 animate-spin text-violet-600 flex-shrink-0" /> : <Send className="w-4 h-4 text-gray-300 flex-shrink-0" />}
        </button>

        <button
          onClick={() => declencher('chiffrage')}
          disabled={!!chiffrageEnCours || pending === 'chiffrage' || loading}
          className="flex items-center gap-2 bg-white border border-violet-200 hover:border-violet-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg p-2.5 text-left transition-colors"
        >
          <Calculator className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">
              {pending === 'chiffrage' ? 'Envoi...' :
                chiffrageLivre && !chiffrageEnCours ? `Estim ${labelV} livree` :
                chiffrageEnCours ? `Estim en attente (${chiffrageEnCours.statut === 'en_cours' ? 'en cours' : 'en attente'})` :
                'Demander une estimation a l\'economiste'}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {economisteId ? (chiffrageLivre && !chiffrageEnCours ? 'Cliquer pour voir / re-demander' : `Envoi rapide ${labelV}`) : 'Aucun economiste assigne'}
            </p>
          </div>
          {pending === 'chiffrage' ? <Loader2 className="w-4 h-4 animate-spin text-emerald-600 flex-shrink-0" /> : <Send className="w-4 h-4 text-gray-300 flex-shrink-0" />}
        </button>
      </div>

      {toast && (
        <div className="text-xs px-2.5 py-1.5 rounded-lg bg-violet-900 text-white inline-block">{toast}</div>
      )}
    </div>
  )
}

function PropositionsTab({ projetId, projetNom }: { projetId: string; projetNom: string }) {
  const [propositions, setPropositions] = useState<Proposition[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingStatut, setEditingStatut] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase.schema('app').from('propositions')
        .select('*').eq('projet_id', projetId).order('numero', { ascending: true })
      setPropositions((data ?? []) as Proposition[])
      setLoading(false)
    }
    load()
  }, [projetId])

  function handleCreated(p: Proposition) {
    setPropositions(prev => [...prev, p])
  }

  async function handleStatutChange(propId: string, newStatut: string) {
    const supabase = createClient()
    await supabase.schema('app').from('propositions').update({ statut: newStatut }).eq('id', propId)
    setPropositions(prev => prev.map(p => p.id === propId ? { ...p, statut: newStatut } : p))
    setEditingStatut(null)

    if (newStatut === 'acceptee') {
      await supabase.schema('app').from('projets').update({ statut: 'Contrat' }).eq('id', projetId)
      setConfirmation('Proposition acceptee -- projet passe en phase Contrat')
      setTimeout(() => setConfirmation(''), 4000)
    }
  }

  const nextNumero = propositions.length > 0 ? Math.max(...propositions.map(p => p.numero)) + 1 : 1
  const derniere = propositions.length > 0 ? propositions[propositions.length - 1] : null

  if (loading) return <div className="flex items-center justify-center h-32"><div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" /></div>

  return (
    <div className="space-y-4">
      {/* Header propositions */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Propositions</p>
          {derniere && (
            <p className="text-xs text-gray-400 mt-0.5">
              {propositions.length} proposition{propositions.length > 1 ? 's' : ''}
              {derniere.montant_ht && <> -- derniere : {formatCurrency(derniere.montant_ht)}</>}
            </p>
          )}
        </div>
        <button onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-800">
          <Plus className="w-3.5 h-3.5" /> Nouvelle proposition
        </button>
      </div>

      {confirmation && (
        <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">{confirmation}</div>
      )}

      {/* Timeline */}
      {propositions.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700">Aucune proposition</p>
          <p className="text-xs text-gray-400 mt-1">Creez la premiere proposition pour ce projet</p>
        </div>
      ) : (
        <div className="relative">
          {/* Ligne verticale */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />

          <div className="space-y-4">
            {propositions.map((prop, idx) => (
              <div key={prop.id} className="relative pl-10">
                {/* Point sur la timeline */}
                <div className={`absolute left-2.5 top-4 w-3 h-3 rounded-full border-2 border-white ${
                  prop.statut === 'acceptee' ? 'bg-emerald-500' :
                  prop.statut === 'refusee' ? 'bg-red-400' :
                  prop.statut === 'envoyee' ? 'bg-blue-500' :
                  prop.statut === 'en_negociation' ? 'bg-amber-500' :
                  'bg-gray-300'
                }`} />

                <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">
                          {PROP_TYPE_LABEL[prop.type] ?? prop.type}
                          {prop.type === 'avenant' && ` n${prop.numero}`}
                        </p>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${PROP_STATUT_STYLE[prop.statut] ?? 'bg-gray-100 text-gray-500'}`}>
                          {PROP_STATUTS.find(s => s.value === prop.statut)?.label ?? prop.statut}
                        </span>
                      </div>
                      {prop.montant_ht && (
                        <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(prop.montant_ht)}</p>
                      )}
                    </div>

                    {/* Statut inline */}
                    {editingStatut === prop.id ? (
                      <select
                        value={prop.statut}
                        onChange={e => handleStatutChange(prop.id, e.target.value)}
                        onBlur={() => setEditingStatut(null)}
                        autoFocus
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-gray-900"
                      >
                        {PROP_STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    ) : (
                      <button onClick={() => setEditingStatut(prop.id)}
                        className="text-[10px] text-gray-400 hover:text-gray-700 transition-colors">
                        Changer statut
                      </button>
                    )}
                  </div>

                  {/* Dates */}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    {prop.date_envoi && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Envoi : {new Date(prop.date_envoi).toLocaleDateString('fr-FR')}
                      </span>
                    )}
                    {prop.date_retour && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Retour : {new Date(prop.date_retour).toLocaleDateString('fr-FR')}
                      </span>
                    )}
                  </div>

                  {/* Motif refus */}
                  {prop.statut === 'refusee' && prop.motif_refus && (
                    <div className="px-3 py-2 bg-red-50 border border-red-100 rounded-lg">
                      <p className="text-xs text-red-700"><span className="font-medium">Motif : </span>{prop.motif_refus}</p>
                    </div>
                  )}

                  {/* Commentaire */}
                  {prop.commentaire && (
                    <p className="text-xs text-gray-500 italic">{prop.commentaire}</p>
                  )}

                  {/* Document */}
                  {prop.document_url && (
                    <a href={prop.document_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors">
                      <ExternalLink className="w-3 h-3" /> Voir le document
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <NewPropositionModal
          projetId={projetId}
          nextNumero={nextNumero}
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CommercialProjetDetail() {
  const params = useParams()
  const router = useRouter()
  const { user } = useUser()
  const id = params.id as string

  const [projet, setProjet] = useState<ProjetDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [phaseCom, setPhaseCom] = useState('Analyse')
  const STATUT_TO_PHASE: Record<string, string> = {
    analyse: 'Analyse', lancement: 'Lancement', passation: 'Passation',
  }
  const [preuves, setPreuves] = useState<ChecklistPreuve[]>([])
  const [drawerItem, setDrawerItem] = useState<ChecklistItemDef | null>(null)
  const [activeTab, setActiveTab] = useState<'suivi' | 'propositions'>('suivi')

  // Demande de chiffrage
  const [showDemandeChiffrage, setShowDemandeChiffrage] = useState(false)
  const [dcTitre, setDcTitre] = useState('')
  const [dcDesc, setDcDesc] = useState('')
  const [dcEcoId, setDcEcoId] = useState('')
  const [dcSaving, setDcSaving] = useState(false)
  const [dcToast, setDcToast] = useState<string | null>(null)
  const [economistes, setEconomistes] = useState<{ id: string; nom: string; prenom: string }[]>([])

  // Demande de planning
  const [showDemandePlanning, setShowDemandePlanning] = useState(false)
  const [dpTitre, setDpTitre] = useState('')
  const [dpDesc, setDpDesc] = useState('')
  const [dpEcheance, setDpEcheance] = useState('')
  const [dpCoId, setDpCoId] = useState('')
  const [dpSaving, setDpSaving] = useState(false)
  const [dpToast, setDpToast] = useState<string | null>(null)
  const [cos, setCos] = useState<{ id: string; nom: string; prenom: string }[]>([])

  // Demande de plan (Conception)
  const [showDemandePlan, setShowDemandePlan] = useState(false)
  const [dplVersion, setDplVersion] = useState<Version>(1)
  const [dplIsAPD, setDplIsAPD] = useState(false)
  const [dplDessId, setDplDessId] = useState('')
  const [dplMessage, setDplMessage] = useState('')
  const [dplDate, setDplDate] = useState('')
  const [dplSaving, setDplSaving] = useState(false)
  const [dplToast, setDplToast] = useState<string | null>(null)
  const [dessinatrices, setDessinatrices] = useState<{ id: string; nom: string; prenom: string }[]>([])
  const [dplPropos, setDplPropos] = useState<{ numero: number; type: string | null; verrouillee_apres_signature: boolean | null }[]>([])

  // Menu deroulant "Nouvelle demande"
  const [showDemandeMenu, setShowDemandeMenu] = useState(false)
  const demandeMenuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!showDemandeMenu) return
    function onClick(e: MouseEvent) {
      if (demandeMenuRef.current && !demandeMenuRef.current.contains(e.target as Node)) {
        setShowDemandeMenu(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [showDemandeMenu])

  useEffect(() => {
    const sb = createClient().schema('app')
    sb.from('utilisateurs').select('id, nom, prenom, role').eq('actif', true).eq('role', 'economiste').order('prenom')
      .then(({ data }) => setEconomistes((data ?? []) as { id: string; nom: string; prenom: string }[]))
    sb.from('utilisateurs').select('id, nom, prenom, role').eq('actif', true).eq('role', 'co').order('prenom')
      .then(({ data }) => setCos((data ?? []) as { id: string; nom: string; prenom: string }[]))
    sb.from('utilisateurs').select('id, nom, prenom, role').eq('actif', true).eq('role', 'dessinatrice').order('prenom')
      .then(({ data }) => setDessinatrices((data ?? []) as { id: string; nom: string; prenom: string }[]))
  }, [])

  useEffect(() => {
    if (projet?.economiste_id && !dcEcoId) setDcEcoId(projet.economiste_id)
    if (projet?.co_id && !dpCoId) setDpCoId(projet.co_id)
    const dessId = (projet as unknown as { dessinatrice_id?: string | null } | null)?.dessinatrice_id ?? null
    if (dessId && !dplDessId) setDplDessId(dessId)
  }, [projet?.economiste_id, projet?.co_id, projet])

  // Charge les propositions existantes a l'ouverture de la modale plan
  useEffect(() => {
    if (!showDemandePlan || !id) return
    createClient().schema('app').from('propositions')
      .select('numero, type, verrouillee_apres_signature')
      .eq('projet_id', id)
      .order('numero')
      .then(({ data }) => {
        const props = (data ?? []) as { numero: number; type: string | null; verrouillee_apres_signature: boolean | null }[]
        setDplPropos(props)
        // Pre-selectionner la version active (max non archivee + 1 sinon V1)
        const maxN = props.length ? Math.max(...props.map(p => p.numero)) : 0
        if (!dplIsAPD) setDplVersion((maxN || 1) as Version)
      })
  }, [showDemandePlan, id])

  async function handleDemandeChiffrage() {
    if (!dcTitre.trim() || !dcEcoId || !user || !projet) return
    setDcSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('demandes_chiffrage').insert({
      projet_id: projet.id,
      commercial_id: user.id,
      economiste_id: dcEcoId,
      titre: dcTitre.trim(),
      description: dcDesc.trim(),
      statut: 'en_attente',
    } as never)
    if (!error) {
      await supabase.schema('app').from('alertes').insert({
        projet_id: projet.id,
        utilisateur_id: dcEcoId,
        type: 'demande_chiffrage',
        titre: `Demande de chiffrage — ${projet.nom}`,
        message: dcTitre.trim(),
        priorite: 'high',
        lue: false,
        metadata: { url: `/economiste/chiffrages` },
      })
      setDcToast('Demande de chiffrage envoyée')
      setTimeout(() => setDcToast(null), 3000)
    }
    setDcSaving(false)
    setShowDemandeChiffrage(false)
    setDcTitre(''); setDcDesc('')
  }

  async function handleDemandePlanning() {
    if (!dpTitre.trim() || !dpCoId || !user || !projet) return
    setDpSaving(true)
    const supabase = createClient()

    // 1. Creer une tache assignee au CO choisi
    const { error: tacheErr } = await supabase.schema('app').from('taches').insert({
      titre: dpTitre.trim(),
      description: dpDesc.trim() || `Demande de planning pour le projet ${projet.nom}`,
      projet_id: projet.id,
      creee_par: user.id,
      assignee_a: dpCoId,
      tags_utilisateurs: [user.id], // commercial tagge pour recevoir les MAJ
      tags_roles: [],
      tag_tous: false,
      urgence: 'normal',
      statut: 'a_faire',
      date_echeance: dpEcheance || null,
    } as never)

    if (!tacheErr) {
      // 2. Notification au CO choisi
      await supabase.schema('app').from('alertes').insert({
        projet_id: projet.id,
        utilisateur_id: dpCoId,
        type: 'tache',
        titre: `Demande de planning -- ${projet.nom}`,
        message: dpTitre.trim(),
        priorite: 'high',
        lue: false,
        metadata: { url: `/co/projets/${projet.id}/planning` },
      } as never)
      setDpToast('Demande envoyee au CO -- elle apparait dans son tableau de taches')
      setTimeout(() => setDpToast(null), 4000)
    }
    setDpSaving(false)
    setShowDemandePlanning(false)
    setDpTitre(''); setDpDesc(''); setDpEcheance('')
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.push('/login'); return }

      const { data, error } = await supabase.schema('app').from('projets').select('*').eq('id', id).eq('commercial_id', authUser.id).single()
      if (error || !data) { setNotFound(true); setLoading(false); return }

      const [coRes, econRes, lotsRes, preuvesRes] = await Promise.all([
        data.co_id ? supabase.schema('app').from('utilisateurs').select('prenom, nom').eq('id', data.co_id).single() : { data: null },
        data.economiste_id ? supabase.schema('app').from('utilisateurs').select('prenom, nom').eq('id', data.economiste_id).single() : { data: null },
        supabase.schema('app').from('lots').select('*').eq('projet_id', id).order('numero'),
        supabase.schema('app').from('checklist_preuves').select('*').eq('projet_id', id),
      ])

      const STATUT_TO_PHASE_LOCAL: Record<string, string> = {
        analyse: 'Analyse', lancement: 'Lancement', passation: 'Passation',
      }
      setPhaseCom(STATUT_TO_PHASE_LOCAL[data.statut] ?? data.statut ?? 'Analyse')
      setProjet({ ...data, co: coRes.data ?? null, economiste: econRes.data ?? null, lots: (lotsRes.data ?? []) as Lot[] })

      // Upsert missing items
      const existingKeys = new Set((preuvesRes.data ?? []).map((p: ChecklistPreuve) => p.checklist_item))
      const missing: { projet_id: string; checklist_item: string; phase: string; liste_items?: ListeEntry[] }[] = []
      for (const [phase, items] of Object.entries(CHECKLIST_PAR_PHASE)) {
        for (const item of items) {
          if (!existingKeys.has(item.key)) {
            const row: typeof missing[number] = { projet_id: id, checklist_item: item.key, phase }
            if (item.defaultList) row.liste_items = item.defaultList.map(l => ({ label: l, checked: false }))
            missing.push(row)
          }
        }
      }
      if (missing.length > 0) {
        const { data: inserted } = await supabase.schema('app').from('checklist_preuves')
          .upsert(missing, { onConflict: 'projet_id,checklist_item' }).select()
        setPreuves([...(preuvesRes.data ?? []), ...(inserted ?? [])] as ChecklistPreuve[])
      } else {
        setPreuves((preuvesRes.data ?? []) as ChecklistPreuve[])
      }

      setLoading(false)
    }
    load()
  }, [id])

  function getPreuve(key: string) { return preuves.find(p => p.checklist_item === key) }

  function handleUpdatePreuve(updated: ChecklistPreuve) {
    setPreuves(prev => prev.map(p => p.id === updated.id ? updated : p))
  }

  async function toggleCheckQuick(key: string) {
    const p = getPreuve(key)
    if (!p) return
    const newVal = !p.completed
    const supabase = createClient()
    await supabase.schema('app').from('checklist_preuves').update({
      completed: newVal, completed_at: newVal ? new Date().toISOString() : null,
      completed_by: newVal && user ? user.id : null,
    }).eq('id', p.id)
    handleUpdatePreuve({ ...p, completed: newVal, completed_at: newVal ? new Date().toISOString() : null, completed_by: newVal && user ? user.id : null })
  }

  async function changePhase(phase: string) {
    if (!projet) return
    setPhaseCom(phase)
    const dbStatut = PHASE_TO_STATUT[phase] ?? phase.toLowerCase()
    const supabase = createClient()
    const payload: Record<string, unknown> = { statut: dbStatut }
    if (phase === 'Passation') payload.phase = 'passation'
    await supabase.schema('app').from('projets').update(payload).eq('id', id)
    setProjet({ ...projet, statut: dbStatut } as ProjetDetail)
  }

  function advanceToNextPhase() {
    const idx = PHASES_COMMERCIAL.indexOf(phaseCom as typeof PHASES_COMMERCIAL[number])
    if (idx >= 0 && idx < PHASES_COMMERCIAL.length - 1) changePhase(PHASES_COMMERCIAL[idx + 1])
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" /></div>
  if (notFound) return <div className="p-8 text-center"><p className="text-gray-500 text-sm">Projet introuvable.</p><Link href="/commercial/dashboard" className="mt-4 inline-flex items-center gap-1.5 text-sm text-gray-700 hover:text-gray-900"><ArrowLeft className="w-4 h-4" /> Retour</Link></div>
  if (!projet) return null

  const phaseComIdx = PHASES_COMMERCIAL.indexOf(phaseCom as typeof PHASES_COMMERCIAL[number])
  const safeIdx = phaseComIdx === -1 ? 0 : phaseComIdx
  const progressionCom = Math.round(((safeIdx + 1) / PHASES_COMMERCIAL.length) * 100)
  const currentItems = CHECKLIST_PAR_PHASE[phaseCom] ?? []
  const completedCount = currentItems.filter(i => getPreuve(i.key)?.completed).length
  const allDone = currentItems.length > 0 && completedCount === currentItems.length
  const hasNext = safeIdx < PHASES_COMMERCIAL.length - 1
  const drawerPreuve = drawerItem ? getPreuve(drawerItem.key) : null

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/commercial/dashboard" className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors flex-shrink-0 mt-0.5"><ArrowLeft className="w-4 h-4" /></Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {projet.reference && <span className="text-xs text-gray-400 font-mono">{projet.reference}</span>}
            <StatutBadge statut={projet.statut} />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 truncate">{projet.nom}</h1>
          {projet.client_nom && <p className="text-sm text-gray-500 mt-0.5">{projet.client_nom}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Menu Nouvelle demande */}
          <div className="relative" ref={demandeMenuRef}>
            <button
              onClick={() => setShowDemandeMenu(v => !v)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Send className="w-4 h-4" /> Nouvelle demande
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showDemandeMenu ? 'rotate-180' : ''}`} />
            </button>
            {showDemandeMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-30">
                <button
                  onClick={() => { setShowDemandeMenu(false); setShowDemandePlan(true) }}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-violet-50 text-left transition-colors border-b border-gray-100"
                >
                  <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center flex-shrink-0">
                    <Pencil className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">Plan</p>
                    <p className="text-xs text-gray-500">Dessinatrice — V1 / V2 / APD</p>
                  </div>
                </button>
                <button
                  onClick={() => { setShowDemandeMenu(false); setShowDemandeChiffrage(true) }}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-emerald-50 text-left transition-colors border-b border-gray-100"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                    <Calculator className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">Chiffrage</p>
                    <p className="text-xs text-gray-500">Économiste</p>
                  </div>
                </button>
                <button
                  onClick={() => { setShowDemandeMenu(false); setShowDemandePlanning(true) }}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-blue-50 text-left transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                    <CalendarDays className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">Planning</p>
                    <p className="text-xs text-gray-500">CO</p>
                  </div>
                </button>
              </div>
            )}
          </div>

          <Link href={`/commercial/projets/${id}/planning`} className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
            <CalendarDays className="w-4 h-4" /> Planning
          </Link>
          <Link href={`/commercial/projets/${id}/modifier`} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors">
            <Pencil className="w-4 h-4" /> Modifier
          </Link>
        </div>
      </div>

      {/* Modal demande de plan */}
      {showDemandePlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Demander un plan</h3>
                <p className="text-xs text-gray-500 mt-0.5">A la dessinatrice — phase Conception</p>
              </div>
              <button onClick={() => setShowDemandePlan(false)} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Version *</label>
                {(() => {
                  const apdAcceptee = dplPropos.some(p => p.type === 'finale' && p.verrouillee_apres_signature)
                  const versionsExistantes = Array.from(new Set(dplPropos.map(p => p.numero))).sort((a, b) => a - b)
                  const maxN = versionsExistantes.length ? Math.max(...versionsExistantes) : 0
                  const versionsProposables = apdAcceptee
                    ? versionsExistantes
                    : Array.from(new Set([...versionsExistantes, Math.max(maxN, 0) + 1])).sort((a, b) => a - b)
                  if (versionsProposables.length === 0) versionsProposables.push(1)
                  return (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {versionsProposables.map(v => {
                          const isSelected = !dplIsAPD && dplVersion === v
                          const exists = versionsExistantes.includes(v)
                          return (
                            <button
                              key={v}
                              type="button"
                              onClick={() => { setDplIsAPD(false); setDplVersion(v as Version) }}
                              className={`min-w-14 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                                isSelected ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                              }`}
                            >
                              V{v}{!exists && <span className="ml-1 text-xs opacity-60">+</span>}
                            </button>
                          )
                        })}
                        <button
                          type="button"
                          onClick={() => setDplIsAPD(true)}
                          disabled={apdAcceptee}
                          className={`min-w-14 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                            dplIsAPD ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-violet-700 border-violet-200 hover:border-violet-400'
                          } ${apdAcceptee ? 'opacity-40 cursor-not-allowed' : ''}`}
                          title={apdAcceptee ? 'APD deja signe' : 'Version APD finale signable'}
                        >
                          APD
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 mt-1.5">
                        {dplIsAPD
                          ? `Version finale signable, attachee a la proposition V${dplVersion}.`
                          : versionsExistantes.includes(dplVersion)
                          ? 'Cette version existe deja - la demande s\'y attachera.'
                          : 'Nouvelle version a creer.'}
                      </p>
                    </>
                  )
                })()}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Dessinatrice *</label>
                <select value={dplDessId} onChange={(e) => setDplDessId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:border-violet-500">
                  <option value="">Choisir...</option>
                  {dessinatrices.map(u => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Date souhaitee</label>
                <input type="date" value={dplDate} onChange={(e) => setDplDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Message (optionnel)</label>
                <textarea rows={3} value={dplMessage} onChange={(e) => setDplMessage(e.target.value)}
                  placeholder="Precisions, points d'attention..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-violet-500 resize-none" />
              </div>
              {dplToast && <div className="text-xs px-2.5 py-1.5 rounded-lg bg-violet-100 text-violet-900">{dplToast}</div>}
            </div>
            <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setShowDemandePlan(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
              <button
                onClick={async () => {
                  if (!dplDessId) { setDplToast('Choisir une dessinatrice'); return }
                  setDplSaving(true)
                  setDplToast(null)
                  try {
                    await creerDemande({
                      projetId: id,
                      type: planTypeForVersion(dplVersion, dplIsAPD),
                      version: dplVersion,
                      isAPD: dplIsAPD,
                      destinataireId: dplDessId,
                      message: dplMessage || undefined,
                      dateLimite: dplDate || null,
                    })
                    setShowDemandePlan(false)
                    setDplMessage('')
                    setDplDate('')
                    setDplIsAPD(false)
                    setDpToast('Demande envoyee a la dessinatrice')
                    setTimeout(() => setDpToast(null), 3000)
                  } catch (e) {
                    setDplToast((e as Error).message)
                  }
                  setDplSaving(false)
                }}
                disabled={dplSaving || !dplDessId}
                className="inline-flex items-center gap-2 px-4 py-1.5 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-40"
              >
                {dplSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Envoyer la demande
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal demande de chiffrage */}
      {showDemandeChiffrage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Demander un chiffrage</h3>
              <button onClick={() => setShowDemandeChiffrage(false)} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Titre de la demande *</label>
                <input type="text" value={dcTitre} onChange={(e) => setDcTitre(e.target.value)}
                  placeholder="ex: Estimation initiale"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Description</label>
                <textarea rows={3} value={dcDesc} onChange={(e) => setDcDesc(e.target.value)}
                  placeholder="Précisions sur le périmètre à chiffrer…"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500 resize-y" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Économiste assigné *</label>
                <select value={dcEcoId} onChange={(e) => setDcEcoId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500">
                  <option value="">Choisir…</option>
                  {economistes.map((e) => <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>)}
                </select>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setShowDemandeChiffrage(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
              <button onClick={handleDemandeChiffrage} disabled={dcSaving || !dcTitre.trim() || !dcEcoId}
                className="px-4 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-black disabled:bg-gray-300">
                {dcSaving ? 'Envoi…' : 'Envoyer la demande'}
              </button>
            </div>
          </div>
        </div>
      )}

      {dcToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-lg shadow-lg text-sm">
          {dcToast}
        </div>
      )}

      {/* Modal demande de planning */}
      {showDemandePlanning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Demander un planning</h3>
              <button onClick={() => setShowDemandePlanning(false)} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="px-3 py-2 bg-blue-50 border border-blue-100 rounded-md">
                <p className="text-xs text-blue-700">
                  La demande sera envoyee comme tache au CO choisi. Le planning cree sera partage avec vous au fur et a mesure.
                </p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Titre de la demande *</label>
                <input type="text" value={dpTitre} onChange={(e) => setDpTitre(e.target.value)}
                  placeholder="ex: Planning previsionnel chantier"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Description</label>
                <textarea rows={3} value={dpDesc} onChange={(e) => setDpDesc(e.target.value)}
                  placeholder="Contraintes, contexte, attentes specifiques pour le planning..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500 resize-y" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">CO assigne *</label>
                <select value={dpCoId} onChange={(e) => setDpCoId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500">
                  <option value="">Choisir...</option>
                  {cos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.prenom} {c.nom}{projet.co_id === c.id ? ' — CO du projet' : ''}
                    </option>
                  ))}
                </select>
                {cos.length === 0 && <p className="text-[10px] text-gray-400 mt-1">Aucun CO actif trouve</p>}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Echeance souhaitee</label>
                <input type="date" value={dpEcheance} onChange={(e) => setDpEcheance(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setShowDemandePlanning(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
              <button onClick={handleDemandePlanning} disabled={dpSaving || !dpTitre.trim() || !dpCoId}
                className="px-4 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-black disabled:bg-gray-300">
                {dpSaving ? 'Envoi...' : 'Envoyer la demande'}
              </button>
            </div>
          </div>
        </div>
      )}

      {dpToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-lg shadow-lg text-sm">
          {dpToast}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        <button onClick={() => setActiveTab('suivi')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === 'suivi' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-700'}`}>
          Suivi
        </button>
        <button onClick={() => setActiveTab('propositions')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === 'propositions' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-700'}`}>
          Propositions
        </button>
      </div>

      {activeTab === 'propositions' ? (
        <PropositionsTab projetId={id} projetNom={projet.nom} />
      ) : (
      <>

      {/* Suivi commercial */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Suivi commercial</p>

        <div className="flex items-center gap-1 flex-wrap">
          {PHASES_COMMERCIAL.map((phase, i) => {
            const isPast = i < safeIdx
            const isCurrent = phase === phaseCom
            return (
              <div key={phase} className="flex items-center gap-1">
                <button onClick={() => changePhase(phase)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${isCurrent ? 'bg-gray-900 text-white font-bold' : isPast ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'}`}>
                  {isPast && <Check className="w-3 h-3 inline mr-1" />}{phase}
                </button>
                {i < PHASES_COMMERCIAL.length - 1 && <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 ${isPast ? 'text-emerald-400' : 'text-gray-200'}`} />}
              </div>
            )
          })}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gray-900 rounded-full transition-all" style={{ width: `${progressionCom}%` }} />
          </div>
          <span className="text-xs font-medium text-gray-500 flex-shrink-0">{progressionCom}%</span>
        </div>

        {/* Banniere Conception */}
        {phaseCom === 'Conception' && (
          <ConceptionBanner
            projetId={id}
            dessinatriceId={(projet as unknown as { dessinatrice_id: string | null }).dessinatrice_id ?? null}
            economisteId={projet.economiste_id ?? null}
          />
        )}

        {/* Checklist */}
        <div className="bg-gray-50 rounded-lg border border-gray-100 p-4 space-y-1">
          <p className="text-xs font-semibold text-gray-600 mb-3">Checklist -- {phaseCom}</p>
          {currentItems.map(item => {
            const preuve = getPreuve(item.key)
            const checked = preuve?.completed ?? false
            const hasData = hasPreuveData(preuve)
            return (
              <div key={item.key} className="flex items-center gap-3 py-1.5 group">
                <button onClick={() => toggleCheckQuick(item.key)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${checked ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 group-hover:border-gray-400'}`}>
                  {checked && <Check className="w-3 h-3 text-white" />}
                </button>
                <button onClick={() => setDrawerItem(item)}
                  className={`text-sm text-left flex-1 transition-colors hover:text-gray-900 ${checked ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                  {item.label}
                </button>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {hasData && <Paperclip className="w-3.5 h-3.5 text-gray-400" />}
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 transition-colors" />
                </div>
              </div>
            )
          })}

          <div className="pt-3 mt-3 border-t border-gray-200 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">{completedCount} / {currentItems.length} completees</p>
              {currentItems.length > 0 && <p className="text-xs font-medium text-gray-500">{Math.round((completedCount / currentItems.length) * 100)}%</p>}
            </div>
            <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: currentItems.length > 0 ? `${(completedCount / currentItems.length) * 100}%` : '0%' }} />
            </div>
          </div>

          {allDone && hasNext && (
            <div className="mt-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between gap-3">
              <p className="text-sm text-emerald-700">Phase {phaseCom} complete -- passer a {PHASES_COMMERCIAL[safeIdx + 1]} ?</p>
              <button onClick={advanceToNextPhase} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 flex-shrink-0">
                Phase suivante <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> Informations generales</p>
          <div className="space-y-3">
            {projet.adresse && <div className="flex items-start gap-2"><MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" /><span className="text-sm text-gray-700">{projet.adresse}</span></div>}
            {projet.type_chantier && <div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" /><span className="text-sm text-gray-700">{projet.type_chantier}</span></div>}
            {projet.surface_m2 && <div className="flex items-center gap-2"><Ruler className="w-4 h-4 text-gray-400 flex-shrink-0" /><span className="text-sm text-gray-700">{projet.surface_m2} m2</span></div>}
            {projet.budget_total && <div className="flex items-center gap-2"><Euro className="w-4 h-4 text-gray-400 flex-shrink-0" /><span className="text-sm font-semibold text-gray-900">{formatCurrency(projet.budget_total)}</span></div>}
            <div className="grid grid-cols-2 gap-3 pt-1">
              {projet.date_debut && <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" /><div><p className="text-xs text-gray-400">Debut</p><p className="text-sm text-gray-700">{formatDate(projet.date_debut)}</p></div></div>}
              {projet.date_livraison && <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" /><div><p className="text-xs text-gray-400">Livraison</p><p className="text-sm text-gray-700">{formatDate(projet.date_livraison)}</p></div></div>}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Client</p>
          {projet.client_nom || projet.client_email || projet.client_tel ? (
            <div className="space-y-3">
              {projet.client_nom && <div className="flex items-center gap-2"><User className="w-4 h-4 text-gray-400 flex-shrink-0" /><span className="text-sm font-medium text-gray-900">{projet.client_nom}</span></div>}
              {projet.client_tel && <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-gray-400 flex-shrink-0" /><a href={`tel:${projet.client_tel}`} className="text-sm text-gray-700 hover:text-gray-900">{projet.client_tel}</a></div>}
              {projet.client_email && <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-gray-400 flex-shrink-0" /><a href={`mailto:${projet.client_email}`} className="text-sm text-gray-700 hover:text-gray-900 truncate">{projet.client_email}</a></div>}
            </div>
          ) : <p className="text-sm text-gray-400">Aucune info client renseignee</p>}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Equipe</p>
          <div className="space-y-3">
            {projet.co ? (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-xs font-semibold text-blue-700 flex-shrink-0">{projet.co.prenom[0]}{projet.co.nom[0]}</div>
                <div><p className="text-sm font-medium text-gray-900">{projet.co.prenom} {projet.co.nom}</p><p className="text-xs text-gray-400">Charge d&apos;operations</p></div>
              </div>
            ) : <p className="text-sm text-gray-400">Aucun CO assigne</p>}
            {projet.economiste && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-50 border border-purple-200 flex items-center justify-center text-xs font-semibold text-purple-700 flex-shrink-0">{projet.economiste.prenom[0]}{projet.economiste.nom[0]}</div>
                <div><p className="text-sm font-medium text-gray-900">{projet.economiste.prenom} {projet.economiste.nom}</p><p className="text-xs text-gray-400">Economiste</p></div>
              </div>
            )}
          </div>
        </div>

        {(projet.alertes_cles || projet.infos_hors_contrat || projet.psychologie_client) && (
          <div className="bg-white rounded-xl border border-amber-200 bg-amber-50/30 p-5 space-y-4">
            <p className="text-xs font-medium text-amber-700 uppercase tracking-wider flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Points cles</p>
            <div className="space-y-3">
              <InfoField label="Alertes cles" value={projet.alertes_cles} />
              <InfoField label="Infos hors contrat" value={projet.infos_hors_contrat} />
              <InfoField label="Psychologie client" value={projet.psychologie_client} />
            </div>
          </div>
        )}
      </div>

      {projet.lots.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-4"><Layers className="w-3.5 h-3.5" /> Lots ({projet.lots.length})</p>
          <div className="divide-y divide-gray-50">
            {projet.lots.map(lot => (
              <div key={lot.id} className="flex items-center justify-between py-2.5 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0">{lot.numero}</span>
                  <span className="text-sm text-gray-800 truncate">{lot.corps_etat}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {lot.budget_prevu && <span className="text-xs text-gray-400">{formatCurrency(lot.budget_prevu)}</span>}
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUT_LOT_COLOR[lot.statut] ?? 'bg-gray-100 text-gray-500'}`}>{STATUT_LOT_LABEL[lot.statut] ?? lot.statut}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      </>
      )}

      {/* Drawer */}
      {drawerItem && drawerPreuve && (
        <ChecklistDrawer item={drawerItem} preuve={drawerPreuve} projetId={id} projetNom={projet.nom}
          onClose={() => setDrawerItem(null)} onUpdate={handleUpdatePreuve} />
      )}
    </div>
  )
}
