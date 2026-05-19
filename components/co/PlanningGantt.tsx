'use client'

import { useMemo, useRef, useEffect, useImperativeHandle, forwardRef, useState } from 'react'

export interface PlanningIntervention {
  id: string
  corps_etat: string
  nom_tache: string | null
  st_nom: string | null
  date_debut: string  // ISO YYYY-MM-DD
  date_fin: string
  avancement_pct: number
  statut: 'planifie' | 'confirme' | 'en_cours' | 'termine' | 'retarde'
  lot_id: string | null
}

export interface PlanningGroup {
  /** Lot principal (parent). Peut etre synthetique si aucune ligne lot n'existe. */
  lot: PlanningIntervention
  tasks: PlanningIntervention[]
}

// Palette de couleurs distinctes par lot
const LOT_PALETTE = [
  '#2563eb', // blue-600
  '#059669', // emerald-600
  '#d97706', // amber-600
  '#dc2626', // red-600
  '#7c3aed', // violet-600
  '#0891b2', // cyan-600
  '#65a30d', // lime-600
  '#db2777', // pink-600
  '#0d9488', // teal-600
  '#9333ea', // purple-600
  '#ea580c', // orange-600
  '#0284c7', // sky-600
  '#16a34a', // green-600
  '#c026d3', // fuchsia-600
  '#475569', // slate-600
]

function lotColor(index: number): string {
  return LOT_PALETTE[index % LOT_PALETTE.length]
}

const DAY_WIDTH_BY_ZOOM = {
  Day: 28,
  Week: 12,
  Month: 5,
  Quarter: 2,
} as const

export type PlanningZoom = keyof typeof DAY_WIDTH_BY_ZOOM

const TASK_BAR_H = 10
const ROW_VPAD = 8
const TASK_GAP = 5
const EMPTY_ROW_H = 22   // hauteur d'une ligne lot sans aucune tache
const HEADER_HEIGHT = 56
const LEFT_COL = { num: 40, nom: 240 } // total = 280

const MONTHS_FR_SHORT = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc']

function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function diffDays(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000)
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function mondayOf(d: Date): Date {
  const day = d.getDay() // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day
  return addDays(startOfDay(d), diff)
}

