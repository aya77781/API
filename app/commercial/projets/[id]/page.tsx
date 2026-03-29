'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, MapPin, Building2, Ruler, Calendar, Euro,
  User, Users, Phone, Mail, Layers, AlertTriangle, Info,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { StatutBadge } from '@/components/ui/Badge'
import { formatCurrency, formatDate, PHASE_ORDER } from '@/lib/utils'
import type { Projet, Lot } from '@/types/database'

const PHASE_LABELS: Record<string, string> = {
  passation:   'Passation',
  achats:      'Achats',
  installation:'Installation',
  chantier:    'Chantier',
  controle:    'Contrôle',
  cloture:     'Clôture',
  gpa:         'GPA',
  termine:     'Terminé',
}

const STATUT_LOT_COLOR: Record<string, string> = {
  en_attente:   'bg-gray-100 text-gray-600',
  consultation: 'bg-blue-50 text-blue-700',
  negociation:  'bg-amber-50 text-amber-700',
  retenu:       'bg-emerald-50 text-emerald-700',
  en_cours:     'bg-emerald-100 text-emerald-800',
  termine:      'bg-gray-200 text-gray-500',
}

const STATUT_LOT_LABEL: Record<string, string> = {
  en_attente:   'En attente',
  consultation: 'Consultation',
  negociation:  'Négociation',
  retenu:       'Retenu',
  en_cours:     'En cours',
  termine:      'Terminé',
}

interface ProjetDetail extends Projet {
  co: { prenom: string; nom: string } | null
  economiste: { prenom: string; nom: string } | null
  lots: Lot[]
}

function getProgression(statut: string): number {
  const idx = PHASE_ORDER.indexOf(statut)
  const safe = idx === -1 ? PHASE_ORDER.length - 1 : idx
  return Math.round(((safe + 1) / PHASE_ORDER.length) * 100)
}

function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm text-gray-900">{value}</p>
    </div>
  )
}

export default function CommercialProjetDetail() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [projet, setProjet] = useState<ProjetDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      // Vérifier que ce projet appartient au commercial connecté
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data, error } = await supabase
        .schema('app')
        .from('projets')
        .select('*')
        .eq('id', id)
        .eq('commercial_id', user.id)
        .single()

      if (error || !data) { setNotFound(true); setLoading(false); return }

      // Charger l'équipe et les lots en parallèle
      const [coRes, econRes, lotsRes] = await Promise.all([
        data.co_id
          ? supabase.schema('app').from('utilisateurs').select('prenom, nom').eq('id', data.co_id).single()
          : { data: null },
        data.economiste_id
          ? supabase.schema('app').from('utilisateurs').select('prenom, nom').eq('id', data.economiste_id).single()
          : { data: null },
        supabase.schema('app').from('lots').select('*').eq('projet_id', id).order('numero'),
      ])

      setProjet({
        ...data,
        co: coRes.data ?? null,
        economiste: econRes.data ?? null,
        lots: (lotsRes.data ?? []) as Lot[],
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

  if (notFound) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500 text-sm">Projet introuvable ou accès non autorisé.</p>
        <Link href="/commercial/dashboard" className="mt-4 inline-flex items-center gap-1.5 text-sm text-gray-700 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Retour au tableau de bord
        </Link>
      </div>
    )
  }

  if (!projet) return null

  const progression = getProgression(projet.statut)
  const phaseIdx = PHASE_ORDER.indexOf(projet.statut)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start gap-4">
        <Link
          href="/commercial/dashboard"
          className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors flex-shrink-0 mt-0.5"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {projet.reference && (
              <span className="text-xs text-gray-400 font-mono">{projet.reference}</span>
            )}
            <StatutBadge statut={projet.statut} />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 truncate">{projet.nom}</h1>
          {projet.client_nom && (
            <p className="text-sm text-gray-500 mt-0.5">{projet.client_nom}</p>
          )}
        </div>
      </div>

      {/* Progression des phases */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Avancement</p>
        <div className="flex items-center gap-1 flex-wrap mb-3">
          {PHASE_ORDER.map((phase, idx) => {
            const isPast    = idx < phaseIdx
            const isCurrent = idx === phaseIdx
            const isFuture  = idx > phaseIdx
            return (
              <div key={phase} className="flex items-center gap-1">
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  isCurrent ? 'bg-gray-900 text-white' :
                  isPast    ? 'bg-emerald-100 text-emerald-700' :
                               'bg-gray-100 text-gray-400'
                }`}>
                  {PHASE_LABELS[phase] ?? phase}
                </span>
                {idx < PHASE_ORDER.length - 1 && (
                  <span className={`text-xs ${isPast ? 'text-emerald-400' : 'text-gray-200'}`}>›</span>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gray-900 rounded-full transition-all"
              style={{ width: `${progression}%` }}
            />
          </div>
          <span className="text-xs font-medium text-gray-500 flex-shrink-0">{progression}%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Informations générales */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" /> Informations générales
          </p>
          <div className="space-y-3">
            {projet.adresse && (
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700">{projet.adresse}</span>
              </div>
            )}
            {projet.type_chantier && (
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm text-gray-700">{projet.type_chantier}</span>
              </div>
            )}
            {projet.surface_m2 && (
              <div className="flex items-center gap-2">
                <Ruler className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm text-gray-700">{projet.surface_m2} m²</span>
              </div>
            )}
            {projet.budget_total && (
              <div className="flex items-center gap-2">
                <Euro className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm font-semibold text-gray-900">{formatCurrency(projet.budget_total)}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 pt-1">
              {projet.date_debut && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">Début</p>
                    <p className="text-sm text-gray-700">{formatDate(projet.date_debut)}</p>
                  </div>
                </div>
              )}
              {projet.date_livraison && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">Livraison</p>
                    <p className="text-sm text-gray-700">{formatDate(projet.date_livraison)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Client */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" /> Client
          </p>
          {projet.client_nom || projet.client_email || projet.client_tel ? (
            <div className="space-y-3">
              {projet.client_nom && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-900">{projet.client_nom}</span>
                </div>
              )}
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
                  <a href={`mailto:${projet.client_email}`} className="text-sm text-gray-700 hover:text-gray-900 truncate">
                    {projet.client_email}
                  </a>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Aucune info client renseignée</p>
          )}
        </div>

        {/* Équipe */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Équipe
          </p>
          <div className="space-y-3">
            {projet.co ? (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-xs font-semibold text-blue-700 flex-shrink-0">
                  {projet.co.prenom[0]}{projet.co.nom[0]}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{projet.co.prenom} {projet.co.nom}</p>
                  <p className="text-xs text-gray-400">Chargé d&apos;opérations</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Aucun CO assigné</p>
            )}
            {projet.economiste && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-50 border border-purple-200 flex items-center justify-center text-xs font-semibold text-purple-700 flex-shrink-0">
                  {projet.economiste.prenom[0]}{projet.economiste.nom[0]}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{projet.economiste.prenom} {projet.economiste.nom}</p>
                  <p className="text-xs text-gray-400">Économiste</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Alertes clés */}
        {(projet.alertes_cles || projet.infos_hors_contrat || projet.psychologie_client) && (
          <div className="bg-white rounded-xl border border-amber-200 bg-amber-50/30 p-5 space-y-4">
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

      {/* Lots */}
      {projet.lots.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-4">
            <Layers className="w-3.5 h-3.5" /> Lots ({projet.lots.length})
          </p>
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
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUT_LOT_COLOR[lot.statut] ?? 'bg-gray-100 text-gray-500'}`}>
                    {STATUT_LOT_LABEL[lot.statut] ?? lot.statut}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
