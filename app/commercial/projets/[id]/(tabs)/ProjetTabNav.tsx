'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  FileText,
  Pencil,
  Calculator,
  CalendarDays,
  Handshake,
  FileSignature,
  UserCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProjetTabNavProps {
  projetId: string
}

const TABS = [
  { slug: '',           label: 'Dossier',      icon: FileText },
  { slug: '/plans',     label: 'Plans',        icon: Pencil },
  { slug: '/chiffrage', label: 'Chiffrage',    icon: Calculator },
  { slug: '/planning',  label: 'Planning',     icon: CalendarDays },
  { slug: '/negociation', label: 'Négociation', icon: Handshake },
  { slug: '/contrat',   label: 'Contrat',      icon: FileSignature },
  { slug: '/client',    label: 'Suivi client', icon: UserCircle },
]

export function ProjetTabNav({ projetId }: ProjetTabNavProps) {
  const pathname = usePathname()
  const base = `/commercial/projets/${projetId}`

  return (
    <div className="border-b border-gray-200 bg-white sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <nav className="flex items-center gap-1 overflow-x-auto -mb-px">
          {TABS.map(tab => {
            const href = base + tab.slug
            const active = tab.slug === ''
              ? pathname === base
              : pathname === href || pathname.startsWith(href + '/')
            const Icon = tab.icon
            return (
              <Link
                key={tab.slug || 'dossier'}
                href={href}
                className={cn(
                  'flex items-center gap-2 px-3 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  active
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300',
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
