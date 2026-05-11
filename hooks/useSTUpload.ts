'use client'

import { createClient } from '@/lib/supabase/client'

const BUCKET = 'projets'

export function useSTUpload(userId: string | null) {
  const supabase = createClient()

  /** Resoud at_sous_traitants.id pour ce user et ce projet (via dce_acces_st) */
  async function resolveAtStId(projetId: string): Promise<string | null> {
    if (!userId) return null
    const { data: acces } = await supabase
      .from('dce_acces_st' as never)
      .select('id')
      .eq('user_id', userId)
      .eq('projet_id', projetId)
    const accesIds = ((acces ?? []) as Array<{ id: string }>).map((a) => a.id)
    if (accesIds.length === 0) return null
    const { data: stRow } = await supabase
      .schema('app').from('at_sous_traitants')
      .select('id')
      .in('dce_acces_id', accesIds)
      .maybeSingle()
    return ((stRow as { id: string } | null)?.id) ?? null
  }

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
    dateExpiration?: string,
  ) {
    if (!userId) return { error: 'Non connecté' }
    const atStId = await resolveAtStId(projetId)
    if (!atStId) return { error: 'Sous-traitant non trouvé pour ce projet' }

    const ext  = file.name.split('.').pop()
    const path = `${projetId}/st/${userId}/admin/${type}_${Date.now()}.${ext}`
    const url  = await uploadFile(file, path)
    if (!url) return { error: 'Erreur upload' }

    /* Versioning : derniere version existante + 1 */
    const { data: existing } = await supabase
      .schema('app').from('documents_st')
      .select('id, version')
      .eq('st_id', atStId)
      .eq('type_document', type)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()
    const newVersion = (((existing as { version: number | null } | null)?.version) ?? 0) + 1

    const { error } = await supabase.schema('app').from('documents_st').insert({
      st_id:         atStId,
      projet_id:     projetId,
      lot_id:        lotId,
      type_document: type,
      nom_fichier:   file.name,
      fichier_url:   url,
      date_validite: dateExpiration ?? null,
      date_depot:    new Date().toISOString(),
      version:       newVersion,
      statut:        'en_attente',
    } as never)
    return { error: error?.message ?? null, url }
  }

  async function uploadDevis(file: File, projetId: string, lotId: string) {
    if (!userId) return { error: 'Non connecté' }
    const atStId = await resolveAtStId(projetId)
    if (!atStId) return { error: 'Sous-traitant non trouvé pour ce projet' }

    const ext  = file.name.split('.').pop()
    const path = `${projetId}/st/${userId}/devis/devis_v${Date.now()}.${ext}`
    const url  = await uploadFile(file, path)
    if (!url) return { error: 'Erreur upload' }

    const { data: existing } = await supabase
      .schema('app').from('documents_st')
      .select('id, version')
      .eq('st_id', atStId)
      .eq('type_document', 'devis')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()
    const newVersion = (((existing as { version: number | null } | null)?.version) ?? 0) + 1

    const { error } = await supabase.schema('app').from('documents_st').insert({
      st_id:         atStId,
      projet_id:     projetId,
      lot_id:        lotId,
      type_document: 'devis',
      nom_fichier:   file.name,
      fichier_url:   url,
      date_depot:    new Date().toISOString(),
      version:       newVersion,
      statut:        'en_attente',
    } as never)

    /* Notification a l'economiste — table reelle = app.alertes */
    if (!error) {
      await supabase.schema('app').from('alertes').insert({
        utilisateur_id: userId,
        projet_id:      projetId,
        type:           'autre',
        titre:          'Devis depose',
        message:        `Devis v${newVersion} depose — en analyse par l'economiste`,
        priorite:       'normal',
        lue:            false,
      } as never)
    }

    return { error: error?.message ?? null, url, version: newVersion }
  }

  async function uploadPhotoReserve(
    file: File,
    reserveId: string,
    projetId: string,
    lotId: string,
    commentaire?: string,
  ) {
    if (!userId) return { error: 'Non connecté' }
    const atStId = await resolveAtStId(projetId)

    const ext  = file.name.split('.').pop()
    const path = `${projetId}/st/${userId}/reserves/${reserveId}_${Date.now()}.${ext}`
    const url  = await uploadFile(file, path)
    if (!url) return { error: 'Erreur upload' }

    /* Met a jour la reserve avec la photo de levee + commentaire */
    const { error: reserveError } = await supabase
      .schema('app').from('reserves')
      .update({ photo_levee_url: url, statut: 'en_cours', remarque: commentaire ?? null } as never)
      .eq('id', reserveId)

    /* Track dans documents_st pour conserver une trace versionnee */
    if (atStId) {
      await supabase.schema('app').from('documents_st').insert({
        st_id:         atStId,
        projet_id:     projetId,
        lot_id:        lotId,
        type_document: 'photo_reserve',
        nom_fichier:   file.name,
        fichier_url:   url,
        date_depot:    new Date().toISOString(),
        statut:        'en_attente',
      } as never)
    }

    /* Notifie le CO du projet (responsable) qu'une levee est en attente de validation */
    const { data: projet } = await supabase
      .schema('app').from('projets')
      .select('co_id')
      .eq('id', projetId)
      .maybeSingle()
    const recipientId = ((projet as { co_id: string | null } | null)?.co_id) ?? null
    if (recipientId) {
      await supabase.schema('app').from('alertes').insert({
        utilisateur_id: recipientId,
        projet_id:      projetId,
        type:           'reserve_levee_proposee',
        titre:          'Levée de réserve à valider',
        message:        commentaire?.trim()
                          ? `Le ST a déposé une photo de levée. Remarque : ${commentaire.trim()}`
                          : 'Le ST a déposé une photo de levée. À valider depuis l\'onglet Réception.',
        priorite:       'normal',
        lue:            false,
      } as never)
    }

    return { error: reserveError?.message ?? null, url }
  }

  function getSignedUrl(path: string) {
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  }

  return { uploadPieceAdmin, uploadDevis, uploadPhotoReserve, getSignedUrl }
}
