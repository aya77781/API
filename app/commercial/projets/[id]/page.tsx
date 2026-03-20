'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Download, Upload, X, Paperclip,
  CheckCircle2, AlertTriangle, FileText, Users, Activity, Bell,
  ClipboardList, ArrowLeftRight, Rocket, Clock, Plus, Check,
  SendHorizontal, CalendarDays,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  fetchProject, listProjectFiles, uploadProjectFile, deleteProjectFile, getFileUrl,
  createAlerte, updateProjetRemarque,
  fetchPropositions, createProposition, updateProposition,
  fetchChecklistContractuelle, initChecklistContractuelle, toggleChecklistItem,
  type StoredFile,
} from '@/hooks/useProjects'
import { StatutBadge } from '@/components/ui/Badge'
import { formatCurrency, formatDate, PHASE_ORDER } from '@/lib/utils'
import type { Projet, Utilisateur, Alerte, Proposition, ChecklistContractuelle } from '@/types/database'

// ─── Onglets ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',      label: 'Vue d\'ensemble', icon: FileText },
  { id: 'propositions',  label: 'Propositions',    icon: ClipboardList },
  { id: 'documents',     label: 'Documents',        icon: Paperclip },
  { id: 'passation',     label: 'Passation',        icon: ArrowLeftRight },
  { id: 'lancement',     label: 'Lancement',        icon: Rocket },
  { id: 'equipe',        label: 'Équipe',           icon: Users },
  { id: 'activite',      label: 'Activité',         icon: Activity },
  { id: 'alertes',       label: 'Alertes',          icon: Bell },
]

const SLOT_LABELS: Record<string, string> = {
  'cahier-des-charges': 'Cahier des charges',
  'devis':              'Devis / Proposition',
  'plan-apd':           'Plan APD',
  'contrat':            'Contrat signé',
  'autres':             'Autres',
}

// ─── Page principale ─────────────────────────────────────────────────────────

export default function ProjetDetailPage() {
  const params       = useParams()
  const searchParams = useSearchParams()
  const router       = useRouter()
  const id           = params.id as string

  const [projet,         setProjet]         = useState<Projet | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [activeTab,      setActiveTab]      = useState('overview')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    const success = searchParams.get('success')
    const ref     = searchParams.get('ref')
    if (success === 'true') {
      setSuccessMessage(ref ? `Dossier ${ref} créé avec succès` : 'Dossier créé avec succès')
      router.replace(`/commercial/projets/${id}`)
    }
  }, [])

  async function refreshProjet() {
    const p = await fetchProject(id)
    if (p) setProjet(p)
  }

  useEffect(() => {
    fetchProject(id).then((p) => {
      setProjet(p)
      setLoading(false)
    })
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    )
  }

  if (!projet) {
    return (
      <div className="p-6 text-center text-sm text-gray-500">
        Dossier introuvable.{' '}
        <Link href="/commercial/dashboard" className="underline">Retour</Link>
      </div>
    )
  }

  const phaseIdx = PHASE_ORDER.indexOf(projet.statut)
  const safeIdx  = phaseIdx === -1 ? PHASE_ORDER.length - 1 : phaseIdx

  return (
    <div>
      {/* Banner succès */}
      {successMessage && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-3 flex items-center gap-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <p className="text-sm font-medium text-emerald-700">{successMessage}</p>
          <button onClick={() => setSuccessMessage('')} className="ml-auto text-emerald-400 hover:text-emerald-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Link
              href="/commercial/dashboard"
              className="mt-1 flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Mes projets
            </Link>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                {projet.reference && (
                  <span className="text-xs text-gray-400 font-mono">{projet.reference}</span>
                )}
                <StatutBadge statut={projet.statut} />
                {projet.type_chantier && (
                  <span className="text-xs text-gray-400">{projet.type_chantier}</span>
                )}
              </div>
              <h1 className="text-base font-semibold text-gray-900">{projet.nom}</h1>
              {projet.client_nom && (
                <p className="text-xs text-gray-500 mt-0.5">{projet.client_nom}</p>
              )}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-6 text-xs text-gray-500 flex-shrink-0">
            {projet.budget_total && (
              <span>Budget : <span className="font-semibold text-gray-900">{formatCurrency(projet.budget_total)}</span></span>
            )}
            {projet.date_livraison && (
              <span>Livraison : <span className="font-semibold text-gray-900">{formatDate(projet.date_livraison)}</span></span>
            )}
          </div>
        </div>

        {/* Barre de progression */}
        <div className="mt-4 flex gap-0.5">
          {PHASE_ORDER.map((phase, i) => (
            <div key={phase} className="flex-1">
              <div className={`h-1.5 rounded-full ${i <= safeIdx ? 'bg-gray-900' : 'bg-gray-100'}`} />
            </div>
          ))}
        </div>
      </header>

      {/* Onglets */}
      <div className="bg-white border-b border-gray-200">
        <nav className="flex px-6 gap-0 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Contenu */}
      <div className="p-6">
        {activeTab === 'overview'     && <TabOverview      projet={projet} onRefresh={refreshProjet} />}
        {activeTab === 'propositions' && <TabPropositions  projetId={id} />}
        {activeTab === 'documents'    && <TabDocuments     projetId={id} />}
        {activeTab === 'passation'    && <TabPassation     projet={projet} onRefresh={refreshProjet} />}
        {activeTab === 'lancement'    && <TabLancement     projet={projet} onRefresh={refreshProjet} />}
        {activeTab === 'equipe'       && <TabEquipe        projet={projet} />}
        {activeTab === 'activite'     && <TabActivite      projet={projet} />}
        {activeTab === 'alertes'      && <TabAlertes       projetId={id} />}
      </div>
    </div>
  )
}

