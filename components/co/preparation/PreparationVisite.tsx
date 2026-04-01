'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  ChevronDown, ChevronUp, Check, FileText, HardHat, ClipboardCheck,
  Calendar, Loader2, Save, RotateCcw,
} from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

/* ── Checklist structure ── */

interface CheckItem {
  id: string
  label: string
  checked: boolean
  note: string
}

interface CheckSection {
  id: string
  title: string
  items: CheckItem[]
}

interface CheckPhase {
  id: 'avant' | 'pendant' | 'apres'
  title: string
  sections: CheckSection[]
}

function buildChecklist(): CheckPhase[] {
  return [
    {
      id: 'avant',
      title: 'AVANT LA VISITE',
      sections: [
        {
          id: 'preparation_docs',
          title: 'Préparation documents',
          items: [
            { id: 'av_1', label: 'Planning PPE chargé et à jour', checked: false, note: '' },
            { id: 'av_2', label: 'Plans EXE de la semaine récupérés', checked: false, note: '' },
            { id: 'av_3', label: 'CR de la visite précédente relu', checked: false, note: '' },
            { id: 'av_4', label: 'Liste des points en suspens de la dernière réunion', checked: false, note: '' },
            { id: 'av_5', label: 'Rapports bureau de contrôle (RICT/RFCT) consultés', checked: false, note: '' },
            { id: 'av_6', label: 'Rapport SPS (VIC) consulté', checked: false, note: '' },
            { id: 'av_7', label: 'Liste des ST présents cette semaine vérifiée', checked: false, note: '' },
          ],
        },
        {
          id: 'anticipation_m1',
          title: 'Anticipation M+1',
          items: [
            { id: 'av_8', label: 'ST du mois prochain identifiés', checked: false, note: '' },
            { id: 'av_9', label: 'Accès chantier confirmé pour les prochains ST', checked: false, note: '' },
            { id: 'av_10', label: 'Besoins logistiques M+1 préparés', checked: false, note: '' },
          ],
        },
      ],
    },
    {
      id: 'pendant',
      title: 'PENDANT LA VISITE',
      sections: [
        {
          id: 'reunion',
          title: 'Réunion de chantier (avec tous les responsables ST)',
          items: [
            { id: 'pe_1', label: 'Liste des présents notée', checked: false, note: '' },
            { id: 'pe_2', label: 'Ordre du jour communiqué', checked: false, note: '' },
            { id: 'pe_3', label: 'Avancement réel vs planning vérifié par lot', checked: false, note: '' },
            { id: 'pe_4', label: 'Points bloquants identifiés et responsable désigné', checked: false, note: '' },
            { id: 'pe_5', label: 'Décisions prises notées', checked: false, note: '' },
            { id: 'pe_6', label: 'Actions à mener + responsable + délai notés', checked: false, note: '' },
            { id: 'pe_7', label: 'Prochaine réunion fixée', checked: false, note: '' },
            { id: 'pe_8', label: 'Enregistrement audio lancé', checked: false, note: '' },
          ],
        },
        {
          id: 'tournee',
          title: 'Tournée terrain (lot par lot)',
          items: [
            { id: 'pe_t1',  label: 'Démolition — avancement + conformité', checked: false, note: '' },
            { id: 'pe_t2',  label: 'Maçonnerie / Cloisons — avancement + conformité', checked: false, note: '' },
            { id: 'pe_t3',  label: 'Menuiseries intérieures — avancement + conformité', checked: false, note: '' },
            { id: 'pe_t4',  label: 'Menuiseries extérieures — avancement + conformité', checked: false, note: '' },
            { id: 'pe_t5',  label: 'Revêtements de sols — avancement + conformité', checked: false, note: '' },
            { id: 'pe_t6',  label: 'Revêtements muraux — avancement + conformité', checked: false, note: '' },
            { id: 'pe_t7',  label: 'Faux-plafonds — avancement + conformité', checked: false, note: '' },
            { id: 'pe_t8',  label: 'Peinture — avancement + conformité', checked: false, note: '' },
            { id: 'pe_t9',  label: 'Électricité CFO/CFA — avancement + conformité', checked: false, note: '' },
            { id: 'pe_t10', label: 'Plomberie / Sanitaires — avancement + conformité', checked: false, note: '' },
            { id: 'pe_t11', label: 'CVC — avancement + conformité', checked: false, note: '' },
            { id: 'pe_t12', label: 'Désenfumage — avancement + conformité', checked: false, note: '' },
            { id: 'pe_t13', label: 'Serrurerie / Métallerie — avancement + conformité', checked: false, note: '' },
            { id: 'pe_t14', label: 'Signalétique — avancement + conformité', checked: false, note: '' },
          ],
        },
        {
          id: 'controle_secu',
          title: 'Contrôle & Sécurité',
          items: [
            { id: 'pe_c1', label: 'Observations bureau de contrôle levées ?', checked: false, note: '' },
            { id: 'pe_c2', label: 'Changements matériaux / produits → soumis au BC ?', checked: false, note: '' },
            { id: 'pe_c3', label: 'Fiches produits nouvelles validées ?', checked: false, note: '' },
            { id: 'pe_c4', label: 'Conformité sécurité site vérifiée (VIC)', checked: false, note: '' },
          ],
        },
        {
          id: 'photos',
          title: 'Photos terrain',
          items: [
            { id: 'pe_p1', label: 'Photos des points problématiques prises', checked: false, note: '' },
            { id: 'pe_p2', label: 'Photos liées au lot et au point checklist', checked: false, note: '' },
          ],
        },
      ],
    },
    {
      id: 'apres',
      title: 'APRÈS LA VISITE',
      sections: [
        {
          id: 'cr_reunion',
          title: 'CR de réunion',
          items: [
            { id: 'ap_1', label: 'Audio transcrit → CR généré par Claude', checked: false, note: '' },
            { id: 'ap_2', label: 'CR relu et corrigé', checked: false, note: '' },
            { id: 'ap_3', label: 'CR déposé dans la plateforme', checked: false, note: '' },
            { id: 'ap_4', label: 'Destinataires tagués (client + ST concernés)', checked: false, note: '' },
          ],
        },
        {
          id: 'suivi',
          title: 'Suivi',
          items: [
            { id: 'ap_5', label: 'Points en suspens mis à jour', checked: false, note: '' },
            { id: 'ap_6', label: 'Alertes M+1 vérifiées dans la plateforme', checked: false, note: '' },
            { id: 'ap_7', label: 'Modifications plans → notifiées à la dessinatrice', checked: false, note: '' },
            { id: 'ap_8', label: 'Observations BC non levées → relancées', checked: false, note: '' },
          ],
        },
      ],
    },
  ]
}

