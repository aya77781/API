'use client'

import { useState, useEffect, useRef } from 'react'
import {
  MessageSquare, AlertTriangle, X, Trash2, Loader2, Send,
  MapPin, Camera, Image as ImageIcon, Layers, ChevronDown, ChevronUp, Check,
} from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import { cn, getMondayOf, toISODate, formatSemaineDebut, listSemaines, shortSemaineLabel } from '@/lib/utils'
import { AbbrLot } from '@/components/shared/Abbr'
import { Calendar } from 'lucide-react'

interface Lot {
  id: string
  numero: number | null
  corps_etat: string | null
  nom: string | null
  ordre: number | null
}

const NIVEAUX = [
  'Sous-sol',
  'RDC',
  '1er etage',
  '2eme etage',
  '3eme etage',
  '4eme etage',
  '5eme etage et plus',
  'Combles',
  'Toiture',
  'Exterieur',
  'Parking',
  'Cage d\'escalier',
  'Local technique',
]

interface Entry {
  id: string
  projet_id: string
  lot_id: string | null
  type: 'remarque' | 'alerte'
  priorite: 'low' | 'normal' | 'high'
  titre: string | null
  contenu: string | null
  localisation: string | null
  fichiers_joints: string[] | null
  semaine_debut: string | null
  statut: 'ouverte' | 'en_cours' | 'resolue' | 'archivee'
  created_at: string
}

