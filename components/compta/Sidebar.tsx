'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, TrendingUp, CreditCard, Users, LogOut, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { useDocumentsBadge } from '@/hooks/useDocumentsBadge'

const navItems = [
  { label: 'Tableau de bord', href: '/compta/dashboard',  icon: LayoutDashboard },
  { label: 'Trésorerie',      href: '/compta/tresorerie', icon: TrendingUp },
  { label: 'Règlements',      href: '/compta/reglements', icon: CreditCard },
  { label: 'Gestion ST',      href: '/compta/gestion-st', icon: Users },
]

export function ComptaSidebar() {
  const pathname   = usePathname()
  const router     = useRouter()
  const { user, profil } = useUser()
  const { unreadCount: docsBadge } = useDocumentsBadge(user?.id ?? null)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initiales = profil
    ? `${profil.prenom?.[0] ?? ''}${profil.nom?.[0] ?? ''}`.toUpperCase()
    : 'CP'

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="h-16 flex items-center px-6 border-b border-gray-100">
        <Image src="/logo.png" alt="API" width={48} height={48} className="object-contain" priority />
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 mb-2 text-xs font-medium text-gray-400 uppercase tracking-wider">Navigation</p>
        {navItems.map((item) => {
          const Icon     = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
                isActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          )
        })}
        <Link href="/compta/documents"
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
            pathname === '/compta/documents' || pathname.startsWith('/compta/documents/')
              ? 'bg-gray-900 text-white'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          )}>
          <FileText className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">Documents</span>
          {docsBadge > 0 && (
            <span className="min-w-[1.25rem] h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
              {docsBadge > 99 ? '99+' : docsBadge}
            </span>
          )}
        </Link>
      </nav>

      <div className="px-4 py-4 border-t border-gray-100 space-y-3">
        {profil && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-xs font-semibold text-teal-600 flex-shrink-0">
              {initiales}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{profil.prenom} {profil.nom}</p>
              <p className="text-xs text-gray-400 truncate">Comptable</p>
            </div>
          </div>
        )}
        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors">
          <LogOut className="w-4 h-4" />
          Se déconnecter
        </button>
      </div>
    </aside>
  )
}
