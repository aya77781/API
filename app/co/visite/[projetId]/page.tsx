'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { TopBar } from '@/components/co/TopBar'
import { VisiteChantier } from '@/components/co/visite/VisiteChantier'
import { createClient } from '@/lib/supabase/client'

export default function VisiteProjetPage() {
  const { projetId } = useParams<{ projetId: string }>()
  const [projetNom, setProjetNom] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.schema('app').from('projets')
      .select('nom').eq('id', projetId).single()
      .then(({ data }) => setProjetNom(data?.nom ?? ''))
  }, [projetId])

  return (
    <div>
      <TopBar title="Visite de chantier" subtitle={projetNom} />
      <div className="p-6">
        <VisiteChantier projetId={projetId} />
      </div>
    </div>
  )
}
