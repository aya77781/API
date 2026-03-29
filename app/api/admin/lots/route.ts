import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function checkAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== 'admin') return null
  return { supabase, user }
}

// GET /api/admin/lots — tous les projets avec leurs lots
export async function GET() {
  const ctx = await checkAdmin()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { data, error } = await ctx.supabase
    .schema('app')
    .from('projets')
    .select('id, nom, reference, statut, lots(id, numero, corps_etat, statut, st_retenu_id)')
    .order('nom')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PATCH /api/admin/lots — assigner ou retirer un ST d'un lot
// body: { lot_id: string, st_id: string | null }
export async function PATCH(req: NextRequest) {
  const ctx = await checkAdmin()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const body = await req.json()
  const { lot_id, st_id } = body

  if (!lot_id) return NextResponse.json({ error: 'lot_id manquant' }, { status: 400 })

  const { error } = await ctx.supabase
    .schema('app')
    .from('lots')
    .update({ st_retenu_id: st_id ?? null })
    .eq('id', lot_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
