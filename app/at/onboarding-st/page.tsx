'use client'

import { useState, useEffect, useMemo } from 'react'
import { UserCheck, Plus, CheckCircle2, AlertTriangle, ChevronRight, FileText, Shield, Eye, Clipboard, Inbox, Download, ExternalLink, X, XCircle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'
import { Abbr } from '@/components/shared/Abbr'

type ST = {
  id: string; nom: string; siret: string | null; email: string | null; telephone: string | null
  corps_etat: string | null; statut: string; notes: string | null; societe?: string | null
  motif_refus?: string | null; refused_at?: string | null
  dce_acces_id?: string | null
  projet_id?: string | null
  kbis_ok: boolean; kbis_date: string | null
  rib_ok: boolean; attestation_ca_ok: boolean
  urssaf_ok: boolean; urssaf_date: string | null; fiscalite_ok: boolean; salaries_etrangers_ok: boolean
  rc_ok: boolean; rc_validite: string | null; decennale_ok: boolean; decennale_validite: string | null
  created_at: string
}

type DceDoc = {
  id: string
  acces_id: string
  type_doc: string
  nom_fichier: string | null
  url: string | null
  date_validite: string | null
  statut: string | null
  commentaire: string | null
  validated_at: string | null
  validated_by: string | null
  created_at: string
}

type DceRelance = {
  id: string
  acces_id: string
  type_doc: string
  message: string | null
  created_at: string
}

// Mapping type_doc DCE → champ at_sous_traitants
const DOC_TYPE_TO_FIELD: Record<string, string> = {
  kbis: 'kbis_ok',
  urssaf: 'urssaf_ok',
  rib: 'rib_ok',
  attestation_fiscale: 'fiscalite_ok',
  rc_pro: 'rc_ok',
  decennale: 'decennale_ok',
}
const DOC_TYPE_TO_DATE_FIELD: Record<string, string | null> = {
  kbis: 'kbis_date',
  urssaf: 'urssaf_date',
  rc_pro: 'rc_validite',
  decennale: 'decennale_validite',
}
const DOC_TYPE_LABEL: Record<string, string> = {
  kbis: 'Kbis',
  urssaf: 'Attestation URSSAF',
  rib: 'RIB',
  attestation_fiscale: 'Attestation fiscale',
  rc_pro: 'RC Pro',
  decennale: 'Decennale',
  qualification: 'Qualification (RGE/Qualibat...)',
  salaries_etrangers: 'Declaration salaries etrangers',
  attestation_ca: 'Attestation CA',
}

// Liste exhaustive des documents attendus d'un ST (ordre d'importance)
const ALL_DOC_TYPES = [
  'kbis',
  'urssaf',
  'rib',
  'attestation_fiscale',
  'rc_pro',
  'decennale',
  'qualification',
  'salaries_etrangers',
  'attestation_ca',
] as const

type Contrat = {
  id: string; st_id: string; numero: string | null; montant_ht: number | null; statut: string
  cgv_incluses: boolean; delegation_paiement: boolean; second_rang: boolean; second_rang_valide: boolean
}

const CORPS_ETAT = ['Électricité', 'Plomberie', 'CVC', 'Menuiserie', 'Peinture', 'Carrelage', 'Maçonnerie', 'Charpente', 'Couverture', 'VRD', 'Autre']

const CHECKLIST_ADMIN: Array<{ key: string; label: React.ReactNode; section: string }> = [
  { key: 'kbis_ok',             label: <><Abbr k="Kbis" /> (- 3 mois)</>,                  section: 'admin' },
  { key: 'rib_ok',              label: <Abbr k="RIB" />,                                   section: 'admin' },
  { key: 'attestation_ca_ok',   label: <>Attestation <Abbr k="CA" /></>,                    section: 'admin' },
  { key: 'urssaf_ok',           label: <>Attestation <Abbr k="URSSAF" /> (- 6 mois)</>,     section: 'vigilance' },
  { key: 'fiscalite_ok',        label: 'Régularité fiscale',                               section: 'vigilance' },
  { key: 'salaries_etrangers_ok',label: 'Déclaration salariés étrangers',                  section: 'vigilance' },
  { key: 'rc_ok',               label: <><Abbr k="RC Pro" /> valide</>,                    section: 'assurances' },
  { key: 'decennale_ok',        label: 'Garantie décennale valide',                        section: 'assurances' },
]

const SECTIONS_LABEL: Record<string, { label: string; Icon: typeof Clipboard }> = {
  admin:      { label: 'Pieces administratives', Icon: Clipboard },
  vigilance:  { label: 'Vigilance sociale',      Icon: Eye },
  assurances: { label: 'Assurances',             Icon: Shield },
}

function validiteBadge(dateStr: string | null): { label: string; className: string } | null {
  if (!dateStr) return null
  const now = new Date()
  const d = new Date(dateStr)
  const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  if (diff < 0) return { label: 'Expire', className: 'bg-[#FCEBEB] text-[#A32D2D]' }
  if (diff < 30) return { label: `J-${Math.ceil(diff)}`, className: 'bg-[#FAEEDA] text-[#854F0B]' }
  return { label: 'Valide', className: 'bg-[#EAF3DE] text-[#3B6D11]' }
}

// Mapping field -> date field associee
const CHECK_DATE_FIELD: Record<string, string | null> = {
  kbis_ok: 'kbis_date',
  urssaf_ok: 'urssaf_date',
  rc_ok: 'rc_validite',
  decennale_ok: 'decennale_validite',
}

const STATUT_COLOR: Record<string, string> = {
  en_cours:  'bg-blue-50 text-blue-600 border-blue-200',
  complet:   'bg-emerald-50 text-emerald-600 border-emerald-200',
  incomplet: 'bg-amber-50 text-amber-600 border-amber-200',
  expire:    'bg-red-50 text-red-500 border-red-200',
  refuse:    'bg-red-100 text-red-700 border-red-300',
}

function completionScore(st: ST): number {
  return CHECKLIST_ADMIN.filter((c) => st[c.key as keyof ST]).length
}

export default function OnboardingSTPage() {
  const [sts, setSTs]           = useState<ST[]>([])
  const [contrats, setContrats] = useState<Contrat[]>([])
  const [dceDocs, setDceDocs]   = useState<DceDoc[]>([])
  const [dceRelances, setDceRelances] = useState<DceRelance[]>([])
  const [loading, setLoading]   = useState(true)
  const [refuseModal, setRefuseModal] = useState<DceDoc | null>(null)
  const [refuseMotif, setRefuseMotif] = useState('')
  const [refusing, setRefusing] = useState(false)

  // Refus du ST entier
  const [refuseStModal, setRefuseStModal] = useState<ST | null>(null)
  const [refuseStMotif, setRefuseStMotif] = useState('')
  const [refusingSt, setRefusingSt] = useState(false)

  // Relance du ST sur des documents
  const [relanceModal, setRelanceModal] = useState(false)
  const [relanceDocs, setRelanceDocs] = useState<string[]>([])
  const [relanceMessage, setRelanceMessage] = useState('')
  const [relancing, setRelancing] = useState(false)
  const [selected, setSelected] = useState<ST | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showContratForm, setShowContratForm] = useState(false)
  const [filter, setFilter]     = useState('tous')
  const [form, setForm] = useState({ nom: '', siret: '', email: '', telephone: '', corps_etat: '', notes: '' })
  const [formC, setFormC] = useState({ numero: '', montant_ht: '', cgv_incluses: false, delegation_paiement: false, second_rang: false })
  const [submitting, setSubmitting] = useState(false)

  async function fetchData() {
    const supabase = createClient()
    const [stRes, cRes] = await Promise.all([
      supabase.schema('app').from('at_sous_traitants').select('*').order('created_at', { ascending: false }),
      supabase.schema('app').from('at_contrats').select('*'),
    ])
    setSTs((stRes.data ?? []) as ST[])
    setContrats((cRes.data ?? []) as Contrat[])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  // Charge les docs DCE pour le ST selectionne (s'il a un dce_acces_id)
  useEffect(() => {
    fetchDceDocs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.dce_acces_id])

  async function fetchDceDocs() {
    if (!selected?.dce_acces_id) { setDceDocs([]); setDceRelances([]); return }
    const supabase = createClient()
    const [{ data: docs }, { data: relances }] = await Promise.all([
      supabase.from('dce_docs_st')
        .select('*')
        .eq('acces_id', selected.dce_acces_id)
        .order('created_at', { ascending: false }),
      supabase.from('dce_relances' as never)
        .select('*')
        .eq('acces_id', selected.dce_acces_id)
        .order('created_at', { ascending: false }),
    ])
    setDceDocs((docs ?? []) as DceDoc[])
    setDceRelances((relances ?? []) as unknown as DceRelance[])
  }

  // Compteur de relances par type_doc + derniere date
  const relancesByType = useMemo(() => {
    const m = new Map<string, { count: number; last: string | null }>()
    for (const r of dceRelances) {
      const cur = m.get(r.type_doc) ?? { count: 0, last: null }
      cur.count += 1
      if (!cur.last || r.created_at > cur.last) cur.last = r.created_at
      m.set(r.type_doc, cur)
    }
    return m
  }, [dceRelances])

  // Pour chaque type, savoir si une relance a eu lieu APRES le dernier depot/validation du doc
  function isPendingRelance(typeDoc: string, doc: DceDoc | null | undefined): boolean {
    const r = relancesByType.get(typeDoc)
    if (!r?.last) return false
    if (!doc) return true // pas de doc transmis -> relance toujours pendante
    const lastTouch = doc.validated_at ?? doc.created_at
    return r.last > lastTouch
  }

  async function validerDocDepuisDce(doc: DceDoc) {
    if (!selected) return
    const supabase = createClient()
    // Mettre a jour le statut du doc
    await supabase.from('dce_docs_st' as never)
      .update({ statut: 'valide', commentaire: null, validated_at: new Date().toISOString() } as never)
      .eq('id', doc.id)
    // Reporter sur la fiche AT si le type est mappe
    const field = DOC_TYPE_TO_FIELD[doc.type_doc]
    if (field) {
      const dateField = DOC_TYPE_TO_DATE_FIELD[doc.type_doc] ?? null
      const patch: Record<string, unknown> = { [field]: true }
      if (dateField && doc.date_validite) patch[dateField] = doc.date_validite
      await supabase.schema('app').from('at_sous_traitants').update(patch).eq('id', selected.id)
      setSelected(s => s ? { ...s, ...patch } as ST : null)
    }
    await fetchDceDocs()
    fetchData()
  }

  async function refuserDoc() {
    if (!selected || !refuseModal) return
    if (!refuseMotif.trim()) return
    setRefusing(true)
    const supabase = createClient()
    await supabase.from('dce_docs_st' as never)
      .update({ statut: 'refuse', commentaire: refuseMotif.trim(), validated_at: new Date().toISOString() } as never)
      .eq('id', refuseModal.id)
    // Decoche le flag AT correspondant si applicable
    const field = DOC_TYPE_TO_FIELD[refuseModal.type_doc]
    if (field) {
      await supabase.schema('app').from('at_sous_traitants').update({ [field]: false }).eq('id', selected.id)
      setSelected(s => s ? { ...s, [field]: false } as ST : null)
    }
    // Notifier le ST si on a son user_id
    if (selected.dce_acces_id) {
      const { data: accesData } = await supabase.from('dce_acces_st' as never).select('user_id, st_nom, st_email').eq('id', selected.dce_acces_id).maybeSingle()
      const acces = accesData as unknown as { user_id: string | null; st_nom: string | null; st_email: string | null } | null
      if (acces?.user_id) {
        await supabase.schema('app').from('alertes').insert({
          utilisateur_id: acces.user_id,
          projet_id:      selected.projet_id ?? null,
          type:           'document_refuse',
          titre:          `Document refuse : ${DOC_TYPE_LABEL[refuseModal.type_doc] ?? refuseModal.type_doc}`,
          message:        `Motif : ${refuseMotif.trim()}. Merci de redeposer un document conforme.`,
          priorite:       'high',
          lue:            false,
        })
      }
    }
    setRefusing(false)
    setRefuseModal(null)
    setRefuseMotif('')
    await fetchDceDocs()
    fetchData()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nom) return
    setSubmitting(true)
    const supabase = createClient()
    await supabase.schema('app').from('at_sous_traitants').insert({ ...form, corps_etat: form.corps_etat || null, statut: 'en_cours' })
    setForm({ nom: '', siret: '', email: '', telephone: '', corps_etat: '', notes: '' })
    setShowForm(false)
    setSubmitting(false)
    fetchData()
  }

  async function toggleCheck(id: string, field: string, current: boolean) {
    const supabase = createClient()
    await supabase.schema('app').from('at_sous_traitants').update({ [field]: !current }).eq('id', id)
    setSelected((s) => s ? { ...s, [field]: !current } : null)
    fetchData()
  }

  async function handleContrat(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    setSubmitting(true)
    const supabase = createClient()
    await supabase.schema('app').from('at_contrats').insert({
      st_id: selected.id, numero: formC.numero || null,
      montant_ht: formC.montant_ht ? Number(formC.montant_ht) : null,
      cgv_incluses: formC.cgv_incluses, delegation_paiement: formC.delegation_paiement,
      second_rang: formC.second_rang, statut: 'brouillon',
    })
    setFormC({ numero: '', montant_ht: '', cgv_incluses: false, delegation_paiement: false, second_rang: false })
    setShowContratForm(false)
    setSubmitting(false)
    fetchData()
  }

  async function updateContratStatut(id: string, statut: string) {
    const supabase = createClient()
    await supabase.schema('app').from('at_contrats').update({ statut, ...(statut === 'signe' ? { date_signature: new Date().toISOString().split('T')[0] } : {}) }).eq('id', id)
    fetchData()
  }

  async function markComplet(id: string) {
    const supabase = createClient()
    await supabase.schema('app').from('at_sous_traitants').update({
      statut: 'complet',
      motif_refus: null,
      refused_at: null,
    }).eq('id', id)
    setSelected(null)
    fetchData()
  }

  async function validerST(st: ST) {
    const supabase = createClient()
    const score = CHECKLIST_ADMIN.filter(c => Boolean((st as unknown as Record<string, boolean>)[c.key])).length
    if (score < CHECKLIST_ADMIN.length) {
      const ok = confirm(
        `Attention : ${score}/${CHECKLIST_ADMIN.length} pieces validees.\n\n` +
        `Si tu valides ce ST sans toutes les pieces, l'economiste pourra le retenir mais le dossier reste partiellement non conforme.\n\n` +
        `Continuer la validation ?`
      )
      if (!ok) return
    }
    await supabase.schema('app').from('at_sous_traitants').update({
      statut: 'complet',
      motif_refus: null,
      refused_at: null,
      validation_date: new Date().toISOString(),
    }).eq('id', st.id)
    // Notifier le ST
    if (st.dce_acces_id) {
      const { data: accesData } = await supabase.from('dce_acces_st' as never)
        .select('user_id').eq('id', st.dce_acces_id).maybeSingle()
      const acces = accesData as unknown as { user_id: string | null } | null
      if (acces?.user_id) {
        await supabase.schema('app').from('alertes').insert({
          utilisateur_id: acces.user_id,
          projet_id:      st.projet_id ?? null,
          type:           'st_valide',
          titre:          `Votre dossier sous-traitant a ete valide`,
          message:        `Votre dossier administratif est complet. Vous pouvez etre retenu sur ce projet.`,
          priorite:       'normal',
          lue:            false,
        })
      }
    }
    setSelected(s => s ? { ...s, statut: 'complet', motif_refus: null, refused_at: null } as ST : null)
    fetchData()
  }

  async function refuserST() {
    if (!refuseStModal) return
    if (!refuseStMotif.trim()) return
    setRefusingSt(true)
    const supabase = createClient()
    await supabase.schema('app').from('at_sous_traitants').update({
      statut: 'refuse',
      motif_refus: refuseStMotif.trim(),
      refused_at: new Date().toISOString(),
    }).eq('id', refuseStModal.id)

    // Notifier le ST si dispo via dce_acces_id
    if (refuseStModal.dce_acces_id) {
      const { data: accesData } = await supabase.from('dce_acces_st' as never)
        .select('user_id, st_email, st_nom').eq('id', refuseStModal.dce_acces_id).maybeSingle()
      const acces = accesData as unknown as { user_id: string | null; st_email: string | null; st_nom: string | null } | null
      if (acces?.user_id) {
        await supabase.schema('app').from('alertes').insert({
          utilisateur_id: acces.user_id,
          projet_id:      refuseStModal.projet_id ?? null,
          type:           'st_refuse',
          titre:          `Votre dossier sous-traitant a ete refuse`,
          message:        `Motif : ${refuseStMotif.trim()}`,
          priorite:       'high',
          lue:            false,
        })
      }
    }
    setRefusingSt(false)
    setRefuseStModal(null)
    setRefuseStMotif('')
    setSelected(s => s ? { ...s, statut: 'refuse', motif_refus: refuseStMotif.trim(), refused_at: new Date().toISOString() } as ST : null)
    fetchData()
  }

  async function envoyerRelance() {
    if (!selected || !selected.dce_acces_id || relanceDocs.length === 0) return
    setRelancing(true)
    const supabase = createClient()
    const labels = relanceDocs.map(t => DOC_TYPE_LABEL[t] ?? t).join(', ')

    // 1. Tracer les relances en base (1 ligne par type_doc)
    const msgClean = relanceMessage.trim() || null
    const relancesPayload = relanceDocs.map(type => ({
      acces_id: selected.dce_acces_id,
      type_doc: type,
      message: msgClean,
    }))
    await supabase.from('dce_relances' as never).insert(relancesPayload as never)

    // 2. Notification au ST
    const { data: accesData } = await supabase.from('dce_acces_st' as never)
      .select('user_id').eq('id', selected.dce_acces_id).maybeSingle()
    const acces = accesData as unknown as { user_id: string | null } | null
    const userId = acces?.user_id ?? null
    if (userId) {
      const msg = msgClean
        ? `${msgClean}\n\nDocuments demandes : ${labels}`
        : `Merci de deposer / mettre a jour les documents suivants : ${labels}`
      await supabase.schema('app').from('alertes').insert({
        utilisateur_id: userId,
        projet_id:      selected.projet_id ?? null,
        type:           'document_relance',
        titre:          `Relance documents (${relanceDocs.length})`,
        message:        msg,
        priorite:       'high',
        lue:            false,
      })
    }
    setRelancing(false)
    setRelanceModal(false)
    setRelanceDocs([])
    setRelanceMessage('')
    fetchDceDocs()
  }

  async function reactiverST(id: string) {
    const supabase = createClient()
    await supabase.schema('app').from('at_sous_traitants').update({
      statut: 'en_cours',
      motif_refus: null,
      refused_at: null,
    }).eq('id', id)
    setSelected(s => s ? { ...s, statut: 'en_cours', motif_refus: null, refused_at: null } as ST : null)
    fetchData()
  }

  const filtered = filter === 'tous' ? sts : sts.filter((s) => s.statut === filter)
  const selectedFull = selected ? sts.find((s) => s.id === selected.id) ?? selected : null
  const contratsST = selectedFull ? contrats.filter((c) => c.st_id === selectedFull.id) : []

  const grouped = ['admin', 'vigilance', 'assurances'].map((sec) => ({
    section: sec,
    fields: CHECKLIST_ADMIN.filter((c) => c.section === sec),
  }))

  return (
    <div>
      <TopBar title={<>Onboarding <Abbr k="ST" /></>} subtitle="Dossiers administratifs, assurances & contrats" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {([
            { label: 'En cours',                       count: sts.filter((s) => s.statut === 'en_cours').length,  color: 'text-blue-600' },
            { label: 'Complets',                       count: sts.filter((s) => s.statut === 'complet').length,   color: 'text-emerald-600' },
            { label: 'Incomplets',                     count: sts.filter((s) => s.statut === 'incomplet').length, color: 'text-amber-600' },
            { label: 'Refuses',                        count: sts.filter((s) => s.statut === 'refuse').length,    color: 'text-red-600' },
          ] as Array<{ label: React.ReactNode; count: number; color: string }>).map((s, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{s.label}</p>
              <p className={`text-2xl font-semibold ${s.color}`}>{s.count}</p>
            </div>
          ))}
        </div>

        {/* Filtres + bouton */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            {[
              { value: 'tous',      label: 'Tous' },
              { value: 'en_cours',  label: 'En cours' },
              { value: 'complet',   label: 'Complets' },
              { value: 'incomplet', label: 'Incomplets' },
              { value: 'refuse',    label: 'Refuses' },
            ].map((f) => (
              <button key={f.value} onClick={() => setFilter(f.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filter === f.value ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                {f.label}
              </button>
            ))}
          </div>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors">
            <Plus className="w-4 h-4" /> Nouveau <Abbr k="ST" />
          </button>
        </div>

        {/* Formulaire ST */}
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 shadow-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-orange-500" /> Nouveau sous-traitant
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="col-span-2 lg:col-span-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Raison sociale *</label>
                <input type="text" value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1"><Abbr k="SIRET" /></label>
                <input type="text" value={form.siret} onChange={(e) => setForm((f) => ({ ...f, siret: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Corps d&apos;état</label>
                <select value={form.corps_etat} onChange={(e) => setForm((f) => ({ ...f, corps_etat: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                  <option value="">Sélectionner...</option>
                  {CORPS_ETAT.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Téléphone</label>
                <input type="tel" value={form.telephone} onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
              <button type="submit" disabled={submitting || !form.nom}
                className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50">
                {submitting ? 'Enregistrement...' : 'Créer'}
              </button>
            </div>
          </form>
        )}

        {/* Liste + détail */}
        {loading ? (
          <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-16 bg-white rounded-lg border border-gray-200 animate-pulse" />)}</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Liste */}
            <div className="lg:col-span-2 space-y-2">
              {filtered.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 shadow-card p-10 text-center">
                  <UserCheck className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-700">Aucun <Abbr k="ST" /></p>
                </div>
              ) : filtered.map((s) => {
                const score = completionScore(s)
                const s_info = STATUT_COLOR[s.statut]
                return (
                  <button key={s.id} onClick={() => setSelected(selectedFull?.id === s.id ? null : s)}
                    className={`w-full text-left bg-white rounded-lg border shadow-card p-4 transition-colors ${selectedFull?.id === s.id ? 'border-gray-900' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-xs font-semibold text-orange-600 flex-shrink-0">{s.nom[0]}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{s.nom}</p>
                        <p className="text-xs text-gray-400">{s.corps_etat ?? '—'}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${s_info}`}>
                          {s.statut === 'en_cours' ? 'En cours' : s.statut === 'complet' ? 'Complet' : s.statut === 'incomplet' ? 'Incomplet' : 'Expiré'}
                        </span>
                        <span className="text-xs text-gray-400">{score}/{CHECKLIST_ADMIN.length}</span>
                      </div>
                    </div>
                    <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(score / CHECKLIST_ADMIN.length) * 100}%` }} />
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Détail */}
            {selectedFull && (
              <div className="lg:col-span-3 space-y-4">
                {/* Info ST */}
                <div className="bg-white rounded-lg border border-gray-200 shadow-card p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-base font-semibold text-gray-900">{selectedFull.nom}</p>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${STATUT_COLOR[selectedFull.statut] ?? 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                          {selectedFull.statut === 'refuse' && <XCircle className="w-3 h-3" />}
                          {selectedFull.statut === 'complet' && <CheckCircle2 className="w-3 h-3" />}
                          {selectedFull.statut}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">{selectedFull.corps_etat ?? '—'}{selectedFull.siret ? <> · <Abbr k="SIRET" />: {selectedFull.siret}</> : ''}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {selectedFull.dce_acces_id && selectedFull.statut !== 'refuse' && (
                        <button
                          onClick={() => { setRelanceDocs([]); setRelanceMessage(''); setRelanceModal(true) }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-amber-700 border border-amber-300 rounded-lg hover:bg-amber-50">
                          <AlertTriangle className="w-3.5 h-3.5" /> Relancer
                        </button>
                      )}
                      {selectedFull.statut !== 'complet' && selectedFull.statut !== 'refuse' && (
                        <button
                          onClick={() => validerST(selectedFull)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Valider le ST
                        </button>
                      )}
                      {selectedFull.statut === 'complet' && (
                        <button
                          onClick={() => reactiverST(selectedFull.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                          title="Reouvrir le dossier (passe en 'en cours')">
                          <ChevronRight className="w-3.5 h-3.5 rotate-180" /> Reouvrir
                        </button>
                      )}
                      {selectedFull.statut !== 'refuse' && (
                        <button
                          onClick={() => { setRefuseStModal(selectedFull); setRefuseStMotif('') }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-700 border border-red-300 rounded-lg hover:bg-red-50">
                          <XCircle className="w-3.5 h-3.5" /> Refuser le ST
                        </button>
                      )}
                      {selectedFull.statut === 'refuse' && (
                        <button
                          onClick={() => reactiverST(selectedFull.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-50">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Reactiver
                        </button>
                      )}
                      <button onClick={() => setSelected(null)} className="text-gray-300 hover:text-gray-600 text-lg ml-1">×</button>
                    </div>
                  </div>

                  {/* Bandeau ST valide */}
                  {selectedFull.statut === 'complet' && (
                    <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-emerald-700">Sous-traitant valide</p>
                        <p className="text-xs text-emerald-700 mt-0.5">L&apos;economiste peut desormais retenir ce ST sur ses lots.</p>
                      </div>
                    </div>
                  )}

                  {/* Bandeau ST refuse */}
                  {selectedFull.statut === 'refuse' && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <XCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-red-700">Sous-traitant refuse</p>
                          {selectedFull.motif_refus && (
                            <p className="text-xs text-red-700 mt-0.5"><span className="font-medium">Motif : </span>{selectedFull.motif_refus}</p>
                          )}
                          {selectedFull.refused_at && (
                            <p className="text-[10px] text-red-500 mt-0.5">Refuse le {new Date(selectedFull.refused_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Checklist par section */}
                  {grouped.map(({ section, fields }) => {
                    const SecIcon = SECTIONS_LABEL[section].Icon
                    return (
                      <div key={section} className="mb-4">
                        <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
                          <SecIcon className="w-3.5 h-3.5 text-gray-400" />
                          {SECTIONS_LABEL[section].label}
                        </p>
                        <div className="space-y-2">
                          {fields.map((f) => {
                            const val = selectedFull[f.key as keyof ST] as boolean
                            const dateField = CHECK_DATE_FIELD[f.key]
                            const dateVal = dateField ? (selectedFull[dateField as keyof ST] as string | null) : null
                            const badge = dateVal ? validiteBadge(dateVal) : null
                            return (
                              <div key={f.key} className="flex items-center gap-3">
                                <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                                  <input type="checkbox" checked={val}
                                    onChange={() => toggleCheck(selectedFull.id, f.key, val)}
                                    className="w-4 h-4 rounded border-gray-300 text-gray-900" />
                                  <span className={`text-sm ${val ? 'line-through text-gray-400' : 'text-gray-700'}`}>{f.label}</span>
                                </label>
                                {dateField && val && (
                                  <input type="date" value={dateVal ?? ''}
                                    onChange={async (e) => {
                                      const supabase = createClient()
                                      await supabase.schema('app').from('at_sous_traitants').update({ [dateField]: e.target.value || null }).eq('id', selectedFull.id)
                                      setSelected((s) => s ? ({ ...s, [dateField]: e.target.value || null }) as ST : null)
                                      fetchData()
                                    }}
                                    className="text-xs border border-gray-200 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-gray-900/10 w-32" />
                                )}
                                {badge && (
                                  <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full ${badge.className}`}>
                                    {badge.label}
                                  </span>
                                )}
                                {val && !badge && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}

                  {selectedFull.statut === 'en_cours' && completionScore(selectedFull) === CHECKLIST_ADMIN.length && (
                    <button onClick={() => markComplet(selectedFull.id)}
                      className="w-full py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Dossier complet — valider
                    </button>
                  )}
                </div>

                {/* Documents transmis via DCE */}
                {selectedFull.dce_acces_id && (
                  <div className="bg-white rounded-lg border border-gray-200 shadow-card p-5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                        <Inbox className="w-3.5 h-3.5 text-orange-500" />
                        Documents transmis via <Abbr k="DCE" />
                        <span className="text-xs text-gray-400 font-normal">({dceDocs.length})</span>
                      </p>
                    </div>
                    {dceDocs.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">Aucun document soumis via le DCE.</p>
                    ) : (
                      <div className="space-y-2">
                        {dceDocs.map(doc => {
                          const label = DOC_TYPE_LABEL[doc.type_doc] ?? doc.type_doc
                          const validite = doc.date_validite ? validiteBadge(doc.date_validite) : null
                          const isValide = doc.statut === 'valide'
                          const isRefuse = doc.statut === 'refuse'
                          const relanceInfo = relancesByType.get(doc.type_doc)
                          const isRelancePending = isPendingRelance(doc.type_doc, doc)
                          const cardCls = isRefuse
                            ? 'bg-red-50 border-red-200'
                            : isValide
                            ? 'bg-emerald-50 border-emerald-200'
                            : isRelancePending
                            ? 'bg-amber-50 border-amber-200'
                            : 'bg-gray-50 border-gray-100'
                          return (
                            <div key={doc.id} className={`p-2.5 rounded-lg border ${cardCls}`}>
                              <div className="flex items-center gap-3">
                                <FileText className={`w-4 h-4 flex-shrink-0 ${isRefuse ? 'text-red-500' : isValide ? 'text-emerald-600' : isRelancePending ? 'text-amber-600' : 'text-gray-400'}`} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-800 truncate">
                                    {isRelancePending && (
                                      <span className="mr-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-200 text-amber-900"
                                        title={`Relance${(relanceInfo?.count ?? 0) > 1 ? `e ${relanceInfo?.count} fois` : 'e'} le ${relanceInfo?.last ? new Date(relanceInfo.last).toLocaleDateString('fr-FR') : ''}`}>
                                        <AlertTriangle className="w-2.5 h-2.5" />
                                        Relance{(relanceInfo?.count ?? 0) > 1 ? ` ×${relanceInfo?.count}` : ''}
                                      </span>
                                    )}
                                    {label}
                                    {validite && <span className={`ml-2 inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded-full ${validite.className}`}>{validite.label}</span>}
                                    {isValide && <span className="ml-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 className="w-2.5 h-2.5" /> Valide</span>}
                                    {isRefuse && <span className="ml-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-red-100 text-red-700"><XCircle className="w-2.5 h-2.5" /> Refuse</span>}
                                  </p>
                                  <p className="text-xs text-gray-500 truncate">{doc.nom_fichier ?? '—'}</p>
                                </div>
                                {doc.url && (
                                  <a href={doc.url} target="_blank" rel="noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded">
                                    <ExternalLink className="w-3 h-3" /> Voir
                                  </a>
                                )}
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {!isValide && (
                                    <button onClick={() => validerDocDepuisDce(doc)}
                                      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-white bg-emerald-600 hover:bg-emerald-700 rounded">
                                      <CheckCircle2 className="w-3 h-3" /> Valider
                                    </button>
                                  )}
                                  {!isRefuse && (
                                    <button onClick={() => { setRefuseModal(doc); setRefuseMotif(doc.commentaire ?? '') }}
                                      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-700 border border-red-200 hover:bg-red-50 rounded">
                                      <XCircle className="w-3 h-3" /> Refuser
                                    </button>
                                  )}
                                </div>
                              </div>
                              {isRefuse && doc.commentaire && (
                                <div className="mt-2 ml-7 p-2 bg-red-100/50 border border-red-200 rounded text-xs text-red-800">
                                  <span className="font-semibold">Motif du refus : </span>{doc.commentaire}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Contrats */}
                <div className="bg-white rounded-lg border border-gray-200 shadow-card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-gray-400" /> Contrats</p>
                    <button onClick={() => setShowContratForm(!showContratForm)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-800">
                      <Plus className="w-3 h-3" /> Nouveau contrat
                    </button>
                  </div>

                  {showContratForm && (
                    <form onSubmit={handleContrat} className="bg-gray-50 rounded-lg p-4 space-y-3 mb-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">N° contrat</label>
                          <input type="text" value={formC.numero} onChange={(e) => setFormC((f) => ({ ...f, numero: e.target.value }))}
                            className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Montant <Abbr k="HT" /> (€)</label>
                          <input type="number" value={formC.montant_ht} onChange={(e) => setFormC((f) => ({ ...f, montant_ht: e.target.value }))}
                            className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        {([
                          { key: 'cgv_incluses', label: <><Abbr k="CGV" /> incluses</> },
                          { key: 'delegation_paiement', label: 'Délégation de paiement' },
                          { key: 'second_rang', label: 'Sous-traitance 2nd rang' },
                        ] as Array<{ key: string; label: React.ReactNode }>).map((opt) => (
                          <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={formC[opt.key as keyof typeof formC] as boolean}
                              onChange={(e) => setFormC((f) => ({ ...f, [opt.key]: e.target.checked }))}
                              className="w-4 h-4 rounded border-gray-300" />
                            <span className="text-xs text-gray-600">{opt.label}</span>
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button type="button" onClick={() => setShowContratForm(false)} className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900">Annuler</button>
                        <button type="submit" disabled={submitting}
                          className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg hover:bg-gray-800 disabled:opacity-50">
                          Créer
                        </button>
                      </div>
                    </form>
                  )}

                  {contratsST.length === 0 ? (
                    <p className="text-xs text-gray-400">Aucun contrat</p>
                  ) : (
                    <div className="space-y-2">
                      {contratsST.map((c) => (
                        <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                          <div>
                            <p className="text-xs font-medium text-gray-800">
                              {c.numero ?? 'Sans numéro'}
                              {c.montant_ht ? <> — {c.montant_ht.toLocaleString('fr-FR')} € <Abbr k="HT" /></> : ''}
                            </p>
                            <p className="text-xs text-gray-400">
                              {c.cgv_incluses ? <><Abbr k="CGV" /> · </> : ''}{c.delegation_paiement ? 'Délégation · ' : ''}{c.second_rang ? '2nd rang' : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${c.statut === 'signe' ? 'bg-emerald-50 text-emerald-600' : c.statut === 'envoye' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                              {c.statut === 'signe' && <CheckCircle2 className="w-3 h-3" />}
                              {c.statut === 'signe' ? 'Signe' : c.statut === 'envoye' ? 'Envoye' : 'Brouillon'}
                            </span>
                            {c.statut === 'brouillon' && (
                              <button onClick={() => updateContratStatut(c.id, 'envoye')} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100">
                                <ChevronRight className="w-3 h-3" /> Envoyer
                              </button>
                            )}
                            {c.statut === 'envoye' && (
                              <button onClick={() => updateContratStatut(c.id, 'signe')} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-emerald-50 text-emerald-600 border border-emerald-200 rounded hover:bg-emerald-100">
                                <CheckCircle2 className="w-3 h-3" /> Signe
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modale refus du ST entier */}
      {refuseStModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  Refuser ce sous-traitant
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">{refuseStModal.nom}</p>
              </div>
              <button onClick={() => { setRefuseStModal(null); setRefuseStMotif('') }} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  Le ST sera marque comme <strong>refuse</strong>. L&apos;economiste ne pourra plus le retenir dans le comparatif. Le ST sera notifie avec le motif.
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Motif du refus *</label>
                <textarea value={refuseStMotif} onChange={(e) => setRefuseStMotif(e.target.value)}
                  rows={4}
                  placeholder="Ex: Documents administratifs incomplets, assurances expirees, references insuffisantes..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none placeholder-gray-300" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setRefuseStMotif("Documents administratifs incomplets ou non conformes apres relance.")}
                  className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 text-left">
                  Docs incomplets
                </button>
                <button onClick={() => setRefuseStMotif("Assurances obligatoires manquantes ou expirees (RC Pro / Decennale).")}
                  className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 text-left">
                  Assurances KO
                </button>
                <button onClick={() => setRefuseStMotif("URSSAF / fiscalite non a jour. Vigilance sociale non levee.")}
                  className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 text-left">
                  Vigilance sociale
                </button>
                <button onClick={() => setRefuseStMotif("Pas de retour du ST apres plusieurs relances.")}
                  className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 text-left">
                  Sans reponse
                </button>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => { setRefuseStModal(null); setRefuseStMotif('') }}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
              <button onClick={refuserST} disabled={refusingSt || !refuseStMotif.trim()}
                className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40">
                {refusingSt ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                Refuser le ST
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale relance documents */}
      {relanceModal && selectedFull && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Relancer le ST
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Selectionne les documents a redeposer ou mettre a jour</p>
              </div>
              <button onClick={() => { setRelanceModal(false); setRelanceDocs([]) }} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              {(() => {
                // Construit la liste unifiee : doc transmis (dceDoc) ou attendu mais absent
                const docsByType = new Map<string, DceDoc>()
                for (const d of dceDocs) docsByType.set(d.type_doc, d)
                const items = ALL_DOC_TYPES.map(type => ({
                  type,
                  doc: docsByType.get(type) ?? null,
                  label: DOC_TYPE_LABEL[type] ?? type,
                }))
                const nbTransmis = items.filter(i => i.doc).length
                const nbNonTransmis = items.length - nbTransmis
                return (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-gray-600">Documents concernes ({relanceDocs.length})</label>
                      <div className="flex gap-1 flex-wrap">
                        <button onClick={() => setRelanceDocs(items.filter(i => !i.doc).map(i => i.type))}
                          className="text-xs px-2 py-0.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50"
                          title="Selectionne uniquement les documents jamais transmis">
                          Non transmis ({nbNonTransmis})
                        </button>
                        <button onClick={() => setRelanceDocs(items.filter(i => !i.doc || i.doc.statut !== 'valide').map(i => i.type))}
                          className="text-xs px-2 py-0.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">
                          Tous non valides
                        </button>
                        <button onClick={() => setRelanceDocs([])}
                          className="text-xs px-2 py-0.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">
                          Aucun
                        </button>
                      </div>
                    </div>
                    <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto divide-y divide-gray-100">
                      {items.map(({ type, doc, label }) => {
                        const checked = relanceDocs.includes(type)
                        const validite = doc?.date_validite ? validiteBadge(doc.date_validite) : null
                        const statutLabel = !doc
                          ? { text: 'Non transmis', cls: 'bg-gray-100 text-gray-600' }
                          : doc.statut === 'valide' ? { text: 'Valide', cls: 'bg-emerald-50 text-emerald-700' }
                          : doc.statut === 'refuse' ? { text: 'Refuse', cls: 'bg-red-50 text-red-700' }
                          : doc.statut === 'expire' ? { text: 'Expire', cls: 'bg-red-50 text-red-700' }
                          : { text: 'Depose', cls: 'bg-blue-50 text-blue-700' }
                        const relanceInfo = relancesByType.get(type)
                        const isRelancePending = isPendingRelance(type, doc)
                        return (
                          <label key={type} className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer ${checked ? 'bg-amber-50' : 'hover:bg-gray-50'}`}>
                            <input type="checkbox" checked={checked}
                              onChange={() => setRelanceDocs(prev => checked ? prev.filter(t => t !== type) : [...prev, type])}
                              className="w-4 h-4 rounded border-gray-300 text-amber-600" />
                            <span className={`text-sm flex-1 ${doc ? 'text-gray-800' : 'text-gray-700 font-medium'}`}>
                              {isRelancePending && (
                                <span className="mr-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-200 text-amber-900"
                                  title={`Relance${(relanceInfo?.count ?? 0) > 1 ? `e ${relanceInfo?.count} fois` : 'e'} le ${relanceInfo?.last ? new Date(relanceInfo.last).toLocaleDateString('fr-FR') : ''}`}>
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  Relance{(relanceInfo?.count ?? 0) > 1 ? ` ×${relanceInfo?.count}` : ''}
                                </span>
                              )}
                              {label}
                              {doc?.nom_fichier && <span className="ml-2 text-[10px] text-gray-400 font-normal">{doc.nom_fichier}</span>}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${statutLabel.cls}`}>{statutLabel.text}</span>
                            {validite && <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded-full ${validite.className}`}>{validite.label}</span>}
                          </label>
                        )
                      })}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">
                      {nbNonTransmis > 0 ? `${nbNonTransmis} document${nbNonTransmis > 1 ? 's' : ''} jamais transmis. ` : ''}
                      Tu peux aussi cocher des documents valides s&apos;ils sont expires.
                    </p>
                  </div>
                )
              })()}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Message (optionnel)</label>
                <textarea value={relanceMessage} onChange={(e) => setRelanceMessage(e.target.value)}
                  rows={3}
                  placeholder="Precisions ou demande specifique : echeance, format attendu, etc."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none placeholder-gray-300" />
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2 sticky bottom-0 bg-white">
              <button onClick={() => { setRelanceModal(false); setRelanceDocs([]); setRelanceMessage('') }}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
              <button onClick={envoyerRelance} disabled={relancing || relanceDocs.length === 0}
                className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-40">
                {relancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                Envoyer la relance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale refus de document */}
      {refuseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  Refuser le document
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">{DOC_TYPE_LABEL[refuseModal.type_doc] ?? refuseModal.type_doc}{refuseModal.nom_fichier ? ` — ${refuseModal.nom_fichier}` : ''}</p>
              </div>
              <button onClick={() => { setRefuseModal(null); setRefuseMotif('') }} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-gray-500">Indique le motif du refus : document manquant, illisible, expire, mauvais format, etc. Le ST sera notifie pour redeposer un document conforme.</p>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Motif du refus *</label>
                <textarea value={refuseMotif} onChange={(e) => setRefuseMotif(e.target.value)}
                  rows={4}
                  placeholder="Ex: Le Kbis fourni date de plus de 3 mois, merci de redeposer un document recent."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none placeholder-gray-300" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setRefuseMotif("Document expire ou hors delai. Merci de redeposer un document a jour.")}
                  className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 text-left">
                  Document expire
                </button>
                <button onClick={() => setRefuseMotif("Document illisible ou de mauvaise qualite. Merci de redeposer un scan plus net.")}
                  className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 text-left">
                  Illisible
                </button>
                <button onClick={() => setRefuseMotif("Mauvais type de document. Merci de redeposer le document demande.")}
                  className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 text-left">
                  Mauvais doc
                </button>
                <button onClick={() => setRefuseMotif("Informations incompletes ou manquantes sur le document.")}
                  className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 text-left">
                  Incomplet
                </button>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => { setRefuseModal(null); setRefuseMotif('') }}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
              <button onClick={refuserDoc} disabled={refusing || !refuseMotif.trim()}
                className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40">
                {refusing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                Refuser et notifier le ST
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
