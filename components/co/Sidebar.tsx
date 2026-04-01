'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  FolderOpen,
  FileText,
  LogOut,
  MessageSquare,
  ListTodo,
  ClipboardList,
  ShoppingCart,
  ClipboardCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const { profil } = useUser()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initiales = profil
    ? `${profil.prenom?.[0] ?? ''}${profil.nom?.[0] ?? ''}`.toUpperCase()
    : 'CO'

  function navItem(href: string, label: string, Icon: React.ElementType) {
    const isActive = pathname === href || pathname.startsWith(href + '/')
    return (
      <Link
        key={href}
        href={href}
        className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
          isActive
            ? 'bg-gray-900 text-white'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
        )}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span>{label}</span>
      </Link>
    )
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-100">
        <Image src="/logo.png" alt="API" width={48} height={48} className="object-contain flex-shrink-0" priority />
        <span className="ml-2 font-semibold text-gray-900 truncate">API</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {navItem('/co/dashboard', 'Tableau de bord', LayoutDashboard)}
        {navItem('/co/projets',   'Projets',          FolderOpen)}
        {navItem('/co/achats',       'Achats',             ShoppingCart)}
        {navItem('/co/preparation', 'Préparation',       ClipboardCheck)}
        {navItem('/co/visite',      'Visite chantier',   ClipboardList)}
        {navItem('/co/todo',        'Todo List',         ListTodo)}
        {navItem('/co/documents', 'Documents',        FileText)}
        {navItem('/co/chat',      'Messages',         MessageSquare)}
      </nav>

      {/* User footer */}
      <div className="border-t border-gray-100 px-4 py-4 space-y-3">
        {profil && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0">
              {initiales}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{profil.prenom} {profil.nom}</p>
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
