import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

interface LotInput {
  id: string
  corps_etat: string
  budget_prevu: number | null
}

export async function POST(req: Request) {
  try {
    const { projet_id, lots, date_debut_projet, date_fin_projet } = await req.json() as {
      projet_id: string
      lots: LotInput[]
      date_debut_projet: string
      date_fin_projet: string
    }

    if (!lots?.length) {
      return NextResponse.json({ error: 'Aucun lot fourni' }, { status: 400 })
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const prompt = `Tu es expert en planification de chantier.
Genere un planning realiste en jours pour ces lots, dans l'ordre logique des corps d'etat.

Lots: ${JSON.stringify(lots.map(l => ({ corps_etat: l.corps_etat, budget: l.budget_prevu })))}
Date debut projet: ${date_debut_projet}
Date fin projet: ${date_fin_projet}

Retourne UNIQUEMENT un JSON valide (pas de texte avant/apres, pas de markdown):
[{ "corps_etat": "...", "duree_jours": 10, "ordre": 1, "couleur_hex": "#3b82f6" }]

Ordre standard du batiment:
Demolition -> Maconnerie -> Electricite/Plomberie (en parallele) -> Faux-plafonds -> Peinture -> Finitions

Respecte ces regles:
- Ordre logique du batiment
- duree_jours coherente avec le budget (plus eleve = plus long)
- couleur_hex differente par corps d'etat
- Lots paralleles (electricite/plomberie) ont le meme "ordre"`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = message.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'Reponse IA invalide' }, { status: 500 })
    }

    const text = textBlock.text
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Pas de JSON dans la reponse IA', raw: text }, { status: 500 })
    }

    const proposed = JSON.parse(jsonMatch[0]) as Array<{
      corps_etat: string
      duree_jours: number
      ordre: number
      couleur_hex: string
    }>

    // Calcul des dates : on enchaine selon l'ordre, lots de meme "ordre" en parallele
    proposed.sort((a, b) => a.ordre - b.ordre)
    const startDate = new Date(date_debut_projet)
    const interventions: Array<{
      corps_etat: string
      date_debut: string
      date_fin: string
      couleur: string
      ordre: number
    }> = []

    let cursor = new Date(startDate)
    let currentOrdre = -1
    let groupStart = new Date(startDate)
    let groupMaxDuree = 0

    for (const p of proposed) {
      if (p.ordre !== currentOrdre) {
        // Nouveau groupe : avance le curseur
        cursor = new Date(groupStart.getTime() + groupMaxDuree * 86400000)
        groupStart = new Date(cursor)
        groupMaxDuree = p.duree_jours
        currentOrdre = p.ordre
      } else {
        groupMaxDuree = Math.max(groupMaxDuree, p.duree_jours)
      }

      const debut = new Date(groupStart)
      const fin = new Date(groupStart.getTime() + p.duree_jours * 86400000)

      interventions.push({
        corps_etat: p.corps_etat,
        date_debut: debut.toISOString().split('T')[0],
        date_fin: fin.toISOString().split('T')[0],
        couleur: p.couleur_hex,
        ordre: p.ordre,
      })
    }

    return NextResponse.json({ projet_id, interventions })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
