import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, prospection_id, st_id, updates } = body
    console.log('[valider-st] action:', action, 'st_id:', st_id, 'updates:', JSON.stringify(updates))
    const supabase = createAdminClient()

    if (action === 'valider') {
      // Mark as valide + set st_id
      const { error } = await supabase.schema('app').from('sts_prospection')
        .update({ statut: 'validé', st_id })
        .eq('id', prospection_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (action === 'ignorer') {
      const { error } = await supabase.schema('app').from('sts_prospection')
        .update({ statut: 'ignoré' })
        .eq('id', prospection_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (action === 'update_st') {
      const { error } = await supabase.schema('app').from('sous_traitants')
        .update(updates).eq('id', st_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (action === 'change_etape') {
      const lot_id = updates?.lot_id as string
      const projet_id = updates?.projet_id as string
      const statut = updates?.statut as string

      if (!lot_id || !st_id || !statut) {
        return NextResponse.json({ error: 'lot_id, st_id et statut requis' }, { status: 400 })
      }

      // Upsert: update if exists, create if not
      const { data: existing } = await supabase.schema('app').from('consultations_st')
        .select('id').eq('lot_id', lot_id).eq('st_id', st_id).limit(1).maybeSingle()

      if (existing) {
        const { error } = await supabase.schema('app').from('consultations_st')
          .update({ statut, updated_at: new Date().toISOString() }).eq('id', existing.id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      } else {
        const { error } = await supabase.schema('app').from('consultations_st')
          .insert({ projet_id, lot_id, st_id, statut, attribue: statut === 'attribue' })
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      }

      // If attribue, update the lot
      if (statut === 'attribue' || statut === 'retenu') {
        await supabase.schema('app').from('lots')
          .update({ st_retenu_id: st_id, statut: 'retenu' }).eq('id', lot_id)
      }

      return NextResponse.json({ success: true })
    }

    if (action === 'ensure_consultations') {
      // Batch create missing consultations
      const { lot_id, projet_id, st_ids } = updates ?? {}
      if (st_ids?.length && lot_id && projet_id) {
        const { data: existing } = await supabase.schema('app').from('consultations_st')
          .select('st_id').eq('lot_id', lot_id).in('st_id', st_ids)
        const existingSet = new Set((existing ?? []).map((c: { st_id: string }) => c.st_id))
        const missing = (st_ids as string[]).filter((id: string) => !existingSet.has(id))
        if (missing.length > 0) {
          await supabase.schema('app').from('consultations_st').insert(
            missing.map((stId: string) => ({ projet_id, lot_id, st_id: stId, statut: 'a_contacter', attribue: false }))
          )
        }
      }
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
  } catch (err) {
    console.error('[valider-st] FULL ERROR:', err instanceof Error ? err.message : err, err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur interne' }, { status: 500 })
  }
}
