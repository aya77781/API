'use client'

import { createClient } from '@/lib/supabase/client'

const BUCKET = 'projets'

export function useSTUpload(userId: string | null) {
  const supabase = createClient()

  async function uploadFile(file: File, path: string): Promise<string | null> {
    const { data, error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true })
    if (error) { console.error('Upload error:', error); return null }
    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(data.path)
    return publicUrl
  }

  async function uploadPieceAdmin(
    file: File,
    type: string,
    projetId: string,
    lotId: string,
    dateExpiration?: string
  ) {
    if (!userId) return { error: 'Non connecté' }
    const ext = file.name.split('.').pop()
    const path = `${projetId}/st/${userId}/admin/${type}_${Date.now()}.${ext}`
    const url = await uploadFile(file, path)
    if (!url) return { error: 'Erreur upload' }

    // Check existing
    const { data: existing } = await supabase.schema('app').from('st_documents')
      .select('id, version').eq('lot_id', lotId).eq('st_id', userId).eq('type', type)
      .order('version', { ascending: false }).limit(1).single()

    const newVersion = (existing?.version ?? 0) + 1

    const { error } = await supabase.schema('app').from('st_documents').insert({
      projet_id: projetId, lot_id: lotId, st_id: userId,
      type, nom_fichier: file.name, url,
      date_expiration: dateExpiration ?? null,
      version: newVersion, statut: 'en_attente',
    })
    return { error: error?.message ?? null, url }
  }

  async function uploadDevis(file: File, projetId: string, lotId: string) {
    if (!userId) return { error: 'Non connecté' }
    const ext = file.name.split('.').pop()
    const path = `${projetId}/st/${userId}/devis/devis_v${Date.now()}.${ext}`
    const url = await uploadFile(file, path)
    if (!url) return { error: 'Erreur upload' }

    const { data: existing } = await supabase.schema('app').from('st_documents')
      .select('id, version').eq('lot_id', lotId).eq('st_id', userId).eq('type', 'devis')
      .order('version', { ascending: false }).limit(1).single()

    const newVersion = (existing?.version ?? 0) + 1

    const { error } = await supabase.schema('app').from('st_documents').insert({
      projet_id: projetId, lot_id: lotId, st_id: userId,
      type: 'devis', nom_fichier: file.name, url,
      version: newVersion, statut: 'en_attente',
    })

    // Notify via alerte
    if (!error) {
      await supabase.schema('app').from('st_alertes').insert({
        st_id: userId, projet_id: projetId,
        type: 'autre', message: `Devis v${newVersion} déposé — en analyse par l'économiste`, lu: false,
      })
    }

    return { error: error?.message ?? null, url, version: newVersion }
  }

  async function uploadPhotoReserve(file: File, reserveId: string, projetId: string, lotId: string, commentaire?: string) {
    if (!userId) return { error: 'Non connecté' }
    const ext = file.name.split('.').pop()
    const path = `${projetId}/st/${userId}/reserves/${reserveId}_${Date.now()}.${ext}`
    const url = await uploadFile(file, path)
    if (!url) return { error: 'Erreur upload' }

    // Update reserve with photo
    const { error: reserveError } = await supabase.schema('app').from('reserves')
      .update({ photo_levee_url: url, statut: 'en_cours', remarque: commentaire ?? null })
      .eq('id', reserveId)

    // Track in st_documents
    await supabase.schema('app').from('st_documents').insert({
      projet_id: projetId, lot_id: lotId, st_id: userId,
      type: 'photo_reserve', nom_fichier: file.name, url, statut: 'en_attente',
    })

    return { error: reserveError?.message ?? null, url }
  }

  function getSignedUrl(path: string) {
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  }

  return { uploadPieceAdmin, uploadDevis, uploadPhotoReserve, getSignedUrl }
}
