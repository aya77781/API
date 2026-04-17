'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  MapPin, Phone, Mail, Calendar, Users, FileText,
  AlertTriangle, ChevronRight, Clock, CheckCircle2, Package, X,
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
  phase: string | null
  co_id: string | null
  commercial_id: string | null
  economiste_id: string | null
  created_at: string
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

const PHASE_ORDER_CO = ['aps', 'passation', 'achats', 'installation', 'chantier', 'controle', 'cloture', 'gpa']
const PHASE_LABELS: Record<string, string> = {
  aps: 'APS', passation: 'Passation', achats: 'Achats', installation: 'Installation',
  chantier: 'Chantier', controle: 'Controle', cloture: 'Cloture', gpa: 'GPA',
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
  const [demandeChiffrage, setDemandeChiffrage] = useState<{ id: string; montant_ht: number | null; statut: string; notes_co: string | null } | null>(null)
  const [showRefuseModal, setShowRefuseModal] = useState(false)
  const [refuseNotes, setRefuseNotes] = useState('')
  const [dcSaving, setDcSaving] = useState(false)

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

      // Fetch demande chiffrage soumise pour ce projet
      const { data: dcData } = await supabase
        .from('demandes_chiffrage')
        .select('id, montant_ht, statut, notes_co')
        .eq('projet_id', id)
        .eq('statut', 'soumis_co')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      setDemandeChiffrage(dcData as typeof demandeChiffrage)

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
  const phaseOp = projet.phase || 'aps'
  const phaseIdx = PHASE_ORDER_CO.indexOf(phaseOp)
  const safePhaseIdx = phaseIdx === -1 ? 0 : phaseIdx
  const phasePct = Math.round(((safePhaseIdx + 1) / PHASE_ORDER_CO.length) * 100)
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
    <div className="space-y-4 sm:space-y-5">

      {/* Timeline operationnelle */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
        <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-3">Avancement operationnel</p>
        <div className="flex items-center gap-1 flex-wrap mb-3">
          {PHASE_ORDER_CO.map((phase, i) => (
            <div key={phase} className="flex items-center gap-1">
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                i === safePhaseIdx ? 'bg-gray-900 text-white font-bold' :
                i < safePhaseIdx ? 'bg-emerald-100 text-emerald-700' :
                'bg-gray-100 text-gray-400'
              }`}>
                {PHASE_LABELS[phase] ?? phase}
              </span>
              {i < PHASE_ORDER_CO.length - 1 && (
                <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 ${i < safePhaseIdx ? 'text-emerald-400' : 'text-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gray-900 rounded-full transition-all" style={{ width: `${phasePct}%` }} />
          </div>
          <span className="text-xs font-medium text-gray-500 flex-shrink-0">{phasePct}%</span>
        </div>
        {phaseOp === 'aps' && (
          <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-100 rounded-md">
            <p className="text-xs text-amber-700">En attente de la contractualisation client par le Commercial</p>
          </div>
        )}
      </div>

      {/* ── Row 1: Key metrics ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">

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

      {/* Encart validation chiffrage */}
      {demandeChiffrage && demandeChiffrage.statut === 'soumis_co' && (
        <div className="bg-[#EEEDFE] border border-[#D4D2F7] rounded-lg p-4 flex items-start gap-3 flex-wrap">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#EEEDFE' }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="m9 14 2 2 4-4" /></svg>
          </div>
          <div className="flex-1 min-w-[200px]">
            <p className="text-sm font-semibold" style={{ color: '#534AB7' }}>
              Chiffrage soumis par l&apos;économiste
            </p>
            <p className="text-base font-bold mt-0.5" style={{ color: '#534AB7' }}>
              {demandeChiffrage.montant_ht ? `${new Intl.NumberFormat('fr-FR').format(Number(demandeChiffrage.montant_ht))} € HT` : '—'}
            </p>
            <p className="text-xs mt-1" style={{ color: '#7A76C9' }}>En attente de votre validation</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={async () => {
                setDcSaving(true)
                await supabase.from('demandes_chiffrage').update({ statut: 'valide', updated_at: new Date().toISOString() } as never).eq('id', demandeChiffrage.id)
                const eco = projet.economiste_id
                if (eco) {
                  await supabase.schema('app').from('alertes').insert({
                    projet_id: id,
                    utilisateur_id: eco,
                    type: 'chiffrage_valide',
                    titre: `Chiffrage validé — ${projet.nom}`,
                    message: 'Le CO a validé votre chiffrage.',
                    priorite: 'normal',
                    lue: false,
                    metadata: { url: `/economiste/projets/${id}?tab=chiffrage` },
                  })
                }
                setDemandeChiffrage(null)
                setDcSaving(false)
              }}
              disabled={dcSaving}
              className="px-3 py-2 text-sm font-medium text-white rounded-md hover:opacity-90 disabled:opacity-50"
              style={{ background: '#3B6D11' }}
            >
              Valider le chiffrage
            </button>
            <button
              onClick={() => setShowRefuseModal(true)}
              className="px-3 py-2 text-sm font-medium rounded-md border hover:opacity-90"
              style={{ background: '#FCEBEB', color: '#A32D2D', borderColor: '#F1C9C9' }}
            >
              Demander des modifications
            </button>
          </div>
        </div>
      )}

      {/* Modal refus avec notes */}
      {showRefuseModal && demandeChiffrage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Demander des modifications</h3>
              <button onClick={() => setShowRefuseModal(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5">
              <label className="block text-xs text-gray-500 mb-1">Notes pour l&apos;économiste</label>
              <textarea
                rows={4}
                value={refuseNotes}
                onChange={(e) => setRefuseNotes(e.target.value)}
                placeholder="Précisez ce qui doit être modifié…"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500 resize-y"
              />
            </div>
            <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setShowRefuseModal(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
              <button
                onClick={async () => {
                  setDcSaving(true)
                  await supabase.from('demandes_chiffrage').update({
                    statut: 'refuse',
                    notes_co: refuseNotes.trim(),
                    updated_at: new Date().toISOString(),
                  } as never).eq('id', demandeChiffrage.id)
                  const eco = projet.economiste_id
                  if (eco) {
                    await supabase.schema('app').from('alertes').insert({
                      projet_id: id,
                      utilisateur_id: eco,
                      type: 'chiffrage_refuse',
                      titre: `Modifications demandées — ${projet.nom}`,
                      message: refuseNotes.trim() || 'Le CO demande des modifications.',
                      priorite: 'high',
                      lue: false,
                      metadata: { url: `/economiste/projets/${id}?tab=chiffrage` },
                    })
                  }
                  setDemandeChiffrage(null)
                  setShowRefuseModal(false)
                  setRefuseNotes('')
                  setDcSaving(false)
                }}
                disabled={dcSaving}
                className="px-4 py-1.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-gray-300"
              >
                {dcSaving ? 'Envoi…' : 'Envoyer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── Col 1: Infos projet ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Client */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-card">
            <div className="px-4 sm:px-5 py-3 border-b border-gray-100">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Client</h3>
            </div>
            <div className="px-4 sm:px-5 py-4 space-y-2">
              {projet.client_nom && (
                <p className="text-sm font-medium text-gray-900">{projet.client_nom}</p>
              )}
              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
                {projet.client_email && (
                  <a href={`mailto:${projet.client_email}`} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 truncate">
                    <Mail className="w-3 h-3 flex-shrink-0" /><span className="truncate">{projet.client_email}</span>
                  </a>
                )}
                {projet.client_tel && (
                  <a href={`tel:${projet.client_tel}`} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700">
                    <Phone className="w-3 h-3 flex-shrink-0" />{projet.client_tel}
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
              <Link href={`/co/achats?projet=${id}`} className="text-[10px] text-gray-400 hover:text-gray-700 transition-colors">
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
                  <div key={l.id} className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2.5">
                    <span className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500 flex-shrink-0">
                      {String(l.numero).padStart(2, '0')}
                    </span>
                    <span className="text-sm text-gray-700 flex-1 truncate">{l.corps_etat}</span>
                    {l.budget_prevu && (
                      <span className="text-xs text-gray-400 hidden sm:inline">{formatCurrency(l.budget_prevu)}</span>
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
              <div className="px-4 sm:px-5 py-3 border-b border-gray-100">
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
            <div className="px-4 sm:px-5 py-3 border-b border-gray-100">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Equipe</h3>
            </div>
            <div className="px-4 sm:px-5 py-3 space-y-2">
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
            <div className="px-4 sm:px-5 py-3 border-b border-gray-100">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Dates</h3>
            </div>
            <div className="px-4 sm:px-5 py-3 space-y-2">
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
            <div className="px-4 sm:px-5 py-3 border-b border-gray-100">
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
                  <div key={a.id} className="px-4 sm:px-5 py-2.5">
                    <p className="text-xs font-medium text-gray-900">{a.titre}</p>
                    {a.message && <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-2">{a.message}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Acces rapides */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-card">
            <div className="px-4 sm:px-5 py-3 border-b border-gray-100">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Acces rapides</h3>
            </div>
            <div className="px-2 sm:px-3 py-2 space-y-0.5">
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
