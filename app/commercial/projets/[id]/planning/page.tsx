'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Calendar, ZoomIn, ZoomOut, Flag, Hammer, CheckCircle2, Send, X, Mail } from 'lucide-react'
import Gantt from 'frappe-gantt'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate } from '@/lib/utils'

/* ── Types ── */

interface Intervention {
  id: string
  projet_id: string
  corps_etat: string
  st_nom: string | null
  date_debut: string
  date_fin: string
  avancement_pct: number
  statut: 'planifie' | 'confirme' | 'en_cours' | 'termine' | 'retarde'
  couleur: string | null
}

interface Projet {
  id: string
  nom: string
  reference: string | null
  client_nom: string | null
  client_email: string | null
  date_debut: string | null
  date_livraison: string | null
}

const STATUT_COLORS: Record<string, string> = {
  planifie: '#3b82f6',
  confirme: '#10b981',
  en_cours: '#f59e0b',
  termine: '#9ca3af',
  retarde: '#ef4444',
}

const ZOOM_LEVELS = ['Day', 'Week', 'Month'] as const
type ZoomLevel = typeof ZOOM_LEVELS[number]

/* ── Component ── */

export default function PlanningClientPage() {
  const { id: projetId } = useParams<{ id: string }>()
  const supabase = createClient()
  const ganttRef = useRef<HTMLDivElement>(null)

  const [projet, setProjet] = useState<Projet | null>(null)
  const [interventions, setInterventions] = useState<Intervention[]>([])
  const [loading, setLoading] = useState(true)
  const [zoom, setZoom] = useState<ZoomLevel>('Month')
  const [showSendModal, setShowSendModal] = useState(false)

  /* ── Load ── */
  const load = useCallback(async () => {
    setLoading(true)
    const [projetRes, intRes] = await Promise.all([
      supabase.schema('app').from('projets')
        .select('id, nom, reference, client_nom, client_email, date_debut, date_livraison')
        .eq('id', projetId).single(),
      supabase.schema('app').from('planning_interventions')
        .select('*').eq('projet_id', projetId).order('date_debut'),
    ])
    setProjet(projetRes.data as Projet | null)
    setInterventions((intRes.data ?? []) as Intervention[])
    setLoading(false)
  }, [projetId, supabase])

  useEffect(() => { load() }, [load])

  /* ── Build client view tasks (jalons) ── */
  const buildClientTasks = useCallback(() => {
    if (interventions.length === 0) return []

    const sorted = [...interventions].sort((a, b) => a.date_debut.localeCompare(b.date_debut))
    const earliest = sorted[0].date_debut
    const latest = [...interventions].sort((a, b) => b.date_fin.localeCompare(a.date_fin))[0].date_fin
    const midMs = (new Date(earliest).getTime() + new Date(latest).getTime()) / 2
    const midDate = new Date(midMs).toISOString().split('T')[0]

    return [
      { id: 'jalon-debut', name: 'Demarrage chantier', start: earliest, end: earliest, progress: 100, custom_class: 'bar-confirme' },
      { id: 'jalon-mi',    name: 'Mi-chantier',         start: midDate,  end: midDate,  progress: 50,  custom_class: 'bar-en_cours' },
      { id: 'jalon-fin',   name: 'Livraison',           start: latest,   end: latest,   progress: 0,   custom_class: 'bar-planifie' },
    ]
  }, [interventions])

  /* ── Render Gantt ── */
  useEffect(() => {
    if (!ganttRef.current || loading) return
    const tasks = buildClientTasks()
    if (tasks.length === 0) {
      ganttRef.current.innerHTML = ''
      return
    }
    ganttRef.current.innerHTML = ''
    const containerWidth = ganttRef.current.clientWidth || 800
    const COLUMN_WIDTHS: Record<ZoomLevel, number> = {
      Day: 38,
      Week: 140,
      Month: Math.max(50, Math.floor(containerWidth / 12)),
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new Gantt(ganttRef.current, tasks as any, {
      view_mode: zoom,
      column_width: COLUMN_WIDTHS[zoom],
      bar_height: 28,
      bar_corner_radius: 4,
      padding: 18,
    })
  }, [buildClientTasks, loading, zoom])

  function zoomIn()  { setZoom(z => ZOOM_LEVELS[Math.max(0, ZOOM_LEVELS.indexOf(z) - 1)]) }
  function zoomOut() { setZoom(z => ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, ZOOM_LEVELS.indexOf(z) + 1)]) }

  /* ── Phases derivees pour resume ── */
  const phases = (() => {
    if (interventions.length === 0) return null
    const sorted = [...interventions].sort((a, b) => a.date_debut.localeCompare(b.date_debut))
    const earliest = sorted[0].date_debut
    const latest = [...interventions].sort((a, b) => b.date_fin.localeCompare(a.date_fin))[0].date_fin
    const totalMs = new Date(latest).getTime() - new Date(earliest).getTime()
    const midDate = new Date(new Date(earliest).getTime() + totalMs / 2).toISOString().split('T')[0]
    const dureeJours = Math.ceil(totalMs / (1000 * 60 * 60 * 24))

    const today = new Date().toISOString().split('T')[0]
    let etat: 'avenir' | 'en_cours' | 'termine' = 'avenir'
    if (today >= earliest && today <= latest) etat = 'en_cours'
    else if (today > latest) etat = 'termine'

    return { earliest, midDate, latest, dureeJours, etat }
  })()

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <style jsx global>{`
        .bar-planifie .bar { fill: ${STATUT_COLORS.planifie} !important; }
        .bar-confirme .bar { fill: ${STATUT_COLORS.confirme} !important; }
        .bar-en_cours .bar { fill: ${STATUT_COLORS.en_cours} !important; }
        .bar-termine .bar  { fill: ${STATUT_COLORS.termine}  !important; }
        .bar-retarde .bar  { fill: ${STATUT_COLORS.retarde}  !important; }
        .gantt .bar-progress { fill: rgba(0,0,0,0.15) !important; }
      `}</style>

      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href={`/commercial/projets/${projetId}`}
          className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors flex-shrink-0 mt-0.5">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Planning client</p>
          <h1 className="text-xl font-semibold text-gray-900 truncate">{projet?.nom ?? '...'}</h1>
          {projet?.client_nom && <p className="text-sm text-gray-500 mt-0.5">{projet.client_nom}</p>}
        </div>
        {interventions.length > 0 && projet?.client_email && (
          <button onClick={() => setShowSendModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors flex-shrink-0">
            <Send className="w-4 h-4" /> Envoyer au client
          </button>
        )}
      </div>

      {loading ? (
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      ) : interventions.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700">Planning non encore defini</p>
          <p className="text-xs text-gray-400 mt-1">Le planning operationnel sera mis en place par le Charge d&apos;operations.</p>
        </div>
      ) : (
        <>
          {/* Cards jalons */}
          {phases && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <JalonCard
                icon={<Flag className="w-4 h-4" />}
                bg="#EAF3DE" color="#3B6D11"
                label="Demarrage chantier"
                date={phases.earliest}
                etat={phases.etat === 'avenir' ? 'A venir' : 'Lance'}
              />
              <JalonCard
                icon={<Hammer className="w-4 h-4" />}
                bg="#FAEEDA" color="#854F0B"
                label="Mi-chantier"
                date={phases.midDate}
                etat={phases.etat === 'en_cours' ? 'En cours' : phases.etat === 'termine' ? 'Passe' : 'A venir'}
              />
              <JalonCard
                icon={<CheckCircle2 className="w-4 h-4" />}
                bg="#E6F1FB" color="#185FA5"
                label="Livraison"
                date={phases.latest}
                etat={phases.etat === 'termine' ? 'Livre' : `J-${Math.max(0, Math.ceil((new Date(phases.latest).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))}`}
              />
            </div>
          )}

          {/* Resume */}
          {phases && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Duree totale</p>
                  <p className="text-sm font-semibold text-gray-900">{phases.dureeJours} jours</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Demarrage</p>
                  <p className="text-sm font-semibold text-gray-900">{formatDate(phases.earliest)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Livraison prevue</p>
                  <p className="text-sm font-semibold text-gray-900">{formatDate(phases.latest)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Etat actuel</p>
                  <span className={cn('inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full',
                    phases.etat === 'avenir' && 'bg-gray-100 text-gray-700',
                    phases.etat === 'en_cours' && 'bg-amber-100 text-amber-700',
                    phases.etat === 'termine' && 'bg-emerald-100 text-emerald-700',
                  )}>
                    {phases.etat === 'avenir' ? 'A venir' : phases.etat === 'en_cours' ? 'En cours' : 'Termine'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Gantt header */}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Vue chronologique</p>
            <div className="flex items-center gap-0.5 bg-white border border-gray-200 rounded-lg p-0.5">
              <button onClick={zoomOut} disabled={zoom === 'Month'} title="Dezoomer"
                className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-30 transition-colors">
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-medium text-gray-500 px-1.5 min-w-[50px] text-center">{zoom}</span>
              <button onClick={zoomIn} disabled={zoom === 'Day'} title="Zoomer"
                className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-30 transition-colors">
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Gantt container */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 overflow-x-auto">
            <div ref={ganttRef} className="gantt-target" />
          </div>

          {/* Note */}
          <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-700">
              Cette vue est generee a partir du planning operationnel cree par le CO. Les jalons sont calcules automatiquement (demarrage, mi-chantier, livraison).
            </p>
          </div>
        </>
      )}

      {/* Modal envoi client */}
      {showSendModal && projet && (
        <SendToClientModal projet={projet} onClose={() => setShowSendModal(false)} />
      )}
    </div>
  )
}

