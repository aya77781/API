import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 60

async function executeSQL(sql: string): Promise<{ data: unknown[] | null; error: string | null }> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/execute_query`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        },
        body: JSON.stringify({ query_text: sql }),
      },
    )
    if (!res.ok) {
      const errText = await res.text()
      console.error('[executeSQL] HTTP error:', res.status, errText)
      return { data: null, error: `HTTP ${res.status}: ${errText}` }
    }
    const data = await res.json()
    return { data: Array.isArray(data) ? data : (data ?? []), error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[executeSQL] error:', msg)
    return { data: null, error: msg }
  }
}

const MAX_ITERATIONS = 5
const MAX_HISTORY = 20

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

const ROLES_DESCRIPTIONS: Record<string, string> = {
  co: 'Charge d\'Operations -- tu geres les chantiers, les sous-traitants, les reunions et les CR',
  commercial: 'Commercial -- tu geres les prospects, les propositions et les contrats',
  economiste: 'Economiste -- tu geres le chiffrage, les devis et les avenants',
  gerant: 'Gerant -- tu as une vue globale sur tous les projets et les performances',
  admin: 'Administrateur -- tu as acces a tout',
  rh: 'RH -- tu geres les candidats, l\'onboarding et les notes de frais',
  cho: 'CHO -- tu geres la securite, l\'hygiene et l\'organisation',
  dessinatrice: 'Dessinatrice -- tu geres les plans et les documents techniques',
  assistant_travaux: 'Assistant Travaux -- tu assistes le CO sur le terrain',
  comptable: 'Comptable -- tu geres la facturation et les reglements',
  st: 'Sous-traitant -- tu consultes tes projets et tes lots',
}

const FILTRE_PAR_ROLE: Record<string, string> = {
  co: 'p.co_id',
  commercial: 'p.commercial_id',
  economiste: 'p.economiste_id',
  dessinatrice: 'p.dessinatrice_id',
  gerant: '',
  admin: '',
  rh: '',
  cho: '',
  assistant_travaux: '',
  comptable: '',
  st: '',
}

function buildTools(userId: string) {
  return [
    {
      type: 'function' as const,
      function: {
        name: 'query_database',
        description: `Execute une requete SQL SELECT sur la base de donnees. OBLIGATOIRE avant toute reponse sur des donnees. Toujours prefixer les tables avec app. Limiter a 50 lignes. Exemples : SELECT * FROM app.projets WHERE co_id = '${userId}' / SELECT p.nom, l.corps_etat FROM app.projets p JOIN app.lots l ON l.projet_id = p.id`,
        parameters: {
          type: 'object',
          properties: {
            sql: { type: 'string', description: 'Requete SQL SELECT valide avec schema app.' },
            raison: { type: 'string', description: 'Pourquoi tu fais cette requete' },
          },
          required: ['sql', 'raison'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'creer_tache',
        description: 'Cree une tache dans la plateforme',
        parameters: {
          type: 'object',
          properties: {
            titre: { type: 'string' },
            description: { type: 'string' },
            projet_id: { type: 'string' },
            urgence: { type: 'string', enum: ['faible', 'normal', 'urgent', 'critique'] },
            due_date: { type: 'string', description: 'Format YYYY-MM-DD' },
          },
          required: ['titre'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'marquer_alerte_lue',
        description: 'Marque une alerte ou toutes les alertes comme lues',
        parameters: {
          type: 'object',
          properties: {
            alerte_id: { type: 'string', description: 'ID de l\'alerte. Si \'all\', marque toutes les alertes comme lues' },
          },
          required: ['alerte_id'],
        },
      },
    },
  ]
}

export async function POST(req: NextRequest) {
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) return NextResponse.json({ error: 'OPENAI_API_KEY non configuree' }, { status: 500 })

  try {
    const { message, conversation_id, user_id, role } = await req.json()
    if (!message || !user_id) return NextResponse.json({ error: 'message et user_id requis' }, { status: 400 })

    const userRole = role ?? 'co'
    const supabase = createAdminClient()

    /* ── Step 1: Get user profile ── */
    const { data: profil } = await supabase.schema('app').from('utilisateurs')
      .select('prenom, nom, role').eq('id', user_id).single()

    const prenom = profil?.prenom ?? ''
    const nom = profil?.nom ?? ''
    const actualRole = profil?.role ?? userRole

    /* ── Step 2: Load schema dynamically ── */
    const schemaTexte = await executeSQL(
      `SELECT table_name,
              string_agg(column_name || ' (' || data_type || ')', ', ' ORDER BY ordinal_position) as colonnes
       FROM information_schema.columns
       WHERE table_schema = 'app'
       GROUP BY table_name
       ORDER BY table_name`
    ).then(res => {
      if (res.error) { console.error('[assistant] schema load error:', res.error); return '(erreur chargement schema)' }
      return ((res.data ?? []) as Array<{ table_name: string; colonnes: string }>)
        .map((t) => `- app.${t.table_name} : ${t.colonnes}`)
        .join('\n')
    })

    /* ── Step 3: Build role-adaptive filter hint ── */
    const filtreCol = FILTRE_PAR_ROLE[actualRole] ?? ''
    const filtreHint = filtreCol
      ? `Pour filtrer les projets de cet utilisateur, utilise : WHERE ${filtreCol} = '${user_id}'`
      : 'Cet utilisateur a acces a tous les projets (pas de filtre necessaire)'

    /* ── Step 4: Build system prompt ── */
    const systemPrompt = `Tu es l'assistant IA de la plateforme API -- Gestion de Chantier.

