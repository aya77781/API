'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  MapPin, Phone, Mail, FileText, AlertTriangle,
  CheckCircle2, ArrowLeft, MessageSquarePlus, Send, Loader2, Trash2, X,
  ChevronRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { TopBar } from '@/components/co/TopBar'
import { StatutBadge } from '@/components/ui/Badge'
import { UserTagPicker } from '@/components/shared/UserTagPicker'
import { cn, formatCurrency } from '@/lib/utils'

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

interface Remarque {
  id: string
  type: 'remarque' | 'probleme'
  contenu: string
  tagged_user_ids: string[]
  resolu: boolean
  created_at: string
  auteur_id: string | null
}

const PHASES_COMMERCIAL = ['Analyse', 'Chiffrage', 'Contrat', 'Passation', 'Lancement'] as const
const PHASE_ORDER_CO = ['aps', 'passation', 'achats', 'installation', 'chantier', 'controle', 'cloture', 'gpa']
const PHASE_LABELS_CO: Record<string, string> = {
  aps: 'APS', passation: 'Passation', achats: 'Achats', installation: 'Installation',
  chantier: 'Chantier', controle: 'Controle', cloture: 'Cloture', gpa: 'GPA',
}
const ROLE_LABELS: Record<string, string> = {
  co: 'CO', commercial: 'Commercial', economiste: 'Economiste',
  gerant: 'Gerant', admin: 'Admin', dessinatrice: 'Dessin',
  assistant_travaux: 'AT', comptable: 'Compta', rh: 'RH', cho: 'CHO',
}

