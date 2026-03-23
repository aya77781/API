import Link from 'next/link'
import { Hammer } from 'lucide-react'
import { TopBar } from '@/components/co/TopBar'

export function ComingSoon({
  title,
  subtitle,
  backHref,
}: {
  title: string
  subtitle: string
  backHref: string
}) {
  return (
    <div>
      <TopBar title={title} subtitle={subtitle} />
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Hammer className="w-7 h-7 text-gray-300" />
        </div>
        <p className="text-sm font-medium text-gray-700 mb-1">Module en construction</p>
        <p className="text-xs text-gray-400 mb-6">Cette section sera disponible prochainement.</p>
        <Link
          href={backHref}
          className="text-xs text-gray-500 hover:text-gray-900 transition-colors"
        >
          ← Retour au tableau de bord
        </Link>
      </div>
    </div>
  )
}
