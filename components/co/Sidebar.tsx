'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import {
  LayoutDashboard,
  FolderOpen,
  FileText,
  Users,
  Settings,
  LogOut,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { useChatBadge } from '@/hooks/useChatBadge'
import { useSidebarCollapse } from '@/components/shared/SidebarCollapseContext'

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const { user, profil } = useUser()
  const supabase = createClient()
  const { collapsed, toggle } = useSidebarCollapse()

  const [unreadDocs, setUnreadDocs] = useState(0)
  const { unreadCount: chatBadge } = useChatBadge(user?.id ?? null)

  const fetchUnread = useCallback(async () => {
    if (!user) return
    const { count } = await supabase
      .schema('app')
      .from('notifs_documents')
      .select('id', { count: 'exact', head: true })
      .eq('destinataire_id', user.id)
      .eq('lu', false)
    setUnreadDocs(count ?? 0)
  }, [user])

  useEffect(() => {
    fetchUnread()
    if (!user) return

    const channel = supabase
      .channel(`sidebar_notifs_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'app',
          table: 'notifs_documents',
          filter: `destinataire_id=eq.${user.id}`,
        },
        () => fetchUnread()
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'app',
          table: 'notifs_documents',
          filter: `destinataire_id=eq.${user.id}`,
        },
        () => fetchUnread()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, fetchUnread])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initiales = profil
    ? `${profil.prenom?.[0] ?? ''}${profil.nom?.[0] ?? ''}`.toUpperCase()
    : 'CO'

  function navItem(
    href: string,
    label: string,
    Icon: React.ElementType,
    badge?: number,
  ) {
    const isActive = pathname === href || pathname.startsWith(href + '/')
    if (collapsed) {
      return (
        <Link
          key={href}
          href={href}
          title={label}
          className={cn(
            'flex items-center justify-center p-2.5 rounded-lg transition-colors duration-150',
            isActive
              ? 'bg-gray-900 text-white'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          )}
        >
          <span className="relative">
            <Icon className="w-4 h-4 flex-shrink-0" />
            {badge != null && badge > 0 && (
              <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </span>
        </Link>
      )
    }
    return (
      <Link
        key={href}
        href={href}
        className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
          isActive
            ? 'bg-gray-900 text-white'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        )}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1">{label}</span>
        {badge != null && badge > 0 && (
          <span className="min-w-[1.25rem] h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </Link>
    )
  }

  return (
    <aside className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-gray-200 flex flex-col transition-all duration-300 overflow-hidden ${collapsed ? 'w-16' : 'w-64'}`}>
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

      {/* Navigation principale */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {!collapsed && (
          <p className="px-3 mb-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
            Navigation
          </p>
        )}
        {navItem('/co/dashboard', 'Tableau de bord', LayoutDashboard)}
        {navItem('/co/projets',   'Projets',          FolderOpen)}
        {navItem('/co/documents', 'Documents',        FileText, unreadDocs)}
        {navItem('/co/chat',      'Messages',         MessageSquare, chatBadge)}
      </nav>

      {/* Navigation bas */}
      <div className="px-2 py-4 border-t border-gray-100 space-y-0.5">
        {navItem('/co/annuaire',   'Annuaire ST',  Users)}
        {navItem('/co/parametres', 'Paramètres',   Settings)}
      </div>

      {/* User footer */}
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
                <p className="text-xs text-gray-400 truncate">Chargé d&apos;Opérations</p>
              </div>
            )}
          </div>
        )}
        {!collapsed && (
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Se déconnecter
          </button>
        )}
        {collapsed && (
          <button
            onClick={handleLogout}
            title="Se déconnecter"
            className="w-full flex items-center justify-center p-2.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors mt-2"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Toggle button */}
      <button
        onClick={toggle}
        className="flex items-center justify-center py-3 border-t border-gray-100 hover:bg-gray-50 transition-colors"
      >
        {collapsed
          ? <ChevronRight className="w-4 h-4 text-gray-400" />
          : <ChevronLeft className="w-4 h-4 text-gray-400" />
        }
      </button>
    </aside>
  )
}
