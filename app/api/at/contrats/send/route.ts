import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'

interface RequestBody {
  contrat_id: string
  /** PDF encode en base64 (sans prefix data:). Le client genere le PDF via jsPDF puis l'envoie ici. */
  pdf_base64: string
  /** Destinataire(s). Si non fourni, utilise l'email du ST. */
  to?: string
  subject?: string
  message?: string
}

export async function POST(req: NextRequest) {
  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL || 'https://api-projet.fr'

  if (!resendKey) return NextResponse.json({ error: 'RESEND_API_KEY non configuree' }, { status: 500 })
  if (!fromEmail) return NextResponse.json({ error: 'RESEND_FROM_EMAIL non configure' }, { status: 500 })

  try {
    const { contrat_id, pdf_base64, to, subject, message }: RequestBody = await req.json()
    if (!contrat_id) return NextResponse.json({ error: 'contrat_id manquant' }, { status: 400 })
    if (!pdf_base64)  return NextResponse.json({ error: 'pdf_base64 manquant' }, { status: 400 })

    const supabase = createAdminClient()

    /* 1. Charge contrat + ST + projet */
    const { data: contratData } = await supabase
      .schema('app').from('at_contrats')
      .select('id,projet_id,st_id,numero,montant_ht,statut')
      .eq('id', contrat_id).maybeSingle()
    if (!contratData) return NextResponse.json({ error: 'Contrat introuvable' }, { status: 404 })
    const c = contratData as {
      id: string; projet_id: string | null; st_id: string; numero: string | null
      montant_ht: number | null; statut: string
    }

    const [stRes, projetRes] = await Promise.all([
      supabase.schema('app').from('at_sous_traitants')
        .select('nom,societe,email,corps_etat,dce_acces_id')
        .eq('id', c.st_id).maybeSingle(),
      c.projet_id
        ? supabase.schema('app').from('projets')
            .select('nom,reference').eq('id', c.projet_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ])
    const st = stRes.data as {
      nom: string; societe: string | null; email: string | null
      corps_etat: string | null; dce_acces_id: string | null
    } | null
    const projet = projetRes.data as { nom: string; reference: string | null } | null

    const destinataire = (to ?? st?.email ?? '').trim().toLowerCase()
    if (!destinataire) {
      return NextResponse.json({ error: 'Aucun email destinataire — renseigne l\'email du ST.' }, { status: 400 })
    }

    /* 2. Upload du PDF dans Supabase Storage (bucket projets) */
    const pdfBuffer = Buffer.from(pdf_base64, 'base64')
    const fileName  = `contrat-${c.numero || c.id.slice(0, 8)}.pdf`
    const storagePath = c.projet_id
      ? `${c.projet_id}/contrats/${c.id}/${fileName}`
      : `contrats/${c.id}/${fileName}`
    const { error: uploadErr } = await supabase.storage
      .from('projets')
      .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })
    if (uploadErr) {
      console.error('[contrat send] upload error:', uploadErr)
      return NextResponse.json({ error: `Upload PDF : ${uploadErr.message}` }, { status: 500 })
    }
    const { data: signed } = await supabase.storage
      .from('projets')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 30) // 30 jours

    /* 3. Construit le mail */
    const projetLabel = projet?.nom
      ? `${projet.reference ? `[${projet.reference}] ` : ''}${projet.nom}`
      : 'votre projet'
    const finalSubject = subject?.trim() || `Contrat de sous-traitance — ${projetLabel}${c.numero ? ` (n° ${c.numero})` : ''}`
    const stLabel = st?.societe || st?.nom || 'cher partenaire'

    const defaultMessage = `Bonjour,\n\n` +
      `Veuillez trouver ci-joint le contrat de sous-traitance${c.numero ? ` n° ${c.numero}` : ''} ` +
      `pour le projet ${projetLabel}${st?.corps_etat ? ` (lot ${st.corps_etat})` : ''}.\n\n` +
      `Merci de :\n` +
      `  1. Relire attentivement l'ensemble des clauses\n` +
      `  2. Le retourner signe et tampone, soit par mail, soit en vous connectant a la plateforme API Projet\n` +
      `  3. Conserver un exemplaire dans vos archives\n\n` +
      `Vous pouvez egalement consulter ce contrat directement depuis votre espace ST :\n` +
      `${appUrl}/login\n\n` +
      `Pour toute question, n'hesitez pas a nous contacter en repondant a ce mail.\n\n` +
      `Cordialement,\nL'equipe API Projet`

    const finalText = message?.trim() || defaultMessage
    const finalHtml = `
      <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1f2937;line-height:1.55;max-width:600px;font-size:14px;">
        <h2 style="color:#111827;margin:0 0 12px;font-size:18px">Contrat de sous-traitance</h2>
        <p style="color:#6b7280;margin:0 0 18px;font-size:13px">${escapeHtml(projetLabel)}${c.numero ? ` &middot; N° ${escapeHtml(c.numero)}` : ''}</p>
        <div style="white-space:pre-wrap;margin:0 0 18px">${escapeHtml(finalText)}</div>
        <div style="background:#f3f4f6;border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;margin:14px 0;">
          <p style="margin:0;font-size:13px"><strong>Piece jointe :</strong> ${escapeHtml(fileName)}</p>
          ${signed?.signedUrl
            ? `<p style="margin:6px 0 0;font-size:12px"><a href="${signed.signedUrl}" style="color:#2563eb">Lien direct (valide 30 jours)</a></p>`
            : ''}
        </div>
      </div>
    `

    /* 4. Envoi via Resend avec piece jointe */
    const resend = new Resend(resendKey)
    const { error: sendError } = await resend.emails.send({
      from: `API Projet <${fromEmail}>`,
      replyTo: fromEmail,
      to: [destinataire],
      subject: finalSubject,
      text: finalText,
      html: finalHtml,
      attachments: [
        { filename: fileName, content: pdf_base64 },
      ],
    })
    if (sendError) {
      return NextResponse.json({
        success: true, email_sent: false, storage_path: storagePath,
        signed_url: signed?.signedUrl ?? null,
        warning: `Mail non envoye : ${sendError.message}`,
      })
    }

    /* 5. Met a jour le contrat (statut envoye + url PDF + path storage + date envoi) */
    const { data: publicUrlData } = supabase.storage.from('projets').getPublicUrl(storagePath)
    await supabase.schema('app').from('at_contrats')
      .update({
        statut:           'envoye',
        pdf_url:          publicUrlData?.publicUrl ?? null,
        pdf_storage_path: storagePath,
        date_envoi:       new Date().toISOString(),
      } as never)
      .eq('id', c.id)

    /* 6. Notification interne au ST si user_id connu */
    if (st?.dce_acces_id) {
      const { data: accesData } = await supabase.from('dce_acces_st' as never)
        .select('user_id').eq('id', st.dce_acces_id).maybeSingle()
      const userId = (accesData as unknown as { user_id: string | null } | null)?.user_id
      if (userId) {
        await supabase.schema('app').from('alertes').insert({
          utilisateur_id: userId,
          projet_id:      c.projet_id,
          type:           'contrat_recu',
          titre:          `Nouveau contrat a signer — ${projetLabel}`,
          message:        `Vous avez recu votre contrat de sous-traitance${c.numero ? ` n° ${c.numero}` : ''}. Consultez votre boite mail ou connectez-vous a la plateforme.`,
          priorite:       'high',
          lue:            false,
        })
      }
    }

    return NextResponse.json({
      success: true,
      email_sent: true,
      storage_path: storagePath,
      signed_url: signed?.signedUrl ?? null,
      destinataire,
    })
  } catch (e: any) {
    console.error('[POST /api/at/contrats/send]', e)
    return NextResponse.json({ error: e?.message ?? 'Erreur serveur' }, { status: 500 })
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
