'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ShieldCheck, Upload, X, FileText, Loader2 } from 'lucide-react'

const BUCKET = 'documents-anonymes'

const CATEGORIES = [
  { value: 'signalement',  label: 'Signalement' },
  { value: 'suggestion',   label: 'Suggestion' },
  { value: 'reclamation',  label: 'Reclamation' },
  { value: 'temoignage',   label: 'Temoignage' },
  { value: 'autre',        label: 'Autre' },
]

export function AnonymousDocUpload() {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [open, setOpen]             = useState(false)
  const [file, setFile]             = useState<File | null>(null)
  const [categorie, setCategorie]   = useState('')
  const [message, setMessage]       = useState('')
  const [uploading, setUploading]   = useState(false)
  const [done, setDone]             = useState(false)
  const [error, setError]           = useState<string | null>(null)

  function reset() {
    setFile(null)
    setCategorie('')
    setMessage('')
    setUploading(false)
    setDone(false)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function close() {
    if (uploading) return
    setOpen(false)
    setTimeout(reset, 200)
  }

  async function handleSubmit() {
    if (!file) { setError('Veuillez selectionner un fichier'); return }
    setUploading(true)
    setError(null)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
      const randomId = crypto.randomUUID()
      const path = `${randomId}_${Date.now()}.${ext}`

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type })
      if (upErr) throw upErr

      const { error: dbErr } = await supabase
        .schema('app')
        .from('documents_anonymes' as never)
        .insert({
          nom_fichier:   file.name,
          fichier_url:   path,
          storage_path:  path,
          taille_octets: file.size,
          mime_type:     file.type || null,
          categorie:     categorie || null,
          message:       message.trim() || null,
        } as never)
      if (dbErr) throw dbErr

      setDone(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur lors du depot'
      setError(msg)
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900">Depot anonyme au CHO</h3>
            <p className="text-xs text-gray-600 mt-1">
              Deposez un document independant de tout projet, de maniere totalement anonyme.
              Seul le Chief Happiness Officer pourra le consulter, sans connaitre votre identite.
            </p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium flex-shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            Deposer
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-600" />
                <h2 className="text-base font-semibold text-gray-900">Depot anonyme</h2>
              </div>
              <button
                onClick={close}
                disabled={uploading}
                className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {done ? (
              <div className="p-8 text-center">
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                  <ShieldCheck className="w-7 h-7 text-green-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">Document transmis au CHO</h3>
                <p className="text-xs text-gray-500 mt-1">Aucune information personnelle n'a ete enregistree.</p>
                <button
                  onClick={close}
                  className="mt-5 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 font-medium"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs text-purple-900">
                  Aucun lien avec votre identite ne sera enregistre. Le CHO recevra uniquement le document, la categorie et le message.
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Categorie</label>
                  <select
                    value={categorie}
                    onChange={e => setCategorie(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                  >
                    <option value="">Non specifiee</option>
                    {CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Message (facultatif)
                  </label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    rows={3}
                    placeholder="Quelques mots de contexte..."
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Document *</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.txt"
                    onChange={e => setFile(e.target.files?.[0] ?? null)}
                    className="w-full text-xs text-gray-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                  />
                  {file && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                      <FileText className="w-3.5 h-3.5 text-gray-400" />
                      <span className="truncate">{file.name}</span>
                      <span className="text-gray-400 ml-auto flex-shrink-0">
                        {(file.size / 1024).toFixed(0)} Ko
                      </span>
                    </div>
                  )}
                  <p className="mt-1.5 text-[11px] text-gray-400">
                    PDF, image, Word, Excel ou texte. 20 Mo max.
                  </p>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
                    {error}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={close}
                    disabled={uploading}
                    className="px-3 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 font-medium disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!file || uploading}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Envoi...</>
                      : <><ShieldCheck className="w-3.5 h-3.5" /> Envoyer anonymement</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
