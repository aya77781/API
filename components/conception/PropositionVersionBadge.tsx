import { labelVersion } from '@/lib/conception/types'

type Statut = 'en_preparation' | 'envoyee' | 'acceptee' | 'refusee' | 'en_negociation' | string | null

const STATUT_STYLES: Record<string, string> = {
  en_preparation: 'bg-gray-100 text-gray-600 border-gray-200',
  envoyee: 'bg-blue-50 text-blue-700 border-blue-200',
  acceptee: 'bg-green-50 text-green-700 border-green-200',
  refusee: 'bg-red-50 text-red-700 border-red-200',
  en_negociation: 'bg-amber-50 text-amber-700 border-amber-200',
}

const STATUT_LABEL: Record<string, string> = {
  en_preparation: 'En préparation',
  envoyee: 'Envoyée client',
  acceptee: 'Acceptée',
  refusee: 'Refusée',
  en_negociation: 'En négociation',
}

export function PropositionVersionBadge({
  version,
  statut,
  isAPD = false,
  size = 'md',
}: {
  version: number | null | undefined
  statut?: Statut
  isAPD?: boolean
  size?: 'sm' | 'md'
}) {
  const cls = statut ? STATUT_STYLES[statut] ?? STATUT_STYLES.en_preparation : STATUT_STYLES.en_preparation
  const padding = size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-xs'
  return (
    <span className={`inline-flex items-center gap-1.5 ${padding} rounded-full border font-medium ${cls}`}>
      <span className="font-bold">{labelVersion(version, isAPD)}</span>
      {statut && <span className="opacity-75">· {STATUT_LABEL[statut] ?? statut}</span>}
    </span>
  )
}