const PRIORITE_CONFIG: Record<Entry['priorite'], { label: string; color: string }> = {
  low:    { label: 'Faible', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  normal: { label: 'Moyen',  color: 'text-orange-600 bg-orange-50 border-orange-200' },
  high:   { label: 'Urgent', color: 'text-red-600 bg-red-50 border-red-200' },
}

const STATUT_CONFIG: Record<Entry['statut'], { label: string; color: string }> = {
  ouverte:  { label: 'Ouvert',   color: 'text-red-600 bg-red-50' },
  en_cours: { label: 'En cours', color: 'text-amber-600 bg-amber-50' },
  resolue:  { label: 'Resolu',   color: 'text-emerald-600 bg-emerald-50' },
  archivee: { label: 'Archive',  color: 'text-gray-500 bg-gray-100' },
}

interface VisiteChantierProps {
  projetId: string
}

export function VisiteChantier({ projetId }: VisiteChantierProps) {
  const { user } = useUser()
  const supabase = useRef(createClient()).current

  const [tab, setTab] = useState<'remarque' | 'alerte'>('remarque')

  const [lots, setLots] = useState<Lot[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)

  // Semaine selectionnee (lundi ISO). Tout est filtre + tagge sur cette semaine.
  const [semaine, setSemaine] = useState<string>(() => toISODate(getMondayOf(new Date())))
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set())
  const weeks = listSemaines(6, 1)

  // Contexte partage (lot + localisation dans le batiment) — pre-rempli puis ajustable
  const [ctxLotId, setCtxLotId] = useState<string>('')
  const [ctxNiveau, setCtxNiveau] = useState<string>('')
  const [ctxZone, setCtxZone] = useState('')

  // Form
  const [titre, setTitre] = useState('')
  const [contenu, setContenu] = useState('')
  const [priorite, setPriorite] = useState<Entry['priorite']>('normal')
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [uploadingPhotos, setUploadingPhotos] = useState(false)

  /* ── Load data ── */
  useEffect(() => {
    async function load() {
      const [lotsAppRes, lotsPubRes, entriesRes] = await Promise.all([
        supabase.schema('app').from('lots')
          .select('id, numero, corps_etat')
          .eq('projet_id', projetId)
          .order('numero', { nullsFirst: false }),
        supabase.from('lots')
          .select('id, nom, ordre')
          .eq('projet_id', projetId)
          .order('ordre', { nullsFirst: false }),
        supabase.schema('app').from('chantier_remarques')
          .select('*')
          .eq('projet_id', projetId)
          .in('type', ['remarque', 'alerte'])
          .order('created_at', { ascending: false }),
      ])
      const merged = new Map<string, Lot>()
      for (const l of (lotsAppRes.data ?? []) as Array<{ id: string; numero: number | null; corps_etat: string | null }>) {
        merged.set(l.id, { id: l.id, numero: l.numero, corps_etat: l.corps_etat, nom: null, ordre: null })
      }
      for (const l of (lotsPubRes.data ?? []) as Array<{ id: string; nom: string | null; ordre: number | null }>) {
        const existing = merged.get(l.id)
        if (existing) {
          merged.set(l.id, { ...existing, nom: l.nom, ordre: l.ordre })
        } else {
          merged.set(l.id, { id: l.id, numero: null, corps_etat: null, nom: l.nom, ordre: l.ordre })
        }
      }
      setLots(Array.from(merged.values()).sort((a, b) => {
        const na = a.numero ?? (a.ordre != null ? a.ordre + 1 : 999)
        const nb = b.numero ?? (b.ordre != null ? b.ordre + 1 : 999)
        return na - nb
      }))
      setEntries((entriesRes.data ?? []) as Entry[])
      setLoading(false)
    }
    load()
  }, [projetId, supabase])

  /* ── Photo handling ── */
  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setPhotoFiles(prev => [...prev, ...files])
    setPhotoPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))])
    e.target.value = ''
  }

  function removePhoto(idx: number) {
    setPhotoFiles(prev => prev.filter((_, i) => i !== idx))
    setPhotoPreviews(prev => {
      const copy = [...prev]
      URL.revokeObjectURL(copy[idx])
      copy.splice(idx, 1)
      return copy
    })
  }

  async function uploadPhotos(): Promise<string[]> {
    if (photoFiles.length === 0) return []
    setUploadingPhotos(true)
    const urls: string[] = []
    for (const file of photoFiles) {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${projetId}/visite-photos/${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`
      const { error } = await supabase.storage.from('projets').upload(path, file, { upsert: false })
      if (error) continue
      const { data } = supabase.storage.from('projets').getPublicUrl(path)
      urls.push(data.publicUrl)
    }
    setUploadingPhotos(false)
    return urls
  }

  /* ── Submit ── */
  async function handleSubmit() {
    if (!user) return
    if (!ctxLotId) { alert('Selectionnez un lot concerne'); return }
    if (!ctxNiveau) { alert('Selectionnez le niveau dans le batiment'); return }
    if (!ctxZone.trim()) { alert('Renseignez la zone / piece'); return }
    if (!contenu.trim()) { alert('Saisissez le contenu'); return }
    const localisation = `${ctxNiveau} — ${ctxZone.trim()}`

    setSaving(true)
    const photoUrls = await uploadPhotos()

    const { data, error } = await supabase.schema('app').from('chantier_remarques')
      .insert({
        projet_id: projetId,
        lot_id: ctxLotId,
        type: tab,
        priorite: tab === 'alerte' ? priorite : 'normal',
        titre: titre.trim() || (tab === 'alerte' ? 'Probleme' : 'Remarque'),
        contenu: contenu.trim(),
        localisation,
        semaine_debut: semaine,
        fichiers_joints: photoUrls,
        auteur_id: user.id,
        statut: 'ouverte',
        source: 'visite_co',
      } as never)
      .select()
      .single()

    if (error) {
      alert(`Erreur sauvegarde : ${error.message}`)
      setSaving(false)
      return
    }

    if (data) {
      setEntries(prev => [data as Entry, ...prev])
      setTitre('')
      setContenu('')
      setPriorite('normal')
      photoPreviews.forEach(URL.revokeObjectURL)
      setPhotoFiles([])
      setPhotoPreviews([])
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    await supabase.schema('app').from('chantier_remarques').delete().eq('id', id)
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  async function handleChangeStatut(id: string, statut: Entry['statut']) {
    await supabase.schema('app').from('chantier_remarques')
      .update({ statut } as never).eq('id', id)
    setEntries(prev => prev.map(e => e.id === id ? { ...e, statut } : e))
  }

  /* ── Render ── */
  const filteredEntries = entries.filter(e => e.type === tab && e.semaine_debut === semaine)

  // Semaines passees (avec entries, hors semaine courante affichee)
  const pastWeeksMap = new Map<string, Entry[]>()
  for (const e of entries) {
    if (!e.semaine_debut || e.semaine_debut === semaine) continue
    if (!pastWeeksMap.has(e.semaine_debut)) pastWeeksMap.set(e.semaine_debut, [])
    pastWeeksMap.get(e.semaine_debut)!.push(e)
  }
  const pastWeeks = Array.from(pastWeeksMap.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  function toggleWeek(w: string) {
    setExpandedWeeks(prev => {
      const next = new Set(prev)
      if (next.has(w)) next.delete(w); else next.add(w)
      return next
    })
  }
  const lotById = new Map(lots.map(l => [l.id, l]))

  const tabs = [
    { key: 'remarque' as const, label: 'Remarques', icon: MessageSquare, count: entries.filter(e => e.type === 'remarque').length },
    { key: 'alerte' as const,   label: 'Problemes',  icon: AlertTriangle, count: entries.filter(e => e.type === 'alerte' && e.statut !== 'resolue').length },
  ]

  return (
    <div className="space-y-5">
      {/* Semaine selector */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-card px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          <p className="text-xs font-medium text-gray-700">Semaine</p>
          <span className="text-[10px] text-gray-400">— {formatSemaineDebut(semaine)}</span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {weeks.map(w => {
            const hasEntries = entries.some(e => e.semaine_debut === w)
            const isActive = w === semaine
            return (
              <button key={w} onClick={() => setSemaine(w)}
                title={formatSemaineDebut(w)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex-shrink-0 whitespace-nowrap inline-flex items-center gap-1',
                  isActive
                    ? 'bg-gray-900 text-white'
                    : hasEntries
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700',
                )}>
                <Calendar className="w-3 h-3" />
                {shortSemaineLabel(w)}
                {hasEntries && <Check className={cn('w-3 h-3', isActive ? 'text-emerald-300' : 'text-emerald-600')} />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map(t => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                active ? 'bg-gray-900 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300',
              )}>
              <Icon className="w-4 h-4" />
              {t.label}
              {t.count > 0 && (
                <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                  active ? 'bg-white/20' : 'bg-gray-100')}>
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
        {/* Contexte: lot + localisation dans le batiment */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />Lot concerne *
            </label>
            <select value={ctxLotId} onChange={e => setCtxLotId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
              <option value="">{lots.length === 0 ? 'Aucun lot saisi pour ce projet' : 'Selectionner un lot...'}</option>
              {lots.map(l => {
                const num = l.numero ?? (l.ordre != null ? l.ordre + 1 : null)
                const label = l.corps_etat ?? l.nom ?? '—'
                return (
                  <option key={l.id} value={l.id}>
                    {num != null ? `L${String(num).padStart(2, '0')} — ${label}` : label}
                  </option>
                )
              })}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />Niveau *
              </label>
              <select value={ctxNiveau} onChange={e => setCtxNiveau(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                <option value="">Selectionner le niveau...</option>
                {NIVEAUX.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />Zone / Piece *
              </label>
              <input type="text" value={ctxZone} onChange={e => setCtxZone(e.target.value)}
                placeholder="Ex: Salle de bain principale, mur nord, cuisine..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
          </div>
        </div>

        {/* Champs specifiques */}
        {tab === 'alerte' && (
          <input type="text" value={titre} onChange={e => setTitre(e.target.value)}
            placeholder="Titre du probleme"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900" />
        )}

        <textarea value={contenu} onChange={e => setContenu(e.target.value)}
          placeholder={tab === 'remarque' ? 'Ecrire une remarque...' : 'Description detaillee du probleme...'}
          rows={3}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none" />

        {tab === 'alerte' && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Gravite</label>
            <select value={priorite} onChange={e => setPriorite(e.target.value as Entry['priorite'])}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
              <option value="low">Faible</option>
              <option value="normal">Moyen</option>
              <option value="high">Urgent</option>
            </select>
          </div>
        )}

        {/* Photos */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2 flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5" />Photos
          </label>
          {photoPreviews.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-2">
              {photoPreviews.map((src, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded hover:bg-black/80">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <label className="flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition-colors">
            <ImageIcon className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-500">Ajouter des photos</span>
            <input type="file" accept="image/*" multiple capture="environment" className="hidden"
              onChange={handlePhotoSelect} />
          </label>
        </div>

        <div className="flex justify-end pt-1">
          <button onClick={handleSubmit}
            disabled={saving || uploadingPhotos || !ctxLotId || !ctxNiveau || !ctxZone.trim() || !contenu.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors">
            {saving || uploadingPhotos ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            {tab === 'remarque' ? 'Ajouter la remarque' : 'Signaler le probleme'}
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
          {tab === 'remarque'
            ? <MessageSquare className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            : <AlertTriangle className="w-8 h-8 text-gray-200 mx-auto mb-2" />}
          <p className="text-xs text-gray-400">
            {tab === 'remarque' ? 'Aucune remarque pour l\'instant' : 'Aucun probleme signale'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEntries.map(e => {
            const lot = e.lot_id ? lotById.get(e.lot_id) : null
            const prio = PRIORITE_CONFIG[e.priorite]
            const stat = STATUT_CONFIG[e.statut]
            return (
              <div key={e.id} className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Badges contexte */}
                    <div className="flex items-center flex-wrap gap-1.5 mb-1.5">
                      {lot && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
                          <Layers className="w-3 h-3" />
                          {lot.numero != null && `L${String(lot.numero).padStart(2, '0')} `}
                          <AbbrLot label={lot.corps_etat ?? lot.nom ?? ''} />
                        </span>
                      )}
                      {e.localisation && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                          <MapPin className="w-3 h-3" />{e.localisation}
                        </span>
                      )}
                      {e.type === 'alerte' && (
                        <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded border', prio.color)}>{prio.label}</span>
                      )}
                    </div>
                    {/* Contenu */}
                    {e.titre && <p className="text-sm font-semibold text-gray-900">{e.titre}</p>}
                    {e.contenu && <p className="text-sm text-gray-700 whitespace-pre-wrap mt-0.5">{e.contenu}</p>}
                    {/* Photos */}
                    {e.fichiers_joints && e.fichiers_joints.length > 0 && (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 mt-2">
                        {e.fichiers_joints.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                            className="relative aspect-square rounded overflow-hidden border border-gray-200 hover:border-gray-400">
                            <img src={url} alt="" className="w-full h-full object-cover" />
                          </a>
                        ))}
                      </div>
                    )}
                    <p className="text-[10px] text-gray-400 mt-1.5">
                      {new Date(e.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {e.type === 'alerte' && (
                      <select value={e.statut}
                        onChange={ev => handleChangeStatut(e.id, ev.target.value as Entry['statut'])}
                        className={cn('px-2 py-1 rounded text-[10px] font-medium border-0 focus:outline-none cursor-pointer', stat.color)}>
                        <option value="ouverte">Ouvert</option>
                        <option value="en_cours">En cours</option>
                        <option value="resolue">Resolu</option>
                      </select>
                    )}
                    <button onClick={() => handleDelete(e.id)}
                      className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Historique semaines passees */}
      {pastWeeks.length > 0 && (
        <div className="pt-4 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Historique — semaines passees
          </p>
          <div className="space-y-2">
            {pastWeeks.map(([wMonday, wEntries]) => {
              const wRemarques = wEntries.filter(e => e.type === 'remarque').length
              const wAlertes = wEntries.filter(e => e.type === 'alerte').length
              const isOpen = expandedWeeks.has(wMonday)
              return (
                <div key={wMonday} className="bg-white rounded-lg border border-gray-200 shadow-card overflow-hidden">
                  <button onClick={() => toggleWeek(wMonday)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left">
                    <span className="text-xs font-semibold bg-gray-900 text-white rounded px-2 py-0.5">
                      {shortSemaineLabel(wMonday)}
                    </span>
                    <span className="text-xs text-gray-500 flex-1">{formatSemaineDebut(wMonday)}</span>
                    {wRemarques > 0 && (
                      <span className="text-[10px] font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />{wRemarques}
                      </span>
                    )}
                    {wAlertes > 0 && (
                      <span className="text-[10px] font-medium text-red-700 bg-red-50 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />{wAlertes}
                      </span>
                    )}
                    {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>
                  {isOpen && (
                    <div className="border-t border-gray-100 divide-y divide-gray-50">
                      {wEntries.map(e => {
                        const lot = e.lot_id ? lotById.get(e.lot_id) : null
                        const prio = PRIORITE_CONFIG[e.priorite]
                        const Icon = e.type === 'remarque' ? MessageSquare : AlertTriangle
                        return (
                          <div key={e.id} className="px-4 py-3">
                            <div className="flex items-start gap-2">
                              <Icon className={cn('w-3.5 h-3.5 mt-0.5 flex-shrink-0', e.type === 'alerte' ? 'text-red-500' : 'text-gray-400')} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center flex-wrap gap-1.5 mb-1">
                                  {lot && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
                                      <Layers className="w-3 h-3" />
                                      {lot.numero != null && `L${String(lot.numero).padStart(2, '0')} `}
                                      <AbbrLot label={lot.corps_etat ?? lot.nom ?? ''} />
                                    </span>
                                  )}
                                  {e.localisation && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                                      <MapPin className="w-3 h-3" />{e.localisation}
                                    </span>
                                  )}
                                  {e.type === 'alerte' && (
                                    <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded border', prio.color)}>{prio.label}</span>
                                  )}
                                </div>
                                {e.titre && <p className="text-sm font-medium text-gray-900">{e.titre}</p>}
                                {e.contenu && <p className="text-xs text-gray-600 whitespace-pre-wrap mt-0.5">{e.contenu}</p>}
                                {e.fichiers_joints && e.fichiers_joints.length > 0 && (
                                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-1 mt-1.5">
                                    {e.fichiers_joints.map((url, i) => (
                                      <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                        className="relative aspect-square rounded overflow-hidden border border-gray-200 hover:border-gray-400">
                                        <img src={url} alt="" className="w-full h-full object-cover" />
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
