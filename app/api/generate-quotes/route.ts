import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) return NextResponse.json({ error: 'OPENAI_API_KEY non configurée' }, { status: 500 })

    const { contexte } = await req.json()
    if (!contexte || typeof contexte !== 'string') {
      return NextResponse.json({ error: 'Contexte requis' }, { status: 400 })
    }

    const today = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.8,
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Contexte du jour dans une entreprise de BTP/architecture : "${contexte}" (date : ${today}).

Donne-moi exactement 3 citations RÉELLES et VÉRIFIABLES parmi cette liste de sources fiables :
- Proverbes connus (arabes, chinois, africains, français, japonais...)
- Versets ou sagesses religieuses (Coran, Bible, Torah, Bouddha, proverbes soufis...)
- Citations ultra-célèbres et universellement reconnues (Nelson Mandela, Gandhi, Martin Luther King, Steve Jobs, Albert Einstein, Confucius, Victor Hugo, Antoine de Saint-Exupéry, Mère Teresa, Winston Churchill, Lao Tseu...)
- Dictons populaires français

RÈGLES ABSOLUES :
1. NE JAMAIS inventer une citation. Si tu n'es pas SÛR À 100% qu'elle est réelle, ne la propose pas.
2. Préfère les proverbes et dictons (impossible à halluciner) aux citations d'auteurs précis.
3. Si tu attribues une citation à quelqu'un, ce doit être une citation ICONIQUE de cette personne, pas une phrase obscure.
4. Chaque citation en français.
5. Adapte le choix au contexte donné.

Format JSON uniquement :
[{"texte": "...", "auteur": "Proverbe arabe"}, {"texte": "...", "auteur": "Prénom Nom"}, {"texte": "...", "auteur": "Proverbe français"}]`,
        }],
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[generate-quotes] OpenAI error:', text)
      return NextResponse.json({ error: `Erreur OpenAI (${res.status})` }, { status: 502 })
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content ?? ''
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Réponse IA invalide' }, { status: 500 })
    }
    const quotes = JSON.parse(jsonMatch[0])
    return NextResponse.json({ quotes })
  } catch (err) {
    console.error('[generate-quotes]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur interne' },
      { status: 500 },
    )
  }
}