const PHASE_ICONS: Record<string, typeof FileText> = {
  avant: FileText,
  pendant: HardHat,
  apres: ClipboardCheck,
}

/* ── Component ── */

interface PreparationVisiteProps {
  projetId: string
  projetNom: string
}

export function PreparationVisite({ projetId, projetNom }: PreparationVisiteProps) {
  const { user } = useUser()
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const [phases, setPhases] = useState<CheckPhase[]>(buildChecklist())
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['preparation_docs']))
  const [semaine, setSemaine] = useState<number>(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), 0, 1)
    const diff = now.getTime() - start.getTime()
    return Math.ceil(diff / (7 * 24 * 60 * 60 * 1000))
  })
  const [checklistId, setChecklistId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // Weeks list (current + 4 previous)
  const weeks = Array.from({ length: 8 }, (_, i) => semaine - 3 + i)

  /* ── Load existing checklist for this week ── */
  const loadWeek = useCallback(async (weekNum: number) => {
    setLoading(true)
    const { data } = await supabase.schema('app').from('checklists')
      .select('id, points')
      .eq('projet_id', projetId)
      .eq('type', 'terrain')
      .eq('lot_id', null as unknown as string) // preparation checklists have no lot
      .order('created_at', { ascending: false })

    // Find one matching the week from the JSON
    let found: { id: string; data: CheckPhase[] } | null = null
    for (const row of data ?? []) {
      const pts = row.points as unknown as { semaine?: number; phases?: CheckPhase[] }
      if (pts?.semaine === weekNum) {
        found = { id: row.id, data: pts.phases ?? buildChecklist() }
        break
      }
    }

    if (found) {
      setChecklistId(found.id)
      setPhases(found.data)
    } else {
      setChecklistId(null)
      setPhases(buildChecklist())
    }
    setLoading(false)
    setLastSaved(null)
  }, [supabase, projetId])

  useEffect(() => { loadWeek(semaine) }, [semaine, loadWeek])

  /* ── Autosave every 30s ── */
  useEffect(() => {
    if (!user) return
    const timer = setInterval(() => handleSave(), 30_000)
    return () => clearInterval(timer)
  }, [user, phases, checklistId]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Actions ── */

  function toggleSection(sectionId: string) {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(sectionId)) next.delete(sectionId)
      else next.add(sectionId)
      return next
    })
  }

  function toggleItem(phaseId: string, sectionId: string, itemId: string) {
    setPhases(prev => prev.map(p =>
      p.id === phaseId
        ? {
            ...p,
            sections: p.sections.map(s =>
              s.id === sectionId
                ? { ...s, items: s.items.map(i => i.id === itemId ? { ...i, checked: !i.checked } : i) }
                : s,
            ),
          }
        : p,
    ))
  }

  function updateNote(phaseId: string, sectionId: string, itemId: string, note: string) {
    setPhases(prev => prev.map(p =>
      p.id === phaseId
        ? {
            ...p,
            sections: p.sections.map(s =>
              s.id === sectionId
                ? { ...s, items: s.items.map(i => i.id === itemId ? { ...i, note } : i) }
                : s,
            ),
          }
        : p,
    ))
  }

  async function handleSave() {
    if (!user) return
    setSaving(true)

    const payload = { semaine, phases } as unknown as Record<string, unknown>

    if (checklistId) {
      await supabase.schema('app').from('checklists')
        .update({ points: payload })
        .eq('id', checklistId)
    } else {
      const { data } = await supabase.schema('app').from('checklists')
        .insert({
          projet_id: projetId,
          type: 'terrain',
          points: payload,
          created_by: user.id,
        })
        .select('id').single()
      if (data) setChecklistId(data.id)
    }

    setLastSaved(new Date())
    setSaving(false)
  }

  function resetWeek() {
    setPhases(buildChecklist())
    setLastSaved(null)
  }

  /* ── Stats ── */
  const allItems = phases.flatMap(p => p.sections.flatMap(s => s.items))
  const totalChecked = allItems.filter(i => i.checked).length
  const totalItems = allItems.length
  const pct = totalItems > 0 ? Math.round((totalChecked / totalItems) * 100) : 0

  /* ── Render ── */

  return (
    <div className="space-y-5">

      {/* Header: week selector + stats */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-card px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{projetNom}</h3>
            <p className="text-xs text-gray-400 mt-0.5">Préparation de visite hebdomadaire</p>
          </div>
          <div className="flex items-center gap-2">
            {saving && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />}
            {lastSaved && !saving && (
              <span className="text-[10px] text-gray-400">
                Sauvé {lastSaved.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button onClick={handleSave} disabled={saving}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
              <Save className="w-3 h-3" />Sauvegarder
            </button>
            <button onClick={resetWeek}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
              <RotateCcw className="w-3 h-3" />Réinitialiser
            </button>
          </div>
        </div>

        {/* Week tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {weeks.map(w => (
            <button key={w} onClick={() => setSemaine(w)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex-shrink-0',
                w === semaine
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700',
              )}>
              <Calendar className="w-3 h-3 inline mr-1" />
              S{w}
            </button>
          ))}
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500">{totalChecked}/{totalItems} points</span>
            <span className={cn('font-semibold', pct === 100 ? 'text-emerald-600' : pct > 50 ? 'text-blue-600' : 'text-gray-600')}>
              {pct}%
            </span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500', pct === 100 ? 'bg-emerald-500' : 'bg-gray-900')}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : (
        /* Phases */
        phases.map(phase => {
          const PhaseIcon = PHASE_ICONS[phase.id] ?? FileText
          const phaseItems = phase.sections.flatMap(s => s.items)
          const phaseChecked = phaseItems.filter(i => i.checked).length
          const phaseDone = phaseChecked === phaseItems.length && phaseItems.length > 0

          return (
            <div key={phase.id} className="space-y-2">
              {/* Phase header */}
              <div className="flex items-center gap-2 px-1">
                <PhaseIcon className="w-4 h-4 text-gray-500" />
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">{phase.title}</h4>
                <span className={cn(
                  'text-[10px] font-medium px-1.5 py-0.5 rounded',
                  phaseDone ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500',
                )}>
                  {phaseChecked}/{phaseItems.length}
                </span>
              </div>

              {/* Sections */}
              {phase.sections.map(section => {
                const expanded = expandedSections.has(section.id)
                const sectionChecked = section.items.filter(i => i.checked).length
                const sectionDone = sectionChecked === section.items.length

                return (
                  <div key={section.id} className="bg-white rounded-lg border border-gray-200 shadow-card overflow-hidden">
                    <button onClick={() => toggleSection(section.id)}
                      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors text-left">
                      <div className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold',
                        sectionDone ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400',
                      )}>
                        {sectionDone ? <Check className="w-3.5 h-3.5" /> : sectionChecked}
                      </div>
                      <p className="text-sm font-medium text-gray-900 flex-1">{section.title}</p>
                      <span className="text-[10px] text-gray-400 mr-2">{sectionChecked}/{section.items.length}</span>
                      {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </button>

                    {expanded && (
                      <div className="border-t border-gray-100 divide-y divide-gray-50">
                        {section.items.map(item => (
                          <div key={item.id} className="px-5 py-2.5">
                            <label className="flex items-start gap-3 cursor-pointer">
                              <input type="checkbox" checked={item.checked}
                                onChange={() => toggleItem(phase.id, section.id, item.id)}
                                className="mt-0.5 rounded border-gray-300 text-gray-900" />
                              <span className={cn(
                                'text-sm flex-1',
                                item.checked ? 'text-gray-400 line-through' : 'text-gray-700',
                              )}>
                                {item.label}
                              </span>
                            </label>
                            {/* Note field visible when checked or has content */}
                            {(item.checked || item.note) && (
                              <input type="text" value={item.note}
                                onChange={e => updateNote(phase.id, section.id, item.id, e.target.value)}
                                placeholder="Note..."
                                className="mt-1.5 ml-7 w-[calc(100%-1.75rem)] px-2 py-1 border border-gray-200 rounded text-xs text-gray-600 placeholder-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-900" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })
      )}
    </div>
  )
}
