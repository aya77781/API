import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'

const SYSTEM_PROMPT = `Tu rédiges des emails professionnels de demande de devis pour une société de construction. Ton style est clair, professionnel et cordial. L'email doit inclure :
- L'objet de la demande
- Le projet concerné (nom + adresse)
- Le lot à chiffrer avec description
- La date souhaitée de réception du devis (J+7)
- L'adresse email de réponse du destinataire
- Les coordonnées du CO pour toute question
- Préciser que le devis doit être envoyé en réponse à cet email

Retourne uniquement le corps de l'email, sans objet ni signature finale. En français.`

interface RequestBody {
  consultation_id: string
  st_id: string
  projet_id: string
  lot_id: string
  co_id: string
}

export async function POST(req: NextRequest) {
  /* ── Env checks ── */
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL

  if (!anthropicKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY non configurée' }, { status: 500 })
  if (!resendKey) return NextResponse.json({ error: 'RESEND_API_KEY non configurée' }, { status: 500 })
  if (!fromEmail) return NextResponse.json({ error: 'RESEND_FROM_EMAIL non configuré' }, { status: 500 })

  try {
    const body: RequestBody = await req.json()
    const { consultation_id, st_id, projet_id, lot_id, co_id } = body

    if (!consultation_id || !st_id || !projet_id || !lot_id || !co_id) {
      return NextResponse.json({ error: 'Champs manquants (consultation_id, st_id, projet_id, lot_id, co_id)' }, { status: 400 })
    }

    /* ── 1. Récupérer les données depuis Supabase ── */
    const supabase = createClient()

    const [stRes, projetRes, lotRes, coRes] = await Promise.all([
      supabase.schema('app').from('sous_traitants')
        .select('raison_sociale, contact_nom, contact_email, email, telephone')
        .eq('id', st_id).single(),
      supabase.schema('app').from('projets')
        .select('nom, adresse')
        .eq('id', projet_id).single(),
      supabase.schema('app').from('lots')
        .select('numero, corps_etat, notice_commerciale')
        .eq('id', lot_id).single(),
      supabase.schema('app').from('utilisateurs')
        .select('nom, prenom, email')
        .eq('id', co_id).single(),
    ])

    if (!stRes.data) return NextResponse.json({ error: 'Sous-traitant introuvable' }, { status: 404 })
    if (!projetRes.data) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 })
    if (!lotRes.data) return NextResponse.json({ error: 'Lot introuvable' }, { status: 404 })
    if (!coRes.data) return NextResponse.json({ error: 'CO introuvable' }, { status: 404 })

    const st = stRes.data
    const projet = projetRes.data
    const lot = lotRes.data
    const co = coRes.data

    const stEmail = st.email || st.contact_email
    if (!stEmail) {
      return NextResponse.json({ error: 'Aucun email renseigné pour ce sous-traitant' }, { status: 422 })
    }

    const dateLimite = new Date()
    dateLimite.setDate(dateLimite.getDate() + 7)
    const dateLimiteStr = dateLimite.toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })

    /* ── 2. Générer le corps de l'email via Claude ── */
    const userMessage = `Rédige un email de demande de devis avec ces informations :

Destinataire : ${st.raison_sociale}${st.contact_nom ? ` (contact : ${st.contact_nom})` : ''}
Projet : ${projet.nom}
Adresse du projet : ${projet.adresse ?? 'Non précisée'}
Lot n°${lot.numero} : ${lot.corps_etat}
Description du lot : ${lot.notice_commerciale ?? 'Voir cahier des charges joint'}
Date limite de réponse : ${dateLimiteStr}
Email de réponse : ${fromEmail}
Coordonnées du CO : ${co.prenom} ${co.nom} — ${co.email}`

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!claudeRes.ok) {
      const err = await claudeRes.json().catch(() => ({}))
      console.error('[demande-devis] Claude error:', err)
      return NextResponse.json({ error: 'Erreur lors de la génération de l\'email' }, { status: 502 })
    }

    const claudeData = await claudeRes.json()
    const emailBody = claudeData.content?.[0]?.type === 'text'
      ? claudeData.content[0].text
      : ''

    if (!emailBody) {
      return NextResponse.json({ error: 'L\'IA n\'a pas généré de contenu' }, { status: 502 })
    }

    /* ── 3. Envoyer l'email via Resend ── */
    const subject = `Demande de devis — ${projet.nom} — Lot ${lot.numero} ${lot.corps_etat}`
    const resend = new Resend(resendKey)

    const { error: sendError } = await resend.emails.send({
      from: `API Projet <${fromEmail}>`,
      replyTo: fromEmail,
      to: [stEmail],
      subject,
      text: emailBody,
      headers: {
        'X-Consultation-Id': consultation_id,
      },
    })

    if (sendError) {
      console.error('[demande-devis] Resend error:', sendError)
      return NextResponse.json({ error: `Erreur d'envoi email : ${sendError.message}` }, { status: 502 })
    }

    /* ── 4. Planifier les relances via app.alertes ── */
    const now = new Date()
    const j3 = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
    const j7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const relances = [
      {
        utilisateur_id: co_id,
        type: 'relance_devis',
        titre: `Relance devis — ${st.raison_sociale} — Lot ${lot.numero} ${lot.corps_etat}`,
        message: `Aucune réponse de ${st.raison_sociale} après 3 jours.`,
        priorite: 'normal',
        lue: false,
        declenchement_at: j3.toISOString(),
        metadata: { consultation_id, st_id, lot_id, relance_numero: 1 },
      },
      {
        utilisateur_id: co_id,
        type: 'relance_manuelle',
        titre: `Toujours pas de réponse — ${st.raison_sociale}`,
        message: `Le ST ${st.raison_sociale} n'a pas répondu après 7 jours. Pensez à le relancer par téléphone : ${st.telephone ?? 'N/A'}`,
        priorite: 'high',
        lue: false,
        declenchement_at: j7.toISOString(),
        metadata: { consultation_id, st_id, lot_id, telephone: st.telephone, relance_numero: 2 },
      },
    ]

    const { error: alerteErr } = await supabase.schema('app').from('alertes')
      .insert(relances)

    if (alerteErr) {
      console.error('[demande-devis] Alertes insert error:', alerteErr)
      // Non-bloquant : l'email est déjà envoyé
    }

    /* ── 5. Mettre à jour la consultation ── */
    const { error: updateErr } = await supabase.schema('app').from('consultations_st')
      .update({
        statut: 'devis_demande',
        email_envoye_at: now.toISOString(),
      })
      .eq('id', consultation_id)

    if (updateErr) {
      console.error('[demande-devis] Consultation update error:', updateErr)
    }

    /* ── 6. Réponse ── */
    return NextResponse.json({
      success: true,
      email_preview: emailBody,
    })
  } catch (err) {
    console.error('[demande-devis] Unexpected error:', err)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}