Utilisateur connecte : ${prenom} ${nom}
Role : ${ROLES_DESCRIPTIONS[actualRole] ?? actualRole}
ID : ${user_id}

${filtreHint}

Tu as acces DIRECT a la base de donnees via l'outil query_database.
Tu peux interroger N'IMPORTE QUELLE table ci-dessous.

SCHEMA COMPLET DE LA BASE DE DONNEES :
${schemaTexte}

LOGIQUE METIER IMPORTANTE :
- Les ST AJOUTES a un lot sont dans app.sts_prospection avec statut = 'valide' ET st_id NOT NULL
- Les ST en attente (suggestions Google Maps) sont dans app.sts_prospection avec statut = 'suggestion'
- Les ST ignores ont statut = 'ignore'
- La table app.sous_traitants contient les fiches ST definitives (raison_sociale, contact_tel, contact_email)
- La table app.consultations_st contient le suivi des consultations (statut de negociation, montant devis)
- Pour savoir combien de ST sont ajoutes a un lot : SELECT count(*) FROM app.sts_prospection WHERE lot_id = '...' AND statut = 'valide' AND st_id IS NOT NULL
- Pour avoir les details d'un ST ajoute : joindre sts_prospection avec sous_traitants via st_id
- Les lots sont dans app.lots, lies aux projets via projet_id
- Les projets sont dans app.projets, le CO est identifie par co_id

