'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import ComparatifST from '@/components/shared/ComparatifST'
import { useUser } from '@/hooks/useUser'
import { fetchProjectEco, type ProjetEco } from '@/hooks/useEconomisteProject'

export default function ComparatifProjetPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useUser()
  const [projet, setProjet] = useState<ProjetEco | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProjectEco(id).then((p) => {
      setProjet(p)
      setLoading(false)
    })
  }, [id])

  if (loading || !projet) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    )
  }

  return <ComparatifST projet={projet} userId={user?.id ?? ''} />
}
