'use client'

import {
  LayoutDashboard, FolderOpen, TrendingUp, Users, BarChart2,
  Receipt, ListTodo, FileText, MessageSquare, Settings,
} from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { useDocumentsBadge } from '@/hooks/useDocumentsBadge'
import { useChatBadge } from '@/hooks/useChatBadge'
import { RoleSidebar } from '@/components/shared/RoleSidebar'

export function GerantSidebar() {
  const { user } = useUser()
  const { unreadCount: docsBadge } = useDocumentsBadge(user?.id ?? null)
  const { unreadCount: chatBadge } = useChatBadge(user?.id ?? null)

  const navLinks = [
    { label: 'Tableau de bord', href: '/gerant/dashboard',  icon: LayoutDashboard },
    { label: 'Projets',         href: '/gerant/projets',    icon: FolderOpen },
    { label: 'Finance',         href: '/gerant/finance',    icon: TrendingUp },
    { label: 'Equipe',          href: '/gerant/equipe',     icon: Users },
    { label: 'Reporting',       href: '/gerant/reporting',  icon: BarChart2 },
    { label: 'Notes de frais',  href: '/gerant/notes-frais',icon: Receipt },
    { label: 'Todo List',       href: '/gerant/todo',       icon: ListTodo },
    { label: 'Documents',       href: '/gerant/documents',  icon: FileText,      badge: docsBadge },
    { label: 'Messages',        href: '/gerant/chat',       icon: MessageSquare, badge: chatBadge },
    { label: 'Parametres',      href: '/gerant/parametres', icon: Settings },
  ]
  return <RoleSidebar navLinks={navLinks} roleLabel="Gerant" />
}
