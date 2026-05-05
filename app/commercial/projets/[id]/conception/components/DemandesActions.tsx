'use client'

import { useState, useTransition } from 'react'
import { Pencil, Calculator, X, AlertCircle, Loader2, Clock, Send } from 'lucide-react'
import { creerDemande } from '@/app/_actions/conception'
import {
  type DemandeConception,
  type Proposition,
  planTypeForVersion,
  chiffrageTypeForVersion,
  type Version,
  isPlanType,
  isChiffrageType,
} from '@/lib/conception/types'

type Utilisateur = { id: string; prenom: string; nom: string; role: string }

export function DemandesActions({
  projetId,
  briefRempli,
  dessinatrices,
  economistes,
  dessinatriceProjetId,
  economisteProjetId,
  demandes,
  propositions,
}: {
  projetId: string
  briefRempli: boolean
  dessinatrices: Utilisateur[]
  economistes: Utilisateur[]
  dessinatriceProjetId: string | null
  economisteProjetId: string | null
  demandes: DemandeConception[]
  propositions: Proposition[]
}) {
  const [openModal, setOpenModal] = useState<'plan' | 'chiffrage' | null>(null)
  const propActive = propositions.find(p => !p.is_archived) ?? null
  const versionActive = (propActive?.numero ?? 1) as Version
  const apdAcceptee = propositions.some(p => p.type === 'finale' && p.verrouillee_apres_signature)

  // Demande en cours du même type ?
  const demandePlanEnCours = demandes.find(d =>
    isPlanType(d.type) &&
    d.version === versionActive &&
    (d.statut === 'en_attente' || d.statut === 'en_cours')
  )
  const demandeChiffrageEnCours = demandes.find(d =>
    isChiffrageType(d.type) &&
    d.version === versionActive &&
    (d.statut === 'en_attente' || d.statut === 'en_cours')
  )

  return (
    <>
      {!briefRempli && (
        <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            Renseignez au moins le besoin et le budget évoqué dans le brief avant de lancer une demande.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ActionCard
          icon={<Pencil className="w-5 h-5" />}
          tone="violet"
          title="Demander un plan"
          subtitle="Dessinatrice"
          version={versionActive}
          enCours={demandePlanEnCours}
          disabled={!briefRempli || !!demandePlanEnCours}
          onClick={() => setOpenModal('plan')}
        />
        <ActionCard
          icon={<Calculator className="w-5 h-5" />}
          tone="emerald"
          title="Demander une estimation"
          subtitle="Économiste"
          version={versionActive}
          enCours={demandeChiffrageEnCours}
          disabled={!briefRempli || !!demandeChiffrageEnCours}
          onClick={() => setOpenModal('chiffrage')}
        />
      </div>

      {openModal && (
        <DemandeModal
          mode={openModal}
          projetId={projetId}
          version={versionActive}
          propositions={propositions}
          apdAcceptee={apdAcceptee}
          dessinatrices={dessinatrices}
          economistes={economistes}
          defaultDessinatriceId={dessinatriceProjetId}
          defaultEconomisteId={economisteProjetId}
          onClose={() => setOpenModal(null)}
        />
      )}
    </>
  )
}

function ActionCard({
  icon, tone, title, subtitle, version, enCours, disabled, onClick,
}: {
  icon: React.ReactNode
  tone: 'violet' | 'emerald'
  title: string
  subtitle: string
  version: Version
  enCours?: DemandeConception
  disabled: boolean
  onClick: () => void
}) {
  const toneCls = tone === 'violet'
    ? 'bg-violet-50 border-violet-200 hover:border-violet-400 text-violet-700'
    : 'bg-emerald-50 border-emerald-200 hover:border-emerald-400 text-emerald-700'
  const iconCls = tone === 'violet' ? 'bg-violet-100 text-violet-600' : 'bg-emerald-100 text-emerald-600'

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative text-left bg-white border-2 rounded-xl p-4 transition-all ${
        disabled ? 'border-gray-200 opacity-60 cursor-not-allowed' : toneCls
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${iconCls}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">{title}</p>
          <p className="text-xs text-gray-500">{subtitle} · Version V{version}</p>
          {enCours && (
            <span className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
              <Clock className="w-3 h-3" /> En attente de livraison
            </span>
          )}
        </div>
        {!disabled && <Send className="w-4 h-4 text-gray-400" />}
      </div>
    </button>
  )
}

function DemandeModal({
  mode, projetId, version, propositions, apdAcceptee,
  dessinatrices, economistes,
  defaultDessinatriceId, defaultEconomisteId, onClose,
}: {
  mode: 'plan' | 'chiffrage'
  projetId: string
  version: Version
  propositions: Proposition[]
  apdAcceptee: boolean
  dessinatrices: Utilisateur[]
  economistes: Utilisateur[]
  defaultDessinatriceId: string | null
  defaultEconomisteId: string | null
  onClose: () => void
}) {
  const candidats = mode === 'plan' ? dessinatrices : economistes
  const defaultId = mode === 'plan' ? defaultDessinatriceId : defaultEconomisteId
  const [destinataireId, setDestinataireId] = useState<string>(defaultId ?? candidats[0]?.id ?? '')

  // Liste des versions existantes (non archivées + archivées) — dédupliquées
  const versionsExistantes = Array.from(new Set(propositions.map(p => p.numero))).sort((a, b) => a - b)
  const maxExistante = versionsExistantes.length ? Math.max(...versionsExistantes) : 0
  // Versions proposées : toutes les existantes + 1 suivante (sauf si APD verrouillée)
  const versionsProposables = apdAcceptee
    ? versionsExistantes
    : Array.from(new Set([...versionsExistantes, Math.max(maxExistante, 0) + 1])).sort((a, b) => a - b)
  const [chosenVersion, setChosenVersion] = useState<Version>(version || 1)
  const [chosenIsAPD, setChosenIsAPD] = useState<boolean>(false)
  const [message, setMessage] = useState('')
  const [dateLimite, setDateLimite] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function envoyer() {
    setError(null)
    if (!destinataireId) { setError('Choisir un destinataire'); return }
    startTransition(async () => {
      try {
        await creerDemande({
          projetId,
          type: mode === 'plan' ? planTypeForVersion(chosenVersion, chosenIsAPD) : chiffrageTypeForVersion(chosenVersion, chosenIsAPD),
          version: chosenVersion,
          isAPD: chosenIsAPD,
          destinataireId,
          message: message || undefined,
          dateLimite: dateLimite || null,
        })
        onClose()
      } catch (e) {
        setError((e as Error).message)
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              {mode === 'plan' ? 'Demander un plan' : 'Demander une estimation'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {mode === 'plan' ? 'Dessinatrice' : 'Économiste'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Version</label>
            <div className="flex flex-wrap gap-2">
              {versionsProposables.map(v => {
                const isSelected = !chosenIsAPD && chosenVersion === v
                const exists = versionsExistantes.includes(v)
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => { setChosenIsAPD(false); setChosenVersion(v) }}
                    className={`min-w-14 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      isSelected
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    V{v}{!exists && <span className="ml-1 text-xs opacity-60">+</span>}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => setChosenIsAPD(true)}
                disabled={apdAcceptee}
                className={`min-w-14 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  chosenIsAPD
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white text-violet-700 border-violet-200 hover:border-violet-400'
                } ${apdAcceptee ? 'opacity-40 cursor-not-allowed' : ''}`}
                title={apdAcceptee ? 'APD déjà signé' : 'Version APD finale signable'}
              >
                APD
              </button>
            </div>
            {chosenIsAPD ? (
              <p className="text-xs text-violet-700 mt-2">
                Version finale signable : sera attachée à la proposition V{chosenVersion}.
              </p>
            ) : (
              <p className="text-xs text-gray-400 mt-2">
                {versionsExistantes.includes(chosenVersion)
                  ? 'Cette version existe déjà — la demande s\'y attachera.'
                  : 'Nouvelle version à créer.'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              {mode === 'plan' ? 'Dessinatrice destinataire' : 'Économiste destinataire'}
            </label>
            <select
              value={destinataireId}
              onChange={e => setDestinataireId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              <option value="">Choisir…</option>
              {candidats.map(u => (
                <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Date souhaitée</label>
            <input
              type="date"
              value={dateLimite}
              onChange={e => setDateLimite(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Message (optionnel)</label>
            <textarea
              rows={3}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Précisions, points d'attention…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none placeholder-gray-300"
            />
          </div>

          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
          <button
            onClick={envoyer}
            disabled={pending || !destinataireId}
            className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-700 disabled:opacity-40"
          >
            {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Envoyer la demande
          </button>
        </div>
      </div>
    </div>
  )
}
