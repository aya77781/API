'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, X, Send, MessageSquare, FileText, Upload, Loader2,
  Calendar, Trash2, Download,
} from 'lucide-react'

type Projet = { id: string; nom: string; reference: string | null; statut: string }
type Utilisateur = { id: string; prenom: string; nom: string; role: string }

type CrImporte = {
  id: string
  projet_id: string
  co_id: string | null
  titre: string
  contenu: string | null
  fichier_url: string | null
  fichier_nom: string | null
  semaine_debut: string | null
  date_visite: string | null
  statut: string | null
  created_at: string
}

type CrCommentaire = {
  id: string
  cr_id: string
  auteur_id: string | null
  contenu: string
  created_at: string
}

// Lundi de la semaine d'une date (ISO) au format YYYY-MM-DD
function getWeekStart(d: Date): string {
  const date = new Date(d)
  const day = date.getDay() // 0=dim ... 6=sam
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date.toISOString().slice(0, 10)
}

function formatSemaine(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const fin = new Date(d); fin.setDate(d.getDate() + 6)
  const fmt = (x: Date) => x.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
  return `${fmt(d)} → ${fmt(fin)}`
}

function isoWeekNumber(d: Date): number {
  const target = new Date(d)
  target.setHours(0, 0, 0, 0)
  // ISO : jeudi de la semaine determine l'annee
  target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7))
  const firstThursday = new Date(target.getFullYear(), 0, 4)
  firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7))
  return 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000))
}

// Genere les 52 dernieres semaines (lundi) en ordre antichronologique
function genererSemaines(nb: number = 52): { iso: string; label: string }[] {
  const out: { iso: string; label: string }[] = []
  const lundi = new Date(getWeekStart(new Date()))
  for (let i = 0; i < nb; i++) {
    const d = new Date(lundi)
    d.setDate(lundi.getDate() - i * 7)
    const iso = d.toISOString().slice(0, 10)
    out.push({ iso, label: `S${isoWeekNumber(d)} — ${formatSemaine(iso)}` })
  }
  return out
}

