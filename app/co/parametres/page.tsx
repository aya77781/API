'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  User, Save, Loader2, Upload, Trash2, Phone, Mail,
  MapPin, Shield, FileText, CreditCard, Camera, Heart,
} from 'lucide-react'
import { TopBar } from '@/components/co/TopBar'
import { useUser } from '@/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

/* ── Types ── */

interface ProfilData {
  prenom: string
  nom: string
  email: string
  role: string
  adresse: string
  ville: string
  code_postal: string
  telephone_perso: string
  email_perso: string
  date_naissance: string
  lieu_naissance: string
  nationalite: string
  numero_secu: string
  rib_iban: string
  rib_bic: string
  contact_urgence_nom: string
  contact_urgence_tel: string
  contact_urgence_lien: string
  statut_emploi: string
}

interface DocPerso {
  id: string
  type_doc: string
  nom_fichier: string
  storage_path: string
  url: string | null
  expire_le: string | null
  created_at: string
}

const DOC_TYPES = [
  { value: 'carte_identite', label: 'Carte d\'identite', icon: Shield },
  { value: 'securite_sociale', label: 'Securite sociale', icon: Heart },
  { value: 'casier_judiciaire', label: 'Casier judiciaire', icon: FileText },
  { value: 'rib', label: 'RIB', icon: CreditCard },
  { value: 'photo', label: 'Photo d\'identite', icon: Camera },
  { value: 'permis_conduire', label: 'Permis de conduire', icon: Shield },
  { value: 'diplome', label: 'Diplome', icon: FileText },
  { value: 'autre', label: 'Autre', icon: FileText },
]

const EMPTY_PROFIL: ProfilData = {
  prenom: '', nom: '', email: '', role: '',
  adresse: '', ville: '', code_postal: '',
  telephone_perso: '', email_perso: '',
  date_naissance: '', lieu_naissance: '', nationalite: '',
  numero_secu: '', rib_iban: '', rib_bic: '',
  contact_urgence_nom: '', contact_urgence_tel: '', contact_urgence_lien: '',
  statut_emploi: 'actif',
}

/* ── Component ── */

