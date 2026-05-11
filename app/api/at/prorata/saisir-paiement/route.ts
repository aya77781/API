import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Saisie manuelle d'un paiement prorata par l'AT (cheque, virement hors plateforme).
 * Si paiement_id fourni : marque cette facture comme payee + validee directement.
 * Sinon : cree une ligne paiement standalone (sans appel) pour ce ST.
 */
interface RequestBody {
  paiement_id?: string
  /** Cas creation directe : projet_id + st_id + montant_paye obligatoires */
  projet_id?: string
  st_id?: string
  montant_paye: number
  date_paiement?: string
  notes?: string
  recu_url?: string
}

export async function POST(req: NextRequest) {
  try {
    const { paiement_id, projet_id, st_id, montant_paye, date_paiement, notes, recu_url }: RequestBody = await req.json()
    if (montant_paye == null || montant_paye <= 0) {
      return NextResponse.json({ error: 'montant_paye invalide' }, { status: 400 })
    }
    const supabase = createAdminClient()
    const today = date_paiement ?? new Date().toISOString().split('T')[0]

    if (paiement_id) {
      // Maj d'une facture existante : marquer payee + validee
      const { error } = await supabase.schema('app').from('compte_prorata_paiements')
        .update({
          montant_paye, date_paiement: today,
          statut: 'valide', valide_at: new Date().toISOString(),
          notes: notes ?? null, recu_url: recu_url ?? null,
        } as never)
        .eq('id', paiement_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, paiement_id })
    }

    if (!projet_id || !st_id) {
      return NextResponse.json({ error: 'projet_id et st_id requis pour creation directe' }, { status: 400 })
    }

    const { data: inserted, error } = await supabase.schema('app').from('compte_prorata_paiements')
      .insert({
        projet_id, st_id,
        montant_du: montant_paye, montant_paye,
        date_emission: today, date_paiement: today,
        statut: 'valide', valide_at: new Date().toISOString(),
        notes: notes ?? 'Saisie manuelle AT', recu_url: recu_url ?? null,
      } as never)
      .select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, paiement_id: (inserted as { id: string }).id })
  } catch (e: any) {
    console.error('[POST /api/at/prorata/saisir-paiement]', e)
    return NextResponse.json({ error: e?.message ?? 'Erreur serveur' }, { status: 500 })
  }
}
