import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

// Ancien chemin de detail demande : redirige vers la fiche projet, onglet chiffrage.
export default async function EconomisteConceptionDemandeLegacyRedirect({ params }: { params: { demandeId: string } }) {
  const supabase = createClient()
  const { data: demande } = await supabase.schema('app').from('demandes_travail')
    .select('projet_id')
    .eq('id', params.demandeId)
    .maybeSingle()
  if (!demande?.projet_id) redirect('/economiste/dashboard')
  redirect(`/economiste/projets/${demande.projet_id}?tab=chiffrage`)
}
