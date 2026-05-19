'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  MapPin,
  Building2,
  Ruler,
  Calendar,
  Euro,
  User,
  Users,
  Phone,
  Mail,
  Layers,
  AlertTriangle,
  Info,
  FileText,
  Download,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, formatDateShort } from '@/lib/utils'
import type { Lot, Projet } from '@/types/database'

interface DocEntry {
  id: string
  nom_fichier: string | null
  type_doc: string | null
  storage_path: string | null
  created_at: string
}

interface Equipier { prenom: string; nom: string }

interface ProjetDetail extends Projet {
  co: Equipier | null
  economiste: Equipier | null
  lots: Lot[]
  documents: DocEntry[]
}

const TYPE_LABELS: Record<string, string> = {
  cr: 'Compte-rendu', plan_exe: 'Plan EXE', plan_apd: 'Plan APD',
  plan_doe: 'Plan DOE', cctp: 'CCTP', devis: 'Devis', contrat: 'Contrat',
  rapport_bc: 'Rapport BC', facture: 'Facture', photo: 'Photo',
  audio_reunion: 'Audio réunion', kbis: 'Kbis', assurance: 'Assurance',
  urssaf: 'Urssaf', rib: 'RIB', autre: 'Autre',
}

const STATUT_LOT_COLOR: Record<string, string> = {
  en_attente: 'bg-gray-100 text-gray-600',
  consultation: 'bg-blue-50 text-blue-700',
  negociation: 'bg-amber-50 text-amber-700',
  retenu: 'bg-emerald-50 text-emerald-700',
  en_cours: 'bg-emerald-100 text-emerald-800',
  termine: 'bg-gray-200 text-gray-500',
}
const STATUT_LOT_LABEL: Record<string, string> = {
  en_attente: 'En attente',
  consultation: 'Consultation',
  negociation: 'Négociation',
  retenu: 'Retenu',
  en_cours: 'En cours',
  termine: 'Terminé',
}

function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm text-gray-900 whitespace-pre-line">{value}</p>
    </div>
  )
}

