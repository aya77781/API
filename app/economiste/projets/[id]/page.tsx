'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Plus, X, Check, ChevronDown, ChevronUp,
  Sparkles, Send, AlertTriangle, FileText,
  BarChart2, GitBranch, Scale, Ruler, FileCheck, FolderInput,
  Layers, TrendingUp, FileWarning,
} from 'lucide-react'
import { ProjetHeader } from '@/components/projet/ProjetHeader'
import MetresTab from '@/components/economiste/MetresTab'
import DceTab from '@/components/economiste/DceTab'
import TabDevisFinal from '@/components/economiste/TabDevisFinal'
import ComparatifST from '@/components/shared/ComparatifST'
import { isPopy3Demo } from '@/lib/fake-data/metres-popy3'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import {
  fetchProjectEco, submitChiffrage, soumettrChiffrageAuCommercial, soumettreChiffrageAuGerant,
  updateLot, addLot, submitFaisabilite,
  createAvenant, updateAvenant,
  type ProjetEco,
} from '@/hooks/useEconomisteProject'
import { Abbr } from '@/components/shared/Abbr'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Lot, ChiffrageVersion, Avenant } from '@/types/database'

// ─── Onglets ──────────────────────────────────────────────────────────────────

const TABS: Array<{ id: string; label: React.ReactNode; icon: typeof Layers }> = [
  { id: 'lots',         label: 'Lots',                                icon: Layers },
  { id: 'previsionnel', label: 'Prévisionnel',                        icon: TrendingUp },
  { id: 'metres',       label: 'Métrés',                              icon: Ruler },
  { id: 'chiffrage',    label: 'Chiffrage',                           icon: BarChart2 },
  { id: 'dce',          label: <Abbr k="DCE" />,                      icon: FolderInput },
  { id: 'comparatif',   label: <>Comparatif <Abbr k="ST" /></>,        icon: Scale },
  { id: 'devis-final',  label: 'Devis final',                         icon: FileCheck },
  { id: 'avenants',     label: 'Avenants',                            icon: FileWarning },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EconomisteProjetPage() {
  const params        = useParams()
  const searchParams  = useSearchParams()
  const id            = params.id as string
  const { user }      = useUser()
  const initialTab    = TABS.some((t) => t.id === searchParams.get('tab'))
    ? (searchParams.get('tab') as string)
    : 'lots'

  const [projet,    setProjet]    = useState<ProjetEco | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [activeTab, setActiveTab] = useState(initialTab)

  async function refresh() {
    const p = await fetchProjectEco(id)
    setProjet(p)
  }

  useEffect(() => {
    fetchProjectEco(id).then((p) => {
      setProjet(p)
      setLoading(false)
    })
  }, [id])

  if (loading) return <Spinner full />

  if (!projet) {
    return (
      <div className="p-6 text-center text-sm text-gray-500">
        Dossier introuvable.{' '}
        <Link href="/economiste/dashboard" className="underline">Retour</Link>
      </div>
    )
  }

  return (
    <div>
      <ProjetHeader projet={projet} backHref="/economiste/dashboard" />

      {/* Onglets */}
      <div className="bg-white border-b border-gray-200">
        <nav className="flex px-6 overflow-x-auto">
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
        {activeTab === 'lots'         && <MetresTab       projetId={projet.id} mode="lots"      fakeData={isPopy3Demo(projet.reference)} />}
        {activeTab === 'previsionnel' && <PrevisionnelTab projetId={projet.id} />}
        {activeTab === 'metres'       && <MetresTab       projetId={projet.id} mode="metres"    fakeData={isPopy3Demo(projet.reference)} />}
        {activeTab === 'chiffrage'    && <MetresTab       projetId={projet.id} mode="chiffrage" fakeData={isPopy3Demo(projet.reference)} />}
        {activeTab === 'dce'          && <DceTab          projetId={projet.id} projetReference={projet.reference} />}
        {activeTab === 'comparatif'   && <ComparatifST    projet={projet} userId={user?.id ?? ''} />}
        {activeTab === 'devis-final'  && <TabDevisFinal   projetId={projet.id} projetNom={projet.nom} />}
        {activeTab === 'avenants'     && <TabAvenants     projet={projet} userId={user?.id ?? ''} onRefresh={() => fetchProjectEco(id).then(setProjet)} />}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ONGLET 1 — CHIFFRAGE
// ═══════════════════════════════════════════════════════════════════════════════

function TabChiffrage({ projet, userId, onRefresh }: { projet: ProjetEco; userId: string; onRefresh: () => void }) {
  const [showModal, setShowModal]   = useState(false)
  const [montant,   setMontant]     = useState('')
  const [motif,     setMotif]       = useState('')
  const [saving,    setSaving]      = useState(false)
  const [submitting,setSubmitting]  = useState(false)
  const [submittingGerant, setSubmittingGerant] = useState(false)

  const versionActive  = projet.chiffrage_versions.find((v) => v.statut === 'actif')
  const versionsOldest = projet.chiffrage_versions.filter((v) => v.statut === 'archive')

  async function handleCreate() {
    if (!montant || !motif) return
    setSaving(true)
    await submitChiffrage(projet.id, parseFloat(montant), motif, userId)
    onRefresh()
    setMontant('')
    setMotif('')
    setShowModal(false)
    setSaving(false)
  }

  async function handleSoumettre() {
    if (!versionActive || !projet.commercial_id) return
    setSubmitting(true)
    await soumettrChiffrageAuCommercial(projet.id, projet.nom, projet.commercial_id, versionActive.montant_total)
    setSubmitting(false)
    alert('Chiffrage soumis au commercial. Une alerte lui a été envoyée.')
  }

  async function handleSoumettreGerant() {
    if (!versionActive) return
    setSubmittingGerant(true)
    try {
      await soumettreChiffrageAuGerant(projet.id, versionActive.montant_total, userId)
      alert('Chiffrage soumis au gérant pour validation avant retour CO.')
      onRefresh()
    } catch (e) {
      alert('Erreur : ' + (e as Error).message)
    } finally {
      setSubmittingGerant(false)
    }
  }

  return (
    <div className="space-y-5">

      {/* Version active */}
      <Section title="Version active">
        {versionActive ? (
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  v{versionActive.version} — Actif
                </span>
              </div>
              <p className="text-2xl font-semibold text-gray-900">{formatCurrency(versionActive.montant_total)} <Abbr k="HT" /></p>
              <p className="text-xs text-gray-400 mt-0.5">Motif : {versionActive.motif_revision}</p>
              <p className="text-xs text-gray-300 mt-0.5">{formatDate(versionActive.created_at)}</p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setShowModal(true)}
                className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Créer v{versionActive.version + 1}
              </button>
              <button
                onClick={handleSoumettre}
                disabled={submitting || !projet.commercial_id}
                className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-40 flex items-center gap-1.5"
              >
                <Send className="w-3 h-3" />
                {submitting ? '…' : 'Soumettre au commercial'}
              </button>
              <button
                onClick={handleSoumettreGerant}
                disabled={submittingGerant}
                className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 flex items-center gap-1.5"
              >
                <Send className="w-3 h-3" />
                {submittingGerant ? '…' : 'Soumettre au gérant'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-gray-400">Aucune version de chiffrage créée.</p>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Créer la v1
            </button>
          </div>
        )}
      </Section>

      {/* Historique */}
      {versionsOldest.length > 0 && (
        <Section title="Versions archivées">
          <div className="space-y-2">
            {versionsOldest.map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-4 py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-xs font-medium text-gray-600">v{v.version} — {formatCurrency(v.montant_total)} <Abbr k="HT" /></p>
                  <p className="text-xs text-gray-400">{v.motif_revision} · {formatDate(v.created_at)}</p>
                </div>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Archivée</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Modal nouvelle version */}
      {showModal && (
        <Modal title={`Nouvelle version de chiffrage`} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Montant total <Abbr k="HT" /> (€) *</label>
              <input
                type="number"
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Motif de révision *</label>
              <textarea
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none"
                placeholder="Ex : Retour client, mise à jour métrés lot 3…"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleCreate}
                disabled={saving || !montant || !motif}
                className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-40 transition-colors"
              >
                {saving ? 'Création…' : 'Créer'}
              </button>
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800">
                Annuler
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ONGLET 2 — LOTS & NOTICES
// ═══════════════════════════════════════════════════════════════════════════════

function TabLotsNotices({ projet, onRefresh }: { projet: ProjetEco; onRefresh: () => void }) {
  const [addingLot,    setAddingLot]    = useState(false)
  const [newCorpsEtat, setNewCorpsEtat] = useState('')
  const [saving,       setSaving]       = useState(false)

  async function handleAddLot() {
    if (!newCorpsEtat.trim()) return
    setSaving(true)
    await addLot(projet.id, newCorpsEtat.trim())
    onRefresh()
    setNewCorpsEtat('')
    setAddingLot(false)
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      {projet.lots.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700">Aucun lot</p>
          <p className="text-xs text-gray-400 mt-1">Ajoutez le premier lot pour commencer le chiffrage.</p>
        </div>
      ) : (
        projet.lots.map((lot) => (
          <LotCard key={lot.id} lot={lot} projet={projet} onRefresh={onRefresh} />
        ))
      )}

      {/* Ajouter un lot */}
      {addingLot ? (
        <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-3">
          <input
            type="text"
            value={newCorpsEtat}
            onChange={(e) => setNewCorpsEtat(e.target.value)}
            placeholder="Corps d'état (ex : Gros œuvre, Électricité…)"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
          />
          <button
            onClick={handleAddLot}
            disabled={saving || !newCorpsEtat.trim()}
            className="px-3 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-40"
          >
            {saving ? '…' : 'Ajouter'}
          </button>
          <button onClick={() => setAddingLot(false)} className="p-2 text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAddingLot(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Ajouter un lot
        </button>
      )}
    </div>
  )
}

function LotCard({ lot, projet, onRefresh }: { lot: Lot; projet: ProjetEco; onRefresh: () => void }) {
  const [expanded,         setExpanded]         = useState(false)
  const [noticeTechnique,  setNoticeTechnique]  = useState(lot.notice_technique ?? '')
  const [budgetPrevu,      setBudgetPrevu]       = useState(String(lot.budget_prevu ?? ''))
  const [generating,       setGenerating]        = useState(false)
  const [saving,           setSaving]            = useState(false)

  const STATUT_COLORS: Record<string, string> = {
    en_attente:   'bg-gray-100 text-gray-600',
    consultation: 'bg-blue-100 text-blue-700',
    negociation:  'bg-amber-100 text-amber-700',
    retenu:       'bg-emerald-100 text-emerald-700',
    en_cours:     'bg-green-100 text-green-700',
    termine:      'bg-gray-100 text-gray-500',
  }

  async function handleGenerate() {
    if (!lot.notice_commerciale) return
    setGenerating(true)
    const res = await fetch('/api/generate-notice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notice_commerciale: lot.notice_commerciale,
        type_chantier:      projet.type_chantier,
        surface_m2:         projet.surface_m2,
        corps_etat:         lot.corps_etat,
      }),
    })
    const { notice_technique } = await res.json()
    if (notice_technique) setNoticeTechnique(notice_technique)
    setGenerating(false)
  }

  async function handleSave() {
    setSaving(true)
    await updateLot(lot.id, {
      notice_technique: noticeTechnique || null,
      budget_prevu:     budgetPrevu ? parseFloat(budgetPrevu) : null,
    })
    onRefresh()
    setSaving(false)
  }

  async function handleFaisabilite() {
    if (!projet.co_id) return
    await submitFaisabilite(projet.id, lot.id, `LOT ${String(lot.numero).padStart(2, '0')} — ${lot.corps_etat}`, projet.co_id)
    alert('Demande de validation faisabilité envoyée au CO.')
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* En-tête lot */}
      <div
        className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-semibold text-gray-400">
            LOT {String(lot.numero).padStart(2, '0')}
          </span>
          <span className="text-sm font-medium text-gray-900">{lot.corps_etat}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUT_COLORS[lot.statut] ?? 'bg-gray-100 text-gray-600'}`}>
            {lot.statut.replace('_', ' ')}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {lot.budget_prevu && (
            <span className="text-sm font-semibold text-gray-700">{formatCurrency(lot.budget_prevu)}</span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Notice commerciale (lecture seule) */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Notice commerciale
              </p>
              <div className="bg-gray-50 rounded-lg border border-gray-100 p-3 min-h-[100px] text-sm text-gray-600 whitespace-pre-line">
                {lot.notice_commerciale || <span className="text-gray-300 italic">Vide</span>}
              </div>
            </div>

            {/* Flèche IA */}
            <div className="flex flex-col">
              <div className="hidden lg:flex items-center gap-2 mb-2 ml-[-32px]">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 bg-white px-2 flex items-center gap-1 whitespace-nowrap">
                  <Sparkles className="w-3 h-3 text-gray-400" /> IA traduit
                </span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* Notice technique */}
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Notice technique / <Abbr k="CCTP" />
              </p>
              <textarea
                value={noticeTechnique}
                onChange={(e) => setNoticeTechnique(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none"
                placeholder="Notice technique CCTP…"
              />
              {!noticeTechnique && lot.notice_commerciale && (
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="mt-2 inline-flex items-center gap-2 text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40"
                >
                  <Sparkles className="w-3 h-3" />
                  {generating ? 'Génération en cours…' : 'Générer avec l\'IA'}
                </button>
              )}
            </div>
          </div>

          {/* Budget + actions */}
          <div className="flex items-end justify-between gap-4 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Budget prévu <Abbr k="HT" /> (€)</label>
                <input
                  type="number"
                  value={budgetPrevu}
                  onChange={(e) => setBudgetPrevu(e.target.value)}
                  className="w-40 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                  placeholder="0"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleFaisabilite}
                disabled={!projet.co_id}
                className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40"
              >
                Soumettre faisabilité au <Abbr k="CO" />
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-40 flex items-center gap-1.5"
              >
                <Check className="w-3 h-3" />
                {saving ? '…' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// ONGLET 4 — AVENANTS
// ═══════════════════════════════════════════════════════════════════════════════

function TabAvenants({ projet, userId, onRefresh }: { projet: ProjetEco; userId: string; onRefresh: () => void }) {
  const [showAdd,  setShowAdd]  = useState(false)
  const [desc,     setDesc]     = useState('')
  const [saving,   setSaving]   = useState(false)

  const STATUT_LABELS: Record<string, React.ReactNode> = {
    ouvert:         'Ouvert',
    chiffre:        'Chiffré',
    valide_co:      <>Validé <Abbr k="CO" /></>,
    valide_client:  'Validé client',
    refuse:         'Refusé',
  }

  const STATUT_COLORS: Record<string, string> = {
    ouvert:         'bg-amber-100 text-amber-700',
    chiffre:        'bg-blue-100 text-blue-700',
    valide_co:      'bg-emerald-100 text-emerald-700',
    valide_client:  'bg-green-100 text-green-700',
    refuse:         'bg-red-100 text-red-700',
  }

  async function handleCreate() {
    if (!desc.trim()) return
    setSaving(true)
    await createAvenant(projet.id, desc.trim(), userId)
    onRefresh()
    setDesc('')
    setShowAdd(false)
    setSaving(false)
  }

  async function handleSoumettreCO(aven: Avenant, montant: string) {
    if (!projet.co_id) return
    await updateAvenant(aven.id, { statut: 'chiffre', montant_ht: montant ? parseFloat(montant) : null })
    const supabase = createClient()
    await supabase.schema('app').from('alertes').insert({
      projet_id:      projet.id,
      utilisateur_id: projet.co_id,
      type:           'avenant_soumis',
      titre:          `Avenant AVN-${String(aven.numero).padStart(2, '0')} à valider`,
      message:        `Montant : ${montant ? formatCurrency(parseFloat(montant)) : '?'} HT`,
      priorite:       'high',
      lue:            false,
    })
    onRefresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">{projet.avenants.length} avenant{projet.avenants.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Ouvrir un avenant
        </button>
      </div>

      {projet.avenants.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <GitBranch className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700">Aucun avenant</p>
        </div>
      ) : (
        <div className="space-y-3">
          {projet.avenants.map((a) => (
            <AvenantCard key={a.id} avenant={a} onSoumettre={handleSoumettreCO} />
          ))}
        </div>
      )}

      {/* Budget impact */}
      {projet.avenants.length > 0 && (
        <Section title="Impact sur le budget">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">Total avenants chiffrés</p>
            <p className="text-sm font-semibold text-gray-900">
              {formatCurrency(
                projet.avenants
                  .filter((a) => a.montant_ht && ['chiffre', 'valide_co', 'valide_client'].includes(a.statut))
                  .reduce((s, a) => s + (a.montant_ht ?? 0), 0)
              )} <Abbr k="HT" />
            </p>
          </div>
        </Section>
      )}

      {/* Modal création */}
      {showAdd && (
        <Modal title="Ouvrir un cycle avenant" onClose={() => setShowAdd(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Description *</label>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none"
                placeholder="Nature de l'avenant, travaux concernés…"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={saving || !desc.trim()} className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-40">
                {saving ? '…' : 'Créer'}
              </button>
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-500">Annuler</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function AvenantCard({ avenant, onSoumettre }: { avenant: Avenant; onSoumettre: (a: Avenant, montant: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [montant,  setMontant]  = useState(String(avenant.montant_ht ?? ''))

  const STEPS: Array<{ key: string; label: React.ReactNode }> = [
    { key: 'ouvert',        label: 'Métrés' },
    { key: 'chiffre',       label: 'Chiffrage' },
    { key: 'valide_co',     label: <>Validation <Abbr k="CO" /></> },
    { key: 'valide_client', label: 'Validation client' },
  ]

  const ORDER = ['ouvert', 'chiffre', 'valide_co', 'valide_client', 'refuse']
  const idx   = ORDER.indexOf(avenant.statut)

  const STATUT_COLORS: Record<string, string> = {
    ouvert: 'bg-amber-100 text-amber-700', chiffre: 'bg-blue-100 text-blue-700',
    valide_co: 'bg-emerald-100 text-emerald-700', valide_client: 'bg-green-100 text-green-700',
    refuse: 'bg-red-100 text-red-700',
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div
        className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-semibold text-gray-400">
            AVN-{String(avenant.numero).padStart(2, '0')}
          </span>
          <p className="text-sm font-medium text-gray-900 truncate max-w-xs">{avenant.description}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUT_COLORS[avenant.statut]}`}>
            {avenant.statut.replace('_', ' ')}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {avenant.montant_ht && <span className="text-sm font-semibold text-gray-700">{formatCurrency(avenant.montant_ht)}</span>}
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-4">
          {/* Workflow */}
          <div className="flex items-center gap-0">
            {STEPS.map((step, i) => {
              const stepIdx = ORDER.indexOf(step.key)
              const done    = idx > stepIdx
              const active  = idx === stepIdx
              return (
                <div key={step.key} className="flex items-center flex-1">
                  <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold flex-shrink-0 ${
                    done ? 'bg-emerald-500 text-white' : active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {done ? <Check className="w-3 h-3" /> : i + 1}
                  </div>
                  <p className={`ml-1 text-xs whitespace-nowrap ${active ? 'text-gray-900 font-medium' : done ? 'text-gray-400' : 'text-gray-300'}`}>
                    {step.label}
                  </p>
                  {i < STEPS.length - 1 && <div className={`flex-1 h-px mx-2 ${done ? 'bg-emerald-300' : 'bg-gray-200'}`} />}
                </div>
              )
            })}
          </div>

          {/* Chiffrage + soumission CO */}
          {avenant.statut === 'ouvert' && (
            <div className="flex items-end gap-3 pt-2">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Montant <Abbr k="HT" /> chiffré (€)</label>
                <input
                  type="number"
                  value={montant}
                  onChange={(e) => setMontant(e.target.value)}
                  className="w-40 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none"
                />
              </div>
              <button
                onClick={() => onSoumettre(avenant, montant)}
                disabled={!montant}
                className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg hover:bg-gray-800 disabled:opacity-40 flex items-center gap-1.5"
              >
                <Send className="w-3 h-3" /> Soumettre au <Abbr k="CO" />
              </button>
            </div>
          )}

          <p className="text-xs text-gray-300">Créé le {formatDate(avenant.created_at)}</p>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ONGLET 5 — ÉQUILIBRE BUDGÉTAIRE
// ═══════════════════════════════════════════════════════════════════════════════

function TabBudget({ projet }: { projet: ProjetEco }) {
  const budgetTotal   = projet.budget_total ?? 0
  const engageST      = projet.lots.reduce((s, l) => s + (l.budget_final ?? l.budget_prevu ?? 0), 0)
  const resteEngager  = budgetTotal - engageST
  const marge         = budgetTotal > 0 ? ((resteEngager / budgetTotal) * 100) : 0
  const margeColor    = marge >= 10 ? 'text-emerald-600' : marge >= 5 ? 'text-amber-600' : 'text-red-600'

  const pct = budgetTotal > 0 ? Math.min((engageST / budgetTotal) * 100, 100) : 0

  return (
    <div className="space-y-5">

      {/* Barre budget global */}
      <Section title="Équilibre budgétaire global">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-0.5">Budget contractuel</p>
              <p className="text-lg font-semibold text-gray-900">{formatCurrency(budgetTotal)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-0.5">Engagé <Abbr k="ST" /></p>
              <p className="text-lg font-semibold text-gray-900">{formatCurrency(engageST)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-0.5">Marge provisoire</p>
              <p className={`text-lg font-semibold ${margeColor}`}>{marge.toFixed(1)}%</p>
              <p className="text-xs text-gray-400">{formatCurrency(resteEngager)}</p>
            </div>
          </div>

          {/* Barre de progression */}
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>0</span>
              <span>{formatCurrency(budgetTotal)}</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${pct > 95 ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">{pct.toFixed(1)}% engagé</p>
          </div>
        </div>
      </Section>

      {/* Tableau par lot */}
      <Section title="Détail par lot">
        {projet.lots.length === 0 ? (
          <p className="text-sm text-gray-400">Aucun lot créé.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Lot', 'Corps d\'état', 'Budget prévu', 'Budget engagé', 'Écart', 'Statut'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projet.lots.map((lot) => {
                  const prevu   = lot.budget_prevu ?? 0
                  const final   = lot.budget_final ?? prevu
                  const ecart   = prevu > 0 ? ((final - prevu) / prevu) * 100 : 0
                  const ecartPct = ecart.toFixed(1)
                  const depasse = ecart > 5
                  return (
                    <tr key={lot.id} className={`border-b border-gray-50 last:border-0 ${depasse ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">LOT {String(lot.numero).padStart(2, '0')}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{lot.corps_etat}</td>
                      <td className="px-4 py-3">{prevu ? formatCurrency(prevu) : '—'}</td>
                      <td className="px-4 py-3">{final ? formatCurrency(final) : '—'}</td>
                      <td className={`px-4 py-3 font-medium text-xs ${depasse ? 'text-red-600' : ecart < 0 ? 'text-emerald-600' : 'text-gray-600'}`}>
                        {prevu ? `${ecart > 0 ? '+' : ''}${ecartPct}%` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          lot.statut === 'retenu' || lot.statut === 'en_cours' || lot.statut === 'termine'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {lot.statut.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Avenants impact */}
      {projet.avenants.some((a) => a.montant_ht) && (
        <Section title="Impact des avenants">
          <div className="space-y-2">
            {projet.avenants.filter((a) => a.montant_ht).map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">AVN-{String(a.numero).padStart(2, '0')} — {a.description.slice(0, 50)}</span>
                <span className="font-semibold text-gray-900">+{formatCurrency(a.montant_ht!)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ONGLET — PRÉVISIONNEL TRAVAUX
// ═══════════════════════════════════════════════════════════════════════════════

type LotPrev = { id: string; nom: string; ordre: number; budget_previsionnel: number; total_ht: number | null }

function PrevisionnelTab({ projetId }: { projetId: string }) {
  const supabase = createClient()
  const [lots, setLots] = useState<LotPrev[]>([])
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('lots')
      .select('id, nom, ordre, budget_previsionnel, total_ht')
      .eq('projet_id', projetId)
      .order('ordre', { ascending: true })
      .then(({ data }) => {
        setLots((data ?? []) as unknown as LotPrev[])
        setLoading(false)
      })
  }, [projetId, supabase])

  async function updateBudget(lotId: string, value: number) {
    setLots((prev) => prev.map((l) => (l.id === lotId ? { ...l, budget_previsionnel: value } : l)))
    await supabase.from('lots').update({ budget_previsionnel: value } as never).eq('id', lotId)
    setSaved(lotId)
    setTimeout(() => setSaved(null), 1200)
  }

  const totalPrev = lots.reduce((s, l) => s + (Number(l.budget_previsionnel) || 0), 0)
  const totalChiffre = lots.reduce((s, l) => s + (Number(l.total_ht) || 0), 0)

  if (loading) return <div className="text-sm text-gray-400 py-10 text-center">Chargement…</div>

  if (lots.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
        <TrendingUp className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm font-semibold text-gray-700">Aucun lot</p>
        <p className="text-xs text-gray-400 mt-1">Créez d'abord des lots dans l'onglet <strong>Lots</strong> pour saisir le prévisionnel.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-[11px] text-gray-500 uppercase tracking-wider">Budget prévisionnel</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1 tabular-nums">{formatCurrency(totalPrev)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-[11px] text-gray-500 uppercase tracking-wider">Total chiffré</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1 tabular-nums">{formatCurrency(totalChiffre)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-[11px] text-gray-500 uppercase tracking-wider">Écart</p>
          <p className={`text-2xl font-semibold mt-1 tabular-nums ${totalPrev > 0 && totalChiffre > totalPrev ? 'text-red-600' : totalPrev > 0 ? 'text-emerald-600' : 'text-gray-900'}`}>
            {totalPrev > 0 ? formatCurrency(totalPrev - totalChiffre) : '—'}
          </p>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs font-medium text-gray-500">
              <th className="px-4 py-2.5">Lot</th>
              <th className="px-4 py-2.5 w-44">Budget prévisionnel <Abbr k="HT" /></th>
              <th className="px-4 py-2.5 w-28 text-right">% du total</th>
              <th className="px-4 py-2.5 w-36 text-right">Chiffré <Abbr k="HT" /></th>
              <th className="px-4 py-2.5 w-28 text-right">Écart</th>
            </tr>
          </thead>
          <tbody>
            {lots.map((l) => {
              const bud = Number(l.budget_previsionnel) || 0
              const chf = Number(l.total_ht) || 0
              const pct = totalPrev > 0 ? (bud / totalPrev * 100) : 0
              const ecart = bud > 0 ? bud - chf : 0
              const ecartPct = bud > 0 ? (ecart / bud * 100) : 0
              return (
                <tr key={l.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-900">{l.nom}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="100"
                        value={bud || ''}
                        onChange={(e) => updateBudget(l.id, parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full px-2 py-1 text-sm text-right tabular-nums border border-gray-200 rounded focus:outline-none focus:border-blue-500"
                      />
                      <span className="text-xs text-gray-400">€</span>
                      {saved === l.id && <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                    {totalPrev > 0 ? `${pct.toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                    {chf > 0 ? formatCurrency(chf) : '—'}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums font-medium ${ecart < 0 ? 'text-red-600' : ecart > 0 ? 'text-emerald-600' : 'text-gray-500'}`}>
                    {bud > 0 && chf > 0 ? `${ecart > 0 ? '+' : ''}${formatCurrency(ecart)} (${ecartPct > 0 ? '+' : ''}${ecartPct.toFixed(1)}%)` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 font-semibold border-t-2 border-gray-200">
              <td className="px-4 py-3 text-gray-900">TOTAL</td>
              <td className="px-4 py-3 text-right tabular-nums text-gray-900">{formatCurrency(totalPrev)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-gray-600">100%</td>
              <td className="px-4 py-3 text-right tabular-nums text-gray-900">{formatCurrency(totalChiffre)}</td>
              <td className={`px-4 py-3 text-right tabular-nums font-semibold ${totalPrev - totalChiffre < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {totalPrev > 0 && totalChiffre > 0 ? formatCurrency(totalPrev - totalChiffre) : '—'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANTS PARTAGÉS
// ═══════════════════════════════════════════════════════════════════════════════

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{title}</p>
      {children}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

function Spinner({ full }: { full?: boolean }) {
  return (
    <div className={`flex items-center justify-center ${full ? 'h-64' : 'h-32'}`}>
      <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
    </div>
  )
}