export function CrImportesPanel({
  projets, users, profil, filterProjetId,
}: {
  projets: Projet[]
  users: Utilisateur[]
  profil: { id: string; role: string } | null
  filterProjetId: string
}) {
  const supabase = useMemo(() => createClient(), [])
  const isCO = profil?.role === 'co' || profil?.role === 'admin' || profil?.role === 'gerant'

  const [crs, setCrs]         = useState<CrImporte[]>([])
  const [loading, setLoading] = useState(true)
  const [filterSemaine, setFilterSemaine] = useState<string>('')

  const [selCr, setSelCr]               = useState<CrImporte | null>(null)
  const [comments, setComments]         = useState<CrCommentaire[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [newComment, setNewComment]     = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const [showImport, setShowImport] = useState(false)

  async function refresh() {
    setLoading(true)
    const { data } = await supabase.schema('app').from('cr_chantier')
      .select('id, projet_id, co_id, titre, contenu, fichier_url, fichier_nom, semaine_debut, date_visite, statut, created_at')
      .order('semaine_debut', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
    setCrs((data ?? []) as CrImporte[])
    setLoading(false)
  }
  useEffect(() => { refresh() }, [])

  async function fetchComments(crId: string) {
    setLoadingComments(true)
    const { data } = await supabase.schema('app').from('cr_chantier_commentaires')
      .select('*').eq('cr_id', crId).order('created_at', { ascending: true })
    setComments((data ?? []) as CrCommentaire[])
    setLoadingComments(false)
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  useEffect(() => {
    if (selCr) fetchComments(selCr.id)
    else setComments([])
    setNewComment('')
  }, [selCr?.id])

  async function envoyerComment() {
    if (!selCr || !newComment.trim() || !profil) return
    setSendingComment(true)
    await supabase.schema('app').from('cr_chantier_commentaires').insert([{
      cr_id: selCr.id,
      auteur_id: profil.id,
      contenu: newComment.trim(),
    }])
    setNewComment('')
    await fetchComments(selCr.id)
    setSendingComment(false)
  }

  async function supprimerCr() {
    if (!selCr) return
    if (!confirm('Supprimer ce CR et tous ses commentaires ?')) return
    await supabase.schema('app').from('cr_chantier').delete().eq('id', selCr.id)
    setSelCr(null)
    refresh()
  }

  function findUser(id: string | null) {
    if (!id) return null
    return users.find(u => u.id === id) ?? null
  }

  const filtered = useMemo(() => {
    return crs.filter(cr => {
      if (filterProjetId !== 'tous' && cr.projet_id !== filterProjetId) return false
      if (filterSemaine && cr.semaine_debut !== filterSemaine) return false
      return true
    })
  }, [crs, filterProjetId, filterSemaine])

  return (
    <>
      {/* Filtre semaine + bouton import */}
      <div className="mx-6 mt-3 bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3 flex-wrap">
        <label className="text-xs font-medium text-gray-600 inline-flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" /> Semaine :
        </label>
        <select value={filterSemaine} onChange={e => { setFilterSemaine(e.target.value); setSelCr(null) }}
          className="min-w-[260px] text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
          <option value="">Toutes les semaines</option>
          {genererSemaines(52).map(s => <option key={s.iso} value={s.iso}>{s.label}</option>)}
        </select>

        {isCO && (
          <button onClick={() => setShowImport(true)}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700">
            <Plus className="w-3.5 h-3.5" /> Importer un CR
          </button>
        )}
      </div>

      <div className="px-6 pt-4 pb-8 flex gap-4">
        {/* Liste CR */}
        <div className="w-96 flex-shrink-0 flex flex-col gap-2 max-h-[calc(100vh-340px)] overflow-y-auto">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-8">Chargement...</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <FileText className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Aucun CR importe</p>
              <p className="text-xs text-gray-400 mt-1">
                {isCO ? 'Clique sur « Importer un CR » pour en ajouter un.' : 'Le CO n\'a pas encore importe de CR.'}
              </p>
            </div>
          ) : (
            filtered.map(cr => {
              const projet = projets.find(p => p.id === cr.projet_id)
              const auteur = findUser(cr.co_id)
              const isSel = selCr?.id === cr.id
              return (
                <button key={cr.id} onClick={() => setSelCr(cr)}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    isSel ? 'border-gray-900 bg-white shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}>
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 inline-flex items-center gap-1 font-medium">
                      <Calendar className="w-3 h-3" /> {formatSemaine(cr.semaine_debut)}
                    </span>
                    {cr.fichier_url && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 inline-flex items-center gap-1">
                        <FileText className="w-3 h-3" /> Fichier
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-900 truncate">{cr.titre}</p>
                  {cr.contenu && <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{cr.contenu}</p>}
                  <div className="flex items-center justify-between gap-2 mt-1.5 text-xs">
                    <span className="text-gray-500 truncate">{projet?.nom ?? '—'}</span>
                    <span className="text-gray-400 flex-shrink-0">
                      {auteur ? `${auteur.prenom} ${auteur.nom}` : '—'}
                    </span>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Detail CR + thread commentaires */}
        <div className="flex-1 min-w-0">
          {selCr ? (
            <CrThread
              cr={selCr}
              projets={projets}
              users={users}
              comments={comments}
              loadingComments={loadingComments}
              newComment={newComment}
              setNewComment={setNewComment}
              sendingComment={sendingComment}
              onEnvoyer={envoyerComment}
              onSupprimer={isCO ? supprimerCr : undefined}
              endRef={endRef}
              meId={profil?.id ?? null}
              findUser={findUser}
            />
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 h-80 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Selectionne un CR</p>
                <p className="text-xs mt-1">pour voir le contenu et commenter</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showImport && profil && (
        <ImportCrModal
          projets={projets}
          meId={profil.id}
          defaultProjetId={filterProjetId !== 'tous' ? filterProjetId : ''}
          onClose={() => setShowImport(false)}
          onSaved={() => { setShowImport(false); refresh() }}
        />
      )}
    </>
  )
}

// ─── Thread CR ───────────────────────────────────────────────────────────────

function CrThread({
  cr, projets, users, comments, loadingComments, newComment, setNewComment,
  sendingComment, onEnvoyer, onSupprimer, endRef, meId, findUser,
}: {
  cr: CrImporte
  projets: Projet[]
  users: Utilisateur[]
  comments: CrCommentaire[]
  loadingComments: boolean
  newComment: string
  setNewComment: (v: string) => void
  sendingComment: boolean
  onEnvoyer: () => void
  onSupprimer?: () => void
  endRef: React.RefObject<HTMLDivElement>
  meId: string | null
  findUser: (id: string | null) => Utilisateur | null
}) {
  const projet = projets.find(p => p.id === cr.projet_id)
  const auteur = findUser(cr.co_id)

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col h-[calc(100vh-340px)]">
      {/* Header */}
      <div className="p-5 border-b border-gray-200">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 inline-flex items-center gap-1 font-medium">
              <Calendar className="w-3 h-3" /> {formatSemaine(cr.semaine_debut)}
            </span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {cr.fichier_url && (
              <a href={cr.fichier_url} target="_blank" rel="noopener noreferrer"
                className="px-2.5 py-1 text-xs border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 inline-flex items-center gap-1">
                <Download className="w-3 h-3" /> {cr.fichier_nom ?? 'Fichier'}
              </a>
            )}
            {onSupprimer && (
              <button onClick={onSupprimer}
                className="p-1 text-gray-400 hover:text-red-500" title="Supprimer">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <h2 className="text-lg font-semibold text-gray-900">{cr.titre}</h2>
        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1 flex-wrap">
          <span className="font-medium">{projet?.nom ?? '—'}</span>
          {projet?.reference && <span className="text-gray-400">({projet.reference})</span>}
          <span>·</span>
          <span>Importe par {auteur ? `${auteur.prenom} ${auteur.nom}` : '—'}</span>
          <span>·</span>
          <span>{new Date(cr.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
        </div>

        {cr.contenu && (
          <p className="text-sm text-gray-700 whitespace-pre-wrap mt-3">{cr.contenu}</p>
        )}
      </div>

      {/* Commentaires */}
      <div className="flex-1 overflow-y-auto bg-gray-50 border-t border-gray-200">
        <div className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur px-5 py-2.5 border-b border-gray-200 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-gray-500" />
          <p className="text-sm font-semibold text-gray-700">Commentaires & questions</p>
          <span className="text-[11px] font-medium text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded-full">
            {comments.length}
          </span>
        </div>
        <div className="p-5 space-y-4">
          {loadingComments ? (
            <p className="text-sm text-gray-400 text-center py-4">Chargement...</p>
          ) : comments.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-500 font-medium">Aucun commentaire</p>
              <p className="text-xs text-gray-400 mt-1">Sois le premier a commenter / poser une question.</p>
            </div>
          ) : (
            comments.map(c => {
              const u = findUser(c.auteur_id)
              const isMe = c.auteur_id === meId
              return (
                <div key={c.id} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    isMe ? 'bg-gray-900 text-white' : 'bg-violet-100 text-violet-700'
                  }`}>
                    {u ? `${u.prenom[0]}${u.nom[0]}`.toUpperCase() : '?'}
                  </div>
                  <div className={`max-w-[80%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                    <p className={`text-[11px] font-medium text-gray-600 mb-1 px-1 ${isMe ? 'text-right' : ''}`}>
                      {u ? `${u.prenom} ${u.nom}` : '—'}
                      <span className="text-gray-400 font-normal"> · {new Date(c.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </p>
                    <div className={`px-4 py-2.5 rounded-2xl shadow-sm ${
                      isMe ? 'bg-gray-900 text-white rounded-tr-sm' : 'bg-white border border-gray-200 rounded-tl-sm'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{c.contenu}</p>
                    </div>
                  </div>
                </div>
              )
            })
          )}
          <div ref={endRef} />
        </div>
      </div>

      {/* Saisie */}
      <div className="border-t border-gray-200 p-3 bg-white">
        <div className="flex gap-2">
          <textarea
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onEnvoyer() } }}
            placeholder="Ecrire un commentaire ou une question... (Cmd/Ctrl + Entree)"
            rows={2}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none placeholder-gray-300"
          />
          <button
            onClick={onEnvoyer}
            disabled={!newComment.trim() || sendingComment}
            className="px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40 self-end"
          >
            {sendingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modale import CR ────────────────────────────────────────────────────────

function ImportCrModal({
  projets, meId, defaultProjetId, onClose, onSaved,
}: {
  projets: Projet[]
  meId: string
  defaultProjetId: string
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [projetId, setProjetId]   = useState(defaultProjetId)
  const [semaine, setSemaine]     = useState<string>(getWeekStart(new Date()))
  const [titre, setTitre]         = useState('')
  const [contenu, setContenu]     = useState('')
  const [file, setFile]           = useState<File | null>(null)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)

  async function envoyer() {
    setError(null)
    if (!projetId) { setError('Choisir un projet'); return }
    if (!semaine)  { setError('Choisir une semaine'); return }
    if (!titre.trim()) { setError('Titre requis'); return }
    setSaving(true)
    try {
      let fichier_url: string | null = null
      let fichier_nom: string | null = null
      if (file) {
        const path = `cr-chantier/${projetId}/${Date.now()}_${file.name}`
        const { error: upErr } = await supabase.storage.from('projets').upload(path, file, { upsert: true })
        if (upErr) throw upErr
        const { data } = supabase.storage.from('projets').getPublicUrl(path)
        fichier_url = data.publicUrl
        fichier_nom = file.name
      }
      const { error: insErr } = await supabase.schema('app').from('cr_chantier').insert([{
        projet_id: projetId,
        co_id: meId,
        titre: titre.trim(),
        contenu: contenu.trim() || null,
        fichier_url,
        fichier_nom,
        semaine_debut: semaine,
        date_visite: semaine,
        statut: 'publie',
      }])
      if (insErr) throw insErr
      onSaved()
    } catch (e) {
      setError((e as Error).message)
    }
    setSaving(false)
  }

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 placeholder-gray-300'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h3 className="text-base font-semibold text-gray-900">Importer un compte-rendu hebdomadaire</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-3">
          {/* Projet */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Projet *</label>
            <select value={projetId} onChange={e => setProjetId(e.target.value)} className={`${inputCls} bg-white`}>
              <option value="">Choisir un projet...</option>
              {projets.map(p => <option key={p.id} value={p.id}>{p.nom}{p.reference ? ` (${p.reference})` : ''}</option>)}
            </select>
          </div>

          {/* Semaine (lundi) */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Semaine du *</label>
            <input type="date" value={semaine}
              onChange={e => setSemaine(e.target.value ? getWeekStart(new Date(e.target.value)) : '')}
              className={inputCls} />
            <p className="text-[11px] text-gray-400 mt-1">La date est ramenee au lundi de la semaine.</p>
          </div>

          {/* Titre */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Titre *</label>
            <input value={titre} onChange={e => setTitre(e.target.value)}
              placeholder="Ex: CR de chantier S20 — Villa Prado" className={inputCls} />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Synthese / description</label>
            <textarea rows={4} value={contenu} onChange={e => setContenu(e.target.value)}
              placeholder="Resume des points cles, decisions, sujets a discuter..." className={`${inputCls} resize-none`} />
          </div>

          {/* Fichier */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Fichier du CR (PDF / Word)</label>
            <label className="flex items-center justify-center gap-2 w-full border border-dashed border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-500 hover:border-gray-400 hover:bg-gray-50 cursor-pointer">
              <Upload className="w-4 h-4" /> {file ? file.name : 'Choisir un fichier'}
              <input type="file" className="hidden"
                accept=".pdf,.doc,.docx,.odt,.txt"
                onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </label>
            {file && (
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded px-2 py-1">
                <FileText className="w-3 h-3" /> {file.name}
                <span className="text-gray-400">({(file.size / 1024).toFixed(0)} Ko)</span>
                <button onClick={() => setFile(null)} className="ml-auto text-gray-400 hover:text-red-500"><X className="w-3 h-3" /></button>
              </div>
            )}
          </div>

          {error && <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
        </div>

        <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
          <button onClick={envoyer} disabled={saving || !titre.trim() || !projetId || !semaine}
            className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Importer
          </button>
        </div>
      </div>
    </div>
  )
}
