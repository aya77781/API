'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Mic, Square, Pause, Play, RotateCcw,
  Users, Plus, X, Loader2, FileText, Check, Trash2,
} from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { useDocuments } from '@/hooks/useDocuments'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

/* ── Types ─────────────────────────────────────────────────── */

interface PlatformUser {
  id: string
  prenom: string
  nom: string
  role: string
}

interface ExternalParticipant {
  nom: string
  entreprise: string
}

type RecordingState = 'idle' | 'recording' | 'paused' | 'done'
type Step = 'prepare' | 'record' | 'generate' | 'review'

const ROLE_LABELS: Record<string, string> = {
  co: 'CO', commercial: 'Commercial', economiste: 'Économiste',
  dessinatrice: 'Dessin', comptable: 'Compta', gerant: 'Gérant',
  admin: 'Admin', rh: 'RH', cho: 'CHO', assistant_travaux: 'AT',
  st: 'ST', controle: 'Contrôle', client: 'Client',
}

/* ── Component ─────────────────────────────────────────────── */

interface ReunionChantierProps {
  projetId: string
}

export function ReunionChantier({ projetId }: ReunionChantierProps) {
  const { user, profil } = useUser()
  const { uploadDocument } = useDocuments()

  /* ── All users ── */
  const [allUsers, setAllUsers] = useState<PlatformUser[]>([])
  const [userSearch, setUserSearch] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.schema('app').from('utilisateurs')
      .select('id, prenom, nom, role')
      .eq('actif', true)
      .order('prenom')
      .then(({ data }) => setAllUsers(data ?? []))
  }, [])

  /* ── State ── */
  const [step, setStep] = useState<Step>('prepare')

  // Participants
  const [selectedUsers, setSelectedUsers] = useState<PlatformUser[]>([])
  const [externals, setExternals] = useState<ExternalParticipant[]>([])
  const [extNom, setExtNom] = useState('')
  const [extEntreprise, setExtEntreprise] = useState('')
  const [showUserPicker, setShowUserPicker] = useState(false)

  // Ordre du jour
  const [ordreJour, setOrdreJour] = useState('')

  // Recording
  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Generation
  const [generating, setGenerating] = useState(false)
  const [genStatus, setGenStatus] = useState('')
  const [transcriptionText, setTranscriptionText] = useState('')
  const [crText, setCrText] = useState('')

  // Deposit
  const [depositing, setDepositing] = useState(false)
  const [deposited, setDeposited] = useState(false)

  /* ── Helpers ── */

  function formatTime(s: number) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  const filteredUsers = allUsers.filter(u => {
    if (user && u.id === user.id) return false
    if (selectedUsers.some(s => s.id === u.id)) return false
    if (!userSearch) return true
    const term = userSearch.toLowerCase()
    return `${u.prenom} ${u.nom}`.toLowerCase().includes(term) ||
      (ROLE_LABELS[u.role] ?? u.role).toLowerCase().includes(term)
  })

  function addUser(u: PlatformUser) {
    setSelectedUsers(prev => [...prev, u])
    setUserSearch('')
  }

  function removeUser(id: string) {
    setSelectedUsers(prev => prev.filter(u => u.id !== id))
  }

  function addExternal() {
    if (!extNom.trim()) return
    setExternals(prev => [...prev, { nom: extNom.trim(), entreprise: extEntreprise.trim() }])
    setExtNom('')
    setExtEntreprise('')
  }

  function removeExternal(idx: number) {
    setExternals(prev => prev.filter((_, i) => i !== idx))
  }

  /* ── Recording ── */

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach(t => t.stop())
      }

      recorder.start(1000)
      setRecordingState('recording')
      setStep('record')
      setElapsed(0)

      timerRef.current = setInterval(() => {
        setElapsed(prev => prev + 1)
      }, 1000)
    } catch {
      alert('Impossible d\'accéder au microphone. Vérifiez les permissions de votre navigateur.')
    }
  }

  function pauseRecording() {
    const recorder = mediaRecorderRef.current
    if (!recorder) return
    if (recorder.state === 'recording') {
      recorder.pause()
      setRecordingState('paused')
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }

  function resumeRecording() {
    const recorder = mediaRecorderRef.current
    if (!recorder) return
    if (recorder.state === 'paused') {
      recorder.resume()
      setRecordingState('recording')
      timerRef.current = setInterval(() => {
        setElapsed(prev => prev + 1)
      }, 1000)
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current
    if (!recorder) return
    recorder.stop()
    setRecordingState('done')
    if (timerRef.current) clearInterval(timerRef.current)
  }

  function resetRecording() {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioBlob(null)
    setAudioUrl(null)
    setRecordingState('idle')
    setElapsed(0)
    setStep('prepare')
    setTranscriptionText('')
    setCrText('')
    setDeposited(false)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Generate CR ── */

  async function handleGenerate() {
    if (!audioBlob) return
    setGenerating(true)
    setGenStatus('Transcription en cours...')
    setStep('generate')

    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'reunion.webm')
      formData.append('ordre_du_jour', ordreJour)
      formData.append('projet_id', projetId)

      const participantsNames = [
        ...(profil ? [`${profil.prenom} ${profil.nom} (${ROLE_LABELS[profil.role] ?? profil.role})`] : []),
        ...selectedUsers.map(u => `${u.prenom} ${u.nom} (${ROLE_LABELS[u.role] ?? u.role})`),
        ...externals.map(e => `${e.nom}${e.entreprise ? ` — ${e.entreprise}` : ''} (externe)`),
      ]
      formData.append('participants', JSON.stringify(participantsNames))

      const res = await fetch('/api/co/transcribe', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erreur serveur')
      }

      setGenStatus('Génération du CR...')
      const { transcription, compte_rendu } = await res.json()
      setCrText(compte_rendu)
      if (transcription) setTranscriptionText(transcription)
      setStep('review')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      alert(`Erreur : ${msg}`)
      setStep('record')
    } finally {
      setGenerating(false)
      setGenStatus('')
    }
  }

  /* ── Deposit CR ── */

  async function handleDeposit() {
    if (!crText.trim() || !user || !profil) return
    setDepositing(true)

    try {
      const now = new Date()
      const dateStr = now.toLocaleDateString('fr-FR')
      const fileName = `CR_reunion_chantier_${dateStr.replace(/\//g, '-')}.txt`
      const file = new File([crText], fileName, { type: 'text/plain' })

      // Get project name
      const supabase = createClient()
      const { data: projet } = await supabase.schema('app').from('projets')
        .select('nom').eq('id', projetId).single()

      const tagsUtilisateurs = selectedUsers.map(u => ({ id: u.id, role: u.role }))

      await uploadDocument({
        file,
        projetId,
        typeDoc: 'cr',
        dossierGed: 'comptes-rendus',
        tagsUtilisateurs,
        messageDepot: `Compte rendu de réunion de chantier du ${dateStr}`,
        userId: user.id,
        userPrenom: profil.prenom,
        userNom: profil.nom,
        userRole: profil.role,
        nomProjet: projet?.nom ?? '',
      })

      setDeposited(true)
    } catch {
      alert('Erreur lors du dépôt du document.')
    } finally {
      setDepositing(false)
    }
  }

  /* ── Render ── */

  return (
    <div className="space-y-5">

      {/* ─── ÉTAPE 1 : Préparation ─── */}
      <div className={cn(
        'bg-white rounded-lg border border-gray-200 shadow-card',
        step !== 'prepare' && recordingState === 'idle' && 'opacity-60 pointer-events-none',
      )}>
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" />
            Préparation
          </h3>
        </div>
        <div className="p-5 space-y-5">

          {/* Participants plateforme */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Participants (utilisateurs plateforme)
            </label>

            {/* Tags */}
            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedUsers.map(u => (
                  <span key={u.id} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-md text-xs text-gray-700">
                    {u.prenom} {u.nom}
                    <span className="text-gray-400 text-[10px] uppercase">{ROLE_LABELS[u.role] ?? u.role}</span>
                    <button onClick={() => removeUser(u.id)} className="ml-0.5 text-gray-400 hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Search input */}
            <div className="relative">
              <input
                type="text"
                value={userSearch}
                onChange={e => { setUserSearch(e.target.value); setShowUserPicker(true) }}
                onFocus={() => setShowUserPicker(true)}
                placeholder="Rechercher un utilisateur..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />

              {/* Dropdown */}
              {showUserPicker && filteredUsers.length > 0 && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredUsers.slice(0, 20).map(u => (
                    <button
                      key={u.id}
                      onClick={() => { addUser(u); setShowUserPicker(false) }}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-left"
                    >
                      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-semibold text-gray-600 flex-shrink-0">
                        {u.prenom[0]}{u.nom[0]}
                      </div>
                      <span className="text-sm text-gray-700 flex-1">{u.prenom} {u.nom}</span>
                      <span className="text-[10px] text-gray-400 uppercase">{ROLE_LABELS[u.role] ?? u.role}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Click outside to close */}
            {showUserPicker && (
              <div className="fixed inset-0 z-10" onClick={() => setShowUserPicker(false)} />
            )}
          </div>

          {/* Participants externes */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Participants externes (ST, visiteurs...)
            </label>

            {externals.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {externals.map((e, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 rounded-md text-xs text-orange-700">
                    {e.nom}{e.entreprise && <span className="text-orange-400">— {e.entreprise}</span>}
                    <button onClick={() => removeExternal(i)} className="ml-0.5 text-orange-400 hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={extNom}
                onChange={e => setExtNom(e.target.value)}
                placeholder="Nom"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
              <input
                type="text"
                value={extEntreprise}
                onChange={e => setExtEntreprise(e.target.value)}
                placeholder="Entreprise"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
              <button
                onClick={addExternal}
                disabled={!extNom.trim()}
                className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Ordre du jour */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Ordre du jour
            </label>
            <textarea
              value={ordreJour}
              onChange={e => setOrdreJour(e.target.value)}
              placeholder="Points à aborder durant la réunion..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
            />
          </div>
        </div>
      </div>

      {/* ─── ÉTAPE 2 : Enregistrement ─── */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-card">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Mic className="w-4 h-4 text-gray-400" />
            Enregistrement audio
          </h3>
        </div>
        <div className="p-5">

          {/* Idle */}
          {recordingState === 'idle' && !audioBlob && (
            <div className="text-center py-6">
              <button
                onClick={startRecording}
                className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors shadow-sm"
              >
                <Mic className="w-4 h-4" />
                Démarrer l&apos;enregistrement
              </button>
              <p className="text-xs text-gray-400 mt-3">
                Assurez-vous d&apos;être dans un environnement calme
              </p>
            </div>
          )}

          {/* Recording / Paused */}
          {(recordingState === 'recording' || recordingState === 'paused') && (
            <div className="text-center py-6 space-y-5">
              {/* Pulse indicator */}
              <div className="flex items-center justify-center gap-3">
                <div className={cn(
                  'w-3 h-3 rounded-full',
                  recordingState === 'recording' ? 'bg-red-500 animate-pulse' : 'bg-yellow-500',
                )} />
                <span className="text-sm font-medium text-gray-700">
                  {recordingState === 'recording' ? 'Enregistrement en cours' : 'En pause'}
                </span>
              </div>

              {/* Timer */}
              <p className="text-4xl font-mono font-bold text-gray-900 tabular-nums">
                {formatTime(elapsed)}
              </p>

              {/* Controls */}
              <div className="flex items-center justify-center gap-3">
                {recordingState === 'recording' ? (
                  <button
                    onClick={pauseRecording}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 transition-colors"
                  >
                    <Pause className="w-4 h-4" />
                    Pause
                  </button>
                ) : (
                  <button
                    onClick={resumeRecording}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    Reprendre
                  </button>
                )}
                <button
                  onClick={stopRecording}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                  <Square className="w-3.5 h-3.5" />
                  Arrêter
                </button>
              </div>
            </div>
          )}

          {/* Done — Audio player */}
          {recordingState === 'done' && audioUrl && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <audio src={audioUrl} controls className="flex-1 h-10" />
                <span className="text-xs text-gray-400 flex-shrink-0 tabular-nums">{formatTime(elapsed)}</span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={resetRecording}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Recommencer
                </button>

                {!crText && !generating && (
                  <button
                    onClick={handleGenerate}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    Générer le CR
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── ÉTAPE 3 : Génération en cours ─── */}
      {generating && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-card p-10 text-center">
          <Loader2 className="w-8 h-8 text-gray-400 mx-auto mb-4 animate-spin" />
          <p className="text-sm font-medium text-gray-700">{genStatus}</p>
          <p className="text-xs text-gray-400 mt-1">Cela peut prendre quelques instants</p>
        </div>
      )}

      {/* ─── ÉTAPE 4 : CR éditable ─── */}
      {/* ─── Transcription brute (collapsible) ─── */}
      {step === 'review' && transcriptionText && (
        <details className="bg-white rounded-lg border border-gray-200 shadow-card">
          <summary className="px-5 py-4 cursor-pointer text-sm font-semibold text-gray-900 flex items-center gap-2 hover:bg-gray-50 transition-colors">
            <Mic className="w-4 h-4 text-gray-400" />
            Transcription brute
            <span className="text-xs font-normal text-gray-400 ml-auto">Cliquer pour déplier</span>
          </summary>
          <div className="px-5 pb-5">
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{transcriptionText}</p>
          </div>
        </details>
      )}

      {/* ─── ÉTAPE 4 : CR éditable ─── */}
      {step === 'review' && crText && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-card">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-400" />
              Compte rendu généré
            </h3>
            {deposited && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                <Check className="w-3.5 h-3.5" />
                Déposé
              </span>
            )}
          </div>
          <div className="p-5 space-y-4">
            <textarea
              value={crText}
              onChange={e => setCrText(e.target.value)}
              rows={20}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-y"
            />

            {!deposited ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDeposit}
                  disabled={depositing || !crText.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {depositing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Dépôt en cours...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Valider et déposer
                    </>
                  )}
                </button>
                <p className="text-xs text-gray-400">
                  Le CR sera déposé dans la GED et les participants notifiés
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={resetRecording}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Nouvelle réunion
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
