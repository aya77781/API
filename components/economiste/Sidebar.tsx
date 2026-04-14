'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import {
  LayoutDashboard,
  FolderOpen,
  Calculator,
  FileWarning,
  LogOut,
  X,
  FileText,
  MessageSquare,
  ListTodo,
  Receipt,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { useDocumentsBadge } from '@/hooks/useDocumentsBadge'
import { useChatBadge } from '@/hooks/useChatBadge'
import { useSidebarCollapse } from '@/components/shared/SidebarCollapseContext'

export function EconomisteSidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const { user, profil } = useUser()
  const { mobileOpen, closeMobile, desktopCollapsed } = useSidebarCollapse()
  const { unreadCount: docsBadge } = useDocumentsBadge(user?.id ?? null)
  const { unreadCount: chatBadge } = useChatBadge(user?.id ?? null)

  // Close mobile sidebar on route change
  useEffect(() => {
    closeMobile()
  }, [pathname, closeMobile])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initiales = profil
    ? `${profil.prenom?.[0] ?? ''}${profil.nom?.[0] ?? ''}`.toUpperCase()
    : 'EC'

  const navLinks = [
    { label: 'Tableau de bord', href: '/economiste/dashboard',  icon: LayoutDashboard, badge: 0 },
    { label: 'Mes projets',     href: '/economiste/projets',    icon: FolderOpen,      badge: 0 },
    { label: 'Chiffrages',      href: '/economiste/chiffrages', icon: Calculator,      badge: 0 },
    { label: 'Avenants',        href: '/economiste/avenants',   icon: FileWarning,     badge: 0 },
    { label: 'Notes de frais',  href: '/economiste/notes-frais',icon: Receipt,         badge: 0 },
    { label: 'Todo List',       href: '/economiste/todo',       icon: ListTodo,        badge: 0 },
    { label: 'Documents',       href: '/economiste/documents',  icon: FileText,        badge: docsBadge },
    { label: 'Messages',        href: '/economiste/chat',       icon: MessageSquare,   badge: chatBadge },
  ]

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-100">
        <Image src="/logo.png" alt="API" width={48} height={48} className="object-contain flex-shrink-0" priority />
        <span className="ml-2 font-semibold text-gray-900 truncate">API</span>
        {/* Close button on mobile */}
        <button onClick={closeMobile} className="ml-auto p-1.5 text-gray-400 hover:text-gray-600 lg:hidden">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 mb-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
          Navigation
        </p>
        {navLinks.map((item) => {
          const Icon = item.icon
          const isActive =
            item.href === '/economiste/projets'
              ? pathname.startsWith('/economiste/projets')
              : pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
                isActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.badge > 0 && (
                <span className="min-w-[1.25rem] h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-100 px-4 py-4 space-y-3">
        {profil && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0">
              {initiales}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{profil.prenom} {profil.nom}</p>
              <p className="text-xs text-gray-400 truncate">Économiste</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Se déconnecter
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop sidebar - hidden when collapsed */}
      {!desktopCollapsed && (
        <aside className="hidden lg:flex fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex-col">
          {sidebarContent}
        </aside>
      )}

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/30 lg:hidden" onClick={closeMobile} />
          <aside className="fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-200 flex flex-col lg:hidden animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  )
}
