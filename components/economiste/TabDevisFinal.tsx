'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  FileCheck, Send, Check, X, Ban, UserCheck, AlertTriangle, FileSignature,
  PenLine, Download, Upload, Plus,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { generateDevisSTPdf, type DevisLigne as PdfLigne } from '@/lib/pdf/devisST'
import { cn } from '@/lib/utils'
import { Abbr } from '@/components/shared/Abbr'

/* ─── Types ────────────────────────────────────────────────────────────── */

type DevisStatut = 'brouillon' | 'envoye' | 'signe' | 'refuse' | 'annule'

type LigneSnapshot = {
  designation: string
  quantite: number
  unite: string
  prix_unitaire: number
  total_ht: number
}

type Devis = {
  id: string
  projet_id: string
  lot_id: string
  acces_st_id: string
  st_nom: string
  st_societe: string | null
  st_email: string | null
  montant_ht: number
  tva_pct: number
  montant_ttc: number | null
  lignes: LigneSnapshot[] | null
  signataire_ids: string[]
  observateur_ids: string[]
  statut: DevisStatut
  envoye_le: string | null
  signe_le: string | null
  numero: string | null
  notes: string | null
  signature_api_url: string | null
  signature_st_url: string | null
  signe_le_st: string | null
  document_signature_id: string | null
  created_at: string
}

type LotInfo = { id: string; nom: string; ordre: number }

type Employe = {
  id: string
  nom: string
  prenom: string
  poste: string
  email: string
}

/* ─── Constantes UI ────────────────────────────────────────────────────── */

const STATUT_STYLE: Record<DevisStatut, { label: string; bg: string; color: string; extra?: string }> = {
  brouillon: { label: 'Brouillon',  bg: '#F1EFE8', color: '#5F5E5A' },
  envoye:    { label: 'Envoyé',     bg: '#E6F1FB', color: '#185FA5' },
  signe:     { label: 'Signé',      bg: '#EAF3DE', color: '#3B6D11' },
  refuse:    { label: 'Refusé',     bg: '#FCEBEB', color: '#A32D2D' },
  annule:    { label: 'Annulé',     bg: '#F1EFE8', color: '#888780', extra: 'line-through' },
}

const TVA_CHOICES = [0, 5.5, 10, 20]

/* ─── Helpers ──────────────────────────────────────────────────────────── */

function fmtEur(n: number | null | undefined, suffix: 'HT' | 'TTC' | '' = ''): string {
  const val = Number(n ?? 0)
  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val)
  return `${formatted} €${suffix ? ' ' + suffix : ''}`
}

