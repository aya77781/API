'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Wallet, Receipt, FileText, BarChart2, ExternalLink, Plus, AlertCircle,
  Scale, Landmark, CreditCard,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ProjetHeader } from '@/components/projet/ProjetHeader'
import { RevenuModal } from '@/components/compta/RevenuModal'
import { DepenseModal } from '@/components/compta/DepenseModal'
import { CautionModal } from '@/components/compta/CautionModal'
import { CampagneModal } from '@/components/compta/CampagneModal'
import { formatCurrency } from '@/lib/utils'

/* ── Types ─────────────────────────────────────────────────────── */

type Projet = {
  id: string
  nom: string
  reference: string | null
  type_chantier: string | null
  statut: string
  client_nom: string | null
  budget_total: number | null
  budget_client_ht: number | null
  surface_m2: number | null
}

type Revenu = {
  id: string
  libelle: string
  type: string
  montant_ht: number
  tva_pct: number
  date_facture: string | null
  date_encaissement: string | null
  statut: string
  reference_facture: string | null
  justificatif_url: string | null
}

type Depense = {
  id: string
  libelle: string
  categorie: string
  fournisseur_id: string | null
  montant_ht: number
  tva_pct: number
  date_facture: string
  date_paiement: string | null
  statut: string
  justificatif_url: string | null
}

type Fournisseur = { id: string; nom: string }
type SousTraitant = { id: string; raison_sociale: string }

type NoteFrais = {
  id: string
  user_id: string
  libelle: string
  categorie: string | null
  montant_ttc: number
  tva_pct: number
  date_depense: string | null
  statut: string
  justificatif_url: string | null
  commentaire: string | null
  motif_refus: string | null
  projet_id: string | null
}

type Utilisateur = { id: string; prenom: string; nom: string }

type Caution = {
  id: string
  fournisseur_id: string
  montant: number
  banque_emettrice: string
  reference_acte: string | null
  date_emission: string
  date_echeance: string
  statut: string
  date_liberation: string | null
}

type Campagne = {
  id: string
  nom: string
  date_creation: string
  date_prevue: string | null
  statut: string
  montant_total: number
  nb_depenses_projet: number
  montant_projet: number
}

const TABS = [
  { id: 'overview',   label: "Vue d'ensemble", icon: BarChart2 },
  { id: 'revenus',    label: 'Revenus',        icon: Wallet },
  { id: 'depenses',   label: 'Dépenses',       icon: Receipt },
  { id: 'ndf',        label: 'Notes de frais', icon: FileText },
  { id: 'arbitrage',  label: 'Arbitrage',      icon: Scale },
  { id: 'cautions',   label: 'Cautions ST',    icon: Landmark },
  { id: 'reglements', label: 'Règlements',     icon: CreditCard },
] as const

/* ── Helpers ───────────────────────────────────────────────────── */

const REV_STATUT_BADGE: Record<string, string> = {
  en_attente: 'bg-gray-100 text-gray-600',
  facture:    'bg-amber-50 text-amber-700',
  encaisse:   'bg-emerald-50 text-emerald-700',
}
const REV_STATUT_LABEL: Record<string, string> = {
  en_attente: 'En attente', facture: 'Facturé', encaisse: 'Encaissé',
}

const DEP_STATUT_BADGE: Record<string, string> = {
  en_attente:            'bg-gray-100 text-gray-600',
  attente_validation_co: 'bg-amber-50 text-amber-700',
  valide:                'bg-emerald-50 text-emerald-700',
  en_campagne:           'bg-purple-50 text-purple-700',
  paye:                  'bg-blue-50 text-blue-700',
}
const DEP_STATUT_LABEL: Record<string, string> = {
  en_attente: 'En attente', attente_validation_co: 'À valider CO',
  valide: 'Validée', en_campagne: 'En campagne', paye: 'Payée',
}

