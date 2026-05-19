'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import {
  FileText, Download, Calendar, AlertCircle, Check, User, Upload,
  ChevronRight, Pencil, X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, cn } from '@/lib/utils'

/* ─── Types ────────────────────────────────────────────────────────────── */

type DceContext = {
  acces: {
    id: string
    statut: 'envoye' | 'ouvert' | 'en_cours' | 'soumis' | 'retenu' | 'refuse' | 'decline_st'
    date_limite: string | null
    st_nom: string | null
    st_societe: string | null
    decline_motif?: string | null
  }
  lot: {
    id: string; nom: string
    cctp_url: string | null; cctp_nom_fichier: string | null
    plans_urls: { nom: string; url: string }[] | null
    planning_debut: string | null; planning_fin: string | null; planning_notes: string | null
  }
  projet_nom: string
  lignes: { id: string; designation: string | null; detail: string | null; quantite: number | null; unite: string | null; ordre: number; type?: string | null; parent_id?: string | null }[]
  offres_existantes: { chiffrage_ligne_id: string; prix_unitaire: number; total_ht: number; notes_st: string | null }[]
  propositions_existantes?: { id: string; designation: string; quantite: number | null; unite: string | null; prix_unitaire: number | null; total_ht: number | null; parent_designation?: string | null }[]
}

type DocSt = { id: string; type_doc: string; nom_fichier: string; url: string; date_validite: string | null; statut: string }

type PropositionDraft = {
  key: string
  type: 'chapitre' | 'ouvrage'
  designation: string
  parent_designation: string  // pour les ouvrages : chapitre auquel ils sont rattaches
  quantite: string
  unite: string
  prix_unitaire: string
}

type Step = 1 | 2 | 3 | 4

// dateKind: 'emission' = date d'emission (doc date) - la date doit etre <= aujourd'hui et pas trop ancienne
//           'validite' = date d'expiration de validite - la date doit etre >= aujourd'hui (et avant la limite max)
const DOC_TYPES = [
  { type: 'kbis', label: 'Extrait Kbis — moins de 3 mois', required: true, hasDate: true, dateKind: 'emission' as const, maxAgeMonths: 3 },
  { type: 'urssaf', label: 'Attestation de vigilance URSSAF — moins de 6 mois', required: true, hasDate: true, dateKind: 'emission' as const, maxAgeMonths: 6 },
  { type: 'rib', label: 'Relevé d\'Identité Bancaire (RIB)', required: true, hasDate: false },
  { type: 'attestation_fiscale', label: 'Attestation de régularité fiscale — moins de 6 mois', required: true, hasDate: true, dateKind: 'emission' as const, maxAgeMonths: 6 },
  { type: 'rc_pro', label: 'Attestation RC Professionnelle — en cours de validité', required: true, hasDate: true, dateKind: 'validite' as const },
  { type: 'decennale', label: 'Attestation d\'assurance Décennale — validité 10 ans', required: true, hasDate: true, dateKind: 'validite' as const, note: 'Document indispensable pour le DOE final' },
  { type: 'qualification', label: 'Qualification professionnelle (RGE, Qualifelec, Qualibat...) — si applicable', required: false, hasDate: false },
] as const

type DocTypeDef = typeof DOC_TYPES[number]

function checkDocDate(dt: DocTypeDef, dateStr: string | null): { ok: boolean; reason?: string } {
  if (!('hasDate' in dt) || !dt.hasDate || !('dateKind' in dt)) return { ok: true }
  if (!dateStr) return { ok: false, reason: 'Date manquante' }
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return { ok: false, reason: 'Date invalide' }
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (dt.dateKind === 'emission') {
    // La date est la fin de validite : le doc doit rester valable au moins N mois a partir d'aujourd'hui
    const maxAge = (dt as { maxAgeMonths?: number }).maxAgeMonths ?? 3
    if (date.getTime() < today.getTime()) return { ok: false, reason: 'Validite expiree' }
    const minLimit = new Date(today)
    minLimit.setMonth(minLimit.getMonth() + maxAge)
    if (date.getTime() < minLimit.getTime()) return { ok: false, reason: `Le document doit etre valable au moins ${maxAge} mois a partir d'aujourd'hui` }
    return { ok: true }
  }
  // validite : doit etre >= aujourd'hui
  if (date.getTime() < today.getTime()) return { ok: false, reason: 'Validite expiree' }
  return { ok: true }
}

type ModLine = { designation: string; detail: string; quantite: string; unite: string }

const UNITES = ['u', 'ml', 'm2', 'm3', 'kg', 'h', 'jour', 'forfait']

function uniteLabel(u: string | null): string {
  if (!u) return ''
  if (u === 'm2') return 'm\u00B2'
  if (u === 'm3') return 'm\u00B3'
  return u
}

