'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  FolderOpen,
  MessageSquare,
  FileText,
  Bell,
  Settings,
  LogOut,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  MessagesSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { useSidebarCollapse } from '@/components/shared/SidebarCollapseContext'

const navLinks = [
  { label: 'Tableau de bord',    href: '/admin/dashboard',    icon: LayoutDashboard },
  { label: 'Utilisateurs',       href: '/admin/users',        icon: Users },
  { label: 'Projets',            href: '/admin/projets',      icon: FolderOpen },
  { label: 'Chat',               href: '/admin/chat',         icon: MessageSquare },
  { label: 'Groupes de chat',    href: '/admin/groupes',      icon: MessagesSquare },
  { label: 'Documents',          href: '/admin/documents',    icon: FileText },
  { label: 'Alertes',            href: '/admin/alertes',      icon: Bell },
  { label: 'Paramètres',         href: '/admin/parametres',   icon: Settings },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { profil } = useUser()
  const { collapsed, toggle } = useSidebarCollapse()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initiales = profil
    ? `${profil.prenom?.[0] ?? ''}${profil.nom?.[0] ?? ''}`.toUpperCase()
    : 'AD'

  return (
    <aside className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-gray-200 flex flex-col transition-all duration-300 overflow-hidden ${collapsed ? 'w-16' : 'w-64'}`}>
      {/* Logo */}
      <div className={`h-16 flex items-center border-b border-gray-100 ${collapsed ? 'justify-center px-2' : 'px-6'}`}>
        <Image src="/logo.png" alt="API" width={48} height={48} className="object-contain flex-shrink-0" priority />
        {!collapsed && (
          <span className="ml-2 font-semibold text-gray-900 truncate">API</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {!collapsed && (
          <p className="px-3 mb-2 text-xs font-medium text-gray-400 uppercase tracking-wider">Navigation</p>
        )}
        {navLinks.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
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
                <Icon className="w-4 h-4 flex-shrink-0" />
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
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User + logout */}
      <div className={`border-t border-gray-100 ${collapsed ? 'px-2 py-3' : 'px-4 py-4 space-y-3'}`}>
        {profil && (
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3 px-1'}`}>
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0">
              {initiales}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{profil.prenom} {profil.nom}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <ShieldCheck className="w-3 h-3 text-gray-400" />
                  <p className="text-xs text-gray-400">Administrateur</p>
                </div>
              </div>
            )}
          </div>
        )}
        {!collapsed && (
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Se déconnecter
          </button>
        )}
        {collapsed && (
          <button
            onClick={handleLogout}
            title="Se déconnecter"
            className="w-full flex items-center justify-center p-2.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors mt-2"
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
