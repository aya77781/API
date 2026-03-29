import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/st/lots-disponibles
// Retourne les projets + lots non encore attribués à un ST
export async function GET() {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .schema('app')
    .from('projets')
    .select('id, nom, reference, lots(id, numero, corps_etat, statut)')
    .not('statut', 'eq', 'termine')
    .order('nom')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Filtrer : ne garder que les lots sans ST attribué et pas terminés
  const result = (data ?? [])
    .map((projet: any) => ({
      id: projet.id,
      nom: projet.nom,
      reference: projet.reference,
      lots: (projet.lots ?? []).filter(
        (l: any) => !l.st_retenu_id && l.statut !== 'termine'
      ),
    }))
    .filter((p: any) => p.lots.length > 0)

  return NextResponse.json(result)
}
