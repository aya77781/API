'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ChevronRight, Search, Star, Send, RefreshCw,
  Clock, CheckCircle2, XCircle, Upload, Loader2, Phone,
  Building2, MapPin, Award, FileText, AlertTriangle, Plus,
} from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { useAchats, type STAvecStats, type ConsultationAvecST } from '@/hooks/useAchats'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

/* ── Types ── */

interface Projet { id: string; nom: string; reference: string | null; adresse: string | null; statut: string }
interface Lot { id: string; numero: number; corps_etat: string; statut: string; st_retenu_id: string | null; budget_prevu: number | null }

type Step = 'projet' | 'lot' | 'recommandations' | 'suivi'

const STATUT_LABELS: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  a_contacter:    { label: 'À contacter',    color: 'text-gray-500 bg-gray-100',     icon: Clock },
  contacte:       { label: 'Contacté',       color: 'text-blue-600 bg-blue-50',      icon: Phone },
  devis_demande:  { label: 'Devis demandé',  color: 'text-amber-600 bg-amber-50',    icon: Send },
  devis_recu:     { label: 'Devis reçu',     color: 'text-emerald-600 bg-emerald-50', icon: FileText },
  refuse:         { label: 'Refusé',         color: 'text-red-500 bg-red-50',        icon: XCircle },
  attribue:       { label: 'Attribué',       color: 'text-emerald-700 bg-emerald-100', icon: CheckCircle2 },
}

/* ── Component ── */

