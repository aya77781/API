'use client'

import { createClient } from '@/lib/supabase/client'

/* ── Types ──────────────────────────────────────────────────── */

export interface DocumentGED {
  id: string
  projet_id: string
  lot_id: string | null
  nom_fichier: string
  type_doc: string
  categorie: string | null
  dossier_ged: string
  storage_path: string
  taille_octets: number | null
  uploaded_by: string | null
  role_source: string | null
  tags_utilisateurs: string[]
  tags_roles: string[]
  message_depot: string | null
  notif_envoyee: boolean
  onedrive_sync: boolean
  onedrive_path: string | null
  created_at: string
  uploadeur?: { prenom: string; nom: string; role: string } | null
  notifs?: { lu: boolean; destinataire_id: string }[]
  projet?: { id: string; nom: string } | null
}

export interface NotifDocumentRow {
  id: string
  document_id: string
  projet_id: string
  destinataire_id: string
  destinataire_role: string | null
  lu: boolean
  lu_le: string | null
  created_at: string
  document: DocumentGED | null
  projet: { id: string; nom: string } | null
}

export interface UploadDocumentPayload {
  file: File
  projetId: string
  lotId?: string
  typeDoc: string
  dossierGed: string
  tagsUtilisateurs: { id: string; role: string }[]
  messageDepot: string
  userId: string
  userPrenom: string
  userNom: string
  userRole: string
  nomProjet: string
}

/* ── Hook ───────────────────────────────────────────────────── */

