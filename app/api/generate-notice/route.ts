import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { notice_commerciale, type_chantier, surface_m2, corps_etat } = await req.json()

    if (!notice_commerciale) {
      return NextResponse.json({ error: 'notice_commerciale manquante' }, { status: 400 })
    }

    const message = await client.messages.create({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 1200,
      messages: [
        {
          role: 'user',
          content: `Tu es économiste de la construction spécialisé en CCTP.
Transforme cette notice commerciale en notice technique CCTP précise et opérationnelle.

Notice commerciale : ${notice_commerciale}
Corps d'état : ${corps_etat ?? 'Non précisé'}
Type de chantier : ${type_chantier ?? 'Non précisé'}
Surface : ${surface_m2 ? `${surface_m2} m²` : 'Non précisée'}

Règles :
- Utilise un langage technique professionnel (terminologie CCTP)
- Précise les normes applicables si pertinent (NF, DTU, etc.)
- Structure en paragraphes clairs : fournitures, mise en œuvre, finitions
- Inclus des prescriptions de performance mesurables
- Retourne uniquement la notice technique, sans introduction ni conclusion`,
        },
      ],
    })

    const text =
      message.content[0]?.type === 'text' ? message.content[0].text : ''

    return NextResponse.json({ notice_technique: text })
  } catch (err) {
    console.error('[generate-notice]', err)
    return NextResponse.json(
      { error: 'Erreur lors de la génération IA' },
      { status: 500 }
    )
  }
}
