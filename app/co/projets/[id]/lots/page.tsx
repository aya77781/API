'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import MetresTab from '@/components/economiste/MetresTab'
import { fetchProjectEco } from '@/hooks/useEconomisteProject'
import { isPopy3Demo } from '@/lib/fake-data/metres-popy3'

export default function LotsProjetPage() {
  const { id } = useParams<{ id: string }>()
  const [reference, setReference] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProjectEco(id).then((p) => {
      setReference(p?.reference ?? null)
      setLoading(false)
    })
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    )
  }

  return <MetresTab projetId={id} mode="lots" fakeData={isPopy3Demo(reference)} />
}
