'use client'

import { useState } from 'react'
import { Upload } from 'lucide-react'
import { DocumentUploadModal } from '@/components/shared/DocumentUploadModal'

interface ProjectToolbarProps {
  projetId: string
  nomProjet?: string
}

export function ProjectToolbar({ projetId, nomProjet }: ProjectToolbarProps) {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium">
        <Upload className="w-3.5 h-3.5" />
        Déposer un document
      </button>

      <DocumentUploadModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => {}}
        projetId={projetId}
        nomProjet={nomProjet}
      />
    </>
  )
}
