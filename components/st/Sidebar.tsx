'use client'

import { useState, useEffect } from 'react'
import { ResponsiveSidebar } from '@/components/shared/ResponsiveSidebar'
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
  ListTodo,
  Receipt,
  Settings,
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
    <ResponsiveSidebar bgClassName="bg-white text-gray-900 border-r border-gray-200" closeBtnClassName="text-gray-400 hover:text-gray-700">
      {/* Logo */}
      <div className={`h-16 flex items-center border-b border-gray-200 ${collapsed ? 'justify-center px-2' : 'gap-3 px-5'}`}>
        <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 leading-tight">Espace ST</p>
            <p className="text-xs text-gray-500 truncate">Sous-Traitant</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {!collapsed && (
          <p className="px-3 mb-2 text-xs font-medium text-gray-400 uppercase tracking-wider">Navigation</p>
        )}

        {/* Tableau de bord */}
        {collapsed ? (
          <Link
            href="/st/dashboard"
            title="Tableau de bord"
            className={cn(
              'flex items-center justify-center p-2.5 rounded-lg transition-colors duration-150',
              pathname === '/st/dashboard' || pathname.startsWith('/st/dashboard/')
                ? 'bg-gray-900 text-white'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
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
                ? 'bg-gray-900 text-white'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
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
                ? 'bg-gray-900 text-white'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
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
                ? 'bg-gray-900 text-white'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
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
            className="flex items-center justify-center p-2.5 rounded-lg text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
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
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
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

        {/* Notes de frais */}
        {collapsed ? (
          <Link
            href="/st/notes-frais"
            title="Notes de frais"
            className={cn(
              'flex items-center justify-center p-2.5 rounded-lg transition-colors duration-150',
              pathname === '/st/notes-frais' || pathname.startsWith('/st/notes-frais/')
                ? 'bg-gray-900 text-white'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <Receipt className="w-4 h-4 flex-shrink-0" />
          </Link>
        ) : (
          <Link
            href="/st/notes-frais"
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
              pathname === '/st/notes-frais' || pathname.startsWith('/st/notes-frais/')
                ? 'bg-gray-900 text-white'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <Receipt className="w-4 h-4 flex-shrink-0" />
            Notes de frais
          </Link>
        )}

        {/* Todo List */}
        {collapsed ? (
          <Link
            href="/st/todo"
            title="Todo List"
            className={cn(
              'flex items-center justify-center p-2.5 rounded-lg transition-colors duration-150',
              pathname === '/st/todo' || pathname.startsWith('/st/todo/')
                ? 'bg-gray-900 text-white'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <ListTodo className="w-4 h-4 flex-shrink-0" />
          </Link>
        ) : (
          <Link
            href="/st/todo"
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
              pathname === '/st/todo' || pathname.startsWith('/st/todo/')
                ? 'bg-gray-900 text-white'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <ListTodo className="w-4 h-4 flex-shrink-0" />
            Todo List
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
                ? 'bg-gray-900 text-white'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
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
                ? 'bg-gray-900 text-white'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
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
                ? 'bg-gray-900 text-white'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
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
                ? 'bg-gray-900 text-white'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
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

        {/* Paramètres */}
        {collapsed ? (
          <Link
            href="/st/parametres"
            title="Paramètres"
            className={cn(
              'flex items-center justify-center p-2.5 rounded-lg transition-colors duration-150',
              pathname === '/st/parametres' || pathname.startsWith('/st/parametres/')
                ? 'bg-gray-900 text-white'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <Settings className="w-4 h-4 flex-shrink-0" />
          </Link>
        ) : (
          <Link
            href="/st/parametres"
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
              pathname === '/st/parametres' || pathname.startsWith('/st/parametres/')
                ? 'bg-gray-900 text-white'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <Settings className="w-4 h-4 flex-shrink-0" />
            Paramètres
          </Link>
        )}
      </nav>

      {/* User footer */}
      <div className={`border-t border-gray-200 ${collapsed ? 'px-2 py-3' : 'px-4 py-4 space-y-3'}`}>
        {profil && (
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-xs font-semibold text-white flex-shrink-0">
              {initiales}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{profil.prenom} {profil.nom}</p>
                <p className="text-xs text-gray-500 truncate">Sous-traitant</p>
              </div>
            )}
          </div>
        )}
        {!collapsed && (
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Se déconnecter
          </button>
        )}
        {collapsed && (
          <button
            onClick={handleLogout}
            title="Se déconnecter"
            className="w-full flex items-center justify-center p-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors mt-2"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </ResponsiveSidebar>
  )
}
