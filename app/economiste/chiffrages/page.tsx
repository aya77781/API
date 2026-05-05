import { redirect } from 'next/navigation'

// Les chiffrages se gerent desormais dans la fiche projet, onglet Chiffrage.
export default function EconomisteChiffragesLegacyRedirect() {
  redirect('/economiste/projets')
}
