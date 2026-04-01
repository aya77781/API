'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  MapPin, Phone, Mail, Calendar, Users, FileText,
  AlertTriangle, ChevronRight, Clock, CheckCircle2, Package,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'

/* ── Types ── */

interface Projet {
  id: string
  nom: string
  reference: string | null
  type_chantier: string | null
  adresse: string | null
  surface_m2: number | null
  budget_total: number | null
  date_debut: string | null
  date_livraison: string | null
  statut: string
  client_nom: string | null
  client_email: string | null
  client_tel: string | null
  psychologie_client: string | null
  infos_hors_contrat: string | null
  alertes_cles: string | null
  remarque: string | null
  co_id: string | null
  commercial_id: string | null
  economiste_id: string | null
}

interface Lot {
  id: string
  numero: number
  corps_etat: string
  statut: string
  budget_prevu: number | null
  st_retenu_id: string | null
}

interface Alerte {
  id: string
  titre: string
  message: string | null
  priorite: string
  lue: boolean
  created_at: string
}

interface UserMin {
  id: string
  prenom: string
  nom: string
  role: string
}

const PHASE_ORDER = ['passation', 'achats', 'installation', 'chantier', 'controle', 'cloture', 'gpa', 'termine']
const PHASE_LABELS: Record<string, string> = {
  passation: 'Passation', achats: 'Achats', installation: 'Installation',
  chantier: 'Chantier', controle: 'Controle', cloture: 'Cloture', gpa: 'GPA', termine: 'Termine',
}