const NDF_STATUT_BADGE: Record<string, string> = {
  soumise:    'bg-amber-50 text-amber-700',
  validee:    'bg-emerald-50 text-emerald-700',
  refusee:    'bg-red-50 text-red-700',
  remboursee: 'bg-blue-50 text-blue-700',
}
const NDF_STATUT_LABEL: Record<string, string> = {
  soumise: 'À valider', validee: 'Validée', refusee: 'Refusée', remboursee: 'Remboursée',
}

const CAUTION_STATUT_BADGE: Record<string, string> = {
  active:    'bg-blue-50 text-blue-700',
  liberee:   'bg-emerald-50 text-emerald-700',
  echue:     'bg-red-50 text-red-700',
  contestee: 'bg-amber-50 text-amber-700',
}
const CAUTION_STATUT_LABEL: Record<string, string> = {
  active: 'Active', liberee: 'Libérée', echue: 'Échue', contestee: 'Contestée',
}

const CAMP_STATUT_BADGE: Record<string, string> = {
  brouillon: 'bg-gray-100 text-gray-600',
  soumise:   'bg-amber-50 text-amber-700',
  validee:   'bg-blue-50 text-blue-700',
  executee:  'bg-emerald-50 text-emerald-700',
}
const CAMP_STATUT_LABEL: Record<string, string> = {
  brouillon: 'Brouillon', soumise: 'Soumise', validee: 'Validée', executee: 'Exécutée',
}

function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })
}

/* ═════════════════════════════════════════════════════════════════ */

