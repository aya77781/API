'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronLeft, ChevronRight, Check, Download, Library, Search, Pencil, X, Send, MoreVertical, Copy } from 'lucide-react'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, cn } from '@/lib/utils'
import { FAKE_POPY3_LOTS, FAKE_POPY3_LIGNES } from '@/lib/fake-data/metres-popy3'
import { Abbr } from '@/components/shared/Abbr'

type Lot = {
  id: string
  projet_id: string
  nom: string
  ordre: number
  total_ht: number | null
  created_at: string
}

type LigneType = 'lot' | 'chapitre' | 'ouvrage'

type MetreLigne = {
  id: string
  lot_id: string
  projet_id: string
  designation: string | null
  detail: string | null
  quantite: number | null
  unite: string | null
  prix_unitaire: number | null
  total_ht: number | null
  ordre: number
  created_at: string
  type?: LigneType
  parent_id?: string | null
  quantite_formule?: string | null
  marge_pct?: number | null
}

type DraftLigne = {
  designation: string
  detail: string
  quantite: string
  unite: string
  prix_unitaire: string
  type?: LigneType
  parent_id?: string | null
  quantite_formule?: string | null
  marge_pct?: string
}

// Evalue une formule arithmetique simple (chiffres, + - * / ( ) ,)
// Retourne null si la formule est invalide.
function evalFormula(s: string): number | null {
  if (!s) return null
  const cleaned = s.replace(/,/g, '.').replace(/\s/g, '')
  if (!/^[\d+\-*/().]+$/.test(cleaned)) return null
  try {
    // eslint-disable-next-line no-new-func
    const r = Function(`"use strict"; return (${cleaned})`)()
    if (typeof r === 'number' && isFinite(r)) return r
    return null
  } catch {
    return null
  }
}

// Resolution d'une quantite : formule prioritaire, sinon valeur numerique
function resolveQuantite(l: Pick<MetreLigne, 'quantite' | 'quantite_formule'>): number {
  if (l.quantite_formule) {
    const v = evalFormula(l.quantite_formule)
    if (v !== null) return v
  }
  return Number(l.quantite) || 0
}

// Fallback : corps d'etat TCE standards utilises si biblio_corps_etat est vide.
const CORPS_ETAT_FALLBACK = [
  'VRD / Terrassement',
  'Gros œuvre / Maçonnerie',
  'Charpente',
  'Couverture / Étanchéité',
  'Façades / Ravalement',
  'Menuiseries extérieures',
  'Menuiseries intérieures',
  'Cloisons / Doublages',
  'Plâtrerie / Faux plafonds',
  'Plomberie / Sanitaire',
  'CVC (Chauffage Ventilation Climatisation)',
  'Électricité (CFO / CFA)',
  'Revêtements de sols',
  'Revêtements muraux / Faïence',
  'Peinture',
  'Serrurerie / Métallerie',
  'Ascenseurs',
  'Espaces verts / Aménagements extérieurs',
]

const UNITES = ['m²', 'ml', 'm³', 'u', 'forfait', 'kg', 'h', 'jour']

function unitToDb(u: string): string {
  if (u === 'm²') return 'm2'
  if (u === 'm³') return 'm3'
  return u
}
function unitFromDb(u: string | null): string {
  if (!u) return 'u'
  if (u === 'm2') return 'm²'
  if (u === 'm3') return 'm³'
  return u
}

function sanitizeSheetName(name: string): string {
  // Excel: 31 chars max, pas de [ ] : * ? / \
  return name.replace(/[\[\]:*?/\\]/g, '-').slice(0, 31) || 'Lot'
}

function buildLotSheet(lotNom: string, lignes: MetreLigne[]) {
  const aoa: (string | number)[][] = []
  aoa.push([`Métré — ${lotNom}`])
  aoa.push([])
  aoa.push(['Désignation', 'Détail', 'Quantité', 'Unité', 'Prix unitaire HT', 'Total HT'])
  let total = 0
  lignes.forEach((l) => {
    const q = Number(l.quantite) || 0
    const pu = Number(l.prix_unitaire) || 0
    const t = Number(l.total_ht) || q * pu
    total += t
    aoa.push([
      l.designation ?? '',
      l.detail ?? '',
      q,
      unitFromDb(l.unite),
      pu,
      t,
    ])
  })
  aoa.push([])
  aoa.push(['', '', '', '', 'SOUS-TOTAL HT', total])
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [{ wch: 40 }, { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 16 }, { wch: 16 }]
  return ws
}

function emptyDraft(): DraftLigne {
  return { designation: '', detail: '', quantite: '', unite: 'u', prix_unitaire: '' }
}