function computeTtc(ht: number, tva: number): number {
  return Math.round(ht * (1 + tva / 100) * 100) / 100
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/* ─── Composant principal ──────────────────────────────────────────────── */

export default function TabDevisFinal({
  projetId,
  projetNom,
}: {
  projetId: string
  projetNom: string
}) {
  const supabase = useMemo(() => createClient(), [])
  const [lots, setLots] = useState<LotInfo[]>([])
  const [devisList, setDevisList] = useState<Devis[]>([])
  const [employes, setEmployes] = useState<Employe[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLotId, setSelectedLotId] = useState<string>('')
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)
  const [confirmAnnulId, setConfirmAnnulId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [lotsRes, devisRes, empRes] = await Promise.all([
      supabase.from('lots').select('id, nom, ordre').eq('projet_id', projetId).order('ordre', { ascending: true }),
      supabase.from('devis').select('*').eq('projet_id', projetId).order('created_at', { ascending: false }),
      supabase.from('employes').select('id, nom, prenom, poste, email').eq('actif', true).order('nom'),
    ])
    const lotsArr = (lotsRes.data ?? []) as LotInfo[]
    setLots(lotsArr)
    setSelectedLotId((prev) => prev || lotsArr[0]?.id || '')
    setDevisList((devisRes.data ?? []) as Devis[])
    setEmployes((empRes.data ?? []) as Employe[])
    setLoading(false)
  }, [projetId, supabase])

  useEffect(() => { refresh() }, [refresh])

  /* ── Mutations ───────────────────────────────── */

  async function updateDevis(devisId: string, patch: Partial<Devis>) {
    const { error } = await supabase
      .from('devis')
      .update({ ...patch, updated_at: new Date().toISOString() } as never)
      .eq('id', devisId)
    if (error) {
      setToast({ kind: 'err', msg: `Erreur : ${error.message}` })
      return false
    }
    setDevisList((prev) => prev.map((d) => (d.id === devisId ? { ...d, ...patch } as Devis : d)))
    return true
  }

  async function changeTva(d: Devis, nextTva: number) {
    const ttc = computeTtc(Number(d.montant_ht) || 0, nextTva)
    await updateDevis(d.id, { tva_pct: nextTva, montant_ttc: ttc })
  }

  async function setSignataires(d: Devis, ids: string[]) {
    await updateDevis(d.id, { signataire_ids: ids } as Partial<Devis>)
  }

  async function setObservateurs(d: Devis, ids: string[]) {
    await updateDevis(d.id, { observateur_ids: ids } as Partial<Devis>)
  }

  async function saveNotes(d: Devis, notes: string) {
    await updateDevis(d.id, { notes })
  }

  async function envoyerPourSignature(d: Devis) {
    const lot = lots.find((l) => l.id === d.lot_id)
    const signataires = employes.filter((e) => d.signataire_ids.includes(e.id))
    const observateurs = employes.filter((e) => d.observateur_ids.includes(e.id) && !d.signataire_ids.includes(e.id))
    if (signataires.length === 0) {
      setToast({ kind: 'err', msg: 'Aucun signataire sélectionné.' })
      return
    }

    // 1. Génère le PDF snapshot (meme doc pour tous)
    const pdfLignes: PdfLigne[] = (d.lignes ?? []).map((l) => ({
      designation: l.designation,
      detail: null,
      quantite: l.quantite,
      unite: l.unite,
      prix_unitaire: l.prix_unitaire,
    }))
    const blob = generateDevisSTPdf({
      projet_nom: projetNom,
      projet_reference: null,
      lot_nom: lot?.nom ?? '',
      st_societe: d.st_societe,
      st_nom: d.st_nom,
      st_email: d.st_email,
      st_telephone: null,
      lignes: pdfLignes,
      total_ht: Number(d.montant_ht) || 0,
    })

    const baseName = `Devis ${d.numero ?? d.id.slice(0, 8)} — ${lot?.nom ?? ''}`.trim()
    const storagePath = `${projetId}/03_contractuels/${Date.now()}_${(d.numero ?? 'devis').replace(/[^A-Za-z0-9_-]/g, '_')}.pdf`

    // 2. Upload PDF (un seul fichier partagé entre tous les destinataires)
    const { error: upErr } = await supabase.storage
      .from('projets')
      .upload(storagePath, blob, { contentType: 'application/pdf', upsert: false })
    if (upErr) {
      setToast({ kind: 'err', msg: `Upload : ${upErr.message}` })
      return
    }

    // Résout le user_id du ST depuis dce_acces_st (auto-créé à l'acceptation)
    const { data: accesRow } = await supabase
      .from('dce_acces_st')
      .select('user_id')
      .eq('id', d.acces_st_id)
      .maybeSingle()
    const stUserId = (accesRow as { user_id: string | null } | null)?.user_id ?? null

    // Economiste et CO du projet : tagués eux aussi pour recevoir la version finale signée
    const { data: projRow } = await supabase
      .schema('app')
      .from('projets')
      .select('economiste_id, co_id')
      .eq('id', projetId)
      .maybeSingle()
    const projR = projRow as { economiste_id: string | null; co_id: string | null } | null
    const ecoCoIds = [projR?.economiste_id, projR?.co_id].filter(Boolean) as string[]

    // 3. INSERT 1 ligne app.documents taggée : economiste + CO + signataires API + observateurs + ST
    const tousTagues = Array.from(new Set([
      ...ecoCoIds,
      ...signataires.map((s) => s.id),
      ...observateurs.map((o) => o.id),
      ...(stUserId ? [stUserId] : []),
    ]))
    const { data: doc, error: docErr } = await supabase
      .schema('app')
      .from('documents')
      .insert({
        projet_id: projetId,
        lot_id: null,
        nom_fichier: `${baseName}.pdf`,
        type_doc: 'devis',
        dossier_ged: '03_contractuels',
        storage_path: storagePath,
        taille_octets: blob.size,
        uploaded_by: null,
        role_source: 'economiste',
        tags_utilisateurs: tousTagues,
        tags_roles: ['gerant'],
        message_depot: `Devis à signer pour le lot « ${lot?.nom ?? ''} » du projet ${projetNom}.`,
        notif_envoyee: false,
        onedrive_sync: false,
      } as never)
      .select('id')
      .single()

    if (docErr || !doc) {
      setToast({ kind: 'err', msg: `Document : ${docErr?.message ?? 'échec'}` })
      return
    }
    const documentId = (doc as { id: string }).id

    // 4. Une notif par destinataire (deduplique) pour que le doc apparaisse dans leur /documents
    const notifDestIds = Array.from(new Set(tousTagues))
    const notifsRows = notifDestIds.map((uid) => ({
      document_id: documentId,
      projet_id: projetId,
      destinataire_id: uid,
      destinataire_role: uid === stUserId ? 'st' : null,
      lu: false,
    }))
    await supabase.schema('app').from('notifs_documents').insert(notifsRows as never)

    const alertes: any[] = []
    signataires.forEach((s) => {
      alertes.push({
        projet_id: projetId,
        utilisateur_id: s.id,
        type: 'devis_a_signer',
        titre: `Devis ${d.numero ?? ''} à signer`,
        message: `Lot « ${lot?.nom ?? ''} » · ${fmtEur(d.montant_ttc ?? computeTtc(d.montant_ht, d.tva_pct), 'TTC')}`,
        priorite: 'high',
        lue: false,
        metadata: { url: '/documents' },
      })
    })
    observateurs.forEach((o) => {
      alertes.push({
        projet_id: projetId,
        utilisateur_id: o.id,
        type: 'devis_a_consulter',
        titre: `Devis ${d.numero ?? ''} en copie`,
        message: `Lot « ${lot?.nom ?? ''} » · ${fmtEur(d.montant_ttc ?? computeTtc(d.montant_ht, d.tva_pct), 'TTC')}`,
        priorite: 'normal',
        lue: false,
        metadata: { url: '/documents' },
      })
    })
    if (stUserId) {
      alertes.push({
        projet_id: projetId,
        utilisateur_id: stUserId,
        type: 'devis_a_signer',
        titre: `Devis ${d.numero ?? ''} à signer`,
        message: `Votre offre pour le lot « ${lot?.nom ?? ''} » a été retenue — veuillez signer le devis.`,
        priorite: 'high',
        lue: false,
        metadata: { url: `/st/devis/${d.id}` },
      })
    }
    if (alertes.length > 0) {
      await supabase.schema('app').from('alertes').insert(alertes)
    }

    await supabase.schema('app').from('documents').update({ notif_envoyee: true }).eq('id', documentId)

    // 5. Maj devis — on conserve l'ID du document pour pouvoir le remplacer apres signature
    const ok = await updateDevis(d.id, {
      statut: 'envoye',
      envoye_le: new Date().toISOString(),
      document_signature_id: documentId,
    } as Partial<Devis>)
    if (ok) {
      const names = signataires.map((s) => `${s.prenom} ${s.nom}`).join(', ')
      const suffix = observateurs.length > 0 ? ` (+ ${observateurs.length} en copie)` : ''
      setToast({
        kind: 'ok',
        msg:
          signataires.length === 1
            ? `Devis envoyé à ${names} pour signature${suffix}`
            : `Devis envoyé à ${signataires.length} signataires : ${names}${suffix}`,
      })
    }
  }

  async function uploadSignature(d: Devis, file: File) {
    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
    const allowed = ['png', 'jpg', 'jpeg']
    if (!allowed.includes(ext)) {
      setToast({ kind: 'err', msg: 'Format : PNG ou JPG uniquement.' })
      return
    }
    // 1. Upload de l'image de signature (bucket privé → chemin stocké en base)
    const storagePath = `${projetId}/03_contractuels/signatures/${d.id}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('projets')
      .upload(storagePath, file, {
        contentType: ext === 'png' ? 'image/png' : 'image/jpeg',
        upsert: true,
      })
    if (upErr) {
      setToast({ kind: 'err', msg: `Upload signature : ${upErr.message}` })
      return
    }
    const signedAt = new Date().toISOString()
    const ok = await updateDevis(d.id, {
      signature_api_url: storagePath,
      statut: 'signe',
      signe_le: signedAt,
    } as Partial<Devis>)
    if (!ok) return

    // 2. Regenere le PDF signe et remplace le document tagué (tous les signataires)
    const result = await refreshSignedDocument(
      { ...d, signature_api_url: storagePath, signe_le: signedAt },
      file,
    )
    if (result === 'ok') {
      setToast({ kind: 'ok', msg: 'Signature enregistrée — document signé mis à jour pour les signataires.' })
    } else if (result === 'no-doc') {
      setToast({ kind: 'ok', msg: 'Signature enregistrée — devis marqué comme signé.' })
    } else {
      setToast({ kind: 'err', msg: `Signature OK, regeneration PDF échouée : ${result}` })
    }

    // Notif economiste + CO
    await notifySignatureCompleted(d)
  }

  // Helper : blob (file ou storage) -> dataUrl + format
  async function blobToDataUrl(blob: Blob): Promise<{ dataUrl: string; fmt: 'PNG' | 'JPEG' }> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
    return { dataUrl, fmt: dataUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG' }
  }

  async function fetchSignature(path: string | null): Promise<Blob | null> {
    if (!path) return null
    if (/^https?:\/\//.test(path)) {
      const r = await fetch(path)
      return await r.blob()
    }
    const res = await supabase.storage.from('projets').download(path)
    return res.data ?? null
  }

  // Régénère le PDF signé (avec signatures API et/ou ST) + met à jour app.documents.
  async function refreshSignedDocument(d: Devis, newApiSigFile?: File, newStSigFile?: File): Promise<'ok' | 'no-doc' | string> {
    try {
      // Signature API
      let apiDataUrl: string | null = null
      let apiFmt: 'PNG' | 'JPEG' = 'PNG'
      const apiBlob = newApiSigFile ?? (await fetchSignature(d.signature_api_url))
      if (apiBlob) {
        const r = await blobToDataUrl(apiBlob)
        apiDataUrl = r.dataUrl
        apiFmt = r.fmt
      }
      // Signature ST
      let stDataUrl: string | null = null
      let stFmt: 'PNG' | 'JPEG' = 'PNG'
      const stBlob = newStSigFile ?? (await fetchSignature(d.signature_st_url))
      if (stBlob) {
        const r = await blobToDataUrl(stBlob)
        stDataUrl = r.dataUrl
        stFmt = r.fmt
      }

      if (!apiDataUrl && !stDataUrl) return 'aucune signature'

      const lot = lots.find((l) => l.id === d.lot_id)
      const signataire = employes.find((e) => d.signataire_ids.includes(e.id)) ?? null
      const pdfLignes: PdfLigne[] = (d.lignes ?? []).map((l) => ({
        designation: l.designation,
        detail: null,
        quantite: l.quantite,
        unite: l.unite,
        prix_unitaire: l.prix_unitaire,
      }))
      const signedBlob = generateDevisSTPdf({
        projet_nom: projetNom,
        projet_reference: null,
        lot_nom: lot?.nom ?? '',
        st_societe: d.st_societe,
        st_nom: d.st_nom,
        st_email: d.st_email,
        st_telephone: null,
        lignes: pdfLignes,
        total_ht: Number(d.montant_ht) || 0,
        signature_api_dataurl: apiDataUrl,
        signature_api_format: apiFmt,
        signataire_label: signataire ? `${signataire.prenom} ${signataire.nom} (${signataire.poste})` : null,
        signe_le: d.signe_le,
        signature_st_dataurl: stDataUrl,
        signature_st_format: stFmt,
        signataire_st_label: d.st_nom ? `${d.st_nom}${d.st_societe ? ` (${d.st_societe})` : ''}` : null,
        signe_le_st: d.signe_le_st,
      })

      // 2. Détermine le document cible — lien direct OU recherche par tags+projet
      let documentId: string | null = d.document_signature_id
      if (!documentId && d.signataire_ids.length > 0) {
        const { data: found } = await supabase
          .schema('app')
          .from('documents')
          .select('id')
          .eq('projet_id', d.projet_id)
          .eq('type_doc', 'devis')
          .overlaps('tags_utilisateurs', d.signataire_ids as never)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        documentId = (found as { id: string } | null)?.id ?? null
        if (documentId) {
          await updateDevis(d.id, { document_signature_id: documentId } as Partial<Devis>)
        }
      }
      if (!documentId) return 'no-doc'

      // 3. Upload PDF signé + update app.documents + reset notifs
      const signedPdfPath = `${projetId}/03_contractuels/${d.numero ?? 'devis'}_signe.pdf`
      const { error: pdfUpErr } = await supabase.storage
        .from('projets')
        .upload(signedPdfPath, signedBlob, { contentType: 'application/pdf', upsert: true })
      if (pdfUpErr) return pdfUpErr.message

      const baseName = `Devis ${d.numero ?? ''} — ${lot?.nom ?? ''} (signé)`.trim()
      await supabase
        .schema('app')
        .from('documents')
        .update({
          storage_path: signedPdfPath,
          nom_fichier: `${baseName}.pdf`,
          taille_octets: signedBlob.size,
          message_depot: 'Devis signé par API',
        } as never)
        .eq('id', documentId)

      // On recrée les notifs_documents pour avoir un created_at neuf (= "A l'instant"
      // dans la cloche des destinataires au lieu d'un vieux timestamp).
      const { data: oldNotifs } = await supabase
        .schema('app')
        .from('notifs_documents')
        .select('destinataire_id, destinataire_role, projet_id')
        .eq('document_id', documentId)
      const olds = (oldNotifs ?? []) as Array<{ destinataire_id: string; destinataire_role: string | null; projet_id: string | null }>
      await supabase
        .schema('app')
        .from('notifs_documents')
        .delete()
        .eq('document_id', documentId)
      if (olds.length > 0) {
        await supabase.schema('app').from('notifs_documents').insert(
          olds.map((o) => ({
            document_id: documentId,
            projet_id: o.projet_id,
            destinataire_id: o.destinataire_id,
            destinataire_role: o.destinataire_role,
            lu: false,
          })) as never,
        )
      }

      return 'ok'
    } catch (e: any) {
      return e?.message ?? 'erreur'
    }
  }

  async function notifySignatureCompleted(d: Devis) {
    const { data: projet } = await supabase
      .schema('app')
      .from('projets')
      .select('economiste_id, co_id, nom')
      .eq('id', projetId)
      .maybeSingle()
    const p = projet as { economiste_id: string | null; co_id: string | null; nom: string | null } | null
    if (!p) return
    const destinataires = Array.from(new Set([p.economiste_id, p.co_id].filter(Boolean) as string[]))
    if (destinataires.length === 0) return

    // URL adaptée au rôle (co ne peut pas ouvrir /economiste/… et vice-versa).
    const { data: users } = await supabase
      .schema('app')
      .from('utilisateurs')
      .select('id, role')
      .in('id', destinataires)
    const roleById = new Map<string, string>()
    ;((users ?? []) as Array<{ id: string; role: string }>).forEach((u) => roleById.set(u.id, u.role))

    function urlFor(uid: string): string {
      const r = roleById.get(uid) ?? ''
      if (r === 'economiste') return `/economiste/projets/${projetId}?tab=devis-final`
      if (r === 'co') return `/co/documents`
      return `/${r || 'economiste'}/documents`
    }

    const lotNom = lots.find((l) => l.id === d.lot_id)?.nom ?? ''
    const signataire = employes.find((e) => d.signataire_ids.includes(e.id))
    const signe_par = 'API'

    await supabase.schema('app').from('alertes').insert(
      destinataires.map((uid) => ({
        projet_id: projetId,
        utilisateur_id: uid,
        type: 'devis_signe',
        titre: `Devis ${d.numero ?? ''} signé`,
        message: `Lot « ${lotNom} » · signé par ${signe_par}`,
        priorite: 'normal',
        lue: false,
        metadata: { url: urlFor(uid) },
      })),
    )
  }

  async function telechargerDevisSigne(d: Devis) {
    const lot = lots.find((l) => l.id === d.lot_id)
    const signataire = employes.find((e) => d.signataire_ids.includes(e.id)) ?? null

    // Charge les deux signatures (API et ST) si presentes
    let apiDataUrl: string | null = null
    let apiFmt: 'PNG' | 'JPEG' = 'PNG'
    const apiBlob = await fetchSignature(d.signature_api_url)
    if (apiBlob) {
      const r = await blobToDataUrl(apiBlob)
      apiDataUrl = r.dataUrl
      apiFmt = r.fmt
    }

    let stDataUrl: string | null = null
    let stFmt: 'PNG' | 'JPEG' = 'PNG'
    const stBlob = await fetchSignature(d.signature_st_url)
    if (stBlob) {
      const r = await blobToDataUrl(stBlob)
      stDataUrl = r.dataUrl
      stFmt = r.fmt
    }

    const pdfLignes: PdfLigne[] = (d.lignes ?? []).map((l) => ({
      designation: l.designation,
      detail: null,
      quantite: l.quantite,
      unite: l.unite,
      prix_unitaire: l.prix_unitaire,
    }))

    const blob = generateDevisSTPdf({
      projet_nom: projetNom,
      projet_reference: null,
      lot_nom: lot?.nom ?? '',
      st_societe: d.st_societe,
      st_nom: d.st_nom,
      st_email: d.st_email,
      st_telephone: null,
      lignes: pdfLignes,
      total_ht: Number(d.montant_ht) || 0,
      signature_api_dataurl: apiDataUrl,
      signature_api_format: apiFmt,
      signataire_label: signataire ? `${signataire.prenom} ${signataire.nom} (${signataire.poste})` : null,
      signe_le: d.signe_le,
      signature_st_dataurl: stDataUrl,
      signature_st_format: stFmt,
      signataire_st_label: d.st_nom ? `${d.st_nom}${d.st_societe ? ` (${d.st_societe})` : ''}` : null,
      signe_le_st: d.signe_le_st,
    })
    const bothSigned = !!apiDataUrl && !!stDataUrl
    const suffix = bothSigned ? '_signe_final' : apiDataUrl ? '_signe_api' : ''
    triggerDownload(blob, `${d.numero ?? 'devis'}${suffix}_${(lot?.nom ?? '').replace(/[^A-Za-z0-9_-]+/g, '_')}.pdf`)
  }

  async function annulerDevis(d: Devis) {
    await updateDevis(d.id, { statut: 'annule' })
    setConfirmAnnulId(null)
    setToast({ kind: 'ok', msg: 'Devis annulé' })
  }

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4500)
    return () => clearTimeout(t)
  }, [toast])

  /* ── Rendu ───────────────────────────────── */

  if (loading) return <div className="text-sm text-gray-400 py-10 text-center">Chargement…</div>

  if (lots.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
        <FileCheck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm font-semibold text-gray-700 mb-1">Aucun lot</p>
        <p className="text-xs text-gray-400">Ce projet n'a pas encore de lot.</p>
      </div>
    )
  }

  const devisParLot = new Map<string, Devis[]>()
  devisList.forEach((d) => {
    const arr = devisParLot.get(d.lot_id) ?? []
    arr.push(d)
    devisParLot.set(d.lot_id, arr)
  })

  const selectedLot = lots.find((l) => l.id === selectedLotId) ?? lots[0]
  const devisLot = (devisParLot.get(selectedLot.id) ?? [])
    .filter((d) => d.statut !== 'annule' || true) // on garde les annulés visibles (barrés)

  const kpiEngages  = devisList.filter((d) => d.statut !== 'annule').length
  const kpiMontant  = devisList.filter((d) => d.statut !== 'annule').reduce((s, d) => s + Number(d.montant_ht || 0), 0)
  const kpiSignes   = devisList.filter((d) => d.statut === 'signe').length

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div
          className={cn(
            'rounded-lg px-4 py-2 text-sm flex items-center gap-2 border',
            toast.kind === 'ok'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800',
          )}
        >
          {toast.kind === 'ok' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCard label="Devis engagés" value={String(kpiEngages)} />
        <KpiCard label={<>Montant total <Abbr k="HT" /></>} value={fmtEur(kpiMontant)} />
        <KpiCard label="Finalisés double-signés" value={String(kpiSignes)} accent="emerald" />
      </div>

      {/* Sélecteur de lots */}
      <div className="bg-white border border-gray-200 rounded-lg p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium mr-1">Lot :</span>
          {lots.map((l) => {
            const isActive = l.id === selectedLot.id
            const arr = devisParLot.get(l.id) ?? []
            const has = arr.some((d) => d.statut !== 'annule')
            return (
              <button
                key={l.id}
                onClick={() => setSelectedLotId(l.id)}
                className={cn(
                  'text-xs px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5',
                  isActive
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400',
                )}
              >
                <span className="font-mono text-[10px] opacity-70">L{String(l.ordre + 1).padStart(2, '0')}</span>
                {l.nom}
                {has ? (
                  <span
                    className={cn(
                      'ml-1 w-2 h-2 rounded-full',
                      isActive ? 'bg-emerald-300' : 'bg-emerald-500',
                    )}
                    aria-hidden
                  />
                ) : (
                  <span
                    className={cn(
                      'ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                      isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500',
                    )}
                  >
                    Aucun devis
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Contenu du lot sélectionné */}
      {devisLot.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {devisLot.map((d) => (
            <DevisCard
              key={d.id}
              devis={d}
              lotNom={selectedLot.nom}
              employes={employes}
              onSetSignataires={(ids) => setSignataires(d, ids)}
              onSetObservateurs={(ids) => setObservateurs(d, ids)}
              onTvaChange={(v) => changeTva(d, v)}
              onSaveNotes={(v) => saveNotes(d, v)}
              onEnvoyer={() => envoyerPourSignature(d)}
              onUploadSignature={(f) => uploadSignature(d, f)}
              onTelechargerSigne={() => telechargerDevisSigne(d)}
              onRefreshSignedDoc={async () => {
                const res = await refreshSignedDocument(d)
                if (res === 'ok') setToast({ kind: 'ok', msg: 'Document signataire mis à jour avec le PDF signé.' })
                else if (res === 'no-doc') setToast({ kind: 'err', msg: 'Document du signataire introuvable.' })
                else setToast({ kind: 'err', msg: `Échec : ${res}` })
              }}
              onAnnuler={() => setConfirmAnnulId(d.id)}
            />
          ))}
        </div>
      )}

      {/* Modale confirmation annulation */}
      {confirmAnnulId && (() => {
        const dev = devisList.find((x) => x.id === confirmAnnulId)
        if (!dev) return null
        return (
          <ConfirmModal
            title="Annuler ce devis ?"
            message={`Le devis ${dev.numero ?? ''} passera au statut "annulé". Cette action est réversible via la base.`}
            confirmLabel="Confirmer l'annulation"
            confirmTone="danger"
            onConfirm={() => annulerDevis(dev)}
            onClose={() => setConfirmAnnulId(null)}
          />
        )
      })()}
    </div>
  )
}

/* ─── Empty state ──────────────────────────────────────────────────────── */

function EmptyState() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-10 text-center">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 text-gray-200 mx-auto mb-3">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M9 13h6M9 17h4" />
      </svg>
      <p className="text-sm font-semibold text-gray-700">Aucun <Abbr k="ST" /> retenu pour ce lot</p>
      <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
        Acceptez une offre dans l&apos;onglet <strong>Comparatif <Abbr k="ST" /></strong> pour générer automatiquement le devis final.
      </p>
    </div>
  )
}

/* ─── KPI Card ─────────────────────────────────────────────────────────── */

function KpiCard({ label, value, accent }: { label: React.ReactNode; value: React.ReactNode; accent?: 'emerald' }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-[11px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={cn('text-2xl font-semibold mt-1 tabular-nums', accent === 'emerald' ? 'text-emerald-700' : 'text-gray-900')}>
        {value}
      </p>
    </div>
  )
}

/* ─── Devis Card ───────────────────────────────────────────────────────── */

function DevisCard({
  devis,
  lotNom,
  employes,
  onSetSignataires,
  onSetObservateurs,
  onTvaChange,
  onSaveNotes,
  onEnvoyer,
  onUploadSignature,
  onTelechargerSigne,
  onRefreshSignedDoc,
  onAnnuler,
}: {
  devis: Devis
  lotNom: string
  employes: Employe[]
  onSetSignataires: (ids: string[]) => void | Promise<void>
  onSetObservateurs: (ids: string[]) => void | Promise<void>
  onTvaChange: (tva: number) => void
  onSaveNotes: (notes: string) => void
  onEnvoyer: () => void
  onUploadSignature: (file: File) => void | Promise<void>
  onTelechargerSigne: () => void | Promise<void>
  onRefreshSignedDoc: () => void | Promise<void>
  onAnnuler: () => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [notes, setNotes] = useState(devis.notes ?? '')
  const [sending, setSending] = useState(false)
  const [uploadingSig, setUploadingSig] = useState(false)
  const [sigPreview, setSigPreview] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const path = devis.signature_api_url
    if (!path) { setSigPreview(null); return }
    // Legacy : si l'entrée est déjà une URL complète, on la réutilise telle quelle.
    if (/^https?:\/\//.test(path)) {
      setSigPreview(path)
      return
    }
    supabase.storage
      .from('projets')
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (!cancelled) setSigPreview(data?.signedUrl ?? null)
      })
    return () => { cancelled = true }
  }, [devis.signature_api_url, supabase])

  useEffect(() => setNotes(devis.notes ?? ''), [devis.id, devis.notes])

  useEffect(() => {
    if (notes === (devis.notes ?? '')) return
    const t = setTimeout(() => { onSaveNotes(notes) }, 1000)
    return () => clearTimeout(t)
  }, [notes]) // eslint-disable-line react-hooks/exhaustive-deps

  const style = STATUT_STYLE[devis.statut]
  const signataires = employes.filter((e) => devis.signataire_ids.includes(e.id))
  const sousTotal = Number(devis.montant_ht) || 0
  const tva = Number(devis.tva_pct) || 0
  const tvaAmount = sousTotal * (tva / 100)
  const totalTtc = Number(devis.montant_ttc ?? computeTtc(sousTotal, tva))

  const isBrouillon = devis.statut === 'brouillon'
  const isEnvoye    = devis.statut === 'envoye'
  const isSigne     = devis.statut === 'signe'
  const canEnvoyer  = isBrouillon && signataires.length > 0
  const canAnnuler  = devis.statut !== 'signe' && devis.statut !== 'annule'

  return (
    <div
      className="bg-white border border-gray-200 rounded-lg overflow-hidden"
      style={devis.statut === 'annule' ? { opacity: 0.7 } : undefined}
    >
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span
            className="text-sm font-mono font-semibold"
            style={devis.statut === 'annule' ? { textDecoration: 'line-through', color: '#888780' } : undefined}
          >
            {devis.numero ?? 'DEV-—'}
          </span>
          <span
            className="text-[11px] px-2 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: style.bg, color: style.color, textDecoration: style.extra === 'line-through' ? 'line-through' : undefined }}
          >
            {style.label}
          </span>
        </div>
        <div className="text-xs text-gray-500">
          Créé le {new Date(devis.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
          {devis.envoye_le && ` · envoyé le ${new Date(devis.envoye_le).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`}
          {devis.signe_le && ` · signé le ${new Date(devis.signe_le).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`}
        </div>
      </div>

      {/* Corps */}
      <div className="px-5 py-4 space-y-4">
        {/* ST + lot */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wider">Sous-traitant</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">
              {devis.st_nom}
              {devis.st_societe && <span className="text-gray-500"> — {devis.st_societe}</span>}
            </p>
            {devis.st_email && <p className="text-xs text-gray-400">{devis.st_email}</p>}
          </div>
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wider">Lot</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">{lotNom}</p>
          </div>
        </div>

        {/* Tableau lignes (snapshot) */}
        {devis.lignes && devis.lignes.length > 0 && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-500">
                  <th className="px-3 py-2 font-medium">Désignation</th>
                  <th className="px-3 py-2 font-medium text-right w-20">Quantité</th>
                  <th className="px-3 py-2 font-medium w-14">Unité</th>
                  <th className="px-3 py-2 font-medium text-right w-28">PU <Abbr k="HT" /></th>
                  <th className="px-3 py-2 font-medium text-right w-28">Total <Abbr k="HT" /></th>
                </tr>
              </thead>
              <tbody>
                {devis.lignes.map((l, idx) => (
                  <tr
                    key={idx}
                    className={cn('border-t border-gray-100', idx % 2 === 1 ? 'bg-gray-50/50' : 'bg-white')}
                  >
                    <td className="px-3 py-2 text-gray-800">{l.designation}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-700">{Number(l.quantite) || 0}</td>
                    <td className="px-3 py-2 text-gray-500">{l.unite}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-700">{fmtEur(l.prix_unitaire)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-900 font-medium">{fmtEur(l.total_ht)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Totaux + TVA */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <label className="block text-[11px] text-gray-500 uppercase tracking-wider mb-1"><Abbr k="TVA" /></label>
            <select
              value={String(tva)}
              onChange={(e) => onTvaChange(Number(e.target.value))}
              disabled={!isBrouillon}
              className={cn(
                'px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400',
                !isBrouillon && 'bg-gray-50 cursor-not-allowed',
              )}
            >
              {TVA_CHOICES.map((v) => (
                <option key={v} value={v}>{v}%</option>
              ))}
            </select>
          </div>
          <div className="md:w-64 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Sous-total <Abbr k="HT" /></span>
              <span className="tabular-nums text-gray-900">{fmtEur(sousTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500"><Abbr k="TVA" /> {tva}%</span>
              <span className="tabular-nums text-gray-700">{fmtEur(tvaAmount)}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-gray-100">
              <span className="text-gray-900 font-semibold">TOTAL <Abbr k="TTC" /></span>
              <span className="tabular-nums font-semibold text-gray-900">{fmtEur(totalTtc, 'TTC')}</span>
            </div>
          </div>
        </div>

        {/* Personnes taguées (signataires + observateurs) */}
        <TaggedPeoplePicker
          employes={employes}
          signataireIds={devis.signataire_ids}
          observateurIds={devis.observateur_ids}
          locked={isSigne}
          onSetSignataires={(ids) => onSetSignataires(ids)}
          onSetObservateurs={(ids) => onSetObservateurs(ids)}
        />

        {/* Notes */}
        <div>
          <label className="block text-[11px] text-gray-500 uppercase tracking-wider mb-1">Notes internes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Notes internes (non transmises au sous-traitant)…"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none"
          />
        </div>

        {/* Signature API (upload + aperçu) */}
        {(isEnvoye || isSigne) && (
          <div className="border border-gray-100 rounded-lg p-3 bg-gray-50/50 flex items-start gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <PenLine className="w-3 h-3" />
                Signature API Rénovation
              </p>
              {devis.signature_api_url ? (
                <div className="flex items-center gap-3">
                  <div className="h-16 w-36 bg-white border border-gray-200 rounded-md flex items-center justify-center overflow-hidden">
                    {sigPreview ? (
                      <img
                        src={sigPreview}
                        alt="Signature"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-[10px] text-gray-300">Chargement…</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {isSigne ? (
                      <>
                        Signée le{' '}
                        {devis.signe_le &&
                          new Date(devis.signe_le).toLocaleDateString('fr-FR', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                      </>
                    ) : (
                      'Signature déposée'
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-400">
                  Déposez une image de signature (PNG ou JPG) : elle sera placée dans le cadre gauche du PDF.
                </p>
              )}
            </div>
            <label className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg cursor-pointer',
              devis.signature_api_url
                ? 'border border-gray-200 text-gray-700 hover:bg-white'
                : 'bg-gray-900 text-white hover:bg-black',
              uploadingSig && 'opacity-60 pointer-events-none',
            )}>
              <Upload className="w-3.5 h-3.5" />
              {uploadingSig
                ? 'Envoi…'
                : devis.signature_api_url
                  ? 'Remplacer'
                  : 'Déposer la signature'}
              <input
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                disabled={uploadingSig}
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (!f) return
                  setUploadingSig(true)
                  await onUploadSignature(f)
                  setUploadingSig(false)
                }}
              />
            </label>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-gray-100">
          {canEnvoyer && (
            <button
              onClick={async () => { setSending(true); await onEnvoyer(); setSending(false) }}
              disabled={sending}
              className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-black disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
              {sending ? 'Envoi…' : 'Envoyer pour signature'}
            </button>
          )}
          {isBrouillon && signataires.length === 0 && (
            <span className="text-xs text-amber-700 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Choisissez au moins un signataire pour pouvoir envoyer le devis.
            </span>
          )}
          {isSigne && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-700 font-medium">
              <Check className="w-4 h-4" />
              Devis signé et finalisé
            </span>
          )}
          {(isEnvoye || isSigne) && (
            <button
              onClick={onTelechargerSigne}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-sm text-gray-700 rounded-lg hover:bg-gray-50"
            >
              <Download className="w-3.5 h-3.5" />
              Télécharger le devis{devis.signature_api_url ? ' signé' : ''}
            </button>
          )}
          {isSigne && devis.signature_api_url && (
            <button
              onClick={onRefreshSignedDoc}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-sm text-gray-700 rounded-lg hover:bg-gray-50"
              title="Regénérer le PDF signé et l'envoyer aux signataires tagués"
            >
              <FileSignature className="w-3.5 h-3.5" />
              Mettre à jour le doc signé
            </button>
          )}
          {canAnnuler && (
            <button
              onClick={onAnnuler}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50"
            >
              <Ban className="w-3.5 h-3.5" />
              Annuler ce devis
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Personnes taguées (signataire + observateur) ─────────────────────── */

type TagRole = 'signer' | 'voir'

function TaggedPeoplePicker({
  employes,
  signataireIds,
  observateurIds,
  locked,
  onSetSignataires,
  onSetObservateurs,
}: {
  employes: Employe[]
  signataireIds: string[]
  observateurIds: string[]
  locked: boolean
  onSetSignataires: (ids: string[]) => void | Promise<void>
  onSetObservateurs: (ids: string[]) => void | Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [addRole, setAddRole] = useState<TagRole>('signer')
  const [q, setQ] = useState('')

  const taggedIds = new Set([...signataireIds, ...observateurIds])
  const signataires = employes.filter((e) => signataireIds.includes(e.id))
  const observateurs = employes.filter((e) => observateurIds.includes(e.id) && !signataireIds.includes(e.id))

  const available = employes.filter((e) => {
    if (taggedIds.has(e.id)) return false
    if (!q.trim()) return true
    const s = q.toLowerCase()
    return (
      e.prenom.toLowerCase().includes(s) ||
      e.nom.toLowerCase().includes(s) ||
      e.email.toLowerCase().includes(s) ||
      e.poste.toLowerCase().includes(s)
    )
  })

  function remove(id: string) {
    if (signataireIds.includes(id)) onSetSignataires(signataireIds.filter((x) => x !== id))
    if (observateurIds.includes(id)) onSetObservateurs(observateurIds.filter((x) => x !== id))
  }

  function switchRole(id: string, next: TagRole) {
    if (next === 'signer') {
      onSetObservateurs(observateurIds.filter((x) => x !== id))
      if (!signataireIds.includes(id)) onSetSignataires([...signataireIds, id])
    } else {
      onSetSignataires(signataireIds.filter((x) => x !== id))
      if (!observateurIds.includes(id)) onSetObservateurs([...observateurIds, id])
    }
  }

  function add(id: string) {
    if (taggedIds.has(id)) return
    if (addRole === 'signer') onSetSignataires([...signataireIds, id])
    else onSetObservateurs([...observateurIds, id])
    setQ('')
  }

  return (
    <div className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <p className="text-[11px] text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
          <UserCheck className="w-3 h-3" />
          Personnes taguées
          {(signataires.length + observateurs.length) > 0 && (
            <span className="ml-1 text-[10px] px-1.5 py-0.5 bg-gray-900 text-white rounded-full font-semibold normal-case tracking-normal">
              {signataires.length + observateurs.length}
            </span>
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5 items-center">
        {[...signataires.map((s) => ({ s, role: 'signer' as TagRole })),
          ...observateurs.map((s) => ({ s, role: 'voir' as TagRole }))].map(({ s, role }) => {
          const isSigner = role === 'signer'
          return (
            <span
              key={s.id}
              className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-full pl-1 pr-2 py-0.5 text-xs"
            >
              <span className={cn(
                'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold',
                isSigner ? 'bg-gray-900 text-white' : 'bg-[#E6F1FB] text-[#185FA5]',
              )}>
                {`${s.prenom[0] ?? ''}${s.nom[0] ?? ''}`.toUpperCase()}
              </span>
              <span className="text-gray-800 font-medium">{s.prenom} {s.nom}</span>
              {!locked ? (
                <button
                  onClick={() => switchRole(s.id, isSigner ? 'voir' : 'signer')}
                  className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wider transition-colors',
                    isSigner
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-[#E6F1FB] text-[#185FA5] hover:bg-[#D1E4F5]',
                  )}
                  title={isSigner ? 'Cliquer pour passer en lecture seule' : 'Cliquer pour demander signature'}
                >
                  {isSigner ? 'À signer' : 'À voir'}
                </button>
              ) : (
                <span className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wider',
                  isSigner ? 'bg-emerald-50 text-emerald-700' : 'bg-[#E6F1FB] text-[#185FA5]',
                )}>
                  {isSigner ? 'À signer' : 'À voir'}
                </span>
              )}
              {!locked && (
                <button
                  onClick={() => remove(s.id)}
                  className="text-gray-400 hover:text-red-600"
                  title="Retirer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          )
        })}
        {!locked && (
          <button
            onClick={() => setOpen((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border border-dashed transition-colors',
              open
                ? 'border-gray-900 text-gray-900 bg-white'
                : 'border-gray-300 text-gray-600 hover:border-gray-500 hover:text-gray-900',
            )}
          >
            <Plus className="w-3 h-3" />
            {(signataires.length + observateurs.length) === 0 ? 'Ajouter une personne' : 'Ajouter'}
          </button>
        )}
      </div>

      {open && !locked && (
        <div className="mt-3 bg-white border border-gray-200 rounded-md overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-gray-100 rounded-md p-0.5">
              {(['signer', 'voir'] as TagRole[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setAddRole(r)}
                  className={cn(
                    'px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider rounded transition-colors',
                    addRole === r
                      ? r === 'signer' ? 'bg-gray-900 text-white' : 'bg-[#185FA5] text-white'
                      : 'text-gray-500 hover:text-gray-900',
                  )}
                >
                  {r === 'signer' ? 'À signer' : 'À voir'}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher…"
              className="flex-1 min-w-[160px] px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:border-gray-400"
              autoFocus
            />
          </div>
          <div className="max-h-56 overflow-y-auto divide-y divide-gray-100">
            {available.length === 0 ? (
              <p className="px-3 py-4 text-xs text-gray-400 text-center">
                {taggedIds.size === employes.length ? 'Tous les employés sont déjà tagués' : 'Aucun résultat'}
              </p>
            ) : (
              available.map((e) => (
                <button
                  key={e.id}
                  onClick={() => add(e.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50"
                >
                  <div className="w-7 h-7 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">
                    {`${e.prenom[0] ?? ''}${e.nom[0] ?? ''}`.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">
                      {e.prenom} {e.nom}
                      <span className="text-gray-400 font-normal"> · {e.poste}</span>
                    </p>
                    <p className="text-[11px] text-gray-400 truncate">{e.email}</p>
                  </div>
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wider flex-shrink-0',
                    addRole === 'signer' ? 'bg-emerald-50 text-emerald-700' : 'bg-[#E6F1FB] text-[#185FA5]',
                  )}>
                    + {addRole === 'signer' ? 'À signer' : 'À voir'}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Modale de confirmation ───────────────────────────────────────────── */

function ConfirmModal({
  title,
  message,
  confirmLabel,
  confirmTone,
  onConfirm,
  onClose,
}: {
  title: string
  message: string
  confirmLabel: string
  confirmTone?: 'danger' | 'primary'
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-gray-600">{message}</p>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              'px-4 py-1.5 text-sm font-medium text-white rounded-lg',
              confirmTone === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-900 hover:bg-black',
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
