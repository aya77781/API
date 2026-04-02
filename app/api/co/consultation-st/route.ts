import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 35

export async function POST(req: NextRequest) {
  const webhookUrl = process.env.N8N_WEBHOOK_CONSULTATION_URL
  if (!webhookUrl) {
    return NextResponse.json(
      { success: false, error: true, message: 'N8N_WEBHOOK_CONSULTATION_URL non configuree' },
      { status: 500 },
    )
  }

  try {
    const body = await req.json()
    const { lot, ville, nb_resultats, projet_id, lot_id, co_id } = body

    if (!lot || !ville) {
      return NextResponse.json(
        { success: false, error: true, message: 'lot et ville sont requis' },
        { status: 400 },
      )
    }

    const n8nRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lot,
        ville,
        nb_resultats: nb_resultats ?? 3,
        projet_id: projet_id ?? '',
        lot_id: lot_id ?? '',
        co_id: co_id ?? '',
      }),
      signal: AbortSignal.timeout(30_000),
    })

    if (!n8nRes.ok) {
      console.error('[consultation-st] n8n error:', n8nRes.status)
      return NextResponse.json(
        { success: false, error: true, message: 'Erreur webhook n8n' },
        { status: 502 },
      )
    }

    const data = await n8nRes.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('[consultation-st] error:', err)
    return NextResponse.json(
      { success: false, error: true, message: 'Erreur interne' },
      { status: 500 },
    )
  }
}
