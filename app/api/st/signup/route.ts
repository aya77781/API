import { NextRequest, NextResponse } from 'next/server'
import { adminCreateUser, adminDeleteUser, createAdminClient } from '@/lib/supabase/admin'

// POST /api/st/signup
// Crée un compte ST + attribue les lots sélectionnés
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password, prenom, nom, lot_ids } = body

    if (!email || !password || !prenom || !nom) {
      return NextResponse.json({ error: 'Champs manquants' }, { status: 400 })
    }
    if (!Array.isArray(lot_ids) || lot_ids.length === 0) {
      return NextResponse.json({ error: 'Sélectionnez au moins un lot.' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 6 caractères.' }, { status: 400 })
    }

    // 1. Créer le compte auth
    const { data: authData, error: authError } = await adminCreateUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { prenom, nom, role: 'st' },
    })

    if (authError || !authData) {
      const msg = (authError as any)?.message ?? (authError as any)?.msg ?? 'Erreur lors de la création du compte'
      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already been registered')) {
        return NextResponse.json({ error: 'Un compte existe déjà avec cet email.' }, { status: 400 })
      }
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const userId = authData.user.id
    const supabase = createAdminClient()

    // 2. Insérer dans utilisateurs
    const { error: dbError } = await supabase
      .schema('app')
      .from('utilisateurs')
      .upsert(
        { id: userId, email, prenom, nom, role: 'st', actif: true, categorie: 'st' },
        { onConflict: 'id' }
      )

    if (dbError) {
      await adminDeleteUser(userId)
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    // 3. Attribuer les lots (seulement ceux encore disponibles)
    const { data: lotsDispos, error: lotsCheckError } = await supabase
      .schema('app')
      .from('lots')
      .select('id')
      .in('id', lot_ids)
      .is('st_retenu_id', null)

    if (lotsCheckError) {
      await adminDeleteUser(userId)
      return NextResponse.json({ error: lotsCheckError.message }, { status: 500 })
    }

    const idsDispos = (lotsDispos ?? []).map((l: any) => l.id)
    if (idsDispos.length === 0) {
      await adminDeleteUser(userId)
      return NextResponse.json({ error: 'Les lots sélectionnés ne sont plus disponibles.' }, { status: 409 })
    }

    const { error: updateError } = await supabase
      .schema('app')
      .from('lots')
      .update({ st_retenu_id: userId })
      .in('id', idsDispos)

    if (updateError) {
      await adminDeleteUser(userId)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, lots_attribues: idsDispos.length })
  } catch (e: any) {
    console.error('[POST /api/st/signup]', e)
    return NextResponse.json({ error: e?.message ?? 'Erreur serveur inattendue' }, { status: 500 })
  }
}