export function AchatsFlow() {
  const { user, profil } = useUser()
  const {
    loading: achatsLoading, error: achatsError, clearError,
    searchSTs, getConsultations, addConsultation,
    updateStatutConsultation, demanderDevis, attribuerLot, calcScoreIA,
  } = useAchats()
  const supabase = createClient()

  /* ── State ── */
  const [step, setStep] = useState<Step>('projet')

  // Step 1: Projet
  const [projets, setProjets] = useState<Projet[]>([])
  const [projetsLoading, setProjetsLoading] = useState(true)
  const [selectedProjet, setSelectedProjet] = useState<Projet | null>(null)

  // Step 2: Lot
  const [lots, setLots] = useState<Lot[]>([])
  const [lotsLoading, setLotsLoading] = useState(false)
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null)

  // Step 3: Recommandations ST
  const [recommandations, setRecommandations] = useState<STAvecStats[]>([])
  const [recoLoading, setRecoLoading] = useState(false)
  const [selectedSTs, setSelectedSTs] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)

  // Step 4: Suivi consultations
  const [consultations, setConsultations] = useState<ConsultationAvecST[]>([])
  const [consultLoading, setConsultLoading] = useState(false)

  // Create lot form
  const [showNewLot, setShowNewLot] = useState(false)
  const [newLotCorpsEtat, setNewLotCorpsEtat] = useState('')
  const [newLotBudget, setNewLotBudget] = useState('')
  const [creatingLot, setCreatingLot] = useState(false)

  // Deposit devis modal
  const [depositTarget, setDepositTarget] = useState<ConsultationAvecST | null>(null)
  const [depositMontant, setDepositMontant] = useState('')
  const [depositDelai, setDepositDelai] = useState('')
  const [depositFile, setDepositFile] = useState<File | null>(null)
  const [depositing, setDepositing] = useState(false)

  /* ── Load projets ── */
  useEffect(() => {
    if (!user) return
    supabase.schema('app').from('projets')
      .select('id, nom, reference, adresse, statut')
      .or(`co_id.eq.${user.id},economiste_id.eq.${user.id},commercial_id.eq.${user.id}`)
      .order('nom')
      .then(({ data }) => { setProjets(data ?? []); setProjetsLoading(false) })
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Load lots when projet selected ── */
  const loadLots = useCallback(async (projetId: string) => {
    setLotsLoading(true)
    const { data } = await supabase.schema('app').from('lots')
      .select('id, numero, corps_etat, statut, st_retenu_id, budget_prevu')
      .eq('projet_id', projetId)
      .order('numero')
    setLots(data ?? [])
    setLotsLoading(false)
  }, [supabase])

  /* ── Load recommandations ── */
  const loadRecommandations = useCallback(async (lot: Lot, projet: Projet) => {
    setRecoLoading(true)
    // Extract departement from project address if available
    const dept = projet.adresse?.match(/\b(\d{2})\d{3}\b/)?.[1] ?? undefined
    const results = await searchSTs({
      lot_type: lot.corps_etat,
      departement: dept,
      statut: 'actif',
    })
    setRecommandations(results.slice(0, 10)) // Show top 10, recommend top 3
    setSelectedSTs(new Set(results.slice(0, 3).map(s => s.id))) // Pre-select top 3
    setRecoLoading(false)
  }, [searchSTs])

  /* ── Load consultations ── */
  const loadConsultations = useCallback(async () => {
    if (!selectedProjet || !selectedLot) return
    setConsultLoading(true)
    const data = await getConsultations(selectedProjet.id, selectedLot.id)
    setConsultations(data ?? [])
    setConsultLoading(false)
  }, [selectedProjet, selectedLot, getConsultations])

  /* ── Actions ── */

  function selectProjet(p: Projet) {
    setSelectedProjet(p)
    setSelectedLot(null)
    setStep('lot')
    loadLots(p.id)
  }

  function selectLot(l: Lot) {
    setSelectedLot(l)
    if (!selectedProjet) return
    // If lot already has consultations, go to suivi
    getConsultations(selectedProjet.id, l.id).then(existing => {
      if (existing && existing.length > 0) {
        setConsultations(existing)
        setStep('suivi')
      } else {
        setStep('recommandations')
        loadRecommandations(l, selectedProjet)
      }
    })
  }

  async function handleCreateLot() {
    if (!selectedProjet || !newLotCorpsEtat.trim()) return
    setCreatingLot(true)

    const nextNumero = lots.length > 0 ? Math.max(...lots.map(l => l.numero)) + 1 : 1
    const budget = newLotBudget ? parseFloat(newLotBudget) : null

    const { data, error: insertErr } = await supabase.schema('app').from('lots')
      .insert({
        projet_id: selectedProjet.id,
        numero: nextNumero,
        corps_etat: newLotCorpsEtat.trim(),
        budget_prevu: budget,
        statut: 'en_attente',
      })
      .select('id, numero, corps_etat, statut, st_retenu_id, budget_prevu')
      .single()

    if (!insertErr && data) {
      setLots(prev => [...prev, data as Lot])
      setNewLotCorpsEtat('')
      setNewLotBudget('')
      setShowNewLot(false)
    }
    setCreatingLot(false)
  }

  function toggleST(id: string) {
    setSelectedSTs(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleEnvoyerDemandes() {
    if (!selectedProjet || !selectedLot || !user || selectedSTs.size === 0) return
    setSending(true)

    for (const stId of Array.from(selectedSTs)) {
      // Create consultation
      const consult = await addConsultation(selectedProjet.id, selectedLot.id, stId)
      if (!consult) continue

      // Send devis request
      await demanderDevis(consult.id)
    }

    setSending(false)
    // Move to suivi
    await loadConsultations()
    setStep('suivi')
  }

  async function handleRelance(consultId: string) {
    await demanderDevis(consultId)
    await loadConsultations()
  }

  async function handleAttribuer(consultId: string) {
    const ok = await attribuerLot(consultId)
    if (ok) await loadConsultations()
  }

  async function handleDepositDevis() {
    if (!depositTarget || !depositMontant || !selectedProjet || !selectedLot || !user || !profil) return
    setDepositing(true)

    const montant = parseFloat(depositMontant)
    const delai = depositDelai ? parseInt(depositDelai) : null

    // Calculate score
    let score: number | null = null
    if (montant > 0 && delai && delai > 0) {
      score = await calcScoreIA(montant, delai, selectedLot.id)
    }

    // Update consultation
    await updateStatutConsultation(depositTarget.id, 'devis_recu', {
      montant_devis: montant,
      delai_propose: delai,
      score_ia: score,
      devis_recu_at: new Date().toISOString(),
    })

    // Upload file if provided
    if (depositFile) {
      const ext = depositFile.name.split('.').pop() ?? 'pdf'
      const path = `${selectedProjet.id}/devis/${Date.now()}_${depositTarget.st_id}.${ext}`
      await supabase.storage.from('projets').upload(path, depositFile, { upsert: false })
    }

    setDepositTarget(null)
    setDepositMontant('')
    setDepositDelai('')
    setDepositFile(null)
    setDepositing(false)
    await loadConsultations()
  }

  function daysSince(dateStr: string | null): number | null {
    if (!dateStr) return null
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
  }

  /* ── Render ── */

  return (
    <div className="space-y-5">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <button onClick={() => { setStep('projet'); setSelectedProjet(null); setSelectedLot(null) }}
          className={cn('hover:text-gray-700 transition-colors', step === 'projet' && 'text-gray-900 font-semibold')}>
          Projet
        </button>
        {selectedProjet && (
          <>
            <ChevronRight className="w-3 h-3" />
            <button onClick={() => { setStep('lot'); setSelectedLot(null) }}
              className={cn('hover:text-gray-700 transition-colors', step === 'lot' && 'text-gray-900 font-semibold')}>
              {selectedProjet.nom}
            </button>
          </>
        )}
        {selectedLot && (
          <>
            <ChevronRight className="w-3 h-3" />
            <span className={cn(step === 'recommandations' || step === 'suivi' ? 'text-gray-900 font-semibold' : '')}>
              Lot {selectedLot.numero} — {selectedLot.corps_etat}
            </span>
          </>
        )}
      </div>

      {achatsError && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {achatsError}
          <button onClick={clearError} className="ml-auto text-red-500 hover:text-red-700 text-xs font-medium">Fermer</button>
        </div>
      )}

      {/* ─── STEP 1: Sélection projet ─── */}
      {step === 'projet' && (
        <div className="space-y-2">
          {projetsLoading ? (
            [1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)
          ) : projets.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 shadow-card p-10 text-center">
              <p className="text-sm text-gray-500">Aucun projet disponible pour les achats.</p>
            </div>
          ) : (
            projets.map(p => (
              <button key={p.id} onClick={() => selectProjet(p)}
                className="w-full flex items-center gap-4 bg-white rounded-lg border border-gray-200 shadow-card px-5 py-4 hover:border-gray-300 hover:shadow-card-hover transition-all text-left group">
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{p.nom}</p>
                  <p className="text-xs text-gray-400 truncate">{[p.reference, p.adresse].filter(Boolean).join(' · ')}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500" />
              </button>
            ))
          )}
        </div>
      )}

      {/* ─── STEP 2: Sélection lot ─── */}
      {step === 'lot' && (
        <div className="space-y-3">
          {lotsLoading ? (
            [1, 2, 3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />)
          ) : (
            <>
              {lots.length > 0 && (
                <div className="space-y-2">
                  {lots.map(l => {
                    const hasSTRetenu = !!l.st_retenu_id
                    return (
                      <button key={l.id} onClick={() => selectLot(l)} disabled={hasSTRetenu}
                        className={cn(
                          'w-full flex items-center gap-4 bg-white rounded-lg border border-gray-200 shadow-card px-5 py-3.5 text-left transition-all group',
                          hasSTRetenu ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-300 hover:shadow-card-hover',
                        )}>
                        <span className="w-8 h-8 rounded-lg bg-gray-900 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {l.numero}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{l.corps_etat}</p>
                          <p className="text-xs text-gray-400">
                            {hasSTRetenu ? 'ST déjà attribué' : l.budget_prevu ? `Budget : ${l.budget_prevu.toLocaleString('fr-FR')} €` : 'Budget non défini'}
                          </p>
                        </div>
                        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide px-2 py-0.5 bg-gray-100 rounded">
                          {l.statut.replace('_', ' ')}
                        </span>
                        {!hasSTRetenu && <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500" />}
                      </button>
                    )
                  })}
                </div>
              )}

              {lots.length === 0 && !showNewLot && (
                <div className="bg-white rounded-lg border border-gray-200 shadow-card p-8 text-center">
                  <p className="text-sm text-gray-500">Aucun lot sur ce projet.</p>
                  <p className="text-xs text-gray-400 mt-1">Créez un premier lot pour lancer la consultation.</p>
                </div>
              )}

              {/* New lot form */}
              {showNewLot ? (
                <div className="bg-white rounded-lg border border-gray-200 shadow-card p-5 space-y-3">
                  <p className="text-sm font-semibold text-gray-900">Nouveau lot</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Corps d&apos;état *</label>
                      <select value={newLotCorpsEtat} onChange={e => setNewLotCorpsEtat(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white">
                        <option value="">Sélectionner un lot...</option>
                        <option value="Démolition">01 - Démolition</option>
                        <option value="Maçonnerie / Cloisons">02 - Maçonnerie / Cloisons</option>
                        <option value="Menuiseries intérieures">03 - Menuiseries intérieures</option>
                        <option value="Menuiseries extérieures">04 - Menuiseries extérieures</option>
                        <option value="Revêtements de sols">05 - Revêtements de sols</option>
                        <option value="Revêtements muraux">06 - Revêtements muraux</option>
                        <option value="Faux-plafonds">07 - Faux-plafonds</option>
                        <option value="Peinture">08 - Peinture</option>
                        <option value="Électricité CFO/CFA">09 - Électricité CFO/CFA</option>
                        <option value="Plomberie / Sanitaires">10 - Plomberie / Sanitaires</option>
                        <option value="CVC">11 - CVC (Chauffage / Ventilation / Climatisation)</option>
                        <option value="Désenfumage">12 - Désenfumage</option>
                        <option value="Serrurerie / Métallerie">13 - Serrurerie / Métallerie</option>
                        <option value="Signalétique">14 - Signalétique</option>
                        <option value="Nettoyage">15 - Nettoyage</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Budget prévisionnel (€)</label>
                      <input type="number" value={newLotBudget} onChange={e => setNewLotBudget(e.target.value)}
                        placeholder="Ex: 50000"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={handleCreateLot} disabled={!newLotCorpsEtat.trim() || creatingLot}
                      className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                      {creatingLot ? 'Création...' : 'Créer le lot'}
                    </button>
                    <button onClick={() => { setShowNewLot(false); setNewLotCorpsEtat(''); setNewLotBudget('') }}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowNewLot(true)}
                  className="w-full px-4 py-2.5 bg-white border border-dashed border-gray-300 rounded-lg text-xs font-medium text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors flex items-center justify-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  Nouveau lot
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── STEP 3: Recommandations ST ─── */}
      {step === 'recommandations' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 shadow-card">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">
                Sous-traitants recommandés — {selectedLot?.corps_etat}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">Les 3 meilleurs sont pré-sélectionnés. Modifiez si besoin.</p>
            </div>

            {recoLoading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-6 h-6 text-gray-400 animate-spin mx-auto mb-2" />
                <p className="text-xs text-gray-500">Recherche des meilleurs ST...</p>
              </div>
            ) : recommandations.length === 0 ? (
              <div className="p-8 text-center">
                <Search className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Aucun sous-traitant trouvé pour ce corps d&apos;état.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {recommandations.map((st, idx) => {
                  const checked = selectedSTs.has(st.id)
                  const isTop3 = idx < 3
                  return (
                    <label key={st.id}
                      className={cn(
                        'flex items-center gap-4 px-5 py-3.5 cursor-pointer transition-colors',
                        checked ? 'bg-gray-50' : 'hover:bg-gray-50/50',
                      )}>
                      <input type="checkbox" checked={checked} onChange={() => toggleST(st.id)}
                        className="rounded border-gray-300 text-gray-900" />

                      {isTop3 && (
                        <span className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                          idx === 0 ? 'bg-amber-100 text-amber-700' :
                          idx === 1 ? 'bg-gray-200 text-gray-600' :
                          'bg-orange-100 text-orange-600',
                        )}>
                          {idx + 1}
                        </span>
                      )}
                      {!isTop3 && <span className="w-6" />}

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{st.raison_sociale}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          {st.ville && (
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                              <MapPin className="w-3 h-3" />{st.ville}{st.departement ? ` (${st.departement})` : ''}
                            </span>
                          )}
                          {st.nb_chantiers_realises > 0 && (
                            <span className="text-xs text-gray-400">{st.nb_chantiers_realises} chantier{st.nb_chantiers_realises > 1 ? 's' : ''}</span>
                          )}
                        </div>
                      </div>

                      {st.note_moyenne != null ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-amber-600">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          {st.note_moyenne.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-300">Pas de note</span>
                      )}

                      {st.agrement === 'agree' && (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                          <Award className="w-3 h-3" />Agréé
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {/* Send button */}
          {recommandations.length > 0 && (
            <button onClick={handleEnvoyerDemandes} disabled={sending || selectedSTs.size === 0}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {sending ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Envoi des demandes...</>
              ) : (
                <><Send className="w-4 h-4" />Envoyer les demandes de devis ({selectedSTs.size})</>
              )}
            </button>
          )}
        </div>
      )}

      {/* ─── STEP 4: Suivi des consultations ─── */}
      {step === 'suivi' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              Suivi des consultations — Lot {selectedLot?.numero} {selectedLot?.corps_etat}
            </h3>
            <button onClick={loadConsultations}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 transition-colors">
              <RefreshCw className="w-3 h-3" />Actualiser
            </button>
          </div>

          {consultLoading ? (
            [1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />)
          ) : consultations.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 shadow-card p-8 text-center">
              <p className="text-sm text-gray-500">Aucune consultation en cours.</p>
              <button onClick={() => { setStep('recommandations'); if (selectedLot && selectedProjet) loadRecommandations(selectedLot, selectedProjet) }}
                className="mt-3 text-xs text-gray-900 font-medium underline">
                Ajouter des ST
              </button>
            </div>
          ) : (
            consultations.map(c => {
              const cfg = STATUT_LABELS[c.statut] ?? STATUT_LABELS['a_contacter']
              const Icon = cfg.icon
              const days = daysSince(c.email_envoye_at)
              const needsRelance = c.statut === 'devis_demande' && days != null && days >= 3

              return (
                <div key={c.id} className="bg-white rounded-lg border border-gray-200 shadow-card px-5 py-4">
                  <div className="flex items-center gap-3">
                    {/* ST info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {c.sous_traitant?.raison_sociale ?? 'ST inconnu'}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded', cfg.color)}>
                          <Icon className="w-3 h-3" />{cfg.label}
                        </span>
                        {c.email_envoye_at && (
                          <span className="text-[10px] text-gray-400">
                            Envoyé il y a {days}j
                          </span>
                        )}
                        {c.score_ia != null && (
                          <span className="text-xs font-medium text-blue-600">Score IA : {c.score_ia}/100</span>
                        )}
                      </div>
                    </div>

                    {/* Montant if devis reçu */}
                    {c.montant_devis != null && (
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-gray-900">{c.montant_devis.toLocaleString('fr-FR')} €</p>
                        {c.delai_propose && <p className="text-[10px] text-gray-400">{c.delai_propose} jours</p>}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-3">
                    {/* Relance */}
                    {(c.statut === 'devis_demande' || c.statut === 'contacte') && (
                      <button onClick={() => handleRelance(c.id)} disabled={achatsLoading}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                          needsRelance
                            ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50',
                        )}>
                        <RefreshCw className="w-3 h-3" />
                        {needsRelance ? 'Relancer (3j+)' : 'Relancer'}
                      </button>
                    )}

                    {/* Deposit devis */}
                    {(c.statut === 'devis_demande' || c.statut === 'contacte') && (
                      <button onClick={() => setDepositTarget(c)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-600 border border-gray-200 rounded-md text-xs font-medium hover:bg-gray-50 transition-colors">
                        <Upload className="w-3 h-3" />Devis reçu
                      </button>
                    )}

                    {/* Attribuer */}
                    {c.statut === 'devis_recu' && !c.attribue && (
                      <button onClick={() => handleAttribuer(c.id)} disabled={achatsLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-md text-xs font-semibold hover:bg-gray-800 transition-colors">
                        <CheckCircle2 className="w-3 h-3" />Attribuer ce lot
                      </button>
                    )}

                    {/* Phone */}
                    {c.sous_traitant?.telephone && (
                      <a href={`tel:${c.sous_traitant.telephone}`}
                        className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors ml-auto">
                        <Phone className="w-3 h-3" />{c.sous_traitant.telephone}
                      </a>
                    )}
                  </div>
                </div>
              )
            })
          )}

          {/* Add more STs */}
          <button onClick={() => { setStep('recommandations'); if (selectedLot && selectedProjet) loadRecommandations(selectedLot, selectedProjet) }}
            className="w-full px-4 py-2.5 bg-white border border-dashed border-gray-300 rounded-lg text-xs font-medium text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors">
            + Ajouter d&apos;autres sous-traitants
          </button>
        </div>
      )}

      {/* ─── Modal: Déposer un devis reçu ─── */}
      {depositTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Déposer un devis</h2>
                <p className="text-xs text-gray-400 mt-0.5">{depositTarget.sous_traitant?.raison_sociale}</p>
              </div>
              <button onClick={() => { setDepositTarget(null); setDepositFile(null) }}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <XCircle className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Montant HT (€) *</label>
                <input type="number" value={depositMontant} onChange={e => setDepositMontant(e.target.value)}
                  placeholder="Ex: 45000" step="0.01"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Délai proposé (jours)</label>
                <input type="number" value={depositDelai} onChange={e => setDepositDelai(e.target.value)}
                  placeholder="Ex: 30"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Fichier devis (PDF)</label>
                <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx"
                  onChange={e => setDepositFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200" />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 pb-5">
              <button onClick={() => { setDepositTarget(null); setDepositFile(null) }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Annuler
              </button>
              <button onClick={handleDepositDevis} disabled={!depositMontant || depositing}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {depositing ? 'Enregistrement...' : 'Enregistrer le devis'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
