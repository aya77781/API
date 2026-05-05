'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Users, FileText, Landmark, CreditCard, ClipboardCheck, FolderCheck,
  Plus, X, Check, CheckCircle2, AlertTriangle, Send, Layers, Trophy,
} from 'lucide-react'
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
}

type ProrataPaiement = {
  id: string
  st_id: string | null
  montant_du: number | null
  montant_paye: number | null
  statut: string
  date_paiement: string | null
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
}

type Reserve = {
  id: string
  st_id: string | null
  description: string
  localisation: string | null
  statut: string
  date_signalement: string | null
  date_echeance: string | null
  date_levee: string | null
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
              <Trophy className="w-3 h-3" /> Retenu
            </span>
          )}
          {row.kind === 'refuse' && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200">Refuse</span>
          )}
          {row.kind === 'consulte' && (
            !at ? (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">En attente</span>
            ) : score === 6 ? (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600 border border-blue-200">Consulte</span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200">{score}/6</span>
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
   ONGLET 2 — CONTRATS
   ════════════════════════════════════════════════════════════════════════════ */

function ContratsTab({ projetId }: { projetId: string }) {
  const [contrats, setContrats] = useState<Contrat[]>([])
  const [sts, setSts]           = useState<Pick<ST, 'id' | 'nom' | 'societe'>[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ st_id: '', numero: '', montant_ht: '', date_signature: '', notes: '' })

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
              {c.statut !== 'signe' && (
                <button
                  onClick={() => setStatut(c.id, 'signe')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100"
                >
                  <Check className="w-3 h-3" /> Marquer signe
                </button>
              )}
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
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   ONGLET 3 — COMPTE PRORATA
   ════════════════════════════════════════════════════════════════════════════ */

function ProrataTab({ projetId }: { projetId: string }) {
  const [dics, setDics]       = useState<DIC[]>([])
  const [paiements, setPaiements] = useState<ProrataPaiement[]>([])
  const [sts, setSts]         = useState<Pick<ST, 'id' | 'nom' | 'societe'>[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ libelle: '', montant_ht: '', date_depense: '', tva_pct: '20' })

  async function fetchData() {
    const supabase = createClient()
    const [dRes, pRes, sRes] = await Promise.all([
      supabase.schema('app').from('compte_prorata_dic').select('*').eq('projet_id', projetId).order('date_depense', { ascending: false }),
      supabase.schema('app').from('compte_prorata_paiements').select('*').eq('projet_id', projetId),
      supabase.schema('app').from('at_sous_traitants').select('id,nom,societe').eq('projet_id', projetId).order('nom'),
    ])
    setDics((dRes.data ?? []) as DIC[])
    setPaiements((pRes.data ?? []) as ProrataPaiement[])
    setSts((sRes.data ?? []) as Pick<ST, 'id' | 'nom' | 'societe'>[])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [projetId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.libelle || !form.montant_ht) return
    setSubmitting(true)
    const ht = Number(form.montant_ht)
    const tva = form.tva_pct ? Number(form.tva_pct) : 0
    const ttc = +(ht * (1 + tva / 100)).toFixed(2)
    const supabase = createClient()
    await supabase.schema('app').from('compte_prorata_dic').insert({
      projet_id: projetId,
      libelle: form.libelle,
      montant_ht: ht,
      tva_pct: tva || null,
      montant_ttc: ttc,
      date_depense: form.date_depense || null,
    })
    setForm({ libelle: '', montant_ht: '', date_depense: '', tva_pct: '20' })
    setShowForm(false)
    setSubmitting(false)
    fetchData()
  }

  const totalDic = dics.reduce((s, d) => s + (d.montant_ttc ?? d.montant_ht), 0)
  const totalEncaisse = paiements.reduce((s, p) => s + (p.montant_paye ?? 0), 0)
  const reste = totalDic - totalEncaisse

  if (loading) return <SkeletonRows />

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label={<>Total <Abbr k="DIC" /></>} value={formatCurrency(totalDic)} />
        <KpiCard label="Encaisse" value={formatCurrency(totalEncaisse)} accent="emerald" />
        <KpiCard label="Reste a appeler" value={formatCurrency(reste)} accent={reste > 0 ? 'amber' : 'gray'} />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">Depenses d&apos;Interet Commun</p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800"
        >
          <Plus className="w-3.5 h-3.5" /> Saisir une depense
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-white rounded-lg border border-gray-200 shadow-card p-4 space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Libelle *</label>
              <input
                type="text"
                value={form.libelle}
                onChange={(e) => setForm((f) => ({ ...f, libelle: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Montant <Abbr k="HT" /> *</label>
              <input
                type="number"
                value={form.montant_ht}
                onChange={(e) => setForm((f) => ({ ...f, montant_ht: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1"><Abbr k="TVA" /> %</label>
              <input
                type="number"
                value={form.tva_pct}
                onChange={(e) => setForm((f) => ({ ...f, tva_pct: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
              <input
                type="date"
                value={form.date_depense}
                onChange={(e) => setForm((f) => ({ ...f, date_depense: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900">Annuler</button>
            <button type="submit" disabled={submitting} className="px-3 py-1.5 text-xs text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50">
              {submitting ? '...' : 'Enregistrer'}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   ONGLET 4 — PAIEMENTS (factures ST)
   ════════════════════════════════════════════════════════════════════════════ */

function PaiementsTab({ projetId }: { projetId: string }) {
  const [factures, setFactures] = useState<Facture[]>([])
  const [sts, setSts]           = useState<Pick<ST, 'id' | 'nom' | 'societe'>[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ st_id: '', numero_facture: '', montant_ht: '', date_facture: '' })

  async function fetchData() {
    const supabase = createClient()
    const [fRes, sRes] = await Promise.all([
      supabase.schema('app').from('at_factures').select('*').eq('projet_id', projetId).order('created_at', { ascending: false }),
      supabase.schema('app').from('at_sous_traitants').select('id,nom,societe').eq('projet_id', projetId).order('nom'),
    ])
    setFactures((fRes.data ?? []) as Facture[])
    setSts((sRes.data ?? []) as Pick<ST, 'id' | 'nom' | 'societe'>[])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [projetId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.st_id || !form.montant_ht) return
    setSubmitting(true)
    const supabase = createClient()
    await supabase.schema('app').from('at_factures').insert({
      projet_id: projetId,
      st_id: form.st_id,
      numero_facture: form.numero_facture || null,
      montant_ht: Number(form.montant_ht),
      date_facture: form.date_facture || null,
      statut: 'a_verifier',
    })
    setForm({ st_id: '', numero_facture: '', montant_ht: '', date_facture: '' })
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

  const stName = (id: string) => {
    const s = sts.find((x) => x.id === id)
    return s ? (s.societe || s.nom) : '—'
  }

  if (loading) return <SkeletonRows />

  const aVerifier = factures.filter((f) => f.statut === 'a_verifier').length
  const bonAPayer = factures.filter((f) => f.statut === 'bon_a_payer').length

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="A verifier" value={String(aVerifier)} accent={aVerifier > 0 ? 'amber' : 'gray'} />
        <KpiCard label="Bon a payer" value={String(bonAPayer)} accent="emerald" />
        <KpiCard label="Total" value={formatCurrency(factures.reduce((s, f) => s + f.montant_ht, 0))} />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">Factures sous-traitants</p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800"
        >
          <Plus className="w-3.5 h-3.5" /> Saisir une facture
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
              <label className="block text-xs font-medium text-gray-600 mb-1">N° facture</label>
              <input
                type="text"
                value={form.numero_facture}
                onChange={(e) => setForm((f) => ({ ...f, numero_facture: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Montant <Abbr k="HT" /> *</label>
              <input
                type="number"
                value={form.montant_ht}
                onChange={(e) => setForm((f) => ({ ...f, montant_ht: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date facture</label>
              <input
                type="date"
                value={form.date_facture}
                onChange={(e) => setForm((f) => ({ ...f, date_facture: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900">Annuler</button>
            <button type="submit" disabled={submitting} className="px-3 py-1.5 text-xs text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50">
              {submitting ? '...' : 'Saisir'}
            </button>
          </div>
        </form>
      )}

      {factures.length === 0 ? (
        <EmptyState icon={CreditCard} title="Aucune facture" sub="Saisissez les factures des ST pour ce chantier." />
      ) : (
        <div className="space-y-2">
          {factures.map((f) => {
            const allOk = f.prorata_paye && f.montant_conforme && f.avenants_inclus
            return (
              <div key={f.id} className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-gray-900">{stName(f.st_id)}</p>
                      <StatutBadge statut={f.statut} />
                    </div>
                    <p className="text-xs text-gray-400">
                      {f.numero_facture ?? 'Sans numero'}
                      {f.date_facture ? ` · ${formatDate(f.date_facture)}` : ''}
                      {' · '}<span className="font-semibold text-gray-700">{formatCurrency(f.montant_ht)} <Abbr k="HT" /></span>
                    </p>
                  </div>
                  {f.statut === 'a_verifier' && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => setStatut(f.id, 'bon_a_payer')}
                        disabled={!allOk}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        title={!allOk ? 'Cocher les 3 controles avant validation' : ''}
                      >
                        <CheckCircle2 className="w-3 h-3" /> Bon a payer
                      </button>
                      <button
                        onClick={() => setStatut(f.id, 'refuse')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100"
                      >
                        <X className="w-3 h-3" /> Refuser
                      </button>
                    </div>
                  )}
                </div>
                {f.statut === 'a_verifier' && (
                  <div className="flex gap-4 pt-2 border-t border-gray-50">
                    {[
                      { key: 'prorata_paye', label: 'Prorata paye' },
                      { key: 'montant_conforme', label: 'Montant conforme' },
                      { key: 'avenants_inclus', label: 'Avenants inclus' },
                    ].map((ctrl) => {
                      const val = f[ctrl.key as keyof Facture] as boolean
                      return (
                        <label key={ctrl.key} className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={val}
                            onChange={() => toggle(f.id, ctrl.key as keyof Facture, val)}
                            className="w-3.5 h-3.5 rounded border-gray-300 text-gray-900"
                          />
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
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   ONGLET 5 — RECEPTION (reserves OPR)
   ════════════════════════════════════════════════════════════════════════════ */

function ReceptionTab({ projetId }: { projetId: string }) {
  const [reserves, setReserves] = useState<Reserve[]>([])
  const [sts, setSts]           = useState<Pick<ST, 'id' | 'nom' | 'societe'>[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ description: '', localisation: '', st_id: '', delai: '15' })

  async function fetchData() {
    const supabase = createClient()
    const [rRes, sRes] = await Promise.all([
      supabase.schema('app').from('reserves').select('*').eq('projet_id', projetId).order('date_signalement', { ascending: false }),
      supabase.schema('app').from('at_sous_traitants').select('id,nom,societe').eq('projet_id', projetId).order('nom'),
    ])
    setReserves((rRes.data ?? []) as Reserve[])
    setSts((sRes.data ?? []) as Pick<ST, 'id' | 'nom' | 'societe'>[])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [projetId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.description) return
    setSubmitting(true)
    const today = new Date()
    const echeance = new Date(today)
    echeance.setDate(echeance.getDate() + Number(form.delai || '15'))
    const supabase = createClient()
    await supabase.schema('app').from('reserves').insert({
      projet_id: projetId,
      description: form.description,
      localisation: form.localisation || null,
      st_id: form.st_id || null,
      statut: 'ouverte',
      date_signalement: today.toISOString().split('T')[0],
      delai_levee_jours: Number(form.delai || '15'),
      date_echeance: echeance.toISOString().split('T')[0],
      valide_co: false,
    })
    setForm({ description: '', localisation: '', st_id: '', delai: '15' })
    setShowForm(false)
    setSubmitting(false)
    fetchData()
  }

  async function lever(id: string) {
    const supabase = createClient()
    await supabase
      .schema('app')
      .from('reserves')
      .update({ statut: 'levee', date_levee: new Date().toISOString().split('T')[0] })
      .eq('id', id)
    fetchData()
  }

  const stName = (id: string | null) => {
    if (!id) return null
    const s = sts.find((x) => x.id === id)
    return s ? (s.societe || s.nom) : null
  }

  const ouvertes = reserves.filter((r) => r.statut !== 'levee').length
  const levees   = reserves.filter((r) => r.statut === 'levee').length
  const today    = new Date()
  const enRetard = reserves.filter((r) => r.statut !== 'levee' && r.date_echeance && new Date(r.date_echeance) < today).length

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

      {showForm && (
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
          <div className="grid grid-cols-3 gap-3">
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
              <label className="block text-xs font-medium text-gray-600 mb-1"><Abbr k="ST" /> a charge</label>
              <select
                value={form.st_id}
                onChange={(e) => setForm((f) => ({ ...f, st_id: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              >
                <option value="">Aucun</option>
                {sts.map((s) => <option key={s.id} value={s.id}>{s.societe || s.nom}</option>)}
              </select>
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
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900">Annuler</button>
            <button type="submit" disabled={submitting} className="px-3 py-1.5 text-xs text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50">
              {submitting ? '...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      )}

      {reserves.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Aucune reserve" sub="Les reserves OPR seront listees ici lors de la reception." />
      ) : (
        <div className="space-y-2">
          {reserves.map((r) => {
            const enRetard = r.statut !== 'levee' && r.date_echeance && new Date(r.date_echeance) < today
            return (
              <div key={r.id} className={`bg-white rounded-lg border shadow-card p-4 ${enRetard ? 'border-red-200' : 'border-gray-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {r.statut === 'levee' ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600 border border-emerald-200">Levee</span>
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
                  </div>
                  {r.statut !== 'levee' && (
                    <button
                      onClick={() => lever(r.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 flex-shrink-0"
                    >
                      <Check className="w-3 h-3" /> Lever
                    </button>
                  )}
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

function DoeTab({ projetId }: { projetId: string }) {
  const [doe, setDoe]         = useState<DOE | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  async function fetchData() {
    const supabase = createClient()
    const { data } = await supabase
      .schema('app')
      .from('at_doe')
      .select('id,statut,date_envoi,fiches_produits,notes_calcul,memoire_technique,plans_architecte,plans_exe_pdf,synoptiques,assurances_compilees,carnet_entretien')
      .eq('projet_id', projetId)
      .maybeSingle()
    setDoe((data as DOE | null) ?? null)
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

  async function toggleField(field: keyof DOE, current: boolean) {
    if (!doe) return
    const supabase = createClient()
    await supabase.schema('app').from('at_doe').update({ [field]: !current }).eq('id', doe.id)
    setDoe({ ...doe, [field]: !current })
  }

  async function markEnvoye() {
    if (!doe) return
    const supabase = createClient()
    await supabase
      .schema('app')
      .from('at_doe')
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
          <div className="space-y-2 pl-2 border-l-2 border-gray-100">
            {section.fields.map((field) => {
              const val = doe[field.key] as boolean
              return (
                <label key={field.key as string} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={val}
                    onChange={() => toggleField(field.key, val)}
                    className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                  />
                  <span className={`text-sm ${val ? 'line-through text-gray-400' : 'text-gray-700'}`}>{field.label}</span>
                  {val && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 ml-auto" />}
                </label>
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
