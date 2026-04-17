import { NextRequest, NextResponse } from 'next/server'
import { adminCreateUser, createAdminClient } from '@/lib/supabase/admin'

function generatePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz'
  let s = ''
  for (let i = 0; i < 10; i++) s += chars.charAt(Math.floor(Math.random() * chars.length))
  return s
}

/**
 * POST /api/st/create-from-dce
 * Body: { acces_id: string }
 *
 * Convertit un ST externe (lien public/code DCE) en utilisateur app :
 * - crée (ou réutilise) un compte auth avec son email
 * - ajoute la ligne app.utilisateurs (role=st, categorie=st)
 * - relie dce_acces_st.user_id au compte
 * Retourne { email, password } pour que l'économiste les transmette au ST.
 */
export async function POST(req: NextRequest) {
  try {
    const { acces_id, force_regenerate } = await req.json()
    if (!acces_id) {
      return NextResponse.json({ error: 'acces_id manquant' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 1. Charge la ligne dce_acces_st
    const { data: accesData, error: accesErr } = await supabase
      .from('dce_acces_st')
      .select('id, user_id, st_nom, st_societe, st_email, type_acces')
      .eq('id', acces_id)
      .maybeSingle()

    if (accesErr || !accesData) {
      return NextResponse.json({ error: 'Invitation introuvable' }, { status: 404 })
    }
    const acces = accesData as {
      id: string
      user_id: string | null
      st_nom: string | null
      st_societe: string | null
      st_email: string | null
      type_acces: 'externe' | 'interne'
    }

    // ST interne : accès via son compte API, pas de mot de passe à générer.
    if (acces.type_acces === 'interne') {
      return NextResponse.json({ success: true, already_linked: true })
    }

    const email = (acces.st_email ?? '').trim().toLowerCase()
    if (!email) {
      return NextResponse.json({ error: 'Email du ST manquant — demandez au ST de compléter son identité.' }, { status: 400 })
    }

    // Déduit prenom/nom à partir de st_nom (best effort)
    const fullName = (acces.st_nom ?? '').trim()
    const parts = fullName.split(/\s+/).filter(Boolean)
    const prenom = parts[0] ?? 'ST'
    const nom = parts.slice(1).join(' ') || (acces.st_societe ?? 'Sous-traitant')

    // 2. Resolution du compte auth : priorite a la RPC auth.users (source de vérité)
    //    puis fallback sur app.utilisateurs (cas legacy).
    let userId: string | null = null
    const rpcRes = await supabase.rpc('find_auth_user_id_by_email' as never, { p_email: email } as never)
    const rpcId = rpcRes.data as unknown as string | null
    if (rpcId && typeof rpcId === 'string' && rpcId.length > 0) {
      userId = rpcId
    }
    if (!userId) {
      const { data: existingApp } = await supabase
        .schema('app')
        .from('utilisateurs')
        .select('id')
        .eq('email', email)
        .maybeSingle()
      userId = (existingApp as { id: string } | null)?.id ?? null
    }
    if (!userId) {
      // Filet de secours via listUsers (pagination simple)
      const { data: listData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 500 })
      const match = listData?.users?.find((u) => (u.email ?? '').toLowerCase() === email)
      if (match) userId = match.id
    }

    // Si on a trouve un auth.users mais qu'une ligne app.utilisateurs stale existe
    // avec le meme email mais un autre id, on supprime l'orpheline avant le sync.
    if (userId) {
      await supabase
        .schema('app')
        .from('utilisateurs')
        .delete()
        .eq('email', email)
        .neq('id', userId)
      // Puis synchronise la ligne app.utilisateurs (cree si manquante)
      await supabase
        .schema('app')
        .from('utilisateurs')
        .upsert(
          { id: userId, email, prenom, nom, role: 'st', actif: true, categorie: 'st' },
          { onConflict: 'id' },
        )
    }

    let password: string | null = null

    if (userId) {
      // Compte existant : on NE regenere PAS le mot de passe par defaut pour
      // eviter qu'une re-ouverture de la modale n'invalide les identifiants deja envoyes.
      if (force_regenerate) {
        password = generatePassword()
        const { error: pwdErr } = await supabase.auth.admin.updateUserById(userId, { password })
        if (pwdErr) {
          return NextResponse.json({ error: `Réinitialisation mdp : ${pwdErr.message}` }, { status: 500 })
        }
      }
    } else {
      // 3. Crée un nouveau compte auth avec password aléatoire
      password = generatePassword()
      const { data: authData, error: authErr } = await adminCreateUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { prenom, nom, role: 'st' },
      })
      if (authErr || !authData) {
        const msg = (authErr as any)?.message ?? (authErr as any)?.msg ?? 'Impossible de créer le compte'
        // Dernier recours : le compte a été créé entre-temps par un autre process
        if (typeof msg === 'string' && msg.toLowerCase().includes('already')) {
          const { data: listData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
          const match = listData?.users?.find((u) => (u.email ?? '').toLowerCase() === email)
          if (match) {
            userId = match.id
          } else {
            return NextResponse.json({ error: msg }, { status: 500 })
          }
        } else {
          return NextResponse.json({ error: msg }, { status: 500 })
        }
      } else {
        userId = authData.user.id
      }

      if (userId) {
        const { error: dbErr } = await supabase
          .schema('app')
          .from('utilisateurs')
          .upsert(
            { id: userId, email, prenom, nom, role: 'st', actif: true, categorie: 'st' },
            { onConflict: 'id' },
          )
        if (dbErr) {
          return NextResponse.json({ error: `Création profil : ${dbErr.message}` }, { status: 500 })
        }
      }
    }

    // 4. Force le profil app.utilisateurs en role='st'/categorie='st'/actif=true.
    // Le trigger handle_new_oauth_user peut inserer avec des valeurs par defaut
    // (categorie='interne', actif=false) — on impose les bonnes valeurs ici.
    if (userId) {
      await supabase
        .schema('app')
        .from('utilisateurs')
        .update({ role: 'st', categorie: 'st', actif: true, prenom, nom } as never)
        .eq('id', userId)
    }

    // 5. Relie l'invitation au compte (conserve type_acces='externe' pour la trace historique)
    const { error: linkErr } = await supabase
      .from('dce_acces_st')
      .update({ user_id: userId } as never)
      .eq('id', acces.id)
    if (linkErr) {
      return NextResponse.json({ error: `Lien invitation : ${linkErr.message}` }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      user_id: userId,
      email,
      password,                      // null si compte existait deja sans force_regenerate
      already_linked: !password && !!userId,
    })
  } catch (e: any) {
    console.error('[POST /api/st/create-from-dce]', e)
    return NextResponse.json({ error: e?.message ?? 'Erreur serveur' }, { status: 500 })
  }
}
