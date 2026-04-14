'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Trash2, ChevronDown, Check, Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, cn } from '@/lib/utils'
import { FAKE_POPY3_LOTS, FAKE_POPY3_LIGNES } from '@/lib/fake-data/metres-popy3'

type Lot = {
  id: string
  projet_id: string
  nom: string
  ordre: number
  total_ht: number | null
  created_at: string
}

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
}

type DraftLigne = {
  designation: string
  detail: string
  quantite: string
  unite: string
  prix_unitaire: string
}

const LOTS_PREDEFINIS = [
  'Démolition / Dépose',
  'Gros œuvre / Maçonnerie',
  'Cloisons / Plâtrerie',
  'Faux-plafonds',
  'Revêtements de sol',
  'Carrelage / Faïence',
  'Menuiseries intérieures',
  'Menuiseries extérieures',
  'Électricité CFO/CFA',
  'Plomberie / Sanitaires',
  'CVC',
  'Peinture',
  'Serrurerie / Métallerie',
  'Nettoyage / Divers',
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
  mode?: 'metres' | 'chiffrage'
  fakeData?: boolean
}) {
  const showPrices = mode === 'chiffrage'
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
    const q = parseNum(draft.quantite)
    const pu = parseNum(draft.prix_unitaire)
    const ordre = lignes.length

    if (fakeData) {
      const total = Math.round(q * pu * 100) / 100
      const newLigne: MetreLigne = {
        id: `fake-l-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        lot_id: lotId,
        projet_id: projetId,
        designation: draft.designation.trim(),
        detail: draft.detail.trim() || null,
        quantite: q,
        unite: unitToDb(draft.unite),
        prix_unitaire: pu,
        total_ht: total,
        ordre,
        created_at: new Date().toISOString(),
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
      quantite: q,
      unite: unitToDb(draft.unite),
      prix_unitaire: pu,
      ordre,
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
    const q = Number(merged.quantite) || 0
    const pu = Number(merged.prix_unitaire) || 0
    const total = Math.round(q * pu * 100) / 100

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
                Total : {formatCurrency(totalProjet)} <span className="text-xs text-gray-400 font-normal">HT</span>
              </p>
            ) : (
              <p className="mt-1 text-xs text-gray-400">{lots.length} lot{lots.length > 1 ? 's' : ''}</p>
            )}
          </div>

          <ul className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {lots.length === 0 && (
              <li className="text-xs text-gray-400 px-2 py-6 text-center">Aucun lot</li>
            )}
            {lots.map((lot) => {
              const isActive = lot.id === activeLotId
              return (
                <li key={lot.id} className="group relative">
                  <button
                    onClick={() => setActiveLotId(lot.id)}
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
                        {formatCurrency(Number(lot.total_ht) || 0)} <span className="text-[10px]">HT</span>
                      </span>
                    ) : (
                      <span className={cn('text-[11px] whitespace-nowrap', isActive ? 'text-gray-600' : 'text-gray-400')}>
                        {nbLignesByLot[lot.id] ?? 0} lg
                      </span>
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteLot(lot.id)
                    }}
                    className="absolute top-1/2 -translate-y-1/2 right-1 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-opacity"
                    title="Supprimer le lot"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              )
            })}
          </ul>

          {/* Ajouter lot */}
          <div className="p-2 border-t border-gray-200 relative">
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
              <div className="absolute bottom-full left-2 right-2 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-[340px] overflow-y-auto z-20">
                {customLotName === null ? (
                  <>
                    {LOTS_PREDEFINIS.map((nom) => (
                      <button
                        key={nom}
                        onClick={() => {
                          createLot(nom)
                          setShowLotMenu(false)
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                      >
                        {nom}
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
          ) : (
            <LotDetailPanel
              lot={activeLot}
              lignes={lignes}
              sousTotal={sousTotal}
              showPrices={showPrices}
              onRenameLot={(nom) => renameLot(activeLot.id, nom)}
              onInsertLigne={(draft) => insertLigne(activeLot.id, draft)}
              onUpdateLigne={updateLigne}
              onDeleteLigne={deleteLigne}
              onExport={() => exportLotExcel(activeLot, lignes)}
            />
          )}
        </section>
      </div>

      {/* ═════ RÉCAPITULATIF ═════ */}
      {lots.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Récapitulatif projet</h3>
            <button
              onClick={exportProjetExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 hover:border-gray-300 transition-colors"
              title="Exporter tous les lots (1 feuille par lot + récap)"
            >
              <Download className="w-3.5 h-3.5" />
              Exporter le projet
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 border-b border-gray-100">
                <th className="px-4 py-2">Lot</th>
                <th className="px-4 py-2 w-32">Nb lignes</th>
                {showPrices && <th className="px-4 py-2 w-40 text-right">Sous-total HT</th>}
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
    </div>
  )
}

// ─── Panneau droit ────────────────────────────────────────────────────────────

function LotDetailPanel({
  lot,
  lignes,
  sousTotal,
  showPrices,
  onRenameLot,
  onInsertLigne,
  onUpdateLigne,
  onDeleteLigne,
  onExport,
}: {
  lot: Lot
  lignes: MetreLigne[]
  sousTotal: number
  showPrices: boolean
  onRenameLot: (nom: string) => void
  onInsertLigne: (draft: DraftLigne) => Promise<void>
  onUpdateLigne: (ligne: MetreLigne, patch: Partial<MetreLigne>) => Promise<void>
  onDeleteLigne: (ligne: MetreLigne) => Promise<void>
  onExport: () => void
}) {
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(lot.nom)
  useEffect(() => setNameValue(lot.nom), [lot.id, lot.nom])

  const [draft, setDraft] = useState<DraftLigne>(emptyDraft())
  const [designationError, setDesignationError] = useState(false)
  const designationNewRef = useRef<HTMLInputElement>(null)
  const rowRef = useRef<HTMLTableRowElement>(null)

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
              <span className="text-xs text-gray-400">HT</span>
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
              <th className="px-3 py-2 min-w-[200px]">Désignation</th>
              <th className="px-3 py-2 min-w-[160px]">Détail</th>
              <th className="px-3 py-2 w-24">Quantité</th>
              <th className="px-3 py-2 w-28">Unité</th>
              {showPrices && <th className="px-3 py-2 w-32">Prix unitaire HT</th>}
              {showPrices && <th className="px-3 py-2 w-32 text-right">Total HT</th>}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {lignes.length === 0 && (
              <tr>
                <td colSpan={showPrices ? 7 : 5} className="px-3 py-10 text-center text-xs text-gray-400">
                  Ajoutez la première ligne de métré
                </td>
              </tr>
            )}
            {lignes.map((ligne) => (
              <LigneRow
                key={ligne.id}
                ligne={ligne}
                showPrices={showPrices}
                onUpdate={onUpdateLigne}
                onDelete={onDeleteLigne}
              />
            ))}

            {/* Ligne vierge de saisie rapide */}
            <tr
              ref={rowRef}
              onBlur={handleRowBlur}
              className="group border-t border-gray-100 bg-blue-50/30"
            >
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
                  placeholder="ex: dalle 60x60 (obligatoire)"
                  className={cn(
                    'w-full px-1.5 py-1 bg-transparent border rounded focus:outline-none text-sm transition-colors',
                    designationError
                      ? 'border-red-400 bg-red-50 focus:border-red-500'
                      : 'border-transparent focus:border-blue-500 focus:bg-white',
                  )}
                />
              </td>
              <td className="px-2 py-1">
                <input
                  type="text"
                  value={draft.detail}
                  onChange={(e) => setDraft({ ...draft, detail: e.target.value })}
                  onKeyDown={handleKeyDown}
                  placeholder="Précisions…"
                  className="w-full px-1.5 py-1 bg-transparent border border-transparent focus:border-blue-500 focus:bg-white rounded focus:outline-none text-xs text-gray-500"
                />
              </td>
              <td className="px-2 py-1">
                <input
                  type="number"
                  step="0.01"
                  value={draft.quantite}
                  onChange={(e) => setDraft({ ...draft, quantite: e.target.value })}
                  onKeyDown={handleKeyDown}
                  placeholder="0"
                  className="w-full px-1.5 py-1 bg-transparent border border-transparent focus:border-blue-500 focus:bg-white rounded focus:outline-none text-sm tabular-nums"
                />
              </td>
              <td className="px-2 py-1">
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
              </td>
              {showPrices && (
                <td className="px-2 py-1">
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
                </td>
              )}
              {showPrices && (
                <td className="px-3 py-1 text-right text-sm text-gray-600 tabular-nums">
                  {parseNum(draft.quantite) > 0 && parseNum(draft.prix_unitaire) > 0
                    ? formatCurrency(parseNum(draft.quantite) * parseNum(draft.prix_unitaire))
                    : '—'}
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
                <td colSpan={5} className="px-3 py-2.5 text-sm font-medium text-gray-700 text-right">
                  SOUS-TOTAL
                </td>
                <td className="px-3 py-2.5 text-sm font-semibold text-gray-900 tabular-nums text-right">
                  {formatCurrency(sousTotal)} <span className="text-xs text-gray-400 font-normal">HT</span>
                </td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2 border-t border-gray-100">
        <button
          onClick={() => designationNewRef.current?.focus()}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900"
        >
          <Plus className="w-3.5 h-3.5" />
          Ajouter une ligne
        </button>
      </div>
    </>
  )
}

// ─── Ligne éditable ───────────────────────────────────────────────────────────

function LigneRow({
  ligne,
  showPrices,
  onUpdate,
  onDelete,
}: {
  ligne: MetreLigne
  showPrices: boolean
  onUpdate: (ligne: MetreLigne, patch: Partial<MetreLigne>) => Promise<void>
  onDelete: (ligne: MetreLigne) => Promise<void>
}) {
  const [designation, setDesignation] = useState(ligne.designation ?? '')
  const [detail, setDetail] = useState(ligne.detail ?? '')
  const [quantite, setQuantite] = useState<string>(
    ligne.quantite === null || ligne.quantite === undefined ? '' : String(ligne.quantite),
  )
  const [unite, setUnite] = useState(unitFromDb(ligne.unite))
  const [prix, setPrix] = useState<string>(
    ligne.prix_unitaire === null || ligne.prix_unitaire === undefined ? '' : String(ligne.prix_unitaire),
  )

  useEffect(() => {
    setDesignation(ligne.designation ?? '')
    setDetail(ligne.detail ?? '')
    setQuantite(ligne.quantite === null || ligne.quantite === undefined ? '' : String(ligne.quantite))
    setUnite(unitFromDb(ligne.unite))
    setPrix(ligne.prix_unitaire === null || ligne.prix_unitaire === undefined ? '' : String(ligne.prix_unitaire))
  }, [ligne.id])

  const q = parseNum(quantite)
  const pu = parseNum(prix)
  const totalLive = q * pu

  function commit(patch: Partial<MetreLigne>) {
    onUpdate(ligne, patch)
  }

  return (
    <tr className="group border-t border-gray-100 hover:bg-gray-50/50">
      <td className="px-2 py-1">
        <input
          type="text"
          value={designation}
          onChange={(e) => setDesignation(e.target.value)}
          onBlur={() => {
            if (designation !== (ligne.designation ?? '')) commit({ designation: designation.trim() || null })
          }}
          className="w-full px-1.5 py-1 bg-transparent border border-transparent focus:border-blue-500 focus:bg-white rounded focus:outline-none text-sm"
        />
      </td>
      <td className="px-2 py-1">
        <input
          type="text"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          onBlur={() => {
            if (detail !== (ligne.detail ?? '')) commit({ detail: detail.trim() || null })
          }}
          placeholder="Précisions…"
          className="w-full px-1.5 py-1 bg-transparent border border-transparent focus:border-blue-500 focus:bg-white rounded focus:outline-none text-xs text-gray-500"
        />
      </td>
      <td className="px-2 py-1">
        <input
          type="number"
          step="0.01"
          value={quantite}
          onChange={(e) => setQuantite(e.target.value)}
          onBlur={() => {
            const n = parseNum(quantite)
            if (n !== (Number(ligne.quantite) || 0)) commit({ quantite: n })
          }}
          className="w-full px-1.5 py-1 bg-transparent border border-transparent focus:border-blue-500 focus:bg-white rounded focus:outline-none text-sm tabular-nums"
        />
      </td>
      <td className="px-2 py-1">
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
        <td className="px-2 py-1">
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
      {showPrices && (
        <td className="px-3 py-1 text-right text-sm text-gray-900 tabular-nums">
          {q === 0 || pu === 0 ? '—' : formatCurrency(totalLive)}
        </td>
      )}
      <td className="px-1 py-1 text-center">
        <button
          onClick={() => onDelete(ligne)}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-opacity"
          title="Supprimer la ligne"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  )
}
