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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const { user, profil } = useUser()
  const supabase = createClient()

  const [unreadDocs, setUnreadDocs] = useState(0)

  /* ── Badge : count non-lus ── */
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
    <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col">
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

      {/* Navigation principale */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 mb-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
          Navigation
        </p>
        {navItem('/co/dashboard', 'Tableau de bord', LayoutDashboard)}
        {navItem('/co/projets',   'Projets',          FolderOpen)}
        {navItem('/co/documents', 'Documents',        FileText, unreadDocs)}
      </nav>

      {/* Navigation bas */}
      <div className="px-3 py-4 border-t border-gray-100 space-y-0.5">
        {navItem('/co/annuaire',   'Annuaire ST',  Users)}
        {navItem('/co/parametres', 'Paramètres',   Settings)}
      </div>

      {/* User footer */}
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
              <p className="text-xs text-gray-400 truncate">Chargé d&apos;Opérations</p>
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
    </aside>
  )
}