// ─── Onglet Vue d'ensemble ───────────────────────────────────────────────────

function TabOverview({ projet, onRefresh }: { projet: Projet; onRefresh: () => void }) {
  const [co,               setCo]               = useState<Utilisateur | null>(null)
  const [userId,           setUserId]           = useState<string | null>(null)
  const [checklist,        setChecklist]        = useState<ChecklistContractuelle[]>([])
  const [checklistReady,   setChecklistReady]   = useState(false)
  const [demandeLoading,   setDemandeLoading]   = useState<string | null>(null)

  let rd: Record<string, unknown> = {}
  try { if (projet.remarque) rd = JSON.parse(projet.remarque) } catch {}

  useEffect(() => {
    // Utilisateur courant
    createClient().auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))

    // CO
    if (projet.co_id) {
      createClient()
        .schema('app')
        .from('utilisateurs')
        .select('*')
        .eq('id', projet.co_id)
        .single()
        .then(({ data }) => setCo(data as Utilisateur | null))
    }

    // Checklist contractuelle
    ;(async () => {
      let items = await fetchChecklistContractuelle(projet.id)
      if (items.length === 0) {
        await initChecklistContractuelle(projet.id)
        items = await fetchChecklistContractuelle(projet.id)
      }
      setChecklist(items)
      setChecklistReady(true)
    })()
  }, [projet.id, projet.co_id])

  async function handleToggle(itemId: string, checked: boolean) {
    if (!userId) return
    await toggleChecklistItem(itemId, checked, checked ? userId : null)
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, fait: checked, fait_par: checked ? userId : null, fait_le: checked ? new Date().toISOString() : null }
          : item
      )
    )
  }

  async function handleDemanderPlan() {
    const dessinatriceId = rd.dessinatrice_id as string | undefined
    if (!dessinatriceId) return
    setDemandeLoading('plan')
    await createAlerte({
      projet_id:      projet.id,
      utilisateur_id: dessinatriceId,
      type:           'plan_demande',
      titre:          `Plan demandé — ${projet.nom}`,
      message:        'Le commercial demande le premier plan APD',
      priorite:       'high',
      lue:            false,
    })
    await updateProjetRemarque(projet.id, { plan_statut: 'en_attente' })
    onRefresh()
    setDemandeLoading(null)
  }

  async function handleDemanderEstimation() {
    const economisteId = rd.economiste_id as string | undefined
    if (!economisteId) return
    setDemandeLoading('estimation')
    await createAlerte({
      projet_id:      projet.id,
      utilisateur_id: economisteId,
      type:           'estimation_demandee',
      titre:          `Estimation demandée — ${projet.nom}`,
      message:        'Le commercial demande la première estimation budgétaire',
      priorite:       'high',
      lue:            false,
    })
    await updateProjetRemarque(projet.id, { estimation_statut: 'en_attente' })
    onRefresh()
    setDemandeLoading(null)
  }

  const allChecked        = checklist.length > 0 && checklist.every((i) => i.fait)
  const planStatut        = rd.plan_statut as string | undefined
  const estimationStatut  = rd.estimation_statut as string | undefined

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Colonne principale */}
      <div className="lg:col-span-2 space-y-5">

        {/* Client */}
        <Section title="Informations client">
          <div className="grid grid-cols-2 gap-3">
            <InfoRow label="Nom"              value={projet.client_nom} />
            <InfoRow label="Email"            value={projet.client_email} />
            <InfoRow label="Téléphone"        value={projet.client_tel} />
            {rd.client_type && <InfoRow label="Type" value={rd.client_type as string} />}
            <InfoRow label="Adresse chantier" value={projet.adresse} className="col-span-2" />
          </div>
        </Section>

        {/* Projet */}
        <Section title="Informations projet">
          <div className="grid grid-cols-2 gap-3">
            <InfoRow label="Type de chantier" value={projet.type_chantier} />
            <InfoRow label="Budget"           value={projet.budget_total ? formatCurrency(projet.budget_total) : null} />
            <InfoRow label="Date début"       value={formatDate(projet.date_debut)} />
            <InfoRow label="Livraison prévue" value={formatDate(projet.date_livraison)} />
          </div>
        </Section>

        {/* Synthèse questionnaire */}
        {(projet.psychologie_client || projet.alertes_cles || projet.infos_hors_contrat) && (
          <Section title="Synthèse commerciale">
            {projet.psychologie_client && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Psychologie client</p>
                <p className="text-sm text-gray-700 whitespace-pre-line bg-gray-50 rounded-lg p-3 border border-gray-100">
                  {projet.psychologie_client}
                </p>
              </div>
            )}
            {projet.alertes_cles && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Points de vigilance</p>
                <p className="text-sm text-gray-700 whitespace-pre-line bg-amber-50 rounded-lg p-3 border border-amber-100">
                  {projet.alertes_cles}
                </p>
              </div>
            )}
            {projet.infos_hors_contrat && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Infos hors-contrat</p>
                <p className="text-sm text-gray-700 whitespace-pre-line bg-gray-50 rounded-lg p-3 border border-gray-100">
                  {projet.infos_hors_contrat}
                </p>
              </div>
            )}
          </Section>
        )}

        {/* Équipe & demandes */}
        <Section title="Équipe & demandes internes">
          <div className="space-y-4">
            {/* Plan */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-800">Plan APD</p>
                <p className="text-xs text-gray-400">Dessinatrice</p>
              </div>
              <div className="flex items-center gap-3">
                {planStatut === 'en_attente' ? (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full">
                    <Clock className="w-3 h-3" /> En attente
                  </span>
                ) : planStatut === 'recu' ? (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                    <Check className="w-3 h-3" /> Reçu
                  </span>
                ) : null}
                {planStatut !== 'en_attente' && planStatut !== 'recu' && (
                  <button
                    onClick={handleDemanderPlan}
                    disabled={demandeLoading === 'plan' || !rd.dessinatrice_id}
                    className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-40"
                  >
                    {demandeLoading === 'plan' ? '…' : 'Demander le plan'}
                  </button>
                )}
              </div>
            </div>

            <div className="border-t border-gray-100" />

            {/* Estimation */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-800">Estimation budgétaire</p>
                <p className="text-xs text-gray-400">Économiste</p>
              </div>
              <div className="flex items-center gap-3">
                {estimationStatut === 'en_attente' ? (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full">
                    <Clock className="w-3 h-3" /> En attente
                  </span>
                ) : estimationStatut === 'recu' ? (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                    <Check className="w-3 h-3" /> Reçue
                  </span>
                ) : null}
                {estimationStatut !== 'en_attente' && estimationStatut !== 'recu' && (
                  <button
                    onClick={handleDemanderEstimation}
                    disabled={demandeLoading === 'estimation' || !rd.economiste_id}
                    className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-40"
                  >
                    {demandeLoading === 'estimation' ? '…' : 'Demander une estimation'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </Section>

        {/* Checklist contractuelle */}
        <Section title="Contractuel">
          {!checklistReady ? (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <div className="w-3 h-3 border border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              Chargement…
            </div>
          ) : (
            <div className="space-y-3">
              {checklist.map((item) => (
                <label
                  key={item.id}
                  className="flex items-start gap-3 cursor-pointer group"
                >
                  <div className="mt-0.5 flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={item.fait}
                      onChange={(e) => handleToggle(item.id, e.target.checked)}
                      className="sr-only"
                    />
                    <div
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                        item.fait ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 group-hover:border-gray-500'
                      }`}
                      onClick={() => handleToggle(item.id, !item.fait)}
                    >
                      {item.fait && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${item.fait ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                      {item.etape}
                    </p>
                    {item.fait && item.fait_le && (
                      <p className="text-xs text-gray-300 mt-0.5">
                        {new Date(item.fait_le).toLocaleDateString('fr-FR', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </p>
                    )}
                  </div>
                </label>
              ))}

              {checklist.length > 0 && (
                <div className="pt-3 border-t border-gray-100">
                  <button
                    disabled={!allChecked}
                    className={`w-full py-2.5 text-sm font-medium rounded-lg transition-colors ${
                      allChecked
                        ? 'bg-gray-900 text-white hover:bg-gray-800'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {allChecked ? 'Lancer la passation →' : `Encore ${checklist.filter((i) => !i.fait).length} étape(s) à valider`}
                  </button>
                </div>
              )}
            </div>
          )}
        </Section>
      </div>

      {/* Sidebar droite */}
      <div className="space-y-5">

        {/* Phase active */}
        <Section title="Phase active">
          <div className="space-y-1.5">
            {PHASE_ORDER.map((phase, i) => {
              const idx    = PHASE_ORDER.indexOf(projet.statut)
              const done   = i < idx
              const active = i === idx
              return (
                <div
                  key={phase}
                  className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs ${
                    active ? 'bg-gray-900 text-white font-semibold' : done ? 'text-gray-400' : 'text-gray-300'
                  }`}
                >
                  {done ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${active ? 'border-white bg-white/20' : 'border-gray-200'}`} />
                  )}
                  <span className="capitalize">{phase}</span>
                </div>
              )
            })}
          </div>
        </Section>

        {/* Équipe */}
        <Section title="Équipe assignée">
          {co ? (
            <MemberCard user={co} role="Chargé d'Opérations" />
          ) : (
            <p className="text-xs text-gray-400">Aucun CO assigné</p>
          )}
          <p className="text-xs text-gray-400 mt-3">
            Équipe complète dans l&apos;onglet Équipe
          </p>
        </Section>

        {/* Réunion de passation */}
        {rd.date_passation && (
          <Section title="Réunion de passation">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <CalendarDays className="w-4 h-4 text-gray-400" />
              <span>{new Date(rd.date_passation as string).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}

// ─── Onglet Propositions ─────────────────────────────────────────────────────

const STATUT_PROP_LABELS: Record<string, string> = {
  brouillon:      'Brouillon',
  valide_eco:     'Validé éco',
  envoye_client:  'Envoyé client',
  accepte:        'Accepté',
  refuse:         'Refusé',
}

const STATUT_PROP_COLORS: Record<string, string> = {
  brouillon:     'bg-gray-100 text-gray-600',
  valide_eco:    'bg-blue-100 text-blue-700',
  envoye_client: 'bg-amber-100 text-amber-700',
  accepte:       'bg-emerald-100 text-emerald-700',
  refuse:        'bg-red-100 text-red-700',
}

function TabPropositions({ projetId }: { projetId: string }) {
  const [propositions, setPropositions] = useState<Proposition[]>([])
  const [loading,      setLoading]      = useState(true)
  const [showForm,     setShowForm]     = useState(false)
  const [montant,      setMontant]      = useState('')
  const [remarque,     setRemarque]     = useState('')
  const [saving,       setSaving]       = useState(false)

  useEffect(() => {
    fetchPropositions(projetId)
      .then(setPropositions)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [projetId])

  async function handleAdd() {
    setSaving(true)
    const p = await createProposition({
      projet_id:  projetId,
      numero:     propositions.length + 1,
      montant_ht: montant ? parseFloat(montant) : null,
      remarque:   remarque || null,
      statut:     'brouillon',
      date_envoi: null,
      valide_par: null,
      valide_le:  null,
    })
    setPropositions((prev) => [...prev, p])
    setMontant('')
    setRemarque('')
    setShowForm(false)
    setSaving(false)
  }

  async function handleUpdateStatut(id: string, statut: Proposition['statut']) {
    await updateProposition(id, {
      statut,
      date_envoi: statut === 'envoye_client' ? new Date().toISOString().split('T')[0] : undefined,
    })
    setPropositions((prev) => prev.map((p) => p.id === id ? { ...p, statut } : p))
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">
          {propositions.length} proposition{propositions.length !== 1 ? 's' : ''}
        </p>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Ajouter une proposition
          </button>
        )}
      </div>

      {/* Formulaire inline */}
      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
          <p className="text-sm font-semibold text-gray-800">Nouvelle proposition</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Montant HT (€)</label>
              <input
                type="number"
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Remarque</label>
              <input
                type="text"
                value={remarque}
                onChange={(e) => setRemarque(e.target.value)}
                placeholder="Note optionnelle"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Enregistrement…' : 'Créer'}
            </button>
            <button
              onClick={() => { setShowForm(false); setMontant(''); setRemarque('') }}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {propositions.length === 0 && !showForm ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <ClipboardList className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700">Aucune proposition</p>
          <p className="text-xs text-gray-400 mt-1">Créez la première proposition à soumettre au client.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {propositions.map((p) => (
            <div key={p.id} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-gray-900">Proposition {p.numero}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUT_PROP_COLORS[p.statut] ?? 'bg-gray-100 text-gray-600'}`}>
                      {STATUT_PROP_LABELS[p.statut] ?? p.statut}
                    </span>
                  </div>
                  {p.montant_ht != null && (
                    <p className="text-sm text-gray-700">{formatCurrency(p.montant_ht)} HT</p>
                  )}
                  {p.date_envoi && (
                    <p className="text-xs text-gray-400 mt-1">Envoyé le {formatDate(p.date_envoi)}</p>
                  )}
                  {p.remarque && <p className="text-xs text-gray-500 mt-1">{p.remarque}</p>}
                  <p className="text-xs text-gray-300 mt-1">Créée le {formatDate(p.created_at)}</p>
                </div>

                {/* Actions selon statut */}
                {p.statut === 'brouillon' && (
                  <div className="flex flex-col gap-1.5">
                    <button
                      onClick={() => handleUpdateStatut(p.id, 'valide_eco')}
                      className="text-xs px-3 py-1.5 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      Valider éco
                    </button>
                    <button
                      onClick={() => handleUpdateStatut(p.id, 'envoye_client')}
                      className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5"
                    >
                      <SendHorizontal className="w-3 h-3" /> Envoyer client
                    </button>
                  </div>
                )}
                {p.statut === 'valide_eco' && (
                  <button
                    onClick={() => handleUpdateStatut(p.id, 'envoye_client')}
                    className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-1.5"
                  >
                    <SendHorizontal className="w-3 h-3" /> Envoyer client
                  </button>
                )}
                {p.statut === 'envoye_client' && (
                  <div className="flex flex-col gap-1.5">
                    <button
                      onClick={() => handleUpdateStatut(p.id, 'accepte')}
                      className="text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                      ✓ Acceptée
                    </button>
                    <button
                      onClick={() => handleUpdateStatut(p.id, 'refuse')}
                      className="text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      ✗ Refusée
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Onglet Documents ────────────────────────────────────────────────────────

function TabDocuments({ projetId }: { projetId: string }) {
  const [files,    setFiles]    = useState<StoredFile[]>([])
  const [loading,  setLoading]  = useState(true)
  const [uploading,setUploading]= useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function loadFiles() {
    listProjectFiles(projetId)
      .then(setFiles)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadFiles() }, [projetId])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files
    if (!fileList) return
    setUploading(true)
    for (const file of Array.from(fileList)) {
      try { await uploadProjectFile(projetId, 'autres', file) } catch {}
    }
    loadFiles()
    setUploading(false)
    e.target.value = ''
  }

  async function handleDelete(path: string) {
    try {
      await deleteProjectFile(path)
      setFiles((f) => f.filter((file) => file.path !== path))
    } catch {}
  }

  if (loading) return <Spinner />

  const bySlot = files.reduce<Record<string, StoredFile[]>>((acc, f) => {
    if (!acc[f.slot]) acc[f.slot] = []
    acc[f.slot].push(f)
    return acc
  }, {})

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">
          {files.length} document{files.length !== 1 ? 's' : ''}
        </p>
        <input ref={inputRef} type="file" className="hidden" multiple onChange={handleUpload} />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          <Upload className="w-3.5 h-3.5" />
          {uploading ? 'Upload…' : 'Ajouter un document'}
        </button>
      </div>

      {files.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Paperclip className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700">Aucun document</p>
          <p className="text-xs text-gray-400 mt-1">Uploadez vos premiers documents pour ce dossier.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(bySlot).map(([slot, slotFiles]) => (
            <div key={slot} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  {SLOT_LABELS[slot] ?? slot}
                </p>
              </div>
              <div className="divide-y divide-gray-100">
                {slotFiles.map((file) => (
                  <div key={file.path} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">{file.name}</p>
                        <p className="text-xs text-gray-400">
                          {(file.size / 1024).toFixed(0)} Ko
                          {file.createdAt && <> · {new Date(file.createdAt).toLocaleDateString('fr-FR')}</>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <a
                        href={getFileUrl(file.path)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => handleDelete(file.path)}
                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Onglet Passation ────────────────────────────────────────────────────────

function TabPassation({ projet, onRefresh }: { projet: Projet; onRefresh: () => void }) {
  const [members, setMembers] = useState<Record<string, Utilisateur | null>>({})
  const [saving,  setSaving]  = useState(false)

  let rd: Record<string, unknown> = {}
  try { if (projet.remarque) rd = JSON.parse(projet.remarque) } catch {}

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const ids: Record<string, string | undefined> = {
        co:            projet.co_id ?? undefined,
        economiste:    rd.economiste_id as string | undefined,
        dessinatrice:  rd.dessinatrice_id as string | undefined,
      }

      const results: Record<string, Utilisateur | null> = {}
      for (const [role, uid] of Object.entries(ids)) {
        if (!uid) { results[role] = null; continue }
        const { data } = await supabase.schema('app').from('utilisateurs').select('*').eq('id', uid).single()
        results[role] = data as Utilisateur | null
      }
      setMembers(results)
    }
    load()
  }, [projet.co_id, projet.remarque])

  async function toggleConfirm(key: string, current: boolean) {
    setSaving(true)
    await updateProjetRemarque(projet.id, { [`passation_${key}_confirme`]: !current })
    onRefresh()
    setSaving(false)
  }

  const passationDate = rd.date_passation
    ? new Date(rd.date_passation as string).toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
    : null

  const ordreJour = [
    'Présentation de la psychologie client',
    'Revue des lots pressentis',
    'Transformation des notices commerciales → techniques',
    'Points de vigilance et risques identifiés',
    'Questions / points d\'attention',
  ]

  const participantRoles = [
    { key: 'co',           label: 'Chargé d\'Opérations' },
    { key: 'economiste',   label: 'Économiste' },
    { key: 'dessinatrice', label: 'Dessinatrice' },
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-5">

        {/* Réunion */}
        <Section title="Réunion de passation">
          <div className="flex items-center gap-3 mb-5">
            <CalendarDays className="w-5 h-5 text-gray-400" />
            {passationDate ? (
              <p className="text-sm font-medium text-gray-800">{passationDate}</p>
            ) : (
              <p className="text-sm text-gray-400">Date non définie</p>
            )}
          </div>

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Participants</p>
          <div className="space-y-2">
            {participantRoles.map(({ key, label }) => {
              const user      = members[key]
              const confirmed = !!(rd[`passation_${key}_confirme`])
              return (
                <div key={key} className="flex items-center justify-between gap-4 py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-500 flex-shrink-0">
                      {user ? `${user.prenom?.[0]}${user.nom?.[0]}` : '?'}
                    </div>
                    <div>
                      <p className="text-sm text-gray-800">
                        {user ? `${user.prenom} ${user.nom}` : label}
                      </p>
                      <p className="text-xs text-gray-400">{label}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleConfirm(key, confirmed)}
                    disabled={saving}
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                      confirmed
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                        : 'border-gray-200 text-gray-400 hover:border-gray-300'
                    }`}
                  >
                    {confirmed ? '✓ Confirmé' : 'À confirmer'}
                  </button>
                </div>
              )
            })}
          </div>
        </Section>

        {/* Ordre du jour */}
        <Section title="Ordre du jour">
          <ol className="space-y-2">
            {ordreJour.map((point, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                <span className="w-5 h-5 rounded-full bg-gray-100 text-xs font-semibold text-gray-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {point}
              </li>
            ))}
          </ol>
        </Section>
      </div>

      {/* Sidebar : infos transmises au CO */}
      <div className="space-y-5">
        <Section title="Infos transmises au CO">
          {projet.psychologie_client ? (
            <>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Psychologie</p>
              <p className="text-xs text-gray-700 whitespace-pre-line bg-gray-50 rounded-lg p-3 border border-gray-100 mb-4">
                {projet.psychologie_client}
              </p>
            </>
          ) : null}
          {projet.alertes_cles ? (
            <>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Vigilance</p>
              <p className="text-xs text-gray-700 whitespace-pre-line bg-amber-50 rounded-lg p-3 border border-amber-100 mb-4">
                {projet.alertes_cles}
              </p>
            </>
          ) : null}
          {projet.infos_hors_contrat ? (
            <>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Hors-contrat</p>
              <p className="text-xs text-gray-700 whitespace-pre-line bg-gray-50 rounded-lg p-3 border border-gray-100">
                {projet.infos_hors_contrat}
              </p>
            </>
          ) : null}
          {!projet.psychologie_client && !projet.alertes_cles && !projet.infos_hors_contrat && (
            <p className="text-xs text-gray-400">Aucune info renseignée dans le questionnaire.</p>
          )}
        </Section>
      </div>
    </div>
  )
}

// ─── Onglet Lancement ────────────────────────────────────────────────────────

function TabLancement({ projet, onRefresh }: { projet: Projet; onRefresh: () => void }) {
  const [lotsCount,      setLotsCount]      = useState<number | null>(null)
  const [noticesCount,   setNoticesCount]   = useState<number | null>(null)
  const [saving,         setSaving]         = useState(false)

  let rd: Record<string, unknown> = {}
  try { if (projet.remarque) rd = JSON.parse(projet.remarque) } catch {}

  useEffect(() => {
    createClient()
      .schema('app')
      .from('lots')
      .select('id, notice_technique')
      .eq('projet_id', projet.id)
      .then(({ data }) => {
        setLotsCount(data?.length ?? 0)
        setNoticesCount(data?.filter((l) => l.notice_technique).length ?? 0)
      })
  }, [projet.id])

  async function handleUpdate(patch: Record<string, unknown>) {
    setSaving(true)
    await updateProjetRemarque(projet.id, patch)
    onRefresh()
    setSaving(false)
  }

  async function handleValiderLancement() {
    setSaving(true)
    const supabase = createClient()
    await supabase.schema('app').from('projets').update({ statut: 'achats', phase_active: 'achats' }).eq('id', projet.id)
    onRefresh()
    setSaving(false)
  }

  const lancementStatut  = (rd.lancement_statut as string) || 'a_planifier'
  const plansValides     = !!(rd.plans_valides)
  const budgetValide     = !!(rd.budget_valide)
  const dateLancement    = rd.date_lancement as string | undefined
  const peutValider      = plansValides && budgetValide && lancementStatut === 'faite'

  const statutOptions: Array<{ value: string; label: string }> = [
    { value: 'a_planifier', label: 'À planifier' },
    { value: 'planifiee',   label: 'Planifiée' },
    { value: 'faite',       label: 'Faite' },
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-5">

        {/* Réunion de lancement */}
        <Section title="Réunion de lancement (CO)">
          <div className="space-y-4">
            {/* Statut */}
            <div>
              <p className="text-xs text-gray-400 mb-2">Statut réunion</p>
              <div className="flex gap-2 flex-wrap">
                {statutOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleUpdate({ lancement_statut: opt.value })}
                    disabled={saving}
                    className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                      lancementStatut === opt.value
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'border-gray-200 text-gray-500 hover:border-gray-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Date de la réunion</label>
              <input
                type="date"
                value={dateLancement ?? ''}
                onChange={(e) => handleUpdate({ date_lancement: e.target.value })}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
              />
            </div>

            {/* Compteurs lots */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-2xl font-semibold text-gray-900">
                  {lotsCount ?? '—'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Lots créés</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-2xl font-semibold text-gray-900">
                  {noticesCount != null && lotsCount != null ? `${noticesCount}/${lotsCount}` : '—'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Notices transformées</p>
              </div>
            </div>

            {/* Plans + budget */}
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => handleUpdate({ plans_valides: !plansValides })}
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                    plansValides ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 hover:border-gray-500'
                  }`}
                >
                  {plansValides && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                </div>
                <span className="text-sm text-gray-700">Plans validés</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => handleUpdate({ budget_valide: !budgetValide })}
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                    budgetValide ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 hover:border-gray-500'
                  }`}
                >
                  {budgetValide && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                </div>
                <span className="text-sm text-gray-700">Budget validé</span>
              </label>
            </div>

            {/* Bouton valider lancement */}
            <div className="pt-3 border-t border-gray-100">
              <button
                onClick={handleValiderLancement}
                disabled={!peutValider || saving || projet.statut === 'achats'}
                className={`w-full py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  peutValider && projet.statut !== 'achats'
                    ? 'bg-gray-900 text-white hover:bg-gray-800'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {projet.statut === 'achats'
                  ? '✓ Phase Achats déjà active'
                  : peutValider
                  ? 'Passer en phase Achats →'
                  : 'Valider plans + budget + réunion pour continuer'}
              </button>
            </div>
          </div>
        </Section>
      </div>

      {/* Sidebar récap */}
      <div className="space-y-5">
        <Section title="État du lancement">
          <div className="space-y-3 text-sm">
            <StatusLine label="Réunion CO" value={
              lancementStatut === 'faite' ? 'Faite' :
              lancementStatut === 'planifiee' ? 'Planifiée' : 'À planifier'
            } ok={lancementStatut === 'faite'} />
            <StatusLine label="Lots créés"           value={lotsCount != null ? `${lotsCount}` : '—'}         ok={(lotsCount ?? 0) > 0} />
            <StatusLine label="Notices transformées" value={noticesCount != null ? `${noticesCount}/${lotsCount}` : '—'} ok={noticesCount != null && lotsCount != null && noticesCount === lotsCount && lotsCount > 0} />
            <StatusLine label="Plans validés"        value={plansValides ? 'Oui' : 'Non'}  ok={plansValides} />
            <StatusLine label="Budget validé"        value={budgetValide ? 'Oui' : 'Non'}  ok={budgetValide} />
          </div>
        </Section>
      </div>
    </div>
  )
}

// ─── Onglet Équipe ───────────────────────────────────────────────────────────

function TabEquipe({ projet }: { projet: Projet }) {
  const [members, setMembers] = useState<Array<{ user: Utilisateur; role: string }>>([])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const ids: Array<{ id: string; role: string }> = []

      if (projet.co_id)         ids.push({ id: projet.co_id,        role: 'Chargé d\'Opérations' })
      if (projet.commercial_id) ids.push({ id: projet.commercial_id, role: 'Commercial' })

      try {
        if (projet.remarque) {
          const data = JSON.parse(projet.remarque)
          if (data.economiste_id)   ids.push({ id: data.economiste_id,   role: 'Économiste' })
          if (data.dessinatrice_id) ids.push({ id: data.dessinatrice_id, role: 'Dessinatrice' })
        }
      } catch {}

      const result: Array<{ user: Utilisateur; role: string }> = []
      for (const { id, role } of ids) {
        const { data } = await supabase.schema('app').from('utilisateurs').select('*').eq('id', id).single()
        if (data) result.push({ user: data as Utilisateur, role })
      }
      setMembers(result)
    }
    load()
  }, [projet])

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-gray-700">Membres assignés</p>
      {members.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Aucun membre assigné</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {members.map(({ user, role }) => (
            <div key={user.id} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-600 flex-shrink-0">
                {user.prenom?.[0]}{user.nom?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{user.prenom} {user.nom}</p>
                <p className="text-xs text-gray-400">{role}</p>
              </div>
              {user.email && <p className="text-xs text-gray-500">{user.email}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Onglet Activité ─────────────────────────────────────────────────────────

function TabActivite({ projet }: { projet: Projet }) {
  const events = [
    { date: projet.created_at, label: 'Dossier créé', detail: 'Phase initiale : passation' },
    ...(projet.updated_at !== projet.created_at
      ? [{ date: projet.updated_at, label: 'Dossier mis à jour', detail: `Phase : ${projet.statut}` }]
      : []),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-gray-700">Fil d&apos;activité</p>
      <div className="space-y-3">
        {events.map((ev, i) => (
          <div key={i} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-2 h-2 rounded-full bg-gray-400 mt-1.5 flex-shrink-0" />
              {i < events.length - 1 && <div className="w-px flex-1 bg-gray-100 mt-1" />}
            </div>
            <div className="pb-4 min-w-0">
              <p className="text-sm font-medium text-gray-900">{ev.label}</p>
              <p className="text-xs text-gray-400">{ev.detail}</p>
              <p className="text-xs text-gray-300 mt-0.5">
                {new Date(ev.date).toLocaleDateString('fr-FR', {
                  day: 'numeric', month: 'long', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Onglet Alertes ──────────────────────────────────────────────────────────

function TabAlertes({ projetId }: { projetId: string }) {
  const [alertes, setAlertes] = useState<Alerte[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    createClient()
      .schema('app')
      .from('alertes')
      .select('*')
      .eq('projet_id', projetId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setAlertes((data ?? []) as Alerte[])
        setLoading(false)
      })
  }, [projetId])

  async function markRead(id: string) {
    const supabase = createClient()
    await supabase.schema('app').from('alertes').update({ lue: true }).eq('id', id)
    setAlertes((prev) => prev.map((a) => (a.id === id ? { ...a, lue: true } : a)))
  }

  if (loading) return <Spinner />

  const priorityColors: Record<string, string> = {
    urgent: 'bg-red-100 text-red-700',
    high:   'bg-amber-100 text-amber-700',
    normal: 'bg-blue-100 text-blue-700',
    low:    'bg-gray-100 text-gray-600',
  }

  const unread = alertes.filter((a) => !a.lue).length

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-gray-700">
        {unread} alerte{unread !== 1 ? 's' : ''} non lue{unread !== 1 ? 's' : ''}
      </p>

      {alertes.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Bell className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Aucune alerte pour ce dossier</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alertes.map((alerte) => (
            <div
              key={alerte.id}
              className={`bg-white rounded-lg border p-4 flex items-start gap-3 transition-opacity ${
                alerte.lue ? 'opacity-60 border-gray-100' : 'border-gray-200'
              }`}
            >
              <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${alerte.lue ? 'text-gray-300' : 'text-amber-500'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-medium text-gray-900">{alerte.titre}</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityColors[alerte.priorite] ?? 'bg-gray-100 text-gray-600'}`}>
                    {alerte.priorite}
                  </span>
                </div>
                {alerte.message && <p className="text-xs text-gray-500">{alerte.message}</p>}
                <p className="text-xs text-gray-300 mt-1">
                  {new Date(alerte.created_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
              {!alerte.lue && (
                <button
                  onClick={() => markRead(alerte.id)}
                  className="text-xs text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0"
                >
                  Marquer lu
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Sous-composants ─────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{title}</p>
      {children}
    </div>
  )
}

function InfoRow({ label, value, className }: { label: string; value: string | null | undefined; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm text-gray-900">{value || '—'}</p>
    </div>
  )
}

function MemberCard({ user, role }: { user: Utilisateur; role: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0">
        {user.prenom?.[0]}{user.nom?.[0]}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-900">{user.prenom} {user.nom}</p>
        <p className="text-xs text-gray-400">{role}</p>
      </div>
    </div>
  )
}

function StatusLine({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs font-medium flex items-center gap-1 ${ok ? 'text-emerald-600' : 'text-gray-400'}`}>
        {ok && <Check className="w-3 h-3" />}
        {value}
      </span>
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-32">
      <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
    </div>
  )
}
