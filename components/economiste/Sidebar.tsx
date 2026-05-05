'use client'

import {
  LayoutDashboard, FolderOpen, Library, Rocket, Hammer,
  Receipt, ListTodo, FileText, MessageSquare, Settings,
} from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { useDocumentsBadge } from '@/hooks/useDocumentsBadge'
import { useChatBadge } from '@/hooks/useChatBadge'
import { RoleSidebar } from '@/components/shared/RoleSidebar'

export function EconomisteSidebar() {
  const { user } = useUser()
  const { unreadCount: docsBadge } = useDocumentsBadge(user?.id ?? null)
  const { unreadCount: chatBadge } = useChatBadge(user?.id ?? null)

  const navLinks = [
    { label: 'Tableau de bord', href: '/economiste/dashboard',    icon: LayoutDashboard },
    { label: 'Mes projets',     href: '/economiste/projets',      icon: FolderOpen },
    { label: 'Bibliotheque',    href: '/economiste/bibliotheque', icon: Library },
    { label: 'Lancement',       href: '/economiste/lancement',    icon: Rocket },
    { label: 'Chantier',        href: '/economiste/chantier',     icon: Hammer },
    { label: 'Notes de frais',  href: '/economiste/notes-frais',  icon: Receipt },
    { label: 'Todo List',       href: '/economiste/todo',         icon: ListTodo },
    { label: 'Documents',       href: '/economiste/documents',    icon: FileText,      badge: docsBadge },
    { label: 'Messages',        href: '/economiste/chat',         icon: MessageSquare, badge: chatBadge },
    { label: 'Parametres',      href: '/economiste/parametres',   icon: Settings },
  ]
  return <RoleSidebar navLinks={navLinks} roleLabel="Economiste" />
}
