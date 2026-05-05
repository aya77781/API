'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  X, CheckCircle2, XCircle, AlertTriangle, ChevronRight, FileText, Shield, Eye,
  Clipboard, Inbox, ExternalLink, Loader2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
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

const DOC_TYPE_TO_FIELD: Record<string, string> = {
  kbis: 'kbis_ok', urssaf: 'urssaf_ok', rib: 'rib_ok',
  attestation_fiscale: 'fiscalite_ok', rc_pro: 'rc_ok', decennale: 'decennale_ok',
}
const DOC_TYPE_TO_DATE_FIELD: Record<string, string | null> = {
  kbis: 'kbis_date', urssaf: 'urssaf_date', rc_pro: 'rc_validite', decennale: 'decennale_validite',
}
const DOC_TYPE_LABEL: Record<string, string> = {
  kbis: 'Kbis', urssaf: 'Attestation URSSAF', rib: 'RIB',
  attestation_fiscale: 'Attestation fiscale', rc_pro: 'RC Pro', decennale: 'Decennale',
  qualification: 'Qualification (RGE/Qualibat...)', salaries_etrangers: 'Declaration salaries etrangers',
  attestation_ca: 'Attestation CA',
}
const ALL_DOC_TYPES = [
  'kbis', 'urssaf', 'rib', 'attestation_fiscale', 'rc_pro', 'decennale',
  'qualification', 'salaries_etrangers', 'attestation_ca',
] as const

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

const CHECK_DATE_FIELD: Record<string, string | null> = {
  kbis_ok: 'kbis_date', urssaf_ok: 'urssaf_date',
  rc_ok: 'rc_validite', decennale_ok: 'decennale_validite',
}

