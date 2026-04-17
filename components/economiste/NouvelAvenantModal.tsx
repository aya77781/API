'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  X, Check, Building2, Calendar, Mail, Phone, Copy, User as UserIcon,
  ExternalLink, Search, ArrowRight, ArrowLeft, Plus, Trash2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn, STATUTS_TERMINES } from '@/lib/utils'

type Projet = {
  id: string
  nom: string
  reference: string | null
  statut: string
}

type Lot = {
  id: string
  projet_id: string
  nom: string
  ordre: number
  total_ht: number | null
  planning_debut: string | null
  planning_fin: string | null
}

type AccesSTRow = {
  id: string
  lot_id: string
  st_nom: string | null
  st_societe: string | null
  st_email: string | null
  st_telephone: string | null
  type_acces: 'externe' | 'interne'
  statut: string
}

type StInterne = {
  id: string
  nom: string
  prenom: string
  email: string
  societe: string | null
}

type Cas = 'avant_debut' | 'pendant' | 'apres_fin'

type StepId = 1 | 2 | 3 | 4

type DetailLigne = {
  designation: string
  detail: string
  quantite: string  // string pour edition fluide
  unite: string
  prix_unitaire: string
}

const UNITES = ['u', 'ml', 'm2', 'm3', 'kg', 'h', 'forfait'] as const

function emptyLigne(): DetailLigne {
  return { designation: '', detail: '', quantite: '', unite: 'u', prix_unitaire: '' }
}

function parseNum(s: string): number {
  const n = parseFloat(String(s).replace(',', '.'))
  return isNaN(n) ? 0 : n
}

const CAS_UI: Record<Cas, { label: string; bg: string; border: string; fg: string; message: string }> = {
  avant_debut: {
    label:   'Avant démarrage',
    bg:      '#E6F1FB',
    border:  '#C5DDF3',
    fg:      '#185FA5',
    message: "Ce changement intervient AVANT le démarrage du lot. Il sera intégré directement dans le chiffrage existant du lot.",
  },
  pendant: {
    label:   'En cours de lot',
    bg:      '#FAEEDA',
    border:  '#E8D4A6',
    fg:      '#854F0B',
    message: "Ce changement intervient PENDANT le lot en cours. Un avenant sera créé et un nouveau devis demandé au ST.",
  },
  apres_fin: {
    label:   'Post-lot',
    bg:      '#FCEBEB',
    border:  '#F1C9C9',
    fg:      '#A32D2D',
    message: "Ce changement intervient APRÈS la fin du lot. Un second devis sera demandé. Il s'ajoutera au total projet séparément.",
  },
}

function detectCas(lot: Lot | null): Cas | null {
  if (!lot || !lot.planning_debut || !lot.planning_fin) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const debut = new Date(lot.planning_debut)
  const fin   = new Date(lot.planning_fin)
  if (today < debut) return 'avant_debut'
  if (today > fin)   return 'apres_fin'
  return 'pendant'
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d))
}

