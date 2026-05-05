'use client'

import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import {
  Plus, X, Check, Pencil, Trash2, Search,
  ArrowUp, ArrowDown,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { TopBar } from '@/components/co/TopBar'
import { Abbr } from '@/components/shared/Abbr'

/* ─── Types ────────────────────────────────────────────────────────────── */

type CorpsEtat = {
  id: string
  nom: string
  ordre: number
  actif: boolean
  count: number
}

type Ouvrage = {
  id: string
  corps_etat_id: string
  nom: string
  description: string
  unite: string
  prix_ref: number | null
  actif: boolean
}

const UNITES = ['u', 'ml', 'm2', 'm3', 'kg', 'h', 'jour', 'forfait'] as const

/* ─── Page ─────────────────────────────────────────────────────────────── */

export default function BibliothequePage() {
  const supabase = useMemo(() => createClient(), [])
  const [corps, setCorps] = useState<CorpsEtat[]>([])
  const [ouvrages, setOuvrages] = useState<Ouvrage[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [loadingC, setLoadingC] = useState(true)
  const [loadingO, setLoadingO] = useState(false)
  const [search, setSearch] = useState('')

  // Inline edit corps
  const [addingCorps, setAddingCorps] = useState(false)
  const [newCorpsNom, setNewCorpsNom] = useState('')
  const [editCorpsId, setEditCorpsId] = useState<string | null>(null)
  const [editCorpsNom, setEditCorpsNom] = useState('')

  // Modal ouvrage
  const [showAddOuvrage, setShowAddOuvrage] = useState(false)
  const [ouvrNom, setOuvrNom] = useState('')
  const [ouvrDesc, setOuvrDesc] = useState('')
  const [ouvrUnite, setOuvrUnite] = useState('u')
  const [ouvrPrix, setOuvrPrix] = useState('')
  const [savingOuvr, setSavingOuvr] = useState(false)

  /* ── Load corps (globaux = projet_id IS NULL) ─── */
  const refreshCorps = useCallback(async () => {
    setLoadingC(true)
    const [{ data: cData }, { data: counts }] = await Promise.all([
      supabase.from('biblio_corps_etat').select('*').eq('actif', true).is('projet_id', null).order('ordre'),
      supabase.from('biblio_ouvrages').select('corps_etat_id').eq('actif', true),
    ])
    const countMap = new Map<string, number>()
    ;((counts ?? []) as { corps_etat_id: string }[]).forEach((r) => {
      countMap.set(r.corps_etat_id, (countMap.get(r.corps_etat_id) ?? 0) + 1)
    })
    const rows = ((cData ?? []) as { id: string; nom: string; ordre: number; actif: boolean }[]).map((c) => ({
      ...c,
      count: countMap.get(c.id) ?? 0,
    }))
    setCorps(rows)
    setSelectedId((prev) => {
      if (rows.some((r) => r.id === prev)) return prev
      return rows[0]?.id || ''
    })
    setLoadingC(false)
  }, [supabase])

  useEffect(() => { refreshCorps() }, [refreshCorps])

  /* ── Load ouvrages ─────────────────────────── */
  useEffect(() => {
    if (!selectedId) { setOuvrages([]); return }
    let cancelled = false
    setLoadingO(true)
    supabase
      .from('biblio_ouvrages')
      .select('*')
      .eq('corps_etat_id', selectedId)
      .eq('actif', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return
        setOuvrages((data ?? []) as Ouvrage[])
        setLoadingO(false)
      })
    return () => { cancelled = true }
  }, [selectedId, supabase])

  /* ── Corps CRUD ────────────────────────────── */
  async function addCorps() {
    if (!newCorpsNom.trim()) return
    const maxOrdre = corps.reduce((m, c) => Math.max(m, c.ordre), 0)
    await supabase.from('biblio_corps_etat').insert({ nom: newCorpsNom.trim(), ordre: maxOrdre + 1 } as never)
    setNewCorpsNom(''); setAddingCorps(false)
    refreshCorps()
  }

  async function saveCorpsNom() {
    if (!editCorpsId || !editCorpsNom.trim()) { setEditCorpsId(null); return }
    await supabase.from('biblio_corps_etat').update({ nom: editCorpsNom.trim() } as never).eq('id', editCorpsId)
    setEditCorpsId(null)
    refreshCorps()
  }

  async function archiveCorps(id: string) {
    await supabase.from('biblio_corps_etat').update({ actif: false } as never).eq('id', id)
    if (selectedId === id) setSelectedId('')
    refreshCorps()
  }

  async function moveCorps(id: string, dir: -1 | 1) {
    const idx = corps.findIndex((c) => c.id === id)
    if (idx < 0) return
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= corps.length) return
    const a = corps[idx], b = corps[swapIdx]
    await Promise.all([
      supabase.from('biblio_corps_etat').update({ ordre: b.ordre } as never).eq('id', a.id),
      supabase.from('biblio_corps_etat').update({ ordre: a.ordre } as never).eq('id', b.id),
    ])
    refreshCorps()
  }

  /* ── Ouvrage CRUD ──────────────────────────── */
  async function addOuvrage() {
    if (!ouvrNom.trim() || !selectedId) return
    setSavingOuvr(true)
    await supabase.from('biblio_ouvrages').insert({
      corps_etat_id: selectedId,
      nom: ouvrNom.trim(),
      description: ouvrDesc.trim(),
      unite: ouvrUnite,
      prix_ref: ouvrPrix ? parseFloat(ouvrPrix) : 0,
    } as never)
    setSavingOuvr(false)
    setShowAddOuvrage(false)
    setOuvrNom(''); setOuvrDesc(''); setOuvrUnite('u'); setOuvrPrix('')
    const { data } = await supabase.from('biblio_ouvrages').select('*')
      .eq('corps_etat_id', selectedId).eq('actif', true).order('created_at', { ascending: false })
    setOuvrages((data ?? []) as Ouvrage[])
    refreshCorps()
  }

  async function updateOuvrage(id: string, patch: Partial<Ouvrage>) {
    await supabase.from('biblio_ouvrages').update(patch as never).eq('id', id)
    setOuvrages((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)))
  }

  async function archiveOuvrage(id: string) {
    await supabase.from('biblio_ouvrages').update({ actif: false } as never).eq('id', id)
    setOuvrages((prev) => prev.filter((o) => o.id !== id))
    refreshCorps()
  }

  /* ── Filtered ouvrages ─────────────────────── */
  const filtered = ouvrages.filter((o) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return o.nom.toLowerCase().includes(q) || o.description.toLowerCase().includes(q)
  })

  const selectedCorps = corps.find((c) => c.id === selectedId)

  /* ── Render ──────────────────────────────────── */
  return (
    <div>
      <TopBar title="Bibliotheque" subtitle="Corps d'etat et ouvrages de reference — les ouvrages ajoutes ici seront disponibles dans le bouton 'Ajouter depuis la bibliotheque' de chaque lot" />

      <div className="p-6">
        <div className="flex items-stretch gap-4 min-h-[600px]">

          {/* ── Panneau gauche : Corps d'etat ── */}
          <aside className="w-[260px] flex-shrink-0 bg-gray-50 border border-gray-200 rounded-lg flex flex-col">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Corps d'etat</h3>
              <p className="text-xs text-gray-400 mt-0.5">{corps.length} corps actifs</p>
            </div>

            <ul className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {loadingC && <li className="text-xs text-gray-400 text-center py-6">Chargement...</li>}
              {corps.map((c) => {
                const isActive = c.id === selectedId
                const isEditing = editCorpsId === c.id
                return (
                  <li key={c.id} className="group">
                    {isEditing ? (
                      <div className="flex items-center gap-1 px-2 py-1.5">
                        <input type="text" value={editCorpsNom}
                          onChange={(e) => setEditCorpsNom(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveCorpsNom(); if (e.key === 'Escape') setEditCorpsId(null) }}
                          className="flex-1 px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none" autoFocus />
                        <button onClick={saveCorpsNom} className="text-blue-600"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setEditCorpsId(null)} className="text-gray-400"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <button onClick={() => setSelectedId(c.id)}
                        className={cn(
                          'w-full px-3 py-2 rounded-md text-left transition-colors flex items-center gap-2',
                          isActive ? 'bg-blue-50 border-l-[3px] border-[#185FA5] pl-[9px]' : 'hover:bg-white border-l-[3px] border-transparent pl-[9px]',
                        )}>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{c.nom}</div>
                          <div className="text-[11px] text-gray-400">{c.count} ouvrage{c.count !== 1 ? 's' : ''}</div>
                        </div>
                        <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
                          <button onClick={(e) => { e.stopPropagation(); moveCorps(c.id, -1) }} className="p-0.5 text-gray-400 hover:text-gray-700" title="Monter"><ArrowUp className="w-3 h-3" /></button>
                          <button onClick={(e) => { e.stopPropagation(); moveCorps(c.id, 1) }} className="p-0.5 text-gray-400 hover:text-gray-700" title="Descendre"><ArrowDown className="w-3 h-3" /></button>
                          <button onClick={(e) => { e.stopPropagation(); setEditCorpsId(c.id); setEditCorpsNom(c.nom) }} className="p-0.5 text-gray-400 hover:text-gray-700" title="Renommer"><Pencil className="w-3 h-3" /></button>
                          <button onClick={(e) => { e.stopPropagation(); archiveCorps(c.id) }} className="p-0.5 text-gray-400 hover:text-red-600" title="Supprimer"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>

            <div className="p-2 border-t border-gray-200">
              {addingCorps ? (
                <div className="flex items-center gap-1">
                  <input type="text" value={newCorpsNom} onChange={(e) => setNewCorpsNom(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') addCorps(); if (e.key === 'Escape') setAddingCorps(false) }}
                    placeholder="Nom du corps d'etat" className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-500" autoFocus />
                  <button onClick={addCorps} className="text-blue-600 p-1"><Check className="w-4 h-4" /></button>
                  <button onClick={() => setAddingCorps(false)} className="text-gray-400 p-1"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <button onClick={() => setAddingCorps(true)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 border border-dashed border-gray-300 rounded-md hover:border-gray-500 hover:text-gray-900">
                  <Plus className="w-3.5 h-3.5" /> Nouveau corps d'etat
                </button>
              )}
            </div>
          </aside>

          {/* ── Panneau droit : Ouvrages ── */}
          <section className="flex-1 min-w-0 bg-white border border-gray-200 rounded-lg flex flex-col">
            <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  {selectedCorps?.nom ?? 'Selectionnez un corps d\'etat'}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">{filtered.length} ouvrage{filtered.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..."
                    className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-md w-48 focus:outline-none focus:border-blue-500" />
                </div>
                <button onClick={() => setShowAddOuvrage(true)} disabled={!selectedId}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-black disabled:opacity-40">
                  <Plus className="w-3.5 h-3.5" /> Nouvel ouvrage
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loadingO ? (
                <p className="text-sm text-gray-400 text-center py-10">Chargement...</p>
              ) : filtered.length === 0 ? (
                <div className="text-center py-16">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 text-gray-200 mx-auto mb-3">
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                  </svg>
                  <p className="text-sm font-medium text-gray-700">Aucun ouvrage dans ce corps d'etat</p>
                  <p className="text-xs text-gray-400 mt-1">Commencez par ajouter des ouvrages — ils apparaitront dans le bouton "Ajouter depuis la bibliotheque" de l'onglet Lots.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map((o) => (
                    <OuvrageCard key={o.id} ouvrage={o}
                      onUpdate={(patch) => updateOuvrage(o.id, patch)}
                      onArchive={() => archiveOuvrage(o.id)} />
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* ── Modal ajout ouvrage ── */}
      {showAddOuvrage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Nouvel ouvrage</h3>
              <button onClick={() => setShowAddOuvrage(false)} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nom *</label>
                <input type="text" value={ouvrNom} onChange={(e) => setOuvrNom(e.target.value)}
                  placeholder="ex: Luminaire type pave led 600x600"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Description technique</label>
                <textarea rows={3} value={ouvrDesc} onChange={(e) => setOuvrDesc(e.target.value)}
                  placeholder="Caracteristiques, normes, marque de reference..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500 resize-y" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Unite</label>
                  <select value={ouvrUnite} onChange={(e) => setOuvrUnite(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none">
                    {UNITES.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Prix ref. <Abbr k="HT" /></label>
                  <input type="number" step="0.01" value={ouvrPrix} onChange={(e) => setOuvrPrix(e.target.value)} placeholder="0"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500" />
                </div>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setShowAddOuvrage(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
              <button onClick={addOuvrage} disabled={savingOuvr || !ouvrNom.trim()}
                className="px-4 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-black disabled:bg-gray-300">
                {savingOuvr ? 'Creation...' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Carte Ouvrage (editable inline) ──────────────────────────────────── */

function OuvrageCard({
  ouvrage, onUpdate, onArchive,
}: {
  ouvrage: Ouvrage
  onUpdate: (patch: Partial<Ouvrage>) => void
  onArchive: () => void
}) {
  const [nom, setNom] = useState(ouvrage.nom)
  const [desc, setDesc] = useState(ouvrage.description)
  const [unite, setUnite] = useState(ouvrage.unite)
  const [prix, setPrix] = useState(String(ouvrage.prix_ref ?? ''))
  const debounce = useRef<NodeJS.Timeout | null>(null)

  function save(patch: Partial<Ouvrage>) {
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => { onUpdate(patch) }, 800)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-md p-3 hover:bg-gray-50/50 transition-colors group">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          <input type="text" value={nom}
            onChange={(e) => { setNom(e.target.value); save({ nom: e.target.value }) }}
            className="w-full text-sm font-medium text-gray-900 bg-transparent border-0 border-b border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none px-0 py-0.5" />
          <textarea value={desc}
            onChange={(e) => { setDesc(e.target.value); save({ description: e.target.value }) }}
            placeholder="Description technique..." rows={1}
            className="w-full text-xs text-gray-500 bg-transparent border-0 border-b border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none px-0 py-0.5 resize-none" />
          <div className="flex items-center gap-3">
            <select value={unite} onChange={(e) => { setUnite(e.target.value); onUpdate({ unite: e.target.value }) }}
              className="text-xs text-gray-600 bg-transparent border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none">
              {UNITES.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <input type="number" step="0.01" value={prix}
                onChange={(e) => { setPrix(e.target.value); save({ prix_ref: parseFloat(e.target.value) || 0 }) }}
                className="w-20 px-1.5 py-0.5 text-right tabular-nums bg-transparent border border-gray-200 rounded focus:outline-none focus:border-blue-400" />
              <span className="text-gray-400">EUR <Abbr k="HT" /></span>
            </div>
          </div>
        </div>
        <button onClick={onArchive}
          className="hidden group-hover:flex items-center p-1.5 text-gray-400 hover:text-red-600 rounded" title="Supprimer">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
