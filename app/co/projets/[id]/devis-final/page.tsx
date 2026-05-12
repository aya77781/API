'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import TabDevisFinal from '@/components/economiste/TabDevisFinal'
import { createClient } from '@/lib/supabase/client'

export default function DevisFinalProjetPage() {
  const { id } = useParams<{ id: string }>()
  const [projetNom, setProjetNom] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.schema('app').from('projets')
      .select('nom').eq('id', id).single()
      .then(({ data }) => setProjetNom(data?.nom ?? ''))
  }, [id])

  if (projetNom === null) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    )
  }

  return <TabDevisFinal projetId={id} projetNom={projetNom} />
}
