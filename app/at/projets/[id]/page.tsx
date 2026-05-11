'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Users, FileText, Landmark, CreditCard, ClipboardCheck, FolderCheck,
  Plus, X, Check, CheckCircle2, AlertTriangle, Send, Layers, Trophy,
  Clock, XCircle, UserCheck, Mail, KeyRound, Loader2, Copy,
  Sparkles, Download, FileSignature, Eye, ChevronDown, ChevronRight, Receipt,
  ScanLine, ImagePlus, Upload,
} from 'lucide-react'

const N8N_OCR_WEBHOOK = process.env.NEXT_PUBLIC_N8N_WEBHOOK_COMPTA
  ?? 'https://apiprojet.app.n8n.cloud/webhook/api-renovation-compta-ocr'

function pickField(obj: any, keys: string[]): any {
  if (!obj || typeof obj !== 'object') return undefined
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== '') return obj[k]
  }
  for (const k of Object.keys(obj)) {
    const v = obj[k]
    if (v && typeof v === 'object') {
      const found = pickField(v, keys)
      if (found != null) return found
    }
  }
  return undefined
}

function extractDicFromOcr(raw: any): {
  libelle?: string; montant_ht?: string; tva_pct?: string; date_depense?: string;
} {
  const data = Array.isArray(raw) ? raw[0] : raw
  if (!data) return {}
  const libelle = pickField(data, ['libelle', 'description', 'fournisseur', 'merchant', 'vendor'])
  const ttc     = pickField(data, ['montant_ttc', 'total_ttc', 'total', 'amount', 'totalAmount'])
  const ht      = pickField(data, ['montant_ht', 'total_ht'])
  const tva     = pickField(data, ['tva_pct', 'tva', 'vat', 'taux_tva', 'tvaRate'])
  const date    = pickField(data, ['date_depense', 'date_facture', 'date_ecriture', 'date_emission', 'date_piece', 'date', 'invoice_date', 'issueDate', 'IssueDate'])

  const clean = (v: any) => String(v).replace(',', '.').replace(/[^0-9.]/g, '')
  const tvaPct = tva != null ? Number(clean(tva)) : null

  // Privilegie HT direct ; sinon deduit TTC / (1 + tva%)
  let montantHt: string | undefined
  if (ht != null) montantHt = clean(ht)
  else if (ttc != null) {
    const ttcN = Number(clean(ttc))
    if (tvaPct && tvaPct > 0) montantHt = (ttcN / (1 + tvaPct / 100)).toFixed(2)
    else                       montantHt = String(ttcN)
  }

  let dateIso: string | undefined
  if (date) {
    const d = new Date(date)
    if (!isNaN(d.getTime())) dateIso = d.toISOString().slice(0, 10)
    else if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) dateIso = date.slice(0, 10)
  }
  return {
    libelle:      libelle ? String(libelle) : undefined,
    montant_ht:   montantHt,
    tva_pct:      tvaPct != null ? String(tvaPct) : undefined,
    date_depense: dateIso,
  }
}
import { generateContratSTPdf, type ContratClause } from '@/lib/pdf/contratST'
import { createClient } from '@/lib/supabase/client'
import { StatutBadge } from '@/components/ui/Badge'
import { Abbr } from '@/components/shared/Abbr'
import { STValidationDrawer } from '@/components/at/STValidationDrawer'
import { formatCurrency, formatDate } from '@/lib/utils'

type Projet = {
  id: string
  nom: string
  reference: string | null
  client_nom: string | null
  adresse: string | null
  statut: string
  budget_total: number | null
  type_chantier: string | null
}

type ST = {
  id: string
  nom: string
  societe: string | null
  corps_etat: string | null
  statut: string
  kbis_ok: boolean
  rib_ok: boolean
  urssaf_ok: boolean
  fiscalite_ok: boolean
  rc_ok: boolean
  decennale_ok: boolean
}

type Contrat = {
  id: string
  st_id: string
  numero: string | null
  montant_ht: number | null
  statut: string
  cgv_incluses: boolean
  delegation_paiement: boolean
  second_rang: boolean
  second_rang_valide: boolean
  date_signature: string | null
  notes: string | null
}

type DIC = {
  id: string
  date_depense: string | null
  libelle: string
  montant_ht: number
  tva_pct: number | null
  montant_ttc: number | null
  justificatif_url: string | null
}

type ProrataPaiement = {
  id: string
  st_id: string | null
  contrat_id: string | null
  appel_id: string | null
  numero: string | null
  montant_du: number | null
  montant_paye: number | null
  statut: string
  date_emission: string | null
  date_echeance: string | null
  date_paiement: string | null
  recu_url: string | null
  recu_uploaded_at: string | null
  valide_at: string | null
  notes: string | null
}

type ProrataAppel = {
  id: string
  numero: string | null
  libelle: string
  taux_appele: number
  taux_quote_part: number
  date_appel: string
  delai_paiement_jours: number
  notes: string | null
  created_at: string | null
}

type Facture = {
  id: string
  st_id: string
  numero_facture: string | null
  montant_ht: number
  date_facture: string | null
  prorata_paye: boolean
  montant_conforme: boolean
  avenants_inclus: boolean
  statut: string
  justificatif_url: string | null
  montant_paye: number | null
  date_paiement: string | null
}

type Reserve = {
  id: string
  st_id: string | null
  lot_id: string | null
  description: string
  localisation: string | null
  statut: string
  date_signalement: string | null
  date_echeance: string | null
  date_levee: string | null
  photo_signalement_url: string | null
  photo_levee_url: string | null
  remarque: string | null
}

type DOE = {
  id: string
  statut: string
  date_envoi: string | null
  fiches_produits: boolean
  notes_calcul: boolean
  memoire_technique: boolean
  plans_architecte: boolean
  plans_exe_pdf: boolean
  synoptiques: boolean
  assurances_compilees: boolean
  carnet_entretien: boolean
}

const TABS: Array<{ id: string; label: React.ReactNode; icon: typeof Users }> = [
  { id: 'sous-traitants', label: <><Abbr k="ST" /></>,         icon: Users },
  { id: 'onboarding',     label: 'Onboarding',                  icon: UserCheck },
  { id: 'contrats',       label: 'Contrats',                    icon: FileText },
  { id: 'prorata',        label: 'Compte prorata',              icon: Landmark },
  { id: 'paiements',      label: 'Paiements',                   icon: CreditCard },
  { id: 'reception',      label: 'Reception',                   icon: ClipboardCheck },
  { id: 'doe',            label: <Abbr k="DOE" />,              icon: FolderCheck },
]

