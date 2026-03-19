import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  trend?: {
    value: number
    label: string
  }
  color?: 'default' | 'blue' | 'green' | 'amber' | 'red' | 'purple'
}

const colorClasses = {
  default: { icon: 'bg-gray-100 text-gray-600', trend: 'text-gray-500' },
  blue: { icon: 'bg-blue-50 text-blue-600', trend: 'text-blue-600' },
  green: { icon: 'bg-emerald-50 text-emerald-600', trend: 'text-emerald-600' },
  amber: { icon: 'bg-amber-50 text-amber-600', trend: 'text-amber-600' },
  red: { icon: 'bg-red-50 text-red-600', trend: 'text-red-600' },
  purple: { icon: 'bg-purple-50 text-purple-600', trend: 'text-purple-600' },
}

export function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'default',
}: StatCardProps) {
  const colors = colorClasses[color]

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-card p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold text-gray-900">{value}</p>
          {subtitle && (
            <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>
          )}
          {trend && (
            <p className={cn('mt-1 text-xs font-medium', colors.trend)}>
              {trend.value > 0 ? '+' : ''}{trend.value} {trend.label}
            </p>
          )}
        </div>
        <div className={cn('p-2.5 rounded-lg flex-shrink-0', colors.icon)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  )
}
