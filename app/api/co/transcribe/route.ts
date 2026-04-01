import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 120

const SYSTEM_PROMPT = `Tu es un assistant spécialisé dans la rédaction de comptes rendus de réunion de chantier
en français. Tu rédiges des CR clairs, professionnels et structurés.

Structure attendue :
1. En-tête : projet, date, participants
2. Ordre du jour
3. Points abordés par sujet (avec ST responsable si mentionné)
4. Décisions prises
5. Actions à mener (avec responsable et délai si précisé)
6. Prochaine réunion si mentionnée

Règles :
- Reformule sans déformer
- Identifie les engagements pris par chaque ST
- Met en avant les points bloquants
- Ton factuel et professionnel`

export async function POST(req: NextRequest) {
  const openaiKey = process.env.OPENAI_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  if (!openaiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY non configurée' }, { status: 500 })
  }

  try {
    /* ── Parse FormData ── */
    const formData = await req.formData()
    const audioFile = formData.get('audio') as File | null
    const transcriptionOnly = formData.get('transcription_only') === 'true'
    const ordreJour = (formData.get('ordre_du_jour') as string) ?? ''
    const participantsRaw = (formData.get('participants') as string) ?? '[]'
    const projetId = (formData.get('projet_id') as string) ?? ''

    if (!audioFile) {
      return NextResponse.json({ error: 'Fichier audio manquant' }, { status: 400 })
    }

    let participants: string[] = []
    try { participants = JSON.parse(participantsRaw) } catch { /* ignore */ }

    /* ── Étape 1 : Transcription via Whisper ── */
    const whisperForm = new FormData()
    whisperForm.append('file', audioFile, audioFile.name || 'reunion.webm')
    whisperForm.append('model', 'whisper-1')
    whisperForm.append('language', 'fr')
    whisperForm.append('response_format', 'text')

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: whisperForm,
    })

    if (!whisperRes.ok) {
      const err = await whisperRes.json().catch(() => ({}))
      console.error('[transcribe] Whisper error:', err)
      return NextResponse.json(
        { error: err?.error?.message || 'Erreur lors de la transcription audio (Whisper)' },
        { status: 502 },
      )
    }

    const transcription = await whisperRes.text()

    if (!transcription.trim()) {
      return NextResponse.json(
        { error: 'La transcription est vide. Vérifiez la qualité de l\'enregistrement audio.' },
        { status: 422 },
      )
    }

    /* ── Mode transcription seule (notes vocales) ── */
    if (transcriptionOnly) {
      return NextResponse.json({ transcription })
    }

    /* ── Étape 2 : Génération du CR via Claude ── */
    if (!anthropicKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY non configurée' }, { status: 500 })
    }

    const participantsBlock = participants.length > 0
      ? `Participants :\n${participants.map(p => `- ${p}`).join('\n')}`
      : 'Participants : non renseignés'

    const ordreJourBlock = ordreJour.trim()
      ? `Ordre du jour :\n${ordreJour.trim()}`
      : ''

    const dateStr = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })

    const userMessage = [
      `Date : ${dateStr}`,
      projetId ? `Projet ID : ${projetId}` : '',
      participantsBlock,
      ordreJourBlock,
      `\nTranscription de la réunion :\n\"\"\"\n${transcription}\n\"\"\"`,
      '\nGénère le compte rendu complet à partir de cette transcription.',
    ].filter(Boolean).join('\n\n')

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!claudeRes.ok) {
      const err = await claudeRes.json().catch(() => ({}))
      console.error('[transcribe] Claude error:', err)
      return NextResponse.json(
        { error: err?.error?.message || 'Erreur lors de la génération du CR (Claude)' },
        { status: 502 },
      )
    }

    const claudeData = await claudeRes.json()
    const compteRendu = claudeData.content?.[0]?.type === 'text'
      ? claudeData.content[0].text
      : ''

    return NextResponse.json({ transcription, compte_rendu: compteRendu })
  } catch (err) {
    console.error('[transcribe] Unexpected error:', err)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}
