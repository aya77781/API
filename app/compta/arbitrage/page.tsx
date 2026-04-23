'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
  X,
  FileText,
  Trash2,
  StickyNote,
  AlertTriangle,
  Download,
  Scale,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'
import { useUser } from '@/hooks/useUser'

type Tag = 'recu' | 'a_payer' | 'paye'

type ArbFacture = {
  id: string
  projet_id: string | null
  fournisseur_id: string | null
  numero_facture: string | null
  libelle: string
  montant_ht: number
  tva_pct: number
  montant_ttc: number | null
  date_reception: string
  date_limite: string | null
  date_paiement: string | null
  tag: Tag
  mois_reference: string
  facture_url: string | null
  notes: string | null
  arbitre_par: string | null
  arbitre_le: string | null
  created_at: string
  updated_at: string
}

type Fournisseur = { id: string; nom: string; actif: boolean | null }
type Projet = { id: string; nom: string }
type Employe = { id: string; email: string | null }

const TAG_LABEL: Record<Tag, string> = {
  recu: 'Reçu',
  a_payer: 'À payer',
  paye: 'Payé',
}

const TAG_BG: Record<Tag, string> = {
  recu: '#F1EFE8',
  a_payer: '#FAEEDA',
  paye: '#EAF3DE',
}
const TAG_FG: Record<Tag, string> = {
  recu: '#5F5E5A',
  a_payer: '#854F0B',
  paye: '#3B6D11',
}

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

function fmtMoney(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function fmtDateFR(d: string | null) {
  if (!d) return '—'
  const dt = new Date(d)
  return dt.toLocaleDateString('fr-FR')
}

function firstOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function toISODate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}
function daysBetween(target: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const t = new Date(target)
  t.setHours(0, 0, 0, 0)
  return Math.round((t.getTime() - today.getTime()) / 86400000)
}

