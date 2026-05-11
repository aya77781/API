import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const SYSTEM_PROMPT = `Tu es un juriste specialise dans les contrats de sous-traitance BTP en France.
Tu rediges UNIQUEMENT du contenu juridique professionnel, conforme a la loi du 31 decembre 1975 (n° 75-1334)
sur la sous-traitance, au Code de la commande publique et au Code civil.

Tu produis des clauses contractuelles claires, equilibrees, en francais juridique professionnel mais lisible.
Tu retournes STRICTEMENT un JSON valide, sans markdown, sans backticks, sans texte avant ou apres.

Format de sortie attendu :
{
  "description_mission": "string detaillant la mission du sous-traitant sur ce lot",
  "clauses": [
    { "titre": "string court (3-8 mots)", "contenu": "string clause complete" },
    ...
  ]
}

Genere obligatoirement les clauses suivantes :
1. Obligations du Sous-traitant (executions des travaux dans les regles de l'art, planning, qualite)
2. Obligations de l'Entrepreneur principal (paiement, fourniture des plans, acces au chantier)
3. Reception des travaux (modalites de PV de reception, levee des reserves)
4. Assurances et responsabilites (RC Pro, decennale obligatoires)
5. Penalites de retard (taux journalier, plafond)
6. Resiliation (motifs, preavis, indemnites)
7. Confidentialite et propriete intellectuelle
8. Litiges et droit applicable (tribunal de commerce, droit francais)

Chaque clause doit faire entre 3 et 8 phrases. Ton professionnel, neutre, juridique.`

interface RequestBody {
  contrat_id: string
}

export async function POST(req: NextRequest) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY non configuree' }, { status: 500 })
  }

  try {
    const { contrat_id }: RequestBody = await req.json()
    if (!contrat_id) return NextResponse.json({ error: 'contrat_id manquant' }, { status: 400 })

    const supabase = createAdminClient()

    /* 1. Charge le contrat + ST + projet + lot */
    const { data: contratData, error: cErr } = await supabase
      .schema('app').from('at_contrats')
      .select('id,projet_id,st_id,numero,montant_ht,cgv_incluses,delegation_paiement,second_rang,notes')
      .eq('id', contrat_id).maybeSingle()
    if (cErr || !contratData) {
      return NextResponse.json({ error: 'Contrat introuvable' }, { status: 404 })
    }
    const c = contratData as {
      id: string; projet_id: string | null; st_id: string; numero: string | null
      montant_ht: number | null; cgv_incluses: boolean; delegation_paiement: boolean
      second_rang: boolean; notes: string | null
    }

    const [stRes, projetRes] = await Promise.all([
      supabase.schema('app').from('at_sous_traitants')
        .select('nom,societe,corps_etat,siret,email,telephone,dce_acces_id')
        .eq('id', c.st_id).maybeSingle(),
      c.projet_id
        ? supabase.schema('app').from('projets')
            .select('nom,reference,adresse,type_chantier').eq('id', c.projet_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ])
    const st = stRes.data as {
      nom: string; societe: string | null; corps_etat: string | null
      siret: string | null; email: string | null; telephone: string | null
      dce_acces_id: string | null
    } | null
    const projet = projetRes.data as {
      nom: string; reference: string | null; adresse: string | null; type_chantier: string | null
    } | null

    /* 2. Recupere lot via dce_acces_st si possible */
    let lotNom: string | null = null
    if (st?.dce_acces_id) {
      const { data: dceData } = await supabase
        .from('dce_acces_st' as never)
        .select('lot_id').eq('id', st.dce_acces_id).maybeSingle()
      const lotId = (dceData as unknown as { lot_id: string | null } | null)?.lot_id
      if (lotId) {
        const { data: lotData } = await supabase
          .from('lots' as never).select('nom').eq('id', lotId).maybeSingle()
        lotNom = (lotData as unknown as { nom: string } | null)?.nom ?? null
      }
    }

    /* 3. Prompt utilisateur */
    const userMessage = `Genere les clauses pour un contrat de sous-traitance avec ces informations :

PROJET :
- Nom : ${projet?.nom ?? '—'}
- Reference : ${projet?.reference ?? '—'}
- Adresse : ${projet?.adresse ?? '—'}
- Type : ${projet?.type_chantier ?? '—'}

SOUS-TRAITANT :
- Raison sociale : ${st?.societe || st?.nom || '—'}
- Corps d'etat : ${st?.corps_etat ?? '—'}
- SIRET : ${st?.siret ?? '—'}

MISSION :
- Lot : ${lotNom ?? '—'}
- Corps d'etat : ${st?.corps_etat ?? '—'}

CONDITIONS :
- Montant HT : ${c.montant_ht?.toLocaleString('fr-FR') ?? '—'} EUR
- CGV incluses : ${c.cgv_incluses ? 'oui' : 'non'}
- Delegation de paiement : ${c.delegation_paiement ? 'oui' : 'non'}
- Sous-traitance second rang : ${c.second_rang ? 'autorisee' : 'non autorisee'}

${c.notes ? `NOTES PARTICULIERES :\n${c.notes}` : ''}

Genere une description de mission specifique au corps d'etat et au lot, puis les 8 clauses contractuelles
standardisees comme demande dans tes instructions systeme.`

    /* 4. Appel Claude */
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })
    if (!claudeRes.ok) {
      const err = await claudeRes.json().catch(() => ({}))
      console.error('[contrat generate-content] Claude error:', err)
      return NextResponse.json({ error: 'Erreur generation IA' }, { status: 502 })
    }
    const claudeData = await claudeRes.json()
    const rawText = claudeData.content?.[0]?.type === 'text' ? claudeData.content[0].text : ''

    /* 5. Parse JSON */
    let parsed: { description_mission: string; clauses: Array<{ titre: string; contenu: string }> } | null = null
    try {
      // Trim eventuels backticks markdown
      const cleaned = rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')
      parsed = JSON.parse(cleaned)
    } catch (e) {
      console.error('[contrat generate-content] JSON parse error:', e, '\nRaw:', rawText)
      return NextResponse.json({ error: 'Reponse IA mal formee' }, { status: 502 })
    }
    if (!parsed?.description_mission || !Array.isArray(parsed.clauses)) {
      return NextResponse.json({ error: 'Reponse IA incomplete' }, { status: 502 })
    }

    return NextResponse.json({
      success: true,
      description_mission: parsed.description_mission,
      clauses: parsed.clauses,
      meta: {
        projet_nom: projet?.nom,
        st_societe: st?.societe || st?.nom,
        lot_nom: lotNom,
      },
    })
  } catch (e: any) {
    console.error('[POST /api/at/contrats/generate-content]', e)
    return NextResponse.json({ error: e?.message ?? 'Erreur serveur' }, { status: 500 })
  }
}