export default function ProjetOverviewPage() {
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()

  const [projet, setProjet] = useState<Projet | null>(null)
  const [lots, setLots] = useState<Lot[]>([])
  const [alertes, setAlertes] = useState<Alerte[]>([])
  const [equipe, setEquipe] = useState<UserMin[]>([])
  const [docCount, setDocCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [projetRes, lotsRes, alertesRes, docsRes] = await Promise.all([
        supabase.schema('app').from('projets').select('*').eq('id', id).single(),
        supabase.schema('app').from('lots')
          .select('id, numero, corps_etat, statut, budget_prevu, st_retenu_id')
          .eq('projet_id', id).order('numero'),
        supabase.schema('app').from('alertes')
          .select('id, titre, message, priorite, lue, created_at')
          .eq('projet_id', id).eq('lue', false)
          .order('created_at', { ascending: false }).limit(5),
        supabase.schema('app').from('documents')
          .select('id', { count: 'exact', head: true })
          .eq('projet_id', id),
      ])

      const p = projetRes.data as Projet | null
      setProjet(p)
      setLots((lotsRes.data ?? []) as Lot[])
      setAlertes((alertesRes.data ?? []) as Alerte[])
      setDocCount(docsRes.count ?? 0)

      // Fetch team members
      if (p) {
        const memberIds = [p.co_id, p.commercial_id, p.economiste_id].filter(Boolean) as string[]
        if (memberIds.length > 0) {
          const { data: users } = await supabase.schema('app').from('utilisateurs')
            .select('id, prenom, nom, role')
            .in('id', memberIds)
          setEquipe((users ?? []) as UserMin[])
        }
      }

      setLoading(false)
    }
    load()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-100 rounded-lg animate-pulse" />)}
      </div>
    )
  }

  if (!projet) return null

  /* ── Computed ── */
  const phaseIdx = PHASE_ORDER.indexOf(projet.statut)
  const phasePct = phaseIdx >= 0 ? Math.round(((phaseIdx + 1) / (PHASE_ORDER.length - 1)) * 100) : 0
  const lotsAttribues = lots.filter(l => l.st_retenu_id).length
  const budgetLots = lots.reduce((sum, l) => sum + (l.budget_prevu ?? 0), 0)
  const daysUntilDelivery = projet.date_livraison
    ? Math.ceil((new Date(projet.date_livraison).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  const ROLE_LABELS: Record<string, string> = {
    co: 'CO', commercial: 'Commercial', economiste: 'Economiste',
    gerant: 'Gerant', admin: 'Admin', dessinatrice: 'Dessin',
    assistant_travaux: 'AT', comptable: 'Compta', rh: 'RH', cho: 'CHO',
  }

  return (
    <div className="space-y-5">

      {/* ── Row 1: Key metrics ── */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 shadow-card px-4 py-3">
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Phase</p>
          <p className="text-sm font-bold text-gray-900 mt-1">{PHASE_LABELS[projet.statut] ?? projet.statut}</p>
          <div className="h-1 bg-gray-100 rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-gray-900 rounded-full" style={{ width: `${phasePct}%` }} />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-card px-4 py-3">
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Lots</p>
          <p className="text-sm font-bold text-gray-900 mt-1">{lots.length} lots</p>
          <p className="text-xs text-gray-400 mt-0.5">{lotsAttribues} attribue{lotsAttribues > 1 ? 's' : ''}</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-card px-4 py-3">
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Budget lots</p>
          <p className="text-sm font-bold text-gray-900 mt-1">{budgetLots > 0 ? formatCurrency(budgetLots) : '--'}</p>
          <p className="text-xs text-gray-400 mt-0.5">{docCount} document{docCount > 1 ? 's' : ''}</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-card px-4 py-3">
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Livraison</p>
          {projet.date_livraison ? (
            <>
              <p className="text-sm font-bold text-gray-900 mt-1">
                {new Date(projet.date_livraison).toLocaleDateString('fr-FR')}
              </p>
              <p className={cn('text-xs mt-0.5',
                daysUntilDelivery != null && daysUntilDelivery < 30 ? 'text-red-500' :
                daysUntilDelivery != null && daysUntilDelivery < 90 ? 'text-amber-500' : 'text-gray-400',
              )}>
                {daysUntilDelivery != null && daysUntilDelivery > 0 ? `J-${daysUntilDelivery}` : daysUntilDelivery === 0 ? "Aujourd'hui" : 'Depassee'}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-400 mt-1">--</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">

        {/* ── Col 1: Infos projet ── */}
        <div className="col-span-2 space-y-4">

          {/* Client */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-card">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Client</h3>
            </div>
            <div className="px-5 py-4 space-y-2">
              {projet.client_nom && (
                <p className="text-sm font-medium text-gray-900">{projet.client_nom}</p>
              )}
              <div className="flex items-center gap-4">
                {projet.client_email && (
                  <a href={`mailto:${projet.client_email}`} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700">
                    <Mail className="w-3 h-3" />{projet.client_email}
                  </a>
                )}
                {projet.client_tel && (
                  <a href={`tel:${projet.client_tel}`} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700">
                    <Phone className="w-3 h-3" />{projet.client_tel}
                  </a>
                )}
              </div>
              {projet.adresse && (
                <p className="flex items-center gap-1.5 text-xs text-gray-400">
                  <MapPin className="w-3 h-3" />{projet.adresse}
                </p>
              )}
              {projet.psychologie_client && (
                <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-md">
                  <p className="text-xs text-amber-700">{projet.psychologie_client}</p>
                </div>
              )}
            </div>
          </div>

          {/* Lots */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-card">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Lots ({lots.length})</h3>
              <Link href={`/co/achats`} className="text-[10px] text-gray-400 hover:text-gray-700 transition-colors">
                Voir achats
              </Link>
            </div>
            {lots.length === 0 ? (
              <div className="px-5 py-6 text-center">
                <p className="text-xs text-gray-400">Aucun lot</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {lots.map(l => (
                  <div key={l.id} className="flex items-center gap-3 px-5 py-2.5">
                    <span className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500 flex-shrink-0">
                      {String(l.numero).padStart(2, '0')}
                    </span>
                    <span className="text-sm text-gray-700 flex-1">{l.corps_etat}</span>
                    {l.budget_prevu && (
                      <span className="text-xs text-gray-400">{formatCurrency(l.budget_prevu)}</span>
                    )}
                    <span className={cn(
                      'text-[10px] font-medium px-1.5 py-0.5 rounded',
                      l.st_retenu_id ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400',
                    )}>
                      {l.st_retenu_id ? 'Attribue' : l.statut.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes importantes */}
          {(projet.alertes_cles || projet.infos_hors_contrat) && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-card">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Notes importantes</h3>
              </div>
              <div className="px-5 py-4 space-y-3">
                {projet.alertes_cles && (
                  <div className="flex gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-gray-700">{projet.alertes_cles}</p>
                  </div>
                )}
                {projet.infos_hors_contrat && (
                  <div className="flex gap-2">
                    <FileText className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-gray-600">{projet.infos_hors_contrat}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Col 2: Sidebar ── */}
        <div className="space-y-4">

          {/* Equipe */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-card">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Equipe</h3>
            </div>
            <div className="px-5 py-3 space-y-2">
              {equipe.map(u => (
                <div key={u.id} className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-semibold text-gray-600 flex-shrink-0">
                    {u.prenom[0]}{u.nom[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{u.prenom} {u.nom}</p>
                    <p className="text-[10px] text-gray-400">{ROLE_LABELS[u.role] ?? u.role}</p>
                  </div>
                </div>
              ))}
              {equipe.length === 0 && (
                <p className="text-xs text-gray-400">Aucun membre assigne</p>
              )}
            </div>
          </div>

          {/* Dates */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-card">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Dates</h3>
            </div>
            <div className="px-5 py-3 space-y-2">
              {projet.date_debut && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Debut</span>
                  <span className="text-xs font-medium text-gray-900">
                    {new Date(projet.date_debut).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              )}
              {projet.date_livraison && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Livraison</span>
                  <span className="text-xs font-medium text-gray-900">
                    {new Date(projet.date_livraison).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Cree le</span>
                <span className="text-xs text-gray-400">
                  {new Date(projet.created_at).toLocaleDateString('fr-FR')}
                </span>
              </div>
            </div>
          </div>

          {/* Alertes non lues */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-card">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                Alertes ({alertes.length})
              </h3>
            </div>
            {alertes.length === 0 ? (
              <div className="px-5 py-4 text-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-300 mx-auto mb-1" />
                <p className="text-xs text-gray-400">Aucune alerte</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {alertes.map(a => (
                  <div key={a.id} className="px-5 py-2.5">
                    <p className="text-xs font-medium text-gray-900">{a.titre}</p>
                    {a.message && <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-2">{a.message}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Acces rapides */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-card">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Acces rapides</h3>
            </div>
            <div className="px-3 py-2 space-y-0.5">
              <Link href={`/co/projets/${id}/documents`}
                className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                <FileText className="w-3.5 h-3.5" />Documents ({docCount})
                <ChevronRight className="w-3 h-3 ml-auto text-gray-300" />
              </Link>
              <Link href="/co/achats"
                className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                <Package className="w-3.5 h-3.5" />Achats
                <ChevronRight className="w-3 h-3 ml-auto text-gray-300" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
