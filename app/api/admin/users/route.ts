import { NextRequest, NextResponse } from 'next/server'
import { adminCreateUser, adminDeleteUser, adminUpdateUser } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

async function checkAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== 'admin') return null
  return { supabase, user }
}

// GET /api/admin/users
export async function GET() {
  const ctx = await checkAdmin()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { data, error } = await ctx.supabase
    .schema('app')
    .from('utilisateurs')
    .select('id, email, nom, prenom, role, actif, categorie, created_at')
    .order('categorie')
    .order('nom')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/admin/users
export async function POST(req: NextRequest) {
  try {
    const ctx = await checkAdmin()
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const body = await req.json()
    const { email, password, prenom, nom, role, categorie } = body

    if (!email || !password || !prenom || !nom || !role || !categorie) {
      return NextResponse.json({ error: 'Champs manquants' }, { status: 400 })
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquante dans .env.local' }, { status: 500 })
    }

    const { data: authData, error: authError } = await adminCreateUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { prenom, nom, role },
    })

    if (authError || !authData) {
      const msg = (authError as any)?.msg ?? (authError as any)?.message ?? JSON.stringify(authError)
      return NextResponse.json({ error: `Auth error: ${msg}` }, { status: 400 })
    }

    const { error: dbError } = await ctx.supabase
      .schema('app')
      .from('utilisateurs')
      .upsert(
        { id: authData.user.id, email, prenom, nom, role, actif: true, categorie },
        { onConflict: 'id' }
      )

    if (dbError) {
      await adminDeleteUser(authData.user.id)
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    return NextResponse.json({ id: authData.user.id })
  } catch (e: any) {
    console.error('[POST /api/admin/users]', e)
    return NextResponse.json({ error: e?.message ?? 'Erreur serveur inattendue' }, { status: 500 })
  }
}

// PATCH /api/admin/users
export async function PATCH(req: NextRequest) {
  const ctx = await checkAdmin()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 })

  const dbUpdates: Record<string, unknown> = {}
  if ('actif'     in updates) dbUpdates.actif     = updates.actif
  if ('role'      in updates) dbUpdates.role       = updates.role
  if ('prenom'    in updates) dbUpdates.prenom     = updates.prenom
  if ('nom'       in updates) dbUpdates.nom        = updates.nom
  if ('categorie' in updates) dbUpdates.categorie  = updates.categorie

  const { error: dbError } = await ctx.supabase
    .schema('app')
    .from('utilisateurs')
    .update(dbUpdates)
    .eq('id', id)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  if (updates.role && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    await adminUpdateUser(id, { user_metadata: { role: updates.role } })
  }

  return NextResponse.json({ success: true })
}

// DELETE /api/admin/users
export async function DELETE(req: NextRequest) {
  try {
    const ctx = await checkAdmin()
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 })

    // Nullify all FK references before deleting
    await Promise.all([
      ctx.supabase.schema('app').from('projets').update({ co_id: null }).eq('co_id', id),
      ctx.supabase.schema('app').from('projets').update({ commercial_id: null }).eq('commercial_id', id),
      ctx.supabase.schema('app').from('projets').update({ economiste_id: null }).eq('economiste_id', id),
    ])

    const { error: dbError } = await ctx.supabase
      .schema('app')
      .from('utilisateurs')
      .delete()
      .eq('id', id)

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      await adminDeleteUser(id)
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[DELETE /api/admin/users]', e)
    return NextResponse.json({ error: e?.message ?? 'Erreur serveur' }, { status: 500 })
  }
}
