'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  ChevronRight, Search, Star, Send, RefreshCw,
  Clock, CheckCircle2, XCircle, Upload, Loader2, Phone, Mail,
  Building2, MapPin, Award, FileText, AlertTriangle, Plus,
  Globe, ExternalLink, UserPlus, X, Users, Save,
} from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { useAchats, type STAvecStats, type ConsultationAvecST } from '@/hooks/useAchats'
import { UserTagPicker, type TaggedUser } from '@/components/shared/UserTagPicker'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

/* ── Types ── */

interface Projet { id: string; nom: string; reference: string | null; adresse: string | null; statut: string }
interface Lot { id: string; numero: number; corps_etat: string; statut: string; st_retenu_id: string | null; budget_prevu: number | null }

interface Suggestion {
  id: string
  raison_sociale: string
  adresse: string | null
  contact_tel: string | null
  contact_email: string | null
  site_web: string | null
  note_google: number | null
  nb_avis_google: number | null
  lot_corps_etat: string | null
  added?: boolean
}

type Step = 'projet' | 'lot' | 'recommandations' | 'suivi'

const ETAPES_ST = [
  { value: 'a_contacter',       label: 'A contacter',           color: 'text-gray-500 bg-gray-100' },
  { value: 'contacte',          label: 'Contacte',              color: 'text-blue-600 bg-blue-50' },
  { value: 'devis_envoye',      label: 'Devis envoye',          color: 'text-amber-600 bg-amber-50' },
  { value: 'en_attente',        label: 'En attente de reponse', color: 'text-orange-600 bg-orange-50' },
  { value: 'devis_recu',        label: 'Devis recu',            color: 'text-cyan-600 bg-cyan-50' },
  { value: 'en_negociation',    label: 'En negociation',        color: 'text-purple-600 bg-purple-50' },
  { value: 'retenu',            label: 'Retenu',                color: 'text-emerald-700 bg-emerald-100' },
  { value: 'annule',            label: 'Annule',                color: 'text-red-500 bg-red-50' },
]

const STATUT_LABELS: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  a_contacter:   { label: 'A contacter',   color: 'text-gray-500 bg-gray-100',      icon: Clock },
  contacte:      { label: 'Contacte',      color: 'text-blue-600 bg-blue-50',       icon: Phone },
  devis_demande: { label: 'Devis demande', color: 'text-amber-600 bg-amber-50',     icon: Send },
  devis_recu:    { label: 'Devis recu',    color: 'text-emerald-600 bg-emerald-50', icon: FileText },
  refuse:        { label: 'Refuse',        color: 'text-red-500 bg-red-50',         icon: XCircle },
  attribue:      { label: 'Attribue',      color: 'text-emerald-700 bg-emerald-100',icon: CheckCircle2 },
}

