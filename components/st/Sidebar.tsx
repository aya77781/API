'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, FolderOpen, Bell, LogOut, Building2, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { useSTProjects } from '@/hooks/useSTProjects'
import { useDocumentsBadge } from '@/hooks/useDocumentsBadge'

const navItems = [
  { label: 'Tableau de bord', href: '/st/dashboard', icon: LayoutDashboard },
  { label: 'Mes projets',     href: '/st/projets',   icon: FolderOpen       },
]

export function STSidebar() {
  const pathname   = usePathname()
  const router     = useRouter()
  const { user, profil } = useUser()
  const { unreadCount }  = useSTProjects(user?.id ?? null)
  const { unreadCount: docsBadge } = useDocumentsBadge(user?.id ?? null)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initiales = profil
    ? `${profil.prenom?.[0] ?? ''}${profil.nom?.[0] ?? ''}`.toUpperCase()
    : 'ST'

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 text-white flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-gray-800">
        <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white leading-tight">Espace ST</p>
          <p className="text-xs text-gray-400 truncate">Sous-Traitant</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="px-3 mb-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Navigation</p>
        {navItems.map((item) => {
          const Icon     = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
                isActive ? 'bg-white text-gray-900' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              )}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          )
        })}

        {/* Notifications link */}
        <Link href="/st/dashboard"
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
            'text-gray-300 hover:bg-gray-800 hover:text-white'
          )}>
          <div className="relative">
            <Bell className="w-4 h-4 flex-shrink-0" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] flex items-center justify-center font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          Notifications
          {unreadCount > 0 && (
            <span className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-semibold">
              {unreadCount}
            </span>
          )}
        </Link>

        {/* Documents link */}
        <Link href="/st/documents"
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
            pathname === '/st/documents' || pathname.startsWith('/st/documents/')
              ? 'bg-white text-gray-900'
              : 'text-gray-300 hover:bg-gray-800 hover:text-white'
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

      {/* User footer */}
      <div className="px-4 py-4 border-t border-gray-800 space-y-3">
        {profil && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-xs font-semibold text-white flex-shrink-0">
              {initiales}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{profil.prenom} {profil.nom}</p>
              <p className="text-xs text-gray-400 truncate">Sous-traitant</p>
            </div>
          </div>
        )}
        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
          <LogOut className="w-4 h-4" />
          Se déconnecter
        </button>
      </div>
    </aside>
  )
}