export default function GerantProjetDetailPage() {
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
      <div>
        <TopBar title="Chargement..." />
        <div className="p-4 sm:p-6 space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (!projet) return null

  /* ── Computed ── */
  const phaseOp = projet.phase || 'aps'
  const phaseOpIdx = PHASE_ORDER_CO.indexOf(phaseOp)
  const safeOpIdx = phaseOpIdx === -1 ? 0 : phaseOpIdx
  const phasePctOp = Math.round(((safeOpIdx + 1) / PHASE_ORDER_CO.length) * 100)

  const phaseComIdx = PHASES_COMMERCIAL.indexOf(projet.statut as typeof PHASES_COMMERCIAL[number])
  const safeComIdx = phaseComIdx === -1 ? 0 : phaseComIdx
  const phasePctCom = Math.round(((safeComIdx + 1) / PHASES_COMMERCIAL.length) * 100)

  const lotsAttribues = lots.filter(l => l.st_retenu_id).length
  const budgetLots = lots.reduce((sum, l) => sum + (l.budget_prevu ?? 0), 0)
  const daysUntilDelivery = projet.date_livraison
    ? Math.ceil((new Date(projet.date_livraison).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div>
      <TopBar
        title={projet.nom}
        subtitle={[projet.reference, projet.client_nom].filter(Boolean).join(' - ')}
      />

      {/* En-tete projet */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            <Link href="/gerant/projets"
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Retour</span>
            </Link>
            <span className="text-gray-200 hidden sm:inline">·</span>
            <StatutBadge statut={projet.statut} />
            {projet.type_chantier && <span className="text-xs text-gray-400">{projet.type_chantier}</span>}
          </div>
          <div className="flex items-center gap-3 sm:gap-6 text-xs text-gray-500 overflow-x-auto">
            {projet.surface_m2 && <span className="whitespace-nowrap"><span className="font-semibold text-gray-900">{projet.surface_m2} m²</span></span>}
            {projet.budget_total && (
              <span className="whitespace-nowrap">
                <span className="hidden sm:inline">Budget : </span>
                <span className="font-semibold text-gray-900">{formatCurrency(projet.budget_total)}</span>
              </span>
            )}
            {projet.date_livraison && (
              <span className="whitespace-nowrap">
                <span className="hidden sm:inline">Livraison : </span>
                <span className="font-semibold text-gray-900">{new Date(projet.date_livraison).toLocaleDateString('fr-FR')}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">

        {/* Double timeline */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Timeline commerciale */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-3">Timeline commerciale</p>
            <div className="flex items-center gap-1 flex-wrap mb-3">
              {PHASES_COMMERCIAL.map((phase, i) => (
                <div key={phase} className="flex items-center gap-1">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    i === safeComIdx ? 'bg-gray-900 text-white font-bold' :
                    i < safeComIdx ? 'bg-emerald-100 text-emerald-700' :
                    'bg-gray-100 text-gray-400'
                  }`}>{phase}</span>
                  {i < PHASES_COMMERCIAL.length - 1 && (
                    <ChevronRight className={`w-3 h-3 flex-shrink-0 ${i < safeComIdx ? 'text-emerald-400' : 'text-gray-200'}`} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gray-900 rounded-full" style={{ width: `${phasePctCom}%` }} />
              </div>
              <span className="text-[10px] font-medium text-gray-500">{phasePctCom}%</span>
            </div>
          </div>

          {/* Timeline operationnelle */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-3">Timeline operationnelle</p>
            <div className="flex items-center gap-1 flex-wrap mb-3">
              {PHASE_ORDER_CO.map((phase, i) => (
                <div key={phase} className="flex items-center gap-1">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    i === safeOpIdx ? 'bg-gray-900 text-white font-bold' :
                    i < safeOpIdx ? 'bg-emerald-100 text-emerald-700' :
                    'bg-gray-100 text-gray-400'
                  }`}>{PHASE_LABELS_CO[phase] ?? phase}</span>
                  {i < PHASE_ORDER_CO.length - 1 && (
                    <ChevronRight className={`w-3 h-3 flex-shrink-0 ${i < safeOpIdx ? 'text-emerald-400' : 'text-gray-200'}`} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gray-900 rounded-full" style={{ width: `${phasePctOp}%` }} />
              </div>
              <span className="text-[10px] font-medium text-gray-500">{phasePctOp}%</span>
            </div>
            {phaseOp === 'aps' && (
              <p className="text-[10px] text-amber-600 mt-2">En attente de la contractualisation client par le Commercial</p>
            )}
          </div>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MetricCard label="Lots" value={`${lots.length} lots`} sub={`${lotsAttribues} attribue${lotsAttribues > 1 ? 's' : ''}`} />
          <MetricCard label="Budget lots" value={budgetLots > 0 ? formatCurrency(budgetLots) : '--'} sub={`${docCount} document${docCount > 1 ? 's' : ''}`} />
          <MetricCard
            label="Livraison"
            value={projet.date_livraison ? new Date(projet.date_livraison).toLocaleDateString('fr-FR') : '--'}
            sub={daysUntilDelivery != null ? (daysUntilDelivery > 0 ? `J-${daysUntilDelivery}` : daysUntilDelivery === 0 ? "Aujourd'hui" : 'Depassee') : undefined}
            subColor={daysUntilDelivery != null && daysUntilDelivery < 30 ? 'text-red-500' : daysUntilDelivery != null && daysUntilDelivery < 90 ? 'text-amber-500' : 'text-gray-400'}
          />
        </div>

        {/* Bouton remarques (ouvre popup) */}
        <RemarquesButton projetId={id} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Col 1: Infos projet */}
          <div className="lg:col-span-2 space-y-4">
            {/* Client */}
            <Card title="Client">
              {projet.client_nom && <p className="text-sm font-medium text-gray-900">{projet.client_nom}</p>}
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
            </Card>

            {/* Lots */}
            <Card title={`Lots (${lots.length})`}>
              {lots.length === 0 ? (
                <p className="text-xs text-gray-400">Aucun lot</p>
              ) : (
                <div className="divide-y divide-gray-50 -mx-4 sm:-mx-5">
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
            </Card>

            {/* Notes importantes */}
            {(projet.alertes_cles || projet.infos_hors_contrat) && (
              <Card title="Notes importantes">
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
              </Card>
            )}
          </div>

          {/* Col 2: Sidebar */}
          <div className="space-y-4">
            {/* Equipe */}
            <Card title="Equipe">
              {equipe.length === 0 ? (
                <p className="text-xs text-gray-400">Aucun membre assigne</p>
              ) : (
                equipe.map(u => (
                  <div key={u.id} className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-semibold text-gray-600 flex-shrink-0">
                      {u.prenom[0]}{u.nom[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{u.prenom} {u.nom}</p>
                      <p className="text-[10px] text-gray-400">{ROLE_LABELS[u.role] ?? u.role}</p>
                    </div>
                  </div>
                ))
              )}
            </Card>

            {/* Dates */}
            <Card title="Dates">
              {projet.date_debut && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Debut</span>
                  <span className="text-xs font-medium text-gray-900">{new Date(projet.date_debut).toLocaleDateString('fr-FR')}</span>
                </div>
              )}
              {projet.date_livraison && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Livraison</span>
                  <span className="text-xs font-medium text-gray-900">{new Date(projet.date_livraison).toLocaleDateString('fr-FR')}</span>
                </div>
              )}
            </Card>

            {/* Alertes */}
            <Card title={`Alertes (${alertes.length})`}>
              {alertes.length === 0 ? (
                <div className="text-center py-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-300 mx-auto mb-1" />
                  <p className="text-xs text-gray-400">Aucune alerte</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50 -mx-4 sm:-mx-5">
                  {alertes.map(a => (
                    <div key={a.id} className="px-4 sm:px-5 py-2.5">
                      <p className="text-xs font-medium text-gray-900">{a.titre}</p>
                      {a.message && <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-2">{a.message}</p>}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Sub components ── */

function MetricCard({ label, value, sub, subColor, progress }: {
  label: string
  value: string
  sub?: string
  subColor?: string
  progress?: number
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-4 py-3">
      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className={cn('text-xs mt-0.5', subColor ?? 'text-gray-400')}>{sub}</p>}
      {progress != null && (
        <div className="h-1 bg-gray-100 rounded-full mt-2 overflow-hidden">
          <div className="h-full bg-gray-900 rounded-full" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="px-4 sm:px-5 py-3 border-b border-gray-100">
        <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide">{title}</h3>
      </div>
      <div className="px-4 sm:px-5 py-4 space-y-2">{children}</div>
    </div>
  )
}

/* ── Remarques Button + Modal ── */

function RemarquesButton({ projetId }: { projetId: string }) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState<number>(0)

  // Count remarques pour le badge
  useEffect(() => {
    supabase.schema('app').from('projet_remarques')
      .select('id', { count: 'exact', head: true })
      .eq('projet_id', projetId)
      .then(({ count }) => setCount(count ?? 0))
  }, [projetId, open]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-colors"
      >
        <MessageSquarePlus className="w-3.5 h-3.5 text-gray-400" />
        Remarques & signalements
        {count > 0 && (
          <span className="text-[10px] font-semibold bg-gray-900 text-white px-1.5 py-0.5 rounded-full">{count}</span>
        )}
      </button>
      {open && <RemarquesModal projetId={projetId} onClose={() => setOpen(false)} />}
    </>
  )
}

function RemarquesModal({ projetId, onClose }: { projetId: string; onClose: () => void }) {
  const supabase = createClient()
  const { user } = useUser()
  const [remarques, setRemarques] = useState<Remarque[]>([])
  const [loading, setLoading] = useState(true)
  const [contenu, setContenu] = useState('')
  const [type, setType] = useState<'remarque' | 'probleme'>('remarque')
  const [tagged, setTagged] = useState<string[]>([])
  const [posting, setPosting] = useState(false)
  const [authors, setAuthors] = useState<Record<string, UserMin>>({})

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.schema('app').from('projet_remarques')
      .select('*').eq('projet_id', projetId)
      .order('created_at', { ascending: false })
    const list = (data ?? []) as Remarque[]
    setRemarques(list)

    // Fetch authors + utilisateurs tagues
    const allIds = new Set<string>()
    list.forEach(r => {
      if (r.auteur_id) allIds.add(r.auteur_id)
      r.tagged_user_ids?.forEach(uid => allIds.add(uid))
    })
    if (allIds.size > 0) {
      const { data: users } = await supabase.schema('app').from('utilisateurs')
        .select('id, prenom, nom, role').in('id', Array.from(allIds))
      const map: Record<string, UserMin> = {}
      ;(users ?? []).forEach((u: UserMin) => { map[u.id] = u })
      setAuthors(map)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [projetId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handlePost() {
    if (!contenu.trim() || !user) return
    setPosting(true)
    await supabase.schema('app').from('projet_remarques').insert({
      projet_id: projetId,
      auteur_id: user.id,
      type,
      contenu: contenu.trim(),
      tagged_user_ids: tagged,
    })
    setContenu('')
    setTagged([])
    setType('remarque')
    setPosting(false)
    load()
  }

  async function handleToggleResolu(r: Remarque) {
    await supabase.schema('app').from('projet_remarques')
      .update({ resolu: !r.resolu }).eq('id', r.id)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette remarque ?')) return
    await supabase.schema('app').from('projet_remarques').delete().eq('id', id)
    load()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-3xl h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <MessageSquarePlus className="w-4 h-4 text-gray-400" />
            Remarques & signalements ({remarques.length})
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulaire */}
        <div className="px-5 py-4 border-b border-gray-100 space-y-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setType('remarque')}
            className={cn(
              'px-3 py-1 text-xs font-medium rounded-md transition-colors',
              type === 'remarque' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            Remarque
          </button>
          <button
            onClick={() => setType('probleme')}
            className={cn(
              'px-3 py-1 text-xs font-medium rounded-md transition-colors',
              type === 'probleme' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            Probleme
          </button>
        </div>

        <textarea
          value={contenu}
          onChange={e => setContenu(e.target.value)}
          rows={3}
          placeholder={type === 'probleme' ? 'Decrire le probleme...' : 'Ecrire une remarque...'}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
        />

        <div className="flex items-center justify-between gap-2">
          <UserTagPicker
            selected={tagged}
            onChange={setTagged}
            excludeUserId={user?.id}
            compact
          />
          <button
            onClick={handlePost}
            disabled={!contenu.trim() || posting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {posting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Publier
          </button>
        </div>
      </div>

        {/* Liste scrollable */}
        <div className="divide-y divide-gray-50 overflow-y-auto flex-1">
        {loading ? (
          <div className="px-5 py-6 text-center text-xs text-gray-400">Chargement...</div>
        ) : remarques.length === 0 ? (
          <div className="px-5 py-6 text-center text-xs text-gray-400">Aucune remarque pour le moment</div>
        ) : (
          remarques.map(r => {
            const auteur = r.auteur_id ? authors[r.auteur_id] : null
            return (
              <div key={r.id} className={cn('px-4 sm:px-5 py-3 group', r.resolu && 'opacity-60')}>
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0',
                    r.type === 'probleme' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600',
                  )}>
                    {auteur ? `${auteur.prenom[0]}${auteur.nom[0]}` : '??'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {auteur && (
                        <p className="text-xs font-medium text-gray-900">{auteur.prenom} {auteur.nom}</p>
                      )}
                      <span className={cn(
                        'text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide',
                        r.type === 'probleme' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600',
                      )}>
                        {r.type}
                      </span>
                      {r.resolu && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide bg-emerald-50 text-emerald-600">
                          Resolu
                        </span>
                      )}
                      <span className="text-[10px] text-gray-400">
                        {new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className={cn('text-sm text-gray-700 mt-1 whitespace-pre-wrap', r.resolu && 'line-through')}>{r.contenu}</p>
                    {r.tagged_user_ids?.length > 0 && (
                      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                        <span className="text-[10px] text-gray-400">Tagues :</span>
                        {r.tagged_user_ids.map(uid => (
                          <span key={uid} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                            @{authors[uid] ? `${authors[uid].prenom}` : '...'}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleToggleResolu(r)}
                      title={r.resolu ? 'Marquer non resolu' : 'Marquer resolu'}
                      className="p-1 text-gray-300 hover:text-emerald-500 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(r.id)}
                      title="Supprimer"
                      className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
        </div>
      </div>
    </div>
  )
}