/* ── Jalon Card ── */

function JalonCard({ icon, bg, color, label, date, etat }: {
  icon: React.ReactNode; bg: string; color: string
  label: string; date: string; etat: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="p-1.5 rounded-lg flex-shrink-0" style={{ backgroundColor: bg, color }}>
          {icon}
        </div>
        <p className="text-xs font-semibold text-gray-700">{label}</p>
      </div>
      <p className="text-base font-bold text-gray-900">{formatDate(date)}</p>
      <p className="text-xs text-gray-400 mt-0.5">{etat}</p>
    </div>
  )
}

/* ── Modal envoi au client ── */

function SendToClientModal({ projet, onClose }: { projet: Projet; onClose: () => void }) {
  const [email, setEmail] = useState(projet.client_email ?? '')
  const [message, setMessage] = useState(`Bonjour,\n\nVeuillez trouver ci-joint le planning previsionnel du chantier "${projet.nom}".\n\nCordialement,`)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSend() {
    setSending(true)
    try {
      await fetch('https://apiprojet.app.n8n.cloud/webhook/planning-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projet_id: projet.id,
          projet_nom: projet.nom,
          client_email: email,
          message,
        }),
      })
      setSent(true)
      setTimeout(onClose, 2000)
    } catch { /* ignore */ }
    setSending(false)
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Mail className="w-4 h-4" /> Envoyer le planning au client
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="px-5 py-5 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email destinataire</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Message</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={6}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none" />
            </div>
          </div>
          <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
            <button onClick={onClose} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
            <button onClick={handleSend} disabled={sending || sent || !email}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50">
              {sending ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : sent ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
              {sent ? 'Envoye' : 'Envoyer'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
