'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Camera, Upload, X, Loader2, Heart } from 'lucide-react'

const BUCKET = 'documents-anonymes'

/**
 * Convertit une image en niveaux de gris cote client.
 * L'original en couleur ne quitte jamais le navigateur — anonymat preserve.
 */
async function convertToGrayscale(file: File): Promise<Blob> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = reject
    i.src = dataUrl
  })

  // Limite la taille pour eviter les fichiers enormes
  const MAX = 2400
  let { width, height } = img
  if (width > MAX || height > MAX) {
    const ratio = Math.min(MAX / width, MAX / height)
    width = Math.round(width * ratio)
    height = Math.round(height * ratio)
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas non disponible')

  ctx.drawImage(img, 0, 0, width, height)

  // Conversion en niveaux de gris (luminance perceptuelle)
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
    data[i] = gray
    data[i + 1] = gray
    data[i + 2] = gray
  }
  ctx.putImageData(imageData, 0, 0)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('Conversion echouee')),
      'image/jpeg',
      0.88,
    )
  })
}

export function AnonymousDocUpload() {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [open, setOpen]             = useState(false)
  const [file, setFile]             = useState<File | null>(null)
  const [preview, setPreview]       = useState<string | null>(null)
  const [message, setMessage]       = useState('')
  const [uploading, setUploading]   = useState(false)
  const [done, setDone]             = useState(false)
  const [error, setError]           = useState<string | null>(null)

  // Genere un apercu en N&B des qu'un fichier est selectionne
  useEffect(() => {
    let url: string | null = null
    let cancelled = false
    if (file) {
      convertToGrayscale(file)
        .then(blob => {
          if (cancelled) return
          url = URL.createObjectURL(blob)
          setPreview(url)
        })
        .catch(() => { if (!cancelled) setPreview(null) })
    } else {
      setPreview(null)
    }
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [file])

  function reset() {
    setFile(null)
    setPreview(null)
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) { setFile(null); return }
    if (!f.type.startsWith('image/')) {
      setError('Seules les photos sont acceptees (JPG, PNG, WebP).')
      setFile(null)
      return
    }
    setError(null)
    setFile(f)
  }

  async function handleSubmit() {
    if (!file) { setError('Veuillez selectionner une photo'); return }
    setUploading(true)
    setError(null)
    try {
      const grayscaleBlob = await convertToGrayscale(file)
      const randomId = crypto.randomUUID()
      const path = `${randomId}_${Date.now()}.jpg`

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, grayscaleBlob, { upsert: false, contentType: 'image/jpeg' })
      if (upErr) throw upErr

      const { error: dbErr } = await supabase
        .schema('app')
        .from('documents_anonymes' as never)
        .insert({
          nom_fichier:   `photo_enfance_${Date.now()}.jpg`,
          fichier_url:   path,
          storage_path:  path,
          taille_octets: grayscaleBlob.size,
          mime_type:     'image/jpeg',
          categorie:     'photo_enfance',
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
            <Camera className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
              Devine qui c'est <Heart className="w-3.5 h-3.5 text-purple-500" />
            </h3>
            <p className="text-xs text-gray-600 mt-1">
              Partagez une photo de votre enfance avec le CHO. La photo sera automatiquement
              convertie en noir et blanc et transmise de maniere totalement anonyme.
            </p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium flex-shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            Envoyer
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-purple-600" />
                <h2 className="text-base font-semibold text-gray-900">Photo d'enfance anonyme</h2>
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
                  <Heart className="w-7 h-7 text-green-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">Photo transmise au CHO</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Votre photo est arrivee en noir et blanc. Aucune information personnelle n'a ete enregistree.
                </p>
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
                  La conversion en noir et blanc se fait dans votre navigateur :
                  l'original en couleur n'est jamais envoye. Votre identite n'est jamais enregistree.
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Photo *</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    className="w-full text-xs text-gray-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                  />
                  <p className="mt-1.5 text-[11px] text-gray-400">JPG, PNG ou WebP. 20 Mo max.</p>
                </div>

                {preview && (
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-1.5">
                      Apercu (tel que le CHO la verra)
                    </p>
                    <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-900 flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={preview}
                        alt="Apercu noir et blanc"
                        className="max-h-72 w-auto"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Petit indice (facultatif)
                  </label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    rows={2}
                    placeholder="Ex: 5 ans, plage de Saint-Malo..."
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  />
                  <p className="mt-1 text-[11px] text-gray-400">
                    Attention : un indice trop precis peut trahir votre identite.
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
                      : <><Camera className="w-3.5 h-3.5" /> Envoyer en N&B</>}
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