function formatDayMonth(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}`
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function rowHeightFor(g: PlanningGroup): number {
  if (g.tasks.length === 0) return EMPTY_ROW_H
  return ROW_VPAD * 2 + g.tasks.length * (TASK_BAR_H + TASK_GAP) - TASK_GAP
}

export interface PlanningGanttHandle {
  scrollToToday: () => void
}

interface Props {
  groups: PlanningGroup[]
  zoom: PlanningZoom
  onClickItem: (i: PlanningIntervention) => void
  onItemDatesChange?: (id: string, date_debut: string, date_fin: string) => void
}

type DragState = {
  id: string
  mode: 'move' | 'resize-right' | 'resize-left'
  startX: number
  origStart: Date
  origEnd: Date
}

export const PlanningGantt = forwardRef<PlanningGanttHandle, Props>(function PlanningGantt(
  { groups, zoom, onClickItem, onItemDatesChange },
  ref,
) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const [previewDays, setPreviewDays] = useState(0)
  const previewRef = useRef(0)
  previewRef.current = previewDays
  const rightScrollRef = useRef<HTMLDivElement>(null)
  const dayW = DAY_WIDTH_BY_ZOOM[zoom]

  const allItems = useMemo<PlanningIntervention[]>(
    () => groups.flatMap(g => [g.lot, ...g.tasks]),
    [groups],
  )

  const timeline = useMemo(() => {
    if (allItems.length === 0) return null
    const startStr = allItems.reduce((m, i) => (i.date_debut < m ? i.date_debut : m), allItems[0].date_debut)
    const endStr = allItems.reduce((m, i) => (i.date_fin > m ? i.date_fin : m), allItems[0].date_fin)
    const rawStart = parseISO(startStr)
    const rawEnd = parseISO(endStr)
    const start = addDays(mondayOf(rawStart), -7)
    const endPadded = addDays(rawEnd, 14)
    const dayEnd = endPadded.getDay()
    const toSunday = dayEnd === 0 ? 0 : 7 - dayEnd
    const end = addDays(endPadded, toSunday)
    const totalDays = diffDays(start, end) + 1
    const totalWidth = totalDays * dayW

    const weeks: { x: number; date: Date; label: string }[] = []
    for (let d = 0; d < totalDays; d += 7) {
      const wd = addDays(start, d)
      weeks.push({ x: d * dayW, date: wd, label: formatDayMonth(wd) })
    }
    const months: { label: string; x: number; width: number }[] = []
    let cursor = new Date(start.getFullYear(), start.getMonth(), 1)
    while (cursor <= end) {
      const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
      const segStart = cursor < start ? start : cursor
      const segEnd = next > addDays(end, 1) ? addDays(end, 1) : next
      const x = diffDays(start, segStart) * dayW
      const width = diffDays(segStart, segEnd) * dayW
      const label = `${MONTHS_FR_SHORT[cursor.getMonth()]} ${cursor.getFullYear()}`
      months.push({ label, x, width })
      cursor = next
    }

    return { start, end, totalDays, totalWidth, weeks, months }
  }, [allItems, dayW])

  const totalBodyHeight = useMemo(
    () => groups.reduce((sum, g) => sum + rowHeightFor(g), 0),
    [groups],
  )

  const todayX = useMemo(() => {
    if (!timeline) return null
    const today = startOfDay(new Date())
    const idx = diffDays(timeline.start, today)
    if (idx < 0 || idx > timeline.totalDays) return null
    return idx * dayW + dayW / 2
  }, [timeline, dayW])

  useImperativeHandle(ref, () => ({
    scrollToToday: () => {
      if (!rightScrollRef.current || todayX == null) return
      const containerW = rightScrollRef.current.clientWidth
      rightScrollRef.current.scrollLeft = Math.max(0, todayX - containerW / 2)
    },
  }), [todayX])

  useEffect(() => {
    if (rightScrollRef.current && todayX != null) {
      const containerW = rightScrollRef.current.clientWidth
      rightScrollRef.current.scrollLeft = Math.max(0, todayX - containerW / 2)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Drag global handlers
  useEffect(() => {
    if (!drag) return
    function onMove(e: MouseEvent) {
      const dx = e.clientX - drag!.startX
      const days = Math.round(dx / dayW)
      setPreviewDays(days)
    }
    function onUp() {
      const days = previewRef.current
      const d = drag
      setDrag(null)
      setPreviewDays(0)
      if (!d || days === 0 || !onItemDatesChange) return
      let ns = d.origStart, ne = d.origEnd
      if (d.mode === 'move') {
        ns = addDays(d.origStart, days)
        ne = addDays(d.origEnd, days)
      } else if (d.mode === 'resize-right') {
        ne = addDays(d.origEnd, days)
        if (ne < ns) ne = ns
      } else if (d.mode === 'resize-left') {
        ns = addDays(d.origStart, days)
        if (ns > ne) ns = ne
      }
      onItemDatesChange(d.id, toISO(ns), toISO(ne))
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [drag, dayW, onItemDatesChange])

  function startDrag(e: React.MouseEvent, item: PlanningIntervention, mode: DragState['mode']) {
    if (!onItemDatesChange) return
    e.stopPropagation()
    e.preventDefault()
    setDrag({
      id: item.id,
      mode,
      startX: e.clientX,
      origStart: parseISO(item.date_debut),
      origEnd: parseISO(item.date_fin),
    })
    setPreviewDays(0)
  }

  if (groups.length === 0 || !timeline) return null

  return (
    <div className="flex border border-gray-300 rounded-lg overflow-hidden bg-white text-xs">
      {/* ── LEFT : lots numerotes uniquement ── */}
      <div
        className="flex-shrink-0 border-r-2 border-gray-300"
        style={{ width: LEFT_COL.num + LEFT_COL.nom }}
      >
        {/* Header */}
        <div
          className="flex font-semibold text-[10px] text-gray-700 bg-gray-100 border-b border-gray-300"
          style={{ height: HEADER_HEIGHT }}
        >
          <div
            className="flex items-center justify-center border-r border-gray-300 px-2"
            style={{ width: LEFT_COL.num }}
          >
            N°
          </div>
          <div
            className="flex items-center px-2"
            style={{ width: LEFT_COL.nom }}
          >
            Lot
          </div>
        </div>
        {/* Lot rows */}
        {groups.map((g, idx) => {
          const h = rowHeightFor(g)
          const color = lotColor(idx)
          return (
            <div
              key={g.lot.id}
              onClick={() => onClickItem(g.lot)}
              className="flex border-b border-gray-200 cursor-pointer hover:bg-blue-50/50 transition-colors bg-white"
              style={{ height: h }}
            >
              <div
                className="flex items-center justify-center border-r border-gray-200 text-gray-600 font-mono text-[11px]"
                style={{ width: LEFT_COL.num }}
              >
                {String(idx + 1).padStart(2, '0')}
              </div>
              <div
                className="flex items-center gap-2 px-2 font-semibold text-gray-900 truncate"
                style={{ width: LEFT_COL.nom }}
                title={g.lot.corps_etat}
              >
                <span
                  className="inline-block flex-shrink-0 rounded-sm"
                  style={{ width: 10, height: 10, background: color }}
                />
                <span className="truncate">{g.lot.corps_etat}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── RIGHT : Gantt scrollable ── */}
      <div ref={rightScrollRef} className="flex-1 overflow-x-auto">
        <div style={{ width: timeline.totalWidth, position: 'relative' }}>
          {/* Header */}
          <div
            className="relative bg-gray-100 border-b border-gray-300 sticky top-0 z-10"
            style={{ height: HEADER_HEIGHT }}
          >
            {/* Mois */}
            <div className="absolute top-0 left-0 right-0 h-7 border-b border-gray-300">
              {timeline.months.map((m, i) => (
                <div
                  key={i}
                  className="absolute top-0 h-7 flex items-center justify-center text-[11px] font-semibold text-gray-800 border-r border-gray-300 capitalize"
                  style={{ left: m.x, width: m.width }}
                >
                  {m.label}
                </div>
              ))}
            </div>
            {/* Semaines (date du lundi) */}
            <div className="absolute top-7 left-0 right-0 h-7">
              {timeline.weeks.map((w, i) => (
                <div
                  key={i}
                  className="absolute top-0 h-7 flex items-center justify-center text-[9px] text-gray-600 border-r border-gray-200"
                  style={{ left: w.x, width: 7 * dayW }}
                >
                  {7 * dayW >= 30 ? w.label : ''}
                </div>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="relative" style={{ height: totalBodyHeight }}>
            {/* Bandes weekend */}
            {timeline.weeks.map((w, i) => (
              <div
                key={`we-${i}`}
                className="absolute bg-gray-50 pointer-events-none"
                style={{
                  left: w.x + 5 * dayW,
                  width: 2 * dayW,
                  top: 0,
                  height: totalBodyHeight,
                }}
              />
            ))}
            {/* Lignes de semaine */}
            {timeline.weeks.map((w, i) => (
              <div
                key={`gl-${i}`}
                className="absolute border-l border-gray-200 pointer-events-none"
                style={{ left: w.x, top: 0, height: totalBodyHeight }}
              />
            ))}
            {/* Today line */}
            {todayX != null && (
              <div
                className="absolute z-20 pointer-events-none"
                style={{
                  left: todayX,
                  width: 2,
                  top: 0,
                  height: totalBodyHeight,
                  background: '#111827',
                }}
              />
            )}

            {/* Groupes */}
            {(() => {
              let yCursor = 0
              return groups.map((g, idx) => {
                const h = rowHeightFor(g)
                const top = yCursor
                yCursor += h
                return (
                  <GanttGroupRow
                    key={g.lot.id}
                    group={g}
                    color={lotColor(idx)}
                    top={top}
                    height={h}
                    timeline={timeline}
                    dayW={dayW}
                    onClickItem={onClickItem}
                    drag={drag}
                    previewDays={previewDays}
                    onStartDrag={startDrag}
                  />
                )
              })
            })()}
          </div>
        </div>
      </div>
    </div>
  )
})

function GanttGroupRow({
  group, color, top, height, timeline, dayW, onClickItem, drag, previewDays, onStartDrag,
}: {
  group: PlanningGroup
  color: string
  top: number
  height: number
  timeline: { start: Date }
  dayW: number
  onClickItem: (i: PlanningIntervention) => void
  drag: DragState | null
  previewDays: number
  onStartDrag: (e: React.MouseEvent, item: PlanningIntervention, mode: DragState['mode']) => void
}) {
  return (
    <div
      className="absolute left-0 right-0 border-b border-gray-200 hover:bg-blue-50/30"
      style={{ top, height }}
    >
      {/* Lignes fines des taches (toutes a la couleur du lot) */}
      {group.tasks.map((t, i) => {
        let ts = parseISO(t.date_debut)
        let te = parseISO(t.date_fin)
        // Applique le decalage du drag en cours
        if (drag && drag.id === t.id && previewDays !== 0) {
          if (drag.mode === 'move') {
            ts = addDays(drag.origStart, previewDays)
            te = addDays(drag.origEnd, previewDays)
          } else if (drag.mode === 'resize-right') {
            te = addDays(drag.origEnd, previewDays)
            if (te < ts) te = ts
          } else if (drag.mode === 'resize-left') {
            ts = addDays(drag.origStart, previewDays)
            if (ts > te) ts = te
          }
        }
        const tx = diffDays(timeline.start, ts) * dayW
        const tw = Math.max(dayW, (diffDays(ts, te) + 1) * dayW)
        const ty = ROW_VPAD + i * (TASK_BAR_H + TASK_GAP)
        return (
          <TaskLine
            key={t.id}
            x={tx}
            width={tw}
            y={ty}
            height={TASK_BAR_H}
            color={color}
            label={t.nom_tache?.trim() || t.corps_etat}
            startDate={ts}
            endDate={te}
            onClick={() => onClickItem(t)}
            onStartDrag={(e, mode) => onStartDrag(e, t, mode)}
          />
        )
      })}
    </div>
  )
}

function TaskLine({
  x, width, y, height, color, label, startDate, endDate, onClick, onStartDrag,
}: {
  x: number
  width: number
  y: number
  height: number
  color: string
  label: string
  startDate: Date
  endDate: Date
  onClick: () => void
  onStartDrag?: (e: React.MouseEvent, mode: DragState['mode']) => void
}) {
  const HANDLE_W = 6
  const [dragged, setDragged] = useState(false)
  return (
    <>
      {/* Date debut */}
      <div
        className="absolute text-[8px] text-gray-500 pointer-events-none whitespace-nowrap"
        style={{ left: Math.max(2, x - 28), top: y + (height - 9) / 2 }}
      >
        {formatDayMonth(startDate)}
      </div>
      {/* Zone draggable principale (move) */}
      <div
        onMouseDown={(e) => {
          if (e.button !== 0) return
          setDragged(false)
          onStartDrag?.(e, 'move')
          const startX = e.clientX
          const upHandler = (ev: MouseEvent) => {
            if (Math.abs(ev.clientX - startX) < 3) {
              // simple click sans deplacement
              onClick()
            } else {
              setDragged(true)
            }
            window.removeEventListener('mouseup', upHandler, true)
          }
          window.addEventListener('mouseup', upHandler, true)
        }}
        className="absolute rounded-full hover:brightness-110 transition-all"
        style={{
          left: x,
          width,
          top: y + (height - 8) / 2,
          height: 8,
          background: color,
          cursor: onStartDrag ? 'grab' : 'pointer',
        }}
        title={`${label} (${formatDayMonth(startDate)} → ${formatDayMonth(endDate)})${onStartDrag ? ' — glisser pour déplacer' : ''}`}
      />
      {/* Handle gauche : redimensionner debut */}
      {onStartDrag && width >= 16 && (
        <div
          onMouseDown={(e) => { e.stopPropagation(); onStartDrag(e, 'resize-left') }}
          className="absolute hover:bg-black/20"
          style={{
            left: x - HANDLE_W / 2,
            width: HANDLE_W,
            top: y + (height - 10) / 2,
            height: 10,
            cursor: 'ew-resize',
            zIndex: 5,
          }}
          title="Glisser pour ajuster la date de début"
        />
      )}
      {/* Handle droit : redimensionner fin */}
      {onStartDrag && width >= 16 && (
        <div
          onMouseDown={(e) => { e.stopPropagation(); onStartDrag(e, 'resize-right') }}
          className="absolute hover:bg-black/20"
          style={{
            left: x + width - HANDLE_W / 2,
            width: HANDLE_W,
            top: y + (height - 10) / 2,
            height: 10,
            cursor: 'ew-resize',
            zIndex: 5,
          }}
          title="Glisser pour ajuster la date de fin"
        />
      )}
      {/* Label apres la ligne */}
      <div
        className="absolute text-[9px] text-gray-700 font-medium pointer-events-none whitespace-nowrap"
        style={{ left: x + width + 6, top: y + (height - 10) / 2 }}
      >
        {label}{dragged && <span className="ml-1 text-emerald-600">✓</span>}
      </div>
    </>
  )
}
