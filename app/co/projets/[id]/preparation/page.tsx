'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { PreparationVisite } from '@/components/co/preparation/PreparationVisite'
import { createClient } from '@/lib/supabase/client'

export default function PreparationProjetPage() {
  const { id } = useParams<{ id: string }>()
  const [projetNom, setProjetNom] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.schema('app').from('projets')
      .select('nom').eq('id', id).single()
      .then(({ data }) => setProjetNom(data?.nom ?? ''))
  }, [id])

  return <PreparationVisite projetId={id} projetNom={projetNom} />
}
