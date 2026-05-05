import { redirect } from 'next/navigation'

// Les avenants se gerent desormais dans la fiche projet, onglet Avenants.
export default function EconomisteAvenantsLegacyRedirect() {
  redirect('/economiste/projets')
}
