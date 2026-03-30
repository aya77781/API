'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  FolderOpen,
  Bell,
  LogOut,
  Building2,
  FileText,
  MessageSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { useSTProjects } from '@/hooks/useSTProjects'
import { useDocumentsBadge } from '@/hooks/useDocumentsBadge'
import { useChatBadge } from '@/hooks/useChatBadge'

export function STSidebar() {
  const pathname   = usePathname()
  const collapsed = false
  const router     = useRouter()
  const { user, profil } = useUser()
  const { unreadCount }  = useSTProjects(user?.id ?? null)
  const { unreadCount: docsBadge } = useDocumentsBadge(user?.id ?? null)
  const { unreadCount: chatBadge } = useChatBadge(user?.id ?? null)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initiales = profil
    ? `${profil.prenom?.[0] ?? ''}${profil.nom?.[0] ?? ''}`.toUpperCase()
    : 'ST'

  return (
    <aside className={`fixed inset-y-0 left-0 z-50 bg-gray-900 text-white border-r border-gray-800 flex flex-col w-64`}>
      {/* Logo */}
      <div className={`h-16 flex items-center border-b border-gray-800 ${collapsed ? 'justify-center px-2' : 'gap-3 px-5'}`}>
        <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white leading-tight">Espace ST</p>
            <p className="text-xs text-gray-400 truncate">Sous-Traitant</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {!collapsed && (
          <p className="px-3 mb-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Navigation</p>
        )}

        {/* Tableau de bord */}
        {collapsed ? (
          <Link
            href="/st/dashboard"
            title="Tableau de bord"
            className={cn(
              'flex items-center justify-center p-2.5 rounded-lg transition-colors duration-150',
              pathname === '/st/dashboard' || pathname.startsWith('/st/dashboard/')
                ? 'bg-white text-gray-900'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            )}
          >
            <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
          </Link>
        ) : (
          <Link
            href="/st/dashboard"
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
              pathname === '/st/dashboard' || pathname.startsWith('/st/dashboard/')
                ? 'bg-white text-gray-900'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            )}
          >
            <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
            Tableau de bord
          </Link>
        )}

        {/* Mes projets */}
        {collapsed ? (
          <Link
            href="/st/projets"
            title="Mes projets"
            className={cn(
              'flex items-center justify-center p-2.5 rounded-lg transition-colors duration-150',
              pathname === '/st/projets' || pathname.startsWith('/st/projets/')
                ? 'bg-white text-gray-900'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            )}
          >
            <FolderOpen className="w-4 h-4 flex-shrink-0" />
          </Link>
        ) : (
          <Link
            href="/st/projets"
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
              pathname === '/st/projets' || pathname.startsWith('/st/projets/')
                ? 'bg-white text-gray-900'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            )}
          >
            <FolderOpen className="w-4 h-4 flex-shrink-0" />
            Mes projets
          </Link>
        )}

        {/* Notifications */}
        {collapsed ? (
          <Link
            href="/st/dashboard"
            title="Notifications"
            className="flex items-center justify-center p-2.5 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors duration-150"
          >
            <span className="relative">
              <Bell className="w-4 h-4 flex-shrink-0" />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </span>
          </Link>
        ) : (
          <Link
            href="/st/dashboard"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors duration-150"
          >
            <div className="relative">
              <Bell className="w-4 h-4 flex-shrink-0" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] flex items-center justify-center font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <span className="flex-1">Notifications</span>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-semibold">
                {unreadCount}
              </span>
            )}
          </Link>
        )}

        {/* Documents */}
        {collapsed ? (
          <Link
            href="/st/documents"
            title="Documents"
            className={cn(
              'flex items-center justify-center p-2.5 rounded-lg transition-colors duration-150',
              pathname === '/st/documents' || pathname.startsWith('/st/documents/')
                ? 'bg-white text-gray-900'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            )}
          >
            <span className="relative">
              <FileText className="w-4 h-4 flex-shrink-0" />
              {docsBadge > 0 && (
                <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </span>
          </Link>
        ) : (
          <Link
            href="/st/documents"
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
              pathname === '/st/documents' || pathname.startsWith('/st/documents/')
                ? 'bg-white text-gray-900'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            )}
          >
            <FileText className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">Documents</span>
            {docsBadge > 0 && (
              <span className="min-w-[1.25rem] h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
                {docsBadge > 99 ? '99+' : docsBadge}
              </span>
            )}
          </Link>
        )}

        {/* Messages */}
        {collapsed ? (
          <Link
            href="/st/chat"
            title="Messages"
            className={cn(
              'flex items-center justify-center p-2.5 rounded-lg transition-colors duration-150',
              pathname === '/st/chat' || pathname.startsWith('/st/chat/')
                ? 'bg-white text-gray-900'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            )}
          >
            <span className="relative">
              <MessageSquare className="w-4 h-4 flex-shrink-0" />
              {chatBadge > 0 && (
                <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </span>
          </Link>
        ) : (
          <Link
            href="/st/chat"
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
              pathname === '/st/chat' || pathname.startsWith('/st/chat/')
                ? 'bg-white text-gray-900'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            )}
          >
            <MessageSquare className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">Messages</span>
            {chatBadge > 0 && (
              <span className="min-w-[1.25rem] h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
                {chatBadge > 99 ? '99+' : chatBadge}
              </span>
            )}
          </Link>
        )}
      </nav>

      {/* User footer */}
      <div className={`border-t border-gray-800 ${collapsed ? 'px-2 py-3' : 'px-4 py-4 space-y-3'}`}>
        {profil && (
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-xs font-semibold text-white flex-shrink-0">
              {initiales}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{profil.prenom} {profil.nom}</p>
                <p className="text-xs text-gray-400 truncate">Sous-traitant</p>
              </div>
            )}
          </div>
        )}
        {!collapsed && (
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Se déconnecter
          </button>
        )}
        {collapsed && (
          <button
            onClick={handleLogout}
            title="Se déconnecter"
            className="w-full flex items-center justify-center p-2.5 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors mt-2"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  )
}