function parseNum(s: string): number {
  if (!s) return 0
  const n = parseFloat(s.replace(',', '.').replace(/\s/g, ''))
  return isNaN(n) ? 0 : n
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function MetresTab({
  projetId,
  mode = 'metres',
  fakeData = false,
}: {
  projetId: string
  mode?: 'lots' | 'metres' | 'chiffrage'
  fakeData?: boolean
}) {
  const showPrices = mode === 'chiffrage'
  const [showMarge, setShowMarge] = useState(false)
  const supabase = useMemo(() => createClient(), [])
  const [lots, setLots] = useState<Lot[]>([])
  const [activeLotId, setActiveLotId] = useState<string | null>(null)
  const [lignes, setLignes] = useState<MetreLigne[]>([])
  const [loading, setLoading] = useState(true)
  // Stockage local des lignes fake par lot (permet edit/add/delete en démo).
  const fakeLignesRef = useRef<Record<string, MetreLigne[]>>(
    fakeData
      ? JSON.parse(JSON.stringify(FAKE_POPY3_LIGNES)) as Record<string, MetreLigne[]>
      : {},
  )
  const [showLotMenu, setShowLotMenu] = useState(false)
  const [customLotName, setCustomLotName] = useState<string | null>(null)

  // Biblio lots pour dropdown creation lot (depuis biblio_items)
  const [biblioCorps, setBiblioCorps] = useState<{ id: string; nom: string }[]>([])
  useEffect(() => {
    supabase.from('biblio_items').select('id, designation, source_code')
      .eq('type', 'lot').order('ordre')
      .then(({ data }) => {
        const rows = ((data ?? []) as { id: string; designation: string; source_code: string | null }[])
        // Deduplique par nom
        const seen = new Set<string>()
        const unique = rows
          .filter((c) => {
            if (seen.has(c.designation)) return false
            seen.add(c.designation)
            return true
          })
          .map((c) => ({ id: c.id, nom: c.designation }))
        setBiblioCorps(unique)
      })
  }, [supabase])

  // Inline edit lot name
  const [editLotId, setEditLotId] = useState<string | null>(null)
  const [editLotNom, setEditLotNom] = useState('')

  // Ouvrage picker modal
  const [showOuvragePicker, setShowOuvragePicker] = useState(false)

  // Soumettre au CO
  const [showSubmitCO, setShowSubmitCO] = useState(false)
  const [submittingCO, setSubmittingCO] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [leftWidth, setLeftWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 280
    const saved = Number(localStorage.getItem('metres_left_width'))
    return saved && saved >= 180 && saved <= 600 ? saved : 280
  })
  const resizingRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!resizingRef.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const w = Math.min(600, Math.max(180, e.clientX - rect.left))
      setLeftWidth(w)
    }
    function onUp() {
      if (!resizingRef.current) return
      resizingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      try { localStorage.setItem('metres_left_width', String(leftWidth)) } catch {}
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [leftWidth])

  function startResize(e: React.MouseEvent) {
    e.preventDefault()
    resizingRef.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  // ── Fetch lots
  async function refreshLots(keepActive = true) {
    if (fakeData) {
      const rows = FAKE_POPY3_LOTS.map((l) => ({
        ...l,
        total_ht: (fakeLignesRef.current[l.id] ?? []).reduce(
          (s, li) => s + (Number(li.total_ht) || 0),
          0,
        ),
      })) as Lot[]
      setLots(rows)
      if (!keepActive || !activeLotId || !rows.find((l) => l.id === activeLotId)) {
        setActiveLotId(rows[0]?.id ?? null)
      }
      return
    }
    const { data } = await supabase
      .from('lots' as never)
      .select('*')
      .eq('projet_id', projetId)
      .order('ordre', { ascending: true })
      .order('created_at', { ascending: true })
    const rows = (data ?? []) as unknown as Lot[]
    setLots(rows)
    if (!keepActive || !activeLotId || !rows.find((l) => l.id === activeLotId)) {
      setActiveLotId(rows[0]?.id ?? null)
    }
  }

  async function refreshLignes(lotId: string) {
    if (fakeData) {
      setLignes(fakeLignesRef.current[lotId] ?? [])
      return
    }
    const { data } = await supabase
      .from('chiffrage_lignes' as never)
      .select('*')
      .eq('lot_id', lotId)
      .order('ordre', { ascending: true })
      .order('created_at', { ascending: true })
    setLignes(((data ?? []) as unknown) as MetreLigne[])
  }

  useEffect(() => {
    refreshLots(false).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetId])

  useEffect(() => {
    if (activeLotId) refreshLignes(activeLotId)
    else setLignes([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLotId])

  // ── Actions lots
  async function createLot(nom: string) {
    const ordre = lots.length
    if (fakeData) {
      const row: Lot = {
        id: `fake-lot-new-${Date.now()}`,
        projet_id: projetId,
        nom,
        ordre,
        total_ht: 0,
        created_at: new Date().toISOString(),
      }
      fakeLignesRef.current[row.id] = []
      setErrorMsg(null)
      setLots((prev) => [...prev, row])
      setActiveLotId(row.id)
      return
    }
    const { data, error } = await supabase
      .from('lots' as never)
      .insert({ projet_id: projetId, nom, ordre, total_ht: 0 } as never)
      .select()
      .single()
    if (error) {
      console.error('[MetresTab] createLot error:', error)
      setErrorMsg(`Erreur création lot : ${error.message}`)
      return
    }
    const row = data as unknown as Lot | null
    if (row) {
      setErrorMsg(null)
      setLots((prev) => [...prev, row])
      setActiveLotId(row.id)
    }
  }

  async function deleteLot(lotId: string) {
    if (!confirm('Supprimer ce lot et toutes ses lignes ?')) return
    if (fakeData) {
      delete fakeLignesRef.current[lotId]
      setLots((prev) => prev.filter((l) => l.id !== lotId))
      if (activeLotId === lotId) setActiveLotId(null)
      return
    }
    await supabase.from('chiffrage_lignes' as never).delete().eq('lot_id', lotId)
    await supabase.from('lots' as never).delete().eq('id', lotId)
    await refreshLots(false)
  }

  async function renameLot(lotId: string, nom: string) {
    if (!fakeData) {
      await supabase.from('lots' as never).update({ nom } as never).eq('id', lotId)
    }
    setLots((prev) => prev.map((l) => (l.id === lotId ? { ...l, nom } : l)))
  }

  // ── Actions lignes
  async function recomputeLotTotal(lotId: string) {
    if (fakeData) {
      const rows = fakeLignesRef.current[lotId] ?? []
      const total = rows.reduce((s, r) => s + (Number(r.total_ht) || 0), 0)
      setLots((prev) => prev.map((l) => (l.id === lotId ? { ...l, total_ht: total } : l)))
      return
    }
    const { data } = await supabase
      .from('chiffrage_lignes' as never)
      .select('total_ht')
      .eq('lot_id', lotId)
    const rows = (data ?? []) as unknown as { total_ht: number | null }[]
    const total = rows.reduce((s, r) => s + (Number(r.total_ht) || 0), 0)
    await supabase.from('lots' as never).update({ total_ht: total } as never).eq('id', lotId)
    setLots((prev) => prev.map((l) => (l.id === lotId ? { ...l, total_ht: total } : l)))
  }

  async function insertLigne(lotId: string, draft: DraftLigne) {
    if (!draft.designation.trim()) return
    const type: LigneType = draft.type ?? 'ouvrage'
    const isOuvrage = type === 'ouvrage'
    const formule = draft.quantite_formule ?? null
    const q = isOuvrage
      ? (formule ? (evalFormula(formule) ?? parseNum(draft.quantite)) : parseNum(draft.quantite))
      : 0
    const pu = isOuvrage ? parseNum(draft.prix_unitaire) : 0
    const margePct = draft.marge_pct ? parseNum(draft.marge_pct) : null
    const ordre = lignes.length

    if (fakeData) {
      const total = isOuvrage ? Math.round(q * pu * (1 + (margePct ?? 0) / 100) * 100) / 100 : 0
      const newLigne: MetreLigne = {
        id: `fake-l-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        lot_id: lotId,
        projet_id: projetId,
        designation: draft.designation.trim(),
        detail: draft.detail.trim() || null,
        quantite: isOuvrage ? q : null,
        unite: isOuvrage ? unitToDb(draft.unite) : null,
        prix_unitaire: isOuvrage ? pu : null,
        total_ht: total,
        ordre,
        created_at: new Date().toISOString(),
        type,
        parent_id: draft.parent_id ?? null,
        quantite_formule: formule,
        marge_pct: margePct,
      }
      fakeLignesRef.current[lotId] = [...(fakeLignesRef.current[lotId] ?? []), newLigne]
      setErrorMsg(null)
      setLignes(fakeLignesRef.current[lotId])
      setNbLignesByLot((prev) => ({ ...prev, [lotId]: (prev[lotId] ?? 0) + 1 }))
      await recomputeLotTotal(lotId)
      return
    }

    const payload = {
      lot_id: lotId,
      projet_id: projetId,
      designation: draft.designation.trim(),
      detail: draft.detail.trim() || null,
      quantite: isOuvrage ? q : null,
      unite: isOuvrage ? unitToDb(draft.unite) : null,
      prix_unitaire: isOuvrage ? pu : null,
      ordre,
      type,
      parent_id: draft.parent_id ?? null,
      quantite_formule: formule,
      marge_pct: margePct,
    }
    const { data, error } = await supabase
      .from('chiffrage_lignes' as never)
      .insert(payload as never)
      .select()
      .single()
    if (error) {
      console.error('[MetresTab] insertLigne error:', error, 'payload:', payload)
      setErrorMsg(`Erreur ajout ligne : ${error.message}`)
      return
    }
    if (data) {
      setErrorMsg(null)
      setLignes((prev) => [...prev, data as unknown as MetreLigne])
      setNbLignesByLot((prev) => ({ ...prev, [lotId]: (prev[lotId] ?? 0) + 1 }))
      await recomputeLotTotal(lotId)
    }
  }

  async function updateLigne(ligne: MetreLigne, patch: Partial<MetreLigne>) {
    const merged = { ...ligne, ...patch }
    const isOuvrage = (merged.type ?? 'ouvrage') === 'ouvrage'
    const q = isOuvrage ? resolveQuantite(merged) : 0
    const pu = isOuvrage ? Number(merged.prix_unitaire) || 0 : 0
    const margePct = Number(merged.marge_pct) || 0
    const total = isOuvrage ? Math.round(q * pu * (1 + margePct / 100) * 100) / 100 : 0

    if (fakeData) {
      const current = fakeLignesRef.current[ligne.lot_id] ?? []
      fakeLignesRef.current[ligne.lot_id] = current.map((l) =>
        l.id === ligne.id ? { ...l, ...patch, total_ht: total } : l,
      )
      setErrorMsg(null)
      setLignes(fakeLignesRef.current[ligne.lot_id])
      await recomputeLotTotal(ligne.lot_id)
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { total_ht: _stripped, ...safePatch } = patch as Partial<MetreLigne>
    const { error } = await supabase
      .from('chiffrage_lignes' as never)
      .update(safePatch as never)
      .eq('id', ligne.id)
    if (error) {
      console.error('[MetresTab] updateLigne error:', error)
      setErrorMsg(`Erreur MAJ ligne : ${error.message}`)
      return
    }
    setErrorMsg(null)
    setLignes((prev) => prev.map((l) => (l.id === ligne.id ? { ...l, ...patch, total_ht: total } : l)))
    await recomputeLotTotal(ligne.lot_id)
  }

  async function deleteLigne(ligne: MetreLigne) {
    if (fakeData) {
      const current = fakeLignesRef.current[ligne.lot_id] ?? []
      fakeLignesRef.current[ligne.lot_id] = current.filter((l) => l.id !== ligne.id)
      setLignes(fakeLignesRef.current[ligne.lot_id])
      setNbLignesByLot((prev) => ({
        ...prev,
        [ligne.lot_id]: Math.max(0, (prev[ligne.lot_id] ?? 0) - 1),
      }))
      await recomputeLotTotal(ligne.lot_id)
      return
    }
    await supabase.from('chiffrage_lignes' as never).delete().eq('id', ligne.id)
    setLignes((prev) => prev.filter((l) => l.id !== ligne.id))
    setNbLignesByLot((prev) => ({
      ...prev,
      [ligne.lot_id]: Math.max(0, (prev[ligne.lot_id] ?? 0) - 1),
    }))
    await recomputeLotTotal(ligne.lot_id)
  }

  // ── Totaux
  const totalProjet = lots.reduce((s, l) => s + (Number(l.total_ht) || 0), 0)
  const activeLot = lots.find((l) => l.id === activeLotId) ?? null
  const sousTotal = lignes.reduce((s, l) => s + (Number(l.total_ht) || 0), 0)

  // ── Exports Excel
  function exportLotExcel(lot: Lot, rows: MetreLigne[]) {
    const wb = XLSX.utils.book_new()
    const ws = buildLotSheet(lot.nom, rows)
    XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(lot.nom))
    const stamp = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `metres_${lot.nom.replace(/[^a-z0-9]+/gi, '_')}_${stamp}.xlsx`)
  }

  async function exportProjetExcel() {
    const wb = XLSX.utils.book_new()

    // Récap
    const recap: (string | number)[][] = []
    recap.push(['Récapitulatif projet'])
    recap.push([])
    recap.push(['Lot', 'Nb lignes', 'Sous-total HT'])
    lots.forEach((l) => {
      recap.push([l.nom, nbLignesByLot[l.id] ?? 0, Number(l.total_ht) || 0])
    })
    recap.push([])
    recap.push(['TOTAL PROJET', '', totalProjet])
    const wsRecap = XLSX.utils.aoa_to_sheet(recap)
    wsRecap['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, wsRecap, 'Récapitulatif')

    // Une feuille par lot
    for (const lot of lots) {
      let rows: MetreLigne[]
      if (fakeData) {
        rows = fakeLignesRef.current[lot.id] ?? []
      } else {
        const { data } = await supabase
          .from('chiffrage_lignes' as never)
          .select('*')
          .eq('lot_id', lot.id)
          .order('ordre', { ascending: true })
          .order('created_at', { ascending: true })
        rows = ((data ?? []) as unknown) as MetreLigne[]
      }
      const ws = buildLotSheet(lot.nom, rows)
      XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(lot.nom))
    }

    const stamp = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `metres_projet_${stamp}.xlsx`)
  }

  const [nbLignesByLot, setNbLignesByLot] = useState<Record<string, number>>({})

  async function loadAllCounts(lotList: Lot[]) {
    if (fakeData) {
      const counts: Record<string, number> = {}
      lotList.forEach((l) => {
        counts[l.id] = (fakeLignesRef.current[l.id] ?? []).length
      })
      setNbLignesByLot(counts)
      return
    }
    const counts: Record<string, number> = {}
    await Promise.all(
      lotList.map(async (l) => {
        const { count } = await supabase
          .from('chiffrage_lignes' as never)
          .select('id', { count: 'exact', head: true })
          .eq('lot_id', l.id)
        counts[l.id] = count ?? 0
      }),
    )
    setNbLignesByLot(counts)
  }

  useEffect(() => {
    if (lots.length) loadAllCounts(lots)
    else setNbLignesByLot({})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lots.map((l) => l.id).join('|')])

  if (loading) {
    return <div className="text-sm text-gray-400 py-8 text-center">Chargement…</div>
  }

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2 flex items-start justify-between gap-4">
          <span className="flex-1">{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-600 text-xs">Fermer</button>
        </div>
      )}
      <div ref={containerRef} className="flex items-stretch gap-0 min-h-[540px]">
        {/* ═════ PANNEAU GAUCHE ═════ */}
        <aside
          style={{ width: leftWidth }}
          className="flex-shrink-0 bg-gray-50 border border-gray-200 rounded-lg flex flex-col"
        >
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">Lots</h3>
            {showPrices ? (
              <p className="mt-1 text-[15px] font-medium text-gray-900">
                Total : {formatCurrency(totalProjet)} <span className="text-xs text-gray-400 font-normal"><Abbr k="HT" /></span>
              </p>
            ) : (
              <p className="mt-1 text-xs text-gray-400">{lots.length} lot{lots.length > 1 ? 's' : ''}</p>
            )}
          </div>

          {/* Ajouter lot — toujours visible en haut */}
          <div className="p-2 border-b border-gray-200 relative">
            <button
              onClick={() => {
                setShowLotMenu((v) => !v)
                setCustomLotName(null)
              }}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm text-gray-600 hover:bg-white hover:text-gray-900 transition-colors border border-dashed border-gray-300"
            >
              <Plus className="w-3.5 h-3.5" />
              Nouveau lot
              <ChevronDown className={cn('w-3 h-3 transition-transform', showLotMenu && 'rotate-180')} />
            </button>

            {showLotMenu && (
              <div className="absolute top-full left-2 right-2 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-[340px] overflow-y-auto z-20">
                {customLotName === null ? (
                  <>
                    <p className="px-3 py-1.5 text-[10px] text-gray-400 uppercase tracking-wider">Corps d'état standards</p>
                    {(biblioCorps.length > 0
                      ? biblioCorps.map((c) => ({ key: c.id, nom: c.nom }))
                      : CORPS_ETAT_FALLBACK.map((nom) => ({ key: nom, nom }))
                    ).map((c) => (
                      <button
                        key={c.key}
                        onClick={() => {
                          createLot(c.nom)
                          setShowLotMenu(false)
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                      >
                        {c.nom}
                      </button>
                    ))}
                    <button
                      onClick={() => setCustomLotName('')}
                      className="w-full text-left px-3 py-2 text-sm italic text-blue-600 hover:bg-gray-50"
                    >
                      Personnalisé…
                    </button>
                  </>
                ) : (
                  <div className="p-2">
                    <input
                      autoFocus
                      type="text"
                      value={customLotName}
                      onChange={(e) => setCustomLotName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && customLotName.trim()) {
                          createLot(customLotName.trim())
                          setShowLotMenu(false)
                          setCustomLotName(null)
                        } else if (e.key === 'Escape') {
                          setShowLotMenu(false)
                          setCustomLotName(null)
                        }
                      }}
                      placeholder="Nom du lot…"
                      className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-500"
                    />
                    <div className="flex justify-end gap-1 mt-2">
                      <button
                        onClick={() => {
                          setShowLotMenu(false)
                          setCustomLotName(null)
                        }}
                        className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={() => {
                          if (customLotName.trim()) {
                            createLot(customLotName.trim())
                            setShowLotMenu(false)
                            setCustomLotName(null)
                          }
                        }}
                        className="px-3 py-1 text-xs bg-gray-900 text-white rounded hover:bg-black"
                      >
                        Créer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <ul className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {lots.length === 0 && (
              <li className="text-xs text-gray-400 px-2 py-6 text-center">Aucun lot</li>
            )}
            {lots.map((lot) => {
              const isActive = lot.id === activeLotId
              const isEditing = editLotId === lot.id
              return (
                <li key={lot.id} className="group relative">
                  {isEditing ? (
                    <div className="flex items-center gap-1 px-2 py-1.5">
                      <input
                        type="text"
                        value={editLotNom}
                        onChange={(e) => setEditLotNom(e.target.value)}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter' && editLotNom.trim()) {
                            await supabase.from('lots' as never).update({ nom: editLotNom.trim() } as never).eq('id', lot.id)
                            setEditLotId(null)
                            refreshLots()
                          }
                          if (e.key === 'Escape') setEditLotId(null)
                        }}
                        onBlur={async () => {
                          if (editLotNom.trim() && editLotNom !== lot.nom) {
                            await supabase.from('lots' as never).update({ nom: editLotNom.trim() } as never).eq('id', lot.id)
                            refreshLots()
                          }
                          setEditLotId(null)
                        }}
                        className="flex-1 px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => setActiveLotId(lot.id)}
                      onDoubleClick={() => { if (!fakeData) { setEditLotId(lot.id); setEditLotNom(lot.nom) } }}
                      className={cn(
                        'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-left transition-colors',
                        isActive
                          ? 'bg-blue-50 border-l-[3px] border-blue-600 pl-[9px]'
                          : 'hover:bg-white border-l-[3px] border-transparent pl-[9px]',
                      )}
                    >
                      <span className={cn('text-sm truncate', isActive ? 'font-medium text-gray-900' : 'text-gray-700')}>
                        {lot.nom}
                      </span>
                      {showPrices ? (
                        <span className={cn('text-xs whitespace-nowrap', isActive ? 'text-gray-700' : 'text-gray-400')}>
                          {formatCurrency(Number(lot.total_ht) || 0)} <span className="text-[10px]"><Abbr k="HT" /></span>
                        </span>
                      ) : (
                        <span className={cn('text-[11px] whitespace-nowrap', isActive ? 'text-gray-600' : 'text-gray-400')}>
                          {nbLignesByLot[lot.id] ?? 0} lg
                        </span>
                      )}
                    </button>
                  )}
                  <div className="absolute top-1/2 -translate-y-1/2 right-1 opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
                    {!fakeData && !isEditing && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditLotId(lot.id); setEditLotNom(lot.nom) }}
                        className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-opacity"
                        title="Renommer le lot"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteLot(lot.id) }}
                      className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-opacity"
                      title="Supprimer le lot"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </aside>

        {/* Poignée de redimensionnement */}
        <div
          onMouseDown={startResize}
          onDoubleClick={() => {
            setLeftWidth(280)
            try { localStorage.setItem('metres_left_width', '280') } catch {}
          }}
          title="Glisser pour redimensionner — double-clic pour réinitialiser"
          className="group w-1 mx-1 cursor-col-resize flex-shrink-0 flex items-center justify-center"
        >
          <div className="w-0.5 h-full bg-gray-200 group-hover:bg-blue-400 transition-colors rounded" />
        </div>

        {/* ═════ PANNEAU DROIT ═════ */}
        <section className="flex-1 min-w-0 bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col">
          {!activeLot ? (
            <div className="flex-1 flex items-center justify-center p-12 text-sm text-gray-400">
              Créez un premier lot dans le panneau de gauche
            </div>
          ) : mode === 'lots' ? (
            /* Mode Lots : pas de tableau metré, juste le résumé + bouton bibliothèque */
            <div className="flex-1 flex flex-col">
              <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{activeLot.nom}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {lignes.length} ligne{lignes.length > 1 ? 's' : ''} de métré{lignes.length > 0 ? <> · Total éco {formatCurrency(sousTotal)} <Abbr k="HT" /></> : ''}
                  </p>
                </div>
                {!fakeData && (
                  <button
                    onClick={() => setShowOuvragePicker(true)}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-black"
                  >
                    <Library className="w-3.5 h-3.5" />
                    Ajouter depuis la bibliothèque
                  </button>
                )}
              </div>
              {lignes.length === 0 ? (
                <div className="flex-1 flex items-center justify-center p-10 text-center">
                  <div>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 text-gray-200 mx-auto mb-3">
                      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                    </svg>
                    <p className="text-sm font-medium text-gray-700">Lot vide</p>
                    <p className="text-xs text-gray-400 mt-1">Ajoutez des ouvrages depuis la bibliothèque ou passez à l'onglet Métrés pour saisir manuellement.</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-4">
                  <ul className="space-y-1.5">
                    {lignes.map((l) => (
                      <li key={l.id} className="flex items-center gap-3 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm">
                        <div className="flex-1 min-w-0">
                          <span className="text-gray-900 font-medium">{l.designation}</span>
                          {l.detail && <span className="text-gray-400 ml-1 text-xs">— {l.detail}</span>}
                        </div>
                        <span className="text-xs text-gray-500 tabular-nums">{Number(l.quantite) || 0} {l.unite}</span>
                        {showPrices && <span className="text-xs text-gray-700 tabular-nums">{formatCurrency(Number(l.total_ht) || 0)}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <LotDetailPanel
              lot={activeLot}
              lignes={lignes}
              showPrices={showPrices}
              showMarge={showMarge}
              onToggleMarge={() => setShowMarge((v) => !v)}
              onRenameLot={(nom) => renameLot(activeLot.id, nom)}
              onDeleteLot={() => deleteLot(activeLot.id)}
              onInsertLigne={(draft) => insertLigne(activeLot.id, draft)}
              onUpdateLigne={updateLigne}
              onDeleteLigne={deleteLigne}
              onExport={() => exportLotExcel(activeLot, lignes)}
              onShowOuvragePicker={fakeData ? undefined : () => setShowOuvragePicker(true)}
            />
          )}
        </section>
      </div>

      {/* ═════ RÉCAPITULATIF ═════ */}
      {lots.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-gray-900">Récapitulatif projet</h3>
            <div className="flex items-center gap-2">
              {showPrices && totalProjet > 0 && !fakeData && (
                <button
                  onClick={() => setShowSubmitCO(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-black"
                >
                  <Send className="w-3.5 h-3.5" />
                  Soumettre au <Abbr k="CO" />
                </button>
              )}
              <button
                onClick={exportProjetExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 hover:border-gray-300 transition-colors"
                title="Exporter tous les lots (1 feuille par lot + récap)"
              >
                <Download className="w-3.5 h-3.5" />
                Exporter le projet
              </button>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 border-b border-gray-100">
                <th className="px-4 py-2">Lot</th>
                <th className="px-4 py-2 w-32">Nb lignes</th>
                {showPrices && <th className="px-4 py-2 w-40 text-right">Sous-total <Abbr k="HT" /></th>}
              </tr>
            </thead>
            <tbody>
              {lots.map((l) => (
                <tr key={l.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-2.5 text-gray-900">{l.nom}</td>
                  <td className="px-4 py-2.5 text-gray-500">{nbLignesByLot[l.id] ?? 0} ligne{(nbLignesByLot[l.id] ?? 0) > 1 ? 's' : ''}</td>
                  {showPrices && (
                    <td className="px-4 py-2.5 text-right text-gray-900 tabular-nums">
                      {formatCurrency(Number(l.total_ht) || 0)}
                    </td>
                  )}
                </tr>
              ))}
              {showPrices && (
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-4 py-2.5 text-gray-900">TOTAL PROJET</td>
                  <td className="px-4 py-2.5" />
                  <td className="px-4 py-2.5 text-right text-gray-900 tabular-nums">
                    {formatCurrency(totalProjet)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ═════ MODAL SOUMETTRE AU CO ═════ */}
      {showSubmitCO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Soumettre le chiffrage au <Abbr k="CO" /></h3>
              <button onClick={() => setShowSubmitCO(false)} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="bg-gray-50 border border-gray-200 rounded-md p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total chiffrage</span>
                  <span className="font-semibold text-gray-900 tabular-nums">{formatCurrency(totalProjet)} <Abbr k="HT" /></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Nombre de lots</span>
                  <span className="text-gray-900">{lots.length} lots</span>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Le <Abbr k="CO" /> du projet recevra une notification avec le montant total. Il pourra valider ou demander des modifications.
              </p>
            </div>
            <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setShowSubmitCO(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
              <button
                onClick={async () => {
                  setSubmittingCO(true)
                  // Cherche la demande existante pour ce projet (sinon en crée une)
                  const { data: existing } = await supabase
                    .from('demandes_chiffrage')
                    .select('id')
                    .eq('projet_id', projetId)
                    .in('statut', ['en_attente', 'en_cours'])
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()
                  if (existing) {
                    await supabase.from('demandes_chiffrage').update({
                      statut: 'soumis_co',
                      montant_ht: totalProjet,
                      updated_at: new Date().toISOString(),
                    } as never).eq('id', (existing as { id: string }).id)
                  } else {
                    await supabase.from('demandes_chiffrage').insert({
                      projet_id: projetId,
                      economiste_id: null,
                      commercial_id: null,
                      titre: 'Chiffrage soumis',
                      statut: 'soumis_co',
                      montant_ht: totalProjet,
                    } as never)
                  }
                  // Notif au CO
                  const { data: proj } = await supabase.schema('app').from('projets')
                    .select('co_id, nom').eq('id', projetId).maybeSingle()
                  const p = proj as { co_id: string | null; nom: string } | null
                  if (p?.co_id) {
                    await supabase.schema('app').from('alertes').insert({
                      projet_id: projetId,
                      utilisateur_id: p.co_id,
                      type: 'chiffrage_soumis',
                      titre: `Chiffrage soumis — ${p.nom}`,
                      message: `Total : ${formatCurrency(totalProjet)} HT · ${lots.length} lots`,
                      priorite: 'high',
                      lue: false,
                      metadata: { url: `/co/projets/${projetId}` },
                    })
                  }
                  setSubmittingCO(false)
                  setShowSubmitCO(false)
                }}
                disabled={submittingCO}
                className="px-4 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-black disabled:bg-gray-300"
              >
                {submittingCO ? 'Envoi…' : 'Confirmer la soumission'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════ MODAL SÉLECTION OUVRAGES BIBLIOTHÈQUE ═════ */}
      {showOuvragePicker && activeLot && (
        <OuvragePickerModal
          lotNom={activeLot.nom}
          projetId={projetId}
          lotId={activeLot.id}
          onClose={() => setShowOuvragePicker(false)}
          onInserted={async () => {
            await refreshLignes(activeLot.id)
            await recomputeLotTotal(activeLot.id)
            setShowOuvragePicker(false)
          }}
        />
      )}
    </div>
  )
}

// ─── Modal sélection ouvrages bibliotheque (biblio_items hierarchique) ─────

type BiblioItemMin = {
  id: string
  type: 'lot' | 'chapitre' | 'ouvrage'
  parent_id: string | null
  designation: string
  detail: string | null
  unite: string | null
  prix_ref: number | null
  ordre: number
  source_code: string | null
}

function OuvragePickerModal({
  lotNom,
  projetId,
  lotId,
  onClose,
  onInserted,
}: {
  lotNom: string
  projetId: string
  lotId: string
  onClose: () => void
  onInserted: () => Promise<void> | void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [lots, setLots] = useState<BiblioItemMin[]>([])
  const [items, setItems] = useState<BiblioItemMin[]>([])  // chapitres + ouvrages du lot selectionne
  const [selectedLotId, setSelectedLotId] = useState<string>('')
  const [loadingLots, setLoadingLots] = useState(true)
  const [loadingItems, setLoadingItems] = useState(false)
  const [search, setSearch] = useState('')
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [inserting, setInserting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Chargement des lots biblio
  useEffect(() => {
    let cancelled = false
    supabase.from('biblio_items').select('*').eq('type', 'lot').order('ordre')
      .then(({ data }) => {
        if (cancelled) return
        const rows = (data ?? []) as BiblioItemMin[]
        setLots(rows)
        // Auto-select lot matching nom
        const match = rows.find((l) =>
          lotNom.toLowerCase().includes(l.designation.toLowerCase()) ||
          l.designation.toLowerCase().includes(lotNom.toLowerCase()),
        )
        setSelectedLotId(match?.id ?? rows[0]?.id ?? '')
        setLoadingLots(false)
      })
    return () => { cancelled = true }
  }, [supabase, lotNom])

  // Chargement des descendants (chapitres + ouvrages) du lot selectionne
  useEffect(() => {
    if (!selectedLotId) { setItems([]); return }
    let cancelled = false
    setLoadingItems(true)
    setChecked(new Set())
    setExpanded(new Set())
    ;(async () => {
      // BFS pour recuperer tous les descendants
      const all: BiblioItemMin[] = []
      let parents = [selectedLotId]
      while (parents.length > 0) {
        const { data } = await supabase
          .from('biblio_items').select('*').in('parent_id', parents)
        if (cancelled) return
        const rows = (data ?? []) as BiblioItemMin[]
        all.push(...rows)
        parents = rows.map((r) => r.id)
      }
      setItems(all)
      // Tous les chapitres expanded par defaut
      setExpanded(new Set(all.filter((i) => i.type === 'chapitre').map((i) => i.id)))
      setLoadingItems(false)
    })()
    return () => { cancelled = true }
  }, [supabase, selectedLotId])

  // Tree par parent_id
  const byParent = useMemo(() => {
    const map = new Map<string | null, BiblioItemMin[]>()
    items.forEach((it) => {
      const p = it.parent_id ?? null
      if (!map.has(p)) map.set(p, [])
      map.get(p)!.push(it)
    })
    map.forEach((arr) => arr.sort((a, b) => a.ordre - b.ordre))
    return map
  }, [items])

  const directChildren = byParent.get(selectedLotId) ?? []

  // Recherche : si filtre actif, on flatten + filtre les ouvrages
  const flatOuvrages = items.filter((i) => i.type === 'ouvrage')
  const searchActive = search.trim().length > 0
  const filteredOuvrages = searchActive
    ? flatOuvrages.filter((o) => {
        const q = search.toLowerCase()
        return o.designation.toLowerCase().includes(q) ||
          (o.detail ?? '').toLowerCase().includes(q) ||
          (o.source_code ?? '').toLowerCase().includes(q)
      })
    : []

  function toggleCheck(id: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // Pour chaque chapitre coche, on importe le sous-arbre. Pour chaque ouvrage coche, on l'importe seul.
  // On exclut les ouvrages dont le chapitre parent est deja coche (sinon doublon).
  function effectiveSelection(): string[] {
    const checkedSet = new Set(checked)
    const result: string[] = []
    for (const id of checkedSet) {
      const item = items.find((i) => i.id === id)
      if (!item) continue
      // Si un ancetre est coche, on skip
      let cur = item.parent_id
      let ancestorChecked = false
      while (cur && cur !== selectedLotId) {
        if (checkedSet.has(cur)) { ancestorChecked = true; break }
        cur = items.find((i) => i.id === cur)?.parent_id ?? null
      }
      if (!ancestorChecked) result.push(id)
    }
    return result
  }

  async function handleInsert() {
    setError(null)
    setInserting(true)
    try {
      const ids = effectiveSelection()
      const { importFromBiblio } = await import('@/app/_actions/biblio')
      for (const id of ids) {
        await importFromBiblio({ itemId: id, projetId, lotId })
      }
      await onInserted()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur a l\'import')
    } finally {
      setInserting(false)
    }
  }

  function renderTreeItem(item: BiblioItemMin, level: number) {
    if (item.type === 'chapitre') {
      const children = byParent.get(item.id) ?? []
      const isOpen = expanded.has(item.id)
      const isChecked = checked.has(item.id)
      return (
        <div key={item.id}>
          <div
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50"
            style={{ paddingLeft: `${12 + level * 16}px` }}
          >
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => toggleCheck(item.id)}
              className="w-3.5 h-3.5 rounded border-gray-300 text-gray-900 focus:ring-gray-400"
            />
            <button onClick={() => toggleExpand(item.id)} className="text-gray-400 hover:text-gray-700">
              {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
            {item.source_code && <span className="text-[11px] font-mono text-gray-400">{item.source_code}</span>}
            <span className="text-sm font-medium text-gray-800 truncate">{item.designation}</span>
            <span className="text-[11px] text-gray-400 ml-auto">
              {children.filter((c) => c.type === 'ouvrage').length} ouvr.
            </span>
          </div>
          {isOpen && children.map((c) => renderTreeItem(c, level + 1))}
        </div>
      )
    }
    // Ouvrage
    const isChecked = checked.has(item.id)
    return (
      <div
        key={item.id}
        className="flex items-start gap-2 px-3 py-1.5 hover:bg-gray-50"
        style={{ paddingLeft: `${28 + level * 16}px` }}
      >
        <input
          type="checkbox"
          checked={isChecked}
          onChange={() => toggleCheck(item.id)}
          className="w-3.5 h-3.5 mt-1 rounded border-gray-300 text-gray-900 focus:ring-gray-400"
        />
        {item.source_code && <span className="text-[10px] font-mono text-gray-400 mt-0.5 w-12">{item.source_code}</span>}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-800 truncate">{item.designation}</p>
          {item.detail && <p className="text-[11px] text-gray-500 line-clamp-1">{item.detail}</p>}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-gray-500 flex-shrink-0">
          {item.unite && <span>{item.unite === 'm2' ? 'm²' : item.unite === 'm3' ? 'm³' : item.unite}</span>}
          <span className="tabular-nums w-16 text-right">{item.prix_ref != null ? item.prix_ref + ' EUR' : '—'}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Importer depuis la bibliotheque</h3>
            <p className="text-xs text-gray-500 mt-0.5">Vers le lot : {lotNom}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
        </div>

        {/* Pills lots biblio */}
        <div className="px-5 py-2 border-b border-gray-100 overflow-x-auto flex-shrink-0">
          {loadingLots ? (
            <p className="text-xs text-gray-400">Chargement des lots...</p>
          ) : (
            <div className="flex items-center gap-1.5">
              {lots.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setSelectedLotId(l.id)}
                  className={cn(
                    'text-xs px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors',
                    l.id === selectedLotId
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400',
                  )}
                >
                  {l.source_code && <span className="opacity-60 mr-1">{l.source_code}</span>}
                  {l.designation}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Recherche */}
        <div className="px-5 py-2 border-b border-gray-100 flex-shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher dans tous les ouvrages du lot..."
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-y-auto">
          {loadingItems ? (
            <p className="text-sm text-gray-400 text-center py-10">Chargement...</p>
          ) : searchActive ? (
            filteredOuvrages.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">Aucun ouvrage trouve</p>
            ) : (
              <div>{filteredOuvrages.map((o) => renderTreeItem(o, 0))}</div>
            )
          ) : directChildren.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">Aucun chapitre dans ce lot</p>
          ) : (
            <div>{directChildren.map((c) => renderTreeItem(c, 0))}</div>
          )}
        </div>

        {error && (
          <div className="px-5 py-2 bg-red-50 border-t border-red-200 text-xs text-red-700 flex-shrink-0">{error}</div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
          <p className="text-xs text-gray-500">
            {checked.size} item{checked.size > 1 ? 's' : ''} selectionne{checked.size > 1 ? 's' : ''}
            {checked.size > 0 && <span className="ml-2 text-gray-400">(les chapitres importent leurs ouvrages)</span>}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
            <button
              onClick={handleInsert}
              disabled={checked.size === 0 || inserting}
              className="px-4 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-black disabled:bg-gray-300"
            >
              {inserting ? 'Import...' : `Importer ${effectiveSelection().length} item${effectiveSelection().length > 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Panneau droit ────────────────────────────────────────────────────────────

type TreeRow = { ligne: MetreLigne; code: string; level: number; childTotal: number }

function buildTree(lignes: MetreLigne[], rootPrefix: string = ''): { rows: TreeRow[]; sousTotal: number } {
  const byParent = new Map<string | null, MetreLigne[]>()
  lignes.forEach((l) => {
    const p = l.parent_id ?? null
    if (!byParent.has(p)) byParent.set(p, [])
    byParent.get(p)!.push(l)
  })
  byParent.forEach((arr) => arr.sort((a, b) => a.ordre - b.ordre))

  function ouvrageTotal(l: MetreLigne): number {
    if ((l.type ?? 'ouvrage') !== 'ouvrage') return 0
    const q = resolveQuantite(l)
    const pu = Number(l.prix_unitaire) || 0
    const m = Number(l.marge_pct) || 0
    return q * pu * (1 + m / 100)
  }
  function subTotalOf(parentId: string | null): number {
    const children = byParent.get(parentId) ?? []
    let t = 0
    for (const c of children) {
      if ((c.type ?? 'ouvrage') === 'chapitre') t += subTotalOf(c.id)
      else t += ouvrageTotal(c)
    }
    return t
  }

  const rows: TreeRow[] = []
  function walk(parentId: string | null, parentCode: string, level: number) {
    const children = byParent.get(parentId) ?? []
    children.forEach((c, i) => {
      const code = parentCode ? `${parentCode}.${i + 1}` : `${i + 1}`
      const childTotal = (c.type ?? 'ouvrage') === 'chapitre' ? subTotalOf(c.id) : ouvrageTotal(c)
      rows.push({ ligne: c, code, level, childTotal })
      walk(c.id, code, level + 1)
    })
  }
  walk(null, rootPrefix, rootPrefix ? 1 : 0)
  return { rows, sousTotal: subTotalOf(null) }
}

function LotDetailPanel({
  lot,
  lignes,
  showPrices,
  showMarge,
  onToggleMarge,
  onRenameLot,
  onDeleteLot,
  onInsertLigne,
  onUpdateLigne,
  onDeleteLigne,
  onExport,
  onShowOuvragePicker,
}: {
  lot: Lot
  lignes: MetreLigne[]
  showPrices: boolean
  showMarge: boolean
  onToggleMarge?: () => void
  onRenameLot: (nom: string) => void
  onDeleteLot?: () => void
  onInsertLigne: (draft: DraftLigne) => Promise<void>
  onUpdateLigne: (ligne: MetreLigne, patch: Partial<MetreLigne>) => Promise<void>
  onDeleteLigne: (ligne: MetreLigne) => Promise<void>
  onExport: () => void
  onShowOuvragePicker?: () => void
}) {
  const lotPrefix = String((lot.ordre ?? 0) + 1)
  const { rows: tree, sousTotal } = useMemo(() => buildTree(lignes, lotPrefix), [lignes, lotPrefix])
  const colCount = 5 + (showPrices ? 1 : 0) + (showPrices && showMarge ? 1 : 0) + (showPrices ? 1 : 0)
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(lot.nom)
  useEffect(() => setNameValue(lot.nom), [lot.id, lot.nom])

  const [draft, setDraft] = useState<DraftLigne>(emptyDraft())
  const [designationError, setDesignationError] = useState(false)
  const designationNewRef = useRef<HTMLInputElement>(null)
  const rowRef = useRef<HTMLTableRowElement>(null)

  // Edition inline du nom du Lot dans la ligne synthetique
  const [lotMenuOpen, setLotMenuOpen] = useState(false)
  const [editingLotInline, setEditingLotInline] = useState(false)
  const [lotNameDraft, setLotNameDraft] = useState(lot.nom)
  useEffect(() => { setLotNameDraft(lot.nom) }, [lot.id, lot.nom])

  const draftHasData =
    draft.designation.trim() !== '' ||
    draft.detail.trim() !== '' ||
    draft.quantite !== '' ||
    draft.prix_unitaire !== ''

  async function commitDraft() {
    if (!draft.designation.trim()) {
      if (draftHasData) {
        setDesignationError(true)
        designationNewRef.current?.focus()
      }
      return
    }
    setDesignationError(false)
    const d = draft
    setDraft(emptyDraft())
    await onInsertLigne(d)
    setTimeout(() => designationNewRef.current?.focus(), 30)
  }

  function handleRowBlur(e: React.FocusEvent<HTMLTableRowElement>) {
    const next = e.relatedTarget as Node | null
    if (next && rowRef.current?.contains(next)) return
    if (draft.designation.trim()) commitDraft()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitDraft()
    }
  }

  return (
    <>
      {/* En-tête lot */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {editingName ? (
            <input
              autoFocus
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={() => {
                if (nameValue.trim() && nameValue !== lot.nom) onRenameLot(nameValue.trim())
                else setNameValue(lot.nom)
                setEditingName(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
                if (e.key === 'Escape') {
                  setNameValue(lot.nom)
                  setEditingName(false)
                }
              }}
              className="text-base font-semibold text-gray-900 border-b border-blue-500 focus:outline-none bg-transparent w-full"
            />
          ) : (
            <h2
              onClick={() => setEditingName(true)}
              className="text-base font-semibold text-gray-900 cursor-text hover:text-gray-700 truncate"
              title="Cliquer pour renommer"
            >
              {lot.nom}
            </h2>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {showPrices ? (
            <div className="text-sm text-gray-700 whitespace-nowrap">
              Sous-total : <span className="font-semibold text-gray-900 tabular-nums">{formatCurrency(sousTotal)}</span>{' '}
              <span className="text-xs text-gray-400"><Abbr k="HT" /></span>
            </div>
          ) : (
            <div className="text-xs text-gray-400 whitespace-nowrap">
              {lignes.length} ligne{lignes.length > 1 ? 's' : ''}
            </div>
          )}
          <button
            onClick={onExport}
            disabled={lignes.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Exporter ce lot en Excel"
          >
            <Download className="w-3.5 h-3.5" />
            Exporter
          </button>
        </div>
      </div>

      {/* Tableau */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr className="text-left text-xs font-medium text-gray-500">
              <th className="px-3 py-2 w-16">Code</th>
              <th className="px-3 py-2 min-w-[260px]">Désignation</th>
              <th className="px-3 py-2 w-28">Quantité</th>
              <th className="px-3 py-2 w-20">Unité</th>
              {showPrices && <th className="px-3 py-2 w-28">PU <Abbr k="HT" /></th>}
              {showPrices && showMarge && <th className="px-3 py-2 w-20">Marge %</th>}
              {showPrices && <th className="px-3 py-2 w-32 text-right">Total <Abbr k="HT" /></th>}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {/* Ligne synthetique du LOT (toujours affichee) */}
            <tr className="group border-t border-gray-200 bg-gray-200">
              <td className="px-3 py-2 text-xs font-bold text-gray-800 tabular-nums align-middle">{lotPrefix}</td>
              <td className="px-2 py-2 align-middle" colSpan={showPrices ? colCount - 3 : colCount - 2}>
                {editingLotInline ? (
                  <input
                    autoFocus
                    type="text"
                    value={lotNameDraft}
                    onChange={(e) => setLotNameDraft(e.target.value)}
                    onBlur={() => {
                      if (lotNameDraft.trim() && lotNameDraft !== lot.nom) onRenameLot(lotNameDraft.trim())
                      else setLotNameDraft(lot.nom)
                      setEditingLotInline(false)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur()
                      if (e.key === 'Escape') { setLotNameDraft(lot.nom); setEditingLotInline(false) }
                    }}
                    className="text-sm font-bold uppercase tracking-wide text-gray-900 bg-white border border-blue-500 rounded px-2 py-1 w-full focus:outline-none"
                  />
                ) : (
                  <span
                    onClick={() => setEditingLotInline(true)}
                    className="text-sm font-bold uppercase tracking-wide text-gray-900 cursor-text hover:text-gray-700"
                    title="Cliquer pour renommer"
                  >
                    {lot.nom}
                  </span>
                )}
              </td>
              {showPrices && (
                <td className="px-3 py-2 text-right text-sm font-bold text-gray-900 tabular-nums align-middle">
                  {sousTotal > 0 ? formatCurrency(sousTotal) : '—'}
                </td>
              )}
              <td className="px-1 py-1 text-center align-middle relative">
                <RowActions
                  menuOpen={lotMenuOpen}
                  setMenuOpen={setLotMenuOpen}
                  isContainer
                  alwaysVisible
                  addChildLabel="Ajouter un chapitre"
                  onAddChild={async () => {
                    await onInsertLigne({
                      designation: 'Nouveau chapitre',
                      detail: '',
                      quantite: '',
                      unite: 'u',
                      prix_unitaire: '',
                      type: 'chapitre',
                      parent_id: null,
                    })
                  }}
                  onRename={() => setEditingLotInline(true)}
                  onDelete={() => { if (onDeleteLot) onDeleteLot() }}
                />
              </td>
            </tr>

            {lignes.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-3 py-10 text-center text-xs text-gray-400">
                  Ajoutez un chapitre ou un ouvrage dans ce lot
                </td>
              </tr>
            )}
            {tree.map(({ ligne, code, level, childTotal }) => (
              <LigneRow
                key={ligne.id}
                ligne={ligne}
                code={code}
                level={level}
                childTotal={childTotal}
                showPrices={showPrices}
                showMarge={showMarge}
                colCount={colCount}
                onUpdate={onUpdateLigne}
                onDelete={onDeleteLigne}
                onAddChild={async () => {
                  await onInsertLigne({
                    designation: 'Nouvel ouvrage',
                    detail: '',
                    quantite: '',
                    unite: 'u',
                    prix_unitaire: '',
                    type: 'ouvrage',
                    parent_id: ligne.id,
                  })
                }}
                onDuplicate={async () => {
                  await onInsertLigne({
                    designation: (ligne.designation ?? '') + ' (copie)',
                    detail: ligne.detail ?? '',
                    quantite: ligne.quantite != null ? String(ligne.quantite) : '',
                    unite: unitFromDb(ligne.unite),
                    prix_unitaire: ligne.prix_unitaire != null ? String(ligne.prix_unitaire) : '',
                    type: ligne.type ?? 'ouvrage',
                    parent_id: ligne.parent_id ?? null,
                    quantite_formule: ligne.quantite_formule ?? null,
                    marge_pct: ligne.marge_pct != null ? String(ligne.marge_pct) : undefined,
                  })
                }}
                onIndent={async () => {
                  // Trouver le frere precedent comme nouveau parent
                  const siblings = lignes
                    .filter((l) => (l.parent_id ?? null) === (ligne.parent_id ?? null))
                    .sort((a, b) => a.ordre - b.ordre)
                  const idx = siblings.findIndex((s) => s.id === ligne.id)
                  if (idx > 0) {
                    await onUpdateLigne(ligne, { parent_id: siblings[idx - 1].id })
                  }
                }}
                onOutdent={async () => {
                  if (!ligne.parent_id) return
                  const parent = lignes.find((l) => l.id === ligne.parent_id)
                  if (!parent) return
                  await onUpdateLigne(ligne, { parent_id: parent.parent_id ?? null })
                }}
              />
            ))}

            {/* Ligne vierge de saisie rapide */}
            <tr
              ref={rowRef}
              onBlur={handleRowBlur}
              className="group border-t border-gray-100 bg-blue-50/30"
            >
              <td className="px-2 py-1">
                <select
                  value={draft.type ?? 'ouvrage'}
                  onChange={(e) => setDraft({ ...draft, type: e.target.value as LigneType })}
                  className="w-full px-1 py-1 bg-transparent border border-transparent focus:border-blue-500 focus:bg-white rounded focus:outline-none text-xs"
                  title="Type de ligne"
                >
                  <option value="chapitre">Chap.</option>
                  <option value="ouvrage">Ouvr.</option>
                </select>
              </td>
              <td className="px-2 py-1">
                <input
                  ref={designationNewRef}
                  type="text"
                  value={draft.designation}
                  onChange={(e) => {
                    setDraft({ ...draft, designation: e.target.value })
                    if (e.target.value.trim()) setDesignationError(false)
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={(draft.type ?? 'ouvrage') === 'chapitre' ? 'Titre du chapitre' : 'Designation de l\'ouvrage'}
                  className={cn(
                    'w-full px-1.5 py-1 bg-transparent border rounded focus:outline-none text-sm transition-colors',
                    designationError
                      ? 'border-red-400 bg-red-50 focus:border-red-500'
                      : 'border-transparent focus:border-blue-500 focus:bg-white',
                  )}
                />
                {(draft.type ?? 'ouvrage') === 'ouvrage' && (
                  <input
                    type="text"
                    value={draft.detail}
                    onChange={(e) => setDraft({ ...draft, detail: e.target.value })}
                    onKeyDown={handleKeyDown}
                    placeholder="Detail (optionnel)"
                    className="w-full px-1.5 py-0.5 mt-0.5 bg-transparent border border-transparent focus:border-blue-500 focus:bg-white rounded focus:outline-none text-xs text-gray-500"
                  />
                )}
              </td>
              <td className="px-2 py-1">
                {(draft.type ?? 'ouvrage') === 'ouvrage' && (
                  <input
                    type="text"
                    value={draft.quantite}
                    onChange={(e) => setDraft({ ...draft, quantite: e.target.value })}
                    onKeyDown={handleKeyDown}
                    placeholder="0 ou 16*4"
                    className="w-full px-1.5 py-1 bg-transparent border border-transparent focus:border-blue-500 focus:bg-white rounded focus:outline-none text-sm tabular-nums"
                  />
                )}
              </td>
              <td className="px-2 py-1">
                {(draft.type ?? 'ouvrage') === 'ouvrage' && (
                  <select
                    value={draft.unite}
                    onChange={(e) => setDraft({ ...draft, unite: e.target.value })}
                    onKeyDown={handleKeyDown}
                    className="w-full px-1.5 py-1 bg-transparent border border-transparent focus:border-blue-500 focus:bg-white rounded focus:outline-none text-sm"
                  >
                    {UNITES.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                )}
              </td>
              {showPrices && (
                <td className="px-2 py-1">
                  {(draft.type ?? 'ouvrage') === 'ouvrage' && (
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        value={draft.prix_unitaire}
                        onChange={(e) => setDraft({ ...draft, prix_unitaire: e.target.value })}
                        onKeyDown={handleKeyDown}
                        placeholder="0,00"
                        className="w-full pl-1.5 pr-5 py-1 bg-transparent border border-transparent focus:border-blue-500 focus:bg-white rounded focus:outline-none text-sm tabular-nums"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">€</span>
                    </div>
                  )}
                </td>
              )}
              {showPrices && showMarge && (
                <td className="px-2 py-1">
                  {(draft.type ?? 'ouvrage') === 'ouvrage' && (
                    <input
                      type="number"
                      step="0.1"
                      value={draft.marge_pct ?? ''}
                      onChange={(e) => setDraft({ ...draft, marge_pct: e.target.value })}
                      onKeyDown={handleKeyDown}
                      placeholder="0"
                      className="w-full px-1.5 py-1 bg-transparent border border-transparent focus:border-blue-500 focus:bg-white rounded focus:outline-none text-sm tabular-nums"
                    />
                  )}
                </td>
              )}
              {showPrices && (
                <td className="px-3 py-1 text-right text-sm text-gray-600 tabular-nums">
                  {(() => {
                    if ((draft.type ?? 'ouvrage') !== 'ouvrage') return ''
                    const q = evalFormula(draft.quantite) ?? parseNum(draft.quantite)
                    const pu = parseNum(draft.prix_unitaire)
                    const m = draft.marge_pct ? parseNum(draft.marge_pct) : 0
                    return q > 0 && pu > 0 ? formatCurrency(q * pu * (1 + m / 100)) : '—'
                  })()}
                </td>
              )}
              <td className="px-1 py-1 text-center">
                {draftHasData && (
                  <button
                    type="button"
                    onClick={commitDraft}
                    title="Enregistrer (Entrée)"
                    className="p-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                )}
              </td>
            </tr>

            {/* Ligne total */}
            {showPrices && (
              <tr className="bg-gray-50 border-t-2 border-gray-200">
                <td colSpan={colCount - 2} className="px-3 py-2.5 text-sm font-medium text-gray-700 text-right">
                  SOUS-TOTAL
                </td>
                <td className="px-3 py-2.5 text-sm font-semibold text-gray-900 tabular-nums text-right">
                  {formatCurrency(sousTotal)} <span className="text-xs text-gray-400 font-normal"><Abbr k="HT" /></span>
                </td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-3 flex-wrap">
        <button
          onClick={() => { setDraft({ ...emptyDraft(), type: 'chapitre' }); setTimeout(() => designationNewRef.current?.focus(), 30) }}
          className="flex items-center gap-1.5 text-xs text-gray-700 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100"
        >
          <Plus className="w-3.5 h-3.5" />
          Ajouter un chapitre
        </button>
        <button
          onClick={() => { setDraft({ ...emptyDraft(), type: 'ouvrage' }); setTimeout(() => designationNewRef.current?.focus(), 30) }}
          className="flex items-center gap-1.5 text-xs text-gray-700 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100"
        >
          <Plus className="w-3.5 h-3.5" />
          Ajouter un ouvrage
        </button>
        {showPrices && (
          <button
            onClick={() => onToggleMarge?.()}
            className={cn(
              'flex items-center gap-1.5 text-xs px-2 py-1 rounded',
              showMarge ? 'text-amber-700 bg-amber-50 hover:bg-amber-100' : 'text-gray-500 hover:bg-gray-100',
            )}
          >
            {showMarge ? 'Masquer marges' : 'Afficher marges'}
          </button>
        )}
        {onShowOuvragePicker && (
          <button
            onClick={onShowOuvragePicker}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 ml-auto"
          >
            <Library className="w-3.5 h-3.5" />
            Ajouter depuis la bibliothèque
          </button>
        )}
      </div>
    </>
  )
}

// ─── Ligne éditable ───────────────────────────────────────────────────────────

function LigneRow({
  ligne,
  code,
  level,
  childTotal,
  showPrices,
  showMarge,
  colCount,
  onUpdate,
  onDelete,
  onAddChild,
  onDuplicate,
  onIndent,
  onOutdent,
}: {
  ligne: MetreLigne
  code: string
  level: number
  childTotal: number
  showPrices: boolean
  showMarge: boolean
  colCount: number
  onUpdate: (ligne: MetreLigne, patch: Partial<MetreLigne>) => Promise<void>
  onDelete: (ligne: MetreLigne) => Promise<void>
  onAddChild?: () => void
  onDuplicate?: () => void
  onIndent?: () => void
  onOutdent?: () => void
}) {
  const type: LigneType = ligne.type ?? 'ouvrage'
  const isChapitre = type === 'chapitre'
  const isLot = type === 'lot'

  const [designation, setDesignation] = useState(ligne.designation ?? '')
  const [detail, setDetail] = useState(ligne.detail ?? '')
  // Saisie quantite : si formule presente, on l'affiche, sinon le nombre brut
  const [quantite, setQuantite] = useState<string>(
    ligne.quantite_formule ?? (ligne.quantite == null ? '' : String(ligne.quantite)),
  )
  const [unite, setUnite] = useState(unitFromDb(ligne.unite))
  const [prix, setPrix] = useState<string>(
    ligne.prix_unitaire == null ? '' : String(ligne.prix_unitaire),
  )
  const [marge, setMarge] = useState<string>(
    ligne.marge_pct == null ? '' : String(ligne.marge_pct),
  )
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setDesignation(ligne.designation ?? '')
    setDetail(ligne.detail ?? '')
    setQuantite(ligne.quantite_formule ?? (ligne.quantite == null ? '' : String(ligne.quantite)))
    setUnite(unitFromDb(ligne.unite))
    setPrix(ligne.prix_unitaire == null ? '' : String(ligne.prix_unitaire))
    setMarge(ligne.marge_pct == null ? '' : String(ligne.marge_pct))
  }, [ligne.id])

  function commit(patch: Partial<MetreLigne>) {
    onUpdate(ligne, patch)
  }

  // Calcul live
  const isFormula = /[+\-*/()]/.test(quantite)
  const q = isFormula ? (evalFormula(quantite) ?? 0) : parseNum(quantite)
  const pu = parseNum(prix)
  const m = parseNum(marge)
  const totalLive = q * pu * (1 + m / 100)

  const indent = level * 20

  // ─── Render Chapitre ou Lot (sans prix/qte, avec sous-total) ───
  if (isChapitre || isLot) {
    return (
      <tr className={cn(
        'group border-t border-gray-200',
        isLot ? 'bg-gray-200' : level === 0 ? 'bg-gray-100' : 'bg-gray-50',
      )}>
        <td className="px-3 py-2 text-xs font-bold text-gray-700 tabular-nums">{code}</td>
        <td className="px-2 py-2" colSpan={colCount - 3}>
          <input
            type="text"
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            onBlur={() => {
              if (designation !== (ligne.designation ?? '')) commit({ designation: designation.trim() || null })
            }}
            placeholder={isLot ? 'Titre du lot' : 'Titre du chapitre'}
            style={{ paddingLeft: `${indent + 6}px` }}
            className={cn(
              'w-full py-1 bg-transparent border border-transparent focus:border-blue-500 focus:bg-white rounded focus:outline-none',
              isLot ? 'text-sm font-bold uppercase tracking-wide text-gray-900' : 'text-sm font-semibold text-gray-800',
            )}
          />
        </td>
        {showPrices && (
          <td className="px-3 py-2 text-right text-sm font-semibold text-gray-900 tabular-nums">
            {childTotal > 0 ? formatCurrency(childTotal) : '—'}
          </td>
        )}
        <td className="px-1 py-1 text-center relative">
          <RowActions
            menuOpen={menuOpen}
            setMenuOpen={setMenuOpen}
            isContainer
            alwaysVisible
            addChildLabel={isLot ? 'Ajouter un chapitre' : 'Ajouter un ouvrage'}
            onAddChild={onAddChild}
            onRename={() => {
              const next = window.prompt('Nouveau nom :', ligne.designation ?? '')
              if (next != null && next.trim() && next !== ligne.designation) {
                commit({ designation: next.trim() })
              }
            }}
            onDuplicate={onDuplicate}
            onIndent={onIndent}
            onOutdent={onOutdent}
            onDelete={() => onDelete(ligne)}
          />
        </td>
      </tr>
    )
  }

  // ─── Render Ouvrage ───
  return (
    <tr className="group border-t border-gray-100 hover:bg-gray-50/50">
      <td className="px-3 py-1.5 text-[11px] text-gray-400 tabular-nums align-top pt-2">{code}</td>
      <td className="px-2 py-1" style={{ paddingLeft: `${indent + 8}px` }}>
        <input
          type="text"
          value={designation}
          onChange={(e) => setDesignation(e.target.value)}
          onBlur={() => {
            if (designation !== (ligne.designation ?? '')) commit({ designation: designation.trim() || null })
          }}
          placeholder="Designation"
          className="w-full px-1.5 py-1 bg-transparent border border-transparent focus:border-blue-500 focus:bg-white rounded focus:outline-none text-sm"
        />
        <input
          type="text"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          onBlur={() => {
            if (detail !== (ligne.detail ?? '')) commit({ detail: detail.trim() || null })
          }}
          placeholder="Detail (optionnel)"
          className="w-full px-1.5 py-0.5 -mt-0.5 bg-transparent border border-transparent focus:border-blue-500 focus:bg-white rounded focus:outline-none text-xs text-gray-500"
        />
      </td>
      <td className="px-2 py-1 align-top pt-2">
        <input
          type="text"
          value={quantite}
          onChange={(e) => setQuantite(e.target.value)}
          onBlur={() => {
            const txt = quantite.trim()
            const isF = /[+\-*/()]/.test(txt)
            if (isF) {
              const v = evalFormula(txt)
              if (v !== null) {
                commit({ quantite: v, quantite_formule: txt })
              }
            } else {
              const n = parseNum(txt)
              if (n !== (Number(ligne.quantite) || 0) || ligne.quantite_formule) {
                commit({ quantite: n, quantite_formule: null })
              }
            }
          }}
          placeholder="0 ou 16*4"
          className="w-full px-1.5 py-1 bg-transparent border border-transparent focus:border-blue-500 focus:bg-white rounded focus:outline-none text-sm tabular-nums text-right"
          title={isFormula ? `= ${q}` : undefined}
        />
        {isFormula && (
          <p className="text-[10px] text-blue-600 mt-0.5 tabular-nums text-right">= {q}</p>
        )}
      </td>
      <td className="px-2 py-1 align-top pt-2">
        <select
          value={unite}
          onChange={(e) => {
            setUnite(e.target.value)
            commit({ unite: unitToDb(e.target.value) })
          }}
          className="w-full px-1.5 py-1 bg-transparent border border-transparent focus:border-blue-500 focus:bg-white rounded focus:outline-none text-sm"
        >
          {UNITES.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
      </td>
      {showPrices && (
        <td className="px-2 py-1 align-top pt-2">
          <div className="relative">
            <input
              type="number"
              step="0.01"
              value={prix}
              onChange={(e) => setPrix(e.target.value)}
              onBlur={() => {
                const n = parseNum(prix)
                if (n !== (Number(ligne.prix_unitaire) || 0)) commit({ prix_unitaire: n })
              }}
              placeholder="0,00"
              className="w-full pl-1.5 pr-5 py-1 bg-transparent border border-transparent focus:border-blue-500 focus:bg-white rounded focus:outline-none text-sm tabular-nums"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">€</span>
          </div>
        </td>
      )}
      {showPrices && showMarge && (
        <td className="px-2 py-1 align-top pt-2">
          <input
            type="number"
            step="0.1"
            value={marge}
            onChange={(e) => setMarge(e.target.value)}
            onBlur={() => {
              const n = marge.trim() === '' ? null : parseNum(marge)
              if ((n ?? null) !== (ligne.marge_pct ?? null)) commit({ marge_pct: n })
            }}
            placeholder="—"
            className="w-full px-1.5 py-1 bg-transparent border border-transparent focus:border-blue-500 focus:bg-white rounded focus:outline-none text-sm tabular-nums text-right"
          />
        </td>
      )}
      {showPrices && (
        <td className="px-3 py-1 text-right text-sm text-gray-900 tabular-nums align-top pt-2">
          {q === 0 || pu === 0 ? '—' : formatCurrency(totalLive)}
        </td>
      )}
      <td className="px-1 py-1 text-center align-top pt-1.5 relative">
        <RowActions
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          onDuplicate={onDuplicate}
          onIndent={onIndent}
          onOutdent={onOutdent}
          onDelete={() => onDelete(ligne)}
        />
      </td>
    </tr>
  )
}

// ─── Menu d'actions par ligne ─────────────────────────────────────────────────
function RowActions({
  menuOpen,
  setMenuOpen,
  isContainer,
  alwaysVisible,
  addChildLabel,
  onAddChild,
  onRename,
  onDuplicate,
  onIndent,
  onOutdent,
  onDelete,
}: {
  menuOpen: boolean
  setMenuOpen: (v: boolean) => void
  isContainer?: boolean
  alwaysVisible?: boolean
  addChildLabel?: string
  onAddChild?: () => void
  onRename?: () => void
  onDuplicate?: () => void
  onIndent?: () => void
  onOutdent?: () => void
  onDelete: () => void
}) {
  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
        className={cn(
          'p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition-opacity',
          alwaysVisible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}
        title="Actions"
      >
        <MoreVertical className="w-3.5 h-3.5" />
      </button>
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-2 top-7 z-50 w-52 bg-white border border-gray-200 rounded-md shadow-lg py-1 text-left">
            {isContainer && onAddChild && (
              <button onClick={() => { setMenuOpen(false); onAddChild() }}
                className="w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <Plus className="w-3 h-3" /> {addChildLabel ?? 'Ajouter un ouvrage dedans'}
              </button>
            )}
            {onRename && (
              <button onClick={() => { setMenuOpen(false); onRename() }}
                className="w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <Pencil className="w-3 h-3" /> Renommer
              </button>
            )}
            {onDuplicate && (
              <button onClick={() => { setMenuOpen(false); onDuplicate() }}
                className="w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <Copy className="w-3 h-3" /> Dupliquer
              </button>
            )}
            {onIndent && (
              <button onClick={() => { setMenuOpen(false); onIndent() }}
                className="w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <ChevronRight className="w-3 h-3" /> Indenter
              </button>
            )}
            {onOutdent && (
              <button onClick={() => { setMenuOpen(false); onOutdent() }}
                className="w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <ChevronLeft className="w-3 h-3" /> Desindenter
              </button>
            )}
            <button onClick={() => { setMenuOpen(false); onDelete() }}
              className="w-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-gray-100">
              <Trash2 className="w-3 h-3" /> Supprimer
            </button>
          </div>
        </>
      )}
    </>
  )
}