export default function ArbitragePage() {
  const supabase = createClient()
  const { user } = useUser()
  const [monthRef, setMonthRef] = useState<Date>(firstOfMonth(new Date()))
  const [factures, setFactures] = useState<ArbFacture[]>([])
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [projets, setProjets] = useState<Projet[]>([])
  const [myEmploye, setMyEmploye] = useState<Employe | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [tagFilter, setTagFilter] = useState<'tous' | Tag>('tous')
  const [projetFilter, setProjetFilter] = useState<string>('')
  const [fournisseurFilter, setFournisseurFilter] = useState<string>('')
  const [openTagMenuId, setOpenTagMenuId] = useState<string | null>(null)
  const [notesOpenId, setNotesOpenId] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState<string>('')

  const load = useCallback(async () => {
    setLoading(true)
    const mois = toISODate(monthRef)
    const [fRes, foRes, prRes] = await Promise.all([
      supabase
        .from('arbitrage_factures')
        .select('*')
        .eq('mois_reference', mois)
        .order('created_at', { ascending: false }),
      supabase.from('fournisseurs').select('id,nom,actif').order('nom'),
      supabase.from('projets').select('id,nom').order('nom'),
    ])
    setFactures((fRes.data ?? []) as ArbFacture[])
    setFournisseurs((foRes.data ?? []) as Fournisseur[])
    setProjets((prRes.data ?? []) as Projet[])
    setLoading(false)
  }, [monthRef, supabase])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!user?.email) return
    supabase
      .from('employes')
      .select('id,email')
      .eq('email', user.email)
      .maybeSingle()
      .then(({ data }) => { if (data) setMyEmploye(data as Employe) })
  }, [user?.email, supabase])

  const fournisseurNom = (id: string | null) =>
    id ? (fournisseurs.find(f => f.id === id)?.nom ?? '—') : '—'
  const projetNom = (id: string | null) =>
    id ? (projets.find(p => p.id === id)?.nom ?? '—') : '—'

  const filtered = useMemo(() => {
    let list = factures
    if (tagFilter !== 'tous') list = list.filter(f => f.tag === tagFilter)
    if (projetFilter) list = list.filter(f => f.projet_id === projetFilter)
    if (fournisseurFilter.trim()) {
      const q = fournisseurFilter.trim().toLowerCase()
      list = list.filter(f => {
        const nom = fournisseurNom(f.fournisseur_id).toLowerCase()
        return nom.includes(q)
      })
    }
    const order: Record<Tag, number> = { a_payer: 0, recu: 1, paye: 2 }
    return [...list].sort((a, b) => {
      if (order[a.tag] !== order[b.tag]) return order[a.tag] - order[b.tag]
      if (a.tag === 'recu') {
        return (daysBetween(a.date_limite ?? '') - daysBetween(b.date_limite ?? ''))
      }
      if (a.tag === 'paye') {
        const da = a.date_paiement ? new Date(a.date_paiement).getTime() : 0
        const db = b.date_paiement ? new Date(b.date_paiement).getTime() : 0
        return db - da
      }
      return 0
    })
  }, [factures, tagFilter, projetFilter, fournisseurFilter, fournisseurs])

  const metrics = useMemo(() => {
    const init = { recu: { n: 0, s: 0 }, a_payer: { n: 0, s: 0 }, paye: { n: 0, s: 0 } }
    for (const f of factures) {
      init[f.tag].n += 1
      init[f.tag].s += Number(f.montant_ht)
    }
    const total = { n: factures.length, s: factures.reduce((s, f) => s + Number(f.montant_ht), 0) }
    return { ...init, total }
  }, [factures])

  async function changeTag(f: ArbFacture, newTag: Tag) {
    setOpenTagMenuId(null)
    if (newTag === f.tag) return
    const patch: Partial<ArbFacture> = { tag: newTag }
    if (newTag === 'a_payer') {
      patch.arbitre_par = myEmploye?.id ?? null
      patch.arbitre_le = new Date().toISOString()
    }
    if (newTag === 'paye') {
      patch.date_paiement = toISODate(new Date())
    }
    await (supabase.from('arbitrage_factures') as unknown as { update: (p: unknown) => { eq: (k: string, v: string) => Promise<unknown> } })
      .update(patch).eq('id', f.id)
    load()
  }

  async function saveNotes(id: string) {
    await (supabase.from('arbitrage_factures') as unknown as { update: (p: unknown) => { eq: (k: string, v: string) => Promise<unknown> } })
      .update({ notes: notesDraft }).eq('id', id)
    setNotesOpenId(null)
    setNotesDraft('')
    load()
  }

  async function deleteFacture(id: string) {
    if (!confirm('Supprimer cette facture ?')) return
    await supabase.from('arbitrage_factures').delete().eq('id', id)
    load()
  }

  function exportCSV() {
    const headers = [
      'Fournisseur', 'Projet', 'N° Facture', 'Libellé', 'Montant HT', 'TVA %', 'Montant TTC',
      'Date réception', 'Date limite', 'Date paiement', 'Tag', 'Notes',
    ]
    const rows = filtered.map(f => [
      fournisseurNom(f.fournisseur_id),
      projetNom(f.projet_id),
      f.numero_facture ?? '',
      f.libelle,
      String(Number(f.montant_ht).toFixed(2)).replace('.', ','),
      String(Number(f.tva_pct).toFixed(2)).replace('.', ','),
      String(Number(f.montant_ttc ?? 0).toFixed(2)).replace('.', ','),
      fmtDateFR(f.date_reception),
      fmtDateFR(f.date_limite),
      fmtDateFR(f.date_paiement),
      TAG_LABEL[f.tag],
      (f.notes ?? '').replace(/\r?\n/g, ' '),
    ])
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n')
    const bom = '﻿'
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Arbitrage-${MONTHS_FR[monthRef.getMonth()]}-${monthRef.getFullYear()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <TopBar title="Arbitrage" subtitle="Factures fournisseurs à arbitrer" />
      <div className="p-6 space-y-6">
        {/* Sélecteur mois + actions */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2 py-1">
            <button
              onClick={() => setMonthRef(m => addMonths(m, -1))}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
              title="Mois précédent"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-4 px-2">
              <span className="text-xs text-gray-400">
                {MONTHS_FR[addMonths(monthRef, -1).getMonth()]} {addMonths(monthRef, -1).getFullYear()}
              </span>
              <span className="text-sm font-semibold text-gray-900">
                {MONTHS_FR[monthRef.getMonth()]} {monthRef.getFullYear()}
              </span>
              <span className="text-xs text-gray-400">
                {MONTHS_FR[addMonths(monthRef, 1).getMonth()]} {addMonths(monthRef, 1).getFullYear()}
              </span>
            </div>
            <button
              onClick={() => setMonthRef(m => addMonths(m, 1))}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
              title="Mois suivant"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" /> Exporter CSV
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-4 h-4" /> Ajouter une facture
            </button>
          </div>
        </div>

        {/* Bandeau métriques */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            label="REÇUES"
            count={metrics.recu.n}
            sum={metrics.recu.s}
            bg="#F1EFE8"
            fg="#5F5E5A"
          />
          <MetricCard
            label="À PAYER"
            count={metrics.a_payer.n}
            sum={metrics.a_payer.s}
            bg="#FAEEDA"
            fg="#854F0B"
            highlight
          />
          <MetricCard
            label="PAYÉES"
            count={metrics.paye.n}
            sum={metrics.paye.s}
            bg="#EAF3DE"
            fg="#3B6D11"
          />
          <MetricCard
            label="TOTAL MOIS"
            count={metrics.total.n}
            sum={metrics.total.s}
            bg="#E6F1FB"
            fg="#1E467A"
          />
        </div>

        {/* Filtres */}
        <div className="flex items-center gap-2 flex-wrap">
          {(['tous', 'recu', 'a_payer', 'paye'] as const).map(t => {
            const active = tagFilter === t
            const label = t === 'tous' ? 'Tous' : t === 'recu' ? 'Reçues' : t === 'a_payer' ? 'À payer' : 'Payées'
            return (
              <button
                key={t}
                onClick={() => setTagFilter(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  active
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            )
          })}
          <select
            value={projetFilter}
            onChange={(e) => setProjetFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          >
            <option value="">Tous projets</option>
            {projets.map(p => (
              <option key={p.id} value={p.id}>{p.nom}</option>
            ))}
          </select>
          <input
            value={fournisseurFilter}
            onChange={(e) => setFournisseurFilter(e.target.value)}
            placeholder="Filtrer fournisseur…"
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          />
        </div>

        {/* Tableau */}
        {loading ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Loader2 className="w-6 h-6 text-gray-400 mx-auto animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Scale className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">Aucune facture pour ce mois</p>
            <p className="text-xs text-gray-400 mt-1">Cliquez sur « Ajouter une facture » pour commencer.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-visible">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-left text-xs font-medium text-gray-500">
                  <th className="px-4 py-3">Fournisseur</th>
                  <th className="px-4 py-3">Projet</th>
                  <th className="px-4 py-3">N° Facture</th>
                  <th className="px-4 py-3 text-right">Montant HT</th>
                  <th className="px-4 py-3">Reçu le</th>
                  <th className="px-4 py-3">Date limite</th>
                  <th className="px-4 py-3">Jours restants</th>
                  <th className="px-4 py-3">Tag</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(f => {
                  const jr = f.date_limite ? daysBetween(f.date_limite) : null
                  const rowBg =
                    f.tag === 'a_payer' ? { backgroundColor: '#FAEEDA20' } :
                    (jr !== null && jr < 0 && f.tag !== 'paye') ? { backgroundColor: '#FCEBEB20' } :
                    undefined
                  const rowOpacity = f.tag === 'paye' ? 0.7 : 1
                  const limitColor =
                    f.tag === 'paye' ? 'text-gray-500' :
                    (jr !== null && jr < 0) ? 'text-red-600' :
                    (jr !== null && jr <= 7) ? 'text-orange-600' :
                    'text-gray-700'
                  return (
                    <tr
                      key={f.id}
                      className="hover:bg-[var(--color-background-secondary,#f9fafb)] transition-colors"
                      style={{ ...rowBg, opacity: rowOpacity }}
                    >
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-gray-900">{fournisseurNom(f.fournisseur_id)}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{f.libelle}</div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className={f.projet_id ? 'text-gray-700' : 'text-gray-400'}>
                          {projetNom(f.projet_id)}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-700">{f.numero_facture ?? '—'}</span>
                          {f.facture_url && (
                            <a
                              href={f.facture_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-gray-400 hover:text-gray-900"
                              title="Ouvrir le PDF"
                            >
                              <FileText className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        <div className="font-medium text-gray-900">{fmtMoney(Number(f.montant_ht))}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          TVA : {fmtMoney(Number(f.montant_ht) * (Number(f.tva_pct) / 100))}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-gray-700">{fmtDateFR(f.date_reception)}</td>
                      <td className={`px-4 py-3 align-top font-medium ${limitColor}`}>
                        {fmtDateFR(f.date_limite)}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {f.tag === 'paye' || jr === null ? (
                          <span className="text-gray-400">—</span>
                        ) : jr < 0 ? (
                          <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {jr} jours
                          </span>
                        ) : jr <= 7 ? (
                          <span className="text-orange-600 font-medium">+{jr} jours</span>
                        ) : (
                          <span className="text-emerald-600 font-medium">+{jr} jours</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top relative">
                        <button
                          onClick={() => setOpenTagMenuId(openTagMenuId === f.id ? null : f.id)}
                          className="inline-flex px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-colors duration-150"
                          style={{ backgroundColor: TAG_BG[f.tag], color: TAG_FG[f.tag] }}
                        >
                          {TAG_LABEL[f.tag]}
                        </button>
                        {openTagMenuId === f.id && (
                          <div className="absolute z-20 top-full mt-1 left-4 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[120px]">
                            {(['recu', 'a_payer', 'paye'] as Tag[]).map(t => (
                              <button
                                key={t}
                                onClick={() => changeTag(f, t)}
                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2"
                              >
                                <span
                                  className="inline-block w-2.5 h-2.5 rounded-full"
                                  style={{ backgroundColor: TAG_BG[t], border: `1px solid ${TAG_FG[t]}` }}
                                />
                                {TAG_LABEL[t]}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => {
                              setNotesOpenId(notesOpenId === f.id ? null : f.id)
                              setNotesDraft(f.notes ?? '')
                            }}
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                            title="Notes"
                          >
                            <StickyNote className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteFacture(f.id)}
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-600"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        {notesOpenId === f.id && (
                          <div className="mt-2 text-left">
                            <textarea
                              value={notesDraft}
                              onChange={(e) => setNotesDraft(e.target.value)}
                              placeholder="Notes…"
                              rows={3}
                              className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                            />
                            <div className="flex items-center justify-end gap-1 mt-1">
                              <button
                                onClick={() => { setNotesOpenId(null); setNotesDraft('') }}
                                className="px-2 py-1 text-xs text-gray-500 hover:text-gray-900"
                              >
                                Annuler
                              </button>
                              <button
                                onClick={() => saveNotes(f.id)}
                                className="px-2 py-1 text-xs bg-gray-900 text-white rounded hover:bg-gray-800"
                              >
                                Enregistrer
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateFactureModal
          fournisseurs={fournisseurs}
          projets={projets}
          defaultMois={monthRef}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); load() }}
        />
      )}
    </div>
  )
}

function MetricCard({
  label, count, sum, bg, fg, highlight,
}: {
  label: string
  count: number
  sum: number
  bg: string
  fg: string
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-lg p-4 ${highlight ? 'ring-1 ring-orange-200' : ''}`}
      style={{ backgroundColor: bg }}
    >
      <div className="text-xs font-semibold tracking-wide" style={{ color: fg }}>{label}</div>
      <div className="mt-2 text-2xl font-bold" style={{ color: fg }}>
        {fmtMoney(sum)}
      </div>
      <div className="mt-1 text-xs" style={{ color: fg, opacity: 0.8 }}>
        {count} facture{count > 1 ? 's' : ''} — HT
      </div>
    </div>
  )
}

function CreateFactureModal({
  fournisseurs, projets, defaultMois, onClose, onSaved,
}: {
  fournisseurs: Fournisseur[]
  projets: Projet[]
  defaultMois: Date
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = createClient()
  const [fournisseurId, setFournisseurId] = useState<string>('')
  const [nouveauFournisseur, setNouveauFournisseur] = useState<string>('')
  const [projetId, setProjetId] = useState<string>('')
  const [numero, setNumero] = useState('')
  const [libelle, setLibelle] = useState('')
  const [montantHT, setMontantHT] = useState<string>('')
  const [tva, setTva] = useState<string>('20')
  const [dateReception, setDateReception] = useState<string>(toISODate(new Date()))
  const [moisRef, setMoisRef] = useState<string>(toISODate(defaultMois))
  const [notes, setNotes] = useState('')
  const [tag, setTag] = useState<Tag>('recu')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dateLimite = useMemo(() => {
    if (!dateReception) return null
    const d = new Date(dateReception)
    d.setDate(d.getDate() + 45)
    return d
  }, [dateReception])

  const isNewFournisseur = fournisseurId === '__new__'

  async function handleSubmit() {
    setError(null)
    if (!libelle.trim()) { setError('Libellé obligatoire'); return }
    if (!montantHT || isNaN(Number(montantHT))) { setError('Montant HT invalide'); return }
    if (isNewFournisseur && !nouveauFournisseur.trim()) { setError('Nom du nouveau fournisseur requis'); return }

    setSaving(true)

    let finalFournisseurId: string | null = null
    if (isNewFournisseur) {
      const { data: nf, error: eNf } = await supabase
        .from('fournisseurs')
        .insert({ nom: nouveauFournisseur.trim(), actif: true, type: 'fournisseur' })
        .select('id')
        .single()
      if (eNf || !nf) { setError('Erreur création fournisseur'); setSaving(false); return }
      finalFournisseurId = (nf as { id: string }).id
    } else if (fournisseurId) {
      finalFournisseurId = fournisseurId
    }

    let factureUrl: string | null = null
    if (pdfFile) {
      const ts = Date.now()
      const safeName = pdfFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `factures/${projetId || 'general'}/${ts}_${safeName}`
      const { error: eUp } = await supabase.storage
        .from('factures')
        .upload(path, pdfFile, { upsert: false, contentType: pdfFile.type || 'application/pdf' })
      if (eUp) { setError('Erreur upload PDF: ' + eUp.message); setSaving(false); return }
      const { data: pub } = supabase.storage.from('factures').getPublicUrl(path)
      factureUrl = pub.publicUrl
    }

    const { error: eIns } = await (supabase.from('arbitrage_factures') as unknown as { insert: (p: unknown) => Promise<{ error: { message: string } | null }> })
      .insert({
        fournisseur_id: finalFournisseurId,
        projet_id: projetId || null,
        numero_facture: numero.trim() || null,
        libelle: libelle.trim(),
        montant_ht: Number(montantHT),
        tva_pct: Number(tva),
        date_reception: dateReception,
        mois_reference: moisRef,
        facture_url: factureUrl,
        notes: notes.trim() || null,
        tag,
      })

    setSaving(false)
    if (eIns) { setError('Erreur enregistrement: ' + eIns.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">Nouvelle facture</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Fournisseur">
              <select
                value={fournisseurId}
                onChange={(e) => setFournisseurId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              >
                <option value="">— Sélectionner —</option>
                {fournisseurs.filter(f => f.actif !== false).map(f => (
                  <option key={f.id} value={f.id}>{f.nom}</option>
                ))}
                <option value="__new__">+ Nouveau fournisseur</option>
              </select>
              {isNewFournisseur && (
                <input
                  value={nouveauFournisseur}
                  onChange={(e) => setNouveauFournisseur(e.target.value)}
                  placeholder="Nom du nouveau fournisseur"
                  className="mt-2 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                />
              )}
            </Field>

            <Field label="Projet (optionnel)">
              <select
                value={projetId}
                onChange={(e) => setProjetId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              >
                <option value="">— Aucun —</option>
                {projets.map(p => (
                  <option key={p.id} value={p.id}>{p.nom}</option>
                ))}
              </select>
            </Field>

            <Field label="N° de facture">
              <input
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="F-2026-001"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
            </Field>

            <Field label="Tag initial">
              <select
                value={tag}
                onChange={(e) => setTag(e.target.value as Tag)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              >
                <option value="recu">Reçu</option>
                <option value="a_payer">À payer</option>
                <option value="paye">Payé</option>
              </select>
            </Field>

            <Field label="Libellé *">
              <input
                value={libelle}
                onChange={(e) => setLibelle(e.target.value)}
                placeholder="Fourniture chantier lot 3"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
            </Field>

            <Field label="Montant HT *">
              <input
                type="number"
                step="0.01"
                value={montantHT}
                onChange={(e) => setMontantHT(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
            </Field>

            <Field label="TVA">
              <select
                value={tva}
                onChange={(e) => setTva(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              >
                <option value="0">0 %</option>
                <option value="5.5">5,5 %</option>
                <option value="10">10 %</option>
                <option value="20">20 %</option>
              </select>
            </Field>

            <Field label="Date de réception">
              <input
                type="date"
                value={dateReception}
                onChange={(e) => setDateReception(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
              {dateLimite && (
                <p className="mt-1 text-xs text-gray-500">
                  Date limite de paiement : <span className="font-medium text-gray-700">{dateLimite.toLocaleDateString('fr-FR')}</span>
                </p>
              )}
            </Field>

            <Field label="Mois de référence">
              <input
                type="date"
                value={moisRef}
                onChange={(e) => setMoisRef(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
            </Field>

            <Field label="Facture PDF (optionnel)">
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                className="w-full text-xs text-gray-600"
              />
            </Field>
          </div>

          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
          </Field>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  )
}