export default function ComptaProjetPage() {
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()

  const [projet, setProjet] = useState<Projet | null>(null)
  const [revenus, setRevenus] = useState<Revenu[]>([])
  const [depenses, setDepenses] = useState<Depense[]>([])
  const [ndf, setNdf] = useState<NoteFrais[]>([])
  const [cautions, setCautions] = useState<Caution[]>([])
  const [campagnes, setCampagnes] = useState<Campagne[]>([])
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [sousTraitants, setSousTraitants] = useState<SousTraitant[]>([])
  const [users, setUsers] = useState<Utilisateur[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<typeof TABS[number]['id']>('overview')
  const [showRevenuModal, setShowRevenuModal] = useState(false)
  const [showDepenseModal, setShowDepenseModal] = useState(false)
  const [showCautionModal, setShowCautionModal] = useState(false)
  const [showCampagneModal, setShowCampagneModal] = useState(false)

  async function load() {
      const [p, pPub, r, d, n, cau, f, st, u] = await Promise.all([
        supabase.schema('app').from('projets')
          .select('id, nom, reference, type_chantier, statut, client_nom, budget_total, surface_m2')
          .eq('id', id).maybeSingle(),
        supabase.from('projets').select('budget_client_ht').eq('id', id).maybeSingle(),
        supabase.from('revenus').select('*').eq('projet_id', id).order('date_facture', { ascending: false, nullsFirst: false }),
        supabase.from('depenses').select('*').eq('projet_id', id).order('date_facture', { ascending: false }),
        supabase.from('notes_frais').select('*').eq('projet_id', id).order('date_depense', { ascending: false, nullsFirst: false }),
        supabase.from('cautions').select('*').eq('projet_id', id).order('date_echeance'),
        supabase.from('fournisseurs').select('id, nom'),
        supabase.schema('app').from('sous_traitants').select('id, raison_sociale').eq('actif', true).order('raison_sociale'),
        supabase.schema('app').from('utilisateurs').select('id, prenom, nom'),
      ])
      const base = p.data as Omit<Projet, 'budget_client_ht'> | null
      setProjet(base ? { ...base, budget_client_ht: (pPub.data as { budget_client_ht: number | null } | null)?.budget_client_ht ?? null } : null)
      setRevenus((r.data ?? []) as Revenu[])
      setDepenses((d.data ?? []) as Depense[])
      setNdf((n.data ?? []) as NoteFrais[])
      setCautions((cau.data ?? []) as Caution[])
      setFournisseurs((f.data ?? []) as Fournisseur[])
      setSousTraitants((st.data ?? []) as SousTraitant[])
      setUsers((u.data ?? []) as Utilisateur[])

      // Campagnes de virement liées à ce projet (via depenses du projet)
      const depRows = ((d.data ?? []) as Depense[])
      const depIds = depRows.map(x => x.id)
      if (depIds.length > 0) {
        const { data: links } = await supabase
          .from('campagne_depenses')
          .select('campagne_id, depense_id')
          .in('depense_id', depIds)
        const linkRows = (links ?? []) as { campagne_id: string; depense_id: string }[]
        const campIds = [...new Set(linkRows.map(l => l.campagne_id))]
        if (campIds.length > 0) {
          const { data: camps } = await supabase
            .from('campagnes_virement')
            .select('id, nom, date_creation, date_prevue, statut, montant_total')
            .in('id', campIds)
            .order('date_creation', { ascending: false })
          const depByCamp: Record<string, string[]> = {}
          for (const l of linkRows) {
            depByCamp[l.campagne_id] = depByCamp[l.campagne_id] ?? []
            depByCamp[l.campagne_id].push(l.depense_id)
          }
          const depMontant = new Map<string, number>(
            depRows.map(x => [x.id, Number(x.montant_ht)] as [string, number])
          )
          setCampagnes(((camps ?? []) as Omit<Campagne, 'nb_depenses_projet' | 'montant_projet'>[]).map(c => {
            const dIds = depByCamp[c.id] ?? []
            return {
              ...c,
              nb_depenses_projet: dIds.length,
              montant_projet: dIds.reduce((s, did) => s + (depMontant.get(did) ?? 0), 0),
            }
          }))
        }
      }

      setLoading(false)
    }

  useEffect(() => {
    load()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function updateRevenuStatut(revenuId: string, statut: string) {
    setRevenus(prev => prev.map(r => r.id === revenuId ? { ...r, statut } : r))
    await (supabase.from('revenus') as unknown as {
      update: (p: unknown) => { eq: (k: string, v: string) => Promise<unknown> }
    }).update({ statut }).eq('id', revenuId)
  }

  async function updateDepenseStatut(depenseId: string, statut: string) {
    setDepenses(prev => prev.map(d => d.id === depenseId ? { ...d, statut } : d))
    await (supabase.from('depenses') as unknown as {
      update: (p: unknown) => { eq: (k: string, v: string) => Promise<unknown> }
    }).update({ statut }).eq('id', depenseId)
  }

  async function updateCautionStatut(cautionId: string, statut: string) {
    setCautions(prev => prev.map(c => c.id === cautionId ? { ...c, statut } : c))
    const updates: Record<string, unknown> = { statut }
    if (statut === 'liberee') updates.date_liberation = new Date().toISOString().slice(0, 10)
    await (supabase.from('cautions') as unknown as {
      update: (p: unknown) => { eq: (k: string, v: string) => Promise<unknown> }
    }).update(updates).eq('id', cautionId)
  }

  async function updateNdfStatut(ndfId: string, statut: string) {
    let motif: string | null = null
    if (statut === 'refusee') {
      motif = window.prompt('Motif du refus (visible par la personne) :') ?? ''
      if (!motif.trim()) return  // annulé
    }
    setNdf(prev => prev.map(n => n.id === ndfId ? { ...n, statut, motif_refus: motif ?? n.motif_refus } : n))
    const updates: Record<string, unknown> = { statut }
    if (motif !== null) updates.motif_refus = motif.trim()
    await (supabase.from('notes_frais') as unknown as {
      update: (p: unknown) => { eq: (k: string, v: string) => Promise<unknown> }
    }).update(updates).eq('id', ndfId)
  }

  async function updateCampagneStatut(campagneId: string, statut: string) {
    setCampagnes(prev => prev.map(c => c.id === campagneId ? { ...c, statut } : c))
    await (supabase.from('campagnes_virement') as unknown as {
      update: (p: unknown) => { eq: (k: string, v: string) => Promise<unknown> }
    }).update({ statut }).eq('id', campagneId)
    // Si on exécute : marquer toutes les depenses liées comme 'paye'
    if (statut === 'executee') {
      const { data: links } = await supabase
        .from('campagne_depenses')
        .select('depense_id')
        .eq('campagne_id', campagneId)
      const depIds = ((links ?? []) as { depense_id: string }[]).map(l => l.depense_id)
      if (depIds.length > 0) {
        const today = new Date().toISOString().slice(0, 10)
        await (supabase.from('depenses') as unknown as {
          update: (p: unknown) => { in: (k: string, v: string[]) => Promise<unknown> }
        }).update({ statut: 'paye', date_paiement: today }).in('id', depIds)
        load() // rafraichir pour voir les depenses passees en payé
      }
    }
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
        Projet introuvable. <Link href="/compta/projets" className="underline">Retour</Link>
      </div>
    )
  }

  /* ── Calculs financiers ─────────────────────────────────────── */
  const totalFacture   = revenus.filter(r => r.statut !== 'en_attente').reduce((s, r) => s + Number(r.montant_ht), 0)
  const totalEncaisse  = revenus.filter(r => r.statut === 'encaisse').reduce((s, r) => s + Number(r.montant_ht), 0)
  const totalDepEng    = depenses.filter(d => d.statut !== 'en_attente').reduce((s, d) => s + Number(d.montant_ht), 0)
  const totalDepPaye   = depenses.filter(d => d.statut === 'paye').reduce((s, d) => s + Number(d.montant_ht), 0)
  const totalNdf       = ndf.filter(n => n.statut !== 'refusee').reduce((s, n) => s + Number(n.montant_ttc), 0)
  const totalNdfRembourse = ndf.filter(n => n.statut === 'remboursee').reduce((s, n) => s + Number(n.montant_ttc), 0)
  const ndfAValider    = ndf.filter(n => n.statut === 'soumise').length
  const margeBrute     = totalEncaisse - totalDepPaye - totalNdfRembourse
  const budgetClient   = projet.budget_client_ht ?? projet.budget_total ?? 0
  const resteAFacturer = budgetClient - totalFacture
  const tauxFacture    = budgetClient > 0 ? Math.round((totalFacture / budgetClient) * 100) : 0

  const fournisseurNom = (fid: string | null) =>
    fid ? (fournisseurs.find(f => f.id === fid)?.nom ?? '—') : '—'
  const userNom = (uid: string) => {
    const u = users.find(x => x.id === uid)
    return u ? `${u.prenom} ${u.nom}` : '—'
  }

  return (
    <div className="overflow-x-hidden">
      <ProjetHeader projet={projet} backHref="/compta/projets" showSurface />

      {/* Onglets */}
      <div className="bg-white border-b border-gray-200 overflow-hidden">
        <nav className="flex px-6 overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon
            const count =
              t.id === 'revenus'    ? revenus.length    :
              t.id === 'depenses'   ? depenses.length   :
              t.id === 'ndf'        ? ndf.length        :
              t.id === 'cautions'   ? cautions.length   :
              t.id === 'reglements' ? campagnes.length  : null
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === t.id
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
                {count != null && count > 0 && (
                  <span className="ml-1 text-xs text-gray-400">({count})</span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="p-6 space-y-5">

        {/* ─── Vue d'ensemble ─── */}
        {activeTab === 'overview' && (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KPI label="Budget client" value={budgetClient > 0 ? formatCurrency(budgetClient) : '—'} hint="HT contractualisé" />
              <KPI label="Facturé" value={formatCurrency(totalFacture)} hint={`${tauxFacture}% du budget`} />
              <KPI label="Encaissé" value={formatCurrency(totalEncaisse)} hint={`Reste à facturer : ${formatCurrency(Math.max(0, resteAFacturer))}`} />
              <KPI
                label="Marge brute"
                value={formatCurrency(margeBrute)}
                hint="Encaissé − Dépenses payées − NDF"
                tone={margeBrute >= 0 ? 'pos' : 'neg'}
              />
            </div>

            {/* Détail dépenses */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <KPI label="Dépenses engagées" value={formatCurrency(totalDepEng)} hint={`${depenses.filter(d => d.statut !== 'en_attente').length} factures`} />
              <KPI label="Dépenses payées" value={formatCurrency(totalDepPaye)} hint={`${depenses.filter(d => d.statut === 'paye').length} réglées`} />
              <KPI
                label="Notes de frais"
                value={formatCurrency(totalNdf)}
                hint={ndfAValider > 0
                  ? `${ndfAValider} à valider · ${ndf.length} au total`
                  : `${ndf.length} note${ndf.length > 1 ? 's' : ''}`}
              />
            </div>

            {/* Alertes simples */}
            {budgetClient > 0 && totalDepEng > budgetClient && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-700">
                  Les dépenses engagées dépassent le budget client de {formatCurrency(totalDepEng - budgetClient)}.
                </p>
              </div>
            )}
            {resteAFacturer > 0 && tauxFacture < 100 && projet.statut === 'cloture' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700">
                  Projet en clôture mais il reste {formatCurrency(resteAFacturer)} à facturer.
                </p>
              </div>
            )}

            {/* Liens rapides */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide mb-3">Actions rapides</h3>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setShowRevenuModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-50">
                  <Plus className="w-3 h-3" /> Ajouter un revenu
                </button>
                <button onClick={() => setShowDepenseModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-50">
                  <Plus className="w-3 h-3" /> Ajouter une dépense
                </button>
                <button onClick={() => setShowCampagneModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-50">
                  <Plus className="w-3 h-3" /> Nouvelle campagne de virement
                </button>
                <Link href="/compta/tresorerie" className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-50">
                  <ExternalLink className="w-3 h-3" /> Trésorerie
                </Link>
              </div>
            </div>
          </>
        )}

        {/* ─── Revenus ─── */}
        {activeTab === 'revenus' && (
          <DataCard title={`Revenus du projet (${revenus.length})`} onAdd={() => setShowRevenuModal(true)}>
            {revenus.length === 0 ? (
              <EmptyState message="Aucun revenu enregistré pour ce projet" />
            ) : (
              <Table
                headers={['Libellé', 'Type', 'Date facture', 'Encaissement', 'Montant HT', 'Facture', 'Statut']}
                rows={revenus.map(r => [
                  r.libelle,
                  <span key="t" className="text-gray-500 capitalize">{r.type}</span>,
                  fmtDate(r.date_facture),
                  fmtDate(r.date_encaissement),
                  <span key="m" className="tabular-nums font-medium text-gray-900">{formatCurrency(Number(r.montant_ht))}</span>,
                  <JustifLink key="j" url={r.justificatif_url} />,
                  <select
                    key="s"
                    value={r.statut}
                    onChange={(e) => updateRevenuStatut(r.id, e.target.value)}
                    className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-900/10 border-0 ${REV_STATUT_BADGE[r.statut] ?? 'bg-gray-100 text-gray-600'}`}
                  >
                    {Object.entries(REV_STATUT_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>,
                ])}
              />
            )}
          </DataCard>
        )}

        {/* ─── Dépenses ─── */}
        {activeTab === 'depenses' && (
          <DataCard title={`Dépenses du projet (${depenses.length})`} onAdd={() => setShowDepenseModal(true)}>
            {depenses.length === 0 ? (
              <EmptyState message="Aucune dépense enregistrée pour ce projet" />
            ) : (
              <Table
                headers={['Libellé', 'Fournisseur', 'Catégorie', 'Date facture', 'Paiement', 'Montant HT', 'Facture', 'Statut']}
                rows={depenses.map(d => [
                  d.libelle,
                  fournisseurNom(d.fournisseur_id),
                  <span key="c" className="text-gray-500">{d.categorie.replace('_', ' ')}</span>,
                  fmtDate(d.date_facture),
                  fmtDate(d.date_paiement),
                  <span key="m" className="tabular-nums font-medium text-gray-900">{formatCurrency(Number(d.montant_ht))}</span>,
                  <JustifLink key="j" url={d.justificatif_url} />,
                  <select
                    key="s"
                    value={d.statut}
                    onChange={(e) => updateDepenseStatut(d.id, e.target.value)}
                    className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-900/10 border-0 ${DEP_STATUT_BADGE[d.statut] ?? 'bg-gray-100 text-gray-600'}`}
                  >
                    {Object.entries(DEP_STATUT_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>,
                ])}
              />
            )}
          </DataCard>
        )}

        {/* ─── Notes de frais ─── */}
        {activeTab === 'ndf' && (
          <DataCard title={`Notes de frais (${ndf.length})`}>
            <p className="px-4 py-2 text-[10px] text-gray-400 bg-gray-50 border-b border-gray-100">
              Les notes de frais sont saisies par l&apos;équipe depuis leur module Notes de frais. Elles apparaissent ici dès qu&apos;elles sont imputées à ce projet.
            </p>
            {ndf.length === 0 ? (
              <EmptyState message="Aucune note de frais imputée à ce projet" />
            ) : (
              <Table
                headers={['Libellé', 'Auteur', 'Catégorie', 'Date', 'Montant TTC', 'Justif', 'Statut']}
                rows={ndf.map(n => [
                  <div key="l">
                    <p className="text-xs text-gray-800">{n.libelle}</p>
                    {n.motif_refus && (
                      <p className="text-[10px] text-red-600 mt-0.5">Refus : {n.motif_refus}</p>
                    )}
                  </div>,
                  userNom(n.user_id),
                  <span key="c" className="text-gray-500 capitalize">{n.categorie ?? '—'}</span>,
                  fmtDate(n.date_depense),
                  <span key="m" className="tabular-nums font-medium text-gray-900">{formatCurrency(Number(n.montant_ttc))}</span>,
                  <JustifLink key="j" url={n.justificatif_url} />,
                  <select
                    key="s"
                    value={n.statut}
                    onChange={(e) => updateNdfStatut(n.id, e.target.value)}
                    className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-900/10 border-0 ${NDF_STATUT_BADGE[n.statut] ?? 'bg-gray-100 text-gray-600'}`}
                  >
                    {Object.entries(NDF_STATUT_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>,
                ])}
              />
            )}
          </DataCard>
        )}

        {/* ─── Arbitrage (vue dépenses groupées par mois) ─── */}
        {activeTab === 'arbitrage' && (
          (() => {
            const groups = groupDepensesByMonth(depenses)
            if (groups.length === 0) {
              return (
                <DataCard title="Arbitrage des dépenses">
                  <EmptyState message="Aucune dépense à arbitrer pour ce projet" />
                </DataCard>
              )
            }
            return (
              <div className="space-y-4">
                <p className="text-xs text-gray-500">Vue des dépenses du projet regroupées par mois de facture. Pour ajouter une dépense, va dans l&apos;onglet Dépenses.</p>
                {groups.map(g => (
                  <DataCard key={g.key} title={`${g.label} — ${g.items.length} facture${g.items.length > 1 ? 's' : ''} · ${formatCurrency(g.total)}`}>
                    <Table
                      headers={['Libellé', 'Fournisseur', 'Catégorie', 'Date facture', 'Paiement', 'Montant HT', 'Facture', 'Statut']}
                      rows={g.items.map(d => [
                        d.libelle,
                        fournisseurNom(d.fournisseur_id),
                        <span key="c" className="text-gray-500">{d.categorie.replace('_', ' ')}</span>,
                        fmtDate(d.date_facture),
                        fmtDate(d.date_paiement),
                        <span key="m" className="tabular-nums font-medium text-gray-900">{formatCurrency(Number(d.montant_ht))}</span>,
                        <JustifLink key="j" url={d.justificatif_url} />,
                        <select
                          key="s"
                          value={d.statut}
                          onChange={(e) => updateDepenseStatut(d.id, e.target.value)}
                          className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-900/10 border-0 ${DEP_STATUT_BADGE[d.statut] ?? 'bg-gray-100 text-gray-600'}`}
                        >
                          {Object.entries(DEP_STATUT_LABEL).map(([v, l]) => (
                            <option key={v} value={v}>{l}</option>
                          ))}
                        </select>,
                      ])}
                    />
                  </DataCard>
                ))}
              </div>
            )
          })()
        )}

        {/* ─── Cautions ST ─── */}
        {activeTab === 'cautions' && (
          <DataCard title={`Cautions sous-traitants (${cautions.length})`} onAdd={() => setShowCautionModal(true)}>
            {cautions.length === 0 ? (
              <EmptyState message="Aucune caution déposée pour ce projet" />
            ) : (
              <Table
                headers={['Fournisseur', 'Banque', 'Référence', 'Émission', 'Échéance', 'Montant', 'Statut']}
                rows={cautions.map(c => {
                  const daysLeft = Math.ceil((new Date(c.date_echeance).getTime() - Date.now()) / 86400000)
                  const isExpiring = daysLeft >= 0 && daysLeft < 30 && c.statut === 'active'
                  return [
                    fournisseurNom(c.fournisseur_id),
                    c.banque_emettrice,
                    <span key="r" className="text-xs text-gray-500">{c.reference_acte ?? '—'}</span>,
                    fmtDate(c.date_emission),
                    <span key="e" className={isExpiring ? 'text-amber-700 font-medium' : ''}>
                      {fmtDate(c.date_echeance)}
                      {isExpiring && <span className="ml-1 text-[10px]">(J-{daysLeft})</span>}
                    </span>,
                    <span key="m" className="tabular-nums font-medium text-gray-900">{formatCurrency(Number(c.montant))}</span>,
                    <select
                      key="s"
                      value={c.statut}
                      onChange={(e) => updateCautionStatut(c.id, e.target.value)}
                      className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-900/10 border-0 ${CAUTION_STATUT_BADGE[c.statut] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {Object.entries(CAUTION_STATUT_LABEL).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>,
                  ]
                })}
              />
            )}
          </DataCard>
        )}

        {/* ─── Règlements ─── */}
        {activeTab === 'reglements' && (
          <DataCard title={`Campagnes de virement incluant ce projet (${campagnes.length})`} onAdd={() => setShowCampagneModal(true)}>
            {campagnes.length === 0 ? (
              <EmptyState message="Aucune campagne de virement pour ce projet. Crée une campagne pour grouper les dépenses validées." />
            ) : (
              <Table
                headers={['Campagne', 'Créée le', 'Prévue le', 'Dépenses projet', 'Montant projet', 'Total campagne', 'Statut']}
                rows={campagnes.map(c => [
                  c.nom,
                  fmtDate(c.date_creation),
                  fmtDate(c.date_prevue),
                  <span key="nb" className="text-gray-700">{c.nb_depenses_projet}</span>,
                  <span key="mp" className="tabular-nums font-medium text-gray-900">{formatCurrency(c.montant_projet)}</span>,
                  <span key="mt" className="tabular-nums text-gray-500">{formatCurrency(Number(c.montant_total))}</span>,
                  <select
                    key="s"
                    value={c.statut}
                    onChange={(e) => updateCampagneStatut(c.id, e.target.value)}
                    className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-900/10 border-0 ${CAMP_STATUT_BADGE[c.statut] ?? 'bg-gray-100 text-gray-600'}`}
                  >
                    {Object.entries(CAMP_STATUT_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>,
                ])}
              />
            )}
          </DataCard>
        )}
      </div>

      {/* ── Modals ── */}
      {showRevenuModal && (
        <RevenuModal
          projetId={id}
          projetNom={projet.nom}
          onClose={() => setShowRevenuModal(false)}
          onSaved={() => { setShowRevenuModal(false); load() }}
        />
      )}
      {showDepenseModal && (
        <DepenseModal
          projetId={id}
          projetNom={projet.nom}
          fournisseurs={fournisseurs}
          onClose={() => setShowDepenseModal(false)}
          onSaved={() => { setShowDepenseModal(false); load() }}
        />
      )}
      {showCautionModal && (
        <CautionModal
          projetId={id}
          projetNom={projet.nom}
          sousTraitants={sousTraitants}
          onClose={() => setShowCautionModal(false)}
          onSaved={() => { setShowCautionModal(false); load() }}
        />
      )}
      {showCampagneModal && (
        <CampagneModal
          projetId={id}
          projetNom={projet.nom}
          fournisseurs={fournisseurs}
          onClose={() => setShowCampagneModal(false)}
          onSaved={() => { setShowCampagneModal(false); load() }}
        />
      )}
    </div>
  )
}

function groupDepensesByMonth(items: Depense[]) {
  const MONTHS_FR = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
  ]
  const map = new Map<string, { key: string; label: string; items: Depense[]; total: number }>()
  for (const d of items) {
    if (!d.date_facture) continue
    const dt = new Date(d.date_facture)
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
    const label = `${MONTHS_FR[dt.getMonth()]} ${dt.getFullYear()}`
    if (!map.has(key)) map.set(key, { key, label, items: [], total: 0 })
    const g = map.get(key)!
    g.items.push(d)
    g.total += Number(d.montant_ht)
  }
  return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key))
}

/* ── Sous-composants ───────────────────────────────────────────── */

function KPI({ label, value, hint, tone }: {
  label: string; value: string; hint?: string; tone?: 'pos' | 'neg'
}) {
  const color = tone === 'pos' ? 'text-emerald-600' : tone === 'neg' ? 'text-red-600' : 'text-gray-900'
  return (
    <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-lg font-semibold mt-1 tabular-nums ${color}`}>{value}</p>
      {hint && <p className="text-[10px] text-gray-400 mt-0.5">{hint}</p>}
    </div>
  )
}

function DataCard({ title, addHref, onAdd, children }: {
  title: string; addHref?: string; onAdd?: () => void; children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide">{title}</h3>
        {onAdd ? (
          <button onClick={onAdd} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900">
            <Plus className="w-3 h-3" /> Ajouter
          </button>
        ) : addHref ? (
          <Link href={addHref} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900">
            <Plus className="w-3 h-3" /> Ajouter
          </Link>
        ) : null}
      </div>
      {children}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return <div className="p-10 text-center text-xs text-gray-400">{message}</div>
}

function Table({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            {headers.map(h => (
              <th key={h} className="text-left px-4 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-gray-50/50">
              {r.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 text-xs text-gray-700">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded ${className ?? ''}`}>
      {children}
    </span>
  )
}

function JustifLink({ url }: { url: string | null }) {
  if (!url) return <span className="text-gray-300 text-xs">—</span>
  const isPdf = url.toLowerCase().endsWith('.pdf')
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      title="Ouvrir le justificatif"
      className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-900"
    >
      <FileText className="w-4 h-4" />
      <span className="text-[10px] text-gray-400">{isPdf ? 'PDF' : 'Image'}</span>
    </a>
  )
}