REGLES ABSOLUES :
1. TOUJOURS utiliser query_database avant de repondre a une question sur des donnees -- ne jamais inventer
2. Filtrer les donnees selon le role de l'utilisateur (voir filtre ci-dessus)
3. Si une table n'est pas dans la liste, elle n'existe pas
4. Repondre en francais, etre direct et precis
5. Pour savoir les ST d'un lot, TOUJOURS chercher dans app.sts_prospection (pas consultations_st)
6. Confirmer avant toute action d'ecriture
7. Pour les lots d'un projet, joindre app.lots avec app.projets
8. Limiter les resultats a 50 lignes max (LIMIT 50)
9. Ne jamais exposer les UUIDs bruts dans la reponse, utiliser les noms lisibles
10. Si la requete echoue, corriger la syntaxe et reessayer
11. Adapter ton vocabulaire au role de l'utilisateur`

    /* ── Step 5: Load or create conversation ── */
    let convId = conversation_id
    let history: Message[] = []

    if (convId) {
      const { data: conv } = await supabase.schema('app').from('conversations_assistant')
        .select('messages').eq('id', convId).single()
      if (conv) {
        history = (conv.messages as Message[]) ?? []
        if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY)
      }
    }

    history.push({ role: 'user', content: message, timestamp: new Date().toISOString() })

    /* ── Step 6: Agentic loop ── */
    const tools = buildTools(user_id)
    const openaiMessages: { role: string; content: string; tool_calls?: unknown[]; tool_call_id?: string }[] = [
      { role: 'system', content: systemPrompt },
      ...history.map(m => ({ role: m.role, content: m.content })),
    ]

    let iterations = 0
    let finalReply = ''

    while (iterations < MAX_ITERATIONS) {
      iterations++

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: openaiMessages,
          tools,
          tool_choice: 'auto',
          max_tokens: 1500,
        }),
      })

      if (!res.ok) {
        console.error('[assistant] OpenAI error:', await res.text())
        return NextResponse.json({ error: 'Erreur OpenAI' }, { status: 502 })
      }

      const data = await res.json()
      const choice = data.choices?.[0]
      if (!choice) break

      if (!choice.message?.tool_calls || choice.message.tool_calls.length === 0) {
        finalReply = choice.message?.content ?? ''
        break
      }

      // Execute tool calls
      openaiMessages.push(choice.message)

      for (const tc of choice.message.tool_calls) {
        let result: unknown
        try {
          const args = JSON.parse(tc.function.arguments)

          if (tc.function.name === 'query_database') {
            const sql = (args.sql as string ?? '').trim()
            if (!sql.toUpperCase().startsWith('SELECT')) {
              result = { error: 'SELECT uniquement autorise' }
            } else {
              const qResult = await executeSQL(sql)
              if (qResult.error) {
                console.error('[assistant] SQL error:', qResult.error, 'SQL:', sql)
                result = { error: qResult.error }
              } else {
                const rows = qResult.data ?? []
                result = { data: rows.slice(0, 50), rows: rows.length }
              }
            }
          } else if (tc.function.name === 'creer_tache') {
            const { data: tData, error } = await supabase.schema('app').from('taches')
              .insert({
                titre: args.titre, description: args.description ?? null,
                projet_id: args.projet_id ?? null, urgence: args.urgence ?? 'normal',
                due_date: args.due_date ?? null, assignee_a: user_id, creee_par: user_id,
                statut: 'a_faire', tags_utilisateurs: [], tags_roles: [], tag_tous: false,
              }).select('id, titre').single()
            result = error ? { error: error.message } : { success: true, tache: tData }
          } else if (tc.function.name === 'marquer_alerte_lue') {
            if (args.alerte_id === 'all') {
              await supabase.schema('app').from('alertes').update({ lue: true }).eq('utilisateur_id', user_id)
              result = { success: true, message: 'Toutes les alertes marquees comme lues' }
            } else {
              await supabase.schema('app').from('alertes').update({ lue: true }).eq('id', args.alerte_id)
              result = { success: true }
            }
          } else {
            result = { error: 'Outil inconnu' }
          }
        } catch (e: unknown) {
          result = { error: e instanceof Error ? e.message : String(e) }
        }

        openaiMessages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) })
      }
    }

    // Final call if loop ended with tool results
    if (!finalReply) {
      const last = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({ model: 'gpt-4o', messages: openaiMessages, max_tokens: 1500 }),
      })
      if (last.ok) {
        const d = await last.json()
        finalReply = d.choices?.[0]?.message?.content ?? 'Desole, je n\'ai pas pu repondre.'
      }
    }

    /* ── Step 7: Save ── */
    history.push({ role: 'assistant', content: finalReply, timestamp: new Date().toISOString() })
    if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY)

    if (convId) {
      await supabase.schema('app').from('conversations_assistant')
        .update({ messages: history, updated_at: new Date().toISOString() }).eq('id', convId)
    } else {
      const { data: newConv } = await supabase.schema('app').from('conversations_assistant')
        .insert({ utilisateur_id: user_id, messages: history }).select('id').single()
      convId = newConv?.id ?? null
    }

    return NextResponse.json({ reply: finalReply, conversation_id: convId })
  } catch (err) {
    console.error('[assistant] error:', err)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
