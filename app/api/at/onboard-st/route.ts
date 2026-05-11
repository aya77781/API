import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { adminCreateUser, createAdminClient } from '@/lib/supabase/admin'

function generatePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz'
  let s = ''
  for (let i = 0; i < 10; i++) s += chars.charAt(Math.floor(Math.random() * chars.length))
  return s
}

interface RequestBody {
  at_st_id: string
  email?: string
  force_regenerate?: boolean
  custom_message?: string
  /** 'prepare' = cree le compte et retourne creds + corps suggere SANS envoyer le mail.
   *  'send' = envoie le mail (email_subject + email_body fournis). */
  mode?: 'prepare' | 'send'
  email_subject?: string
  email_body?: string
  email_html?: string
}

export async function POST(req: NextRequest) {
  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL || 'https://api-projet.fr'

  try {
    const {
      at_st_id, email: emailOverride, force_regenerate, custom_message,
      mode = 'send', email_subject, email_body, email_html,
    }: RequestBody = await req.json()
    if (!at_st_id) return NextResponse.json({ error: 'at_st_id manquant' }, { status: 400 })

    /* Verifie les env Resend uniquement quand on envoie reellement le mail */
    if (mode === 'send') {
      if (!resendKey) return NextResponse.json({ error: 'RESEND_API_KEY non configuree' }, { status: 500 })
      if (!fromEmail) return NextResponse.json({ error: 'RESEND_FROM_EMAIL non configure' }, { status: 500 })
    }

    const supabase = createAdminClient()

    /* 1. Charge le ST + projet */
    const { data: stData, error: stErr } = await supabase
      .schema('app')
      .from('at_sous_traitants')
      .select('id,nom,societe,email,corps_etat,projet_id,dce_acces_id')
      .eq('id', at_st_id)
      .maybeSingle()
    if (stErr || !stData) {
      return NextResponse.json({ error: 'Sous-traitant introuvable' }, { status: 404 })
    }
    const st = stData as {
      id: string
      nom: string
      societe: string | null
      email: string | null
      corps_etat: string | null
      projet_id: string | null
      dce_acces_id: string | null
    }

    /* 2. Resolution de l'email : override > at_sous_traitants > dce_acces_st */
    let email = (emailOverride ?? st.email ?? '').trim().toLowerCase()
    if (!email && st.dce_acces_id) {
      const { data: accesData } = await supabase
        .from('dce_acces_st')
        .select('st_email,st_nom,st_societe')
        .eq('id', st.dce_acces_id)
        .maybeSingle()
      const acces = accesData as { st_email: string | null } | null
      if (acces?.st_email) email = acces.st_email.trim().toLowerCase()
    }
    if (!email) {
      return NextResponse.json({ error: 'Email du ST manquant — saisis-le dans la fiche.' }, { status: 400 })
    }

    /* Sauvegarde l'email dans at_sous_traitants si on l'a recu en override */
    if (emailOverride && emailOverride.trim().toLowerCase() !== (st.email ?? '').toLowerCase()) {
      await supabase.schema('app').from('at_sous_traitants').update({ email } as never).eq('id', st.id)
    }

    /* 3. Charge projet pour contexte email */
    let projetNom = ''
    let projetReference: string | null = null
    if (st.projet_id) {
      const { data: pData } = await supabase
        .schema('app')
        .from('projets')
        .select('nom,reference')
        .eq('id', st.projet_id)
        .maybeSingle()
      const p = pData as { nom: string; reference: string | null } | null
      if (p) { projetNom = p.nom; projetReference = p.reference }
    }

    /* 4. Identite */
    const fullName = (st.societe || st.nom || '').trim()
    const parts = (st.nom || '').trim().split(/\s+/).filter(Boolean)
    const prenom = parts[0] ?? 'ST'
    const nom    = parts.slice(1).join(' ') || (st.societe ?? 'Sous-traitant')

    /* 5. Resolution compte auth existant */
    let userId: string | null = null
    const rpcRes = await supabase.rpc('find_auth_user_id_by_email' as never, { p_email: email } as never)
    const rpcId = rpcRes.data as unknown as string | null
    if (rpcId && typeof rpcId === 'string' && rpcId.length > 0) userId = rpcId
    if (!userId) {
      const { data: existingApp } = await supabase
        .schema('app').from('utilisateurs').select('id').eq('email', email).maybeSingle()
      userId = (existingApp as { id: string } | null)?.id ?? null
    }
    if (!userId) {
      const { data: listData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 500 })
      const match = listData?.users?.find((u) => (u.email ?? '').toLowerCase() === email)
      if (match) userId = match.id
    }

    let password: string | null = null

    if (userId) {
      /* Compte existe : sync app.utilisateurs */
      await supabase
        .schema('app').from('utilisateurs').delete().eq('email', email).neq('id', userId)
      await supabase
        .schema('app').from('utilisateurs')
        .upsert(
          { id: userId, email, prenom, nom, role: 'st', actif: true, categorie: 'st' },
          { onConflict: 'id' },
        )
      if (force_regenerate) {
        password = generatePassword()
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
          },
          body: JSON.stringify({ password }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          return NextResponse.json({ error: `MaJ mot de passe : ${err?.message ?? res.status}` }, { status: 500 })
        }
      }
    } else {
      /* Cree nouveau compte */
      password = generatePassword()
      const { data: authData, error: authErr } = await adminCreateUser({
        email, password, email_confirm: true,
        user_metadata: { prenom, nom, role: 'st' },
      })
      if (authErr || !authData) {
        const msg = (authErr as any)?.message ?? (authErr as any)?.msg ?? 'Impossible de creer le compte'
        if (typeof msg === 'string' && msg.toLowerCase().includes('already')) {
          const { data: listData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
          const match = listData?.users?.find((u) => (u.email ?? '').toLowerCase() === email)
          if (match) userId = match.id
          else return NextResponse.json({ error: msg }, { status: 500 })
        } else {
          return NextResponse.json({ error: msg }, { status: 500 })
        }
      } else {
        userId = authData.user.id
      }

      if (userId) {
        await supabase
          .schema('app').from('utilisateurs')
          .upsert(
            { id: userId, email, prenom, nom, role: 'st', actif: true, categorie: 'st' },
            { onConflict: 'id' },
          )
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Compte non resolu' }, { status: 500 })
    }

    /* Force role/categorie/actif (au cas ou le trigger handle_new_oauth_user a inserer des defaults) */
    await supabase
      .schema('app').from('utilisateurs')
      .update({ role: 'st', categorie: 'st', actif: true, prenom, nom } as never)
      .eq('id', userId)

    /* 6. Lien dce_acces_st.user_id + force statut 'retenu' (donne acces au projet cote ST) */
    if (st.dce_acces_id) {
      await supabase.from('dce_acces_st')
        .update({ user_id: userId, statut: 'retenu' } as never)
        .eq('id', st.dce_acces_id)
    }

    /* 7. Construit le brouillon par defaut (utilise pour mode 'prepare') */
    const projetLabel = projetNom
      ? `${projetReference ? `[${projetReference}] ` : ''}${projetNom}`
      : 'votre projet'
    const defaultSubject = `Bienvenue sur API Projet — Acces a ${projetLabel}`

    const intro = custom_message?.trim()
      ? custom_message.trim()
      : `Bonjour ${fullName || 'cher partenaire'},\n\n` +
        `Vous avez ete retenu en tant que sous-traitant sur le projet ${projetLabel}` +
        (st.corps_etat ? ` (lot ${st.corps_etat})` : '') + `.\n\n` +
        `Votre compte vient d'etre cree sur la plateforme API Projet. ` +
        `Connectez-vous pour echanger les documents, suivre l'avancement, ` +
        `recevoir les ordres de service et communiquer avec l'equipe sur tout ce qui concerne ce projet.`

    const credsBlock = password
      ? `Vos identifiants :\n` +
        `  - Adresse de connexion : ${appUrl}/login\n` +
        `  - Email : ${email}\n` +
        `  - Mot de passe : ${password}\n\n` +
        `Vous pourrez modifier votre mot de passe apres la premiere connexion.`
      : `Vous avez deja un compte avec l'email ${email}. Connectez-vous sur ${appUrl}/login. ` +
        `Si vous avez oublie votre mot de passe, demandez sa reinitialisation depuis la page de connexion.`

    const defaultTextBody = `${intro}\n\n${credsBlock}\n\nA tres vite,\nL'equipe API Projet`

    /* Mode 'prepare' : on retourne le brouillon sans envoyer le mail */
    if (mode === 'prepare') {
      return NextResponse.json({
        success: true,
        prepared: true,
        user_id: userId,
        email,
        password,
        login_url: `${appUrl}/login`,
        suggested_subject: defaultSubject,
        suggested_body: defaultTextBody,
      })
    }

    /* Mode 'send' : envoie le mail (avec body fourni ou body par defaut) */
    const finalSubject = email_subject?.trim() || defaultSubject
    const finalText    = email_body?.trim() || defaultTextBody
    const finalHtml    = email_html?.trim() || textToHtml(finalText, appUrl)

    const resend = new Resend(resendKey!)
    const { error: sendError } = await resend.emails.send({
      from: `API Projet <${fromEmail!}>`,
      replyTo: fromEmail!,
      to: [email],
      subject: finalSubject,
      text: finalText,
      html: finalHtml,
    })
    if (sendError) {
      return NextResponse.json({
        success: true, user_id: userId, email, password,
        email_sent: false,
        warning: `Compte cree mais email non envoye : ${sendError.message}`,
      })
    }

    /* 8. Notification interne au ST (si compte) */
    if (userId) {
      await supabase.schema('app').from('alertes').insert({
        utilisateur_id: userId,
        projet_id:      st.projet_id,
        type:           'compte_cree',
        titre:          `Bienvenue sur ${projetLabel}`,
        message:        `Votre compte sous-traitant a ete cree. Consultez votre boite mail pour vos identifiants.`,
        priorite:       'normal',
        lue:            false,
      })
    }

    return NextResponse.json({
      success: true,
      user_id: userId,
      email,
      password,
      email_sent: true,
    })
  } catch (e: any) {
    console.error('[POST /api/at/onboard-st]', e)
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

/** Convertit le texte brut du mail en HTML simple (preserve les sauts de ligne, lien cliquable). */
function textToHtml(text: string, appUrl: string): string {
  const escaped = escapeHtml(text).replace(/\n/g, '<br/>')
  const linkified = escaped.replace(
    new RegExp(escapeHtml(appUrl).replace(/\//g, '\\/') + '\\/login', 'g'),
    `<a href="${appUrl}/login" style="color:#2563eb">${appUrl}/login</a>`,
  )
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1f2937;line-height:1.55;max-width:560px;font-size:14px;">${linkified}</div>`
}
