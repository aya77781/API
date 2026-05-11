import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface RequestBody {
  paiement_id: string
  action: 'valider' | 'refuser'
  motif?: string
  /** Si fourni : montant effectivement paye (peut differer du du). */
  montant_paye?: number
}

export async function POST(req: NextRequest) {
  try {
    const { paiement_id, action, motif, montant_paye }: RequestBody = await req.json()
    if (!paiement_id) return NextResponse.json({ error: 'paiement_id manquant' }, { status: 400 })
    if (action !== 'valider' && action !== 'refuser') {
      return NextResponse.json({ error: 'action invalide' }, { status: 400 })
    }

    const supabase = createAdminClient()

    /* 1. Charge la facture */
    const { data: pData } = await supabase
      .schema('app').from('compte_prorata_paiements')
      .select('id,projet_id,st_id,numero,montant_du,statut,recu_url')
      .eq('id', paiement_id)
      .maybeSingle()
    if (!pData) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
    const p = pData as {
      id: string; projet_id: string | null; st_id: string | null
      numero: string | null; montant_du: number | null; statut: string; recu_url: string | null
    }

    /* 2. Update statut */
    const patch: Record<string, unknown> = action === 'valider'
      ? {
          statut: 'valide',
          valide_at: new Date().toISOString(),
          date_paiement: new Date().toISOString().split('T')[0],
          montant_paye: montant_paye ?? p.montant_du,
        }
      : {
          statut: 'refuse',
          notes: motif ? `Refus : ${motif}` : 'Refus AT',
          valide_at: null,
        }

    const { error: updErr } = await supabase
      .schema('app').from('compte_prorata_paiements')
      .update(patch as never)
      .eq('id', paiement_id)
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

    /* 3. Notifie le ST */
    if (p.st_id) {
      const { data: stRow } = await supabase
        .schema('app').from('at_sous_traitants')
        .select('dce_acces_id').eq('id', p.st_id).maybeSingle()
      const dceId = (stRow as { dce_acces_id: string | null } | null)?.dce_acces_id
      if (dceId) {
        const { data: accesRow } = await supabase
          .from('dce_acces_st' as never).select('user_id').eq('id', dceId).maybeSingle()
        const userId = (accesRow as unknown as { user_id: string | null } | null)?.user_id
        if (userId) {
          await supabase.schema('app').from('alertes').insert({
            utilisateur_id: userId,
            projet_id:      p.projet_id,
            type:           action === 'valider' ? 'prorata_valide' : 'prorata_refuse',
            titre:          action === 'valider'
                              ? `Paiement prorata valide — ${p.numero}`
                              : `Recu prorata refuse — ${p.numero}`,
            message:        action === 'valider'
                              ? `Votre paiement de la facture ${p.numero} a ete valide par l'AT.`
                              : `Votre recu pour la facture ${p.numero} a ete refuse${motif ? ` : ${motif}` : ''}. Merci de redeposer un justificatif conforme.`,
            priorite:       action === 'valider' ? 'normal' : 'high',
            lue:            false,
          })
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[POST /api/at/prorata/valider-recu]', e)
    return NextResponse.json({ error: e?.message ?? 'Erreur serveur' }, { status: 500 })
  }
}
