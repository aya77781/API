'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, ClipboardCheck, ClipboardList,
  FileAudio, Calendar, FolderOpen,
  Layers, FolderInput, Scale, FileCheck,
} from 'lucide-react'
import { Abbr } from '@/components/shared/Abbr'

interface PhaseNavProps {
  projetId: string
  statutActuel?: string
}

const TABS: Array<{ key: string; label: React.ReactNode; icon: typeof LayoutDashboard; path: string }> = [
  { key: 'overview',     label: "Vue d'ensemble",                     icon: LayoutDashboard, path: '' },
  { key: 'lots',         label: 'Lots',                                icon: Layers,          path: '/lots' },
  { key: 'dce',          label: <Abbr k="DCE" />,                      icon: FolderInput,     path: '/dce' },
  { key: 'comparatif',   label: <>Comparatif <Abbr k="ST" /></>,        icon: Scale,           path: '/comparatif' },
  { key: 'devis-final',  label: 'Devis final',                         icon: FileCheck,       path: '/devis-final' },
  { key: 'preparation',  label: 'Preparation',                         icon: ClipboardCheck,  path: '/preparation' },
  { key: 'visite',       label: 'Visite chantier',                     icon: ClipboardList,   path: '/visite' },
  { key: 'compte-rendu', label: 'Compte rendu',                        icon: FileAudio,       path: '/visite?view=compte-rendu' },
  { key: 'planning',     label: 'Planning',                            icon: Calendar,        path: '/planning' },
  { key: 'documents',    label: <Abbr k="GED" />,                      icon: FolderOpen,      path: '/documents' },
]

export function PhaseNav({ projetId }: PhaseNavProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const base = `/co/projets/${projetId}`
  const onVisite = pathname.startsWith(`${base}/visite`)
  const isCompteRendu = onVisite && searchParams.get('view') === 'compte-rendu'

  function isActive(tab: typeof TABS[number]) {
    if (tab.key === 'overview') return pathname === base
    if (tab.key === 'compte-rendu') return isCompteRendu
    if (tab.key === 'visite') return onVisite && !isCompteRendu
    return pathname.startsWith(`${base}${tab.path.split('?')[0]}`)
  }

  return (
    <div className="bg-white border-b border-gray-200 px-3 sm:px-6 overflow-x-auto scrollbar-hide">
      <nav className="flex items-center gap-0 min-w-max">
        {TABS.map(tab => {
          const Icon = tab.icon
          const active = isActive(tab)
          return (
            <Link
              key={tab.key}
              href={`${base}${tab.path}`}
              className={cn(
                'flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                active
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
