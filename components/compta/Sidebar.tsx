'use client'

import {
  LayoutDashboard, BookOpen, BadgeEuro, TrendingUp,
  ListTodo, FileText, MessageSquare, Settings, FolderOpen,
} from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { useChatBadge } from '@/hooks/useChatBadge'
import { RoleSidebar } from '@/components/shared/RoleSidebar'

export function ComptaSidebar() {
  const { user } = useUser()
  const { unreadCount: chatBadge } = useChatBadge(user?.id ?? null)

  const navLinks = [
    { label: 'Tableau de bord', href: '/compta/dashboard',     icon: LayoutDashboard },
    { label: 'Projets',         href: '/compta/projets',       icon: FolderOpen },
    { label: 'Comptabilite',    href: '/compta/comptabilite',  icon: BookOpen },
    { label: 'Salaires',        href: '/compta/salaires',      icon: BadgeEuro },
    { label: 'Tresorerie',      href: '/compta/tresorerie',    icon: TrendingUp },
    { label: 'Todo List',       href: '/compta/todo',          icon: ListTodo },
    { label: 'Documents',       href: '/compta/documents',     icon: FileText },
    { label: 'Messages',        href: '/compta/chat',          icon: MessageSquare,   badge: chatBadge },
    { label: 'Parametres',      href: '/compta/parametres',    icon: Settings },
  ]
  return <RoleSidebar navLinks={navLinks} roleLabel="Comptable" />
}
