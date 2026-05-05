import { redirect } from 'next/navigation'

// La phase Cloture (DOE) se gere desormais dans la fiche projet, onglet DOE.
export default function DessinClotureLegacyRedirect() {
  redirect('/dessin/projets')
}
