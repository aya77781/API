import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

// Ancien chemin de detail demande : on redirige vers la fiche projet, sur l'onglet correspondant.
const TAB_FOR_TYPE: Record<string, string> = {
  plan_intention: 'APS',
  plan_proposition: 'APD',
  plan_apd: 'AT',
}

export default async function DessinConceptionDemandeLegacyRedirect({ params }: { params: { demandeId: string } }) {
  const supabase = createClient()
  const { data: demande } = await supabase.schema('app').from('demandes_travail')
    .select('projet_id, type')
    .eq('id', params.demandeId)
    .maybeSingle()
  if (!demande?.projet_id) redirect('/dessin/projets')
  const tab = TAB_FOR_TYPE[demande.type ?? ''] ?? 'APS'
  redirect(`/dessin/projets/${demande.projet_id}?tab=${tab}`)
}