export default function ParametresPage() {
  const { user } = useUser()
  const supabase = createClient()

  const [profil, setProfil] = useState<ProfilData>(EMPTY_PROFIL)
  const [docs, setDocs] = useState<DocPerso[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploadType, setUploadType] = useState('carte_identite')
  const [uploading, setUploading] = useState(false)
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialLoad = useRef(true)

  /* ── Load ── */
  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.schema('app').from('utilisateurs')
        .select('*').eq('id', user.id).single(),
      supabase.schema('app').from('documents_personnel')
        .select('*').eq('utilisateur_id', user.id).order('created_at', { ascending: false }),
    ]).then(([profilRes, docsRes]) => {
      if (profilRes.data) {
        const d = profilRes.data as Record<string, unknown>
        setProfil({
          prenom: (d.prenom as string) ?? '',
          nom: (d.nom as string) ?? '',
          email: (d.email as string) ?? '',
          role: (d.role as string) ?? '',
          adresse: (d.adresse as string) ?? '',
          ville: (d.ville as string) ?? '',
          code_postal: (d.code_postal as string) ?? '',
          telephone_perso: (d.telephone_perso as string) ?? '',
          email_perso: (d.email_perso as string) ?? '',
          date_naissance: (d.date_naissance as string) ?? '',
          lieu_naissance: (d.lieu_naissance as string) ?? '',
          nationalite: (d.nationalite as string) ?? '',
          numero_secu: (d.numero_secu as string) ?? '',
          rib_iban: (d.rib_iban as string) ?? '',
          rib_bic: (d.rib_bic as string) ?? '',
          contact_urgence_nom: (d.contact_urgence_nom as string) ?? '',
          contact_urgence_tel: (d.contact_urgence_tel as string) ?? '',
          contact_urgence_lien: (d.contact_urgence_lien as string) ?? '',
          statut_emploi: (d.statut_emploi as string) ?? 'actif',
        })
      }
      setDocs((docsRes.data ?? []) as DocPerso[])
      setLoading(false)
    })
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Autosave (debounce 1s) ── */
  const doSave = useCallback(async (data: ProfilData) => {
    if (!user) return
    setSaving(true)
    const { email, role, ...rest } = data
    await supabase.schema('app').from('utilisateurs')
      .update(rest).eq('id', user.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [user, supabase])

  useEffect(() => {
    if (initialLoad.current) { initialLoad.current = false; return }
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(() => doSave(profil), 1000)
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current) }
  }, [profil, doSave])

  /* ── Upload doc ── */
  async function handleUploadDoc(file: File) {
    if (!user) return
    setUploading(true)
    const ext = file.name.split('.').pop() ?? 'pdf'
    const path = `personnel/${user.id}/${uploadType}_${Date.now()}.${ext}`

    const { error: uploadErr } = await supabase.storage.from('projets').upload(path, file, { upsert: false })
    if (uploadErr) { setUploading(false); return }

    const { data: urlData } = supabase.storage.from('projets').getPublicUrl(path)

    const { data } = await supabase.schema('app').from('documents_personnel')
      .insert({
        utilisateur_id: user.id,
        type_doc: uploadType,
        nom_fichier: file.name,
        storage_path: path,
        url: urlData.publicUrl,
      }).select().single()

    if (data) setDocs(prev => [data as DocPerso, ...prev])
    setUploading(false)
  }

  /* ── Delete doc ── */
  async function handleDeleteDoc(doc: DocPerso) {
    await supabase.storage.from('projets').remove([doc.storage_path])
    await supabase.schema('app').from('documents_personnel').delete().eq('id', doc.id)
    setDocs(prev => prev.filter(d => d.id !== doc.id))
  }

  function update(field: keyof ProfilData, value: string) {
    setProfil(prev => ({ ...prev, [field]: value }))
  }

  if (loading) {
    return (
      <div>
        <TopBar title="Parametres" subtitle="Informations personnelles" />
        <div className="p-6 space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  return (
    <div>
      <TopBar title="Parametres" subtitle="Informations personnelles" />
      <div className="p-4 sm:p-6 space-y-5">

        {/* ── Identite ── */}
        <Section title="Identite" icon={User}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Prenom" value={profil.prenom} onChange={v => update('prenom', v)} />
            <Field label="Nom" value={profil.nom} onChange={v => update('nom', v)} />
            <Field label="Role" value={profil.role} disabled />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Date de naissance" value={profil.date_naissance} onChange={v => update('date_naissance', v)} type="date" />
            <Field label="Lieu de naissance" value={profil.lieu_naissance} onChange={v => update('lieu_naissance', v)} />
            <Field label="Nationalite" value={profil.nationalite} onChange={v => update('nationalite', v)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="N securite sociale" value={profil.numero_secu} onChange={v => update('numero_secu', v)} />
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Statut emploi</label>
              <select value={profil.statut_emploi} onChange={e => update('statut_emploi', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                <option value="cdi">CDI</option>
                <option value="cdd">CDD</option>
                <option value="stage">Stage</option>
                <option value="alternance">Alternance</option>
                <option value="freelance">Freelance</option>
                <option value="periode_essai">Periode d'essai</option>
                <option value="actif">Actif</option>
                <option value="conge">En conge</option>
                <option value="inactif">Inactif</option>
              </select>
            </div>
          </div>
        </Section>

        {/* ── Coordonnees ── */}
        <Section title="Coordonnees" icon={MapPin}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <Field label="Adresse" value={profil.adresse} onChange={v => update('adresse', v)} />
            </div>
            <Field label="Code postal" value={profil.code_postal} onChange={v => update('code_postal', v)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Ville" value={profil.ville} onChange={v => update('ville', v)} />
            <Field label="Telephone personnel" value={profil.telephone_perso} onChange={v => update('telephone_perso', v)} />
            <Field label="Email personnel" value={profil.email_perso} onChange={v => update('email_perso', v)} type="email" />
          </div>
          <Field label="Email professionnel" value={profil.email} disabled />
        </Section>

        {/* ── RIB ── */}
        <Section title="Coordonnees bancaires" icon={CreditCard}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="IBAN" value={profil.rib_iban} onChange={v => update('rib_iban', v)} placeholder="FR76 ..." />
            <Field label="BIC" value={profil.rib_bic} onChange={v => update('rib_bic', v)} placeholder="BNPAFRPP" />
          </div>
        </Section>

        {/* ── Contact urgence ── */}
        <Section title="Contact d'urgence" icon={Phone}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Nom complet" value={profil.contact_urgence_nom} onChange={v => update('contact_urgence_nom', v)} />
            <Field label="Telephone" value={profil.contact_urgence_tel} onChange={v => update('contact_urgence_tel', v)} />
            <Field label="Lien (conjoint, parent...)" value={profil.contact_urgence_lien} onChange={v => update('contact_urgence_lien', v)} />
          </div>
        </Section>

        {/* ── Autosave indicator ── */}
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {saving && <><Loader2 className="w-3 h-3 animate-spin" /> Enregistrement...</>}
          {saved && <><Save className="w-3 h-3 text-emerald-500" /> <span className="text-emerald-600">Enregistre automatiquement</span></>}
        </div>

        {/* ── Documents personnels ── */}
        <Section title="Documents personnels" icon={FileText}>
          {/* Upload */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <select value={uploadType} onChange={e => setUploadType(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
              {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <label className={cn(
              'flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium cursor-pointer hover:bg-gray-800 transition-colors',
              uploading && 'opacity-50 pointer-events-none',
            )}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? 'Upload...' : 'Telecharger un document'}
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadDoc(f); e.target.value = '' }} />
            </label>
          </div>

          {/* List */}
          {docs.length === 0 ? (
            <p className="text-xs text-gray-400 py-4">Aucun document personnel telecharge</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {docs.map(doc => {
                const typeInfo = DOC_TYPES.find(t => t.value === doc.type_doc)
                const Icon = typeInfo?.icon ?? FileText
                return (
                  <div key={doc.id} className="flex items-center gap-3 py-2.5">
                    <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate">{doc.nom_fichier}</p>
                      <p className="text-[10px] text-gray-400">{typeInfo?.label ?? doc.type_doc} -- {new Date(doc.created_at).toLocaleDateString('fr-FR')}</p>
                    </div>
                    {doc.url && (
                      <a href={doc.url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:text-blue-700">Voir</a>
                    )}
                    <button onClick={() => handleDeleteDoc(doc)}
                      className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}

/* ── Sub-components ── */

function Section({ title, icon: Icon, children }: { title: string; icon: typeof User; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="px-5 py-3 border-b border-gray-100">
        <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-gray-400" />{title}
        </h3>
      </div>
      <div className="px-5 py-4 space-y-4">{children}</div>
    </div>
  )
}

function Field({ label, value, onChange, type, disabled, placeholder }: {
  label: string; value: string; onChange?: (v: string) => void;
  type?: string; disabled?: boolean; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <input type={type ?? 'text'} value={value}
        onChange={e => onChange?.(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className={cn(
          'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900',
          disabled && 'bg-gray-50 text-gray-500 cursor-not-allowed',
        )} />
    </div>
  )
}
