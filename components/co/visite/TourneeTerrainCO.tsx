'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Check, AlertTriangle, XCircle, Plus, Trash2, Camera, Mic, Square,
  ChevronDown, ChevronUp, Loader2, CheckCircle2, Image as ImageIcon, X,
} from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import {
  useChecklist,
  buildInitialPoints,
  createCustomPoint,
  type Lot,
  type LotChecklist,
  type ChecklistData,
  type ChecklistPoint,
  type PointStatut,
} from '@/hooks/useChecklist'
import { cn } from '@/lib/utils'

/* ── Constants ── */

const STATUT_OPTIONS: { value: PointStatut; label: string; icon: typeof Check; color: string; bg: string }[] = [
  { value: 'ok',           label: 'OK',            icon: Check,           color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  { value: 'a_surveiller', label: 'À surveiller',  icon: AlertTriangle,   color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200' },
  { value: 'probleme',     label: 'Problème',      icon: XCircle,         color: 'text-red-600',     bg: 'bg-red-50 border-red-200' },
]

interface TourneeTerrainCOProps {
  projetId: string
}

export function TourneeTerrainCO({ projetId }: TourneeTerrainCOProps) {
  const { user } = useUser()
  const {
    fetchLots, fetchTemplatePoints, saveChecklist, loadTodayChecklist,
    uploadPhoto, getPhotoUrl, finishTournee,
  } = useChecklist()

  /* ── State ── */
  const [allLots, setAllLots] = useState<Lot[]>([])
  const [selectedLotIds, setSelectedLotIds] = useState<Set<string>>(new Set())
  const [checklistData, setChecklistData] = useState<ChecklistData>({ lots: [] })
  const [checklistId, setChecklistId] = useState<string | undefined>()
  const [started, setStarted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [finishing, setFinishing] = useState(false)
  const [finished, setFinished] = useState(false)
  const [expandedLots, setExpandedLots] = useState<Set<string>>(new Set())

  // Custom point input per lot
  const [newPointLabel, setNewPointLabel] = useState<Record<string, string>>({})

  // Voice note
  const [voiceTarget, setVoiceTarget] = useState<{ lotId: string; pointId: string } | null>(null)
  const [voiceRecording, setVoiceRecording] = useState(false)
  const [voiceElapsed, setVoiceElapsed] = useState(0)
  const [voiceTranscribing, setVoiceTranscribing] = useState(false)
  const voiceRecorderRef = useRef<MediaRecorder | null>(null)
  const voiceChunksRef = useRef<Blob[]>([])
  const voiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const voiceStreamRef = useRef<MediaStream | null>(null)

  // Photo URLs cache
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})

  // Autosave timer
  const autosaveRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /* ── Load lots + existing checklist ── */
  useEffect(() => {
    async function init() {
      const [lots, existing] = await Promise.all([
        fetchLots(projetId),
        loadTodayChecklist(projetId),
      ])
      setAllLots(lots)

      if (existing) {
        setChecklistId(existing.id)
        setChecklistData(existing.data)
        setSelectedLotIds(new Set(existing.data.lots.map(l => l.lotId)))
        setExpandedLots(new Set(existing.data.lots.map(l => l.lotId)))
        setStarted(true)
      }
      setLoading(false)
    }
    init()
  }, [projetId, fetchLots, loadTodayChecklist])

  /* ── Autosave every 30s ── */
  useEffect(() => {
    if (!started || finished || !user) return

    autosaveRef.current = setInterval(async () => {
      setSaving(true)
      const id = await saveChecklist(projetId, user.id, checklistData, checklistId)
      if (id && !checklistId) setChecklistId(id)
      setLastSaved(new Date())
      setSaving(false)
    }, 30_000)

    return () => {
      if (autosaveRef.current) clearInterval(autosaveRef.current)
    }
  }, [started, finished, user, projetId, checklistData, checklistId, saveChecklist])

  // Cleanup voice on unmount
  useEffect(() => {
    return () => {
      if (voiceTimerRef.current) clearInterval(voiceTimerRef.current)
      voiceStreamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  /* ── Helpers ── */

  function toggleLot(lotId: string) {
    setSelectedLotIds(prev => {
      const next = new Set(prev)
      if (next.has(lotId)) next.delete(lotId)
      else next.add(lotId)
      return next
    })
  }

  async function handleStart() {
    const selected = allLots.filter(l => selectedLotIds.has(l.id))
    const lots: LotChecklist[] = await Promise.all(
      selected.map(async l => ({
        lotId: l.id,
        lotNumero: l.numero,
        lotCorpsEtat: l.corps_etat,
        points: await fetchTemplatePoints(l.corps_etat, 'terrain'),
      })),
    )
    setChecklistData({ lots })
    setExpandedLots(new Set(lots.map(l => l.lotId)))
    setStarted(true)
  }

  function toggleExpand(lotId: string) {
    setExpandedLots(prev => {
      const next = new Set(prev)
      if (next.has(lotId)) next.delete(lotId)
      else next.add(lotId)
      return next
    })
  }

  function updatePoint(lotId: string, pointId: string, patch: Partial<ChecklistPoint>) {
    setChecklistData(prev => ({
      lots: prev.lots.map(l =>
        l.lotId === lotId
          ? { ...l, points: l.points.map(p => p.id === pointId ? { ...p, ...patch } : p) }
          : l,
      ),
    }))
  }

  function addCustomPoint(lotId: string) {
    const label = newPointLabel[lotId]?.trim()
    if (!label) return
    setChecklistData(prev => ({
      lots: prev.lots.map(l =>
        l.lotId === lotId
          ? { ...l, points: [...l.points, createCustomPoint(label)] }
          : l,
      ),
    }))
    setNewPointLabel(prev => ({ ...prev, [lotId]: '' }))
  }

  function removePoint(lotId: string, pointId: string) {
    setChecklistData(prev => ({
      lots: prev.lots.map(l =>
        l.lotId === lotId
          ? { ...l, points: l.points.filter(p => p.id !== pointId) }
          : l,
      ),
    }))
  }

  /* ── Photo handling ── */

  async function handlePhoto(lotId: string, pointId: string, file: File) {
    const path = await uploadPhoto(projetId, file)
    if (!path) return
    updatePoint(lotId, pointId, {
      photos: [
        ...(checklistData.lots.find(l => l.lotId === lotId)?.points.find(p => p.id === pointId)?.photos ?? []),
        path,
      ],
    })
    // Preload URL
    const url = await getPhotoUrl(path)
    if (url) setPhotoUrls(prev => ({ ...prev, [path]: url }))
  }

  /* ── Voice note ── */

  async function startVoice(lotId: string, pointId: string) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      voiceStreamRef.current = stream
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm'
      const recorder = new MediaRecorder(stream, { mimeType })
      voiceRecorderRef.current = recorder
      voiceChunksRef.current = []

      recorder.ondataavailable = e => { if (e.data.size > 0) voiceChunksRef.current.push(e.data) }

      // Auto-stop at 2 min
      const autoStopTimeout = setTimeout(() => { if (recorder.state === 'recording') stopVoice() }, 120_000)
      recorder.onstop = () => { clearTimeout(autoStopTimeout); stream.getTracks().forEach(t => t.stop()) }

      recorder.start(1000)
      setVoiceTarget({ lotId, pointId })
      setVoiceRecording(true)
      setVoiceElapsed(0)
      voiceTimerRef.current = setInterval(() => setVoiceElapsed(prev => prev + 1), 1000)
    } catch {
      alert('Impossible d\'accéder au microphone.')
    }
  }

  async function stopVoice() {
    const recorder = voiceRecorderRef.current
    if (!recorder || !voiceTarget) return

    // Gather the final blob
    const blobPromise = new Promise<Blob>(resolve => {
      recorder.onstop = () => {
        voiceStreamRef.current?.getTracks().forEach(t => t.stop())
        resolve(new Blob(voiceChunksRef.current, { type: recorder.mimeType }))
      }
    })

    recorder.stop()
    if (voiceTimerRef.current) clearInterval(voiceTimerRef.current)
    setVoiceRecording(false)
    setVoiceTranscribing(true)

    const blob = await blobPromise
    const { lotId, pointId } = voiceTarget

    try {
      const formData = new FormData()
      formData.append('audio', blob, 'note.webm')
      formData.append('transcription_only', 'true')

      const res = await fetch('/api/co/transcribe', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Erreur transcription')

      const { transcription } = await res.json()

      // Append to existing note
      const current = checklistData.lots
        .find(l => l.lotId === lotId)?.points
        .find(p => p.id === pointId)?.note ?? ''
      const sep = current.trim() ? '\n' : ''
      updatePoint(lotId, pointId, { note: current + sep + transcription })
    } catch {
      alert('Erreur lors de la transcription vocale.')
    } finally {
      setVoiceTranscribing(false)
      setVoiceTarget(null)
      setVoiceElapsed(0)
    }
  }

  /* ── Finish ── */

  async function handleFinish() {
    if (!user) return
    setFinishing(true)

    // Final save
    const id = await saveChecklist(projetId, user.id, checklistData, checklistId)
    if (id && !checklistId) setChecklistId(id)

    // Generate CR summary
    const { error } = await finishTournee(projetId, checklistData, user.id)
    if (error) {
      alert(`Erreur : ${error}`)
      setFinishing(false)
      return
    }

    setFinished(true)
    setFinishing(false)
    if (autosaveRef.current) clearInterval(autosaveRef.current)
  }

  /* ── Manual save ── */

  async function handleManualSave() {
    if (!user) return
    setSaving(true)
    const id = await saveChecklist(projetId, user.id, checklistData, checklistId)
    if (id && !checklistId) setChecklistId(id)
    setLastSaved(new Date())
    setSaving(false)
  }

  /* ── Stats ── */

  const allPoints = checklistData.lots.flatMap(l => l.points)
  const stats = {
    ok: allPoints.filter(p => p.statut === 'ok').length,
    surveiller: allPoints.filter(p => p.statut === 'a_surveiller').length,
    probleme: allPoints.filter(p => p.statut === 'probleme').length,
    total: allPoints.length,
  }

  /* ── Render ── */

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />)}
      </div>
    )
  }

  /* ── Step 1: Lot Selection ── */
  if (!started) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-card">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Lots à inspecter</h3>
          <p className="text-xs text-gray-400 mt-0.5">Sélectionnez les lots pour la tournée d&apos;aujourd&apos;hui</p>
        </div>

        {allLots.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-gray-500">Aucun lot sur ce projet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {allLots.map(lot => (
              <label key={lot.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedLotIds.has(lot.id)}
                  onChange={() => toggleLot(lot.id)}
                  className="rounded border-gray-300 text-gray-900"
                />
                <span className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                  {lot.numero}
                </span>
                <span className="text-sm text-gray-700 flex-1">{lot.corps_etat}</span>
                <span className="text-xs text-gray-400 capitalize">{lot.statut.replace('_', ' ')}</span>
              </label>
            ))}
          </div>
        )}

        <div className="px-5 py-4 border-t border-gray-100">
          <button
            onClick={handleStart}
            disabled={selectedLotIds.size === 0}
            className="w-full px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Démarrer la tournée ({selectedLotIds.size} lot{selectedLotIds.size > 1 ? 's' : ''})
          </button>
        </div>
      </div>
    )
  }

  /* ── Step 2: Checklist ── */
  return (
    <div className="space-y-4">

      {/* Stats bar */}
      <div className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 shadow-card px-5 py-3">
        <div className="flex items-center gap-4 flex-1">
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
            <Check className="w-3.5 h-3.5" /> {stats.ok}
          </span>
          <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
            <AlertTriangle className="w-3.5 h-3.5" /> {stats.surveiller}
          </span>
          <span className="flex items-center gap-1.5 text-xs font-medium text-red-600">
            <XCircle className="w-3.5 h-3.5" /> {stats.probleme}
          </span>
          <span className="text-xs text-gray-400">/ {stats.total} points</span>
        </div>

        <div className="flex items-center gap-2">
          {saving && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />}
          {lastSaved && !saving && (
            <span className="text-[10px] text-gray-400">
              Sauvé {lastSaved.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={handleManualSave}
            disabled={saving}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
          >
            Sauvegarder
          </button>
        </div>
      </div>

      {/* Lot checklists */}
      {checklistData.lots.map(lot => {
        const expanded = expandedLots.has(lot.lotId)
        const lotStats = {
          ok: lot.points.filter(p => p.statut === 'ok').length,
          flag: lot.points.filter(p => p.statut === 'a_surveiller' || p.statut === 'probleme').length,
        }

        return (
          <div key={lot.lotId} className="bg-white rounded-lg border border-gray-200 shadow-card overflow-hidden">
            {/* Lot header */}
            <button
              onClick={() => toggleExpand(lot.lotId)}
              className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left"
            >
              <span className="w-8 h-8 rounded-lg bg-gray-900 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                {lot.lotNumero}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{lot.lotCorpsEtat}</p>
                <p className="text-xs text-gray-400">{lot.points.length} points · {lotStats.ok} OK · {lotStats.flag} signalé{lotStats.flag > 1 ? 's' : ''}</p>
              </div>
              {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>

            {/* Points */}
            {expanded && (
              <div className="border-t border-gray-100">
                {lot.points.map(point => (
                  <div key={point.id} className="px-5 py-3 border-b border-gray-50 last:border-b-0">
                    {/* Point header */}
                    <div className="flex items-start gap-3">
                      <p className="text-sm text-gray-700 flex-1 pt-0.5">{point.label}</p>
                      {point.custom && (
                        <button
                          onClick={() => removePoint(lot.lotId, point.id)}
                          className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Statut buttons */}
                    <div className="flex items-center gap-2 mt-2">
                      {STATUT_OPTIONS.map(opt => {
                        const Icon = opt.icon
                        const active = point.statut === opt.value
                        return (
                          <button
                            key={opt.value}
                            onClick={() => updatePoint(lot.lotId, point.id, { statut: active ? 'non_verifie' : opt.value })}
                            className={cn(
                              'inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors',
                              active ? opt.bg : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300',
                              active && opt.color,
                            )}
                          >
                            <Icon className="w-3 h-3" />
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>

                    {/* Note */}
                    <textarea
                      value={point.note}
                      onChange={e => updatePoint(lot.lotId, point.id, { note: e.target.value })}
                      placeholder="Note libre..."
                      rows={1}
                      className="w-full mt-2 px-2.5 py-1.5 border border-gray-200 rounded-md text-xs text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-900 resize-none"
                    />

                    {/* Actions: Photo + Voice */}
                    <div className="flex items-center gap-2 mt-2">
                      {/* Photo capture */}
                      <label className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded cursor-pointer transition-colors">
                        <Camera className="w-3.5 h-3.5" />
                        Photo
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={e => {
                            const f = e.target.files?.[0]
                            if (f) handlePhoto(lot.lotId, point.id, f)
                            e.target.value = ''
                          }}
                        />
                      </label>

                      {/* Voice note */}
                      {voiceRecording && voiceTarget?.lotId === lot.lotId && voiceTarget?.pointId === point.id ? (
                        <button
                          onClick={stopVoice}
                          className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-red-600 bg-red-50 rounded font-medium"
                        >
                          <Square className="w-3 h-3" />
                          {Math.floor(voiceElapsed / 60)}:{(voiceElapsed % 60).toString().padStart(2, '0')}
                        </button>
                      ) : voiceTranscribing && voiceTarget?.lotId === lot.lotId && voiceTarget?.pointId === point.id ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-500">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Transcription...
                        </span>
                      ) : (
                        <button
                          onClick={() => startVoice(lot.lotId, point.id)}
                          disabled={voiceRecording}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-40 transition-colors"
                        >
                          <Mic className="w-3.5 h-3.5" />
                          Note vocale
                        </button>
                      )}

                      {/* Photo count */}
                      {point.photos.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 ml-auto">
                          <ImageIcon className="w-3 h-3" />
                          {point.photos.length}
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {/* Add custom point */}
                <div className="flex items-center gap-2 px-5 py-3 bg-gray-50/50">
                  <input
                    type="text"
                    value={newPointLabel[lot.lotId] ?? ''}
                    onChange={e => setNewPointLabel(prev => ({ ...prev, [lot.lotId]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') addCustomPoint(lot.lotId) }}
                    placeholder="Ajouter un point..."
                    className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-md text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                  <button
                    onClick={() => addCustomPoint(lot.lotId)}
                    disabled={!newPointLabel[lot.lotId]?.trim()}
                    className="p-1.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Finish button */}
      {!finished ? (
        <button
          onClick={handleFinish}
          disabled={finishing}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {finishing ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Finalisation...</>
          ) : (
            <><CheckCircle2 className="w-4 h-4" /> Terminer la tournée</>
          )}
        </button>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-emerald-800">Tournée terminée</p>
          <p className="text-xs text-emerald-600 mt-1">
            Le résumé a été enregistré dans les comptes rendus du projet.
          </p>
        </div>
      )}
    </div>
  )
}
