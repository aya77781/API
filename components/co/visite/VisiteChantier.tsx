'use client'

import { useState, useEffect, useRef } from 'react'
import {
  MessageSquare, Camera, AlertTriangle, Plus, X, Trash2,
  ChevronDown, ChevronUp, Save, Loader2, Image as ImageIcon,
  FolderOpen, Send,
} from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { UserTagPicker, type TaggedUser } from '@/components/shared/UserTagPicker'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

/* ── Types ── */

interface Remarque {
  id: string
  texte: string
  created_at: string
}

interface Photo {
  id: string
  categorie: string
  url: string
  storage_path: string
  legende: string
  created_at: string
}

interface Probleme {
  id: string
  titre: string
  description: string
  gravite: 'faible' | 'moyen' | 'urgent'
  lot_corps_etat: string
  statut: 'ouvert' | 'en_cours' | 'resolu'
  photos: string[]
  created_at: string
}

const PHOTO_CATEGORIES = [
  'Gros oeuvre',
  'Electricite',
  'Plomberie',
  'CVC',
  'Menuiseries',
  'Peinture',
  'Revetements',
  'Faux-plafonds',
  'Exterieur',
  'Securite',
  'Divers',
]

const GRAVITE_CONFIG = {
  faible: { label: 'Faible', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  moyen: { label: 'Moyen', color: 'text-orange-600 bg-orange-50 border-orange-200' },
  urgent: { label: 'Urgent', color: 'text-red-600 bg-red-50 border-red-200' },
}

const STATUT_PROBLEME = {
  ouvert: { label: 'Ouvert', color: 'text-red-600 bg-red-50' },
  en_cours: { label: 'En cours', color: 'text-amber-600 bg-amber-50' },
  resolu: { label: 'Resolu', color: 'text-emerald-600 bg-emerald-50' },
}

/* ── Component ── */

interface VisiteChantierProps {
  projetId: string
}

export function VisiteChantier({ projetId }: VisiteChantierProps) {
  const { user } = useUser()
  const supabase = useRef(createClient()).current

  // Active tab
  const [tab, setTab] = useState<'remarques' | 'photos' | 'problemes'>('remarques')

  /* ══ REMARQUES ══ */
  const [remarques, setRemarques] = useState<Remarque[]>([])
  const [newRemarque, setNewRemarque] = useState('')
  const [remarquesLoading, setRemarquesLoading] = useState(true)
  const [savingRemarque, setSavingRemarque] = useState(false)

  useEffect(() => {
    supabase.schema('app').from('visites_remarques')
      .select('*').eq('projet_id', projetId).order('created_at', { ascending: false })
      .then(({ data }) => { setRemarques((data ?? []) as Remarque[]); setRemarquesLoading(false) })
  }, [projetId, supabase])

  async function handleAddRemarque() {
    if (!newRemarque.trim() || !user) return
    setSavingRemarque(true)
    const { data } = await supabase.schema('app').from('visites_remarques')
      .insert({ projet_id: projetId, co_id: user.id, texte: newRemarque.trim() })
      .select().single()
    if (data) setRemarques(prev => [data as Remarque, ...prev])
    setNewRemarque('')
    setSavingRemarque(false)
  }

  async function handleDeleteRemarque(id: string) {
    await supabase.schema('app').from('visites_remarques').delete().eq('id', id)
    setRemarques(prev => prev.filter(r => r.id !== id))
  }

  /* ══ PHOTOS ══ */
  const [photos, setPhotos] = useState<Photo[]>([])
  const [photosLoading, setPhotosLoading] = useState(true)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoCategorie, setPhotoCategorie] = useState('Divers')
  const [photoLegende, setPhotoLegende] = useState('')
  const [expandedCat, setExpandedCat] = useState<Set<string>>(new Set())

  useEffect(() => {
    supabase.schema('app').from('visites_photos')
      .select('*').eq('projet_id', projetId).order('created_at', { ascending: false })
      .then(({ data }) => {
        setPhotos((data ?? []) as Photo[])
        setPhotosLoading(false)
        // Expand categories that have photos
        const cats = new Set((data ?? []).map((p: { categorie: string }) => p.categorie))
        setExpandedCat(cats)
      })
  }, [projetId, supabase])

  async function handleUploadPhoto(file: File) {
    if (!user) return
    setUploadingPhoto(true)

    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${projetId}/visite-photos/${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`

    const { error: uploadErr } = await supabase.storage.from('projets').upload(path, file, { upsert: false })
    if (uploadErr) { setUploadingPhoto(false); return }

    const { data: urlData } = supabase.storage.from('projets').getPublicUrl(path)

    const { data } = await supabase.schema('app').from('visites_photos')
      .insert({
        projet_id: projetId,
        co_id: user.id,
        categorie: photoCategorie,
        legende: photoLegende.trim(),
        storage_path: path,
        url: urlData.publicUrl,
      })
      .select().single()

    if (data) {
      setPhotos(prev => [data as Photo, ...prev])
      setExpandedCat(prev => new Set(prev).add(photoCategorie))
      // Send alertes to tagged users if any
      if (photoTaggedUsers.length > 0 && user) {
        await supabase.schema('app').from('alertes').insert(
          photoTaggedUsers.map(u => ({
            utilisateur_id: u.id,
            projet_id: projetId,
            type: 'photo_chantier',
            titre: `Photo chantier -- ${photoCategorie}`,
            message: photoLegende.trim() || `Nouvelle photo dans ${photoCategorie}`,
            priorite: 'normal',
            lue: false,
          }))
        )
      }
    }
    setPhotoLegende('')
    setPhotoTaggedUsers([])
    setUploadingPhoto(false)
  }

  async function handleDeletePhoto(photo: Photo) {
    await supabase.storage.from('projets').remove([photo.storage_path])
    await supabase.schema('app').from('visites_photos').delete().eq('id', photo.id)
    setPhotos(prev => prev.filter(p => p.id !== photo.id))
  }

  const photosByCategory = PHOTO_CATEGORIES.map(cat => ({
    categorie: cat,
    photos: photos.filter(p => p.categorie === cat),
  })).filter(g => g.photos.length > 0)

  /* ══ PROBLEMES ══ */
  const [problemes, setProblemes] = useState<Probleme[]>([])
  const [problemesLoading, setProblemesLoading] = useState(true)
  const [showNewProbleme, setShowNewProbleme] = useState(false)
  const [newProbleme, setNewProbleme] = useState({ titre: '', description: '', gravite: 'moyen' as Probleme['gravite'], lot_corps_etat: '' })
  const [savingProbleme, setSavingProbleme] = useState(false)
  const [problemeTaggedUsers, setProblemeTaggedUsers] = useState<TaggedUser[]>([])
  const [problemeTagsMap, setProblemeTagsMap] = useState<Record<string, TaggedUser[]>>({})

  // Photo tags (optional)
  const [photoTaggedUsers, setPhotoTaggedUsers] = useState<TaggedUser[]>([])

  useEffect(() => {
    supabase.schema('app').from('visites_problemes')
      .select('*').eq('projet_id', projetId).order('created_at', { ascending: false })
      .then(({ data }) => { setProblemes((data ?? []) as Probleme[]); setProblemesLoading(false) })
  }, [projetId, supabase])

  async function handleAddProbleme() {
    if (!newProbleme.titre.trim() || !user) return
    setSavingProbleme(true)
    const { data } = await supabase.schema('app').from('visites_problemes')
      .insert({
        projet_id: projetId,
        co_id: user.id,
        titre: newProbleme.titre.trim(),
        description: newProbleme.description.trim(),
        gravite: newProbleme.gravite,
        lot_corps_etat: newProbleme.lot_corps_etat || null,
        statut: 'ouvert',
        photos: [],
      })
      .select().single()
    if (data) {
      setProblemes(prev => [data as Probleme, ...prev])
      // Send alertes to tagged users
      if (problemeTaggedUsers.length > 0) {
        const profNom = `${user.user_metadata?.prenom ?? ''} ${user.user_metadata?.nom ?? ''}`.trim() || 'CO'
        await supabase.schema('app').from('alertes').insert(
          problemeTaggedUsers.map(u => ({
            utilisateur_id: u.id,
            projet_id: projetId,
            type: 'probleme_chantier',
            titre: `Probleme signale -- ${newProbleme.titre.trim()}`,
            message: `${profNom} a signale un probleme (${newProbleme.gravite}) : ${newProbleme.titre.trim()}`,
            priorite: newProbleme.gravite === 'urgent' ? 'high' : 'normal',
            lue: false,
          }))
        )
        setProblemeTagsMap(prev => ({ ...prev, [(data as Probleme).id]: problemeTaggedUsers }))
      }
    }
    setNewProbleme({ titre: '', description: '', gravite: 'moyen', lot_corps_etat: '' })
    setProblemeTaggedUsers([])
    setShowNewProbleme(false)
    setSavingProbleme(false)
  }

  async function handleChangeStatutProbleme(id: string, statut: Probleme['statut']) {
    await supabase.schema('app').from('visites_problemes').update({ statut }).eq('id', id)
    setProblemes(prev => prev.map(p => p.id === id ? { ...p, statut } : p))
  }

  async function handleDeleteProbleme(id: string) {
    await supabase.schema('app').from('visites_problemes').delete().eq('id', id)
    setProblemes(prev => prev.filter(p => p.id !== id))
  }

  /* ══ RENDER ══ */

  const tabs = [
    { key: 'remarques' as const, label: 'Remarques', icon: MessageSquare, count: remarques.length },
    { key: 'photos' as const, label: 'Photos', icon: Camera, count: photos.length },
    { key: 'problemes' as const, label: 'Problemes', icon: AlertTriangle, count: problemes.filter(p => p.statut !== 'resolu').length },
  ]

  return (
    <div className="space-y-5">
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

      {/* ─── REMARQUES ─── */}
      {tab === 'remarques' && (
        <div className="space-y-3">
          {/* Input */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <textarea value={newRemarque} onChange={e => setNewRemarque(e.target.value)}
              placeholder="Ecrire une remarque..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none" />
            <div className="flex justify-end mt-2">
              <button onClick={handleAddRemarque} disabled={!newRemarque.trim() || savingRemarque}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors">
                {savingRemarque ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                Ajouter
              </button>
            </div>
          </div>

          {/* List */}
          {remarquesLoading ? (
            [1, 2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)
          ) : remarques.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
              <MessageSquare className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-xs text-gray-400">Aucune remarque pour l'instant</p>
            </div>
          ) : (
            remarques.map(r => (
              <div key={r.id} className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-3.5 flex items-start gap-3">
                <p className="text-sm text-gray-700 flex-1 whitespace-pre-wrap">{r.texte}</p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] text-gray-400">
                    {new Date(r.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                  </span>
                  <button onClick={() => handleDeleteRemarque(r.id)}
                    className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ─── PHOTOS ─── */}
      {tab === 'photos' && (
        <div className="space-y-3">
          {/* Upload */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
            <div className="flex gap-3">
              <select value={photoCategorie} onChange={e => setPhotoCategorie(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                {PHOTO_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <input type="text" value={photoLegende} onChange={e => setPhotoLegende(e.target.value)}
                placeholder="Legende (optionnel)"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <label className={cn(
              'flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition-colors',
              uploadingPhoto && 'opacity-50 pointer-events-none',
            )}>
              {uploadingPhoto ? (
                <><Loader2 className="w-4 h-4 animate-spin text-gray-400" /><span className="text-xs text-gray-500">Upload en cours...</span></>
              ) : (
                <><Camera className="w-4 h-4 text-gray-400" /><span className="text-xs text-gray-500">Prendre une photo ou choisir un fichier</span></>
              )}
              <input type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadPhoto(f); e.target.value = '' }} />
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Notifier (optionnel) :</span>
              <UserTagPicker
                selected={photoTaggedUsers}
                onChange={setPhotoTaggedUsers}
                excludeUserId={user?.id}
                compact
              />
            </div>
          </div>

          {/* Gallery by category */}
          {photosLoading ? (
            [1, 2].map(i => <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />)
          ) : photosByCategory.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
              <Camera className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-xs text-gray-400">Aucune photo pour l'instant</p>
            </div>
          ) : (
            photosByCategory.map(group => (
              <div key={group.categorie} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <button onClick={() => setExpandedCat(prev => {
                  const n = new Set(prev); if (n.has(group.categorie)) n.delete(group.categorie); else n.add(group.categorie); return n
                })}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors text-left">
                  <FolderOpen className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-900 flex-1">{group.categorie}</span>
                  <span className="text-[10px] text-gray-400">{group.photos.length} photo{group.photos.length > 1 ? 's' : ''}</span>
                  {expandedCat.has(group.categorie) ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {expandedCat.has(group.categorie) && (
                  <div className="border-t border-gray-100 p-3 grid grid-cols-3 gap-2">
                    {group.photos.map(photo => (
                      <div key={photo.id} className="relative group rounded-lg overflow-hidden bg-gray-100 aspect-square">
                        <img src={photo.url} alt={photo.legende || photo.categorie}
                          className="w-full h-full object-cover" />
                        {photo.legende && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1">
                            <p className="text-[10px] text-white truncate">{photo.legende}</p>
                          </div>
                        )}
                        <button onClick={() => handleDeletePhoto(photo)}
                          className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ─── PROBLEMES ─── */}
      {tab === 'problemes' && (
        <div className="space-y-3">
          {/* New probleme */}
          {showNewProbleme ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
              <p className="text-sm font-semibold text-gray-900">Signaler un probleme</p>
              <input type="text" value={newProbleme.titre}
                onChange={e => setNewProbleme(p => ({ ...p, titre: e.target.value }))}
                placeholder="Titre du probleme"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900" />
              <textarea value={newProbleme.description}
                onChange={e => setNewProbleme(p => ({ ...p, description: e.target.value }))}
                placeholder="Description detaillee..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Gravite</label>
                  <select value={newProbleme.gravite}
                    onChange={e => setNewProbleme(p => ({ ...p, gravite: e.target.value as Probleme['gravite'] }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                    <option value="faible">Faible</option>
                    <option value="moyen">Moyen</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Lot concerne</label>
                  <select value={newProbleme.lot_corps_etat}
                    onChange={e => setNewProbleme(p => ({ ...p, lot_corps_etat: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                    <option value="">Non specifie</option>
                    {PHOTO_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notifier</label>
                <UserTagPicker
                  selected={problemeTaggedUsers}
                  onChange={setProblemeTaggedUsers}
                  excludeUserId={user?.id}
                  placeholder="Taguer des personnes"
                />
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleAddProbleme} disabled={!newProbleme.titre.trim() || savingProbleme}
                  className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors">
                  {savingProbleme ? 'Enregistrement...' : 'Signaler'}
                </button>
                <button onClick={() => setShowNewProbleme(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowNewProbleme(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm font-medium text-red-700 hover:bg-red-100 transition-colors">
              <AlertTriangle className="w-4 h-4" />Signaler un probleme
            </button>
          )}

          {/* List */}
          {problemesLoading ? (
            [1, 2].map(i => <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />)
          ) : problemes.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
              <AlertTriangle className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-xs text-gray-400">Aucun probleme signale</p>
            </div>
          ) : (
            problemes.map(p => {
              const grav = GRAVITE_CONFIG[p.gravite]
              const stat = STATUT_PROBLEME[p.statut]
              return (
                <div key={p.id} className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-gray-900">{p.titre}</p>
                        <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded border', grav.color)}>{grav.label}</span>
                        {p.lot_corps_etat && <span className="text-[10px] text-gray-400">{p.lot_corps_etat}</span>}
                      </div>
                      {p.description && <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>}
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] text-gray-400">
                          {new Date(p.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        {(problemeTagsMap[p.id] ?? []).map(u => (
                          <span key={u.id} className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                            {u.prenom} {u.nom}
                          </span>
                        ))}
                        <UserTagPicker
                          selected={problemeTagsMap[p.id] ?? []}
                          onChange={users => {
                            setProblemeTagsMap(prev => ({ ...prev, [p.id]: users }))
                            // Send alerte for newly added users
                            const prevIds = new Set((problemeTagsMap[p.id] ?? []).map(u => u.id))
                            const newUsers = users.filter(u => !prevIds.has(u.id))
                            for (const u of newUsers) {
                              supabase.schema('app').from('alertes').insert({
                                utilisateur_id: u.id, projet_id: projetId, type: 'probleme_chantier',
                                titre: `Probleme signale -- ${p.titre}`, message: p.description || p.titre,
                                priorite: p.gravite === 'urgent' ? 'high' : 'normal', lue: false,
                              })
                            }
                          }}
                          excludeUserId={user?.id}
                          compact
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <select value={p.statut} onChange={e => handleChangeStatutProbleme(p.id, e.target.value as Probleme['statut'])}
                        className={cn('px-2 py-1 rounded text-[10px] font-medium border-0 focus:outline-none cursor-pointer', stat.color)}>
                        <option value="ouvert">Ouvert</option>
                        <option value="en_cours">En cours</option>
                        <option value="resolu">Resolu</option>
                      </select>
                      <button onClick={() => handleDeleteProbleme(p.id)}
                        className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
