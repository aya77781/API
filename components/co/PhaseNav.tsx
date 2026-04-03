'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn, STATUT_LABELS, PHASE_ORDER } from '@/lib/utils'
import { Check, FolderOpen } from 'lucide-react'

interface PhaseNavProps {
  projetId: string
  statutActuel: string
}

export function PhaseNav({ projetId, statutActuel }: PhaseNavProps) {
  const pathname = usePathname()
  const currentPhaseIndex = PHASE_ORDER.indexOf(statutActuel)

  return (
    <div className="bg-white border-b border-gray-200 px-3 sm:px-6 overflow-x-auto">
      <nav className="flex items-center gap-0 min-w-max">
        {PHASE_ORDER.map((phase, i) => {
          const isActive = pathname.endsWith(`/${phase}`)
          const isDone = i < currentPhaseIndex
          const isCurrent = i === currentPhaseIndex
          const isAccessible = i <= currentPhaseIndex || phase === 'achats'

          return (
            <Link
              key={phase}
              href={phase === 'achats' ? `/co/achats?projet=${projetId}` : `/co/projets/${projetId}/${phase}`}
              className={cn(
                'relative flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                isActive
                  ? 'border-gray-900 text-gray-900'
                  : isDone
                  ? 'border-transparent text-gray-400 hover:text-gray-600'
                  : isCurrent || isAccessible
                  ? 'border-transparent text-gray-600 hover:text-gray-900'
                  : 'border-transparent text-gray-300 cursor-not-allowed pointer-events-none'
              )}
            >
              {isDone ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <span
                  className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold border',
                    isCurrent
                      ? 'bg-gray-900 text-white border-gray-900'
                      : isAccessible
                      ? 'bg-white text-gray-500 border-gray-300'
                      : 'bg-white text-gray-200 border-gray-200'
                  )}
                >
                  {i + 1}
                </span>
              )}
              {STATUT_LABELS[phase]}
            </Link>
          )
        })}

        {/* Separator + GED tab */}
        <div className="flex items-center ml-2 pl-2 border-l border-gray-200">
          <Link
            href={`/co/projets/${projetId}/documents`}
            className={cn(
              'relative flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              pathname.includes('/documents')
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            <FolderOpen className="w-4 h-4" />
            GED
          </Link>
        </div>
      </nav>
    </div>
  )
}