const STATUT_COLOR: Record<string, string> = {
  en_cours:  'bg-blue-50 text-blue-600 border-blue-200',
  complet:   'bg-emerald-50 text-emerald-600 border-emerald-200',
  incomplet: 'bg-amber-50 text-amber-600 border-amber-200',
  expire:    'bg-red-50 text-red-500 border-red-200',
  refuse:    'bg-red-100 text-red-700 border-red-300',
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

function completionScore(st: ST): number {
  return CHECKLIST_ADMIN.filter((c) => st[c.key as keyof ST]).length
}

export function STValidationDrawer({
  stId, onClose, onChange,
}: { stId: string | null; onClose: () => void; onChange?: () => void }) {
  const [st, setSt]                 = useState<ST | null>(null)
  const [loading, setLoading]       = useState(false)
  const [dceDocs, setDceDocs]       = useState<DceDoc[]>([])
  const [dceRelances, setDceRelances] = useState<DceRelance[]>([])

  // Modales
  const [refuseModal, setRefuseModal] = useState<DceDoc | null>(null)
  const [refuseMotif, setRefuseMotif] = useState('')
  const [refusing, setRefusing]       = useState(false)

  const [refuseStOpen, setRefuseStOpen] = useState(false)
  const [refuseStMotif, setRefuseStMotif] = useState('')
  const [refusingSt, setRefusingSt]     = useState(false)

  const [relanceOpen, setRelanceOpen] = useState(false)
  const [relanceDocs, setRelanceDocs] = useState<string[]>([])
  const [relanceMessage, setRelanceMessage] = useState('')
  const [relancing, setRelancing]     = useState(false)

  async function fetchST() {
    if (!stId) { setSt(null); return }
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .schema('app').from('at_sous_traitants').select('*').eq('id', stId).maybeSingle()
    setSt((data as ST | null) ?? null)
    setLoading(false)
  }

  async function fetchDceDocs() {
    if (!st?.dce_acces_id) { setDceDocs([]); setDceRelances([]); return }
    const supabase = createClient()
    const [{ data: docs }, { data: relances }] = await Promise.all([
      supabase.from('dce_docs_st').select('*').eq('acces_id', st.dce_acces_id).order('created_at', { ascending: false }),
      supabase.from('dce_relances' as never).select('*').eq('acces_id', st.dce_acces_id).order('created_at', { ascending: false }),
    ])
    setDceDocs((docs ?? []) as DceDoc[])
    setDceRelances((relances ?? []) as unknown as DceRelance[])
  }

  useEffect(() => { fetchST() /* eslint-disable-line react-hooks/exhaustive-deps */ }, [stId])
  useEffect(() => { fetchDceDocs() /* eslint-disable-line react-hooks/exhaustive-deps */ }, [st?.dce_acces_id])

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

  function isPendingRelance(typeDoc: string, doc: DceDoc | null | undefined): boolean {
    const r = relancesByType.get(typeDoc)
    if (!r?.last) return false
    if (!doc) return true
    const lastTouch = doc.validated_at ?? doc.created_at
    return r.last > lastTouch
  }

  function notifyParent() { onChange?.() }

  async function toggleCheck(field: string, current: boolean) {
    if (!st) return
    const supabase = createClient()
    await supabase.schema('app').from('at_sous_traitants').update({ [field]: !current }).eq('id', st.id)
    setSt({ ...st, [field]: !current } as ST)
    notifyParent()
  }

  async function validerDocDepuisDce(doc: DceDoc) {
    if (!st) return
    const supabase = createClient()
    await supabase.from('dce_docs_st' as never)
      .update({ statut: 'valide', commentaire: null, validated_at: new Date().toISOString() } as never)
      .eq('id', doc.id)
    const field = DOC_TYPE_TO_FIELD[doc.type_doc]
    if (field) {
      const dateField = DOC_TYPE_TO_DATE_FIELD[doc.type_doc] ?? null
      const patch: Record<string, unknown> = { [field]: true }
      if (dateField && doc.date_validite) patch[dateField] = doc.date_validite
      await supabase.schema('app').from('at_sous_traitants').update(patch).eq('id', st.id)
      setSt({ ...st, ...patch } as ST)
    }
    await fetchDceDocs()
    notifyParent()
  }

  async function refuserDoc() {
    if (!st || !refuseModal || !refuseMotif.trim()) return
    setRefusing(true)
    const supabase = createClient()
    await supabase.from('dce_docs_st' as never)
      .update({ statut: 'refuse', commentaire: refuseMotif.trim(), validated_at: new Date().toISOString() } as never)
      .eq('id', refuseModal.id)
    const field = DOC_TYPE_TO_FIELD[refuseModal.type_doc]
    if (field) {
      await supabase.schema('app').from('at_sous_traitants').update({ [field]: false }).eq('id', st.id)
      setSt({ ...st, [field]: false } as ST)
    }
    if (st.dce_acces_id) {
      const { data: accesData } = await supabase.from('dce_acces_st' as never).select('user_id').eq('id', st.dce_acces_id).maybeSingle()
      const acces = accesData as unknown as { user_id: string | null } | null
      if (acces?.user_id) {
        await supabase.schema('app').from('alertes').insert({
          utilisateur_id: acces.user_id,
          projet_id:      st.projet_id ?? null,
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
    notifyParent()
  }

  async function validerST() {
    if (!st) return
    const score = CHECKLIST_ADMIN.filter(c => Boolean((st as unknown as Record<string, boolean>)[c.key])).length
    if (score < CHECKLIST_ADMIN.length) {
      const ok = confirm(
        `Attention : ${score}/${CHECKLIST_ADMIN.length} pieces validees.\n\n` +
        `Si tu valides ce ST sans toutes les pieces, l'economiste pourra le retenir mais le dossier reste partiellement non conforme.\n\n` +
        `Continuer la validation ?`
      )
      if (!ok) return
    }
    const supabase = createClient()
    await supabase.schema('app').from('at_sous_traitants').update({
      statut: 'complet', motif_refus: null, refused_at: null,
      validation_date: new Date().toISOString(),
    }).eq('id', st.id)
    if (st.dce_acces_id) {
      const { data: accesData } = await supabase.from('dce_acces_st' as never).select('user_id').eq('id', st.dce_acces_id).maybeSingle()
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
    setSt({ ...st, statut: 'complet', motif_refus: null, refused_at: null } as ST)
    notifyParent()
  }

  async function refuserST() {
    if (!st || !refuseStMotif.trim()) return
    setRefusingSt(true)
    const supabase = createClient()
    await supabase.schema('app').from('at_sous_traitants').update({
      statut: 'refuse', motif_refus: refuseStMotif.trim(), refused_at: new Date().toISOString(),
    }).eq('id', st.id)
    if (st.dce_acces_id) {
      const { data: accesData } = await supabase.from('dce_acces_st' as never).select('user_id').eq('id', st.dce_acces_id).maybeSingle()
      const acces = accesData as unknown as { user_id: string | null } | null
      if (acces?.user_id) {
        await supabase.schema('app').from('alertes').insert({
          utilisateur_id: acces.user_id,
          projet_id:      st.projet_id ?? null,
          type:           'st_refuse',
          titre:          `Votre dossier sous-traitant a ete refuse`,
          message:        `Motif : ${refuseStMotif.trim()}`,
          priorite:       'high',
          lue:            false,
        })
      }
    }
    setRefusingSt(false)
    setRefuseStOpen(false)
    setRefuseStMotif('')
    setSt({ ...st, statut: 'refuse', motif_refus: refuseStMotif.trim(), refused_at: new Date().toISOString() } as ST)
    notifyParent()
  }

  async function reactiverST() {
    if (!st) return
    const supabase = createClient()
    await supabase.schema('app').from('at_sous_traitants').update({
      statut: 'en_cours', motif_refus: null, refused_at: null,
    }).eq('id', st.id)
    setSt({ ...st, statut: 'en_cours', motif_refus: null, refused_at: null } as ST)
    notifyParent()
  }

  async function envoyerRelance() {
    if (!st || !st.dce_acces_id || relanceDocs.length === 0) return
    setRelancing(true)
    const supabase = createClient()
    const labels = relanceDocs.map(t => DOC_TYPE_LABEL[t] ?? t).join(', ')
    const msgClean = relanceMessage.trim() || null
    const relancesPayload = relanceDocs.map(type => ({
      acces_id: st.dce_acces_id, type_doc: type, message: msgClean,
    }))
    await supabase.from('dce_relances' as never).insert(relancesPayload as never)
    const { data: accesData } = await supabase.from('dce_acces_st' as never).select('user_id').eq('id', st.dce_acces_id).maybeSingle()
    const acces = accesData as unknown as { user_id: string | null } | null
    if (acces?.user_id) {
      const msg = msgClean
        ? `${msgClean}\n\nDocuments demandes : ${labels}`
        : `Merci de deposer / mettre a jour les documents suivants : ${labels}`
      await supabase.schema('app').from('alertes').insert({
        utilisateur_id: acces.user_id,
        projet_id:      st.projet_id ?? null,
        type:           'document_relance',
        titre:          `Relance documents (${relanceDocs.length})`,
        message:        msg,
        priorite:       'high',
        lue:            false,
      })
    }
    setRelancing(false)
    setRelanceOpen(false)
    setRelanceDocs([])
    setRelanceMessage('')
    fetchDceDocs()
    notifyParent()
  }

  if (!stId) return null

  const grouped = ['admin', 'vigilance', 'assurances'].map((sec) => ({
    section: sec,
    fields: CHECKLIST_ADMIN.filter((c) => c.section === sec),
  }))

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      <aside className="relative ml-auto w-full max-w-2xl bg-gray-50 h-full overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between z-10">
          <p className="text-sm font-semibold text-gray-900">Detail sous-traitant</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
        </div>

        {loading || !st ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Info ST */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-card p-5">
              <div className="flex items-start justify-between mb-4 gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="text-base font-semibold text-gray-900">{st.societe || st.nom}</p>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${STATUT_COLOR[st.statut] ?? 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                      {st.statut === 'refuse' && <XCircle className="w-3 h-3" />}
                      {st.statut === 'complet' && <CheckCircle2 className="w-3 h-3" />}
                      {st.statut}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {st.corps_etat ?? '—'}{st.siret ? <> · <Abbr k="SIRET" /> : {st.siret}</> : ''}
                  </p>
                </div>
              </div>

              {/* Action bar */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {st.dce_acces_id && st.statut !== 'refuse' && (
                  <button
                    onClick={() => { setRelanceDocs([]); setRelanceMessage(''); setRelanceOpen(true) }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-amber-700 border border-amber-300 rounded-lg hover:bg-amber-50">
                    <AlertTriangle className="w-3.5 h-3.5" /> Relancer
                  </button>
                )}
                {st.statut !== 'complet' && st.statut !== 'refuse' && (
                  <button
                    onClick={validerST}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Valider le ST
                  </button>
                )}
                {st.statut === 'complet' && (
                  <button
                    onClick={reactiverST}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                    <ChevronRight className="w-3.5 h-3.5 rotate-180" /> Reouvrir
                  </button>
                )}
                {st.statut !== 'refuse' && (
                  <button
                    onClick={() => { setRefuseStOpen(true); setRefuseStMotif('') }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-700 border border-red-300 rounded-lg hover:bg-red-50">
                    <XCircle className="w-3.5 h-3.5" /> Refuser le ST
                  </button>
                )}
                {st.statut === 'refuse' && (
                  <button
                    onClick={reactiverST}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-50">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Reactiver
                  </button>
                )}
              </div>

              {st.statut === 'complet' && (
                <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-700">Sous-traitant valide</p>
                    <p className="text-xs text-emerald-700 mt-0.5">L&apos;economiste peut desormais retenir ce ST sur ses lots.</p>
                  </div>
                </div>
              )}
              {st.statut === 'refuse' && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-700">Sous-traitant refuse</p>
                      {st.motif_refus && <p className="text-xs text-red-700 mt-0.5"><span className="font-medium">Motif : </span>{st.motif_refus}</p>}
                      {st.refused_at && (
                        <p className="text-[10px] text-red-500 mt-0.5">
                          Refuse le {new Date(st.refused_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Checklist */}
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
                        const val = st[f.key as keyof ST] as boolean
                        const dateField = CHECK_DATE_FIELD[f.key]
                        const dateVal = dateField ? (st[dateField as keyof ST] as string | null) : null
                        const badge = dateVal ? validiteBadge(dateVal) : null
                        return (
                          <div key={f.key} className="flex items-center gap-3">
                            <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                              <input type="checkbox" checked={val}
                                onChange={() => toggleCheck(f.key, val)}
                                className="w-4 h-4 rounded border-gray-300 text-gray-900" />
                              <span className={`text-sm ${val ? 'line-through text-gray-400' : 'text-gray-700'}`}>{f.label}</span>
                            </label>
                            {dateField && val && (
                              <input type="date" value={dateVal ?? ''}
                                onChange={async (e) => {
                                  const supabase = createClient()
                                  await supabase.schema('app').from('at_sous_traitants').update({ [dateField]: e.target.value || null }).eq('id', st.id)
                                  setSt({ ...st, [dateField]: e.target.value || null } as ST)
                                  notifyParent()
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
            </div>

            {/* Documents DCE */}
            {st.dce_acces_id && (
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
          </div>
        )}
      </aside>

      {/* Modale refus du ST */}
      {refuseStOpen && st && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500" /> Refuser ce sous-traitant
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">{st.societe || st.nom}</p>
              </div>
              <button onClick={() => { setRefuseStOpen(false); setRefuseStMotif('') }} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  Le ST sera marque comme <strong>refuse</strong>. L&apos;economiste ne pourra plus le retenir dans le comparatif.
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Motif du refus *</label>
                <textarea value={refuseStMotif} onChange={(e) => setRefuseStMotif(e.target.value)}
                  rows={4}
                  placeholder="Ex: Documents administratifs incomplets, assurances expirees..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none placeholder-gray-300" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setRefuseStMotif("Documents administratifs incomplets ou non conformes apres relance.")}
                  className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 text-left">Docs incomplets</button>
                <button onClick={() => setRefuseStMotif("Assurances obligatoires manquantes ou expirees (RC Pro / Decennale).")}
                  className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 text-left">Assurances KO</button>
                <button onClick={() => setRefuseStMotif("URSSAF / fiscalite non a jour. Vigilance sociale non levee.")}
                  className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 text-left">Vigilance sociale</button>
                <button onClick={() => setRefuseStMotif("Pas de retour du ST apres plusieurs relances.")}
                  className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 text-left">Sans reponse</button>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => { setRefuseStOpen(false); setRefuseStMotif('') }}
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

      {/* Modale relance docs */}
      {relanceOpen && st && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" /> Relancer le ST
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Selectionne les documents a redeposer ou mettre a jour</p>
              </div>
              <button onClick={() => { setRelanceOpen(false); setRelanceDocs([]) }} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              {(() => {
                const docsByType = new Map<string, DceDoc>()
                for (const d of dceDocs) docsByType.set(d.type_doc, d)
                const items = ALL_DOC_TYPES.map(type => ({
                  type, doc: docsByType.get(type) ?? null, label: DOC_TYPE_LABEL[type] ?? type,
                }))
                const nbTransmis = items.filter(i => i.doc).length
                const nbNonTransmis = items.length - nbTransmis
                return (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-gray-600">Documents concernes ({relanceDocs.length})</label>
                      <div className="flex gap-1 flex-wrap">
                        <button onClick={() => setRelanceDocs(items.filter(i => !i.doc).map(i => i.type))}
                          className="text-xs px-2 py-0.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">
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
                  </div>
                )
              })()}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Message (optionnel)</label>
                <textarea value={relanceMessage} onChange={(e) => setRelanceMessage(e.target.value)}
                  rows={3}
                  placeholder="Precisions ou demande specifique..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none placeholder-gray-300" />
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2 sticky bottom-0 bg-white">
              <button onClick={() => { setRelanceOpen(false); setRelanceDocs([]); setRelanceMessage('') }}
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

      {/* Modale refus document */}
      {refuseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500" /> Refuser le document
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">{DOC_TYPE_LABEL[refuseModal.type_doc] ?? refuseModal.type_doc}{refuseModal.nom_fichier ? ` — ${refuseModal.nom_fichier}` : ''}</p>
              </div>
              <button onClick={() => { setRefuseModal(null); setRefuseMotif('') }} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-gray-500">Indique le motif du refus. Le ST sera notifie pour redeposer un document conforme.</p>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Motif du refus *</label>
                <textarea value={refuseMotif} onChange={(e) => setRefuseMotif(e.target.value)}
                  rows={4}
                  placeholder="Ex: Le Kbis fourni date de plus de 3 mois, merci de redeposer un document recent."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none placeholder-gray-300" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setRefuseMotif("Document expire ou hors delai. Merci de redeposer un document a jour.")}
                  className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 text-left">Document expire</button>
                <button onClick={() => setRefuseMotif("Document illisible ou de mauvaise qualite. Merci de redeposer un scan plus net.")}
                  className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 text-left">Illisible</button>
                <button onClick={() => setRefuseMotif("Mauvais type de document. Merci de redeposer le document demande.")}
                  className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 text-left">Mauvais doc</button>
                <button onClick={() => setRefuseMotif("Informations incompletes ou manquantes sur le document.")}
                  className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 text-left">Incomplet</button>
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
