'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { VisiteChantier } from '@/components/co/visite/VisiteChantier'
import { CompteRenduWeek } from '@/components/co/visite/CompteRenduWeek'

export default function VisiteProjetPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const view = searchParams.get('view')

  return view === 'compte-rendu'
    ? <CompteRenduWeek projetId={id} />
    : <VisiteChantier projetId={id} />
}