export function useDocuments() {
  const supabase = createClient()

  /* ── Helpers ─── */

  function getPublicUrl(storagePath: string): string {
    const { data } = supabase.storage.from('projets').getPublicUrl(storagePath)
    return data.publicUrl
  }

  async function getSignedUrl(storagePath: string, expiresIn = 3600): Promise<string | null> {
    const { data, error } = await supabase.storage
      .from('projets')
      .createSignedUrl(storagePath, expiresIn)
    if (error) { console.error('getSignedUrl:', error.message); return null }
    return data.signedUrl
  }

  /* ── Upload ─── */

  async function uploadDocument(
    payload: UploadDocumentPayload,
    onProgress?: (pct: number) => void,
  ): Promise<{ error: string | null; documentId?: string }> {
    const {
      file, projetId, lotId, typeDoc, dossierGed,
      tagsUtilisateurs, messageDepot,
      userId, userPrenom, userNom, userRole, nomProjet,
    } = payload

    onProgress?.(10)

    // 1. Upload to Storage
    const ext = file.name.split('.').pop() ?? 'bin'
    const base = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_')
    const folder = projetId || 'general'
    const storagePath = `${folder}/${dossierGed}/${Date.now()}_${base}.${ext}`

    const { error: storageError } = await supabase.storage
      .from('projets')
      .upload(storagePath, file, { upsert: false })

    if (storageError) return { error: storageError.message }

    onProgress?.(60)

    // 2. INSERT documents
    const { data: doc, error: insertError } = await supabase
      .schema('app')
      .from('documents')
      .insert({
        projet_id: projetId || null,
        lot_id: lotId ?? null,
        nom_fichier: file.name,
        type_doc: typeDoc,
        dossier_ged: dossierGed,
        storage_path: storagePath,
        taille_octets: file.size,
        uploaded_by: userId,
        role_source: userRole,
        tags_utilisateurs: tagsUtilisateurs.map(u => u.id),
        tags_roles: [...new Set(tagsUtilisateurs.map(u => u.role))],
        message_depot: messageDepot || null,
        notif_envoyee: false,
        onedrive_sync: false,
      })
      .select('id')
      .single()

    if (insertError || !doc) return { error: insertError?.message ?? 'Erreur lors de l\'enregistrement' }

    onProgress?.(75)

    // 3. Notifications + alertes for each recipient
    if (tagsUtilisateurs.length > 0) {
      const expediteur = `${userPrenom} ${userNom}`

      const { error: notifError } = await supabase.schema('app').from('notifs_documents').insert(
        tagsUtilisateurs.map(u => ({
          document_id: doc.id,
          projet_id: projetId || null,
          destinataire_id: u.id,
          destinataire_role: u.role,
          lu: false,
        }))
      )
      if (notifError) console.error('notifs_documents insert error:', notifError)

      await supabase.schema('app').from('alertes').insert(
        tagsUtilisateurs.map(u => ({
          projet_id: projetId || null,
          utilisateur_id: u.id,
          type: 'document',
          titre: `${expediteur} vous a partagé un document`,
          message: [file.name, nomProjet, messageDepot || null]
            .filter(Boolean).join(' · '),
          priorite: 'normal',
          lue: false,
        }))
      )

      // 4. Mark notif_envoyee = true
      await supabase
        .schema('app')
        .from('documents')
        .update({ notif_envoyee: true })
        .eq('id', doc.id)
    }

    onProgress?.(100)
    return { error: null, documentId: doc.id }
  }

  /* ── Fetch projet ─── */

  async function fetchDocumentsProjet(projetId: string): Promise<DocumentGED[]> {
    const { data, error } = await supabase
      .schema('app')
      .from('documents')
      .select(`
        *,
        uploadeur:uploaded_by(prenom, nom, role),
        notifs:notifs_documents!document_id(lu, destinataire_id)
      `)
      .eq('projet_id', projetId)
      .order('created_at', { ascending: false })

    if (error) console.error('fetchDocumentsProjet:', error.message)
    return (data ?? []) as DocumentGED[]
  }

  /* ── Fetch received (notifications) ─── */

  async function fetchDocumentsRecus(userId: string): Promise<NotifDocumentRow[]> {
    const { data, error } = await supabase
      .schema('app')
      .from('notifs_documents')
      .select(`
        *,
        document:documents(
          id, nom_fichier, type_doc, dossier_ged, storage_path,
          taille_octets, message_depot, uploaded_by, created_at,
          uploadeur:utilisateurs!uploaded_by(prenom, nom, role)
        ),
        projet:projets(id, nom)
      `)
      .eq('destinataire_id', userId)
      .order('lu', { ascending: true })
      .order('created_at', { ascending: false })

    if (error) console.error('fetchDocumentsRecus:', error.message)
    return (data ?? []) as NotifDocumentRow[]
  }

  /* ── Fetch deposited ─── */

  async function fetchDocumentsDeposes(userId: string): Promise<DocumentGED[]> {
    const { data, error } = await supabase
      .schema('app')
      .from('documents')
      .select(`
        *,
        projet:projets(id, nom)
      `)
      .eq('uploaded_by', userId)
      .order('created_at', { ascending: false })

    if (error) console.error('fetchDocumentsDeposes:', error.message)
    return (data ?? []) as DocumentGED[]
  }

  /* ── Mark lu ─── */

  async function markLu(notifDocumentId: string): Promise<void> {
    await supabase
      .schema('app')
      .from('notifs_documents')
      .update({ lu: true, lu_le: new Date().toISOString() })
      .eq('id', notifDocumentId)
  }

  async function markAllLu(userId: string): Promise<void> {
    await supabase
      .schema('app')
      .from('notifs_documents')
      .update({ lu: true, lu_le: new Date().toISOString() })
      .eq('destinataire_id', userId)
      .eq('lu', false)
  }

  async function markDocumentLu(documentId: string, userId: string): Promise<void> {
    await supabase
      .schema('app')
      .from('notifs_documents')
      .update({ lu: true, lu_le: new Date().toISOString() })
      .eq('document_id', documentId)
      .eq('destinataire_id', userId)
  }

  /* ── Count non lus ─── */

  async function fetchCountNonLus(userId: string): Promise<number> {
    const { count } = await supabase
      .schema('app')
      .from('notifs_documents')
      .select('id', { count: 'exact', head: true })
      .eq('destinataire_id', userId)
      .eq('lu', false)
    return count ?? 0
  }

  return {
    getPublicUrl,
    getSignedUrl,
    uploadDocument,
    fetchDocumentsProjet,
    fetchDocumentsRecus,
    fetchDocumentsDeposes,
    markLu,
    markAllLu,
    markDocumentLu,
    fetchCountNonLus,
  }
}
