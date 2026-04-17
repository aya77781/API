'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'
import {
  Search, X, Upload, Trash2, FileText, Download, Eye,
  FolderOpen, Plus, Library, Building2, Calendar,
} from 'lucide-react'
import { useUser } from '@/hooks/useUser'

// ── Types ────────────────────────────────────────────────────────────────────

type Doc = {
  id: string
  pole: string
  titre: string
  description: string | null
  projet_reference: string | null
  fichier_path: string
  fichier_nom: string
  fichier_taille: number
  uploaded_by: string | null
  created_at: string
}

// ── Poles ────────────────────────────────────────────────────────────────────

const POLES = [
  { value: 'co',            label: 'Conduite de travaux' },
  { value: 'at',            label: 'Assistant de travaux' },
  { value: 'economiste',    label: 'Economiste' },
  { value: 'dessin',        label: 'Dessin / BIM' },
  { value: 'commercial',    label: 'Commercial' },
  { value: 'comptabilite',  label: 'Comptabilite' },
  { value: 'rh',            label: 'Ressources humaines' },
  { value: 'direction',     label: 'Direction / Gerance' },
]

const POLE_LABEL: Record<string, string> = Object.fromEntries(POLES.map(p => [p.value, p.label]))

const POLE_COLOR: Record<string, string> = {
  co:           'bg-blue-100 text-blue-700',
  at:           'bg-sky-100 text-sky-700',
  economiste:   'bg-amber-100 text-amber-700',
  dessin:       'bg-purple-100 text-purple-700',
  commercial:   'bg-green-100 text-green-700',
  comptabilite: 'bg-orange-100 text-orange-700',
  rh:           'bg-pink-100 text-pink-700',
  direction:    'bg-gray-200 text-gray-700',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminBibliothequePage() {
  const supabase = useMemo(() => createClient(), [])
  const { user } = useUser()
  const fileRef = useRef<HTMLInputElement>(null)

  const [docs, setDocs]             = useState<Doc[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [selPole, setSelPole]       = useState<string | null>(null)
  const [uploading, setUploading]   = useState(false)

  // Modal ajout
  const [showAdd, setShowAdd]         = useState(false)
  const [addPole, setAddPole]         = useState('')
  const [addTitre, setAddTitre]       = useState('')
  const [addDesc, setAddDesc]         = useState('')
  const [addProjet, setAddProjet]     = useState('')
  const [addFiles, setAddFiles]       = useState<File[]>([])

  // ── Fetch ──
  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase.schema('app').from('biblio_pole_docs')
        .select('*')
        .order('created_at', { ascending: false })
      setDocs((data ?? []) as Doc[])
      setLoading(false)
    }
    load()
  }, [supabase])

  // ── Upload ──
  async function handleUpload() {
    if (!addPole || !addTitre || addFiles.length === 0 || !user) return
    setUploading(true)

    try {
      for (const file of addFiles) {
        const ts = Date.now()
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const storagePath = `bibliotheque/${addPole}/${ts}_${safeName}`

        const { error: upErr } = await supabase.storage
          .from('projets')
          .upload(storagePath, file, { upsert: false })

        if (upErr) { console.error(upErr); continue }

        const { data: inserted } = await supabase.schema('app').from('biblio_pole_docs')
          .insert({
            pole: addPole,
            titre: addTitre,
            description: addDesc || null,
            projet_reference: addProjet || null,
            fichier_path: storagePath,
            fichier_nom: file.name,
            fichier_taille: file.size,
            uploaded_by: user.id,
          })
          .select()
          .single()

        if (inserted) setDocs(prev => [inserted as Doc, ...prev])
      }

      // Reset
      setShowAdd(false)
      setAddPole('')
      setAddTitre('')
      setAddDesc('')
      setAddProjet('')
      setAddFiles([])
    } finally {
      setUploading(false)
    }
  }

  // ── Delete ──
  async function handleDelete(doc: Doc) {
    await supabase.storage.from('projets').remove([doc.fichier_path])
    await supabase.schema('app').from('biblio_pole_docs').delete().eq('id', doc.id)
    setDocs(prev => prev.filter(d => d.id !== doc.id))
  }

  // ── Download ──
  async function handleDownload(doc: Doc) {
    const { data } = await supabase.storage.from('projets').createSignedUrl(doc.fichier_path, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  // ── Filtrage ──
  const filtered = useMemo(() => {
    return docs.filter(d => {
      if (selPole && d.pole !== selPole) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        return d.titre.toLowerCase().includes(q) ||
          d.fichier_nom.toLowerCase().includes(q) ||
          d.description?.toLowerCase().includes(q) ||
          d.projet_reference?.toLowerCase().includes(q)
      }
      return true
    })
  }, [docs, selPole, search])

  // Stats par pole
  const countByPole = useMemo(() => {
    const map: Record<string, number> = {}
    docs.forEach(d => { map[d.pole] = (map[d.pole] || 0) + 1 })
    return map
  }, [docs])

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar title="Bibliotheque" subtitle="Documents d'inspiration par pole — bases sur des projets anciens" />

      {/* Stats */}
      <div className="mx-6 mt-4 grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">Total documents</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{docs.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">Poles couverts</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{Object.keys(countByPole).length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">Taille totale</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatSize(docs.reduce((a, d) => a + d.fichier_taille, 0))}</p>
        </div>
      </div>

      <div className="px-6 pt-4 pb-8 flex gap-4">
        {/* ── Panel gauche : poles ── */}
        <div className="w-64 flex-shrink-0 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-gray-700">Poles</h3>
            <button
              onClick={() => { setShowAdd(true); setAddPole(selPole ?? '') }}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Ajouter
            </button>
          </div>

          {/* Bouton "Tous" */}
          <button
            onClick={() => setSelPole(null)}
            className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
              !selPole
                ? 'border-gray-900 bg-gray-50 shadow-sm'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Library className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-900">Tous les poles</span>
              </div>
              <span className="text-xs text-gray-400">{docs.length}</span>
            </div>
          </button>

          {POLES.map(pole => (
            <button
              key={pole.value}
              onClick={() => setSelPole(pole.value)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                selPole === pole.value
                  ? 'border-gray-900 bg-gray-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">{pole.label}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${POLE_COLOR[pole.value] ?? 'bg-gray-100 text-gray-500'}`}>
                  {countByPole[pole.value] ?? 0}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* ── Panel droit : documents ── */}
        <div className="flex-1 space-y-4">
          {/* Barre recherche + bouton ajouter */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher un document, projet..."
                  className="w-full pl-10 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 placeholder-gray-300"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                onClick={() => { setShowAdd(true); setAddPole(selPole ?? '') }}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Deposer un document
              </button>
            </div>
          </div>

          {/* Liste documents */}
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-12">Chargement...</p>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl h-64 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">Aucun document</p>
                <p className="text-xs mt-1">
                  {selPole ? `Pas encore de document pour le pole ${POLE_LABEL[selPole] ?? selPole}` : 'Deposez votre premier document'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(doc => (
                <div key={doc.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">{doc.titre}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${POLE_COLOR[doc.pole] ?? 'bg-gray-100 text-gray-500'}`}>
                          {POLE_LABEL[doc.pole] ?? doc.pole}
                        </span>
                      </div>
                      {doc.description && (
                        <p className="text-xs text-gray-500 mt-1">{doc.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        <span className="truncate max-w-[200px]">{doc.fichier_nom}</span>
                        <span>{formatSize(doc.fichier_taille)}</span>
                        {doc.projet_reference && (
                          <span className="inline-flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {doc.projet_reference}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(doc.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleDownload(doc)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Voir
                      </button>
                      <button
                        onClick={() => handleDelete(doc)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Modal ajout ── */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Deposer un document</h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Pole */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Pole *</label>
                <select
                  value={addPole}
                  onChange={e => setAddPole(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="">Choisir un pole...</option>
                  {POLES.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              {/* Titre */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Titre du document *</label>
                <input
                  type="text"
                  value={addTitre}
                  onChange={e => setAddTitre(e.target.value)}
                  placeholder="Ex: CCTP type villa R+1"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900 placeholder-gray-300"
                />
              </div>

              {/* Projet de reference */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Projet de reference</label>
                <input
                  type="text"
                  value={addProjet}
                  onChange={e => setAddProjet(e.target.value)}
                  placeholder="Ex: Villa Dupont 2024"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900 placeholder-gray-300"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={addDesc}
                  onChange={e => setAddDesc(e.target.value)}
                  rows={2}
                  placeholder="Contexte, utilite, remarques..."
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900 placeholder-gray-300 resize-none"
                />
              </div>

              {/* Fichiers */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Fichier(s) *</label>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  onChange={e => setAddFiles(Array.from(e.target.files ?? []))}
                  className="hidden"
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-6 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
                >
                  <Upload className="w-5 h-5" />
                  {addFiles.length > 0
                    ? `${addFiles.length} fichier${addFiles.length > 1 ? 's' : ''} selectionne${addFiles.length > 1 ? 's' : ''}`
                    : 'Cliquer pour choisir des fichiers'}
                </button>
                {addFiles.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {addFiles.map((f, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-1.5 bg-gray-50 rounded-lg text-xs text-gray-600">
                        <span className="truncate">{f.name}</span>
                        <span className="text-gray-400 ml-2 flex-shrink-0">{formatSize(f.size)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleUpload}
                disabled={!addPole || !addTitre || addFiles.length === 0 || uploading}
                className="px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {uploading ? 'Envoi en cours...' : 'Deposer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
