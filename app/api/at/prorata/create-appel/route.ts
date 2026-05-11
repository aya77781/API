import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface RequestBody {
  projet_id: string
  taux_appele: number          // % de la quote-part appele dans cet appel (ex: 50)
  taux_quote_part?: number     // % du contrat formant la quote-part (defaut 2)
  libelle: string
  delai_paiement_jours?: number // defaut 14 (= 2 semaines)
  date_appel?: string           // ISO date, defaut today
  notes?: string
  /** Si fourni : ne genere une facture QUE pour ce ST (appel individuel) */
  st_id?: string
  /** Si fourni : ne genere des factures QUE pour ces STs (selection multiple) */
  st_ids?: string[]
  /** Si fourni : utilise ces montants HT par ST (cas ou pas de contrat signe, fallback offre acceptee).
   *  Le serveur prefere contrat.montant_ht s'il existe, sinon utilise l'override. */
  st_overrides?: Array<{ st_id: string; montant_ht: number }>
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export async function POST(req: NextRequest) {
  try {
    const {
      projet_id, taux_appele, taux_quote_part = 2,
      libelle, delai_paiement_jours = 14, date_appel, notes,
      st_id, st_ids, st_overrides,
    }: RequestBody = await req.json()

    if (!projet_id)    return NextResponse.json({ error: 'projet_id manquant' }, { status: 400 })
    if (!libelle)      return NextResponse.json({ error: 'libelle manquant' }, { status: 400 })
    if (!taux_appele || taux_appele <= 0 || taux_appele > 100) {
      return NextResponse.json({ error: 'taux_appele invalide (1-100)' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const today = (date_appel ?? new Date().toISOString().split('T')[0])
    const dateEcheance = addDays(today, delai_paiement_jours)

    /* 1. Construit la liste des ST cibles avec leur montant base HT.
       Priorite : contrat.montant_ht > st_overrides.montant_ht (offre acceptee). */
    const stIdsFilter = st_ids && st_ids.length > 0 ? st_ids : (st_id ? [st_id] : null)
    const overridesMap = new Map<string, number>()
    ;(st_overrides ?? []).forEach((o) => {
      if (o.st_id && o.montant_ht > 0) overridesMap.set(o.st_id, Number(o.montant_ht))
    })

    const contratsQuery = supabase
      .schema('app').from('at_contrats')
      .select('id,st_id,numero,montant_ht,statut')
      .eq('projet_id', projet_id)
    const { data: contratsRaw, error: cErr } = stIdsFilter
      ? await contratsQuery.in('st_id', stIdsFilter)
      : await contratsQuery
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })

    const contratByStId = new Map<string, { id: string; st_id: string; montant_ht: number | null }>()
    ;(contratsRaw ?? []).forEach((c: any) => contratByStId.set(c.st_id, c))

    // Liste finale des cibles : tous les st_ids selectionnes (avec contrat ou override)
    type Cible = { st_id: string; contrat_id: string | null; montant_ht: number }
    const cibles: Cible[] = []
    const stIdsCibles = stIdsFilter ?? Array.from(new Set([
      ...Array.from(contratByStId.keys()),
      ...Array.from(overridesMap.keys()),
    ]))
    for (const stid of stIdsCibles) {
      const contrat = contratByStId.get(stid)
      const contratHt = Number(contrat?.montant_ht ?? 0)
      const override  = overridesMap.get(stid) ?? 0
      const montantHt = contratHt > 0 ? contratHt : override
      if (montantHt > 0) {
        cibles.push({ st_id: stid, contrat_id: contrat?.id ?? null, montant_ht: montantHt })
      }
    }
    if (cibles.length === 0) {
      return NextResponse.json({ error: 'Aucun ST cible avec montant HT (contrat ou offre)' }, { status: 400 })
    }

    /* 2. Compte le nombre d'appels existants pour numeroter */
    const { count: existingCount } = await supabase
      .schema('app').from('compte_prorata_appels')
      .select('id', { count: 'exact', head: true })
      .eq('projet_id', projet_id)
    const appelNumero = `APP-${String((existingCount ?? 0) + 1).padStart(3, '0')}`

    /* 3. Cree l'appel */
    const { data: appelData, error: appelErr } = await supabase
      .schema('app').from('compte_prorata_appels')
      .insert({
        projet_id,
        numero: appelNumero,
        libelle,
        taux_appele,
        taux_quote_part,
        date_appel: today,
        delai_paiement_jours,
        notes: notes ?? null,
      } as never)
      .select('id')
      .single()
    if (appelErr || !appelData) {
      return NextResponse.json({ error: `Creation appel : ${appelErr?.message}` }, { status: 500 })
    }
    const appelId = (appelData as { id: string }).id

    /* 4. Cree une facture (paiement a payer) par ST cible */
    const paiementsPayload = cibles.map((c, idx) => {
      const quotePart    = +(c.montant_ht * taux_quote_part / 100).toFixed(2)
      const montantDu    = +(quotePart * taux_appele / 100).toFixed(2)
      const factureNumero = `${appelNumero}-${String(idx + 1).padStart(3, '0')}`
      return {
        projet_id,
        st_id: c.st_id,
        contrat_id: c.contrat_id,
        appel_id: appelId,
        numero: factureNumero,
        montant_du: montantDu,
        montant_paye: 0,
        statut: 'non_paye',
        date_emission: today,
        date_echeance: dateEcheance,
      }
    })

    const { data: insertedPaiements, error: payErr } = await supabase
      .schema('app').from('compte_prorata_paiements')
      .insert(paiementsPayload as never)
      .select('id,st_id,montant_du,numero')
    if (payErr) {
      // Rollback de l'appel
      await supabase.schema('app').from('compte_prorata_appels').delete().eq('id', appelId)
      return NextResponse.json({ error: `Creation factures : ${payErr.message}` }, { status: 500 })
    }

    /* 5. Notifications aux STs (via user_id si lie a dce_acces_st) */
    if (insertedPaiements && insertedPaiements.length > 0) {
      const stIds = insertedPaiements.map((p: any) => p.st_id).filter(Boolean)
      const { data: stRows } = await supabase
        .schema('app').from('at_sous_traitants')
        .select('id,dce_acces_id,societe,nom')
        .in('id', stIds)

      const dceIds = (stRows ?? [])
        .map((s: any) => s.dce_acces_id)
        .filter((x: string | null): x is string => !!x)

      let userByDce = new Map<string, string>()
      if (dceIds.length > 0) {
        const { data: accesRows } = await supabase
          .from('dce_acces_st' as never)
          .select('id,user_id').in('id', dceIds)
        ;(accesRows as unknown as Array<{ id: string; user_id: string | null }>).forEach((a) => {
          if (a.user_id) userByDce.set(a.id, a.user_id)
        })
      }

      const stById = new Map<string, any>()
      ;(stRows ?? []).forEach((s: any) => stById.set(s.id, s))

      const alertes = insertedPaiements
        .map((p: any) => {
          const st = stById.get(p.st_id)
          if (!st?.dce_acces_id) return null
          const userId = userByDce.get(st.dce_acces_id)
          if (!userId) return null
          return {
            utilisateur_id: userId,
            projet_id,
            type: 'prorata_appel',
            titre: `Appel de fonds compte prorata — ${appelNumero}`,
            message: `Facture ${p.numero} : ${Number(p.montant_du).toLocaleString('fr-FR')} EUR a regler avant le ${dateEcheance}. ` +
                     `Connectez-vous a la plateforme pour deposer votre recu.`,
            priorite: 'normal',
            lue: false,
          }
        })
        .filter(Boolean)

      if (alertes.length > 0) {
        await supabase.schema('app').from('alertes').insert(alertes as never)
      }
    }

    return NextResponse.json({
      success: true,
      appel_id: appelId,
      appel_numero: appelNumero,
      nb_factures: insertedPaiements?.length ?? 0,
      date_echeance: dateEcheance,
    })
  } catch (e: any) {
    console.error('[POST /api/at/prorata/create-appel]', e)
    return NextResponse.json({ error: e?.message ?? 'Erreur serveur' }, { status: 500 })
  }
}