function fmtNum(n: number): string {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function parseNum(s: string): number {
  if (!s) return 0
  const n = parseFloat(s.replace(',', '.'))
  return isNaN(n) ? 0 : n
}

/* ─── Page ─────────────────────────────────────────────────────────────── */

export default function DcePublicPage() {
  const params = useParams()
  const token = params.token as string
  const supabase = useMemo(() => createClient(), [])

  const [ctx, setCtx] = useState<DceContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [step, setStep] = useState<Step>(1)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Identity
  const [identNom, setIdentNom] = useState('')
  const [identSociete, setIdentSociete] = useState('')
  const [identEmail, setIdentEmail] = useState('')
  const [identTel, setIdentTel] = useState('')
  const [savingIdent, setSavingIdent] = useState(false)
  const needsIdentity = !!ctx && (!ctx.acces.st_nom || ctx.acces.st_nom.trim() === '')

  // Step 1: docs
  const [docs, setDocs] = useState<DocSt[]>([])
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)

  // Step 2: CA
  const [caAnnuel, setCaAnnuel] = useState('')
  const [caDocUrl, setCaDocUrl] = useState<string | null>(null)
  const [caDocNom, setCaDocNom] = useState<string | null>(null)
  const [uploadingCa, setUploadingCa] = useState(false)

  // Step 2: DPGF
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [quantitiesSt, setQuantitiesSt] = useState<Record<string, string>>({})
  const [comments, setComments] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Step 3: Propositions ST (lignes ajoutees hors DPGF)
  const [propositions, setPropositions] = useState<PropositionDraft[]>([])

  // Decline (le ST refuse de participer a la consultation)
  const [showDecline, setShowDecline] = useState(false)
  const [declineMotif, setDeclineMotif] = useState('')
  const [declining, setDeclining] = useState(false)

  async function handleDecline() {
    if (!ctx) return
    setDeclining(true)
    setErrorMsg(null)
    const { error } = await supabase.rpc('decline_dce_offre' as never, {
      p_token: token,
      p_motif: declineMotif.trim() || null,
    } as never)
    setDeclining(false)
    if (error) { setErrorMsg(`Erreur : ${error.message}`); return }
    setShowDecline(false)
    setSubmitted(true)
    const { data: refreshed } = await supabase.rpc('get_dce_context' as never, { p_token: token } as never)
    if (refreshed) setCtx(refreshed as DceContext)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const [savingDraft, setSavingDraft] = useState(false)
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null)

  async function saveDraftPropositions() {
    if (submitted) return
    setSavingDraft(true)
    try {
      const payload = propositions
        .filter((p) => p.designation.trim())
        .map((p) => ({
          designation: p.designation.trim(),
          quantite: p.type === 'chapitre' ? 0 : parseNum(p.quantite),
          unite: p.type === 'chapitre' ? '' : p.unite,
          prix_unitaire: p.type === 'chapitre' ? 0 : parseNum(p.prix_unitaire),
          parent_designation: p.type === 'ouvrage' ? p.parent_designation.trim() : '',
        }))
      const { error } = await supabase.rpc('save_dce_draft' as never, {
        p_token: token,
        p_propositions: payload,
      } as never)
      if (!error) setDraftSavedAt(new Date())
    } finally {
      setSavingDraft(false)
    }
  }

  // Auto-save debounce (1.5s apres la derniere modif)
  useEffect(() => {
    if (loading || submitted || !ctx) return
    const t = setTimeout(() => { saveDraftPropositions() }, 1500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propositions])

  function addProposition(type: 'chapitre' | 'ouvrage') {
    setPropositions((prev) => [
      ...prev,
      { key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, designation: '', parent_designation: '', quantite: '', unite: 'u', prix_unitaire: '' },
    ])
  }
  function updateProposition(key: string, patch: Partial<PropositionDraft>) {
    setPropositions((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)))
  }
  function removeProposition(key: string) {
    setPropositions((prev) => prev.filter((p) => p.key !== key))
  }

  // Lignes modifiees par le ST (designation, detail, quantite, unite personnalises)
  const [modifiedLines, setModifiedLines] = useState<Record<string, ModLine>>({})

  // Negociations recues du CO/Eco
  type NegoLigneIncoming = {
    ligne_id: string
    designation: string
    quantite: number
    unite: string | null
    prix_unitaire_initial: number
    prix_unitaire_propose: number
    quantite_proposee: number | null
    unite_proposee: string | null
    detail_propose: string | null
  }
  type NegoReponseLigne = {
    ligne_id: string
    prix_unitaire?: number | null
    quantite?: number | null
    unite?: string | null
    detail?: string | null
  }
  type NegoIncoming = {
    id: string
    type: 'technique' | 'financiere'
    contenu: string
    montant_initial: number | null
    montant_negocie: number | null
    statut: 'en_cours' | 'accepte' | 'refuse'
    motif: string | null
    tour: 'st' | 'co' | null
    lignes_data: NegoLigneIncoming[]
    reponse_st: string | null
    reponse_st_decision: string | null
    reponse_st_le: string | null
    reponse_st_lignes: NegoReponseLigne[] | null
    created_at: string
  }
  const [negos, setNegos] = useState<NegoIncoming[]>([])
  const [negoMessages, setNegoMessages] = useState<Record<string, string>>({})
  // Contre-propositions par ligne : negoId -> ligneId -> { prix?, quantite?, unite?, detail? }
  const [negoCounterLignes, setNegoCounterLignes] = useState<Record<string, Record<string, { prix: string; quantite: string; unite: string; detail: string }>>>({})
  const [respondingId, setRespondingId] = useState<string | null>(null)

  async function refreshNegos() {
    const { data } = await supabase.rpc('get_st_negociations' as never, { p_token: token } as never)
    setNegos(((data as unknown) ?? []) as NegoIncoming[])
  }

  useEffect(() => {
    if (!ctx) return
    refreshNegos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx?.acces.id])

  async function respondNego(negoId: string, decision: 'accepte' | 'refuse' | 'contre_proposition') {
    setRespondingId(negoId)
    const message = negoMessages[negoId]?.trim() || null
    let lignesPayload: NegoReponseLigne[] | null = null
    if (decision === 'contre_proposition') {
      const map = negoCounterLignes[negoId] ?? {}
      const arr: NegoReponseLigne[] = []
      for (const [ligneId, v] of Object.entries(map)) {
        const prix = v.prix ? Number(v.prix.replace(',', '.')) : null
        const quantite = v.quantite ? Number(v.quantite.replace(',', '.')) : null
        const unite = v.unite.trim() || null
        const detail = v.detail.trim() || null
        if (prix == null && quantite == null && !unite && !detail) continue
        arr.push({ ligne_id: ligneId, prix_unitaire: prix, quantite, unite, detail })
      }
      lignesPayload = arr.length > 0 ? arr : null
    }
    const { error } = await supabase.rpc('respond_st_negociation' as never, {
      p_token: token,
      p_nego_id: negoId,
      p_decision: decision,
      p_message: message,
      p_lignes: lignesPayload,
    } as never)
    setRespondingId(null)
    if (!error) await refreshNegos()
  }

  function updateCounterLigne(negoId: string, ligneId: string, patch: Partial<{ prix: string; quantite: string; unite: string; detail: string }>) {
    setNegoCounterLignes((prev) => {
      const next = { ...prev }
      const negoMap = { ...(next[negoId] ?? {}) }
      const current = negoMap[ligneId] ?? { prix: '', quantite: '', unite: '', detail: '' }
      negoMap[ligneId] = { ...current, ...patch }
      next[negoId] = negoMap
      return next
    })
  }

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step])

  function startModifyLine(l: DceContext['lignes'][number]) {
    setModifiedLines((prev) => ({
      ...prev,
      [l.id]: {
        designation: l.designation ?? '',
        detail: l.detail ?? '',
        quantite: String(l.quantite ?? 0),
        unite: l.unite ?? '',
      },
    }))
  }

  function cancelModifyLine(lineId: string) {
    setModifiedLines((prev) => {
      const next = { ...prev }
      delete next[lineId]
      return next
    })
  }

  function updateModLine(lineId: string, field: keyof ModLine, value: string) {
    setModifiedLines((prev) => ({
      ...prev,
      [lineId]: { ...prev[lineId], [field]: value },
    }))
    // Sync quantite ST avec la valeur modifiee
    if (field === 'quantite') {
      setQuantitiesSt((prev) => ({ ...prev, [lineId]: value }))
    }
  }

  /* ── Load ────────────────────────────────── */
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.rpc('get_dce_context' as never, { p_token: token } as never)
      if (error || !data) { setNotFound(true); setLoading(false); return }
      const c = data as DceContext
      if (!c.acces) { setNotFound(true); setLoading(false); return }
      setCtx(c)

      // Init prices from existing offers
      const ip: Record<string, string> = {}
      c.offres_existantes?.forEach((o) => { ip[o.chiffrage_ligne_id] = String(o.prix_unitaire ?? '') })
      setPrices(ip)
      if (c.offres_existantes?.[0]?.notes_st) setNotes(c.offres_existantes[0].notes_st)

      // Init propositions from existing
      const initialProps: PropositionDraft[] = (c.propositions_existantes ?? []).map((p) => ({
        key: p.id,
        type: (p.quantite == null && (p.prix_unitaire == null || Number(p.prix_unitaire) === 0)) ? 'chapitre' : 'ouvrage',
        designation: p.designation ?? '',
        parent_designation: p.parent_designation ?? '',
        quantite: p.quantite != null ? String(p.quantite) : '',
        unite: p.unite ?? 'u',
        prix_unitaire: p.prix_unitaire != null ? String(p.prix_unitaire) : '',
      }))
      setPropositions(initialProps)

      // 'soumis' = offre transmise mais re-modifiable tant que pas de decision finale
      if (['retenu', 'refuse', 'decline_st'].includes(c.acces.statut)) {
        setSubmitted(true)
      } else if (c.acces.statut === 'envoye') {
        await supabase.rpc('mark_dce_opened' as never, { p_token: token } as never)
      }

      // Load existing docs
      const { data: docsData } = await supabase
        .from('dce_docs_st').select('*').eq('acces_id', c.acces.id).order('created_at')
      setDocs((docsData ?? []) as DocSt[])

      // Load CA
      const { data: accesData } = await supabase
        .from('dce_acces_st').select('ca_annuel, ca_doc_url, ca_doc_nom').eq('id', c.acces.id).single()
      const ad = accesData as { ca_annuel: number | null; ca_doc_url: string | null; ca_doc_nom: string | null } | null
      if (ad?.ca_annuel) setCaAnnuel(String(ad.ca_annuel))
      if (ad?.ca_doc_url) setCaDocUrl(ad.ca_doc_url)
      if (ad?.ca_doc_nom) setCaDocNom(ad.ca_doc_nom)

      setLoading(false)
    }
    load()
  }, [token, supabase])

  /* ── Identity ────────────────────────────── */
  async function saveIdentity() {
    if (!identNom.trim() || !identEmail.trim()) { setErrorMsg('Nom et email obligatoires.'); return }
    setSavingIdent(true); setErrorMsg(null)
    await supabase.rpc('set_dce_identity' as never, {
      p_token: token, p_nom: identNom.trim(), p_societe: identSociete.trim(),
      p_email: identEmail.trim(), p_telephone: identTel.trim(),
    } as never)
    const { data } = await supabase.rpc('get_dce_context' as never, { p_token: token } as never)
    if (data) setCtx(data as DceContext)
    setSavingIdent(false)
  }

  /* ── Step 1: Doc upload ──────────────────── */
  const requiredDocs = DOC_TYPES.filter((d) => d.required)
  const allDocsDeposited = requiredDocs.every((dt) => {
    const existing = docs.find((d) => d.type_doc === dt.type)
    if (!existing) return false
    if (dt.hasDate && !existing.date_validite) return false
    if (dt.hasDate && !checkDocDate(dt, existing.date_validite).ok) return false
    return true
  })
  const missingDocsCount = requiredDocs.filter((dt) => !docs.some((d) => d.type_doc === dt.type)).length
  const missingDatesCount = requiredDocs.filter((dt) => {
    if (!dt.hasDate) return false
    const existing = docs.find((d) => d.type_doc === dt.type)
    return existing && !existing.date_validite
  }).length
  const invalidDatesCount = requiredDocs.filter((dt) => {
    if (!dt.hasDate) return false
    const existing = docs.find((d) => d.type_doc === dt.type)
    if (!existing || !existing.date_validite) return false
    return !checkDocDate(dt, existing.date_validite).ok
  }).length

  async function uploadDoc(typeDoc: string, file: File) {
    if (!ctx) return
    setUploadingDoc(typeDoc)
    const path = `st-docs/${ctx.acces.id}/${typeDoc}_${file.name.replace(/\s+/g, '_')}`
    const { error: upErr } = await supabase.storage.from('checklist-docs').upload(path, file, { upsert: true })
    if (upErr) { setErrorMsg(`Upload : ${upErr.message}`); setUploadingDoc(null); return }
    const { data: pub } = supabase.storage.from('checklist-docs').getPublicUrl(path)

    // Remove old doc of same type
    const old = docs.find((d) => d.type_doc === typeDoc)
    if (old) await supabase.from('dce_docs_st').delete().eq('id', old.id)

    const { data: ins } = await supabase.from('dce_docs_st').insert({
      acces_id: ctx.acces.id, lot_id: ctx.lot.id, type_doc: typeDoc,
      nom_fichier: file.name, url: pub.publicUrl, statut: 'depose',
    } as never).select('*').single()
    if (ins) setDocs((prev) => [...prev.filter((d) => d.type_doc !== typeDoc), ins as unknown as DocSt])
    setUploadingDoc(null)
  }

  async function setDocDate(docId: string, date: string) {
    await supabase.from('dce_docs_st').update({ date_validite: date || null } as never).eq('id', docId)
    setDocs((prev) => prev.map((d) => (d.id === docId ? { ...d, date_validite: date } : d)))
  }

  /* ── Step 2: CA ──────────────────────────── */
  const caValue = parseNum(caAnnuel)

  async function saveCa() {
    if (!ctx || caValue <= 0) return
    await supabase.from('dce_acces_st').update({
      ca_annuel: caValue, ratio_ca_alerte: ratioAlerte,
    } as never).eq('id', ctx.acces.id)
  }

  async function uploadCaDoc(file: File) {
    if (!ctx) return
    setUploadingCa(true)
    const path = `st-docs/${ctx.acces.id}/ca_${file.name.replace(/\s+/g, '_')}`
    const { error: upErr } = await supabase.storage.from('checklist-docs').upload(path, file, { upsert: true })
    if (upErr) { setErrorMsg(`Upload CA : ${upErr.message}`); setUploadingCa(false); return }
    const { data: pub } = supabase.storage.from('checklist-docs').getPublicUrl(path)
    await supabase.from('dce_acces_st').update({
      ca_doc_url: pub.publicUrl, ca_doc_nom: file.name,
    } as never).eq('id', ctx.acces.id)
    setCaDocUrl(pub.publicUrl); setCaDocNom(file.name)
    setUploadingCa(false)
  }

  /* ── Total : DPGF + Propositions ─────────── */
  const totalDpgf = useMemo(() => {
    if (!ctx) return 0
    return ctx.lignes.reduce((s, l) => {
      const mod = modifiedLines[l.id]
      const q = mod
        ? parseNum(mod.quantite)
        : quantitiesSt[l.id] !== undefined && quantitiesSt[l.id] !== ''
          ? parseNum(quantitiesSt[l.id])
          : Number(l.quantite ?? 0)
      return s + q * parseNum(prices[l.id] ?? '')
    }, 0)
  }, [prices, quantitiesSt, modifiedLines, ctx])

  const totalPropositions = useMemo(() => {
    return propositions.reduce((s, p) => {
      if (p.type === 'chapitre') return s
      return s + parseNum(p.quantite) * parseNum(p.prix_unitaire)
    }, 0)
  }, [propositions])

  const total = totalDpgf + totalPropositions

  // Ratio CA : utilise `total` (live) et non l'ancien lotTotal sur quantites originales
  const ratio = caValue > 0 ? (total / caValue) * 100 : 0
  const ratioAlerte = ratio > 33

  /* ── Submit ──────────────────────────────── */
  async function handleSubmit() {
    if (!ctx) return
    if (!allDocsDeposited) { setErrorMsg('Deposez tous les documents obligatoires (etape 1).'); return }
    const filled = ctx.lignes.filter((l) => parseNum(prices[l.id] ?? '') > 0)
    const validProps = propositions.filter((p) => p.designation.trim() && (p.type === 'chapitre' || parseNum(p.prix_unitaire) > 0))
    if (filled.length === 0 && validProps.length === 0) { setErrorMsg('Renseignez au moins un prix (etape 2) ou ajoutez une proposition (etape 3).'); return }
    const ouvragesOrphelins = validProps.filter((p) => p.type === 'ouvrage' && !p.parent_designation.trim())
    if (ouvragesOrphelins.length > 0) { setErrorMsg(`Chaque ouvrage propose doit etre rattache a un chapitre (${ouvragesOrphelins.length} a corriger en etape 3).`); setStep(3); return }
    if (caValue <= 0) { setErrorMsg('Renseignez votre chiffre d\'affaires (etape 4).'); return }
    const alreadyTransmitted = ctx.acces.statut === 'soumis'
    if (!confirm(alreadyTransmitted ? 'Mettre a jour votre offre ? Cela remplace l\'offre precedente.' : 'Confirmer la soumission ?')) return
    setSubmitting(true); setErrorMsg(null)
    const payload = ctx.lignes.map((l) => {
      const mod = modifiedLines[l.id]
      const stQRaw = quantitiesSt[l.id]
      const hasStQ = stQRaw !== undefined && stQRaw !== ''
      const quantiteSt = mod
        ? parseNum(mod.quantite)
        : hasStQ
          ? parseNum(stQRaw)
          : undefined
      return {
        chiffrage_ligne_id: l.id,
        prix_unitaire: parseNum(prices[l.id] ?? ''),
        quantite_st: quantiteSt,
        designation_st: mod ? mod.designation : undefined,
        detail_st: mod ? mod.detail : undefined,
        unite_st: mod ? mod.unite : undefined,
        commentaire_st: comments[l.id] || undefined,
        modifie_par_st: !!mod,
      }
    })
    const propsPayload = validProps.map((p) => ({
      designation: p.designation.trim(),
      quantite: p.type === 'chapitre' ? 0 : parseNum(p.quantite),
      unite: p.type === 'chapitre' ? '' : p.unite,
      prix_unitaire: p.type === 'chapitre' ? 0 : parseNum(p.prix_unitaire),
      parent_designation: p.type === 'ouvrage' ? p.parent_designation.trim() : '',
    }))
    const { error } = await supabase.rpc('submit_dce_offre' as never, {
      p_token: token, p_lignes: payload, p_notes: notes.trim() || null, p_propositions: propsPayload,
    } as never)
    setSubmitting(false)
    if (error) { setErrorMsg(`Erreur : ${error.message}`); return }
    await saveCa()
    // Rafraichit le contexte pour refleter le statut 'soumis' (offre reste modifiable)
    const { data: refreshed } = await supabase.rpc('get_dce_context' as never, { p_token: token } as never)
    if (refreshed) setCtx(refreshed as DceContext)
    setDraftSavedAt(new Date())
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /* ── Stepper meta ────────────────────────── */
  const hasAnyPrice = ctx ? ctx.lignes.some((l) => parseNum(prices[l.id] ?? '') > 0) : false
  const hasAnyProposition = propositions.some((p) => p.designation.trim() && (p.type === 'chapitre' || parseNum(p.prix_unitaire) > 0))

  // Chapitres disponibles : ceux du DPGF (type='chapitre') + ceux ajoutes par le ST (type='chapitre')
  const chapitresDisponibles = useMemo(() => {
    if (!ctx) return [] as string[]
    const fromDpgf = ctx.lignes
      .filter((l) => l.type === 'chapitre' && (l.designation ?? '').trim())
      .map((l) => l.designation as string)
    const fromSt = propositions
      .filter((p) => p.type === 'chapitre' && p.designation.trim())
      .map((p) => p.designation.trim())
    // Dedup
    return Array.from(new Set([...fromDpgf, ...fromSt]))
  }, [ctx, propositions])
  const steps: { id: Step; label: string; done: boolean }[] = [
    { id: 1, label: 'Documents', done: allDocsDeposited },
    { id: 2, label: 'DPGF & Prix', done: hasAnyPrice },
    { id: 3, label: 'Propositions', done: hasAnyProposition },
    { id: 4, label: 'Chiffre d\'affaires', done: submitted },
  ]

  /* ── Render ──────────────────────────────── */
  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center"><div className="text-sm text-gray-400">Chargement...</div></div>
  if (notFound || !ctx) return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <h1 className="text-lg font-semibold text-gray-900 mb-2">Lien invalide ou expire</h1>
        <p className="text-sm text-gray-500">Veuillez contacter l'expediteur du dossier de consultation.</p>
      </div>
    </div>
  )

  const { acces, lot, projet_nom, lignes } = ctx

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="API Renovation" width={48} height={48} className="object-contain" priority />
            <div>
              <h1 className="text-base font-semibold text-gray-900">API Renovation</h1>
              <p className="text-xs text-gray-500">Dossier de Consultation des Entreprises</p>
            </div>
          </div>
          {acces.date_limite && (
            <div className="text-right">
              <p className="text-xs text-gray-500">Date limite</p>
              <p className="text-sm font-semibold text-gray-900">
                {new Date(acces.date_limite).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Submitted banner (decision finale) */}
        {submitted && acces.statut !== 'decline_st' && (
          <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-4 flex items-start gap-3">
            <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Votre offre a ete transmise a API Renovation.</p>
              <p className="text-xs mt-1 text-green-700">Merci pour votre participation.</p>
            </div>
          </div>
        )}

        {/* Banniere : consultation declinee par le ST */}
        {acces.statut === 'decline_st' && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 flex items-start gap-3">
            <X className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Vous avez décliné cette consultation.</p>
              {acces.decline_motif && <p className="text-xs mt-1 text-red-700">Motif : {acces.decline_motif}</p>}
              <p className="text-xs mt-1 text-red-700">API Rénovation a été informé.</p>
            </div>
          </div>
        )}

        {/* Bandeau : offre soumise mais re-modifiable */}
        {!submitted && acces.statut === 'soumis' && (
          <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-lg p-4 flex items-start gap-3">
            <Check className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-sm">Offre transmise — modifiable</p>
              <p className="text-xs mt-1 text-blue-800">
                Votre offre a deja ete envoyee a API Renovation
                {acces.date_limite && <> mais reste modifiable jusqu&apos;au {new Date(acces.date_limite).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</>}
                . Toute modification suivie d&apos;un nouveau « Soumettre » remplace l&apos;offre precedente.
              </p>
            </div>
          </div>
        )}

        {/* Negociations recues du CO / Eco */}
        {negos.length > 0 && (
          <section className="bg-amber-50/60 border border-amber-200 rounded-lg p-5 space-y-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-700" />
              <h3 className="text-sm font-semibold text-amber-900">
                {negos.length === 1 ? 'Demande de négociation reçue' : `${negos.length} demandes de négociation reçues`}
              </h3>
            </div>
            {negos.map((n) => {
              const isClosed = n.statut === 'accepte' || n.statut === 'refuse'
              const canRespond = n.tour === 'st' && !isClosed
              const hasResponded = !canRespond && !!n.reponse_st_decision
              const isFinanciere = n.type === 'financiere'
              const lignes = n.lignes_data ?? []
              return (
                <div key={n.id} className="bg-white border border-amber-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${isFinanciere ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                        {isFinanciere ? 'Négociation financière' : 'Négociation technique'}
                      </span>
                      <p className="text-xs text-gray-400 mt-1">
                        Reçu le {new Date(n.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                    {hasResponded && (
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        n.reponse_st_decision === 'accepte' ? 'bg-emerald-100 text-emerald-800' :
                        n.reponse_st_decision === 'refuse' ? 'bg-red-100 text-red-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {n.reponse_st_decision === 'accepte' ? 'Vous avez accepté' :
                         n.reponse_st_decision === 'refuse' ? 'Vous avez refusé' :
                         'Contre-proposition envoyée'}
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{n.contenu}</p>

                  {isFinanciere && lignes.length > 0 && (
                    <div className="border border-gray-200 rounded-md overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                            <th className="px-3 py-1.5">Ouvrage</th>
                            <th className="px-3 py-1.5 text-right">Qté</th>
                            <th className="px-3 py-1.5 text-right">PU initial</th>
                            <th className="px-3 py-1.5 text-right">PU proposé</th>
                            <th className="px-3 py-1.5 text-right">Total proposé</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lignes.map((l) => {
                            const diff = l.prix_unitaire_initial > 0
                              ? ((l.prix_unitaire_propose - l.prix_unitaire_initial) / l.prix_unitaire_initial) * 100
                              : 0
                            return (
                              <tr key={l.ligne_id} className="border-t border-gray-100">
                                <td className="px-3 py-1.5 text-gray-900">{l.designation}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums text-gray-700">{l.quantite} {l.unite ?? ''}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums text-gray-600">{formatCurrency(l.prix_unitaire_initial)}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">
                                  <span className="font-semibold text-amber-800">{formatCurrency(l.prix_unitaire_propose)}</span>
                                  {diff !== 0 && (
                                    <span className={`ml-1 text-[10px] ${diff < 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                      ({diff > 0 ? '+' : ''}{diff.toFixed(1)}%)
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-1.5 text-right tabular-nums text-gray-900 font-medium">
                                  {fmtNum(l.prix_unitaire_propose * l.quantite)} EUR
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {!isFinanciere && lignes.length > 0 && (
                    <div className="border border-gray-200 rounded-md overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                            <th className="px-3 py-1.5">Ouvrage</th>
                            <th className="px-3 py-1.5 text-right">Qté initiale</th>
                            <th className="px-3 py-1.5 text-right">Qté demandée</th>
                            <th className="px-3 py-1.5">Unité demandée</th>
                            <th className="px-3 py-1.5">Détail demandé</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lignes.map((l) => {
                            const qDiff = (l.quantite_proposee != null && l.quantite > 0)
                              ? ((l.quantite_proposee - l.quantite) / l.quantite) * 100
                              : null
                            return (
                              <tr key={l.ligne_id} className="border-t border-gray-100">
                                <td className="px-3 py-1.5 text-gray-900">{l.designation}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums text-gray-600">{l.quantite} {l.unite ?? ''}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">
                                  {l.quantite_proposee != null ? (
                                    <>
                                      <span className="font-semibold text-blue-800">{l.quantite_proposee}</span>
                                      {qDiff != null && qDiff !== 0 && (
                                        <span className={`ml-1 text-[10px] ${qDiff < 0 ? 'text-emerald-700' : 'text-blue-700'}`}>
                                          ({qDiff > 0 ? '+' : ''}{qDiff.toFixed(1)}%)
                                        </span>
                                      )}
                                    </>
                                  ) : <span className="text-gray-300">inchangée</span>}
                                </td>
                                <td className="px-3 py-1.5 text-gray-700">
                                  {l.unite_proposee ? <span className="font-semibold text-blue-800">{l.unite_proposee}</span> : <span className="text-gray-300">inchangée</span>}
                                </td>
                                <td className="px-3 py-1.5 text-gray-700">
                                  {l.detail_propose ? <span className="text-blue-900 whitespace-pre-wrap">{l.detail_propose}</span> : <span className="text-gray-300">—</span>}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {isFinanciere && n.montant_initial != null && n.montant_negocie != null && (
                    <div className="bg-gray-50 border border-gray-200 rounded-md p-3 flex items-center justify-between text-sm">
                      <span className="text-gray-500">Montant initial : <span className="font-semibold text-gray-700 tabular-nums">{fmtNum(Number(n.montant_initial))} EUR</span></span>
                      <span className="text-amber-800">Montant proposé : <span className="font-bold tabular-nums">{fmtNum(Number(n.montant_negocie))} EUR</span></span>
                    </div>
                  )}

                  {n.reponse_st && (
                    <div className="bg-gray-50 border border-gray-200 rounded-md p-2.5 text-xs text-gray-700">
                      <p className="font-semibold text-gray-500 uppercase tracking-wider mb-1">Votre réponse</p>
                      <p className="whitespace-pre-wrap">{n.reponse_st}</p>
                    </div>
                  )}

                  {canRespond && (
                    <div className="space-y-3 pt-2 border-t border-gray-100">
                      {/* Contre-proposition par ligne */}
                      {lignes.length > 0 && (
                        <details className="border border-amber-200 rounded-md bg-amber-50/30">
                          <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-50">
                            Proposer une contre-offre par ouvrage (optionnel)
                          </summary>
                          <div className="p-2 overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead className="bg-gray-50">
                                <tr className="text-left text-[10px] font-medium text-gray-500 uppercase">
                                  <th className="px-2 py-1">Ouvrage</th>
                                  {isFinanciere && <th className="px-2 py-1 text-right">PU contre-proposé</th>}
                                  <th className="px-2 py-1 text-right">Qté contre-proposée</th>
                                  <th className="px-2 py-1">Unité</th>
                                  <th className="px-2 py-1">Détail</th>
                                </tr>
                              </thead>
                              <tbody>
                                {lignes.map((l) => {
                                  const counter = negoCounterLignes[n.id]?.[l.ligne_id] ?? { prix: '', quantite: '', unite: '', detail: '' }
                                  return (
                                    <tr key={l.ligne_id} className="border-t border-gray-100">
                                      <td className="px-2 py-1.5 text-gray-800">{l.designation}</td>
                                      {isFinanciere && (
                                        <td className="px-2 py-1.5 text-right">
                                          <input
                                            type="text"
                                            inputMode="decimal"
                                            value={counter.prix}
                                            onChange={(e) => updateCounterLigne(n.id, l.ligne_id, { prix: e.target.value })}
                                            placeholder={String(l.prix_unitaire_propose)}
                                            className="w-24 px-1.5 py-1 text-xs border border-gray-200 rounded text-right focus:outline-none focus:border-amber-500"
                                          />
                                        </td>
                                      )}
                                      <td className="px-2 py-1.5 text-right">
                                        <input
                                          type="text"
                                          inputMode="decimal"
                                          value={counter.quantite}
                                          onChange={(e) => updateCounterLigne(n.id, l.ligne_id, { quantite: e.target.value })}
                                          placeholder={String(l.quantite_proposee ?? l.quantite)}
                                          className="w-20 px-1.5 py-1 text-xs border border-gray-200 rounded text-right focus:outline-none focus:border-amber-500"
                                        />
                                      </td>
                                      <td className="px-2 py-1.5">
                                        <input
                                          type="text"
                                          value={counter.unite}
                                          onChange={(e) => updateCounterLigne(n.id, l.ligne_id, { unite: e.target.value })}
                                          placeholder={l.unite_proposee ?? l.unite ?? ''}
                                          className="w-16 px-1.5 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-amber-500"
                                        />
                                      </td>
                                      <td className="px-2 py-1.5">
                                        <input
                                          type="text"
                                          value={counter.detail}
                                          onChange={(e) => updateCounterLigne(n.id, l.ligne_id, { detail: e.target.value })}
                                          placeholder={l.detail_propose ?? '—'}
                                          className="w-full min-w-[120px] px-1.5 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-amber-500"
                                        />
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </details>
                      )}

                      <textarea
                        rows={2}
                        value={negoMessages[n.id] ?? ''}
                        onChange={(e) => setNegoMessages({ ...negoMessages, [n.id]: e.target.value })}
                        placeholder="Votre message (optionnel) — justification, commentaire libre…"
                        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-amber-500 resize-none"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => respondNego(n.id, 'accepte')}
                          disabled={respondingId === n.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" /> Accepter
                        </button>
                        <button
                          onClick={() => respondNego(n.id, 'contre_proposition')}
                          disabled={
                            respondingId === n.id ||
                            (!(negoMessages[n.id]?.trim()) && Object.keys(negoCounterLignes[n.id] ?? {}).length === 0)
                          }
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-100 border border-amber-300 rounded-md hover:bg-amber-200 disabled:opacity-40"
                          title="Saisissez un message ou une contre-offre par ligne"
                        >
                          Contre-proposition
                        </button>
                        <button
                          onClick={() => respondNego(n.id, 'refuse')}
                          disabled={respondingId === n.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" /> Refuser
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Affichage des contre-propositions par ligne envoyees par le ST */}
                  {hasResponded && n.reponse_st_lignes && n.reponse_st_lignes.length > 0 && (
                    <div className="border border-amber-300 rounded-md overflow-hidden">
                      <div className="bg-amber-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-900">
                        Votre contre-offre envoyée
                      </div>
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr className="text-left text-[10px] font-medium text-gray-500 uppercase">
                            <th className="px-3 py-1.5">Ouvrage</th>
                            {isFinanciere && <th className="px-3 py-1.5 text-right">PU</th>}
                            <th className="px-3 py-1.5 text-right">Qté</th>
                            <th className="px-3 py-1.5">Unité</th>
                            <th className="px-3 py-1.5">Détail</th>
                          </tr>
                        </thead>
                        <tbody>
                          {n.reponse_st_lignes.map((rl) => {
                            const orig = lignes.find((x) => x.ligne_id === rl.ligne_id)
                            return (
                              <tr key={rl.ligne_id} className="border-t border-gray-100">
                                <td className="px-3 py-1.5 text-gray-800">{orig?.designation ?? rl.ligne_id}</td>
                                {isFinanciere && (
                                  <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-amber-900">
                                    {rl.prix_unitaire != null ? formatCurrency(rl.prix_unitaire) : '—'}
                                  </td>
                                )}
                                <td className="px-3 py-1.5 text-right tabular-nums text-gray-800">
                                  {rl.quantite != null ? rl.quantite : '—'}
                                </td>
                                <td className="px-3 py-1.5 text-gray-700">{rl.unite ?? '—'}</td>
                                <td className="px-3 py-1.5 text-gray-700">{rl.detail ?? '—'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </section>
        )}

        {/* Project info */}
        <section className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="text-xs text-gray-500 uppercase tracking-wider">Projet</div>
          <h2 className="text-lg font-semibold text-gray-900 mt-1">{projet_nom}</h2>
          <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 uppercase tracking-wider">Lot consulte</div>
          <p className="text-base font-medium text-gray-900 mt-1">{lot.nom}</p>
          {acces.st_nom && (
            <p className="mt-3 text-xs text-gray-500">
              Invitation adressee a <span className="text-gray-900 font-medium">{acces.st_nom}</span>
              {acces.st_societe && <span> - {acces.st_societe}</span>}
            </p>
          )}
        </section>

        {/* Identity form for anonymous links */}
        {needsIdentity && !submitted && (
          <section className="bg-amber-50 border border-amber-200 rounded-lg p-5 space-y-3">
            <div className="flex items-start gap-2">
              <User className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-amber-900">Identifiez-vous</h3>
                <p className="text-xs text-amber-700 mt-0.5">Ces informations sont necessaires avant de continuer.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Nom *</label>
                <input type="text" value={identNom} onChange={(e) => setIdentNom(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-md focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Societe</label>
                <input type="text" value={identSociete} onChange={(e) => setIdentSociete(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-md focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Email *</label>
                <input type="email" value={identEmail} onChange={(e) => setIdentEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-md focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Telephone</label>
                <input type="tel" value={identTel} onChange={(e) => setIdentTel(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-md focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <button onClick={saveIdentity} disabled={savingIdent || !identNom.trim() || !identEmail.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-black disabled:bg-gray-300">
              {savingIdent ? 'Enregistrement...' : 'Valider'}
            </button>
          </section>
        )}

        {/* Bouton decliner la consultation (visible tant qu'aucune decision finale) */}
        {!needsIdentity && !submitted && (
          <div className="flex justify-end">
            <button
              onClick={() => setShowDecline(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 border border-red-200 bg-white rounded-md hover:bg-red-50"
            >
              <X className="w-3.5 h-3.5" /> Décliner cette consultation
            </button>
          </div>
        )}

        {/* Stepper */}
        {!needsIdentity && !submitted && (
          <>
            <div className="flex items-center gap-2 justify-center">
              {steps.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2">
                  <button
                    onClick={() => setStep(s.id)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors',
                      s.id === step ? 'bg-gray-900 text-white' :
                      s.done ? 'bg-[#EAF3DE] text-[#3B6D11] border border-[#C7E09A]' :
                      'bg-gray-100 text-gray-400',
                    )}
                  >
                    {s.done ? (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M20 6 9 17l-5-5" /></svg>
                    ) : (
                      <span className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center text-xs font-bold">{s.id}</span>
                    )}
                    {s.label}
                  </button>
                  {i < steps.length - 1 && <ChevronRight className="w-4 h-4 text-gray-300" />}
                </div>
              ))}
            </div>

            {/* ══════ STEP 1: Documents ══════ */}
            {step === 1 && (
              <section className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Vos documents administratifs</h3>
                  <p className="text-xs text-gray-500 mt-1">Ces documents sont obligatoires avant de pouvoir soumettre votre offre.</p>
                </div>
                {DOC_TYPES.map((dt) => {
                  const existing = docs.find((d) => d.type_doc === dt.type)
                  const isUploading = uploadingDoc === dt.type
                  const dateMissing = !!existing && dt.hasDate && !existing.date_validite
                  const dateCheck = existing && dt.hasDate && existing.date_validite
                    ? checkDocDate(dt, existing.date_validite)
                    : { ok: true }
                  const dateInvalid = !!existing && dt.hasDate && !!existing.date_validite && !dateCheck.ok
                  // Etats : vert (depose + date OK), ambre (date manquante), rouge (date invalide), neutre (pas depose)
                  const state: 'ok' | 'amber' | 'red' | 'none' =
                    !existing ? 'none' :
                    dateInvalid ? 'red' :
                    dateMissing ? 'amber' :
                    'ok'
                  return (
                    <div
                      key={dt.type}
                      className={cn(
                        'rounded-lg p-4 flex items-start gap-3 flex-wrap',
                        state === 'ok' && 'bg-[#EAF3DE] border border-[#3B6D11]',
                        state === 'amber' && 'bg-[#FAEEDA] border border-[#E8D4A6]',
                        state === 'red' && 'bg-red-50 border border-red-300',
                        state === 'none' && 'bg-white border-[1.5px] border-dashed border-[#D3D1C7]',
                      )}
                    >
                      <div className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0"
                        style={{
                          background:
                            state === 'ok' ? '#EAF3DE' :
                            state === 'amber' ? '#FAEEDA' :
                            state === 'red' ? '#FEE2E2' :
                            '#F7F6F2',
                        }}>
                        {existing ? (
                          state === 'red' ? (
                            <X className="w-5 h-5 text-red-600" />
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke={state === 'amber' ? '#854F0B' : '#3B6D11'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M20 6 9 17l-5-5" /></svg>
                          )
                        ) : (
                          <FileText className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-gray-900">
                            {dt.label}
                            {!dt.required && <span className="ml-2 text-xs text-gray-400 font-normal">(optionnel)</span>}
                          </p>
                          {state === 'ok' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#3B6D11] text-white rounded">
                              <Check className="w-3 h-3" />
                              Depose
                            </span>
                          )}
                          {state === 'amber' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#854F0B] text-white rounded">
                              <AlertCircle className="w-3 h-3" />
                              Date manquante
                            </span>
                          )}
                          {state === 'red' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-red-600 text-white rounded">
                              <AlertCircle className="w-3 h-3" />
                              Refuse
                            </span>
                          )}
                        </div>
                        {'note' in dt && dt.note && <p className="text-xs text-gray-500 mt-0.5">{dt.note}</p>}
                        {existing && (
                          <p className={cn(
                            'text-xs mt-1 flex items-center gap-1 break-all',
                            state === 'red' ? 'text-red-700' : 'text-[#3B6D11]',
                          )}>
                            <Check className="w-3 h-3 flex-shrink-0" />
                            {existing.nom_fichier}
                          </p>
                        )}
                        {state === 'red' && dateCheck.reason && (
                          <p className="text-xs text-red-700 mt-1 font-medium">
                            ⚠ {dateCheck.reason}. Veuillez fournir un document valable.
                          </p>
                        )}
                        {existing && dt.hasDate && (
                          <div className="mt-2">
                            <label className="block text-[11px] text-gray-500 mb-0.5">
                              Date de fin de validite {dt.required && <span className="text-red-600">*</span>}
                            </label>
                            <input
                              type="date"
                              value={existing.date_validite ?? ''}
                              onChange={(e) => setDocDate(existing.id, e.target.value)}
                              className={cn(
                                'px-2 py-1 text-xs border rounded focus:outline-none focus:border-blue-500',
                                state === 'red' ? 'border-red-400 bg-white' :
                                state === 'amber' ? 'border-[#854F0B] bg-white' :
                                'border-gray-200',
                              )}
                            />
                          </div>
                        )}
                      </div>
                      <label className={cn(
                        'flex items-center gap-1.5 px-3 py-2 text-sm rounded-md cursor-pointer flex-shrink-0',
                        state === 'red' ? 'border border-red-500 text-red-600 bg-white hover:bg-red-50' :
                        existing ? 'border border-[#3B6D11] text-[#3B6D11] bg-white hover:bg-gray-50' :
                        'bg-gray-900 text-white hover:bg-black',
                        isUploading && 'opacity-60 pointer-events-none',
                      )}>
                        <Upload className="w-3.5 h-3.5" />
                        {isUploading ? 'Envoi...' : existing ? 'Remplacer' : 'Deposer'}
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" disabled={isUploading}
                          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadDoc(dt.type, f) }} />
                      </label>
                    </div>
                  )
                })}

                {!allDocsDeposited && (
                  <div className={cn(
                    'rounded-md p-3 text-xs flex items-start gap-2 border',
                    invalidDatesCount > 0
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-amber-50 border-amber-200 text-amber-800',
                  )}>
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Pour passer a l'etape suivante :</p>
                      <ul className="list-disc list-inside mt-1 space-y-0.5">
                        {missingDocsCount > 0 && <li>Deposer {missingDocsCount} document{missingDocsCount > 1 ? 's' : ''} obligatoire{missingDocsCount > 1 ? 's' : ''} manquant{missingDocsCount > 1 ? 's' : ''}</li>}
                        {missingDatesCount > 0 && <li>Renseigner {missingDatesCount} date{missingDatesCount > 1 ? 's' : ''} de validite</li>}
                        {invalidDatesCount > 0 && <li>Remplacer {invalidDatesCount} document{invalidDatesCount > 1 ? 's' : ''} dont la date est invalide (trop ancienne, expiree ou dans le futur)</li>}
                      </ul>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => { if (allDocsDeposited) setStep(2) }}
                  disabled={!allDocsDeposited}
                  className="w-full py-3 text-sm font-semibold text-white bg-[#1a1a1a] rounded-md hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Passer a l'etape suivante
                </button>
              </section>
            )}

            {/* ══════ STEP 4: Chiffre d'affaires ══════ */}
            {step === 4 && (
              <section className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Votre chiffre d'affaires annuel</h3>
                  <p className="text-xs text-gray-500 mt-1">Cette information nous permet de verifier que ce projet est compatible avec votre capacite financiere.</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Chiffre d'affaires annuel HT *</label>
                    <div className="flex items-center gap-2">
                      <input type="number" step="1000" value={caAnnuel}
                        onChange={(e) => setCaAnnuel(e.target.value)}
                        onBlur={saveCa}
                        placeholder="ex: 850000"
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500 tabular-nums" />
                      <span className="text-sm text-gray-500">EUR HT</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Justificatif (recommande)</label>
                    <label className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md cursor-pointer border border-gray-200 text-gray-700 hover:bg-gray-50',
                      uploadingCa && 'opacity-60 pointer-events-none',
                    )}>
                      <Upload className="w-3.5 h-3.5" />
                      {uploadingCa ? 'Envoi...' : caDocNom ?? 'Deposer un bilan ou attestation'}
                      <input type="file" accept=".pdf" className="hidden" disabled={uploadingCa}
                        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadCaDoc(f) }} />
                    </label>
                    {caDocNom && <p className="text-xs text-gray-500 mt-1">{caDocNom}</p>}
                  </div>
                  {caValue > 0 && (
                    <div className={cn(
                      'rounded-md p-3 text-sm',
                      ratioAlerte ? 'bg-[#FAEEDA] text-[#854F0B] border border-[#E8D4A6]' : 'bg-[#EAF3DE] text-[#3B6D11] border border-[#C7E09A]',
                    )}>
                      {ratioAlerte ? (
                        <>
                          <p className="font-medium">Attention : ce projet (montant {fmtNum(total)} EUR HT) represente {ratio.toFixed(1)}% de votre CA annuel, soit plus d'1/3.</p>
                          <p className="text-xs mt-1">API Renovation en sera informe. Cela ne bloque pas votre candidature.</p>
                        </>
                      ) : (
                        <>
                          <p className="font-medium">Ce projet (montant {fmtNum(total)} EUR HT) represente {ratio.toFixed(1)}% de votre CA annuel.</p>
                          <p className="text-xs mt-1">Votre capacite financiere est compatible.</p>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Recap montant offre */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Montant de votre offre</p>
                    <p className="text-xl font-bold text-gray-900 tabular-nums mt-0.5">{fmtNum(total)} EUR HT</p>
                  </div>
                  <button
                    onClick={() => setStep(2)}
                    className="text-xs text-gray-500 hover:text-gray-900 underline"
                  >
                    Modifier l'offre
                  </button>
                </div>

                {errorMsg && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{errorMsg}</div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={submitting || lignes.length === 0 || caValue <= 0}
                  className="w-full py-3 text-sm font-semibold text-white bg-[#1a1a1a] rounded-md hover:bg-black disabled:opacity-40"
                >
                  {submitting ? 'Envoi en cours...' : acces.statut === 'soumis' ? 'Mettre a jour mon offre' : 'Soumettre mon offre'}
                </button>
              </section>
            )}

            {/* ══════ STEP 2: DPGF & Prix ══════ */}
            {step === 2 && (
              <section className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Votre offre de prix</h3>
                  <p className="text-xs text-gray-500 mt-1">Remplissez vos prix unitaires pour chaque poste. La colonne <span className="text-amber-700 font-medium">Quantite ST</span> vous permet d'indiquer votre propre quantite si elle differe de celle prevue.</p>
                </div>

                {/* CCTP + Plans downloads */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {lot.cctp_url && (
                    <a href={lot.cctp_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                      <Download className="w-4 h-4 text-gray-500" />
                      Telecharger le CCTP
                      {lot.cctp_nom_fichier && <span className="text-xs text-gray-400">({lot.cctp_nom_fichier})</span>}
                    </a>
                  )}
                  {lot.plans_urls && lot.plans_urls.length > 0 && lot.plans_urls.map((p, i) => (
                    <a key={i} href={p.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                      <Download className="w-4 h-4 text-gray-500" />
                      {p.nom}
                    </a>
                  ))}
                </div>

                {/* Table */}
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr className="text-left text-xs font-medium text-gray-500">
                          <th className="px-3 py-2 w-10">N</th>
                          <th className="px-3 py-2 min-w-[180px]">Designation</th>
                          <th className="px-3 py-2 min-w-[120px]">Detail</th>
                          <th className="px-3 py-2 w-20">Quantite</th>
                          <th className="px-3 py-2 w-24 bg-amber-50/50 text-amber-800">Quantite ST</th>
                          <th className="px-3 py-2 w-20">Unite</th>
                          <th className="px-3 py-2 w-32">PU HT</th>
                          <th className="px-3 py-2 w-28 text-right">Total HT</th>
                          <th className="px-3 py-2 w-40">Commentaire</th>
                          <th className="px-3 py-2 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {lignes.map((l, idx) => {
                          const origQ = Number(l.quantite) || 0
                          const mod = modifiedLines[l.id]
                          const isModified = !!mod

                          if (isModified) {
                            // Ligne originale figee + ligne ST editable en dessous
                            const modQ = parseNum(mod.quantite)
                            const pu = parseNum(prices[l.id] ?? '')
                            const t = modQ * pu
                            return (
                              <Fragment key={l.id}>
                                {/* Ligne originale figee (economiste) */}
                                <tr className="border-t border-gray-100 bg-gray-50">
                                  <td className="px-3 py-2 text-gray-300 tabular-nums">{idx + 1}</td>
                                  <td className="px-3 py-2 text-gray-400 line-through">{l.designation}</td>
                                  <td className="px-3 py-2 text-xs text-gray-300 line-through">{l.detail}</td>
                                  <td className="px-3 py-2 text-right text-gray-400 tabular-nums line-through">{origQ}</td>
                                  <td className="px-3 py-2 bg-amber-50/30 text-gray-300 text-xs">-</td>
                                  <td className="px-3 py-2 text-gray-300 text-xs">{uniteLabel(l.unite)}</td>
                                  <td className="px-3 py-2 text-gray-300 text-xs">-</td>
                                  <td className="px-3 py-2 text-right text-gray-300">-</td>
                                  <td className="px-3 py-2 text-xs text-gray-300 italic">Ligne originale</td>
                                  <td className="px-3 py-2">
                                    <button onClick={() => cancelModifyLine(l.id)}
                                      title="Annuler la modification"
                                      className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                                {/* Ligne modifiee editable (ST) */}
                                <tr className="border-t border-dashed border-amber-300 bg-amber-50/50">
                                  <td className="px-3 py-2">
                                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">{idx + 1}'</span>
                                  </td>
                                  <td className="px-3 py-2">
                                    <input type="text" value={mod.designation}
                                      onChange={(e) => updateModLine(l.id, 'designation', e.target.value)}
                                      className="w-full px-2 py-1 text-sm border border-amber-200 rounded bg-white focus:outline-none focus:border-amber-500" />
                                  </td>
                                  <td className="px-3 py-2">
                                    <input type="text" value={mod.detail}
                                      onChange={(e) => updateModLine(l.id, 'detail', e.target.value)}
                                      className="w-full px-2 py-1 text-xs border border-amber-200 rounded bg-white focus:outline-none focus:border-amber-500" />
                                  </td>
                                  <td className="px-3 py-2 text-right text-gray-300 tabular-nums text-xs italic">-</td>
                                  <td className="px-3 py-2 bg-amber-50">
                                    <input type="number" step="0.01" value={mod.quantite}
                                      onChange={(e) => updateModLine(l.id, 'quantite', e.target.value)}
                                      className="w-full px-2 py-1 text-sm border border-amber-300 rounded bg-white focus:outline-none focus:border-amber-500 tabular-nums text-right" />
                                  </td>
                                  <td className="px-3 py-2">
                                    <select value={mod.unite}
                                      onChange={(e) => updateModLine(l.id, 'unite', e.target.value)}
                                      className="w-full px-1 py-1 text-xs border border-amber-200 rounded bg-white focus:outline-none focus:border-amber-500">
                                      {UNITES.map((u) => <option key={u} value={u}>{uniteLabel(u)}</option>)}
                                    </select>
                                  </td>
                                  <td className="px-3 py-2">
                                    <div className="relative">
                                      <input type="number" step="0.01"
                                        value={prices[l.id] ?? ''}
                                        onChange={(e) => setPrices({ ...prices, [l.id]: e.target.value })}
                                        placeholder="Prix"
                                        className="w-full pl-2 pr-6 py-1 text-sm border border-amber-200 rounded bg-white focus:outline-none focus:border-amber-500 tabular-nums" />
                                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">EUR</span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums font-medium text-amber-900">
                                    {pu > 0 && modQ > 0 ? fmtNum(t) + ' EUR' : '-'}
                                  </td>
                                  <td className="px-3 py-2">
                                    <input type="text"
                                      value={comments[l.id] ?? ''}
                                      onChange={(e) => setComments({ ...comments, [l.id]: e.target.value })}
                                      placeholder="..."
                                      className="w-full px-2 py-1 text-xs border border-amber-200 rounded bg-white focus:outline-none focus:border-amber-500" />
                                  </td>
                                  <td className="px-3 py-2">
                                    <span className="inline-block px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded">Modifie</span>
                                  </td>
                                </tr>
                              </Fragment>
                            )
                          }

                          // Ligne normale (non modifiee)
                          const stQRaw = quantitiesSt[l.id]
                          const hasStQ = stQRaw !== undefined && stQRaw !== ''
                          const curQ = hasStQ ? parseNum(stQRaw) : origQ
                          const pu = parseNum(prices[l.id] ?? '')
                          const t = curQ * pu
                          return (
                            <tr key={l.id} className="border-t border-gray-100">
                              <td className="px-3 py-2 text-gray-400 tabular-nums">{idx + 1}</td>
                              <td className="px-3 py-2 text-gray-900">{l.designation}</td>
                              <td className="px-3 py-2 text-xs text-gray-500">{l.detail}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-gray-700">{origQ}</td>
                              <td className="px-3 py-2 bg-amber-50/30">
                                <input type="number" step="0.01"
                                  value={stQRaw ?? ''}
                                  onChange={(e) => setQuantitiesSt({ ...quantitiesSt, [l.id]: e.target.value })}
                                  placeholder={String(origQ)}
                                  className="w-full px-2 py-1 text-sm border border-amber-200 rounded bg-white focus:outline-none focus:border-amber-500 tabular-nums text-right" />
                              </td>
                              <td className="px-3 py-2 text-gray-700 text-xs">{uniteLabel(l.unite)}</td>
                              <td className="px-3 py-2">
                                <div className="relative">
                                  <input type="number" step="0.01"
                                    value={prices[l.id] ?? ''}
                                    onChange={(e) => setPrices({ ...prices, [l.id]: e.target.value })}
                                    placeholder="Prix"
                                    className="w-full pl-2 pr-6 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-500 tabular-nums" />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">EUR</span>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums font-medium text-gray-900">
                                {pu > 0 && curQ > 0 ? fmtNum(t) + ' EUR' : '-'}
                              </td>
                              <td className="px-3 py-2">
                                <input type="text"
                                  value={comments[l.id] ?? ''}
                                  onChange={(e) => setComments({ ...comments, [l.id]: e.target.value })}
                                  placeholder="..."
                                  className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-blue-500" />
                              </td>
                              <td className="px-3 py-2">
                                <button onClick={() => startModifyLine(l)}
                                  title="Modifier cette ligne"
                                  className="p-1 text-gray-400 hover:text-gray-700 transition-colors">
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                        <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold">
                          <td colSpan={8} className="px-3 py-3 text-right text-gray-700 uppercase text-xs tracking-wider">Total lot HT</td>
                          <td className="px-3 py-3 text-right text-gray-900 tabular-nums text-base">{fmtNum(total)} EUR</td>
                          <td />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="px-5 py-4 border-t border-gray-200 bg-gray-50">
                    <label className="block text-xs text-gray-500 mb-1.5">Notes / Variantes (optionnel)</label>
                    <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
                      placeholder="Commentaires, variantes proposees..."
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500 resize-y" />
                  </div>
                </div>

                <button
                  onClick={() => { if (hasAnyPrice) setStep(3) }}
                  disabled={!hasAnyPrice}
                  className="w-full py-3 text-sm font-semibold text-white bg-[#1a1a1a] rounded-md hover:bg-black disabled:opacity-40"
                >
                  Passer a l'etape suivante
                </button>
              </section>
            )}

            {/* ══════ STEP 3: Propositions complementaires ══════ */}
            {step === 3 && (
              <section className="space-y-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">Propositions complementaires</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Ajoutez ici des ouvrages que vous souhaitez proposer en complement du DPGF.
                      Cette etape est optionnelle.
                    </p>
                  </div>
                  <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
                    {savingDraft
                      ? <span>Enregistrement…</span>
                      : draftSavedAt
                        ? <><Check className="w-3 h-3 text-emerald-500" /> Brouillon enregistré à {draftSavedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</>
                        : <span>Vos saisies sont enregistrées automatiquement</span>}
                  </p>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  {propositions.length === 0 ? (
                    <div className="p-6 text-center">
                      <p className="text-sm text-gray-500">Aucune proposition pour le moment.</p>
                      <p className="text-xs text-gray-400 mt-1">Commencez en ajoutant un chapitre ou un ouvrage ci-dessous.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr className="text-left text-xs font-medium text-gray-500">
                            <th className="px-3 py-2 w-12">N</th>
                            <th className="px-3 py-2 w-24">Type</th>
                            <th className="px-3 py-2 w-48">Chapitre parent</th>
                            <th className="px-3 py-2 min-w-[220px]">Designation</th>
                            <th className="px-3 py-2 w-24">Quantite</th>
                            <th className="px-3 py-2 w-20">Unite</th>
                            <th className="px-3 py-2 w-32">PU HT</th>
                            <th className="px-3 py-2 w-28 text-right">Total HT</th>
                            <th className="px-3 py-2 w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {propositions.map((p, idx) => {
                            const isChap = p.type === 'chapitre'
                            const q = parseNum(p.quantite)
                            const pu = parseNum(p.prix_unitaire)
                            const t = q * pu
                            const parentMissing = !isChap && !p.parent_designation.trim()
                            return (
                              <tr key={p.key} className={cn('border-t border-amber-100', isChap ? 'bg-amber-50' : 'bg-amber-50/40')}>
                                <td className="px-3 py-2 text-amber-700 tabular-nums text-xs font-medium">P{idx + 1}</td>
                                <td className="px-3 py-2">
                                  <span className={cn(
                                    'inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded',
                                    isChap ? 'bg-gray-900 text-white' : 'bg-amber-100 text-amber-800',
                                  )}>
                                    {isChap ? 'Chapitre' : 'Ouvrage'}
                                  </span>
                                </td>
                                <td className="px-3 py-2">
                                  {isChap ? (
                                    <span className="text-xs text-gray-400 italic">—</span>
                                  ) : (() => {
                                    const isCustom = !!p.parent_designation && !chapitresDisponibles.includes(p.parent_designation)
                                    const selectValue = isCustom ? '__autre__' : p.parent_designation
                                    return (
                                      <div className="space-y-1">
                                        <select
                                          value={selectValue}
                                          onChange={(e) => {
                                            const v = e.target.value
                                            if (v === '__autre__') {
                                              updateProposition(p.key, { parent_designation: ' ' })
                                            } else {
                                              updateProposition(p.key, { parent_designation: v })
                                            }
                                          }}
                                          className={cn(
                                            'w-full px-2 py-1.5 text-sm border rounded-md bg-white focus:outline-none focus:border-amber-500',
                                            parentMissing ? 'border-red-300 bg-red-50' : 'border-amber-200',
                                          )}
                                        >
                                          <option value="">Choisir un chapitre…</option>
                                          {chapitresDisponibles.map((c) => <option key={c} value={c}>{c}</option>)}
                                          <option value="__autre__">Autre (à préciser)</option>
                                        </select>
                                        {isCustom && (
                                          <input
                                            type="text"
                                            autoFocus
                                            value={p.parent_designation.trim() ? p.parent_designation : ''}
                                            onChange={(e) => updateProposition(p.key, { parent_designation: e.target.value })}
                                            placeholder="Nom du nouveau chapitre"
                                            className={cn(
                                              'w-full px-2 py-1.5 text-sm border rounded-md bg-white focus:outline-none focus:border-amber-500',
                                              !p.parent_designation.trim() ? 'border-red-300 bg-red-50' : 'border-amber-200',
                                            )}
                                          />
                                        )}
                                      </div>
                                    )
                                  })()}
                                </td>
                                <td className="px-3 py-2">
                                  <input type="text" value={p.designation}
                                    onChange={(e) => updateProposition(p.key, { designation: e.target.value })}
                                    placeholder={isChap ? 'Titre du chapitre' : 'Designation de l\'ouvrage'}
                                    className={cn(
                                      'w-full px-2 py-1.5 text-sm border rounded-md bg-white focus:outline-none focus:border-amber-500',
                                      isChap ? 'border-gray-300 font-semibold uppercase' : 'border-amber-200',
                                    )} />
                                </td>
                                <td className="px-3 py-2">
                                  {!isChap && (
                                    <input type="number" step="0.01" value={p.quantite}
                                      onChange={(e) => updateProposition(p.key, { quantite: e.target.value })}
                                      placeholder="0"
                                      className="w-full px-2 py-1.5 text-sm border border-amber-200 rounded-md bg-white focus:outline-none focus:border-amber-500 tabular-nums text-right" />
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  {!isChap && (
                                    <select value={p.unite}
                                      onChange={(e) => updateProposition(p.key, { unite: e.target.value })}
                                      className="w-full px-1 py-1.5 text-sm border border-amber-200 rounded-md bg-white focus:outline-none focus:border-amber-500">
                                      {UNITES.map((u) => <option key={u} value={u}>{uniteLabel(u)}</option>)}
                                    </select>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  {!isChap && (
                                    <div className="relative">
                                      <input type="number" step="0.01" value={p.prix_unitaire}
                                        onChange={(e) => updateProposition(p.key, { prix_unitaire: e.target.value })}
                                        placeholder="Prix"
                                        className="w-full pl-2 pr-7 py-1.5 text-sm border border-amber-200 rounded-md bg-white focus:outline-none focus:border-amber-500 tabular-nums" />
                                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">EUR</span>
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums font-medium text-amber-900">
                                  {!isChap && pu > 0 && q > 0 ? fmtNum(t) + ' EUR' : '-'}
                                </td>
                                <td className="px-3 py-2">
                                  <button onClick={() => removeProposition(p.key)}
                                    title="Supprimer"
                                    className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                          <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
                            <td colSpan={7} className="px-3 py-3 text-right text-gray-700 uppercase text-xs tracking-wider">Total propositions HT</td>
                            <td className="px-3 py-3 text-right text-gray-900 tabular-nums">{fmtNum(totalPropositions)} EUR</td>
                            <td />
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex flex-wrap items-center gap-2">
                    <button onClick={() => addProposition('ouvrage')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 border border-dashed border-amber-300 rounded-md hover:border-amber-500 hover:bg-amber-50 transition-colors">
                      + Ajouter un ouvrage
                    </button>
                  </div>
                </div>

                {/* Recap totaux */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">DPGF</p>
                    <p className="font-semibold text-gray-900 tabular-nums mt-0.5">{fmtNum(totalDpgf)} EUR</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-amber-700 uppercase tracking-wider">Propositions</p>
                    <p className="font-semibold text-amber-900 tabular-nums mt-0.5">{fmtNum(totalPropositions)} EUR</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Total offre HT</p>
                    <p className="font-bold text-gray-900 tabular-nums mt-0.5">{fmtNum(total)} EUR</p>
                  </div>
                </div>

                {(() => {
                  const orphelins = propositions.filter((p) => p.type === 'ouvrage' && p.designation.trim() && !p.parent_designation.trim()).length
                  if (orphelins === 0) return null
                  return (
                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-3 text-sm flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>
                        {orphelins} ouvrage{orphelins > 1 ? 's' : ''} propose{orphelins > 1 ? 's' : ''} sans chapitre parent. Selectionnez un chapitre dans la colonne « Chapitre parent ».
                      </span>
                    </div>
                  )
                })()}

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setStep(2)}
                    className="flex-1 py-3 text-sm font-medium text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50"
                  >
                    Retour DPGF
                  </button>
                  <button
                    onClick={() => {
                      const orphelins = propositions.filter((p) => p.type === 'ouvrage' && p.designation.trim() && !p.parent_designation.trim()).length
                      if (orphelins > 0) return
                      setStep(4)
                    }}
                    disabled={propositions.some((p) => p.type === 'ouvrage' && p.designation.trim() && !p.parent_designation.trim())}
                    className="flex-1 py-3 text-sm font-semibold text-white bg-[#1a1a1a] rounded-md hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Passer a l'etape suivante
                  </button>
                </div>
              </section>
            )}
          </>
        )}

        {/* Already submitted — read-only recap */}
        {submitted && acces.statut !== 'decline_st' && (
          <div className="bg-white border border-gray-200 rounded-lg p-5 text-center text-sm text-gray-500">
            Vous avez deja soumis votre offre. Merci pour votre participation.
          </div>
        )}
      </main>

      {/* Modale : confirmer le decline */}
      {showDecline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Décliner la consultation</h3>
              <button onClick={() => setShowDecline(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-gray-700">
                Vous êtes sur le point de décliner cette consultation. API Rénovation sera informé que vous ne souhaitez pas y répondre.
              </p>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Motif (optionnel)</label>
                <textarea
                  rows={3}
                  value={declineMotif}
                  onChange={(e) => setDeclineMotif(e.target.value)}
                  placeholder="Ex : Plan de charge complet, hors zone géographique, lot non couvert…"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-red-500 resize-y"
                />
              </div>
              {errorMsg && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-2 text-xs">{errorMsg}</div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setShowDecline(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
              <button
                onClick={handleDecline}
                disabled={declining}
                className="px-4 py-1.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                {declining ? 'Envoi…' : 'Confirmer le refus'}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="mt-12 py-6 text-center text-xs text-gray-400 border-t border-gray-200 bg-white">
        &copy; {new Date().getFullYear()} API Renovation
      </footer>
    </div>
  )
}