function extractVille(adresse: string | null): string {
  if (!adresse) return ''
  const match = adresse.match(/\d{5}\s+(.+?)(?:\s*,|$)/)
  if (match) return match[1].trim()
  const parts = adresse.split(/[,\n]/).map(s => s.trim()).filter(Boolean)
  return parts[parts.length - 1] ?? ''
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

  // Step 3: Recommandations
  const [recommandations, setRecommandations] = useState<STAvecStats[]>([])
  const [recoLoading, setRecoLoading] = useState(false)
  const [selectedSTs, setSelectedSTs] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)

  // Prospection n8n
  const [prospectionLoading, setProspectionLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  // ST etapes tracking
  const [stEtapes, setStEtapes] = useState<Record<string, string>>({})

  // Tag users on ST
  const [taggedUsers, setTaggedUsers] = useState<Record<string, TaggedUser[]>>({})

  // Step 4: Suivi
  const [consultations, setConsultations] = useState<ConsultationAvecST[]>([])
  const [consultLoading, setConsultLoading] = useState(false)

  // Added STs (from prospection, shown in top section with edit/confirm)
  const [addedSTs, setAddedSTs] = useState<(Suggestion & { stId: string; editing: boolean; confirmed?: boolean })[]>([])
  const [editForm, setEditForm] = useState<Record<string, { contact_email: string; contact_tel: string; adresse: string }>>({})
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  // Create lot
  const [showNewLot, setShowNewLot] = useState(false)
  const [newLotCorpsEtat, setNewLotCorpsEtat] = useState('')
  const [newLotBudget, setNewLotBudget] = useState('')
  const [creatingLot, setCreatingLot] = useState(false)

  // Deposit devis
  const [depositTarget, setDepositTarget] = useState<ConsultationAvecST | null>(null)
  const [depositMontant, setDepositMontant] = useState('')
  const [depositDelai, setDepositDelai] = useState('')
  const [depositFile, setDepositFile] = useState<File | null>(null)
  const [depositing, setDepositing] = useState(false)

  const searchParams = useSearchParams()

  /* ── Load projets + auto-select from URL ── */
  useEffect(() => {
    if (!user) return
    supabase.schema('app').from('projets')
      .select('id, nom, reference, adresse, statut')
      .or(`co_id.eq.${user.id},economiste_id.eq.${user.id},commercial_id.eq.${user.id}`)
      .order('nom')
      .then(({ data }) => {
        const list = (data ?? []) as Projet[]
        setProjets(list)
        setProjetsLoading(false)
        // Auto-select project from URL query param
        const projetParam = searchParams.get('projet')
        if (projetParam) {
          const match = list.find(p => p.id === projetParam)
          if (match) {
            setSelectedProjet(match)
            setStep('lot')
            loadLots(match.id)
          }
        }
      })
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Load lots ── */
  const loadLots = useCallback(async (projetId: string) => {
    setLotsLoading(true)
    const { data } = await supabase.schema('app').from('lots')
      .select('id, numero, corps_etat, statut, st_retenu_id, budget_prevu')
      .eq('projet_id', projetId).order('numero')
    setLots(data ?? [])
    setLotsLoading(false)
  }, [supabase])

  /* ── Load recommandations (base interne) ── */
  const loadRecommandations = useCallback(async (lot: Lot, projet: Projet) => {
    setRecoLoading(true)
    const dept = projet.adresse?.match(/\b(\d{2})\d{3}\b/)?.[1] ?? undefined
    const results = await searchSTs({ lot_type: lot.corps_etat, departement: dept, statut: 'actif' })
    setRecommandations(results.slice(0, 10))
    setSelectedSTs(new Set(results.slice(0, 3).map(s => s.id)))
    setRecoLoading(false)

    // Also load existing n8n suggestions
    loadSuggestions(lot.id)
  }, [searchSTs]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Load n8n suggestions from DB ── */
  async function loadSuggestions(lotId: string) {
    // Load all non-ignored from sts_prospection
    const { data: all } = await supabase.schema('app').from('sts_prospection')
      .select('*')
      .eq('lot_id', lotId)
      .neq('statut', 'ignoré')
      .order('nb_avis_google', { ascending: false })

    const rows = (all ?? []) as (Suggestion & { statut: string; st_id: string | null })[]

    // TOP section: only rows where st_id is set (CO clicked "Ajouter"), deduplicate by st_id
    const seenStIds = new Set<string>()
    const added = rows.filter(r => {
      if (!r.st_id) return false
      if (seenStIds.has(r.st_id)) return false
      seenStIds.add(r.st_id)
      return true
    })
    if (added.length > 0) {
      const stIds = added.map(v => v.st_id).filter(Boolean) as string[]
      let confirmedStIds = new Set<string>()
      if (stIds.length > 0) {
        const { data: consults } = await supabase.schema('app').from('consultations_st')
          .select('st_id').eq('lot_id', lotId).in('st_id', stIds)
        confirmedStIds = new Set((consults ?? []).map((c: { st_id: string }) => c.st_id))
      }

      setAddedSTs(added.map(v => ({
        ...v,
        stId: v.st_id!,
        editing: false,
        confirmed: confirmedStIds.has(v.st_id!),
      })))

      // Load existing consultations statuts using lotId parameter (not selectedLot which may be stale)
      const etapes: Record<string, string> = {}
      const { data: allConsults } = await supabase.schema('app').from('consultations_st')
        .select('st_id, statut').eq('lot_id', lotId).in('st_id', stIds)

      // Set etapes from existing consultations
      for (const c of (allConsults ?? []) as { st_id: string; statut: string }[]) {
        etapes[c.st_id] = c.statut
      }

      // Auto-create missing consultations
      const existingStIds = new Set((allConsults ?? []).map((c: { st_id: string }) => c.st_id))
      const missing = stIds.filter(id => !existingStIds.has(id))
      if (missing.length > 0 && selectedProjet) {
        await fetch('/api/co/valider-st', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'ensure_consultations',
            updates: { lot_id: lotId, projet_id: selectedProjet.id, st_ids: missing },
          }),
        })
        for (const stId of missing) {
          etapes[stId] = 'a_contacter'
        }
      }

      setStEtapes(prev => ({ ...prev, ...etapes }))

      const forms: Record<string, { contact_email: string; contact_tel: string; adresse: string }> = {}
      for (const v of added) {
        forms[v.st_id!] = { contact_email: v.contact_email ?? '', contact_tel: v.contact_tel ?? '', adresse: v.adresse ?? '' }
      }
      setEditForm(prev => ({ ...prev, ...forms }))
    } else {
      setAddedSTs([])
    }

    // BOTTOM section: rows without st_id (not yet added by CO)
    const addedIds = new Set(added.map(a => a.id))
    const pending = rows.filter(r => r.st_id == null).map(s => ({
      ...s,
      added: addedIds.has(s.id),
    }))
    setSuggestions(pending)
  }

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
    setStep('recommandations')
    loadRecommandations(l, selectedProjet)
  }

  async function handleCreateLot() {
    if (!selectedProjet || !newLotCorpsEtat.trim()) return
    setCreatingLot(true)
    const nextNumero = lots.length > 0 ? Math.max(...lots.map(l => l.numero)) + 1 : 1
    const budget = newLotBudget ? parseFloat(newLotBudget) : null
    const { data } = await supabase.schema('app').from('lots')
      .insert({ projet_id: selectedProjet.id, numero: nextNumero, corps_etat: newLotCorpsEtat.trim(), budget_prevu: budget, statut: 'en_attente' })
      .select('id, numero, corps_etat, statut, st_retenu_id, budget_prevu').single()
    if (data) { setLots(prev => [...prev, data as Lot]); setNewLotCorpsEtat(''); setNewLotBudget(''); setShowNewLot(false) }
    setCreatingLot(false)
  }

  function toggleST(id: string) {
    setSelectedSTs(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  /* ── Prospection via n8n ── */
  async function handleProspection() {
    if (!selectedLot || !selectedProjet || !user) return
    setProspectionLoading(true)
    try {
      const ville = extractVille(selectedProjet.adresse)
      const res = await fetch('/api/co/consultation-st', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lot: selectedLot.corps_etat,
          ville: ville || 'Paris',
          nb_resultats: 3,
          projet_id: selectedProjet.id,
          lot_id: selectedLot.id,
          co_id: user.id,
        }),
      })
      const data = await res.json()
      if (data.success || data.nb_suggestions) {
        await loadSuggestions(selectedLot.id)
      }
    } catch { /* silent */ }
    finally { setProspectionLoading(false) }
  }

  async function handleIgnoreSuggestion(s: Suggestion) {
    setActionLoadingId(s.id)
    await fetch('/api/co/valider-st', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ignorer', prospection_id: s.id }),
    })
    setSuggestions(prev => prev.filter(x => x.id !== s.id))
    setActionLoadingId(null)
  }

  async function handleAddSuggestion(s: Suggestion) {
    if (!selectedProjet || !selectedLot) return
    setActionLoadingId(s.id)
    try {
      let stId: string | null = null
      if (s.contact_tel) {
        const { data: existing } = await supabase.schema('app').from('sous_traitants')
          .select('id').eq('contact_tel', s.contact_tel).limit(1).maybeSingle()
        if (existing) stId = existing.id
      }
      if (!stId) {
        const { data: newST } = await supabase.schema('app').from('sous_traitants')
          .insert({
            raison_sociale: s.raison_sociale, contact_tel: s.contact_tel,
            contact_email: s.contact_email, adresse: s.adresse,
            corps_etat: s.lot_corps_etat ? [s.lot_corps_etat] : [],
            source: 'scraping', statut: 'actif',
          }).select('id').single()
        stId = newST?.id ?? null
      }
      if (!stId) throw new Error('Echec creation ST')

      await fetch('/api/co/valider-st', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'valider', prospection_id: s.id, st_id: stId }),
      })

      setAddedSTs(prev => [...prev, { ...s, stId, editing: false }])
      setEditForm(prev => ({ ...prev, [stId!]: { contact_email: s.contact_email ?? '', contact_tel: s.contact_tel ?? '', adresse: s.adresse ?? '' } }))
      setSuggestions(prev => prev.map(x => x.id === s.id ? { ...x, added: true } : x))
    } catch { /* silent */ }
    finally { setActionLoadingId(null) }
  }

  function handleTagChange(stId: string, users: TaggedUser[]) {
    const prev = taggedUsers[stId] ?? []
    setTaggedUsers(p => ({ ...p, [stId]: users }))

    // Find newly added users
    const prevIds = new Set(prev.map(u => u.id))
    const newUsers = users.filter(u => !prevIds.has(u.id))

    // Send alerte for each new user
    const stRow = addedSTs.find(s => s.stId === stId)
    const stName = stRow?.raison_sociale ?? 'ST'
    const lotName = selectedLot?.corps_etat ?? 'Lot'

    for (const u of newUsers) {
      supabase.schema('app').from('alertes').insert({
        utilisateur_id: u.id,
        projet_id: selectedProjet?.id ?? null,
        type: 'consultation_st',
        titre: `Consultation ST -- ${stName}`,
        message: `${profil?.prenom ?? ''} ${profil?.nom ?? ''} vous demande de consulter ${stName} pour le lot ${lotName}.`,
        priorite: 'normal',
        lue: false,
      })
    }
  }

  // Etape dirty tracking
  const [dirtyEtapes, setDirtyEtapes] = useState<Set<string>>(new Set())
  const [savingEtape, setSavingEtape] = useState<string | null>(null)

  function handleSelectEtape(stId: string, newEtape: string) {
    setStEtapes(prev => ({ ...prev, [stId]: newEtape }))
    setDirtyEtapes(prev => new Set(prev).add(stId))
  }

  async function handleSaveEtape(stId: string) {
    if (!selectedProjet || !selectedLot) return
    const etape = stEtapes[stId] ?? 'a_contacter'
    setSavingEtape(stId)

    try {
      const res = await fetch('/api/co/valider-st', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change_etape',
          st_id: stId,
          updates: { lot_id: selectedLot.id, projet_id: selectedProjet.id, statut: etape },
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        alert('Erreur sauvegarde: ' + (data.error ?? res.status))
      } else {
        alert('Sauvegarde OK: ' + etape)
      }
    } catch (err) {
      alert('Erreur reseau: ' + (err instanceof Error ? err.message : err))
    }

    setDirtyEtapes(prev => { const n = new Set(prev); n.delete(stId); return n })
    setSavingEtape(null)
  }

  async function handleRemoveAddedST(s: { id: string; stId: string }) {
    // Set back to ignoré via API
    await fetch('/api/co/valider-st', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ignorer', prospection_id: s.id }),
    })
    // Remove from UI
    setAddedSTs(prev => prev.filter(x => x.id !== s.id))
  }

  async function handleConfirmST(stId: string) {
    if (!selectedProjet || !selectedLot) return
    setConfirmingId(stId)
    // Save any edits via API (bypasses RLS)
    const form = editForm[stId]
    if (form) {
      const updates: Record<string, string> = {}
      if (form.contact_email) updates.contact_email = form.contact_email
      if (form.contact_tel) updates.contact_tel = form.contact_tel
      if (form.adresse) updates.adresse = form.adresse
      if (Object.keys(updates).length > 0) {
        await fetch('/api/co/valider-st', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update_st', st_id: stId, updates }),
        })
      }
    }
    // Create consultation
    await supabase.schema('app').from('consultations_st').insert({
      projet_id: selectedProjet.id, lot_id: selectedLot.id, st_id: stId, statut: 'a_contacter', attribue: false,
    })
    // Mark as confirmed locally (confirmed = has consultation in DB)
    setAddedSTs(prev => prev.map(x => x.stId === stId ? { ...x, confirmed: true } : x))
    setConfirmingId(null)
  }

  /* ── Send devis requests ── */
  async function handleEnvoyerDemandes() {
    if (!selectedProjet || !selectedLot || !user || selectedSTs.size === 0) return
    setSending(true)
    for (const stId of Array.from(selectedSTs)) {
      const consult = await addConsultation(selectedProjet.id, selectedLot.id, stId)
      if (consult) await demanderDevis(consult.id)
    }
    setSending(false)
    await loadConsultations()
    setStep('suivi')
  }

  async function handleRelance(consultId: string) { await demanderDevis(consultId); await loadConsultations() }
  async function handleAttribuer(consultId: string) { const ok = await attribuerLot(consultId); if (ok) await loadConsultations() }

  async function handleDepositDevis() {
    if (!depositTarget || !depositMontant || !selectedProjet || !selectedLot || !user || !profil) return
    setDepositing(true)
    const montant = parseFloat(depositMontant)
    const delai = depositDelai ? parseInt(depositDelai) : null
    let score: number | null = null
    if (montant > 0 && delai && delai > 0) score = await calcScoreIA(montant, delai, selectedLot.id)
    await updateStatutConsultation(depositTarget.id, 'devis_recu', {
      montant_devis: montant, delai_propose: delai, score_ia: score, devis_recu_at: new Date().toISOString(),
    })
    if (depositFile) {
      const ext = depositFile.name.split('.').pop() ?? 'pdf'
      const path = `${selectedProjet.id}/devis/${Date.now()}_${depositTarget.st_id}.${ext}`
      await supabase.storage.from('projets').upload(path, depositFile, { upsert: false })
    }
    setDepositTarget(null); setDepositMontant(''); setDepositDelai(''); setDepositFile(null); setDepositing(false)
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
          className={cn('hover:text-gray-700 transition-colors', step === 'projet' && 'text-gray-900 font-semibold')}>Projet</button>
        {selectedProjet && (<><ChevronRight className="w-3 h-3" />
          <button onClick={() => { setStep('lot'); setSelectedLot(null) }}
            className={cn('hover:text-gray-700 transition-colors', step === 'lot' && 'text-gray-900 font-semibold')}>{selectedProjet.nom}</button></>)}
        {selectedLot && (<><ChevronRight className="w-3 h-3" />
          <span className={cn(step === 'recommandations' || step === 'suivi' ? 'text-gray-900 font-semibold' : '')}>
            Lot {selectedLot.numero} -- {selectedLot.corps_etat}</span></>)}
      </div>

      {achatsError && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />{achatsError}
          <button onClick={clearError} className="ml-auto text-red-500 hover:text-red-700 text-xs font-medium">Fermer</button>
        </div>
      )}

      {/* ─── STEP 1: Projet ─── */}
      {step === 'projet' && (
        <div className="space-y-2">
          {projetsLoading ? [1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />) :
          projets.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
              <p className="text-sm text-gray-500">Aucun projet disponible.</p></div>
          ) : projets.map(p => (
            <button key={p.id} onClick={() => selectProjet(p)}
              className="w-full flex items-center gap-4 bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 hover:border-gray-300 transition-all text-left group">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-gray-500" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{p.nom}</p>
                <p className="text-xs text-gray-400 truncate">{[p.reference, p.adresse].filter(Boolean).join(' / ')}</p></div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500" />
            </button>
          ))}
        </div>
      )}

      {/* ─── STEP 2: Lot ─── */}
      {step === 'lot' && (
        <div className="space-y-3">
          {lotsLoading ? [1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />) : (<>
            {lots.map(l => {
              const done = !!l.st_retenu_id
              return (
                <div key={l.id} className={cn('flex items-center gap-2 bg-white rounded-xl border border-gray-200 shadow-sm transition-all',
                  done ? 'opacity-50' : 'hover:border-gray-300')}>
                  <button onClick={() => selectLot(l)} disabled={done}
                    className="flex items-center gap-4 px-5 py-3.5 flex-1 text-left">
                    <span className="w-8 h-8 rounded-lg bg-gray-900 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">{l.numero}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{l.corps_etat}</p>
                      <p className="text-xs text-gray-400">{done ? 'ST attribue' : l.budget_prevu ? `${l.budget_prevu.toLocaleString('fr-FR')} EUR` : 'Budget non defini'}</p></div>
                    {!done && <ChevronRight className="w-4 h-4 text-gray-300" />}
                  </button>
                  <button onClick={async (e) => {
                    e.stopPropagation()
                    if (!confirm(`Supprimer le lot ${l.numero} - ${l.corps_etat} ? Toutes les consultations liees seront aussi supprimees.`)) return
                    // Get ST ids linked to this lot before deleting
                    const { data: lotConsults } = await supabase.schema('app').from('consultations_st')
                      .select('st_id').eq('lot_id', l.id)
                    const stIdsToDelete = (lotConsults ?? []).map((c: { st_id: string }) => c.st_id).filter(Boolean)

                    // Delete related data
                    await supabase.schema('app').from('consultations_st').delete().eq('lot_id', l.id)
                    await supabase.schema('app').from('sts_prospection').delete().eq('lot_id', l.id)

                    // Delete STs that were created for this lot (source = scraping, no other consultations)
                    for (const stId of stIdsToDelete) {
                      const { count } = await supabase.schema('app').from('consultations_st')
                        .select('id', { count: 'exact', head: true }).eq('st_id', stId)
                      if ((count ?? 0) === 0) {
                        await supabase.schema('app').from('sous_traitants').delete().eq('id', stId).eq('source', 'scraping')
                      }
                    }

                    await supabase.schema('app').from('lots').delete().eq('id', l.id)
                    setLots(prev => prev.filter(x => x.id !== l.id))
                  }}
                    className="px-3 py-3.5 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                    title="Supprimer ce lot">
                    <X className="w-4 h-4" />
                  </button>
                </div>)
            })}
            {showNewLot ? (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
                <p className="text-sm font-semibold text-gray-900">Nouveau lot</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Corps d&apos;etat *</label>
                    <select value={newLotCorpsEtat} onChange={e => setNewLotCorpsEtat(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                      <option value="">Selectionner un lot...</option>
                      <option value="Démolition">01 - Demolition</option>
                      <option value="Maçonnerie / Cloisons">02 - Maconnerie / Cloisons</option>
                      <option value="Menuiseries intérieures">03 - Menuiseries interieures</option>
                      <option value="Menuiseries extérieures">04 - Menuiseries exterieures</option>
                      <option value="Revêtements de sols">05 - Revetements de sols</option>
                      <option value="Revêtements muraux">06 - Revetements muraux</option>
                      <option value="Faux-plafonds">07 - Faux-plafonds</option>
                      <option value="Peinture">08 - Peinture</option>
                      <option value="Électricité CFO/CFA">09 - Electricite CFO/CFA</option>
                      <option value="Plomberie / Sanitaires">10 - Plomberie / Sanitaires</option>
                      <option value="Chauffage / Ventilation / Climatisation">11 - Chauffage / Ventilation / Climatisation</option>
                      <option value="Désenfumage">12 - Desenfumage</option>
                      <option value="Serrurerie / Métallerie">13 - Serrurerie / Metallerie</option>
                      <option value="Signalétique">14 - Signaletique</option>
                      <option value="Nettoyage">15 - Nettoyage</option>
                    </select></div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Budget (EUR)</label>
                    <input type="number" value={newLotBudget} onChange={e => setNewLotBudget(e.target.value)} placeholder="Ex: 50000"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900" /></div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleCreateLot} disabled={!newLotCorpsEtat.trim() || creatingLot}
                    className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors">
                    {creatingLot ? 'Creation...' : 'Creer le lot'}</button>
                  <button onClick={() => { setShowNewLot(false); setNewLotCorpsEtat(''); setNewLotBudget('') }}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
                </div></div>
            ) : (
              <button onClick={() => setShowNewLot(true)}
                className="w-full px-4 py-2.5 bg-white border border-dashed border-gray-300 rounded-lg text-xs font-medium text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors flex items-center justify-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />Nouveau lot</button>
            )}
          </>)}
        </div>
      )}

      {/* ─── STEP 3: Recommandations + Prospection ─── */}
      {step === 'recommandations' && (
        <div className="space-y-4">
          {/* Base interne */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">ST en base -- {selectedLot?.corps_etat}</h3>
              <p className="text-xs text-gray-400 mt-0.5">Les 3 meilleurs sont pre-selectionnes.</p></div>
            {/* Added STs from prospection */}
            {addedSTs.length > 0 && (
              <div className="divide-y divide-gray-100 border-b border-gray-100">
                {addedSTs.map(s => {
                  const form = editForm[s.stId] ?? { contact_email: '', contact_tel: '', adresse: '' }
                  const isConfirming = confirmingId === s.stId
                  return (
                    <div key={`added-${s.stId}`} className="px-5 py-4 bg-emerald-50/30">
                      <div className="flex items-center gap-3 mb-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        <p className="text-sm font-semibold text-gray-900 flex-1">{s.raison_sociale}</p>
                        {s.note_google != null && (
                          <span className="flex items-center gap-1 text-xs text-amber-600">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />{s.note_google}
                          </span>
                        )}
                      </div>
                      {s.editing ? (
                        <div className="space-y-2 ml-7">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <input type="email" value={form.contact_email}
                              onChange={e => setEditForm(prev => ({ ...prev, [s.stId]: { ...form, contact_email: e.target.value } }))}
                              placeholder="Email"
                              className="px-2.5 py-1.5 border border-gray-200 rounded-md text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900" />
                            <input type="tel" value={form.contact_tel}
                              onChange={e => setEditForm(prev => ({ ...prev, [s.stId]: { ...form, contact_tel: e.target.value } }))}
                              placeholder="Telephone"
                              className="px-2.5 py-1.5 border border-gray-200 rounded-md text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900" />
                            <input type="text" value={form.adresse}
                              onChange={e => setEditForm(prev => ({ ...prev, [s.stId]: { ...form, adresse: e.target.value } }))}
                              placeholder="Adresse"
                              className="px-2.5 py-1.5 border border-gray-200 rounded-md text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900" />
                          </div>
                          <button onClick={() => setAddedSTs(prev => prev.map(x => x.stId === s.stId ? { ...x, editing: false } : x))}
                            className="text-xs text-gray-500 hover:text-gray-700">Fermer</button>
                        </div>
                      ) : (
                        <div className="ml-7 flex items-center gap-3 text-xs text-gray-500">
                          {form.contact_tel && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{form.contact_tel}</span>}
                          {form.contact_email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{form.contact_email}</span>}
                          {!form.contact_email && <span className="text-gray-300">Email non disponible</span>}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-3 ml-7">
                        <select
                          value={stEtapes[s.stId] ?? 'a_contacter'}
                          onChange={e => handleSelectEtape(s.stId, e.target.value)}
                          className={cn(
                            'px-2.5 py-1.5 rounded-md text-xs font-medium border border-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white cursor-pointer',
                            ETAPES_ST.find(et => et.value === (stEtapes[s.stId] ?? 'a_contacter'))?.color,
                          )}>
                          {ETAPES_ST.map(et => (
                            <option key={et.value} value={et.value}>{et.label}</option>
                          ))}
                        </select>
                        {dirtyEtapes.has(s.stId) && (
                          <button onClick={() => handleSaveEtape(s.stId)} disabled={savingEtape === s.stId}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-900 text-white rounded-md text-xs font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors">
                            {savingEtape === s.stId ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                            Enregistrer
                          </button>
                        )}
                        <button onClick={() => setAddedSTs(prev => prev.map(x => x.stId === s.stId ? { ...x, editing: !x.editing } : x))}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-md text-xs font-medium hover:bg-gray-50 transition-colors">
                          <FileText className="w-3 h-3" />Modifier
                        </button>
                        <UserTagPicker
                          selected={taggedUsers[s.stId] ?? []}
                          onChange={users => handleTagChange(s.stId, users)}
                          excludeUserId={user?.id}
                          compact
                        />
                        <button onClick={() => handleRemoveAddedST(s)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-red-200 text-red-500 rounded-md text-xs font-medium hover:bg-red-50 transition-colors ml-auto">
                          <X className="w-3 h-3" />Supprimer
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {recoLoading ? (
              <div className="p-8 text-center"><Loader2 className="w-6 h-6 text-gray-400 animate-spin mx-auto mb-2" /><p className="text-xs text-gray-500">Recherche...</p></div>
            ) : recommandations.length === 0 && addedSTs.length === 0 ? (
              <div className="p-8 text-center"><Search className="w-8 h-8 text-gray-200 mx-auto mb-2" /><p className="text-sm text-gray-500">Aucun ST en base pour ce corps d&apos;etat.</p></div>
            ) : recommandations.length === 0 ? null : (
              <div className="divide-y divide-gray-50">
                {recommandations.map((st, idx) => {
                  const checked = selectedSTs.has(st.id)
                  return (
                    <label key={st.id} className={cn('flex items-center gap-4 px-5 py-3.5 cursor-pointer transition-colors', checked ? 'bg-gray-50' : 'hover:bg-gray-50/50')}>
                      <input type="checkbox" checked={checked} onChange={() => toggleST(st.id)} className="rounded border-gray-300 text-gray-900" />
                      {idx < 3 && <span className={cn('w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                        idx === 0 ? 'bg-amber-100 text-amber-700' : idx === 1 ? 'bg-gray-200 text-gray-600' : 'bg-orange-100 text-orange-600')}>{idx+1}</span>}
                      {idx >= 3 && <span className="w-6" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{st.raison_sociale}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          {st.ville && <span className="flex items-center gap-1 text-xs text-gray-400"><MapPin className="w-3 h-3" />{st.ville}</span>}
                          {st.nb_chantiers_realises > 0 && <span className="text-xs text-gray-400">{st.nb_chantiers_realises} chantier{st.nb_chantiers_realises > 1 ? 's' : ''}</span>}
                        </div></div>
                      {st.note_moyenne != null ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-amber-600"><Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />{st.note_moyenne.toFixed(1)}</span>
                      ) : <span className="text-[10px] text-gray-300">Pas de note</span>}
                      {st.agrement === 'agree' && <span className="flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded"><Award className="w-3 h-3" />Agree</span>}
                    </label>)
                })}
              </div>
            )}
          </div>

          {/* Envoyer demandes base interne */}
          {recommandations.length > 0 && (
            <button onClick={handleEnvoyerDemandes} disabled={sending || selectedSTs.size === 0}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 transition-colors">
              {sending ? <><Loader2 className="w-4 h-4 animate-spin" />Envoi...</> : <><Send className="w-4 h-4" />Envoyer les demandes ({selectedSTs.size})</>}
            </button>
          )}

          {/* Prospection Google Maps via n8n */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-gray-400" />Trouver sur Google Maps</h3>
                <p className="text-xs text-gray-400 mt-0.5">Recherche automatique dans la zone du projet</p>
              </div>
              <button onClick={handleProspection} disabled={prospectionLoading}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors">
                {prospectionLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Recherche...</> : <><Search className="w-3.5 h-3.5" />Rechercher</>}
              </button>
            </div>

            {suggestions.length > 0 && (
              <div className="divide-y divide-gray-100">
                <div className="px-5 py-2"><p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{suggestions.length} entreprise{suggestions.length > 1 ? 's' : ''} trouvee{suggestions.length > 1 ? 's' : ''}</p></div>
                {suggestions.map(s => (
                  <div key={`suggestion-${s.id}`} className="px-5 py-3.5">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{s.raison_sociale}</p>
                        {s.adresse && <p className="text-xs text-gray-500 mt-0.5">{s.adresse}</p>}
                        <div className="flex items-center flex-wrap gap-3 mt-1.5">
                          {s.note_google != null && <span className="flex items-center gap-1 text-xs text-amber-600"><Star className="w-3 h-3 fill-amber-400 text-amber-400" />{s.note_google}<span className="text-gray-400"> / {s.nb_avis_google ?? 0} avis</span></span>}
                          {s.contact_tel ? <a href={`tel:${s.contact_tel}`} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"><Phone className="w-3 h-3" />{s.contact_tel}</a> : <span className="flex items-center gap-1 text-xs text-gray-300"><Phone className="w-3 h-3" />Non disponible</span>}
                          {s.contact_email ? <a href={`mailto:${s.contact_email}`} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"><Mail className="w-3 h-3" />{s.contact_email}</a> : <span className="flex items-center gap-1 text-xs text-gray-300"><Mail className="w-3 h-3" />Non disponible</span>}
                          {s.site_web && <a href={s.site_web} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700"><ExternalLink className="w-3 h-3" />Voir le site</a>}
                        </div></div>
                      <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
                        {s.added ? (
                          <span className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 text-emerald-600 rounded-md text-xs font-medium">
                            <CheckCircle2 className="w-3 h-3" />Ajoute</span>
                        ) : (<>
                          <button onClick={() => handleIgnoreSuggestion(s)} disabled={actionLoadingId === s.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 border border-red-200 text-red-500 rounded-md text-xs font-medium hover:bg-red-50 disabled:opacity-40 transition-colors">
                            <X className="w-3 h-3" />Ignorer</button>
                          <button onClick={() => handleAddSuggestion(s)} disabled={actionLoadingId === s.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-900 text-white rounded-md text-xs font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors">
                            {actionLoadingId === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}Ajouter</button>
                        </>)}
                      </div></div></div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── STEP 4: Suivi ─── */}
      {step === 'suivi' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Suivi -- Lot {selectedLot?.numero} {selectedLot?.corps_etat}</h3>
            <button onClick={loadConsultations} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 transition-colors"><RefreshCw className="w-3 h-3" />Actualiser</button>
          </div>
          {consultLoading ? [1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />) :
          consultations.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
              <p className="text-sm text-gray-500">Aucune consultation.</p>
              <button onClick={() => { setStep('recommandations'); if (selectedLot && selectedProjet) loadRecommandations(selectedLot, selectedProjet) }}
                className="mt-3 text-xs text-gray-900 font-medium underline">Ajouter des ST</button></div>
          ) : consultations.map(c => {
            const cfg = STATUT_LABELS[c.statut] ?? STATUT_LABELS['a_contacter']
            const Icon = cfg.icon
            const days = daysSince(c.email_envoye_at)
            const needsRelance = c.statut === 'devis_demande' && days != null && days >= 3
            return (
              <div key={c.id} className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{c.sous_traitant?.raison_sociale ?? 'ST inconnu'}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded', cfg.color)}><Icon className="w-3 h-3" />{cfg.label}</span>
                      {c.email_envoye_at && <span className="text-[10px] text-gray-400">Envoye il y a {days}j</span>}
                      {c.score_ia != null && <span className="text-xs font-medium text-blue-600">Score IA : {c.score_ia}/100</span>}
                    </div></div>
                  {c.montant_devis != null && (
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-gray-900">{c.montant_devis.toLocaleString('fr-FR')} EUR</p>
                      {c.delai_propose && <p className="text-[10px] text-gray-400">{c.delai_propose} jours</p>}</div>)}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  {(c.statut === 'devis_demande' || c.statut === 'contacte') && (
                    <button onClick={() => handleRelance(c.id)} disabled={achatsLoading}
                      className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                        needsRelance ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50')}>
                      <RefreshCw className="w-3 h-3" />{needsRelance ? 'Relancer (3j+)' : 'Relancer'}</button>)}
                  {(c.statut === 'devis_demande' || c.statut === 'contacte') && (
                    <button onClick={() => setDepositTarget(c)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-600 border border-gray-200 rounded-md text-xs font-medium hover:bg-gray-50 transition-colors">
                      <Upload className="w-3 h-3" />Devis recu</button>)}
                  {c.statut === 'devis_recu' && !c.attribue && (
                    <button onClick={() => handleAttribuer(c.id)} disabled={achatsLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-md text-xs font-semibold hover:bg-gray-800 transition-colors">
                      <CheckCircle2 className="w-3 h-3" />Attribuer ce lot</button>)}
                  {c.sous_traitant?.telephone && (
                    <a href={`tel:${c.sous_traitant.telephone}`} className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-gray-400 hover:text-gray-600 ml-auto">
                      <Phone className="w-3 h-3" />{c.sous_traitant.telephone}</a>)}
                </div></div>)
          })}
          <button onClick={() => { setStep('recommandations'); if (selectedLot && selectedProjet) loadRecommandations(selectedLot, selectedProjet) }}
            className="w-full px-4 py-2.5 bg-white border border-dashed border-gray-300 rounded-lg text-xs font-medium text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors">
            + Ajouter d&apos;autres sous-traitants</button>
        </div>
      )}

      {/* ─── Modal: Deposer devis ─── */}
      {depositTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
              <div><h2 className="text-base font-semibold text-gray-900">Deposer un devis</h2>
                <p className="text-xs text-gray-400 mt-0.5">{depositTarget.sous_traitant?.raison_sociale}</p></div>
              <button onClick={() => { setDepositTarget(null); setDepositFile(null) }} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"><XCircle className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div><label className="block text-xs font-medium text-gray-700 mb-1.5">Montant HT (EUR) *</label>
                <input type="number" value={depositMontant} onChange={e => setDepositMontant(e.target.value)} placeholder="Ex: 45000" step="0.01"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" /></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1.5">Delai propose (jours)</label>
                <input type="number" value={depositDelai} onChange={e => setDepositDelai(e.target.value)} placeholder="Ex: 30"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" /></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1.5">Fichier devis (PDF)</label>
                <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" onChange={e => setDepositFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200" /></div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 pb-5">
              <button onClick={() => { setDepositTarget(null); setDepositFile(null) }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">Annuler</button>
              <button onClick={handleDepositDevis} disabled={!depositMontant || depositing}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors">
                {depositing ? 'Enregistrement...' : 'Enregistrer le devis'}</button>
            </div></div></div>
      )}

    </div>
  )
}
