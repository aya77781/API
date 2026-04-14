'use client'

import Link from 'next/link'
import { ResponsiveSidebar } from '@/components/shared/ResponsiveSidebar'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  FolderOpen,
  FolderPlus,
  LogOut,
  Menu,
  X,
  FileText,
  MessageSquare,
  ListTodo,
  Receipt,
  Target,
  Gavel,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { useDocumentsBadge } from '@/hooks/useDocumentsBadge'
import { useChatBadge } from '@/hooks/useChatBadge'

export function CommercialSidebar() {
  const pathname = usePathname()
  const collapsed = false
  const router = useRouter()
  const { user, profil } = useUser()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { unreadCount: docsBadge } = useDocumentsBadge(user?.id ?? null)
  const { unreadCount: chatBadge } = useChatBadge(user?.id ?? null)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initiales = profil
    ? `${profil.prenom?.[0] ?? ''}${profil.nom?.[0] ?? ''}`.toUpperCase()
    : 'CO'

  const navLinks = [
    { label: 'Tableau de bord', href: '/commercial/dashboard',         icon: LayoutDashboard, badge: 0 },
    { label: 'Mes projets',     href: '/commercial/projets',            icon: FolderOpen,      badge: 0 },
    { label: 'Prospection',     href: '/commercial/prospection',        icon: Target,          badge: 0 },
    { label: 'Marchés publics', href: '/commercial/marches-publics',    icon: Gavel,           badge: 0 },
    { label: 'Nouveau dossier', href: '/commercial/projets/nouveau',    icon: FolderPlus,      badge: 0 },
    { label: 'Notes de frais',  href: '/commercial/notes-frais',        icon: Receipt,         badge: 0 },
    { label: 'Todo List',       href: '/commercial/todo',               icon: ListTodo,        badge: 0 },
    { label: 'Documents',       href: '/commercial/documents',          icon: FileText,        badge: docsBadge },
    { label: 'Messages',        href: '/commercial/chat',               icon: MessageSquare,   badge: chatBadge },
  ]

  const desktopSidebar = (
    <ResponsiveSidebar>
      {/* Logo */}
      <div className={`h-16 flex items-center border-b border-gray-100 ${collapsed ? 'justify-center px-2' : 'px-6'}`}>
        <Image
          src="/logo.png"
          alt="API"
          width={48}
          height={48}
          className="object-contain flex-shrink-0"
          priority
        />
        {!collapsed && (
          <span className="ml-2 font-semibold text-gray-900 truncate">API</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {!collapsed && (
          <p className="px-3 mb-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
            Navigation
          </p>
        )}
        {navLinks.map((item) => {
          const Icon = item.icon
          const isActive =
            item.href === '/commercial/projets'
              ? pathname.startsWith('/commercial/projets') && !pathname.includes('/nouveau')
              : pathname === item.href || pathname.startsWith(item.href + '/')
          if (collapsed) {
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={cn(
                  'flex items-center justify-center p-2.5 rounded-lg transition-colors duration-150',
                  isActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <span className="relative">
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {item.badge > 0 && (
                    <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full" />
                  )}
                </span>
              </Link>
            )
          }
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

      {/* Footer utilisateur */}
      <div className={`border-t border-gray-100 ${collapsed ? 'px-2 py-3' : 'px-4 py-4 space-y-3'}`}>
        {profil && (
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0">
              {initiales}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {profil.prenom} {profil.nom}
                </p>
                <p className="text-xs text-gray-400 truncate">Commercial</p>
              </div>
            )}
          </div>
        )}
        {!collapsed && (
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Se déconnecter
          </button>
        )}
        {collapsed && (
          <button
            onClick={handleLogout}
            title="Se déconnecter"
            className="w-full flex items-center justify-center p-2.5 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors mt-2"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </ResponsiveSidebar>
  )

  const mobileSidebarContent = (
    <aside className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-100">
        <Image
          src="/logo.png"
          alt="API"
          width={48}
          height={48}
          className="object-contain"
          priority
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 mb-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
          Navigation
        </p>
        {navLinks.map((item) => {
          const Icon = item.icon
          const isActive =
            item.href === '/commercial/projets'
              ? pathname.startsWith('/commercial/projets') && !pathname.includes('/nouveau')
              : pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
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

      {/* Footer utilisateur */}
      <div className="px-4 py-4 border-t border-gray-100 space-y-3">
        {profil && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0">
              {initiales}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {profil.prenom} {profil.nom}
              </p>
              <p className="text-xs text-gray-400 truncate">Commercial</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Se déconnecter
        </button>
      </div>
    </aside>
  )

  return (
    <>
      {/* Desktop */}
      <div className="hidden lg:block">
        {desktopSidebar}
      </div>

      {/* Mobile toggle */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white border border-gray-200 rounded-lg shadow-sm"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/20"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-64">{mobileSidebarContent}</div>
        </div>
      )}
    </>
  )
}