export default function ATProjetPage() {
  const params       = useParams()
  const searchParams = useSearchParams()
  const router       = useRouter()
  const id           = params.id as string

  const initialTab = TABS.some((t) => t.id === searchParams.get('tab'))
    ? (searchParams.get('tab') as string)
    : 'sous-traitants'

  const [projet, setProjet]       = useState<Projet | null>(null)
  const [loading, setLoading]     = useState(true)
  const [activeTab, setActiveTab] = useState(initialTab)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .schema('app')
      .from('projets')
      .select('id,nom,reference,client_nom,adresse,statut,budget_total,type_chantier')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        setProjet(data as Projet | null)
        setLoading(false)
      })
  }, [id])

  function selectTab(tabId: string) {
    setActiveTab(tabId)
    const sp = new URLSearchParams(searchParams.toString())
    sp.set('tab', tabId)
    router.replace(`/at/projets/${id}?${sp.toString()}`, { scroll: false })
  }

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
        Projet introuvable.{' '}
        <Link href="/at/projets" className="underline">Retour</Link>
      </div>
    )
  }

  return (
    <div>
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-start gap-4">
          <Link
            href="/at/projets"
            className="mt-1 flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Mes projets
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              {projet.reference && <span className="text-xs text-gray-400 font-mono">{projet.reference}</span>}
              <StatutBadge statut={projet.statut} />
              {projet.type_chantier && <span className="text-xs text-gray-400">{projet.type_chantier}</span>}
            </div>
            <h1 className="text-base font-semibold text-gray-900">{projet.nom}</h1>
            {projet.client_nom && <p className="text-xs text-gray-500 mt-0.5">{projet.client_nom}</p>}
          </div>
          {projet.budget_total && (
            <div className="ml-auto text-xs text-gray-500">
              Budget : <span className="font-semibold text-gray-900">{formatCurrency(projet.budget_total)}</span>
            </div>
          )}
        </div>
      </header>

      <div className="bg-white border-b border-gray-200">
        <nav className="flex px-6 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => selectTab(tab.id)}
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

      <div className="p-6">
        {activeTab === 'sous-traitants' && <STTab projetId={projet.id} />}
        {activeTab === 'onboarding'     && <OnboardingTab projetId={projet.id} />}
        {activeTab === 'contrats'       && <ContratsTab projetId={projet.id} />}
        {activeTab === 'prorata'        && <ProrataTab projetId={projet.id} />}
        {activeTab === 'paiements'      && <PaiementsTab projetId={projet.id} />}
        {activeTab === 'reception'      && <ReceptionTab projetId={projet.id} />}
        {activeTab === 'doe'            && <DoeTab projetId={projet.id} />}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   ONGLET 1 — SOUS-TRAITANTS
   ════════════════════════════════════════════════════════════════════════════ */

type Lot = { id: string; ordre: number; nom: string }
type DceAcces = {
  id: string
  lot_id: string | null
  statut: string | null
  st_nom: string | null
  st_societe: string | null
}
type LotST = {
  dceId: string
  nom: string
  kind: 'retenu' | 'refuse' | 'consulte'
  atSt: ST | null
  atStId: string | null
}

function STTab({ projetId }: { projetId: string }) {
  const [lots, setLots]       = useState<Lot[]>([])
  const [dceList, setDceList] = useState<DceAcces[]>([])
  const [atSts, setAtSts]     = useState<Array<ST & { dce_acces_id: string | null }>>([])
  const [loading, setLoading] = useState(true)
  const [selectedLot, setSelectedLot] = useState<string | null>(null)
  const [openStId, setOpenStId] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [lotRes, atRes, dceRes] = await Promise.all([
        supabase
          .from('lots' as never)
          .select('id,ordre,nom')
          .eq('projet_id', projetId)
          .order('ordre', { ascending: true }),
        supabase
          .schema('app')
          .from('at_sous_traitants')
          .select('id,nom,societe,corps_etat,statut,kbis_ok,rib_ok,urssaf_ok,fiscalite_ok,rc_ok,decennale_ok,dce_acces_id')
          .eq('projet_id', projetId),
        supabase
          .from('dce_acces_st' as never)
          .select('id,lot_id,statut,st_nom,st_societe')
          .eq('projet_id', projetId),
      ])
      setLots((lotRes.data ?? []) as unknown as Lot[])
      setAtSts((atRes.data ?? []) as Array<ST & { dce_acces_id: string | null }>)
      setDceList((dceRes.data ?? []) as unknown as DceAcces[])
      setLoading(false)
    }
    load()
  }, [projetId, refreshTick])

  const atByDce = useMemo(() => {
    const m = new Map<string, ST>()
    atSts.forEach((s) => { if (s.dce_acces_id) m.set(s.dce_acces_id, s) })
    return m
  }, [atSts])

  const stsByLot = useMemo(() => {
    const m = new Map<string, LotST[]>()
    for (const dce of dceList) {
      if (!dce.lot_id) continue
      const at = atByDce.get(dce.id) ?? null
      const kind: LotST['kind'] = at?.statut === 'refuse'
        ? 'refuse'
        : dce.statut === 'retenu' ? 'retenu' : 'consulte'
      const row: LotST = {
        dceId: dce.id,
        nom: dce.st_societe || dce.st_nom || 'ST',
        kind,
        atSt: at,
        atStId: at?.id ?? null,
      }
      if (!m.has(dce.lot_id)) m.set(dce.lot_id, [])
      m.get(dce.lot_id)!.push(row)
    }
    return m
  }, [dceList, atByDce])

  if (loading) return <SkeletonRows />

  if (lots.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="Aucun lot"
        sub="L'economiste n'a pas encore cree de lots pour ce projet. Sans lot, pas de ST a consulter."
      />
    )
  }

  const lot = lots.find((l) => l.id === selectedLot)
  const lotSts = lot ? (stsByLot.get(lot.id) ?? []) : []
  const retenu = lotSts.find((s) => s.kind === 'retenu')
  const refuses = lotSts.filter((s) => s.kind === 'refuse')
  const consultes = lotSts.filter((s) => s.kind === 'consulte')

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
          Selectionnez un lot ({lots.length})
        </p>
        <div className="flex flex-wrap gap-2">
          {lots.map((l) => {
            const count = stsByLot.get(l.id)?.length ?? 0
            const active = selectedLot === l.id
            return (
              <button
                key={l.id}
                onClick={() => setSelectedLot(l.id)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  active
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className={`font-mono ${active ? 'text-gray-300' : 'text-gray-400'}`}>{l.ordre}</span>
                <span>{l.nom}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {!lot ? (
        <EmptyState
          icon={Layers}
          title="Choisissez un lot"
          sub="Selectionnez un lot ci-dessus pour voir les sous-traitants consultes."
        />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-card overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-mono text-gray-400">Lot {lot.ordre}</span>
              <span className="text-sm font-semibold text-gray-900">{lot.nom}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{lotSts.length} <Abbr k="ST" /></span>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {lotSts.length === 0 ? (
              <p className="px-4 py-8 text-sm text-gray-400 text-center italic">Aucun ST consulte pour ce lot pour le moment</p>
            ) : (
              <>
                {retenu && <STRow row={retenu} onOpen={setOpenStId} />}
                {consultes.map((row) => <STRow key={row.dceId} row={row} onOpen={setOpenStId} />)}
                {refuses.map((row) => <STRow key={row.dceId} row={row} onOpen={setOpenStId} />)}
              </>
            )}
          </div>
        </div>
      )}

      <STValidationDrawer
        stId={openStId}
        onClose={() => setOpenStId(null)}
        onChange={() => setRefreshTick((t) => t + 1)}
      />
    </div>
  )
}

function STRow({ row, onOpen }: { row: LotST; onOpen: (id: string) => void }) {
  const at = row.atSt
  const docs = at ? [
    { ok: at.kbis_ok, label: 'Kbis' },
    { ok: at.rib_ok, label: 'RIB' },
    { ok: at.urssaf_ok, label: 'URSSAF' },
    { ok: at.fiscalite_ok, label: 'Fiscal' },
    { ok: at.rc_ok, label: 'RC' },
    { ok: at.decennale_ok, label: 'Dec' },
  ] : null
  const score = docs ? docs.filter((d) => d.ok).length : 0
  const clickable = !!row.atStId
  const handleClick = () => { if (row.atStId) onOpen(row.atStId) }
  return (
    <div
      onClick={handleClick}
      className={`flex items-start justify-between gap-3 px-4 py-3 ${row.kind === 'refuse' ? 'opacity-70' : ''} ${clickable ? 'cursor-pointer hover:bg-gray-50' : ''}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <p className={`text-sm font-medium truncate ${row.kind === 'refuse' ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
            {row.nom}
          </p>
          {row.kind === 'retenu' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3 h-3" /> Accepte
            </span>
          )}
          {row.kind === 'refuse' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200">
              <XCircle className="w-3 h-3" /> Refuse
            </span>
          )}
          {row.kind === 'consulte' && (
            score === 6 ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                <Clock className="w-3 h-3" /> En attente economiste
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                <Clock className="w-3 h-3" /> En cours de verification {at ? `(${score}/6)` : ''}
              </span>
            )
          )}
        </div>
      </div>
      {docs && (
        <div className="flex gap-1 flex-shrink-0">
          {docs.map((d) => (
            <span
              key={d.label}
              title={d.label}
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                d.ok ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'
              }`}
            >
              {d.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   ONGLET 2 — ONBOARDING (creation compte ST + dossier admin complet)
   ════════════════════════════════════════════════════════════════════════════ */

type OnboardingST = {
  id: string
  nom: string
  societe: string | null
  corps_etat: string | null
  siret: string | null
  email: string | null
  telephone: string | null
  statut: string
  dce_acces_id: string | null
  kbis_ok: boolean
  rib_ok: boolean
  attestation_ca_ok: boolean
  urssaf_ok: boolean
  fiscalite_ok: boolean
  salaries_etrangers_ok: boolean
  rc_ok: boolean
  decennale_ok: boolean
}

const ONBOARDING_CHECKS: Array<{ key: keyof OnboardingST; label: string }> = [
  { key: 'kbis_ok',              label: 'Kbis' },
  { key: 'rib_ok',               label: 'RIB' },
  { key: 'attestation_ca_ok',    label: 'Attestation CA' },
  { key: 'urssaf_ok',            label: 'URSSAF' },
  { key: 'fiscalite_ok',         label: 'Fiscal' },
  { key: 'salaries_etrangers_ok',label: 'Sal. etrangers' },
  { key: 'rc_ok',                label: 'RC Pro' },
  { key: 'decennale_ok',         label: 'Decennale' },
]

function OnboardingTab({ projetId }: { projetId: string }) {
  const [retenus, setRetenus] = useState<OnboardingST[]>([])
  const [accountByDce, setAccountByDce] = useState<Map<string, string | null>>(new Map())
  const [loading, setLoading] = useState(true)
  const [openStId, setOpenStId] = useState<string | null>(null)
  const [accountModalSt, setAccountModalSt] = useState<OnboardingST | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: dceData } = await supabase
        .from('dce_acces_st' as never)
        .select('id,statut,user_id')
        .eq('projet_id', projetId)
        .eq('statut', 'retenu')
      const retenuRows = ((dceData ?? []) as unknown as Array<{ id: string; user_id: string | null }>)
      const retenuDceIds = retenuRows.map((d) => d.id)
      const map = new Map<string, string | null>()
      retenuRows.forEach((r) => map.set(r.id, r.user_id))
      setAccountByDce(map)
      if (retenuDceIds.length === 0) {
        setRetenus([])
        setLoading(false)
        return
      }
      const { data: stData } = await supabase
        .schema('app')
        .from('at_sous_traitants')
        .select('id,nom,societe,corps_etat,siret,email,telephone,statut,dce_acces_id,kbis_ok,rib_ok,attestation_ca_ok,urssaf_ok,fiscalite_ok,salaries_etrangers_ok,rc_ok,decennale_ok')
        .eq('projet_id', projetId)
        .in('dce_acces_id', retenuDceIds)
      setRetenus((stData ?? []) as OnboardingST[])
      setLoading(false)
    }
    load()
  }, [projetId, refreshTick])

  if (loading) return <SkeletonRows />

  if (retenus.length === 0) {
    return (
      <EmptyState
        icon={UserCheck}
        title="Aucun ST en onboarding"
        sub="Les sous-traitants acceptes par l'economiste apparaitront ici pour creer leur compte et completer leur dossier administratif."
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
        <UserCheck className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-900">Onboarding sous-traitants retenus</p>
          <p className="text-xs text-blue-800 mt-0.5">
            Cree le compte ST et complete son dossier administratif complet (8 pieces) avant la signature du contrat.
          </p>
        </div>
      </div>

      <p className="text-xs text-gray-500">{retenus.length} sous-traitant{retenus.length > 1 ? 's' : ''} retenu{retenus.length > 1 ? 's' : ''}</p>

      <div className="space-y-2">
        {retenus.map((st) => {
          const score = ONBOARDING_CHECKS.filter((c) => st[c.key] as boolean).length
          const total = ONBOARDING_CHECKS.length
          const pct = Math.round((score / total) * 100)
          const isComplet = score === total
          const hasAccount = !!(st.dce_acces_id && accountByDce.get(st.dce_acces_id))
          return (
            <div
              key={st.id}
              className="bg-white rounded-lg border border-gray-200 shadow-card p-4 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <button
                  type="button"
                  onClick={() => setOpenStId(st.id)}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left"
                >
                  <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center text-sm font-semibold text-orange-600 flex-shrink-0">
                    {(st.societe || st.nom)[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900 truncate">{st.societe || st.nom}</p>
                      {isComplet ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Dossier complet
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3 h-3" /> En cours ({score}/{total})
                        </span>
                      )}
                      {hasAccount && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          <UserCheck className="w-3 h-3" /> Compte cree
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {st.corps_etat ?? '—'}
                      {st.siret && <> · <Abbr k="SIRET" /> {st.siret}</>}
                      {st.email && <> · {st.email}</>}
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-gray-400">{pct}%</span>
                  <button
                    type="button"
                    onClick={() => setAccountModalSt(st)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      hasAccount
                        ? 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                        : 'bg-gray-900 text-white border-gray-900 hover:bg-gray-800'
                    }`}
                  >
                    {hasAccount ? <KeyRound className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
                    {hasAccount ? 'Renvoyer / regenerer' : 'Creer compte & email'}
                  </button>
                </div>
              </div>

              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all ${isComplet ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="flex flex-wrap gap-1">
                {ONBOARDING_CHECKS.map((c) => {
                  const ok = st[c.key] as boolean
                  return (
                    <span
                      key={c.key as string}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        ok ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {c.label}
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <STValidationDrawer
        stId={openStId}
        onClose={() => setOpenStId(null)}
        onChange={() => setRefreshTick((t) => t + 1)}
      />

      {accountModalSt && (
        <OnboardingAccountModal
          st={accountModalSt}
          hasAccount={!!(accountModalSt.dce_acces_id && accountByDce.get(accountModalSt.dce_acces_id))}
          onClose={() => setAccountModalSt(null)}
          onSuccess={() => { setAccountModalSt(null); setRefreshTick((t) => t + 1) }}
        />
      )}
    </div>
  )
}

type Phase = 'setup' | 'review' | 'done'
type PreparedDraft = {
  email: string
  password: string | null
  login_url: string
  subject: string
  body: string
}

function OnboardingAccountModal({
  st, hasAccount, onClose, onSuccess,
}: {
  st: OnboardingST
  hasAccount: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const initialEmail = (st.email ?? '').trim()
  const hasInitialEmail = initialEmail.length > 0
  const [phase, setPhase] = useState<Phase>(hasInitialEmail ? 'review' : 'setup')
  const [email, setEmail] = useState(initialEmail)
  const [customMessage, setCustomMessage] = useState('')
  const [forceRegenerate, setForceRegenerate] = useState(hasAccount)
  const [busy, setBusy] = useState(hasInitialEmail)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<PreparedDraft | null>(null)
  const [emailSent, setEmailSent] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)

  useEffect(() => {
    if (!hasInitialEmail) return
    prepare(initialEmail, hasAccount, '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function prepare(emailArg?: string, regenerate?: boolean, msgArg?: string) {
    setError(null)
    setBusy(true)
    try {
      const r = await fetch('/api/at/onboard-st', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          at_st_id: st.id,
          email: (emailArg ?? email).trim() || undefined,
          force_regenerate: regenerate ?? forceRegenerate,
          custom_message: (msgArg ?? customMessage).trim() || undefined,
          mode: 'prepare',
        }),
      })
      const data = await r.json()
      if (!r.ok || data?.error) {
        setError(data?.error ?? 'Erreur')
        setBusy(false)
        return
      }
      setDraft({
        email: data.email,
        password: data.password ?? null,
        login_url: data.login_url,
        subject: data.suggested_subject,
        body: data.suggested_body,
      })
      setPhase('review')
      setBusy(false)
    } catch (e: any) {
      setError(e?.message ?? 'Erreur reseau')
      setBusy(false)
    }
  }

  async function regenerateNewPassword() {
    await prepare(draft?.email ?? email, true, customMessage)
  }

  async function send() {
    if (!draft) return
    setError(null)
    setBusy(true)
    try {
      const r = await fetch('/api/at/onboard-st', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          at_st_id: st.id,
          email: draft.email,
          mode: 'send',
          email_subject: draft.subject,
          email_body: draft.body,
        }),
      })
      const data = await r.json()
      if (!r.ok || data?.error) {
        setError(data?.error ?? 'Erreur')
        setBusy(false)
        return
      }
      setEmailSent(!!data.email_sent)
      setWarning(data.warning ?? null)
      setPhase('done')
      setBusy(false)
    } catch (e: any) {
      setError(e?.message ?? 'Erreur reseau')
      setBusy(false)
    }
  }

  function copy(value: string) {
    navigator.clipboard?.writeText(value).catch(() => {})
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-blue-600" />
              {phase === 'done'
                ? (emailSent ? 'Email envoye' : 'Compte pret')
                : phase === 'review'
                ? 'Verifier et envoyer le mail'
                : (hasAccount ? 'Renvoyer l\'acces compte' : 'Creer compte sous-traitant')}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">{st.societe || st.nom}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
        </div>

        {phase === 'setup' && (
          <>
            <div className="p-5 space-y-3">
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
                <Mail className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800">
                  {hasAccount
                    ? 'Le ST a deja un compte. Tu peux lui renvoyer un mail de bienvenue, ou regenerer son mot de passe.'
                    : 'Etape 1/2 : on va creer le compte ST en base et te montrer le mail pre-redige avec email + mot de passe avant envoi.'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email du ST *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@societe.fr"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                />
                <p className="text-[10px] text-gray-400 mt-1">Sera enregistre sur la fiche ST et utilise comme identifiant de connexion.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Message d&apos;accompagnement (optionnel)</label>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={3}
                  placeholder="Laisse vide pour utiliser le message par defaut. Tu pourras editer le mail complet a l'etape suivante."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none placeholder-gray-300"
                />
              </div>

              {hasAccount && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={forceRegenerate}
                    onChange={(e) => setForceRegenerate(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-gray-900"
                  />
                  <span className="text-xs text-gray-700">Regenerer le mot de passe (invalide l&apos;ancien)</span>
                </label>
              )}

              {error && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-800">{error}</p>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2 sticky bottom-0 bg-white">
              <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
              <button
                onClick={() => prepare()}
                disabled={busy || !email.trim()}
                className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-40"
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                {hasAccount ? 'Preparer le mail' : 'Creer le compte & preparer le mail'}
              </button>
            </div>
          </>
        )}

        {phase === 'review' && !draft && (
          <div className="p-10 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
            <p className="text-xs text-gray-500">
              {hasAccount ? 'Regeneration du mot de passe et preparation du mail...' : 'Creation du compte et preparation du mail...'}
            </p>
            {error && (
              <div className="mt-2 p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 max-w-md">
                <XCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-red-800">{error}</p>
                  <button onClick={() => setPhase('setup')}
                    className="mt-2 text-xs underline text-red-700 hover:text-red-900">
                    Saisir l&apos;email manuellement
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {phase === 'review' && draft && (
          <>
            <div className="p-5 space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-emerald-700">Compte ST {hasAccount ? 'mis a jour' : 'cree'} en base</p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Le mail est deja redige avec les identifiants. Verifie et envoie.
                  </p>
                </div>
              </div>

              {/* Identifiants visibles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex items-center justify-between gap-2 p-2 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400">Email</p>
                    <p className="text-sm font-mono text-gray-900 truncate">{draft.email}</p>
                  </div>
                  <button onClick={() => copy(draft.email)} className="text-gray-400 hover:text-gray-700 p-1.5" title="Copier">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
                {draft.password ? (
                  <div className="flex items-center justify-between gap-2 p-2 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-gray-400">Mot de passe</p>
                      <p className="text-sm font-mono text-gray-900 truncate">{draft.password}</p>
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <button onClick={() => copy(draft.password ?? '')} className="text-gray-400 hover:text-gray-700 p-1.5" title="Copier">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={regenerateNewPassword} disabled={busy}
                        className="text-gray-400 hover:text-gray-700 p-1.5 disabled:opacity-40" title="Regenerer un nouveau mot de passe">
                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-[11px] text-amber-800">
                        Compte existant — mdp non regenere.
                      </p>
                      <button onClick={regenerateNewPassword} disabled={busy}
                        className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-amber-900 hover:text-amber-700">
                        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <KeyRound className="w-3 h-3" />}
                        Generer un nouveau mdp
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Destinataire</label>
                <input
                  type="email"
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Objet</label>
                <input
                  type="text"
                  value={draft.subject}
                  onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Corps du mail (modifiable)</label>
                <textarea
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  rows={14}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Les identifiants sont deja inseres dans le corps. Tu peux personnaliser le ton avant envoi.
                </p>
              </div>

              {error && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-800">{error}</p>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-gray-200 flex justify-between gap-2 sticky bottom-0 bg-white">
              <button onClick={() => setPhase('setup')} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">
                Retour
              </button>
              <div className="flex gap-2">
                <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">Fermer sans envoyer</button>
                <button
                  onClick={send}
                  disabled={busy || !draft.email.trim()}
                  className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-40"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Envoyer le mail
                </button>
              </div>
            </div>
          </>
        )}

        {phase === 'done' && (
          <div className="p-5 space-y-3">
            <div className={`p-3 rounded-lg border flex items-start gap-2 ${
              emailSent ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
            }`}>
              {emailSent
                ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                : <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />}
              <div>
                <p className={`text-sm font-semibold ${emailSent ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {emailSent ? 'Mail de bienvenue envoye' : 'Compte cree, mail non envoye'}
                </p>
                <p className={`text-xs mt-0.5 ${emailSent ? 'text-emerald-700' : 'text-amber-800'}`}>
                  {emailSent
                    ? `Le ST recevra ses identifiants a ${draft?.email}.`
                    : (warning ?? 'Communique manuellement les identifiants au ST.')}
                </p>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={onSuccess}
                className="px-4 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800">
                Terminer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   ONGLET 3 — CONTRATS
   ════════════════════════════════════════════════════════════════════════════ */

function ContratsTab({ projetId }: { projetId: string }) {
  const [contrats, setContrats] = useState<Contrat[]>([])
  const [sts, setSts]           = useState<Pick<ST, 'id' | 'nom' | 'societe'>[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ st_id: '', numero: '', montant_ht: '', date_signature: '', notes: '' })
  const [generatorContratId, setGeneratorContratId] = useState<string | null>(null)

  async function fetchData() {
    const supabase = createClient()
    const [cRes, sRes] = await Promise.all([
      supabase.schema('app').from('at_contrats').select('*').eq('projet_id', projetId).order('created_at', { ascending: false }),
      supabase.schema('app').from('at_sous_traitants').select('id,nom,societe').eq('projet_id', projetId).order('nom'),
    ])
    setContrats((cRes.data ?? []) as Contrat[])
    setSts((sRes.data ?? []) as Pick<ST, 'id' | 'nom' | 'societe'>[])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [projetId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.st_id) return
    setSubmitting(true)
    const supabase = createClient()
    await supabase.schema('app').from('at_contrats').insert({
      projet_id: projetId,
      st_id: form.st_id,
      numero: form.numero || null,
      montant_ht: form.montant_ht ? Number(form.montant_ht) : null,
      date_signature: form.date_signature || null,
      notes: form.notes || null,
      statut: 'brouillon',
      cgv_incluses: false,
      delegation_paiement: false,
      second_rang: false,
      second_rang_valide: false,
    })
    setForm({ st_id: '', numero: '', montant_ht: '', date_signature: '', notes: '' })
    setShowForm(false)
    setSubmitting(false)
    fetchData()
  }

  async function toggle(id: string, field: keyof Contrat, current: boolean) {
    const supabase = createClient()
    await supabase.schema('app').from('at_contrats').update({ [field]: !current }).eq('id', id)
    fetchData()
  }

  async function setStatut(id: string, statut: string) {
    const supabase = createClient()
    await supabase.schema('app').from('at_contrats').update({ statut }).eq('id', id)
    fetchData()
  }

  const stName = (id: string) => {
    const s = sts.find((x) => x.id === id)
    return s ? (s.societe || s.nom) : '—'
  }

  if (loading) return <SkeletonRows />

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{contrats.length} contrat{contrats.length > 1 ? 's' : ''}</p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800"
        >
          <Plus className="w-3.5 h-3.5" /> Nouveau contrat
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-white rounded-lg border border-gray-200 shadow-card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1"><Abbr k="ST" /> *</label>
              <select
                value={form.st_id}
                onChange={(e) => setForm((f) => ({ ...f, st_id: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              >
                <option value="">Selectionner...</option>
                {sts.map((s) => <option key={s.id} value={s.id}>{s.societe || s.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">N° contrat</label>
              <input
                type="text"
                value={form.numero}
                onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Montant <Abbr k="HT" /></label>
              <input
                type="number"
                value={form.montant_ht}
                onChange={(e) => setForm((f) => ({ ...f, montant_ht: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date signature</label>
              <input
                type="date"
                value={form.date_signature}
                onChange={(e) => setForm((f) => ({ ...f, date_signature: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900">Annuler</button>
            <button type="submit" disabled={submitting || !form.st_id} className="px-3 py-1.5 text-xs text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50">
              {submitting ? '...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      )}

      {contrats.length === 0 ? (
        <EmptyState icon={FileText} title="Aucun contrat" sub="Creez le premier contrat ST pour ce projet." />
      ) : (
        contrats.map((c) => (
          <div key={c.id} className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-semibold text-gray-900">{stName(c.st_id)}</p>
                  <StatutBadge statut={c.statut} />
                </div>
                <p className="text-xs text-gray-400">
                  {c.numero ? `N° ${c.numero}` : 'Sans numero'}
                  {c.montant_ht ? ` · ${formatCurrency(c.montant_ht)} HT` : ''}
                  {c.date_signature ? ` · Signe le ${formatDate(c.date_signature)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => setGeneratorContratId(c.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800"
                  title="Generer le PDF avec l'IA et l'envoyer au ST"
                >
                  <Sparkles className="w-3 h-3" /> Generer & envoyer
                </button>
                {c.statut !== 'signe' && (
                  <button
                    onClick={() => setStatut(c.id, 'signe')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100"
                  >
                    <Check className="w-3 h-3" /> Marquer signe
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-50">
              {[
                { key: 'cgv_incluses', label: <><Abbr k="CGV" /> incluses</> },
                { key: 'delegation_paiement', label: 'Delegation paiement' },
                { key: 'second_rang', label: '2e rang' },
                { key: 'second_rang_valide', label: '2e rang valide' },
              ].map((ctrl) => {
                const val = c[ctrl.key as keyof Contrat] as boolean
                return (
                  <label key={ctrl.key} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={val}
                      onChange={() => toggle(c.id, ctrl.key as keyof Contrat, val)}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-gray-900"
                    />
                    <span className={`text-xs ${val ? 'text-emerald-600 font-medium' : 'text-gray-500'}`}>{ctrl.label}</span>
                  </label>
                )
              })}
            </div>
          </div>
        ))
      )}

      {generatorContratId && (
        <ContratGeneratorModal
          contratId={generatorContratId}
          projetId={projetId}
          onClose={() => setGeneratorContratId(null)}
          onSent={() => { setGeneratorContratId(null); fetchData() }}
        />
      )}
    </div>
  )
}

/* ── Modale Atelier contrat : IA → preview → PDF → envoi mail ─────────────── */

type ContratGenPhase = 'generating' | 'review' | 'sending' | 'done'

function ContratGeneratorModal({
  contratId, projetId, onClose, onSent,
}: {
  contratId: string
  projetId: string
  onClose: () => void
  onSent: () => void
}) {
  const [phase, setPhase]             = useState<ContratGenPhase>('generating')
  const [error, setError]             = useState<string | null>(null)
  const [descriptionMission, setDescriptionMission] = useState('')
  const [clauses, setClauses]         = useState<ContratClause[]>([])
  const [meta, setMeta]               = useState<{ projet_nom?: string; st_societe?: string; lot_nom?: string }>({})
  const [destinataire, setDestinataire] = useState('')
  const [subject, setSubject]         = useState('')
  const [message, setMessage]         = useState('')
  const [emailSent, setEmailSent]     = useState(false)
  const [warning, setWarning]         = useState<string | null>(null)

  /* 1. Genere les clauses IA au montage */
  useEffect(() => {
    generateClauses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function generateClauses() {
    setError(null)
    setPhase('generating')
    try {
      const r = await fetch('/api/at/contrats/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contrat_id: contratId }),
      })
      const data = await r.json()
      if (!r.ok || data?.error) {
        setError(data?.error ?? 'Erreur IA')
        return
      }
      setDescriptionMission(data.description_mission ?? '')
      setClauses(data.clauses ?? [])
      setMeta(data.meta ?? {})
      setPhase('review')
    } catch (e: any) {
      setError(e?.message ?? 'Erreur reseau')
    }
  }

  /* 2. Charge les donnees contrat + ST + projet pour generer le PDF */
  async function buildPdfBlob(): Promise<Blob> {
    const supabase = createClient()
    const [cRes, stsRes, projRes] = await Promise.all([
      supabase.schema('app').from('at_contrats')
        .select('id,projet_id,st_id,numero,montant_ht,cgv_incluses,delegation_paiement,second_rang,notes,date_signature')
        .eq('id', contratId).maybeSingle(),
      supabase.schema('app').from('at_sous_traitants')
        .select('id,nom,societe,siret,email,telephone,corps_etat,dce_acces_id')
        .eq('projet_id', projetId),
      supabase.schema('app').from('projets')
        .select('id,nom,reference,adresse,type_chantier').eq('id', projetId).maybeSingle(),
    ])
    const contrat = cRes.data as {
      id: string; projet_id: string | null; st_id: string; numero: string | null
      montant_ht: number | null; cgv_incluses: boolean; delegation_paiement: boolean
      second_rang: boolean; notes: string | null; date_signature: string | null
    } | null
    if (!contrat) throw new Error('Contrat introuvable')
    const stRow = (stsRes.data as Array<{
      id: string; nom: string; societe: string | null; siret: string | null
      email: string | null; telephone: string | null; corps_etat: string | null
      dce_acces_id: string | null
    }>).find((s) => s.id === contrat.st_id)
    if (!stRow) throw new Error('Sous-traitant introuvable')
    const projet = projRes.data as {
      id: string; nom: string; reference: string | null; adresse: string | null; type_chantier: string | null
    } | null

    const blob = generateContratSTPdf({
      numero: contrat.numero,
      date_redaction: new Date().toISOString(),
      projet_nom: projet?.nom ?? '—',
      projet_reference: projet?.reference ?? null,
      projet_adresse: projet?.adresse ?? null,
      projet_type: projet?.type_chantier ?? null,
      entreprise_nom: 'API Renovation',
      entreprise_adresse: null,
      entreprise_siret: null,
      entreprise_representant: null,
      st_societe: stRow.societe,
      st_nom: stRow.nom,
      st_siret: stRow.siret,
      st_adresse: null,
      st_representant: null,
      st_email: stRow.email,
      st_telephone: stRow.telephone,
      lot_nom: meta.lot_nom ?? null,
      corps_etat: stRow.corps_etat,
      description_mission: descriptionMission,
      montant_ht: contrat.montant_ht ?? 0,
      tva_pct: 20,
      delai_paiement_jours: 45,
      retenue_garantie_pct: 5,
      cgv_incluses: contrat.cgv_incluses,
      delegation_paiement: contrat.delegation_paiement,
      second_rang: contrat.second_rang,
      date_debut: null,
      date_fin: null,
      clauses,
    })

    if (!destinataire && stRow.email) setDestinataire(stRow.email)
    return blob
  }

  async function downloadPdf() {
    try {
      const blob = await buildPdfBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `contrat-${meta.st_societe ?? 'st'}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setError(e?.message ?? 'Erreur PDF')
    }
  }

  async function sendToST() {
    setError(null)
    setPhase('sending')
    try {
      const blob = await buildPdfBlob()
      const buf = await blob.arrayBuffer()
      const base64 = arrayBufferToBase64(buf)
      const r = await fetch('/api/at/contrats/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contrat_id: contratId,
          pdf_base64: base64,
          to: destinataire.trim() || undefined,
          subject: subject.trim() || undefined,
          message: message.trim() || undefined,
        }),
      })
      const data = await r.json()
      if (!r.ok || data?.error) {
        setError(data?.error ?? 'Erreur envoi')
        setPhase('review')
        return
      }
      setEmailSent(!!data.email_sent)
      setWarning(data.warning ?? null)
      setPhase('done')
    } catch (e: any) {
      setError(e?.message ?? 'Erreur reseau')
      setPhase('review')
    }
  }

  function updateClause(i: number, patch: Partial<ContratClause>) {
    setClauses((prev) => prev.map((c, idx) => idx === i ? { ...c, ...patch } : c))
  }
  function removeClause(i: number) {
    setClauses((prev) => prev.filter((_, idx) => idx !== i))
  }
  function addClause() {
    setClauses((prev) => [...prev, { titre: 'Nouvelle clause', contenu: '' }])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <FileSignature className="w-4 h-4 text-blue-600" />
              {phase === 'done' ? (emailSent ? 'Contrat envoye' : 'Contrat genere') : 'Atelier contrat IA'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {meta.st_societe ?? 'Sous-traitant'} {meta.projet_nom ? `· ${meta.projet_nom}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
        </div>

        {phase === 'generating' && (
          <div className="p-10 flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
            <p className="text-sm text-gray-700">Generation des clauses par l&apos;IA...</p>
            <p className="text-xs text-gray-400">Description de la mission + 8 articles juridiques standard.</p>
            {error && (
              <div className="mt-2 p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 max-w-md">
                <XCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-red-800">{error}</p>
                  <button onClick={generateClauses} className="mt-2 text-xs underline text-red-700 hover:text-red-900">
                    Reessayer
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {phase === 'review' && (
          <>
            <div className="p-5 space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-900">Contrat genere par l&apos;IA</p>
                  <p className="text-xs text-blue-800 mt-0.5">
                    Verifie et personnalise le contenu, telecharge un apercu PDF, puis envoie au ST.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Description de la mission</label>
                <textarea
                  value={descriptionMission}
                  onChange={(e) => setDescriptionMission(e.target.value)}
                  rows={4}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-600">Clauses du contrat ({clauses.length})</p>
                  <div className="flex gap-1">
                    <button onClick={generateClauses}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50">
                      <Sparkles className="w-3 h-3" /> Re-generer
                    </button>
                    <button onClick={addClause}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50">
                      <Plus className="w-3 h-3" /> Ajouter
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {clauses.map((c, i) => (
                    <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-gray-400">Art. {i + 1}</span>
                        <input
                          value={c.titre}
                          onChange={(e) => updateClause(i, { titre: e.target.value })}
                          className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-gray-900/10"
                        />
                        <button onClick={() => removeClause(i)} className="text-gray-400 hover:text-red-600 p-1">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <textarea
                        value={c.contenu}
                        onChange={(e) => updateClause(i, { contenu: e.target.value })}
                        rows={4}
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-gray-900/10"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4 space-y-3">
                <p className="text-xs font-semibold text-gray-600">Envoi au sous-traitant</p>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Destinataire</label>
                  <input
                    type="email"
                    value={destinataire}
                    onChange={(e) => setDestinataire(e.target.value)}
                    placeholder="email du ST"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Objet (optionnel)</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Laisse vide pour utiliser l'objet par defaut"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Message d&apos;accompagnement (optionnel)</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    placeholder="Laisse vide pour utiliser le message par defaut"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none placeholder-gray-300"
                  />
                </div>
              </div>

              {error && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-800">{error}</p>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-gray-200 flex justify-between gap-2 sticky bottom-0 bg-white">
              <button onClick={downloadPdf}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50">
                <Download className="w-3.5 h-3.5" /> Apercu PDF
              </button>
              <div className="flex gap-2">
                <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
                <button
                  onClick={sendToST}
                  disabled={clauses.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" /> Envoyer au ST
                </button>
              </div>
            </div>
          </>
        )}

        {phase === 'sending' && (
          <div className="p-10 flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
            <p className="text-sm text-gray-700">Generation du PDF et envoi au ST...</p>
          </div>
        )}

        {phase === 'done' && (
          <div className="p-5 space-y-3">
            <div className={`p-3 rounded-lg border flex items-start gap-2 ${
              emailSent ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
            }`}>
              {emailSent
                ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                : <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />}
              <div>
                <p className={`text-sm font-semibold ${emailSent ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {emailSent ? 'Contrat envoye au ST' : 'Contrat genere, mail non envoye'}
                </p>
                <p className={`text-xs mt-0.5 ${emailSent ? 'text-emerald-700' : 'text-amber-800'}`}>
                  {emailSent
                    ? `Le ST a recu le contrat en piece jointe a ${destinataire}.`
                    : (warning ?? 'Tu peux re-essayer ou telecharger le PDF.')}
                </p>
              </div>
            </div>
            <div className="flex justify-between pt-2">
              <button onClick={downloadPdf}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50">
                <Download className="w-3.5 h-3.5" /> Telecharger le PDF
              </button>
              <button onClick={onSent}
                className="px-4 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800">
                Terminer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as number[])
  }
  return btoa(binary)
}

/* ════════════════════════════════════════════════════════════════════════════
   ONGLET 3 — COMPTE PRORATA
   ════════════════════════════════════════════════════════════════════════════ */

type ProrataContrat = { id: string; st_id: string; numero: string | null; montant_ht: number | null; taux_prorata_pct: number | null }
type ProrataSTRow = Pick<ST, 'id' | 'nom' | 'societe'> & { corps_etat: string | null; dce_acces_id: string | null }
type ProrataLot   = { id: string; ordre: number; nom: string }
type ProrataDce   = { id: string; lot_id: string | null; statut: string | null; user_id: string | null }
type ProrataOffre = { acces_id: string | null; total_ht: number | null; montant_total_ht: number | null }

function ProrataTab({ projetId }: { projetId: string }) {
  const [dics, setDics]           = useState<DIC[]>([])
  const [paiements, setPaiements] = useState<ProrataPaiement[]>([])
  const [appels, setAppels]       = useState<ProrataAppel[]>([])
  const [contrats, setContrats]   = useState<ProrataContrat[]>([])
  const [sts, setSts]             = useState<ProrataSTRow[]>([])
  const [lots, setLots]           = useState<ProrataLot[]>([])
  const [dceAcces, setDceAcces]   = useState<ProrataDce[]>([])
  const [offres, setOffres]       = useState<ProrataOffre[]>([])
  const [loading, setLoading]     = useState(true)
  const [expandedSt, setExpandedSt] = useState<Set<string>>(new Set())
  const [defaultTaux, setDefaultTaux] = useState<number>(2)
  const [savingTauxId, setSavingTauxId] = useState<string | null>(null)
  const [appelStModal, setAppelStModal] = useState<{ st_id: string; st_label: string; quote_part: number } | null>(null)
  const [paiementModal, setPaiementModal] = useState<{ st_id: string; st_label: string; paiement_id?: string; suggestedAmount: number } | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [budgetEstimeCO, setBudgetEstimeCO] = useState<number | null>(null) // prorata.budget_estime (saisi par CO)
  const [budgetProjet, setBudgetProjet]     = useState<number | null>(null) // projets.budget_total (saisi par CO)
  const [showDicForm, setShowDicForm]     = useState(false)
  const [showAppelForm, setShowAppelForm] = useState(false)
  const [submittingDic, setSubmittingDic] = useState(false)
  const [submittingAppel, setSubmittingAppel] = useState(false)
  const [dicForm, setDicForm] = useState({ libelle: '', montant_ht: '', date_depense: '', tva_pct: '20', justificatif_url: '' })
  const [dicScanning, setDicScanning] = useState(false)
  const [dicScanError, setDicScanError] = useState<string | null>(null)
  const [dicUploading, setDicUploading] = useState(false)
  const [appelForm, setAppelForm] = useState({
    libelle: '', taux_appele: '50', taux_quote_part: '2', delai_paiement_jours: '14', notes: '',
  })
  const [appelStIds, setAppelStIds] = useState<Set<string>>(new Set())
  const [relancedUserIds, setRelancedUserIds] = useState<Set<string>>(new Set())
  const [expandedAppels, setExpandedAppels] = useState<Set<string>>(new Set())
  const [validatingId, setValidatingId] = useState<string | null>(null)
  const [refuseModal, setRefuseModal] = useState<{ paiement_id: string; motif: string } | null>(null)

  async function fetchData() {
    const supabase = createClient()
    const [dRes, pRes, sRes, aRes, cRes, lRes, dceRes, oRes] = await Promise.all([
      supabase.schema('app').from('compte_prorata_dic').select('*').eq('projet_id', projetId).order('date_depense', { ascending: false }),
      supabase.schema('app').from('compte_prorata_paiements').select('*').eq('projet_id', projetId).order('date_emission', { ascending: false }),
      supabase.schema('app').from('at_sous_traitants').select('id,nom,societe,corps_etat,dce_acces_id').eq('projet_id', projetId).order('nom'),
      supabase.schema('app').from('compte_prorata_appels').select('*').eq('projet_id', projetId).order('date_appel', { ascending: false }),
      supabase.schema('app').from('at_contrats').select('id,st_id,numero,montant_ht,taux_prorata_pct').eq('projet_id', projetId),
      supabase.from('lots' as never).select('id,ordre,nom').eq('projet_id', projetId).order('ordre'),
      supabase.from('dce_acces_st' as never).select('id,lot_id,statut,user_id').eq('projet_id', projetId),
      supabase.from('dce_offres_st' as never).select('acces_id,total_ht,montant_total_ht').eq('projet_id', projetId),
    ])
    // Charge le taux + budget estime du projet (saisis par le commercial / CO)
    const [{ data: prorataCfg }, { data: projetCfg }] = await Promise.all([
      supabase.schema('app').from('prorata').select('taux_pct,budget_estime').eq('projet_id', projetId).maybeSingle(),
      supabase.schema('app').from('projets').select('budget_total').eq('id', projetId).maybeSingle(),
    ])
    const tx  = (prorataCfg as { taux_pct: number | null; budget_estime: number | null } | null)?.taux_pct
    const est = (prorataCfg as { taux_pct: number | null; budget_estime: number | null } | null)?.budget_estime
    const bt  = (projetCfg as { budget_total: number | null } | null)?.budget_total
    if (tx && tx > 0) setDefaultTaux(Number(tx))
    setBudgetEstimeCO(est != null ? Number(est) : null)
    setBudgetProjet(bt != null ? Number(bt) : null)
    setDics((dRes.data ?? []) as DIC[])
    setPaiements((pRes.data ?? []) as ProrataPaiement[])
    setSts((sRes.data ?? []) as ProrataSTRow[])
    setAppels((aRes.data ?? []) as ProrataAppel[])
    setContrats((cRes.data ?? []) as ProrataContrat[])
    setLots(((lRes.data ?? []) as unknown) as ProrataLot[])
    setDceAcces(((dceRes.data ?? []) as unknown) as ProrataDce[])
    setOffres(((oRes.data ?? []) as unknown) as ProrataOffre[])

    // Charge les utilisateurs ayant recu une relance prorata (pour badge "Rappele")
    const { data: relances } = await supabase
      .schema('app').from('alertes')
      .select('utilisateur_id')
      .eq('projet_id', projetId)
      .in('type', ['prorata_rappel', 'prorata_retard'])
    const userIds = new Set<string>(
      ((relances ?? []) as Array<{ utilisateur_id: string | null }>)
        .map((a) => a.utilisateur_id)
        .filter((u): u is string => !!u),
    )
    setRelancedUserIds(userIds)

    setLoading(false)
  }

  useEffect(() => { fetchData() }, [projetId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function submitDic(e: React.FormEvent) {
    e.preventDefault()
    if (!dicForm.libelle || !dicForm.montant_ht) return
    setSubmittingDic(true)
    const ht = Number(dicForm.montant_ht)
    const tva = dicForm.tva_pct ? Number(dicForm.tva_pct) : 0
    const ttc = +(ht * (1 + tva / 100)).toFixed(2)
    const supabase = createClient()
    await supabase.schema('app').from('compte_prorata_dic').insert({
      projet_id: projetId,
      libelle: dicForm.libelle,
      montant_ht: ht,
      tva_pct: tva || null,
      montant_ttc: ttc,
      date_depense: dicForm.date_depense || null,
      justificatif_url: dicForm.justificatif_url || null,
    } as never)
    setDicForm({ libelle: '', montant_ht: '', date_depense: '', tva_pct: '20', justificatif_url: '' })
    setShowDicForm(false)
    setSubmittingDic(false)
    fetchData()
  }

  /* Scan d'une facture DIC via webhook OCR n8n (meme flow que NDF) */
  async function scanDicFacture(file: File) {
    setDicScanError(null)
    setDicScanning(true)
    try {
      const supabase = createClient()
      // 1. Upload du justificatif dans le bucket comptabilite
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
      const path = `dic/${projetId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('comptabilite')
        .upload(path, file, { contentType: file.type, upsert: false })
      if (upErr) throw new Error('Upload echoue : ' + upErr.message)
      const { data: urlData } = supabase.storage.from('comptabilite').getPublicUrl(path)
      const justificatif_url = urlData.publicUrl

      // 2. Appel webhook OCR (type_piece=ACHAT = facture fournisseur)
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type_piece', 'ACHAT')
      formData.append('mode_paiement', 'VIR')
      formData.append('lien_fichier', justificatif_url)
      const res = await fetch(N8N_OCR_WEBHOOK, { method: 'POST', body: formData })
      if (!res.ok) throw new Error(`Webhook OCR : HTTP ${res.status}`)

      // 3. Parse + prefill
      let extracted: ReturnType<typeof extractDicFromOcr> = {}
      try {
        const json = await res.json()
        extracted = extractDicFromOcr(json)
      } catch { /* pas de JSON exploitable, on ouvre vide */ }

      setDicForm((f) => ({
        ...f,
        libelle:          extracted.libelle      ?? f.libelle,
        montant_ht:       extracted.montant_ht   ?? f.montant_ht,
        tva_pct:          extracted.tva_pct      ?? f.tva_pct,
        date_depense:     extracted.date_depense ?? f.date_depense,
        justificatif_url,
      }))
      setShowDicForm(true)
    } catch (err) {
      setDicScanError(err instanceof Error ? err.message : String(err))
    } finally {
      setDicScanning(false)
    }
  }

  /* Upload manuel d'un justificatif (sans OCR) — pour saisie manuelle */
  async function uploadDicJustificatif(file: File) {
    setDicScanError(null)
    setDicUploading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
      const path = `dic/${projetId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('comptabilite')
        .upload(path, file, { contentType: file.type, upsert: false })
      if (upErr) throw new Error('Upload echoue : ' + upErr.message)
      const { data: urlData } = supabase.storage.from('comptabilite').getPublicUrl(path)
      setDicForm((f) => ({ ...f, justificatif_url: urlData.publicUrl }))
    } catch (err) {
      setDicScanError(err instanceof Error ? err.message : String(err))
    } finally {
      setDicUploading(false)
    }
  }

  async function submitAppel(e: React.FormEvent) {
    e.preventDefault()
    if (!appelForm.libelle) return
    if (appelStIds.size === 0) {
      alert('Selectionnez au moins un ST.')
      return
    }
    setSubmittingAppel(true)
    try {
      // Construit la liste des overrides (montant base par ST = contrat ou offre acceptee)
      const st_overrides = appelStsAvailable
        .filter((s) => appelStIds.has(s.st_id))
        .map((s) => ({ st_id: s.st_id, montant_ht: s.montant_ht }))
      const r = await fetch('/api/at/prorata/create-appel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projet_id: projetId,
          libelle: appelForm.libelle,
          taux_appele: Number(appelForm.taux_appele),
          taux_quote_part: Number(appelForm.taux_quote_part),
          delai_paiement_jours: Number(appelForm.delai_paiement_jours),
          notes: appelForm.notes || undefined,
          st_ids: Array.from(appelStIds),
          st_overrides,
        }),
      })
      const data = await r.json()
      if (!r.ok || data?.error) {
        alert(`Erreur : ${data?.error ?? 'creation appel echouee'}`)
      } else {
        setAppelForm({ libelle: '', taux_appele: '50', taux_quote_part: '2', delai_paiement_jours: '14', notes: '' })
        setAppelStIds(new Set())
        setShowAppelForm(false)
        fetchData()
      }
    } finally {
      setSubmittingAppel(false)
    }
  }

  async function validerRecu(paiement_id: string) {
    setValidatingId(paiement_id)
    try {
      const r = await fetch('/api/at/prorata/valider-recu', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paiement_id, action: 'valider' }),
      })
      const data = await r.json()
      if (!r.ok || data?.error) alert(`Erreur : ${data?.error}`)
      else fetchData()
    } finally {
      setValidatingId(null)
    }
  }

  async function refuserRecu() {
    if (!refuseModal || !refuseModal.motif.trim()) return
    setValidatingId(refuseModal.paiement_id)
    try {
      const r = await fetch('/api/at/prorata/valider-recu', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paiement_id: refuseModal.paiement_id, action: 'refuser', motif: refuseModal.motif.trim() }),
      })
      const data = await r.json()
      if (!r.ok || data?.error) alert(`Erreur : ${data?.error}`)
      else { setRefuseModal(null); fetchData() }
    } finally {
      setValidatingId(null)
    }
  }

  function toggleAppel(id: string) {
    setExpandedAppels((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const today = new Date()
  const stName = (id: string | null) => {
    if (!id) return '—'
    const s = sts.find((x) => x.id === id)
    return s ? (s.societe || s.nom) : '—'
  }
  const paiementsByAppel = useMemo(() => {
    const m = new Map<string, ProrataPaiement[]>()
    for (const p of paiements) {
      const k = p.appel_id ?? '__orphan__'
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(p)
    }
    return m
  }, [paiements])

  /* ─── Agregation par ST pour le suivi ─── */
  const lotByDce = useMemo(() => {
    const m = new Map<string, string>()
    dceAcces.forEach((a) => { if (a.lot_id) m.set(a.id, a.lot_id) })
    return m
  }, [dceAcces])
  const lotById = useMemo(() => {
    const m = new Map<string, ProrataLot>()
    lots.forEach((l) => m.set(l.id, l))
    return m
  }, [lots])
  const contratByStId = useMemo(() => {
    const m = new Map<string, ProrataContrat>()
    contrats.forEach((c) => m.set(c.st_id, c))
    return m
  }, [contrats])
  const stById = useMemo(() => {
    const m = new Map<string, ProrataSTRow>()
    sts.forEach((s) => m.set(s.id, s))
    return m
  }, [sts])
  // ST → was a relance alerte sent to its plateforme user ?
  const rappeleStIds = useMemo(() => {
    const accesById = new Map<string, ProrataDce>()
    dceAcces.forEach((a) => accesById.set(a.id, a))
    const set = new Set<string>()
    sts.forEach((s) => {
      if (!s.dce_acces_id) return
      const userId = accesById.get(s.dce_acces_id)?.user_id
      if (userId && relancedUserIds.has(userId)) set.add(s.id)
    })
    return set
  }, [sts, dceAcces, relancedUserIds])
  const paiementsBySt = useMemo(() => {
    const m = new Map<string, ProrataPaiement[]>()
    paiements.forEach((p) => {
      if (!p.st_id) return
      if (!m.has(p.st_id)) m.set(p.st_id, [])
      m.get(p.st_id)!.push(p)
    })
    return m
  }, [paiements])

  /* Total des offres acceptees par acces_id (fallback si pas de contrat encore) */
  const offreByDce = useMemo(() => {
    const m = new Map<string, number>()
    offres.forEach((o) => {
      if (!o.acces_id) return
      const ht = Number(o.total_ht ?? o.montant_total_ht ?? 0)
      m.set(o.acces_id, (m.get(o.acces_id) ?? 0) + ht)
    })
    return m
  }, [offres])

  /* Seul les ST retenus (acceptes par l'economiste) sont concernes par le prorata.
     1 lot = 1 ST retenu via dce_acces_st.statut = 'retenu' */
  const retainedDceIds = useMemo(() => {
    return new Set(dceAcces.filter((a) => a.statut === 'retenu').map((a) => a.id))
  }, [dceAcces])
  const stsRetenus = useMemo(() => {
    return sts.filter((s) => s.dce_acces_id && retainedDceIds.has(s.dce_acces_id))
  }, [sts, retainedDceIds])

  // STs eligibles a un appel : ST retenus avec contrat OU offre acceptee
  const appelStsAvailable = useMemo(() => {
    return stsRetenus
      .map((s) => {
        const contrat = contratByStId.get(s.id) ?? null
        const offreTotal = s.dce_acces_id ? Number(offreByDce.get(s.dce_acces_id) ?? 0) : 0
        const contratHt  = Number(contrat?.montant_ht ?? 0)
        const montantHt  = contratHt > 0 ? contratHt : offreTotal
        if (montantHt <= 0) return null
        return {
          st_id: s.id,
          label: s.societe || s.nom,
          montant_ht: montantHt,
          source: (contratHt > 0 ? 'contrat' : 'offre') as 'contrat' | 'offre',
        }
      })
      .filter((x): x is { st_id: string; label: string; montant_ht: number; source: 'contrat' | 'offre' } => x !== null)
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [stsRetenus, contratByStId, offreByDce])

  // Pre-selectionne tous les STs eligibles quand on ouvre le formulaire d'appel
  useEffect(() => {
    if (showAppelForm && appelStIds.size === 0 && appelStsAvailable.length > 0) {
      setAppelStIds(new Set(appelStsAvailable.map((s) => s.st_id)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAppelForm, appelStsAvailable])

  type StSummary = {
    st: ProrataSTRow
    lotNom: string | null
    lotOrdre: number | null
    contrat: ProrataContrat | null
    montantContrat: number
    montantSource: 'contrat' | 'offre' | 'aucun'
    tauxApplique: number
    tauxOverride: boolean
    quotePartTotale: number
    cumulAppele: number
    cumulPaye: number
    nbFactures: number
    nbAValider: number
    nbRetard: number
    reste: number
    statut: 'a_jour' | 'partiel' | 'retard' | 'non_appele'
  }
  const stSummaries: StSummary[] = useMemo(() => {
    return stsRetenus.map((s): StSummary => {
      const lotId = s.dce_acces_id ? lotByDce.get(s.dce_acces_id) : undefined
      const lot   = lotId ? lotById.get(lotId) : undefined
      const contrat = contratByStId.get(s.id) ?? null
      const montantContrat = Number(contrat?.montant_ht ?? 0)
      const offreTotalHt   = s.dce_acces_id ? Number(offreByDce.get(s.dce_acces_id) ?? 0) : 0
      const montantBase    = montantContrat > 0 ? montantContrat : offreTotalHt
      const montantSource: StSummary['montantSource'] =
        montantContrat > 0 ? 'contrat' : (offreTotalHt > 0 ? 'offre' : 'aucun')
      const tauxOverride   = contrat?.taux_prorata_pct != null
      const tauxApplique   = tauxOverride ? Number(contrat!.taux_prorata_pct) : defaultTaux
      const quotePartTotale = +(montantBase * tauxApplique / 100).toFixed(2)
      const facturesSt = paiementsBySt.get(s.id) ?? []
      const cumulAppele = facturesSt.reduce((acc, p) => acc + (Number(p.montant_du) || 0), 0)
      const cumulPaye   = facturesSt
        .filter((p) => p.statut === 'valide')
        .reduce((acc, p) => acc + (Number(p.montant_paye) || Number(p.montant_du) || 0), 0)
      const nbAValider = facturesSt.filter((p) => p.statut === 'paye').length
      const nbRetard   = facturesSt.filter((p) =>
        p.statut !== 'valide' && p.date_echeance && new Date(p.date_echeance) < today
      ).length
      const reste = +(cumulAppele - cumulPaye).toFixed(2)
      const statut: StSummary['statut'] =
        facturesSt.length === 0 ? 'non_appele'
        : nbRetard > 0 ? 'retard'
        : reste > 0 ? 'partiel'
        : 'a_jour'
      return {
        st: s,
        lotNom: lot?.nom ?? null,
        lotOrdre: lot?.ordre ?? null,
        contrat,
        montantContrat: montantBase,
        montantSource,
        tauxApplique,
        tauxOverride,
        quotePartTotale,
        cumulAppele,
        cumulPaye,
        nbFactures: facturesSt.length,
        nbAValider,
        nbRetard,
        reste,
        statut,
      }
    }).sort((a, b) => {
      if (a.nbRetard !== b.nbRetard) return b.nbRetard - a.nbRetard
      if ((a.lotOrdre ?? 999) !== (b.lotOrdre ?? 999)) return (a.lotOrdre ?? 999) - (b.lotOrdre ?? 999)
      return (a.st.societe || a.st.nom).localeCompare(b.st.societe || b.st.nom)
    })
  }, [stsRetenus, lotByDce, lotById, contratByStId, paiementsBySt, offreByDce, defaultTaux, today])

  /* Maj du taux quote-part par ST (persiste sur at_contrats.taux_prorata_pct) */
  async function updateTauxPerSt(contratId: string | null, stId: string, value: string) {
    const num = value.trim() === '' ? null : Number(value)
    if (num !== null && (isNaN(num) || num <= 0 || num > 100)) return
    setSavingTauxId(stId)
    try {
      const supabase = createClient()
      if (!contratId) {
        // Pas encore de contrat → cree un brouillon pour stocker le taux
        const { data: inserted } = await supabase.schema('app').from('at_contrats')
          .insert({ projet_id: projetId, st_id: stId, statut: 'brouillon', taux_prorata_pct: num,
                    cgv_incluses: false, delegation_paiement: false, second_rang: false, second_rang_valide: false } as never)
          .select('id').single()
        if (inserted) await fetchData()
      } else {
        await supabase.schema('app').from('at_contrats')
          .update({ taux_prorata_pct: num } as never).eq('id', contratId)
        await fetchData()
      }
    } finally {
      setSavingTauxId(null)
    }
  }

  /* Taux par defaut du projet : maj de la table prorata */
  async function updateDefaultTaux(value: string) {
    const num = Number(value)
    if (isNaN(num) || num <= 0 || num > 100) return
    setDefaultTaux(num)
    const supabase = createClient()
    const { data: existing } = await supabase.schema('app').from('prorata')
      .select('id').eq('projet_id', projetId).maybeSingle()
    if (existing) {
      await supabase.schema('app').from('prorata').update({ taux_pct: num } as never).eq('projet_id', projetId)
    } else {
      await supabase.schema('app').from('prorata').insert({ projet_id: projetId, taux_pct: num } as never)
    }
  }

  function toggleStExpand(id: string) {
    setExpandedSt((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /* Appel de fonds individuel pour un ST */
  async function submitAppelIndividuel(taux_appele: number, libelle: string) {
    if (!appelStModal) return
    setBusyAction('appel')
    try {
      const r = await fetch('/api/at/prorata/create-appel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projet_id: projetId, st_id: appelStModal.st_id, libelle, taux_appele,
          taux_quote_part: defaultTaux, delai_paiement_jours: 14,
        }),
      })
      const data = await r.json()
      if (!r.ok || data?.error) alert(`Erreur : ${data?.error}`)
      else { setAppelStModal(null); fetchData() }
    } finally { setBusyAction(null) }
  }

  /* Saisie d'un paiement manuel */
  async function submitPaiementManuel(montant: number, notes: string) {
    if (!paiementModal) return
    setBusyAction('paiement')
    try {
      const r = await fetch('/api/at/prorata/saisir-paiement', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paiement_id: paiementModal.paiement_id,
          projet_id: projetId, st_id: paiementModal.st_id,
          montant_paye: montant, notes,
        }),
      })
      const data = await r.json()
      if (!r.ok || data?.error) alert(`Erreur : ${data?.error}`)
      else { setPaiementModal(null); fetchData() }
    } finally { setBusyAction(null) }
  }

  /* Changer le statut d'une facture prorata (action AT) */
  async function changeStatutPaiement(p: ProrataPaiement, next: string) {
    setBusyAction(`statut-${p.id}`)
    try {
      const supabase = createClient()
      const patch: Record<string, unknown> = { statut: next }
      if (next === 'valide') {
        patch.valide_at = new Date().toISOString()
        if (!p.date_paiement) patch.date_paiement = new Date().toISOString().split('T')[0]
        if ((p.montant_paye ?? 0) <= 0 && p.montant_du != null) patch.montant_paye = p.montant_du
      } else if (next === 'refuse') {
        patch.valide_at = null
      } else if (next === 'non_paye') {
        patch.montant_paye = 0
        patch.date_paiement = null
        patch.valide_at = null
      }
      const { error } = await supabase
        .schema('app').from('compte_prorata_paiements')
        .update(patch as never)
        .eq('id', p.id)
      if (error) { alert('Erreur : ' + error.message); return }
      // Notification au ST (best effort)
      if (p.st_id && (next === 'valide' || next === 'refuse')) {
        const st = sts.find((s) => s.id === p.st_id)
        const accesId = st?.dce_acces_id
        const userId = accesId ? dceAcces.find((a) => a.id === accesId)?.user_id : null
        if (userId) {
          await supabase.schema('app').from('alertes').insert({
            utilisateur_id: userId,
            projet_id:      projetId,
            type:           next === 'valide' ? 'prorata_valide' : 'prorata_refuse',
            titre:          next === 'valide'
                              ? `Paiement prorata valide — ${p.numero ?? ''}`
                              : `Paiement prorata refuse — ${p.numero ?? ''}`,
            message:        next === 'valide'
                              ? `Votre paiement de la facture ${p.numero ?? ''} a ete valide par l'AT.`
                              : `Votre paiement de la facture ${p.numero ?? ''} a ete refuse. Merci de redeposer un justificatif.`,
            priorite:       next === 'valide' ? 'normal' : 'high',
            lue:            false,
          } as never)
        }
      }
      fetchData()
    } finally { setBusyAction(null) }
  }

  /* Relance ST sur retard */
  async function relancerSt(st_id: string) {
    setBusyAction(`relance-${st_id}`)
    try {
      const r = await fetch('/api/at/prorata/relancer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projet_id: projetId, st_id }),
      })
      const data = await r.json()
      if (!r.ok || data?.error) {
        alert(`Erreur : ${data?.error}`)
      } else {
        // Marque le user du ST comme "Rappele" cote UI sans attendre un refetch
        const st = sts.find((s) => s.id === st_id)
        const accesId = st?.dce_acces_id
        const userId = accesId ? dceAcces.find((a) => a.id === accesId)?.user_id : null
        if (userId) setRelancedUserIds((prev) => new Set(prev).add(userId))
        alert(`Relance envoyee. ${data.nb_factures_en_retard} en retard · ${data.nb_factures_attente} en attente.`)
      }
    } finally { setBusyAction(null) }
  }

  // KPIs
  const totalDicReel       = dics.reduce((s, d) => s + (d.montant_ttc ?? d.montant_ht), 0)
  // Total DIC previsionnel : prorata.budget_estime (CO) en priorite, sinon budget_total × taux%, sinon somme des quote-parts
  const totalQuotePart     = stSummaries.reduce((s, r) => s + r.quotePartTotale, 0)
  const totalDicPrevisionnel = budgetEstimeCO != null
    ? budgetEstimeCO
    : (budgetProjet != null ? +(budgetProjet * defaultTaux / 100).toFixed(2) : totalQuotePart)
  const sourceDicPrev: 'co_estime' | 'co_budget' | 'calcule' =
    budgetEstimeCO != null ? 'co_estime'
    : budgetProjet != null ? 'co_budget'
    : 'calcule'
  const totalAppele        = paiements.reduce((s, p) => s + (Number(p.montant_du) || 0), 0)
  const totalEncaisse      = paiements
    .filter((p) => p.statut === 'valide')
    .reduce((s, p) => s + (Number(p.montant_paye) || Number(p.montant_du) || 0), 0)
  const enRetard = paiements.filter((p) =>
    p.statut !== 'valide'
    && p.date_echeance
    && new Date(p.date_echeance) < today
  ).length

  if (loading) return <SkeletonRows />

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard
          label={<><Abbr k="DIC" /> previsionnel</>}
          value={formatCurrency(totalDicPrevisionnel)}
        />
        <KpiCard label={<><Abbr k="DIC" /> reel saisi</>} value={formatCurrency(totalDicReel)} />
        <KpiCard label="Total appele"                     value={formatCurrency(totalAppele)} accent="amber" />
        <KpiCard label="Encaisse valide"                  value={formatCurrency(totalEncaisse)} accent="emerald" />
        <KpiCard label="En retard"                        value={String(enRetard)} accent={enRetard > 0 ? 'red' : 'gray'} />
      </div>

      {/* Banniere d'origine du DIC previsionnel */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2 text-xs">
        <Landmark className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold text-blue-900">
            <Abbr k="DIC" /> previsionnel : {formatCurrency(totalDicPrevisionnel)}
            <span className="ml-2 text-[10px] font-normal text-blue-700">
              {sourceDicPrev === 'co_estime'   && `(saisie commerciale — budget estime prorata)`}
              {sourceDicPrev === 'co_budget'   && `(${defaultTaux}% du budget projet ${formatCurrency(budgetProjet!)})`}
              {sourceDicPrev === 'calcule'     && `(somme quote-part ${defaultTaux}% des contrats / offres acceptees)`}
            </span>
          </p>
          <p className="text-blue-800 mt-0.5">
            {sourceDicPrev !== 'co_estime' && budgetProjet != null && (
              <>Budget total projet (CO) : <strong>{formatCurrency(budgetProjet)}</strong> · </>
            )}
            Quote-part totale calculee : <strong>{formatCurrency(totalQuotePart)}</strong>
            {totalQuotePart < totalDicPrevisionnel * 0.95 && (
              <span className="ml-1 text-amber-700">
                · Manque <strong>{formatCurrency(totalDicPrevisionnel - totalQuotePart)}</strong> a couvrir (contrats encore a signer ?)
              </span>
            )}
          </p>
        </div>
      </div>

      {enRetard > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-800">
            <strong>{enRetard} paiement{enRetard > 1 ? 's' : ''} en retard.</strong> Le delai de 2 semaines a ete depasse.
            Pense a relancer les ST concernes (pas de blocage automatique).
          </p>
        </div>
      )}

      {/* ─── Appels de fonds ─── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-gray-900">Appels de fonds ({appels.length})</p>
          <button
            onClick={() => setShowAppelForm((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800"
          >
            <Plus className="w-3.5 h-3.5" /> Nouvel appel
          </button>
        </div>

        {showAppelForm && (
          <form onSubmit={submitAppel} className="bg-white rounded-lg border border-gray-200 shadow-card p-4 space-y-3 mb-3">
            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
              <Receipt className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800">
                Genere une facture prorata pour chaque ST contractant.
                Le montant du = (montant HT contrat × {appelForm.taux_quote_part}%) × {appelForm.taux_appele}%.
                Delai de paiement : {appelForm.delai_paiement_jours} jours.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="col-span-2 md:col-span-4">
                <label className="block text-xs font-medium text-gray-600 mb-1">Libelle de l&apos;appel *</label>
                <input
                  type="text"
                  value={appelForm.libelle}
                  onChange={(e) => setAppelForm((f) => ({ ...f, libelle: e.target.value }))}
                  placeholder="Ex: 1er appel — demarrage chantier"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Quote-part (% contrat)</label>
                <input
                  type="number" step="0.1"
                  value={appelForm.taux_quote_part}
                  onChange={(e) => setAppelForm((f) => ({ ...f, taux_quote_part: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">% a appeler *</label>
                <input
                  type="number" step="0.1"
                  value={appelForm.taux_appele}
                  onChange={(e) => setAppelForm((f) => ({ ...f, taux_appele: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Delai paiement (jours)</label>
                <input
                  type="number"
                  value={appelForm.delai_paiement_jours}
                  onChange={(e) => setAppelForm((f) => ({ ...f, delai_paiement_jours: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                />
              </div>
              <div className="col-span-2 md:col-span-4">
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optionnel)</label>
                <input
                  type="text"
                  value={appelForm.notes}
                  onChange={(e) => setAppelForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                />
              </div>
            </div>

            {/* Selection des STs destinataires */}
            <div className="pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-600">
                  Sous-traitants destinataires * ({appelStIds.size}/{appelStsAvailable.length})
                </label>
                <div className="flex gap-2">
                  <button type="button"
                    onClick={() => setAppelStIds(new Set(appelStsAvailable.map((s) => s.st_id)))}
                    className="text-[11px] text-gray-600 hover:text-gray-900 underline">
                    Tout cocher
                  </button>
                  <button type="button"
                    onClick={() => setAppelStIds(new Set())}
                    className="text-[11px] text-gray-600 hover:text-gray-900 underline">
                    Tout decocher
                  </button>
                </div>
              </div>
              {appelStsAvailable.length === 0 ? (
                <p className="text-xs text-gray-400 italic px-2 py-3 bg-gray-50 rounded-lg">
                  Aucun ST avec un contrat dont le montant HT est renseigne.
                </p>
              ) : (
                <div className="max-h-44 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {appelStsAvailable.map((s) => {
                    const checked = appelStIds.has(s.st_id)
                    const quotePart = s.montant_ht * Number(appelForm.taux_quote_part || 0) / 100
                    const montantDu = quotePart * Number(appelForm.taux_appele || 0) / 100
                    return (
                      <label key={s.st_id}
                        className={`flex items-center justify-between gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 ${checked ? 'bg-blue-50/40' : ''}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setAppelStIds((prev) => {
                                const next = new Set(prev)
                                if (e.target.checked) next.add(s.st_id)
                                else next.delete(s.st_id)
                                return next
                              })
                            }}
                            className="w-3.5 h-3.5 rounded border-gray-300 text-gray-900 focus:ring-1 focus:ring-gray-900/20"
                          />
                          <span className="text-sm text-gray-900 truncate">{s.label}</span>
                          <span className="text-[11px] text-gray-400 flex-shrink-0">
                            · {s.source === 'contrat' ? 'contrat' : 'offre acceptee'} {formatCurrency(s.montant_ht)} <Abbr k="HT" />
                          </span>
                        </div>
                        <span className="text-xs font-medium text-gray-700 tabular-nums flex-shrink-0">
                          {formatCurrency(montantDu)}
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                {appelStIds.size} ST{appelStIds.size > 1 ? 's' : ''} selectionne{appelStIds.size > 1 ? 's' : ''} —
                montant a appeler estime : <strong>{formatCurrency(
                  appelStsAvailable
                    .filter((s) => appelStIds.has(s.st_id))
                    .reduce((acc, s) => acc + s.montant_ht, 0)
                  * Number(appelForm.taux_quote_part || 0) / 100
                  * Number(appelForm.taux_appele || 0) / 100,
                )}</strong>
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowAppelForm(false)} className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900">Annuler</button>
                <button type="submit" disabled={submittingAppel || !appelForm.libelle || appelStIds.size === 0}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50">
                  {submittingAppel ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  Generer les factures
                </button>
              </div>
            </div>
          </form>
        )}

        {appels.length === 0 ? (
          <EmptyState icon={Receipt} title="Aucun appel de fonds"
            sub="Cree un appel pour facturer aux ST leur quote-part (2% du contrat par defaut)." />
        ) : (
          <div className="space-y-2">
            {appels.map((app) => {
              const factures = paiementsByAppel.get(app.id) ?? []
              const totalApp = factures.reduce((s, f) => s + (Number(f.montant_du) || 0), 0)
              const totalPaid = factures.filter((f) => f.statut === 'valide')
                .reduce((s, f) => s + (Number(f.montant_paye) || Number(f.montant_du) || 0), 0)
              const enAttente = factures.filter((f) => f.statut === 'paye').length
              const retardApp = factures.filter((p) =>
                p.statut !== 'valide' && p.date_echeance && new Date(p.date_echeance) < today
              ).length
              const expanded = expandedAppels.has(app.id)
              return (
                <div key={app.id} className="bg-white rounded-lg border border-gray-200 shadow-card overflow-hidden">
                  <button onClick={() => toggleAppel(app.id)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 text-left">
                    <div className="flex items-center gap-2 min-w-0">
                      {expanded
                        ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        : <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                      <span className="text-xs font-mono text-gray-400 flex-shrink-0">{app.numero ?? '—'}</span>
                      <span className="text-sm font-semibold text-gray-900 truncate">{app.libelle}</span>
                      <span className="text-xs text-gray-400">
                        · {app.taux_appele}% de la quote-part {app.taux_quote_part}%
                      </span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {retardApp > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200">
                          <AlertTriangle className="w-3 h-3" /> {retardApp} retard
                        </span>
                      )}
                      {enAttente > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          <Eye className="w-3 h-3" /> {enAttente} a valider
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        {formatCurrency(totalPaid)} / {formatCurrency(totalApp)}
                      </span>
                    </div>
                  </button>
                  {expanded && (
                    <div className="border-t border-gray-100 bg-gray-50/50">
                      <div className="px-4 py-2 flex items-center justify-between text-[11px] text-gray-500">
                        <span>Emis le {formatDate(app.date_appel)} · echeance {formatDate(addDaysIso(app.date_appel, app.delai_paiement_jours))}</span>
                        <span>{factures.length} facture{factures.length > 1 ? 's' : ''}</span>
                      </div>
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100 text-[10px] text-gray-500 uppercase tracking-wider">
                          <tr>
                            <th className="px-4 py-1.5 text-left font-medium">N°</th>
                            <th className="px-4 py-1.5 text-left font-medium"><Abbr k="ST" /></th>
                            <th className="px-4 py-1.5 text-right font-medium">Montant du</th>
                            <th className="px-4 py-1.5 text-left font-medium">Echeance</th>
                            <th className="px-4 py-1.5 text-left font-medium">Statut</th>
                            <th className="px-4 py-1.5 text-right font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {factures.map((p) => {
                            const overdue = p.statut !== 'valide' && p.date_echeance && new Date(p.date_echeance) < today
                            return (
                              <tr key={p.id} className={overdue ? 'bg-red-50/30' : ''}>
                                <td className="px-4 py-2 text-xs font-mono text-gray-500">{p.numero ?? '—'}</td>
                                <td className="px-4 py-2 text-gray-900">{stName(p.st_id)}</td>
                                <td className="px-4 py-2 text-right font-medium text-gray-900">{formatCurrency(p.montant_du ?? 0)}</td>
                                <td className="px-4 py-2 text-xs text-gray-500">
                                  {p.date_echeance ? formatDate(p.date_echeance) : '—'}
                                </td>
                                <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                                  <ProrataStatutSelect
                                    p={p}
                                    busy={busyAction === `statut-${p.id}`}
                                    onChange={(next) => changeStatutPaiement(p, next)}
                                  />
                                </td>
                                <td className="px-4 py-2 text-right">
                                  <div className="inline-flex items-center gap-1">
                                    {p.recu_url && (
                                      <a href={p.recu_url} target="_blank" rel="noreferrer"
                                        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50 rounded">
                                        <Eye className="w-3 h-3" /> Recu
                                      </a>
                                    )}
                                  </div>
                                </td>
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
          </div>
        )}
      </div>

      {/* ─── Suivi par sous-traitant ─── */}
      <div className="pt-2 border-t border-gray-100">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <p className="text-sm font-semibold text-gray-900">
            Suivi par sous-traitant ({stSummaries.length})
          </p>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Taux prorata par defaut</label>
            <input
              type="number" step="0.1" min="0.1" max="100"
              value={defaultTaux}
              onChange={(e) => setDefaultTaux(Number(e.target.value))}
              onBlur={(e) => updateDefaultTaux(e.target.value)}
              className="w-16 border border-gray-200 rounded px-2 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-gray-900/10"
            />
            <span className="text-xs text-gray-400">% — override par ligne ci-dessous</span>
          </div>
        </div>

        {stSummaries.length === 0 ? (
          <EmptyState icon={Users} title="Aucun sous-traitant"
            sub="Les ST avec un contrat apparaitront ici pour suivre leurs paiements prorata." />
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[10px] text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 text-left font-medium w-6"></th>
                  <th className="px-3 py-2 text-left font-medium">Lot</th>
                  <th className="px-3 py-2 text-left font-medium">Sous-traitant</th>
                  <th className="px-3 py-2 text-right font-medium">Montant <Abbr k="HT" /></th>
                  <th className="px-3 py-2 text-center font-medium">Taux %</th>
                  <th className="px-3 py-2 text-right font-medium">Quote-part</th>
                  <th className="px-3 py-2 text-right font-medium">Appele</th>
                  <th className="px-3 py-2 text-right font-medium">Paye / Valide</th>
                  <th className="px-3 py-2 text-right font-medium">Reste</th>
                  <th className="px-3 py-2 text-center font-medium">Statut</th>
                  <th className="px-3 py-2 text-right font-medium">Paiement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stSummaries.map((row) => {
                  const expanded = expandedSt.has(row.st.id)
                  const facturesSt = paiementsBySt.get(row.st.id) ?? []
                  return (
                    <Fragment key={row.st.id}>
                      <tr className={`hover:bg-gray-50 cursor-pointer ${row.nbRetard > 0 ? 'bg-red-50/30' : ''}`}
                        onClick={() => toggleStExpand(row.st.id)}>
                        <td className="px-3 py-2 text-gray-400">
                          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </td>
                        <td className="px-3 py-2">
                          {row.lotNom ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-mono text-gray-400">{row.lotOrdre}</span>
                              <span className="text-xs text-gray-700 truncate max-w-[140px]" title={row.lotNom}>{row.lotNom}</span>
                            </div>
                          ) : <span className="text-xs text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2">
                          <p className="text-sm font-medium text-gray-900">{row.st.societe || row.st.nom}</p>
                          {row.st.corps_etat && <p className="text-[10px] text-gray-400">{row.st.corps_etat}</p>}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {row.montantContrat > 0 ? (
                            <div>
                              <p className="text-gray-900 font-medium">{formatCurrency(row.montantContrat)}</p>
                              <p className={`text-[9px] uppercase tracking-wider mt-0.5 ${
                                row.montantSource === 'contrat' ? 'text-emerald-600' : 'text-amber-600'
                              }`}>
                                {row.montantSource === 'contrat' ? 'Contrat signe' : 'Offre acceptee'}
                              </p>
                            </div>
                          ) : <span className="text-xs text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex items-center gap-1">
                            <input
                              type="number" step="0.1" min="0.1" max="100"
                              defaultValue={row.tauxApplique}
                              key={`${row.st.id}-${row.tauxApplique}`}
                              onBlur={(e) => {
                                if (Number(e.target.value) !== row.tauxApplique) {
                                  updateTauxPerSt(row.contrat?.id ?? null, row.st.id, e.target.value)
                                }
                              }}
                              disabled={savingTauxId === row.st.id}
                              className={`w-14 border rounded px-1.5 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-gray-900/10 ${
                                row.tauxOverride ? 'border-blue-300 bg-blue-50/30' : 'border-gray-200'
                              }`}
                              title={row.tauxOverride ? 'Taux personnalise pour ce ST' : `Taux par defaut du projet (${defaultTaux}%)`}
                            />
                            {savingTauxId === row.st.id && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700">
                          {row.quotePartTotale > 0 ? formatCurrency(row.quotePartTotale) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-amber-600 font-medium">
                          {row.cumulAppele > 0 ? formatCurrency(row.cumulAppele) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-emerald-600 font-medium">
                          {row.cumulPaye > 0 ? formatCurrency(row.cumulPaye) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {row.quotePartTotale > 0 ? (() => {
                            const restePayer = Math.max(0, row.quotePartTotale - row.cumulPaye)
                            const restePayerOnAppel = row.reste
                            const isFullyPaid = restePayer <= 0.005
                            return (
                              <div>
                                <p className={`font-medium ${isFullyPaid ? 'text-emerald-600' : 'text-gray-900'}`}>
                                  {formatCurrency(restePayer)}
                                </p>
                                <p className="text-[10px] text-gray-400 leading-tight">
                                  sur {formatCurrency(row.quotePartTotale)}
                                  {restePayerOnAppel > 0 && restePayerOnAppel !== restePayer && (
                                    <> · {formatCurrency(restePayerOnAppel)} du sur appel</>
                                  )}
                                </p>
                              </div>
                            )
                          })() : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-center">
                            <StSyntheseBadge summary={row} />
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex items-center gap-2 justify-end">
                            <ProrataPaiementBadge
                              isPaye={row.quotePartTotale > 0 && row.cumulPaye > 0 && (row.quotePartTotale - row.cumulPaye) <= 0.005}
                              isRappele={rappeleStIds.has(row.st.id)}
                              cumulPaye={row.cumulPaye}
                              quotePartTotale={row.quotePartTotale}
                            />
                            {row.cumulAppele > 0 && row.reste > 0 && (
                              <button
                                onClick={() => relancerSt(row.st.id)}
                                disabled={busyAction === `relance-${row.st.id}`}
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] text-amber-700 border border-amber-200 rounded hover:bg-amber-50 disabled:opacity-40"
                                title="Envoyer un rappel au ST"
                              >
                                {busyAction === `relance-${row.st.id}`
                                  ? <Loader2 className="w-3 h-3 animate-spin" />
                                  : <AlertTriangle className="w-3 h-3" />}
                                {rappeleStIds.has(row.st.id) ? 'Renvoyer' : 'Rappeler'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expanded && (
                        <tr>
                          <td colSpan={11} className="bg-gray-50/50 p-0">
                            <div className="px-6 py-3 space-y-2">
                              {facturesSt.length === 0 ? (
                                <p className="text-xs text-gray-400 italic py-2">
                                  Aucun appel emis pour ce ST. Cree un appel de fonds pour generer ses factures prorata.
                                </p>
                              ) : (
                                <>
                                  <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">
                                    Historique factures ({facturesSt.length})
                                  </p>
                                  <table className="w-full text-xs">
                                    <thead className="text-[10px] text-gray-400 uppercase">
                                      <tr>
                                        <th className="px-2 py-1 text-left font-medium">N°</th>
                                        <th className="px-2 py-1 text-left font-medium">Emis le</th>
                                        <th className="px-2 py-1 text-left font-medium">Echeance</th>
                                        <th className="px-2 py-1 text-right font-medium">Du</th>
                                        <th className="px-2 py-1 text-right font-medium">Paye</th>
                                        <th className="px-2 py-1 text-left font-medium">Justif</th>
                                        <th className="px-2 py-1 text-left font-medium">Statut</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 bg-white">
                                      {facturesSt.map((p) => {
                                        const overdue = p.statut !== 'valide' && p.date_echeance && new Date(p.date_echeance) < today
                                        return (
                                          <tr key={p.id}>
                                            <td className="px-2 py-1.5 font-mono text-gray-600">{p.numero ?? '—'}</td>
                                            <td className="px-2 py-1.5 text-gray-500">{p.date_emission ? formatDate(p.date_emission) : '—'}</td>
                                            <td className={`px-2 py-1.5 ${overdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                                              {p.date_echeance ? formatDate(p.date_echeance) : '—'}
                                            </td>
                                            <td className="px-2 py-1.5 text-right text-gray-900">{formatCurrency(Number(p.montant_du) || 0)}</td>
                                            <td className="px-2 py-1.5 text-right text-emerald-600">{p.statut === 'valide' ? formatCurrency(Number(p.montant_paye) || Number(p.montant_du) || 0) : '—'}</td>
                                            <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                                              {p.recu_url ? (
                                                <a href={p.recu_url} target="_blank" rel="noreferrer"
                                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] text-blue-600 border border-blue-200 rounded hover:bg-blue-50"
                                                  title={p.recu_uploaded_at ? `Depose le ${formatDate(p.recu_uploaded_at)}` : 'Voir le justificatif'}>
                                                  <Eye className="w-3 h-3" /> Voir
                                                </a>
                                              ) : (
                                                <span className="text-gray-300">—</span>
                                              )}
                                            </td>
                                            <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                                              <ProrataStatutSelect
                                                p={p}
                                                busy={busyAction === `statut-${p.id}`}
                                                onChange={(next) => changeStatutPaiement(p, next)}
                                              />
                                            </td>
                                          </tr>
                                        )
                                      })}
                                    </tbody>
                                  </table>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── DIC (depenses) ─── */}
      <div className="pt-2 border-t border-gray-100">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <p className="text-sm font-semibold text-gray-900">Depenses d&apos;Interet Commun</p>
          <div className="flex items-center gap-2">
            <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer transition-colors ${
              dicScanning ? 'bg-gray-200 text-gray-500 cursor-wait' : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}>
              {dicScanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanLine className="w-3.5 h-3.5" />}
              {dicScanning ? 'Analyse en cours...' : 'Scanner une facture'}
              <input type="file" accept="image/*,application/pdf"
                className="hidden" disabled={dicScanning}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) scanDicFacture(f)
                  e.target.value = ''
                }} />
            </label>
            <button
              onClick={() => { setShowDicForm((v) => !v); setDicScanError(null) }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800"
            >
              <Plus className="w-3.5 h-3.5" /> Saisir manuellement
            </button>
          </div>
        </div>

        {dicScanError && (
          <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <XCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-800">Scan : {dicScanError}</p>
          </div>
        )}

        {showDicForm && (
          <form onSubmit={submitDic} className="bg-white rounded-lg border border-gray-200 shadow-card p-4 space-y-3 mb-3">
            {dicForm.justificatif_url ? (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2">
                <ScanLine className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-emerald-700">Justificatif joint</p>
                  <a href={dicForm.justificatif_url} target="_blank" rel="noreferrer"
                    className="text-[11px] text-emerald-700 hover:underline truncate block">
                    {dicForm.justificatif_url.split('/').pop()}
                  </a>
                </div>
                <button type="button" onClick={() => setDicForm((f) => ({ ...f, justificatif_url: '' }))}
                  className="text-emerald-700 hover:text-emerald-900 text-xs underline flex-shrink-0">
                  Detacher
                </button>
              </div>
            ) : (
              <label className={`flex items-center justify-center gap-2 px-3 py-2 border border-dashed rounded-lg text-xs cursor-pointer transition-colors ${
                dicUploading ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-wait' : 'border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-50'
              }`}>
                {dicUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                {dicUploading ? 'Upload en cours...' : 'Joindre le justificatif (facture, ticket...)'}
                <input type="file" accept="image/*,application/pdf"
                  className="hidden" disabled={dicUploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) uploadDicJustificatif(f)
                    e.target.value = ''
                  }} />
              </label>
            )}
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Libelle *</label>
                <input type="text" value={dicForm.libelle}
                  onChange={(e) => setDicForm((f) => ({ ...f, libelle: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Montant <Abbr k="HT" /> *</label>
                <input type="number" value={dicForm.montant_ht}
                  onChange={(e) => setDicForm((f) => ({ ...f, montant_ht: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1"><Abbr k="TVA" /> %</label>
                <input type="number" value={dicForm.tva_pct}
                  onChange={(e) => setDicForm((f) => ({ ...f, tva_pct: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                <input type="date" value={dicForm.date_depense}
                  onChange={(e) => setDicForm((f) => ({ ...f, date_depense: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowDicForm(false)} className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900">Annuler</button>
              <button type="submit" disabled={submittingDic}
                className="px-3 py-1.5 text-xs text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50">
                {submittingDic ? '...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        )}

        {dics.length === 0 ? (
          <EmptyState icon={Landmark} title="Aucune depense" sub="Saisissez les depenses communes a tous les ST." />
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Date</th>
                  <th className="px-4 py-2 text-left font-medium">Libelle</th>
                  <th className="px-4 py-2 text-right font-medium">Montant <Abbr k="HT" /></th>
                  <th className="px-4 py-2 text-right font-medium"><Abbr k="TVA" /></th>
                  <th className="px-4 py-2 text-right font-medium"><Abbr k="TTC" /></th>
                  <th className="px-4 py-2 text-center font-medium">Justif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dics.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-500 text-xs">{d.date_depense ? formatDate(d.date_depense) : '—'}</td>
                    <td className="px-4 py-2 text-gray-900">{d.libelle}</td>
                    <td className="px-4 py-2 text-right text-gray-900">{formatCurrency(d.montant_ht)}</td>
                    <td className="px-4 py-2 text-right text-gray-500 text-xs">{d.tva_pct ? `${d.tva_pct}%` : '—'}</td>
                    <td className="px-4 py-2 text-right font-medium text-gray-900">{formatCurrency(d.montant_ttc ?? d.montant_ht)}</td>
                    <td className="px-4 py-2 text-center">
                      {d.justificatif_url ? (
                        <a href={d.justificatif_url} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50 rounded">
                          <Eye className="w-3 h-3" /> Voir
                        </a>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal appel individuel pour un ST */}
      {appelStModal && (
        <AppelStModal
          st_label={appelStModal.st_label}
          quote_part={appelStModal.quote_part}
          taux_quote_part={defaultTaux}
          busy={busyAction === 'appel'}
          onSubmit={submitAppelIndividuel}
          onClose={() => setAppelStModal(null)}
        />
      )}

      {/* Modal saisie paiement manuel */}
      {paiementModal && (
        <PaiementManuelModal
          st_label={paiementModal.st_label}
          suggestedAmount={paiementModal.suggestedAmount}
          busy={busyAction === 'paiement'}
          onSubmit={submitPaiementManuel}
          onClose={() => setPaiementModal(null)}
        />
      )}

      {/* Modal refus de recu */}
      {refuseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-500" /> Refuser le recu
              </h3>
              <button onClick={() => setRefuseModal(null)} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-gray-500">
                Le ST sera notifie et devra redeposer un justificatif conforme.
              </p>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Motif du refus *</label>
                <textarea
                  value={refuseModal.motif}
                  onChange={(e) => setRefuseModal({ ...refuseModal, motif: e.target.value })}
                  rows={4}
                  placeholder="Ex: Justificatif illisible, montant non conforme..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                />
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setRefuseModal(null)} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
              <button onClick={refuserRecu} disabled={!refuseModal.motif.trim() || !!validatingId}
                className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40">
                {validatingId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                Refuser et notifier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AppelStModal({
  st_label, quote_part, taux_quote_part, busy, onSubmit, onClose,
}: {
  st_label: string
  quote_part: number
  taux_quote_part: number
  busy: boolean
  onSubmit: (taux_appele: number, libelle: string) => void
  onClose: () => void
}) {
  const [tauxAppele, setTauxAppele] = useState('100')
  const [libelle, setLibelle]       = useState(`Appel individuel — ${st_label}`)
  const montantCalcule = +(quote_part * Number(tauxAppele || 0) / 100).toFixed(2)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Send className="w-4 h-4 text-blue-600" /> Appeler ce ST
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
            Genere une facture prorata individuelle pour <strong>{st_label}</strong>.
            Quote-part totale ({taux_quote_part}%) : <strong>{formatCurrency(quote_part)}</strong>.
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Libelle *</label>
            <input type="text" value={libelle} onChange={(e) => setLibelle(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">% de la quote-part a appeler *</label>
            <input type="number" step="0.1" min="0.1" max="100"
              value={tauxAppele} onChange={(e) => setTauxAppele(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
            <p className="text-[10px] text-gray-500 mt-1">
              Montant qui sera facture : <strong className="text-gray-900">{formatCurrency(montantCalcule)}</strong>
              {' '}· echeance dans 14 jours
            </p>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
          <button onClick={() => onSubmit(Number(tauxAppele), libelle)} disabled={busy || !libelle || !tauxAppele}
            className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-40">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Generer la facture
          </button>
        </div>
      </div>
    </div>
  )
}

function PaiementManuelModal({
  st_label, suggestedAmount, busy, onSubmit, onClose,
}: {
  st_label: string
  suggestedAmount: number
  busy: boolean
  onSubmit: (montant: number, notes: string) => void
  onClose: () => void
}) {
  const [montant, setMontant] = useState(String(suggestedAmount))
  const [notes, setNotes]     = useState('Paiement hors plateforme (cheque / virement)')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-600" /> Saisir un paiement manuel
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
            Enregistre un paiement recu hors plateforme (cheque, virement)
            pour <strong>{st_label}</strong>. La facture sera marquee comme <strong>validee</strong>.
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Montant recu *</label>
            <input type="number" step="0.01" min="0.01"
              value={montant} onChange={(e) => setMontant(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none" />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
          <button onClick={() => onSubmit(Number(montant), notes)} disabled={busy || !montant || Number(montant) <= 0}
            className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-40">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}

function ProrataPaiementBadge({
  isPaye, isRappele, cumulPaye, quotePartTotale,
}: {
  isPaye: boolean
  isRappele: boolean
  cumulPaye?: number
  quotePartTotale?: number
}) {
  if (isPaye) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"
        title={cumulPaye != null && quotePartTotale != null
          ? `${cumulPaye.toLocaleString('fr-FR')} € / ${quotePartTotale.toLocaleString('fr-FR')} €`
          : undefined}>
        <CheckCircle2 className="w-3 h-3" /> Paye
        {cumulPaye != null && quotePartTotale != null && (
          <span className="text-[10px] text-emerald-600 font-normal">
            {cumulPaye.toLocaleString('fr-FR')}/{quotePartTotale.toLocaleString('fr-FR')} €
          </span>
        )}
      </span>
    )
  }
  if (isRappele) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
        <AlertTriangle className="w-3 h-3" /> Rappele
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
      Non paye
    </span>
  )
}

function StSyntheseBadge({ summary }: { summary: {
  statut: 'a_jour' | 'partiel' | 'retard' | 'non_appele'
  nbAValider: number
  nbRetard: number
} }) {
  if (summary.nbRetard > 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200">
        <AlertTriangle className="w-3 h-3" /> Retard ({summary.nbRetard})
      </span>
    )
  }
  if (summary.nbAValider > 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
        <Eye className="w-3 h-3" /> A valider ({summary.nbAValider})
      </span>
    )
  }
  if (summary.statut === 'a_jour') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="w-3 h-3" /> A jour
      </span>
    )
  }
  if (summary.statut === 'partiel') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
        <Clock className="w-3 h-3" /> Partiel
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
      Non appele
    </span>
  )
}

/** Libelles et couleurs des 5 statuts prorata (alignes sur la contrainte DB) */
const PRORATA_STATUT_META: Record<string, { label: string; pill: string; Icon: typeof Clock }> = {
  non_paye:  { label: 'Non paye',              pill: 'bg-gray-100 text-gray-600 border-gray-200',         Icon: Clock },
  partiel:   { label: 'Partiel',               pill: 'bg-amber-50 text-amber-700 border-amber-200',       Icon: Clock },
  paye:      { label: 'En attente validation', pill: 'bg-blue-50 text-blue-700 border-blue-200',          Icon: Eye },
  valide:    { label: 'Paye / Valide',         pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2 },
  refuse:    { label: 'Refuse / Litige',       pill: 'bg-red-50 text-red-600 border-red-200',             Icon: XCircle },
}

function ProrataStatutBadge({ p, overdue }: { p: ProrataPaiement; overdue: boolean }) {
  const meta = PRORATA_STATUT_META[p.statut]
  if (meta) {
    const { label, pill, Icon } = meta
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${pill}`}>
        <Icon className="w-3 h-3" /> {label}
      </span>
    )
  }
  if (overdue) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200">
        <AlertTriangle className="w-3 h-3" /> En retard
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
      <Clock className="w-3 h-3" /> A payer
    </span>
  )
}

/** Dropdown editable pour changer le statut d'une facture prorata cote AT */
function ProrataStatutSelect({
  p, onChange, busy,
}: {
  p: ProrataPaiement
  onChange: (next: string) => void
  busy: boolean
}) {
  const meta = PRORATA_STATUT_META[p.statut] ?? PRORATA_STATUT_META.non_paye
  return (
    <div className="inline-flex items-center gap-1">
      <select
        value={p.statut}
        disabled={busy}
        onChange={(e) => onChange(e.target.value)}
        className={`text-xs border rounded-md px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-gray-900/10 disabled:opacity-50 ${meta.pill}`}
        title="Changer le statut du paiement"
      >
        <option value="non_paye">Non paye</option>
        <option value="partiel">Partiel</option>
        <option value="paye">En attente validation</option>
        <option value="valide">Paye / Valide</option>
        <option value="refuse">Refuse / Litige</option>
      </select>
      {busy && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
    </div>
  )
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

/* ════════════════════════════════════════════════════════════════════════════
   ONGLET 4 — PAIEMENTS (factures ST)
   ════════════════════════════════════════════════════════════════════════════ */

type PaiementsST = Pick<ST, 'id' | 'nom' | 'societe'> & { corps_etat: string | null; dce_acces_id: string | null }
type PaiementsLot = { id: string; ordre: number; nom: string }
type PaiementsContrat = { st_id: string; montant_ht: number | null }
type PaiementsDce = { id: string; lot_id: string | null; statut: string | null }
type PaiementsOffre = { acces_id: string | null; total_ht: number | null; montant_total_ht: number | null }

function PaiementsTab({ projetId }: { projetId: string }) {
  const [factures, setFactures]   = useState<Facture[]>([])
  const [sts, setSts]             = useState<PaiementsST[]>([])
  const [lots, setLots]           = useState<PaiementsLot[]>([])
  const [contrats, setContrats]   = useState<PaiementsContrat[]>([])
  const [dceAcces, setDceAcces]   = useState<PaiementsDce[]>([])
  const [offres, setOffres]       = useState<PaiementsOffre[]>([])
  const [loading, setLoading]     = useState(true)
  const [selectedStId, setSelectedStId] = useState<string | null>(null)
  const [showForm, setShowForm]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ numero_facture: '', montant_ht: '', date_facture: '', justificatif_url: '' })
  const [scanning, setScanning]     = useState(false)
  const [scanError, setScanError]   = useState<string | null>(null)
  const [paiementModal, setPaiementModal] = useState<Facture | null>(null)

  async function fetchData() {
    const supabase = createClient()
    const [fRes, sRes, lRes, cRes, dceRes, oRes] = await Promise.all([
      supabase.schema('app').from('at_factures').select('*').eq('projet_id', projetId).order('created_at', { ascending: false }),
      supabase.schema('app').from('at_sous_traitants').select('id,nom,societe,corps_etat,dce_acces_id').eq('projet_id', projetId),
      supabase.from('lots' as never).select('id,ordre,nom').eq('projet_id', projetId).order('ordre'),
      supabase.schema('app').from('at_contrats').select('st_id,montant_ht').eq('projet_id', projetId),
      supabase.from('dce_acces_st' as never).select('id,lot_id,statut').eq('projet_id', projetId),
      supabase.from('dce_offres_st' as never).select('acces_id,total_ht,montant_total_ht').eq('projet_id', projetId),
    ])
    setFactures((fRes.data ?? []) as Facture[])
    setSts((sRes.data ?? []) as PaiementsST[])
    setLots(((lRes.data ?? []) as unknown) as PaiementsLot[])
    setContrats((cRes.data ?? []) as PaiementsContrat[])
    setDceAcces(((dceRes.data ?? []) as unknown) as PaiementsDce[])
    setOffres(((oRes.data ?? []) as unknown) as PaiementsOffre[])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [projetId]) // eslint-disable-line react-hooks/exhaustive-deps

  /* Memos : ST retenus + montants + lots */
  const retainedDceIds = useMemo(
    () => new Set(dceAcces.filter((a) => a.statut === 'retenu').map((a) => a.id)),
    [dceAcces]
  )
  const stsRetenus = useMemo(
    () => sts.filter((s) => s.dce_acces_id && retainedDceIds.has(s.dce_acces_id)),
    [sts, retainedDceIds]
  )
  const lotByDce = useMemo(() => {
    const m = new Map<string, string>()
    dceAcces.forEach((a) => { if (a.lot_id) m.set(a.id, a.lot_id) })
    return m
  }, [dceAcces])
  const lotById = useMemo(() => {
    const m = new Map<string, PaiementsLot>()
    lots.forEach((l) => m.set(l.id, l))
    return m
  }, [lots])
  const contratByStId = useMemo(() => {
    const m = new Map<string, number>()
    contrats.forEach((c) => { if (c.st_id) m.set(c.st_id, Number(c.montant_ht ?? 0)) })
    return m
  }, [contrats])
  const offreByDce = useMemo(() => {
    const m = new Map<string, number>()
    offres.forEach((o) => {
      if (!o.acces_id) return
      const ht = Number(o.total_ht ?? o.montant_total_ht ?? 0)
      m.set(o.acces_id, (m.get(o.acces_id) ?? 0) + ht)
    })
    return m
  }, [offres])

  type StSummary = {
    st: PaiementsST
    lotNom: string | null
    lotOrdre: number | null
    montantContrat: number
    source: 'contrat' | 'offre' | 'aucun'
    totalFacture: number       // somme des factures emises HT
    totalPaye: number          // somme des montants payes (statut bon_a_payer ou paye + montant_paye)
    reste: number              // montant contrat - total paye
    nbAVerifier: number
    nbBonAPayer: number
  }

  const stSummaries: StSummary[] = useMemo(() => {
    return stsRetenus.map((s): StSummary => {
      const lotId  = s.dce_acces_id ? lotByDce.get(s.dce_acces_id) : undefined
      const lot    = lotId ? lotById.get(lotId) : undefined
      const contratHt = contratByStId.get(s.id) ?? 0
      const offreTotal = s.dce_acces_id ? Number(offreByDce.get(s.dce_acces_id) ?? 0) : 0
      const montantContrat = contratHt > 0 ? contratHt : offreTotal
      const source: StSummary['source'] =
        contratHt > 0 ? 'contrat' : (offreTotal > 0 ? 'offre' : 'aucun')
      const facturesSt = factures.filter((f) => f.st_id === s.id)
      const totalFacture = facturesSt.reduce((acc, f) => acc + Number(f.montant_ht || 0), 0)
      const totalPaye    = facturesSt
        .filter((f) => f.statut === 'paye' || f.montant_paye != null)
        .reduce((acc, f) => acc + Number(f.montant_paye ?? f.montant_ht ?? 0), 0)
      const reste = +(montantContrat - totalPaye).toFixed(2)
      const nbAVerifier = facturesSt.filter((f) => f.statut === 'a_verifier').length
      const nbBonAPayer = facturesSt.filter((f) => f.statut === 'bon_a_payer').length
      return {
        st: s, lotNom: lot?.nom ?? null, lotOrdre: lot?.ordre ?? null,
        montantContrat, source, totalFacture, totalPaye, reste, nbAVerifier, nbBonAPayer,
      }
    }).sort((a, b) => (a.lotOrdre ?? 999) - (b.lotOrdre ?? 999))
  }, [stsRetenus, lotByDce, lotById, contratByStId, offreByDce, factures])

  const selectedSummary = useMemo(
    () => stSummaries.find((s) => s.st.id === selectedStId) ?? null,
    [stSummaries, selectedStId]
  )
  const facturesSelectedSt = useMemo(
    () => selectedStId ? factures.filter((f) => f.st_id === selectedStId) : [],
    [factures, selectedStId]
  )

  /* Actions */
  async function scanFactureSt(file: File) {
    if (!selectedStId) return
    setScanError(null)
    setScanning(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
      const path = `factures-st/${projetId}/${selectedStId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('comptabilite').upload(path, file, { contentType: file.type, upsert: false })
      if (upErr) throw new Error('Upload echoue : ' + upErr.message)
      const { data: urlData } = supabase.storage.from('comptabilite').getPublicUrl(path)
      const justificatif_url = urlData.publicUrl

      const formData = new FormData()
      formData.append('file', file)
      formData.append('type_piece', 'ACHAT')
      formData.append('mode_paiement', 'VIR')
      formData.append('lien_fichier', justificatif_url)
      const res = await fetch(N8N_OCR_WEBHOOK, { method: 'POST', body: formData })
      if (!res.ok) throw new Error(`Webhook OCR : HTTP ${res.status}`)

      let extracted: ReturnType<typeof extractDicFromOcr> = {}
      let ocrJson: unknown = {}
      try {
        ocrJson = await res.json()
        extracted = extractDicFromOcr(ocrJson)
      } catch { /* prefil vide */ }

      const numeroFromOcr = pickField(ocrJson, ['numero_facture', 'invoice_number', 'numero', 'num_facture'])
      setForm((f) => ({
        ...f,
        numero_facture:  (numeroFromOcr ? String(numeroFromOcr) : f.numero_facture),
        montant_ht:      extracted.montant_ht ?? f.montant_ht,
        date_facture:    extracted.date_depense ?? f.date_facture,
        justificatif_url,
      }))
      setShowForm(true)
    } catch (e) {
      setScanError(e instanceof Error ? e.message : String(e))
    } finally {
      setScanning(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedStId || !form.montant_ht) return
    setSubmitting(true)
    const supabase = createClient()
    await supabase.schema('app').from('at_factures').insert({
      projet_id: projetId,
      st_id: selectedStId,
      numero_facture: form.numero_facture || null,
      montant_ht: Number(form.montant_ht),
      date_facture: form.date_facture || null,
      statut: 'a_verifier',
      justificatif_url: form.justificatif_url || null,
    } as never)
    setForm({ numero_facture: '', montant_ht: '', date_facture: '', justificatif_url: '' })
    setShowForm(false)
    setSubmitting(false)
    fetchData()
  }

  async function toggle(id: string, field: keyof Facture, current: boolean) {
    const supabase = createClient()
    await supabase.schema('app').from('at_factures').update({ [field]: !current }).eq('id', id)
    fetchData()
  }

  async function setStatut(id: string, statut: string) {
    const supabase = createClient()
    await supabase.schema('app').from('at_factures').update({ statut }).eq('id', id)
    fetchData()
  }

  async function enregistrerPaiement(facture_id: string, montant: number, date: string) {
    const supabase = createClient()
    await supabase.schema('app').from('at_factures').update({
      montant_paye: montant, date_paiement: date, statut: 'paye',
    } as never).eq('id', facture_id)
    setPaiementModal(null)
    fetchData()
  }

  if (loading) return <SkeletonRows />

  /* Totaux globaux */
  const totalContrats = stSummaries.reduce((s, x) => s + x.montantContrat, 0)
  const totalFacture  = stSummaries.reduce((s, x) => s + x.totalFacture, 0)
  const totalPaye     = stSummaries.reduce((s, x) => s + x.totalPaye, 0)
  const totalReste    = +(totalContrats - totalPaye).toFixed(2)
  const aVerifier     = factures.filter((f) => f.statut === 'a_verifier').length
  const bonAPayer     = factures.filter((f) => f.statut === 'bon_a_payer').length

  return (
    <div className="space-y-5">
      {/* KPIs globaux */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Total contrats"    value={formatCurrency(totalContrats)} />
        <KpiCard label="Total facture"     value={formatCurrency(totalFacture)} />
        <KpiCard label="Total paye"        value={formatCurrency(totalPaye)} accent="emerald" />
        <KpiCard label="Reste a payer"     value={formatCurrency(totalReste)} accent={totalReste > 0 ? 'amber' : 'gray'} />
        <KpiCard label="A verifier / BAP"  value={`${aVerifier} / ${bonAPayer}`} accent={aVerifier > 0 ? 'amber' : 'gray'} />
      </div>

      {/* Synthese par lot */}
      <div>
        <p className="text-sm font-semibold text-gray-900 mb-2">Suivi par lot ({stSummaries.length})</p>
        {stSummaries.length === 0 ? (
          <EmptyState icon={Users} title="Aucun ST accepte"
            sub="Une fois les ST acceptes par l'economiste, ils apparaitront ici pour suivre les paiements." />
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[10px] text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Lot</th>
                  <th className="px-3 py-2 text-left font-medium">Sous-traitant</th>
                  <th className="px-3 py-2 text-right font-medium">Contrat <Abbr k="HT" /></th>
                  <th className="px-3 py-2 text-right font-medium">Facture</th>
                  <th className="px-3 py-2 text-right font-medium">Paye</th>
                  <th className="px-3 py-2 text-right font-medium">Reste</th>
                  <th className="px-3 py-2 text-center font-medium">Factures</th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stSummaries.map((row) => {
                  const isSelected = selectedStId === row.st.id
                  return (
                    <tr key={row.st.id} className={isSelected ? 'bg-blue-50/40' : 'hover:bg-gray-50'}>
                      <td className="px-3 py-2">
                        {row.lotNom ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono text-gray-400">{row.lotOrdre}</span>
                            <span className="text-xs text-gray-700 truncate max-w-[140px]" title={row.lotNom}>{row.lotNom}</span>
                          </div>
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-sm font-medium text-gray-900">{row.st.societe || row.st.nom}</p>
                        {row.st.corps_etat && <p className="text-[10px] text-gray-400">{row.st.corps_etat}</p>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {row.montantContrat > 0 ? (
                          <>
                            <p className="text-gray-900 font-medium">{formatCurrency(row.montantContrat)}</p>
                            <p className={`text-[9px] uppercase tracking-wider mt-0.5 ${
                              row.source === 'contrat' ? 'text-emerald-600' : 'text-amber-600'}`}>
                              {row.source === 'contrat' ? 'Contrat' : 'Offre'}
                            </p>
                          </>
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-700">
                        {row.totalFacture > 0 ? formatCurrency(row.totalFacture) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-emerald-600 font-medium">
                        {row.totalPaye > 0 ? formatCurrency(row.totalPaye) : '—'}
                      </td>
                      <td className={`px-3 py-2 text-right font-medium ${row.reste > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                        {row.reste > 0 ? formatCurrency(row.reste) : '—'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex justify-center gap-1">
                          {row.nbAVerifier > 0 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                              {row.nbAVerifier} a verifier
                            </span>
                          )}
                          {row.nbBonAPayer > 0 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                              {row.nbBonAPayer} BAP
                            </span>
                          )}
                          {row.nbAVerifier === 0 && row.nbBonAPayer === 0 && (
                            <span className="text-[10px] text-gray-300">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => { setSelectedStId(isSelected ? null : row.st.id); setShowForm(false); setScanError(null) }}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border transition-colors ${
                            isSelected ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                          }`}>
                          {isSelected ? <X className="w-3 h-3" /> : <CreditCard className="w-3 h-3" />}
                          {isSelected ? 'Fermer' : 'Selectionner'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail ST selectionne */}
      {selectedSummary && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {selectedSummary.st.societe || selectedSummary.st.nom}
              </p>
              <p className="text-xs text-gray-500">
                {selectedSummary.lotNom ? `Lot ${selectedSummary.lotOrdre} · ${selectedSummary.lotNom}` : 'Sans lot'}
                {' · '}Contrat <strong>{formatCurrency(selectedSummary.montantContrat)}</strong>
                {' · '}Facture <strong>{formatCurrency(selectedSummary.totalFacture)}</strong>
                {' · '}Paye <strong className="text-emerald-600">{formatCurrency(selectedSummary.totalPaye)}</strong>
                {' · '}Reste <strong className={selectedSummary.reste > 0 ? 'text-amber-600' : 'text-gray-400'}>{formatCurrency(selectedSummary.reste)}</strong>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer transition-colors ${
                scanning ? 'bg-gray-200 text-gray-500 cursor-wait' : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}>
                {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanLine className="w-3.5 h-3.5" />}
                {scanning ? 'Analyse...' : 'Scanner facture'}
                <input type="file" accept="image/*,application/pdf" className="hidden" disabled={scanning}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) scanFactureSt(f); e.target.value = '' }} />
              </label>
              <button onClick={() => setShowForm((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800">
                <Plus className="w-3.5 h-3.5" /> Saisir manuellement
              </button>
            </div>
          </div>

          {scanError && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <XCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-800 flex-1">Scan : {scanError}</p>
              <button type="button" onClick={() => setScanError(null)} className="flex-shrink-0 text-red-600 hover:text-red-800" aria-label="Fermer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {showForm && (
            <form onSubmit={submit} className="bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-3">
              {form.justificatif_url && (
                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2">
                  <ScanLine className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-emerald-700">Facture scannee — donnees pre-remplies</p>
                    <a href={form.justificatif_url} target="_blank" rel="noreferrer"
                      className="text-[10px] text-emerald-700 hover:underline truncate block">
                      {form.justificatif_url.split('/').pop()}
                    </a>
                  </div>
                  <button type="button" onClick={() => setForm((f) => ({ ...f, justificatif_url: '' }))}
                    className="text-emerald-700 text-[10px] underline">Detacher</button>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">N° facture</label>
                  <input type="text" value={form.numero_facture}
                    onChange={(e) => setForm((f) => ({ ...f, numero_facture: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Montant <Abbr k="HT" /> *</label>
                  <input type="number" step="0.01" value={form.montant_ht}
                    onChange={(e) => setForm((f) => ({ ...f, montant_ht: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date facture</label>
                  <input type="date" value={form.date_facture}
                    onChange={(e) => setForm((f) => ({ ...f, date_facture: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900">Annuler</button>
                <button type="submit" disabled={submitting || !form.montant_ht}
                  className="px-3 py-1.5 text-xs text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50">
                  {submitting ? '...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          )}

          {/* Liste des factures du ST */}
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">
              Factures ({facturesSelectedSt.length})
            </p>
            {facturesSelectedSt.length === 0 ? (
              <p className="text-xs text-gray-400 italic px-2 py-3 bg-gray-50 rounded-lg">
                Aucune facture pour ce ST. Scanne une facture ou saisis-la manuellement.
              </p>
            ) : (
              <div className="space-y-2">
                {facturesSelectedSt.map((f) => {
                  const allOk = f.prorata_paye && f.montant_conforme && f.avenants_inclus
                  return (
                    <div key={f.id} className="bg-gray-50 rounded-lg border border-gray-200 p-3">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <p className="text-sm font-semibold text-gray-900">
                              {f.numero_facture ?? 'Sans numero'}
                            </p>
                            <StatutBadge statut={f.statut} />
                            {f.justificatif_url && (
                              <a href={f.justificatif_url} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-blue-600 hover:bg-blue-50 rounded">
                                <Eye className="w-2.5 h-2.5" /> Voir PDF
                              </a>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">
                            {f.date_facture ? formatDate(f.date_facture) : '—'}
                            {' · '}<span className="font-semibold text-gray-700">{formatCurrency(f.montant_ht)} <Abbr k="HT" /></span>
                            {f.montant_paye != null && (
                              <> · paye <span className="text-emerald-600 font-medium">{formatCurrency(f.montant_paye)}</span>
                                {f.date_paiement && <> le {formatDate(f.date_paiement)}</>}</>
                            )}
                          </p>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          {f.statut === 'a_verifier' && (
                            <>
                              <button onClick={() => setStatut(f.id, 'bon_a_payer')} disabled={!allOk}
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed"
                                title={!allOk ? 'Cocher les 3 controles' : 'Bon a payer'}>
                                <CheckCircle2 className="w-3 h-3" /> BAP
                              </button>
                              <button onClick={() => setStatut(f.id, 'refuse')}
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50">
                                <X className="w-3 h-3" /> Refuser
                              </button>
                            </>
                          )}
                          {f.statut === 'bon_a_payer' && f.montant_paye == null && (
                            <button onClick={() => setPaiementModal(f)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-100">
                              <Receipt className="w-3 h-3" /> Enregistrer paiement
                            </button>
                          )}
                        </div>
                      </div>
                      {f.statut === 'a_verifier' && (
                        <div className="flex gap-3 pt-2 border-t border-gray-200">
                          {[
                            { key: 'prorata_paye', label: 'Prorata paye' },
                            { key: 'montant_conforme', label: 'Montant conforme' },
                            { key: 'avenants_inclus', label: 'Avenants inclus' },
                          ].map((ctrl) => {
                            const val = f[ctrl.key as keyof Facture] as boolean
                            return (
                              <label key={ctrl.key} className="flex items-center gap-1.5 cursor-pointer">
                                <input type="checkbox" checked={val}
                                  onChange={() => toggle(f.id, ctrl.key as keyof Facture, val)}
                                  className="w-3.5 h-3.5 rounded border-gray-300 text-gray-900" />
                                <span className={`text-xs ${val ? 'text-emerald-600 font-medium' : 'text-gray-500'}`}>{ctrl.label}</span>
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modale enregistrement paiement effectif */}
      {paiementModal && (
        <PaiementEffectifModal
          facture={paiementModal}
          onClose={() => setPaiementModal(null)}
          onSubmit={(montant, date) => enregistrerPaiement(paiementModal.id, montant, date)}
        />
      )}
    </div>
  )
}

function PaiementEffectifModal({
  facture, onClose, onSubmit,
}: {
  facture: Facture
  onClose: () => void
  onSubmit: (montant: number, date: string) => void
}) {
  const [montant, setMontant] = useState(String(facture.montant_ht))
  const [date, setDate]       = useState(new Date().toISOString().slice(0, 10))
  const [busy, setBusy]       = useState(false)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-600" /> Enregistrer le paiement
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
            Facture {facture.numero_facture ?? '—'} · Montant <Abbr k="HT" /> : <strong>{formatCurrency(facture.montant_ht)}</strong>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Montant paye *</label>
            <input type="number" step="0.01" value={montant} onChange={(e) => setMontant(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Date paiement *</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
          <button onClick={async () => { setBusy(true); await onSubmit(Number(montant), date); setBusy(false) }}
            disabled={busy || !montant || Number(montant) <= 0}
            className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-40">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   ONGLET 5 — RECEPTION (reserves OPR)
   ════════════════════════════════════════════════════════════════════════════ */

function ReceptionTab({ projetId }: { projetId: string }) {
  const [reserves, setReserves] = useState<Reserve[]>([])
  const [sts, setSts]           = useState<Array<Pick<ST, 'id' | 'nom' | 'societe'> & { dce_acces_id: string | null }>>([])
  const [lots, setLots]         = useState<{ id: string; ordre: number; nom: string }[]>([])
  const [dceAcces, setDceAcces] = useState<{ id: string; lot_id: string | null; statut: string | null }[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [form, setForm] = useState({ description: '', localisation: '', lot_id: '', st_id: '', delai: '15', photo_url: '' })

  async function fetchData() {
    const supabase = createClient()
    const [rRes, sRes, lRes, dceRes] = await Promise.all([
      supabase.schema('app').from('reserves').select('*').eq('projet_id', projetId).order('date_signalement', { ascending: false }),
      supabase.schema('app').from('at_sous_traitants').select('id,nom,societe,dce_acces_id').eq('projet_id', projetId).order('nom'),
      supabase.from('lots' as never).select('id,ordre,nom').eq('projet_id', projetId).order('ordre'),
      supabase.from('dce_acces_st' as never).select('id,lot_id,statut').eq('projet_id', projetId),
    ])
    setReserves((rRes.data ?? []) as Reserve[])
    setSts((sRes.data ?? []) as never)
    setLots(((lRes.data ?? []) as unknown) as { id: string; ordre: number; nom: string }[])
    setDceAcces(((dceRes.data ?? []) as unknown) as { id: string; lot_id: string | null; statut: string | null }[])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [projetId]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ST retenus indexes par lot_id */
  const stByLot = useMemo(() => {
    const dceById = new Map<string, { lot_id: string | null; statut: string | null }>()
    dceAcces.forEach((a) => dceById.set(a.id, { lot_id: a.lot_id, statut: a.statut }))
    const m = new Map<string, Array<Pick<ST, 'id' | 'nom' | 'societe'>>>()
    sts.forEach((s) => {
      if (!s.dce_acces_id) return
      const acc = dceById.get(s.dce_acces_id)
      if (!acc || acc.statut !== 'retenu' || !acc.lot_id) return
      const arr = m.get(acc.lot_id) ?? []
      arr.push({ id: s.id, nom: s.nom, societe: s.societe })
      m.set(acc.lot_id, arr)
    })
    return m
  }, [sts, dceAcces])

  /* Quand on choisit un lot : auto-selection du ST si un seul retenu */
  useEffect(() => {
    if (!form.lot_id) return
    const candidates = stByLot.get(form.lot_id) ?? []
    if (candidates.length === 1 && form.st_id !== candidates[0].id) {
      setForm((f) => ({ ...f, st_id: candidates[0].id }))
    } else if (candidates.length === 0 && form.st_id) {
      setForm((f) => ({ ...f, st_id: '' }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.lot_id, stByLot])

  async function uploadPhoto(file: File) {
    setUploadingPhoto(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
      const path = `reserves/${projetId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('comptabilite').upload(path, file, { contentType: file.type, upsert: false })
      if (upErr) throw new Error('Upload echoue : ' + upErr.message)
      const { data: urlData } = supabase.storage.from('comptabilite').getPublicUrl(path)
      setForm((f) => ({ ...f, photo_url: urlData.publicUrl }))
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.description) return
    setSubmitting(true)
    const today = new Date()
    const echeance = new Date(today)
    echeance.setDate(echeance.getDate() + Number(form.delai || '15'))
    const supabase = createClient()
    const { error } = await supabase.schema('app').from('reserves').insert({
      projet_id: projetId,
      description: form.description,
      localisation: form.localisation || null,
      lot_id: form.lot_id || null,
      st_id: form.st_id || null,
      statut: 'ouvert',
      date_signalement: today.toISOString().split('T')[0],
      delai_levee_jours: Number(form.delai || '15'),
      date_echeance: echeance.toISOString().split('T')[0],
      valide_co: false,
      photo_signalement_url: form.photo_url || null,
    } as never)
    setSubmitting(false)
    if (error) {
      alert('Erreur enregistrement : ' + error.message)
      return
    }
    setForm({ description: '', localisation: '', lot_id: '', st_id: '', delai: '15', photo_url: '' })
    setShowForm(false)
    fetchData()
  }

  async function lever(id: string) {
    const supabase = createClient()
    await supabase
      .schema('app')
      .from('reserves')
      .update({ statut: 'leve', date_levee: new Date().toISOString().split('T')[0] })
      .eq('id', id)
    fetchData()
  }

  /* Refuse la levee : repasse la reserve a 'ouvert' et nettoie la photo de levee */
  async function refuserLevee(id: string) {
    const motif = prompt('Motif du refus (optionnel) :') ?? ''
    const supabase = createClient()
    await supabase
      .schema('app')
      .from('reserves')
      .update({
        statut: 'ouvert',
        photo_levee_url: null,
        remarque: motif.trim() ? `Levee refusee : ${motif.trim()}` : 'Levee refusee',
      } as never)
      .eq('id', id)
    fetchData()
  }

  const stName = (id: string | null) => {
    if (!id) return null
    const s = sts.find((x) => x.id === id)
    return s ? (s.societe || s.nom) : null
  }

  const ouvertes = reserves.filter((r) => r.statut !== 'leve').length
  const levees   = reserves.filter((r) => r.statut === 'leve').length
  const today    = new Date()
  const enRetard = reserves.filter((r) => r.statut !== 'leve' && r.date_echeance && new Date(r.date_echeance) < today).length

  if (loading) return <SkeletonRows />

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Ouvertes" value={String(ouvertes)} accent={ouvertes > 0 ? 'amber' : 'gray'} />
        <KpiCard label="En retard" value={String(enRetard)} accent={enRetard > 0 ? 'red' : 'gray'} />
        <KpiCard label="Levees" value={String(levees)} accent="emerald" />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">Reserves <Abbr k="OPR" /></p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800"
        >
          <Plus className="w-3.5 h-3.5" /> Ajouter une reserve
        </button>
      </div>

      {showForm && (() => {
        const stCandidates = form.lot_id ? (stByLot.get(form.lot_id) ?? []) : []
        return (
        <form onSubmit={submit} className="bg-white rounded-lg border border-gray-200 shadow-card p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description *</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Lot</label>
              <select
                value={form.lot_id}
                onChange={(e) => setForm((f) => ({ ...f, lot_id: e.target.value, st_id: '' }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              >
                <option value="">Selectionner un lot</option>
                {lots.map((l) => <option key={l.id} value={l.id}>{l.ordre} - {l.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1"><Abbr k="ST" /> a charge</label>
              <select
                value={form.st_id}
                onChange={(e) => setForm((f) => ({ ...f, st_id: e.target.value }))}
                disabled={!form.lot_id || stCandidates.length === 0}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">{!form.lot_id ? 'Choisir un lot d\'abord' : stCandidates.length === 0 ? 'Aucun ST retenu pour ce lot' : 'Aucun'}</option>
                {stCandidates.map((s) => <option key={s.id} value={s.id}>{s.societe || s.nom}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Localisation</label>
              <input
                type="text"
                value={form.localisation}
                onChange={(e) => setForm((f) => ({ ...f, localisation: e.target.value }))}
                placeholder="Ex : Cuisine R+1"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Delai (jours)</label>
              <input
                type="number"
                value={form.delai}
                onChange={(e) => setForm((f) => ({ ...f, delai: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Photo</label>
            {form.photo_url ? (
              <div className="flex items-center gap-3">
                <a href={form.photo_url} target="_blank" rel="noreferrer" className="inline-block">
                  <img src={form.photo_url} alt="reserve" className="h-20 w-20 object-cover rounded-lg border border-gray-200" />
                </a>
                <button type="button" onClick={() => setForm((f) => ({ ...f, photo_url: '' }))} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 rounded-lg">
                  <X className="w-3 h-3" /> Retirer
                </button>
              </div>
            ) : (
              <label className="inline-flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100">
                {uploadingPhoto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                {uploadingPhoto ? 'Envoi...' : 'Ajouter une photo'}
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = '' }} />
              </label>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900">Annuler</button>
            <button type="submit" disabled={submitting || uploadingPhoto} className="px-3 py-1.5 text-xs text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50">
              {submitting ? '...' : 'Enregistrer'}
            </button>
          </div>
        </form>
        )
      })()}

      {reserves.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Aucune reserve" sub="Les reserves OPR seront listees ici lors de la reception." />
      ) : (
        <div className="space-y-2">
          {reserves.map((r) => {
            const enRetard = r.statut !== 'leve' && r.date_echeance && new Date(r.date_echeance) < today
            return (
              <div key={r.id} className={`bg-white rounded-lg border shadow-card p-4 ${enRetard ? 'border-red-200' : 'border-gray-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  {r.photo_signalement_url && (
                    <a href={r.photo_signalement_url} target="_blank" rel="noreferrer" className="flex-shrink-0">
                      <img src={r.photo_signalement_url} alt="reserve" className="h-16 w-16 object-cover rounded-lg border border-gray-200" />
                    </a>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      {r.statut === 'leve' ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600 border border-emerald-200">Levee</span>
                      ) : r.statut === 'en_cours' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          <Eye className="w-3 h-3" /> Levee a valider
                        </span>
                      ) : enRetard ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200">En retard</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200">Ouverte</span>
                      )}
                      {stName(r.st_id) && <span className="text-xs text-gray-500">{stName(r.st_id)}</span>}
                    </div>
                    <p className="text-sm text-gray-900">{r.description}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {r.localisation && <>{r.localisation} · </>}
                      Signalee {r.date_signalement ? formatDate(r.date_signalement) : '—'}
                      {r.date_echeance && <> · Echeance {formatDate(r.date_echeance)}</>}
                      {r.date_levee && <> · Levee {formatDate(r.date_levee)}</>}
                    </p>
                    {(r.photo_levee_url || r.remarque) && (
                      <div className="mt-2 p-2 bg-blue-50/40 border border-blue-100 rounded-lg flex items-start gap-3">
                        {r.photo_levee_url && (
                          <a href={r.photo_levee_url} target="_blank" rel="noreferrer" className="flex-shrink-0">
                            <img src={r.photo_levee_url} alt="levee" className="h-14 w-14 object-cover rounded-lg border border-blue-200" />
                          </a>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] uppercase tracking-wider text-blue-700 font-medium">Levee deposee par le ST</p>
                          {r.remarque && <p className="text-xs text-gray-700 mt-0.5 whitespace-pre-wrap">{r.remarque}</p>}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    {r.statut === 'en_cours' ? (
                      <>
                        <button
                          onClick={() => lever(r.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100"
                        >
                          <Check className="w-3 h-3" /> Valider la levee
                        </button>
                        <button
                          onClick={() => refuserLevee(r.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                        >
                          <X className="w-3 h-3" /> Refuser
                        </button>
                      </>
                    ) : r.statut !== 'leve' && (
                      <button
                        onClick={() => lever(r.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100"
                      >
                        <Check className="w-3 h-3" /> Lever
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   ONGLET 6 — DOE
   ════════════════════════════════════════════════════════════════════════════ */

const DOE_SECTIONS: Array<{
  id: string
  label: string
  description: React.ReactNode
  fields: Array<{ key: keyof DOE; label: React.ReactNode }>
}> = [
  {
    id: 'technique',
    label: 'Volet Technique',
    description: <>Fiches produits, notes de calcul (via <Abbr k="ST" />)</>,
    fields: [
      { key: 'fiches_produits',   label: 'Fiches techniques / produits' },
      { key: 'notes_calcul',      label: 'Notes de calcul et dimensionnement' },
      { key: 'memoire_technique', label: 'Memoire technique du batiment' },
    ],
  },
  {
    id: 'plans',
    label: 'Volet Plans',
    description: 'Plans de recolement (via Dessinatrice)',
    fields: [
      { key: 'plans_architecte', label: 'Plans Architecte (PDF, cotes)' },
      { key: 'plans_exe_pdf',    label: <>Plans <Abbr k="EXE" /> tous niveaux</> },
      { key: 'synoptiques',      label: 'Synoptiques lots techniques' },
    ],
  },
  {
    id: 'admin',
    label: 'Volet Administratif',
    description: 'Attestations decennales de chaque entreprise',
    fields: [
      { key: 'assurances_compilees', label: <>Decennales <Abbr k="ST" /> compilees</> },
      { key: 'carnet_entretien',     label: 'Guides d\'entretien / maintenance' },
    ],
  },
]

function doeProgress(doe: DOE): number {
  const all = DOE_SECTIONS.flatMap((s) => s.fields)
  const done = all.filter((f) => doe[f.key]).length
  return Math.round((done / all.length) * 100)
}

type DoePiece = {
  id: string
  doe_id: string
  field_key: string
  fichier_url: string
  nom_fichier: string | null
  uploaded_by: string | null
  uploaded_at: string
}

type TeamUser = { id: string; prenom: string | null; nom: string | null; role: string | null }

function DoeTab({ projetId }: { projetId: string }) {
  const [doe, setDoe]               = useState<DOE | null>(null)
  const [pieces, setPieces]         = useState<DoePiece[]>([])
  const [team, setTeam]             = useState<TeamUser[]>([])
  const [loading, setLoading]       = useState(true)
  const [creating, setCreating]     = useState(false)
  const [uploadingField, setUploadingField] = useState<string | null>(null)
  const [askModal, setAskModal]     = useState<{ field: keyof DOE; label: React.ReactNode } | null>(null)

  async function fetchData() {
    const supabase = createClient()
    const { data: doeData } = await supabase
      .schema('app').from('at_doe')
      .select('id,statut,date_envoi,fiches_produits,notes_calcul,memoire_technique,plans_architecte,plans_exe_pdf,synoptiques,assurances_compilees,carnet_entretien')
      .eq('projet_id', projetId)
      .maybeSingle()
    const d = (doeData as DOE | null) ?? null
    setDoe(d)
    if (d) {
      const { data: pcs } = await supabase
        .schema('app').from('at_doe_pieces')
        .select('*').eq('doe_id', d.id).order('uploaded_at', { ascending: false })
      setPieces(((pcs ?? []) as unknown) as DoePiece[])
    } else {
      setPieces([])
    }
    /* Equipe : utilisateurs internes (non-ST) du projet */
    const { data: users } = await supabase
      .schema('app').from('utilisateurs')
      .select('id, prenom, nom, role')
      .neq('role', 'st')
      .eq('actif', true)
      .order('prenom')
    setTeam(((users ?? []) as unknown) as TeamUser[])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [projetId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function createDoe() {
    setCreating(true)
    const supabase = createClient()
    await supabase.schema('app').from('at_doe').insert({ projet_id: projetId, statut: 'en_cours' })
    setCreating(false)
    fetchData()
  }

  async function uploadPiece(fieldKey: keyof DOE, file: File) {
    if (!doe) return
    setUploadingField(fieldKey as string)
    try {
      const supabase = createClient()
      const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
      const path = `doe/${projetId}/${doe.id}/${fieldKey as string}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('projets').upload(path, file, { contentType: file.type, upsert: false })
      if (upErr) throw new Error(upErr.message)
      const { data: urlData } = supabase.storage.from('projets').getPublicUrl(path)
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.schema('app').from('at_doe_pieces').insert({
        doe_id:       doe.id,
        field_key:    fieldKey,
        fichier_url:  urlData.publicUrl,
        nom_fichier:  file.name,
        uploaded_by:  user?.id ?? null,
      } as never)
      /* Auto-coche le champ correspondant si pas deja coche */
      if (!doe[fieldKey]) {
        await supabase.schema('app').from('at_doe').update({ [fieldKey]: true } as never).eq('id', doe.id)
      }
      fetchData()
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setUploadingField(null)
    }
  }

  async function removePiece(piece: DoePiece) {
    if (!doe) return
    if (!confirm('Supprimer ce document ?')) return
    const supabase = createClient()
    await supabase.schema('app').from('at_doe_pieces').delete().eq('id', piece.id)
    /* Si plus aucune piece sur ce champ, decoche le champ */
    const remaining = pieces.filter((p) => p.id !== piece.id && p.field_key === piece.field_key).length
    if (remaining === 0) {
      await supabase.schema('app').from('at_doe').update({ [piece.field_key]: false } as never).eq('id', doe.id)
    }
    fetchData()
  }

  async function toggleField(field: keyof DOE, current: boolean) {
    if (!doe) return
    const supabase = createClient()
    await supabase.schema('app').from('at_doe').update({ [field]: !current }).eq('id', doe.id)
    setDoe({ ...doe, [field]: !current })
  }

  async function askTeammate(field: keyof DOE, fieldLabel: string, assigneeId: string, urgence: string, dueDate: string) {
    if (!doe) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.schema('app').from('taches').insert({
      titre:        `DOE — déposer : ${fieldLabel}`,
      description:  `Document à déposer dans le DOE du projet. Catégorie : ${fieldLabel}.`,
      projet_id:    projetId,
      creee_par:    user?.id ?? null,
      assignee_a:   assigneeId,
      urgence,
      statut:       'a_faire',
      date_echeance: dueDate || null,
    } as never)
    if (error) { alert('Erreur creation tache : ' + error.message); return }
    /* Notif au destinataire */
    await supabase.schema('app').from('alertes').insert({
      utilisateur_id: assigneeId,
      projet_id:      projetId,
      type:           'tache_assignee',
      titre:          `Nouvelle tâche DOE : ${fieldLabel}`,
      message:        `Une tâche vous a été assignée pour le dépôt d'un document DOE.`,
      priorite:       (urgence === 'urgent' || urgence === 'critique') ? 'high' : 'normal',
      lue:            false,
    } as never)
    setAskModal(null)
    alert('Tâche créée et notification envoyée.')
  }

  async function markEnvoye() {
    if (!doe) return
    const supabase = createClient()
    await supabase
      .schema('app').from('at_doe')
      .update({ statut: 'envoye', date_envoi: new Date().toISOString().split('T')[0] })
      .eq('id', doe.id)
    fetchData()
  }

  if (loading) return <SkeletonRows />

  if (!doe) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-card p-10 text-center">
        <FolderCheck className="w-10 h-10 text-gray-200 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-700">Aucun <Abbr k="DOE" /> initialise</p>
        <p className="text-xs text-gray-400 mt-1 mb-4">Demarrez le dossier des ouvrages executes pour ce projet.</p>
        <button
          onClick={createDoe}
          disabled={creating}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" /> Initialiser le DOE
        </button>
      </div>
    )
  }

  const pct = doeProgress(doe)

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-gray-900"><Abbr k="DOE" /> — {pct}% complete</p>
            {doe.date_envoi && <p className="text-xs text-emerald-600">Envoye le {formatDate(doe.date_envoi)}</p>}
          </div>
          <StatutBadge statut={doe.statut} />
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-orange-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {DOE_SECTIONS.map((section) => (
        <div key={section.id} className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
          <p className="text-sm font-semibold text-gray-700">{section.label}</p>
          <p className="text-xs text-gray-400 mb-3">{section.description}</p>
          <div className="space-y-3 pl-2 border-l-2 border-gray-100">
            {section.fields.map((field) => {
              const val   = doe[field.key] as boolean
              const items = pieces.filter((p) => p.field_key === (field.key as string))
              const labelText = typeof field.label === 'string' ? field.label : String(field.key)
              return (
                <div key={field.key as string} className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={val}
                      onChange={() => toggleField(field.key, val)}
                      className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                    />
                    <span className={`text-sm flex-1 ${val ? 'text-gray-500' : 'text-gray-700'}`}>{field.label}</span>
                    <label className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg cursor-pointer flex-shrink-0 ${
                      uploadingField === field.key
                        ? 'bg-gray-100 text-gray-400 cursor-wait'
                        : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
                    }`}>
                      {uploadingField === field.key
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Upload className="w-3 h-3" />}
                      Importer
                      <input type="file" accept=".pdf,.png,.jpg,.jpeg,.dwg,.zip" className="hidden"
                        disabled={uploadingField === field.key}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPiece(field.key, f); e.target.value = '' }} />
                    </label>
                    <button
                      onClick={() => setAskModal({ field: field.key, label: field.label })}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 flex-shrink-0"
                      title="Demander a un membre de l'equipe"
                    >
                      <UserCheck className="w-3 h-3" /> Demander
                    </button>
                  </div>
                  {items.length > 0 && (
                    <div className="ml-7 space-y-1">
                      {items.map((it) => (
                        <div key={it.id} className="flex items-center gap-2 px-2 py-1 bg-emerald-50/60 border border-emerald-100 rounded-lg">
                          <FileText className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                          <a href={it.fichier_url} target="_blank" rel="noreferrer"
                            className="text-xs text-emerald-700 truncate hover:underline flex-1">
                            {it.nom_fichier ?? it.fichier_url.split('/').pop()}
                          </a>
                          <span className="text-[10px] text-gray-400 flex-shrink-0">{formatDate(it.uploaded_at)}</span>
                          <button onClick={() => removePiece(it)}
                            className="text-red-400 hover:text-red-600 flex-shrink-0" title="Supprimer">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {doe.statut !== 'envoye' && (
        <button
          onClick={markEnvoye}
          disabled={pct < 100}
          className="w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Send className="w-4 h-4" />
          {pct < 100 ? <>Completer le <Abbr k="DOE" /> ({pct}%)</> : <>Marquer envoye au client</>}
        </button>
      )}

      {doe.statut === 'envoye' && (
        <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-4 text-center">
          <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
          <p className="text-sm font-medium text-emerald-700"><Abbr k="DOE" /> envoye au client</p>
          {doe.date_envoi && <p className="text-xs text-emerald-600 mt-0.5">Le {formatDate(doe.date_envoi)}</p>}
        </div>
      )}

      {askModal && (
        <DoeAskModal
          field={askModal.field}
          label={typeof askModal.label === 'string' ? askModal.label : String(askModal.field)}
          team={team}
          onClose={() => setAskModal(null)}
          onSubmit={(assigneeId, urgence, dueDate) => askTeammate(askModal.field, typeof askModal.label === 'string' ? askModal.label : String(askModal.field), assigneeId, urgence, dueDate)}
        />
      )}
    </div>
  )
}

function DoeAskModal({
  field: _field, label, team, onClose, onSubmit,
}: {
  field: keyof DOE
  label: string
  team: TeamUser[]
  onClose: () => void
  onSubmit: (assigneeId: string, urgence: string, dueDate: string) => void
}) {
  const [assigneeId, setAssigneeId] = useState('')
  const [urgence, setUrgence]       = useState('normal')
  const [dueDate, setDueDate]       = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <p className="text-sm font-semibold text-gray-900">Demander à un coéquipier</p>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{label}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Assigner à *</label>
            <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10">
              <option value="">Choisir un membre…</option>
              {team.map((u) => (
                <option key={u.id} value={u.id}>
                  {(u.prenom ?? '') + ' ' + (u.nom ?? '')}{u.role ? ` (${u.role})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Urgence</label>
              <select value={urgence} onChange={(e) => setUrgence(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10">
                <option value="faible">Faible</option>
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
                <option value="critique">Critique</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Échéance</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900">Annuler</button>
          <button
            onClick={() => onSubmit(assigneeId, urgence, dueDate)}
            disabled={!assigneeId}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-40">
            <Send className="w-3 h-3" /> Envoyer la demande
          </button>
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   HELPERS UI
   ════════════════════════════════════════════════════════════════════════════ */

function SkeletonRows() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-white rounded-lg border border-gray-200 animate-pulse" />)}
    </div>
  )
}

function EmptyState({
  icon: Icon, title, sub,
}: { icon: typeof Users; title: string; sub: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-card p-10 text-center">
      <Icon className="w-10 h-10 text-gray-200 mx-auto mb-3" />
      <p className="text-sm font-medium text-gray-700">{title}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  )
}

function KpiCard({
  label, value, accent = 'gray',
}: { label: React.ReactNode; value: string; accent?: 'gray' | 'amber' | 'red' | 'emerald' }) {
  const colors: Record<string, string> = {
    gray:    'text-gray-900',
    amber:   'text-amber-600',
    red:     'text-red-600',
    emerald: 'text-emerald-600',
  }
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${colors[accent]}`}>{value}</p>
    </div>
  )
}
