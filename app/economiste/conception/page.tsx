import { redirect } from 'next/navigation'

// Les demandes de chiffrage commercial s'affichent desormais dans le dashboard.
export default function EconomisteConceptionLegacyRedirect() {
  redirect('/economiste/dashboard')
}