export default function DossierPage() {
  const params = useParams()
  const id = params.id as string

  const [projet, setProjet] = useState<ProjetDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: p } = await supabase
        .schema('app')
        .from('projets')
        .select('*')
        .eq('id', id)
        .single()
      if (!p) {
        setLoading(false)
        return
      }
      const [coRes, econRes, lotsRes, docsRes] = await Promise.all([
        p.co_id
          ? supabase.schema('app').from('utilisateurs').select('prenom, nom').eq('id', p.co_id).single()
          : Promise.resolve({ data: null }),
        p.economiste_id
          ? supabase.schema('app').from('utilisateurs').select('prenom, nom').eq('id', p.economiste_id).single()
          : Promise.resolve({ data: null }),
        supabase.schema('app').from('lots').select('*').eq('projet_id', id).order('numero'),
        supabase
          .schema('app')
          .from('documents')
          .select('id, nom_fichier, type_doc, storage_path, created_at')
          .eq('projet_id', id)
          .order('created_at', { ascending: false }),
      ])
      setProjet({
        ...(p as Projet),
        co: (coRes.data as Equipier | null) ?? null,
        economiste: (econRes.data as Equipier | null) ?? null,
        lots: (lotsRes.data as Lot[]) ?? [],
        documents: (docsRes.data as DocEntry[]) ?? [],
      })
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    )
  }

  if (!projet) {
    return <p className="text-sm text-gray-500">Projet introuvable.</p>
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card icon={Info} title="Informations générales">
          <div className="space-y-3">
            {projet.adresse && <Row icon={MapPin}>{projet.adresse}</Row>}
            {projet.type_chantier && <Row icon={Building2}>{projet.type_chantier}</Row>}
            {projet.surface_m2 && <Row icon={Ruler}>{projet.surface_m2} m²</Row>}
            {projet.budget_total && (
              <Row icon={Euro} bold>{formatCurrency(projet.budget_total)}</Row>
            )}
            <div className="grid grid-cols-2 gap-3 pt-1">
              {projet.date_debut && <DateField icon={Calendar} label="Début" value={projet.date_debut} />}
              {projet.date_livraison && (
                <DateField icon={Calendar} label="Livraison" value={projet.date_livraison} />
              )}
            </div>
          </div>
        </Card>

        <Card icon={User} title="Client">
          {projet.client_nom || projet.client_email || projet.client_tel ? (
            <div className="space-y-3">
              {projet.client_nom && <Row icon={User} bold>{projet.client_nom}</Row>}
              {projet.client_tel && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <a href={`tel:${projet.client_tel}`} className="text-sm text-gray-700 hover:text-gray-900">
                    {projet.client_tel}
                  </a>
                </div>
              )}
              {projet.client_email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <a
                    href={`mailto:${projet.client_email}`}
                    className="text-sm text-gray-700 hover:text-gray-900 truncate"
                  >
                    {projet.client_email}
                  </a>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Aucune info client renseignée</p>
          )}
        </Card>

        <Card icon={Users} title="Équipe">
          <div className="space-y-3">
            {projet.co ? (
              <PersonRow person={projet.co} role="Chargé d'opérations" color="blue" />
            ) : (
              <p className="text-sm text-gray-400">Aucun CO assigné</p>
            )}
            {projet.economiste && (
              <PersonRow person={projet.economiste} role="Économiste" color="purple" />
            )}
          </div>
        </Card>

        {(projet.alertes_cles || projet.infos_hors_contrat || projet.psychologie_client) && (
          <div className="bg-amber-50/30 rounded-xl border border-amber-200 p-5 space-y-4">
            <p className="text-xs font-medium text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Points clés
            </p>
            <div className="space-y-3">
              <InfoField label="Alertes clés" value={projet.alertes_cles} />
              <InfoField label="Infos hors contrat" value={projet.infos_hors_contrat} />
              <InfoField label="Psychologie client" value={projet.psychologie_client} />
            </div>
          </div>
        )}
      </div>

      {projet.lots.length > 0 && (
        <Card icon={Layers} title={`Lots (${projet.lots.length})`} wide>
          <div className="divide-y divide-gray-50">
            {projet.lots.map(lot => (
              <div key={lot.id} className="flex items-center justify-between py-2.5 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0">
                    {lot.numero}
                  </span>
                  <span className="text-sm text-gray-800 truncate">{lot.corps_etat}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {lot.budget_prevu && (
                    <span className="text-xs text-gray-400">{formatCurrency(lot.budget_prevu)}</span>
                  )}
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      STATUT_LOT_COLOR[lot.statut] ?? 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {STATUT_LOT_LABEL[lot.statut] ?? lot.statut}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card icon={FileText} title={`Documents (${projet.documents.length})`} wide>
        {projet.documents.length === 0 ? (
          <p className="text-sm text-gray-400">Aucun document déposé pour ce projet.</p>
        ) : (
          <DocumentsList documents={projet.documents} />
        )}
      </Card>
    </div>
  )
}

function Card({
  icon: Icon,
  title,
  children,
  wide,
}: {
  icon: typeof Info
  title: string
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-5 space-y-4 ${wide ? 'md:col-span-2' : ''}`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" /> {title}
      </p>
      {children}
    </div>
  )
}

function Row({
  icon: Icon,
  children,
  bold,
}: {
  icon: typeof Info
  children: React.ReactNode
  bold?: boolean
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
      <span className={bold ? 'text-sm font-semibold text-gray-900' : 'text-sm text-gray-700'}>
        {children}
      </span>
    </div>
  )
}

function DateField({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Info
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm text-gray-700">{formatDate(value)}</p>
      </div>
    </div>
  )
}

function PersonRow({
  person,
  role,
  color,
}: {
  person: Equipier
  role: string
  color: 'blue' | 'purple'
}) {
  const ringClass = color === 'blue'
    ? 'bg-blue-50 border-blue-200 text-blue-700'
    : 'bg-purple-50 border-purple-200 text-purple-700'
  return (
    <div className="flex items-center gap-3">
      <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-semibold flex-shrink-0 ${ringClass}`}>
        {person.prenom[0]}{person.nom[0]}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-900">{person.prenom} {person.nom}</p>
        <p className="text-xs text-gray-400">{role}</p>
      </div>
    </div>
  )
}

function DocumentsList({ documents }: { documents: DocEntry[] }) {
  const supabase = createClient()
  const [busy, setBusy] = useState<string | null>(null)

  async function open(doc: DocEntry) {
    if (!doc.storage_path) return
    setBusy(doc.id)
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.storage_path, 60)
    setBusy(null)
    if (error || !data?.signedUrl) {
      alert("Impossible d'ouvrir le document : " + (error?.message ?? 'lien introuvable'))
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  return (
    <ul className="divide-y divide-gray-50">
      {documents.map(doc => (
        <li key={doc.id} className="flex items-center justify-between py-2.5 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-gray-500" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {doc.nom_fichier ?? 'Document sans nom'}
              </p>
              <p className="text-xs text-gray-400">
                {TYPE_LABELS[doc.type_doc ?? ''] ?? doc.type_doc ?? '—'} · ajouté le {formatDateShort(doc.created_at)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => open(doc)}
            disabled={!doc.storage_path || busy === doc.id}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-40"
            aria-label="Ouvrir"
          >
            <Download className="w-4 h-4" />
          </button>
        </li>
      ))}
    </ul>
  )
}