export function NouvelAvenantModal({
  userId,
  onClose,
  onCreated,
}: {
  userId: string
  onClose: () => void
  onCreated: (info: { avenantId: string; cas: Cas; lotId: string; projetId: string; lotNom: string; token: string | null }) => void
}) {
  const supabase = useMemo(() => createClient(), [])

  const [step, setStep] = useState<StepId>(1)

  // Step 1 : projet & lot
  const [projets, setProjets]     = useState<Projet[]>([])
  const [loadingP, setLoadingP]   = useState(true)
  const [projetId, setProjetId]   = useState<string>('')
  const [lots, setLots]           = useState<Lot[]>([])
  const [loadingL, setLoadingL]   = useState(false)
  const [lotId, setLotId]         = useState<string>('')

  // Step 2 : cas (auto)
  const lot = lots.find((l) => l.id === lotId) ?? null
  const cas = detectCas(lot)

  // Step 3 : titre & détail (tableau de lignes metré)
  const [titre, setTitre]       = useState('')
  const [description, setDesc]  = useState('')
  const [lignes, setLignes]     = useState<DetailLigne[]>([emptyLigne()])

  function updateLigne(idx: number, patch: Partial<DetailLigne>) {
    setLignes((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }
  function addLigne() {
    setLignes((prev) => [...prev, emptyLigne()])
  }
  function removeLigne(idx: number) {
    setLignes((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev))
  }
  const lignesValides = lignes.filter((l) => l.designation.trim().length > 0 && parseNum(l.quantite) > 0)
  const totalEstime = lignesValides.reduce((s, l) => s + parseNum(l.quantite) * parseNum(l.prix_unitaire), 0)

  // Step 4 : ST à consulter
  const [stTab, setStTab] = useState<'existant' | 'externe' | 'interne'>('existant')
  const [accesExistants, setAccesExistants] = useState<AccesSTRow[]>([])
  const [selectedAccesId, setSelectedAccesId] = useState<string>('')
  const [extNom, setExtNom]         = useState('')
  const [extSociete, setExtSociete] = useState('')
  const [extEmail, setExtEmail]     = useState('')
  const [extTel, setExtTel]         = useState('')
  const [stInternes, setStInternes] = useState<StInterne[]>([])
  const [intSearch, setIntSearch]   = useState('')
  const [intSelected, setIntSelected] = useState<StInterne | null>(null)
  const [dateLimite, setDateLimite]   = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  // Succès final
  const [success, setSuccess] = useState<{
    cas: Cas
    lotNom: string
    token: string | null
    code: string | null
    projetId: string
    lotId: string
    avenantId: string
  } | null>(null)
  const [copiedKey, setCopiedKey] = useState<'code' | 'link' | null>(null)

  // ─── Load projets ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancel = false
    async function load() {
      setLoadingP(true)
      // Tous les projets NON termines : on exclut seulement cloture/gpa/termine.
      // Source unique : STATUTS_TERMINES dans lib/utils.ts (aligne DB check constraint).
      const { data } = await supabase
        .schema('app')
        .from('projets')
        .select('id, nom, reference, statut')
        .order('nom')
      if (cancel) return
      const filtered = ((data ?? []) as Projet[]).filter((p) => !STATUTS_TERMINES.includes(p.statut))
      setProjets(filtered)
      setLoadingP(false)
    }
    load()
    return () => { cancel = true }
  }, [supabase])

  // ─── Load lots when projet selected ────────────────────────────────────
  useEffect(() => {
    if (!projetId) { setLots([]); setLotId(''); return }
    let cancel = false
    async function load() {
      setLoadingL(true)
      const { data } = await supabase
        .from('lots' as never)
        .select('id, projet_id, nom, ordre, total_ht, planning_debut, planning_fin')
        .eq('projet_id', projetId)
        .order('ordre', { ascending: true })
      if (cancel) return
      setLots(((data ?? []) as unknown) as Lot[])
      setLotId('')
      setLoadingL(false)
    }
    load()
    return () => { cancel = true }
  }, [projetId, supabase])

  // ─── Load acces ST existants pour le lot ───────────────────────────────
  useEffect(() => {
    if (!lotId) { setAccesExistants([]); return }
    let cancel = false
    async function load() {
      const { data } = await supabase
        .from('dce_acces_st' as never)
        .select('id, lot_id, st_nom, st_societe, st_email, st_telephone, type_acces, statut')
        .eq('lot_id', lotId)
        .order('created_at', { ascending: false })
      if (cancel) return
      setAccesExistants(((data ?? []) as unknown) as AccesSTRow[])
    }
    load()
    return () => { cancel = true }
  }, [lotId, supabase])

  // ─── Load internes ─────────────────────────────────────────────────────
  useEffect(() => {
    let cancel = false
    async function load() {
      const [userRes, baseRes] = await Promise.all([
        supabase
          .schema('app')
          .from('utilisateurs')
          .select('id, email, nom, prenom, role, categorie')
          .eq('actif', true)
          .or('role.eq.st,categorie.eq.st')
          .order('nom'),
        supabase
          .schema('app')
          .from('sous_traitants')
          .select('raison_sociale, contact_email')
          .eq('statut', 'actif'),
      ])
      if (cancel) return
      const societeByEmail = new Map<string, string>()
      ;(baseRes.data ?? []).forEach((r: any) => {
        if (r.contact_email) societeByEmail.set(String(r.contact_email).toLowerCase(), r.raison_sociale ?? '')
      })
      const rows = ((userRes.data ?? []) as Array<{ id: string; email: string; nom: string; prenom: string }>).map((u): StInterne => ({
        id: u.id,
        nom: u.nom ?? '',
        prenom: u.prenom ?? '',
        email: u.email,
        societe: societeByEmail.get((u.email ?? '').toLowerCase()) || null,
      }))
      setStInternes(rows)
    }
    load()
    return () => { cancel = true }
  }, [supabase])

  const internesFiltres = stInternes.filter((s) => {
    if (!intSearch.trim()) return true
    const q = intSearch.toLowerCase()
    return (
      s.nom.toLowerCase().includes(q) ||
      s.prenom.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      (s.societe?.toLowerCase().includes(q) ?? false)
    )
  })

  // ─── Validations par étape ─────────────────────────────────────────────
  const canNext1 = !!projetId && !!lotId
  const canNext2 = !!cas
  const canNext3 = titre.trim().length >= 3 && lignesValides.length > 0
  const canCreate = (() => {
    if (cas === 'avant_debut') return true // pas de ST requis dans ce cas
    if (stTab === 'existant') return !!selectedAccesId
    // Externe : Nom/Email OPTIONNELS. Si vides, le ST les renseigne a l'ouverture
    // du lien avec son code (flow 'lien partageable' identique au DCE principal).
    if (stTab === 'externe')  return true
    if (stTab === 'interne')  return !!intSelected
    return false
  })()

  // ─── Génération du numéro AVN-YYYY-NNN ─────────────────────────────────
  async function nextCode(): Promise<{ code: string; numero: number }> {
    const year = new Date().getFullYear()
    const { data } = await supabase
      .schema('app')
      .from('avenants')
      .select('code')
      .like('code', `AVN-${year}-%`)
      .order('code', { ascending: false })
      .limit(1)
    let next = 1
    const last = ((data as Array<{ code: string | null }> | null) ?? [])[0]?.code ?? null
    if (last) {
      const m = last.match(/AVN-\d{4}-(\d+)$/)
      if (m) next = parseInt(m[1], 10) + 1
    }
    // Calcul numero projet (pour compat legacy)
    const { data: legacy } = await supabase
      .schema('app')
      .from('avenants')
      .select('numero')
      .eq('projet_id', projetId)
      .order('numero', { ascending: false })
      .limit(1)
    const nextNumero = (((legacy as Array<{ numero: number }> | null) ?? [])[0]?.numero ?? 0) + 1

    return { code: `AVN-${year}-${String(next).padStart(3, '0')}`, numero: nextNumero }
  }

  async function handleCreate() {
    if (!cas || !lot) return
    setSaving(true)
    setError(null)
    try {
      // 1) ST : créer/assigner l'accès si besoin
      let accesId: string | null = null
      let token: string | null = null
      let code: string | null = null

      if (cas !== 'avant_debut') {
        if (stTab === 'existant') {
          accesId = selectedAccesId
          const found = accesExistants.find((a) => a.id === selectedAccesId)
          // pas de token re-généré, on réutilise l'accès existant
          const { data: tok } = await supabase
            .from('dce_acces_st' as never)
            .select('token, code_acces, type_acces')
            .eq('id', selectedAccesId)
            .single()
          const raw = tok as unknown as { token: string | null; code_acces: string | null; type_acces: 'externe' | 'interne' } | null
          token = raw?.type_acces === 'externe' ? (raw?.token ?? null) : null
          code = raw?.type_acces === 'externe' ? (raw?.code_acces ?? null) : null
          if (found && dateLimite) {
            await supabase
              .from('dce_acces_st' as never)
              .update({ date_limite: dateLimite } as never)
              .eq('id', selectedAccesId)
          }
        } else if (stTab === 'externe') {
          // Externe : Nom/Email optionnels — si vides, le ST les saisit au premier acces via son code.
          token = crypto.randomUUID()
          const { data, error: insErr } = await supabase
            .from('dce_acces_st' as never)
            .insert({
              lot_id:      lot.id,
              projet_id:   lot.projet_id,
              type_acces:  'externe',
              st_nom:      extNom.trim() || '',
              st_societe:  extSociete.trim() || null,
              st_email:    extEmail.trim() || '',
              st_telephone: extTel.trim() || null,
              date_limite: dateLimite || null,
              statut:      'envoye',
              token,
            } as never)
            .select('id, code_acces')
            .single()
          if (insErr) throw insErr
          const row = data as unknown as { id: string; code_acces: string | null }
          accesId = row.id
          code = row.code_acces
          // Fallback : si le code n'est pas remonte (trigger desync), on le lit en DB
          if (!code && accesId) {
            const { data: refetch } = await supabase
              .from('dce_acces_st' as never)
              .select('code_acces')
              .eq('id', accesId)
              .single()
            code = (refetch as unknown as { code_acces: string | null } | null)?.code_acces ?? null
          }
        } else if (stTab === 'interne' && intSelected) {
          const fullName = `${intSelected.prenom} ${intSelected.nom}`.trim()
          const { data, error: insErr } = await supabase
            .from('dce_acces_st' as never)
            .insert({
              lot_id:      lot.id,
              projet_id:   lot.projet_id,
              type_acces:  'interne',
              st_nom:      fullName,
              st_societe:  intSelected.societe,
              st_email:    intSelected.email,
              st_telephone: null,
              date_limite: dateLimite || null,
              statut:      'envoye',
              token:       null,
              user_id:     intSelected.id,
            } as never)
            .select('id')
            .single()
          if (insErr) throw insErr
          accesId = (data as unknown as { id: string }).id
          await supabase.schema('app').from('alertes').insert({
            projet_id:      lot.projet_id,
            utilisateur_id: intSelected.id,
            type:           'avenant_invitation',
            titre:          `Avenant à chiffrer — ${lot.nom}`,
            message:        `Un avenant vous est demandé pour le lot « ${lot.nom} ».`,
            priorite:       'normal',
            lue:            false,
            metadata:       { url: `/st/dce/interne/${lot.id}/${accesId}` },
          })
        }
      }

      // 2) Générer numéro avenant (AVN-YYYY-NNN)
      const { code: avenantCode, numero } = await nextCode()

      // 3) Insert avenant
      const { data: avData, error: avErr } = await supabase
        .schema('app')
        .from('avenants')
        .insert({
          projet_id:   lot.projet_id,
          lot_id:      lot.id,
          numero,
          code:        avenantCode,
          titre:       titre.trim(),
          description: description.trim(),
          cas,
          acces_st_id: accesId,
          statut:      'ouvert',
          created_by:  userId,
          demande_par: userId,
        } as never)
        .select('id')
        .single()
      if (avErr) throw avErr

      const avenantId = (avData as unknown as { id: string }).id

      // 4) Insère les lignes du détail dans chiffrage_lignes avec avenant_id
      //    (isolation totale du chiffrage principal du lot)
      const lignesToInsert = lignesValides.map((l, i) => ({
        lot_id:      lot.id,
        projet_id:   lot.projet_id,
        avenant_id:  avenantId,
        designation: l.designation.trim(),
        detail:      l.detail.trim() || null,
        quantite:    parseNum(l.quantite),
        unite:       l.unite,
        prix_unitaire: parseNum(l.prix_unitaire),
        ordre:       i,
      }))
      if (lignesToInsert.length > 0) {
        await supabase.from('chiffrage_lignes' as never).insert(lignesToInsert as never)
      }

      // 5) Lier dce_acces_st.avenant_id pour que le ST voie UNIQUEMENT les lignes de l'avenant
      if (accesId) {
        await supabase
          .from('dce_acces_st' as never)
          .update({ avenant_id: avenantId } as never)
          .eq('id', accesId)
      }

      setSuccess({
        cas,
        lotNom:   lot.nom,
        token,
        code,
        projetId: lot.projet_id,
        lotId:    lot.id,
        avenantId,
      })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur lors de la création'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  function copyValue(kind: 'code' | 'link', value: string) {
    navigator.clipboard.writeText(value)
    setCopiedKey(kind)
    setTimeout(() => setCopiedKey(null), 1500)
  }

  // ─── Stepper ───────────────────────────────────────────────────────────
  const stepsMeta: { id: StepId; label: string }[] = [
    { id: 1, label: 'Projet & lot' },
    { id: 2, label: 'Cas' },
    { id: 3, label: 'Détail' },
    { id: 4, label: 'ST' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <h3 className="text-base font-semibold text-gray-900">
            {success ? 'Avenant créé' : 'Nouvel avenant'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {success ? (
            <SuccessView
              success={success}
              copiedKey={copiedKey}
              onCopy={copyValue}
              onOpenChiffrage={() => onCreated({
                avenantId: success.avenantId,
                cas:       success.cas,
                lotId:     success.lotId,
                projetId:  success.projetId,
                lotNom:    success.lotNom,
                token:     success.token,
              })}
              onClose={onClose}
            />
          ) : (
            <>
              {/* Stepper */}
              <div className="px-6 pt-5 pb-3">
                <ol className="flex items-center gap-2">
                  {stepsMeta.map((s, idx) => {
                    const done = s.id < step
                    const active = s.id === step
                    return (
                      <li key={s.id} className="flex items-center gap-2 flex-1">
                        <div
                          className={cn(
                            'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 border',
                            done   && 'bg-[#EAF3DE] border-[#C7E09A] text-[#3B6D11]',
                            active && 'bg-gray-900 border-gray-900 text-white',
                            !done && !active && 'bg-white border-gray-200 text-gray-400',
                          )}
                          aria-current={active ? 'step' : undefined}
                        >
                          {done ? <Check className="w-3.5 h-3.5" /> : s.id}
                        </div>
                        <span className={cn(
                          'text-xs font-medium truncate',
                          active ? 'text-gray-900' : 'text-gray-400',
                        )}>
                          {s.label}
                        </span>
                        {idx < stepsMeta.length - 1 && (
                          <div className="flex-1 h-px bg-gray-200" />
                        )}
                      </li>
                    )
                  })}
                </ol>
              </div>

              <div className="px-6 pb-4 pt-2 space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-md px-3 py-2">
                    {error}
                  </div>
                )}

                {step === 1 && (
                  <Step1
                    projets={projets}
                    loadingP={loadingP}
                    projetId={projetId}
                    setProjetId={setProjetId}
                    lots={lots}
                    loadingL={loadingL}
                    lotId={lotId}
                    setLotId={setLotId}
                  />
                )}

                {step === 2 && (
                  <Step2 lot={lot} cas={cas} />
                )}

                {step === 3 && (
                  <Step3
                    titre={titre} setTitre={setTitre}
                    description={description} setDesc={setDesc}
                    lignes={lignes}
                    updateLigne={updateLigne}
                    addLigne={addLigne}
                    removeLigne={removeLigne}
                    totalEstime={totalEstime}
                  />
                )}

                {step === 4 && (
                  <Step4
                    cas={cas!}
                    accesExistants={accesExistants}
                    stTab={stTab}             setStTab={setStTab}
                    selectedAccesId={selectedAccesId} setSelectedAccesId={setSelectedAccesId}
                    extNom={extNom}           setExtNom={setExtNom}
                    extSociete={extSociete}   setExtSociete={setExtSociete}
                    extEmail={extEmail}       setExtEmail={setExtEmail}
                    extTel={extTel}           setExtTel={setExtTel}
                    internes={internesFiltres}
                    intSearch={intSearch}     setIntSearch={setIntSearch}
                    intSelected={intSelected} setIntSelected={setIntSelected}
                    dateLimite={dateLimite}   setDateLimite={setDateLimite}
                  />
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className="px-5 py-3 border-t border-gray-200 flex-shrink-0 flex items-center justify-between gap-2">
            <button
              onClick={() => (step > 1 ? setStep((step - 1) as StepId) : onClose())}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
            >
              {step > 1 ? <><ArrowLeft className="w-4 h-4" /> Retour</> : 'Annuler'}
            </button>

            {step < 4 ? (
              <button
                onClick={() => setStep((step + 1) as StepId)}
                disabled={
                  (step === 1 && !canNext1) ||
                  (step === 2 && !canNext2) ||
                  (step === 3 && !canNext3)
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-black disabled:opacity-40"
              >
                Suivant <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleCreate}
                disabled={!canCreate || saving || (cas !== 'avant_debut' && !canCreate)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-black disabled:opacity-40"
              >
                {saving
                  ? 'Création…'
                  : stTab === 'externe' && cas !== 'avant_debut'
                    ? "Créer l'avenant et générer le code"
                    : "Créer l'avenant"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Step 1 ──────────────────────────────────────────────────────────────────

function Step1({
  projets, loadingP, projetId, setProjetId,
  lots, loadingL, lotId, setLotId,
}: {
  projets: Projet[]; loadingP: boolean; projetId: string; setProjetId: (v: string) => void
  lots: Lot[]; loadingL: boolean; lotId: string; setLotId: (v: string) => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-gray-500 mb-1">Projet *</label>
        <select
          value={projetId}
          onChange={(e) => setProjetId(e.target.value)}
          disabled={loadingP}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500"
        >
          <option value="">{loadingP ? 'Chargement…' : 'Sélectionner un projet'}</option>
          {projets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.reference ? `[${p.reference}] ` : ''}{p.nom}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Lot *</label>
        <select
          value={lotId}
          onChange={(e) => setLotId(e.target.value)}
          disabled={!projetId || loadingL}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
        >
          <option value="">
            {!projetId ? 'Sélectionnez d\'abord un projet' : loadingL ? 'Chargement…' : 'Sélectionner un lot'}
          </option>
          {lots.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nom}
              {l.planning_debut && l.planning_fin
                ? ` · Du ${fmtDate(l.planning_debut)} au ${fmtDate(l.planning_fin)}`
                : ''}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

// ─── Step 2 ──────────────────────────────────────────────────────────────────

function Step2({ lot, cas }: { lot: Lot | null; cas: Cas | null }) {
  if (!lot) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-md px-4 py-6 text-sm text-gray-500 text-center">
        Retournez à l'étape précédente pour sélectionner un lot.
      </div>
    )
  }

  if (!cas) {
    return (
      <div className="bg-[#FAEEDA] border border-[#E8D4A6] rounded-md px-4 py-4 text-sm text-[#854F0B]">
        Les dates de planning du lot « {lot.nom} » ne sont pas renseignées. Complétez le planning avant de créer l'avenant.
      </div>
    )
  }

  const ui = CAS_UI[cas]
  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-500">
        Lot <span className="font-medium text-gray-900">{lot.nom}</span>
        {' · '}
        Planning : {fmtDate(lot.planning_debut)} → {fmtDate(lot.planning_fin)}
      </div>

      <div
        className="rounded-md px-4 py-3 border text-sm"
        style={{ background: ui.bg, borderColor: ui.border, color: ui.fg }}
      >
        <div className="font-semibold mb-1">{ui.label}</div>
        <div className="leading-relaxed">{ui.message}</div>
      </div>
    </div>
  )
}

// ─── Step 3 ──────────────────────────────────────────────────────────────────

function Step3({
  titre, setTitre, description, setDesc,
  lignes, updateLigne, addLigne, removeLigne, totalEstime,
}: {
  titre: string; setTitre: (v: string) => void
  description: string; setDesc: (v: string) => void
  lignes: DetailLigne[]
  updateLigne: (idx: number, patch: Partial<DetailLigne>) => void
  addLigne: () => void
  removeLigne: (idx: number) => void
  totalEstime: number
}) {
  function fmtEur(n: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n) + ' €'
  }
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-gray-500 mb-1">Titre *</label>
        <input
          type="text"
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          placeholder="ex: Remplacement carrelage par parquet"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Contexte (optionnel)</label>
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Contexte général de l'avenant (raison, contraintes…)"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500 resize-y"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs text-gray-500">Lignes du métré *</label>
          <span className="text-[11px] text-gray-400">
            Remplissez la désignation et la quantité pour chaque poste. Le ST verra uniquement ces lignes.
          </span>
        </div>
        <div className="border border-gray-200 rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr className="text-left text-gray-500">
                <th className="px-2 py-2 font-medium">Désignation *</th>
                <th className="px-2 py-2 font-medium">Détail</th>
                <th className="px-2 py-2 font-medium w-20 text-right">Qté *</th>
                <th className="px-2 py-2 font-medium w-20">Unité</th>
                <th className="px-2 py-2 font-medium w-24 text-right">PU HT (éco)</th>
                <th className="px-2 py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {lignes.map((l, i) => {
                const total = parseNum(l.quantite) * parseNum(l.prix_unitaire)
                return (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={l.designation}
                        onChange={(e) => updateLigne(i, { designation: e.target.value })}
                        placeholder="ex: Pose parquet massif"
                        className="w-full px-2 py-1 text-xs bg-white border border-gray-200 rounded focus:outline-none focus:border-blue-500"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={l.detail}
                        onChange={(e) => updateLigne(i, { detail: e.target.value })}
                        placeholder="détail technique"
                        className="w-full px-2 py-1 text-xs bg-white border border-gray-200 rounded focus:outline-none focus:border-blue-500"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        step="0.01"
                        value={l.quantite}
                        onChange={(e) => updateLigne(i, { quantite: e.target.value })}
                        className="w-full px-2 py-1 text-xs bg-white border border-gray-200 rounded focus:outline-none focus:border-blue-500 text-right tabular-nums"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={l.unite}
                        onChange={(e) => updateLigne(i, { unite: e.target.value })}
                        className="w-full px-1 py-1 text-xs bg-white border border-gray-200 rounded focus:outline-none"
                      >
                        {UNITES.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        step="0.01"
                        value={l.prix_unitaire}
                        onChange={(e) => updateLigne(i, { prix_unitaire: e.target.value })}
                        className="w-full px-2 py-1 text-xs bg-white border border-gray-200 rounded focus:outline-none focus:border-blue-500 text-right tabular-nums"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {lignes.length > 1 && (
                        <button
                          onClick={() => removeLigne(i)}
                          className="text-gray-400 hover:text-red-600"
                          title="Supprimer la ligne"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold text-gray-700">
                <td colSpan={4} className="px-2 py-2 text-right uppercase text-[10px] tracking-wider">Total estimé éco HT</td>
                <td className="px-2 py-2 text-right tabular-nums">{fmtEur(totalEstime)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        <button
          onClick={addLigne}
          className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50"
        >
          <Plus className="w-3 h-3" />
          Ajouter une ligne
        </button>
      </div>
    </div>
  )
}

// ─── Step 4 ──────────────────────────────────────────────────────────────────

function Step4({
  cas,
  accesExistants, stTab, setStTab,
  selectedAccesId, setSelectedAccesId,
  extNom, setExtNom, extSociete, setExtSociete,
  extEmail, setExtEmail, extTel, setExtTel,
  internes, intSearch, setIntSearch,
  intSelected, setIntSelected,
  dateLimite, setDateLimite,
}: {
  cas: Cas
  accesExistants: AccesSTRow[]
  stTab: 'existant' | 'externe' | 'interne'
  setStTab: (v: 'existant' | 'externe' | 'interne') => void
  selectedAccesId: string
  setSelectedAccesId: (v: string) => void
  extNom: string;     setExtNom: (v: string) => void
  extSociete: string; setExtSociete: (v: string) => void
  extEmail: string;   setExtEmail: (v: string) => void
  extTel: string;     setExtTel: (v: string) => void
  internes: StInterne[]
  intSearch: string; setIntSearch: (v: string) => void
  intSelected: StInterne | null
  setIntSelected: (v: StInterne | null) => void
  dateLimite: string; setDateLimite: (v: string) => void
}) {
  if (cas === 'avant_debut') {
    return (
      <div className="bg-[#E6F1FB] border border-[#C5DDF3] text-[#185FA5] rounded-md px-4 py-3 text-sm">
        Avenant « avant démarrage » : aucun ST à consulter. Les lignes seront intégrées directement au chiffrage du lot.
      </div>
    )
  }

  const tabs: { id: typeof stTab; label: string }[] = [
    { id: 'existant', label: `ST du lot (${accesExistants.length})` },
    { id: 'externe',  label: 'Nouveau ST externe' },
    { id: 'interne',  label: 'Utilisateur interne' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-gray-50 p-1 rounded-md">
        {tabs.map((t) => {
          const active = stTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setStTab(t.id)}
              className={cn(
                'flex-1 px-3 py-1.5 text-xs font-medium rounded',
                active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {stTab === 'existant' && (
        <div className="space-y-2">
          {accesExistants.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">
              Aucun ST déjà invité sur ce lot.
            </p>
          ) : (
            <ul className="space-y-1.5 max-h-60 overflow-y-auto">
              {accesExistants.map((a) => {
                const selected = a.id === selectedAccesId
                return (
                  <li key={a.id}>
                    <button
                      onClick={() => setSelectedAccesId(a.id)}
                      className={cn(
                        'w-full flex items-start gap-3 p-3 border rounded-md text-left transition-colors',
                        selected ? 'bg-blue-50 border-blue-400' : 'border-gray-200 hover:border-gray-300',
                      )}
                    >
                      <div className={cn(
                        'w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0',
                        a.type_acces === 'interne' ? 'bg-[#E6F1FB] text-[#185FA5]' : 'bg-[#F1EFE8] text-[#5F5E5A]',
                      )}>
                        {a.type_acces === 'interne' ? <UserIcon className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{a.st_nom || '—'}</div>
                        <div className="text-xs text-gray-500 truncate">
                          {a.st_societe || '—'}{a.st_email ? ` · ${a.st_email}` : ''}
                        </div>
                      </div>
                      {selected && <Check className="w-4 h-4 text-blue-600 flex-shrink-0 mt-1" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {stTab === 'externe' && (
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800 flex items-start gap-2">
            <Copy className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Un code d&apos;accès sera généré à la création.</p>
              <p className="mt-0.5">
                Le ST se connectera avec ce code sur la page de connexion
                (<em>« Répondre à un appel d&apos;offre »</em>) — pas besoin de compte.
                Les infos ci-dessous sont <strong>optionnelles</strong> : si vides, le ST renseignera son identité au premier accès.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Nom du contact</label>
              <input
                type="text" value={extNom}
                onChange={(e) => setExtNom(e.target.value)}
                placeholder="(optionnel)"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Société</label>
              <div className="relative">
                <Building2 className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="text" value={extSociete}
                  onChange={(e) => setExtSociete(e.target.value)}
                  placeholder="(optionnel)"
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="email" value={extEmail}
                  onChange={(e) => setExtEmail(e.target.value)}
                  placeholder="(optionnel)"
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Téléphone</label>
              <div className="relative">
                <Phone className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="tel" value={extTel}
                  onChange={(e) => setExtTel(e.target.value)}
                  placeholder="(optionnel)"
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {stTab === 'interne' && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={intSearch}
              onChange={(e) => setIntSearch(e.target.value)}
              placeholder="Rechercher un utilisateur interne…"
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500"
            />
          </div>
          <ul className="space-y-1 max-h-56 overflow-y-auto">
            {internes.length === 0 && (
              <li className="text-xs text-gray-400 text-center py-4">Aucun utilisateur</li>
            )}
            {internes.map((u) => {
              const selected = intSelected?.id === u.id
              return (
                <li key={u.id}>
                  <button
                    onClick={() => setIntSelected(u)}
                    className={cn(
                      'w-full flex items-center gap-3 p-2.5 border rounded-md text-left transition-colors',
                      selected ? 'bg-blue-50 border-blue-400' : 'border-gray-200 hover:border-gray-300',
                    )}
                  >
                    <div className="w-8 h-8 rounded-md bg-[#E6F1FB] text-[#185FA5] flex items-center justify-center flex-shrink-0">
                      <UserIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{u.prenom} {u.nom}</div>
                      <div className="text-xs text-gray-500 truncate">{u.email}{u.societe ? ` · ${u.societe}` : ''}</div>
                    </div>
                    {selected && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div>
        <label className="block text-xs text-gray-500 mb-1">Date limite de remise</label>
        <div className="relative max-w-xs">
          <Calendar className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="date"
            value={dateLimite}
            onChange={(e) => setDateLimite(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>
    </div>
  )
}

// ─── Success view ────────────────────────────────────────────────────────────

function SuccessView({
  success,
  copiedKey,
  onCopy,
  onOpenChiffrage,
  onClose,
}: {
  success: { cas: Cas; lotNom: string; token: string | null; code: string | null; projetId: string; lotId: string; avenantId: string }
  copiedKey: 'code' | 'link' | null
  onCopy: (kind: 'code' | 'link', value: string) => void
  onOpenChiffrage: () => void
  onClose: () => void
}) {
  if (success.cas === 'avant_debut') {
    return (
      <div className="p-6 space-y-4">
        <div className="bg-[#E6F1FB] border border-[#C5DDF3] text-[#185FA5] rounded-md p-3 text-sm flex items-start gap-2">
          <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Ce changement va être intégré directement dans le lot « {success.lotNom} ».</p>
            <p className="text-xs mt-1">Voulez-vous ouvrir le Chiffrage pour ajouter les lignes ?</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            Fermer
          </button>
          <button
            onClick={onOpenChiffrage}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-black"
          >
            Ouvrir le chiffrage
          </button>
        </div>
      </div>
    )
  }

  // pendant / apres_fin — ST externe ou existant
  const link = success.token ? `https://api-1-aj7d.onrender.com/dce/${success.token}` : null
  return (
    <div className="p-6 space-y-4">
      <div className="bg-[#EAF3DE] border border-[#C7E09A] text-[#3B6D11] rounded-md p-3 text-sm flex items-start gap-2">
        <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium">Avenant créé sur le lot « {success.lotNom} »</p>
          {(success.code || link) && (
            <p className="text-xs mt-1">
              Transmettez ce <strong>code d&apos;accès</strong> au ST — il le saisira sur la page de connexion
              (section <em>« Répondre à un appel d&apos;offre »</em>) pour compléter le DPGF de l&apos;avenant.
            </p>
          )}
        </div>
      </div>

      {success.code && (
        <div>
          <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">Code d&apos;accès</p>
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-md px-3 py-3">
            <code className="flex-1 text-xl font-mono font-bold text-amber-900 tracking-widest">
              {success.code}
            </code>
            <button
              onClick={() => onCopy('code', success.code!)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-white bg-amber-600 rounded hover:bg-amber-700"
            >
              {copiedKey === 'code' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copiedKey === 'code' ? 'Copié' : 'Copier le code'}
            </button>
          </div>
        </div>
      )}

      {link ? (
        <div>
          <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">Ou lien direct</p>
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
            <code className="flex-1 text-xs text-gray-700 truncate">{link}</code>
            <button
              onClick={() => onCopy('link', link)}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-white bg-gray-900 rounded hover:bg-black"
            >
              {copiedKey === 'link' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copiedKey === 'link' ? 'Copié' : 'Copier'}
            </button>
          </div>
        </div>
      ) : !success.code ? (
        <div className="text-xs text-gray-500">
          Une alerte a été envoyée à l&apos;utilisateur interne. Il accédera à l&apos;avenant depuis son compte.
        </div>
      ) : null}

      {success.code && (
        <p className="text-xs text-gray-400">
          Le ST renseignera son identité (nom, société, email) au premier accès, puis remplira les lignes de l&apos;avenant.
        </p>
      )}

      <div className="flex items-center justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-black"
        >
          Fermer
        </button>
      </div>
    </div>
  )
}
