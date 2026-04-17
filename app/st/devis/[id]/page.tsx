'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  FileText, ArrowLeft, AlertCircle, Check, Upload, Download, PenLine, Building2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { generateDevisSTPdf, type DevisLigne as PdfLigne } from '@/lib/pdf/devisST'
import { cn } from '@/lib/utils'

type LigneSnapshot = {
  designation: string
  quantite: number
  unite: string
  prix_unitaire: number
  total_ht: number
}

type DevisRow = {
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
  statut: 'brouillon' | 'envoye' | 'signe' | 'refuse' | 'annule'
  envoye_le: string | null
  signe_le: string | null
  signe_le_st: string | null
  signature_api_url: string | null
  signature_st_url: string | null
  numero: string | null
  document_signature_id: string | null
  signataire_ids: string[] | null
  observateur_ids: string[] | null
}

function fmtEur(n: number | null | undefined, suffix: 'HT' | 'TTC' | '' = ''): string {
  const v = Number(n ?? 0)
  const f = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
  return `${f} €${suffix ? ' ' + suffix : ''}`
}

export default function StDevisPage() {
  const params = useParams()
  const router = useRouter()
  const devisId = params.id as string
  const supabase = useMemo(() => createClient(), [])
  const { user, loading: userLoading } = useUser()

  const [devis, setDevis] = useState<DevisRow | null>(null)
  const [accesUserId, setAccesUserId] = useState<string | null>(null)
  const [projetNom, setProjetNom] = useState('')
  const [lotNom, setLotNom] = useState('')
  const [apiSigUrl, setApiSigUrl] = useState<string | null>(null)
  const [stSigUrl, setStSigUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (userLoading) return
    if (!user) { router.push('/login'); return }
    let cancelled = false

    async function load() {
      const { data: d } = await supabase.from('devis').select('*').eq('id', devisId).maybeSingle()
      if (cancelled) return
      if (!d) { setLoading(false); return }
      const row = d as unknown as DevisRow

      // Controle acces : user connecte doit etre le ST de l'invitation liee
      const { data: acces } = await supabase
        .from('dce_acces_st')
        .select('user_id')
        .eq('id', row.acces_st_id)
        .maybeSingle()
      const stUid = (acces as { user_id: string | null } | null)?.user_id ?? null
      setAccesUserId(stUid)
      if (!stUid || stUid !== user!.id) { setForbidden(true); setLoading(false); return }

      setDevis(row)

      // Contexte
      const [{ data: lot }, { data: proj }] = await Promise.all([
        supabase.from('lots').select('nom').eq('id', row.lot_id).maybeSingle(),
        supabase.schema('app').from('projets').select('nom').eq('id', row.projet_id).maybeSingle(),
      ])
      setLotNom((lot as { nom: string } | null)?.nom ?? '')
      setProjetNom((proj as { nom: string } | null)?.nom ?? '')

      // URL signees pour affichage des signatures existantes
      if (row.signature_api_url) {
        const { data: p } = await supabase.storage.from('projets').createSignedUrl(row.signature_api_url, 3600)
        setApiSigUrl(p?.signedUrl ?? null)
      }
      if (row.signature_st_url) {
        const { data: p } = await supabase.storage.from('projets').createSignedUrl(row.signature_st_url, 3600)
        setStSigUrl(p?.signedUrl ?? null)
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [devisId, supabase, user, userLoading, router])

  async function uploadStSignature(file: File) {
    if (!devis) return
    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
    if (!['png', 'jpg', 'jpeg'].includes(ext)) {
      setError('Format : PNG ou JPG uniquement.'); return
    }
    setUploading(true); setError(null); setSuccess(null)

    const storagePath = `${devis.projet_id}/03_contractuels/signatures/st_${devis.id}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('projets')
      .upload(storagePath, file, { contentType: ext === 'png' ? 'image/png' : 'image/jpeg', upsert: true })
    if (upErr) { setError(`Upload : ${upErr.message}`); setUploading(false); return }

    const signedAt = new Date().toISOString()
    const { error: updErr } = await supabase
      .from('devis')
      .update({
        signature_st_url: storagePath,
        signe_le_st: signedAt,
        statut: devis.signature_api_url ? 'signe' : devis.statut,
        updated_at: signedAt,
      } as never)
      .eq('id', devis.id)
    if (updErr) { setError(`Maj devis : ${updErr.message}`); setUploading(false); return }

    // Régénère le PDF avec les deux signatures + remplace le document partagé
    try {
      const stDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
      const stFmt: 'PNG' | 'JPEG' = stDataUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG'

      // API signature (depuis storage si existante)
      let apiDataUrl: string | null = null
      let apiFmt: 'PNG' | 'JPEG' = 'PNG'
      if (devis.signature_api_url) {
        const { data: blob } = await supabase.storage.from('projets').download(devis.signature_api_url)
        if (blob) {
          apiDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = () => reject(reader.error)
            reader.readAsDataURL(blob)
          })
          apiFmt = apiDataUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG'
        }
      }

      const pdfLignes: PdfLigne[] = (devis.lignes ?? []).map((l) => ({
        designation: l.designation,
        detail: null,
        quantite: l.quantite,
        unite: l.unite,
        prix_unitaire: l.prix_unitaire,
      }))
      const signedBlob = generateDevisSTPdf({
        projet_nom: projetNom,
        projet_reference: null,
        lot_nom: lotNom,
        st_societe: devis.st_societe,
        st_nom: devis.st_nom,
        st_email: devis.st_email,
        st_telephone: null,
        lignes: pdfLignes,
        total_ht: Number(devis.montant_ht) || 0,
        signature_api_dataurl: apiDataUrl,
        signature_api_format: apiFmt,
        signataire_label: null,
        signe_le: devis.signe_le,
        signature_st_dataurl: stDataUrl,
        signature_st_format: stFmt,
        signataire_st_label: devis.st_nom ? `${devis.st_nom}${devis.st_societe ? ` (${devis.st_societe})` : ''}` : null,
        signe_le_st: signedAt,
      })

      if (devis.document_signature_id) {
        const pdfPath = `${devis.projet_id}/03_contractuels/${devis.numero ?? 'devis'}_signe.pdf`
        await supabase.storage.from('projets').upload(pdfPath, signedBlob, { contentType: 'application/pdf', upsert: true })

        // Assure que economiste + CO + signataires + observateurs + ST sont tagues
        // (defensif : les devis envoyes avant le fix peuvent avoir des tags incomplets).
        const { data: projRow } = await supabase.schema('app').from('projets')
          .select('economiste_id, co_id').eq('id', devis.projet_id).maybeSingle()
        const pr = projRow as { economiste_id: string | null; co_id: string | null } | null
        const stakeholderIds = Array.from(new Set([
          ...(pr?.economiste_id ? [pr.economiste_id] : []),
          ...(pr?.co_id ? [pr.co_id] : []),
          ...(devis.signataire_ids ?? []),
          ...(devis.observateur_ids ?? []),
          ...(accesUserId ? [accesUserId] : []),
        ]))

        const baseName = `Devis ${devis.numero ?? ''} — ${lotNom} (signé)`.trim()
        await supabase.schema('app').from('documents').update({
          storage_path: pdfPath,
          nom_fichier: `${baseName}.pdf`,
          taille_octets: signedBlob.size,
          message_depot: `Devis signé par ${devis.st_nom ?? 'le sous-traitant'}`,
          tags_utilisateurs: stakeholderIds,
        } as never).eq('id', devis.document_signature_id)

        // Reset + recrée les notifs pour TOUS les stakeholders (inclut les ajouts)
        await supabase.schema('app').from('notifs_documents').delete().eq('document_id', devis.document_signature_id)
        if (stakeholderIds.length > 0) {
          await supabase.schema('app').from('notifs_documents').insert(
            stakeholderIds.map((uid) => ({
              document_id: devis.document_signature_id,
              projet_id: devis.projet_id,
              destinataire_id: uid,
              destinataire_role: uid === accesUserId ? 'st' : null,
              lu: false,
            })) as never,
          )
        }
      }

      // Notifie economiste + CO + signataires API + observateurs, chacun avec l'URL
      // correspondant a son role (cas co peut pas ouvrir /economiste/..., etc.).
      const { data: proj } = await supabase.schema('app').from('projets')
        .select('economiste_id, co_id').eq('id', devis.projet_id).maybeSingle()
      const p = proj as { economiste_id: string | null; co_id: string | null } | null
      const signataireIds = devis.signataire_ids ?? []
      const observateurIds = devis.observateur_ids ?? []
      const destinataires = Array.from(new Set(
        [p?.economiste_id, p?.co_id, ...signataireIds, ...observateurIds].filter(Boolean) as string[],
      ))
      if (destinataires.length > 0) {
        const { data: users } = await supabase
          .schema('app')
          .from('utilisateurs')
          .select('id, role')
          .in('id', destinataires)
        const roleById = new Map<string, string>()
        ;((users ?? []) as Array<{ id: string; role: string }>).forEach((u) => roleById.set(u.id, u.role))

        const urlFor = (uid: string): string => {
          const r = roleById.get(uid) ?? ''
          if (r === 'economiste') return `/economiste/projets/${devis!.projet_id}?tab=devis-final`
          if (r === 'co') return `/co/documents`
          return `/${r || 'economiste'}/documents`
        }

        await supabase.schema('app').from('alertes').insert(destinataires.map((uid) => ({
          projet_id: devis.projet_id,
          utilisateur_id: uid,
          type: 'devis_signe_st',
          titre: `Devis ${devis.numero ?? ''} signé par le ST`,
          message: `Lot « ${lotNom} » · signé par ${devis.st_nom ?? 'le ST'}`,
          priorite: 'high',
          lue: false,
          metadata: { url: urlFor(uid) },
        })))
      }

      setSuccess('Devis signé et transmis à API Rénovation.')
      // Recharge l'etat local
      const { data: fresh } = await supabase.from('devis').select('*').eq('id', devis.id).maybeSingle()
      if (fresh) setDevis(fresh as unknown as DevisRow)
      const { data: sig } = await supabase.storage.from('projets').createSignedUrl(storagePath, 3600)
      setStSigUrl(sig?.signedUrl ?? null)
    } catch (e: any) {
      setError(`Régénération PDF : ${e?.message ?? 'erreur'}`)
    }
    setUploading(false)
  }

  async function telechargerPdf() {
    if (!devis) return
    const pdfLignes: PdfLigne[] = (devis.lignes ?? []).map((l) => ({
      designation: l.designation, detail: null, quantite: l.quantite, unite: l.unite, prix_unitaire: l.prix_unitaire,
    }))
    let apiData: string | null = null
    if (devis.signature_api_url) {
      try {
        const { data: b } = await supabase.storage.from('projets').download(devis.signature_api_url)
        if (b) apiData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = () => reject(reader.error)
          reader.readAsDataURL(b)
        })
      } catch { /* noop */ }
    }
    let stData: string | null = null
    if (devis.signature_st_url) {
      try {
        const { data: b } = await supabase.storage.from('projets').download(devis.signature_st_url)
        if (b) stData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = () => reject(reader.error)
          reader.readAsDataURL(b)
        })
      } catch { /* noop */ }
    }
    const blob = generateDevisSTPdf({
      projet_nom: projetNom, projet_reference: null, lot_nom: lotNom,
      st_societe: devis.st_societe, st_nom: devis.st_nom, st_email: devis.st_email, st_telephone: null,
      lignes: pdfLignes, total_ht: Number(devis.montant_ht) || 0,
      signature_api_dataurl: apiData, signe_le: devis.signe_le,
      signature_st_dataurl: stData,
      signataire_st_label: devis.st_nom ? `${devis.st_nom}${devis.st_societe ? ` (${devis.st_societe})` : ''}` : null,
      signe_le_st: devis.signe_le_st,
    })
    const u = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = u
    a.download = `${devis.numero ?? 'devis'}.pdf`; a.click()
    setTimeout(() => URL.revokeObjectURL(u), 2000)
  }

  if (userLoading || loading) return <div className="p-10 text-sm text-gray-400 text-center">Chargement…</div>
  if (forbidden) return (
    <div className="p-10 max-w-md mx-auto text-center">
      <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
      <h1 className="text-base font-semibold text-gray-900 mb-1">Accès refusé</h1>
      <p className="text-sm text-gray-500">Ce devis n'est pas lié à votre compte.</p>
      <Link href="/st/dashboard" className="inline-block mt-4 text-sm text-gray-700 underline">Retour</Link>
    </div>
  )
  if (!devis) return (
    <div className="p-10 max-w-md mx-auto text-center">
      <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
      <h1 className="text-base font-semibold text-gray-900 mb-1">Devis introuvable</h1>
    </div>
  )

  const sousTotal = Number(devis.montant_ht) || 0
  const tva = Number(devis.tva_pct) || 0
  const totalTtc = Number(devis.montant_ttc ?? sousTotal * (1 + tva / 100))
  const apiSigned = !!devis.signature_api_url
  const stSigned = !!devis.signature_st_url
  const finalSigned = apiSigned && stSigned

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <Link href="/st/documents" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700">
        <ArrowLeft className="w-3.5 h-3.5" />
        Mes documents
      </Link>

      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-1">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-mono font-semibold text-gray-900">{devis.numero ?? '—'}</span>
          <span className={cn(
            'text-[11px] px-2 py-0.5 rounded-full font-medium',
            finalSigned ? 'bg-emerald-50 text-emerald-700' : apiSigned ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700',
          )}>
            {finalSigned ? 'Devis finalisé' : apiSigned ? 'Signé par API — à signer' : 'En attente'}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Projet : <span className="text-gray-900 font-medium">{projetNom}</span> · Lot : <span className="text-gray-900 font-medium">{lotNom}</span>
        </p>
        {devis.st_societe && (
          <p className="text-xs text-gray-500 flex items-center gap-1"><Building2 className="w-3 h-3" />{devis.st_societe}</p>
        )}
      </div>

      {/* Lignes */}
      {devis.lignes && devis.lignes.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr className="text-left text-gray-500">
                <th className="px-3 py-2 font-medium">Désignation</th>
                <th className="px-3 py-2 font-medium text-right w-20">Qté</th>
                <th className="px-3 py-2 font-medium w-14">Unité</th>
                <th className="px-3 py-2 font-medium text-right w-28">PU HT</th>
                <th className="px-3 py-2 font-medium text-right w-28">Total HT</th>
              </tr>
            </thead>
            <tbody>
              {devis.lignes.map((l, i) => (
                <tr key={i} className={cn('border-t border-gray-100', i % 2 === 1 ? 'bg-gray-50/50' : 'bg-white')}>
                  <td className="px-3 py-2 text-gray-800">{l.designation}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-700">{l.quantite}</td>
                  <td className="px-3 py-2 text-gray-500">{l.unite}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-700">{fmtEur(l.prix_unitaire)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-900 font-medium">{fmtEur(l.total_ht)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex justify-end">
            <div className="w-64 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Sous-total HT</span><span className="tabular-nums text-gray-900">{fmtEur(sousTotal)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">TVA {tva}%</span><span className="tabular-nums text-gray-700">{fmtEur(sousTotal * tva / 100)}</span></div>
              <div className="flex justify-between pt-1 border-t border-gray-200"><span className="text-gray-900 font-semibold">TOTAL TTC</span><span className="tabular-nums font-semibold text-gray-900">{fmtEur(totalTtc, 'TTC')}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Signature API (lecture seule) */}
      <div className="border border-gray-100 rounded-lg p-3 bg-gray-50/50 flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <PenLine className="w-3 h-3" />
            Signature API Rénovation
          </p>
          {apiSigUrl ? (
            <div className="flex items-center gap-3">
              <div className="h-16 w-36 bg-white border border-gray-200 rounded-md flex items-center justify-center overflow-hidden">
                <img src={apiSigUrl} alt="Signature API" className="max-h-full max-w-full object-contain" />
              </div>
              <div className="text-xs text-gray-500">
                Signée le {devis.signe_le && new Date(devis.signe_le).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400">En attente de la signature d&apos;API Rénovation.</p>
          )}
        </div>
      </div>

      {/* Votre signature (meme UI que cote economiste) */}
      <div className="border border-gray-100 rounded-lg p-3 bg-gray-50/50 flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <PenLine className="w-3 h-3" />
            Votre signature
          </p>
          {stSigUrl ? (
            <div className="flex items-center gap-3">
              <div className="h-16 w-36 bg-white border border-gray-200 rounded-md flex items-center justify-center overflow-hidden">
                <img src={stSigUrl} alt="Signature ST" className="max-h-full max-w-full object-contain" />
              </div>
              <div className="text-xs text-gray-500">
                Signé le {devis.signe_le_st && new Date(devis.signe_le_st).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400">
              Déposez votre signature (PNG ou JPG) : elle sera placée dans le cadre droit du PDF.
            </p>
          )}
        </div>
        <label className={cn(
          'flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg cursor-pointer',
          stSigUrl
            ? 'border border-gray-200 text-gray-700 hover:bg-white'
            : 'bg-gray-900 text-white hover:bg-black',
          uploading && 'opacity-60 pointer-events-none',
        )}>
          <Upload className="w-3.5 h-3.5" />
          {uploading ? 'Envoi…' : stSigUrl ? 'Remplacer' : 'Déposer la signature'}
          <input
            type="file" accept="image/png,image/jpeg" className="hidden" disabled={uploading}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadStSignature(f) }}
          />
        </label>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg p-3 text-sm flex items-center gap-2">
          <Check className="w-4 h-4" />
          {success}
        </div>
      )}

      {/* Actions (meme barre que cote economiste) */}
      <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-gray-100">
        {finalSigned && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-700 font-medium">
            <Check className="w-4 h-4" />
            Devis signé et finalisé
          </span>
        )}
        {!finalSigned && apiSigned && !stSigned && (
          <span className="flex items-center gap-1.5 text-sm text-blue-700 font-medium">
            <PenLine className="w-3.5 h-3.5" />
            API Rénovation a signé — à votre tour de signer
          </span>
        )}
        {!apiSigned && (
          <span className="flex items-center gap-1.5 text-sm text-amber-700 font-medium">
            <AlertCircle className="w-3.5 h-3.5" />
            En attente de la signature d&apos;API Rénovation
          </span>
        )}
        <button
          onClick={telechargerPdf}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-sm text-gray-700 rounded-lg hover:bg-gray-50"
        >
          <Download className="w-3.5 h-3.5" />
          Télécharger le devis{finalSigned || apiSigned ? ' signé' : ''}
        </button>
      </div>
    </div>
  )
}
