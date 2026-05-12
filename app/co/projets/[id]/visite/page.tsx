'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { FileAudio, ClipboardList } from 'lucide-react'
import { VisiteChantier } from '@/components/co/visite/VisiteChantier'
import { ReunionChantier } from '@/components/co/visite/ReunionChantier'
import { cn } from '@/lib/utils'

type View = 'visite' | 'compte-rendu'

export default function VisiteProjetPage() {
  const { id } = useParams<{ id: string }>()
  const [view, setView] = useState<View>('visite')

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        <button
          onClick={() => setView('visite')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
            view === 'visite'
              ? 'bg-gray-900 text-white shadow-sm'
              : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300',
          )}
        >
          <ClipboardList className="w-4 h-4" />
          Visite chantier
        </button>
        <button
          onClick={() => setView('compte-rendu')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
            view === 'compte-rendu'
              ? 'bg-gray-900 text-white shadow-sm'
              : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300',
          )}
        >
          <FileAudio className="w-4 h-4" />
          Compte rendu
        </button>
      </div>

      {view === 'visite' ? <VisiteChantier projetId={id} /> : <ReunionChantier projetId={id} />}
    </div>
  )
}
