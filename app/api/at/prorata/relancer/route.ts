import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface RequestBody {
  st_id: string
  projet_id: string
  message?: string
}

export async function POST(req: NextRequest) {
  try {
    const { st_id, projet_id, message }: RequestBody = await req.json()
    if (!st_id || !projet_id) return NextResponse.json({ error: 'parametres manquants' }, { status: 400 })

    const supabase = createAdminClient()

    // Recupere les factures en retard ou en attente pour ce ST
    const today = new Date().toISOString().split('T')[0]
    const { data: factures } = await supabase
      .schema('app').from('compte_prorata_paiements')
      .select('id,numero,montant_du,date_echeance,statut')
      .eq('projet_id', projet_id)
      .eq('st_id', st_id)
      .neq('statut', 'valide')

    const list = (factures ?? []) as Array<{
      id: string; numero: string | null; montant_du: number | null
      date_echeance: string | null; statut: string
    }>
    const enRetard = list.filter((f) => f.date_echeance && f.date_echeance < today)
    if (list.length === 0) {
      return NextResponse.json({ error: 'Aucune facture en attente pour ce ST' }, { status: 400 })
    }

    // Trouve le user_id du ST
    const { data: stRow } = await supabase
      .schema('app').from('at_sous_traitants')
      .select('dce_acces_id,societe,nom').eq('id', st_id).maybeSingle()
    const dceId = (stRow as { dce_acces_id: string | null } | null)?.dce_acces_id
    let userId: string | null = null
    if (dceId) {
      const { data: accesRow } = await supabase.from('dce_acces_st' as never)
        .select('user_id').eq('id', dceId).maybeSingle()
      userId = (accesRow as unknown as { user_id: string | null } | null)?.user_id ?? null
    }
    if (!userId) {
      return NextResponse.json({ error: 'Le ST n\'a pas encore de compte plateforme' }, { status: 400 })
    }

    const totalDu = list.reduce((s, f) => s + (Number(f.montant_du) || 0), 0)
    const refs = list.map((f) => f.numero ?? f.id.slice(0, 6)).join(', ')

    const finalMsg = message?.trim()
      || (enRetard.length > 0
            ? `Relance prorata : ${enRetard.length} facture(s) en retard. ` +
              `Total a regler : ${totalDu.toLocaleString('fr-FR')} EUR (${refs}). ` +
              `Merci de deposer votre justificatif au plus vite.`
            : `Rappel : ${list.length} facture(s) prorata en attente. ` +
              `Total : ${totalDu.toLocaleString('fr-FR')} EUR (${refs}).`)

    const { error: alertErr } = await supabase.schema('app').from('alertes').insert({
      utilisateur_id: userId,
      projet_id,
      type:    enRetard.length > 0 ? 'prorata_retard' : 'prorata_rappel',
      titre:   enRetard.length > 0 ? 'Paiement prorata en retard' : 'Rappel paiement prorata',
      message: finalMsg,
      priorite: enRetard.length > 0 ? 'high' : 'normal',
      lue:     false,
    })
    if (alertErr) return NextResponse.json({ error: alertErr.message }, { status: 500 })

    return NextResponse.json({
      success: true,
      nb_factures_en_retard: enRetard.length,
      nb_factures_attente:   list.length,
      total_du: totalDu,
    })
  } catch (e: any) {
    console.error('[POST /api/at/prorata/relancer]', e)
    return NextResponse.json({ error: e?.message ?? 'Erreur serveur' }, { status: 500 })
  }
}
