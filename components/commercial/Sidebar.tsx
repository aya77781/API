'use client'

import {
  LayoutDashboard, FolderOpen, FolderPlus, FileText, MessageSquare,
  ListTodo, Receipt, Target, Gavel, Settings,
} from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { useDocumentsBadge } from '@/hooks/useDocumentsBadge'
import { useChatBadge } from '@/hooks/useChatBadge'
import { RoleSidebar } from '@/components/shared/RoleSidebar'

export function CommercialSidebar() {
  const { user } = useUser()
  const { unreadCount: docsBadge } = useDocumentsBadge(user?.id ?? null)
  const { unreadCount: chatBadge } = useChatBadge(user?.id ?? null)

  const navLinks = [
    { label: 'Tableau de bord', href: '/commercial/dashboard',         icon: LayoutDashboard },
    { label: 'Mes projets',     href: '/commercial/projets',           icon: FolderOpen },
    { label: 'Prospection',     href: '/commercial/prospection',       icon: Target },
    { label: 'Marches publics', href: '/commercial/marches-publics',   icon: Gavel },
    { label: 'Nouveau dossier', href: '/commercial/projets/nouveau',   icon: FolderPlus },
    { label: 'Notes de frais',  href: '/commercial/notes-frais',       icon: Receipt },
    { label: 'Todo List',       href: '/commercial/todo',              icon: ListTodo },
    { label: 'Documents',       href: '/commercial/documents',         icon: FileText,      badge: docsBadge },
    { label: 'Messages',        href: '/commercial/chat',              icon: MessageSquare, badge: chatBadge },
    { label: 'Parametres',      href: '/commercial/parametres',        icon: Settings },
  ]

  // Override pour eviter le conflit "Mes projets" actif aussi sur "Nouveau dossier"
  function isActiveOverride(href: string, pathname: string): boolean | undefined {
    if (href === '/commercial/projets') {
      return pathname.startsWith('/commercial/projets') && !pathname.includes('/nouveau')
    }
    return undefined
  }

  return <RoleSidebar navLinks={navLinks} roleLabel="Commercial" isActiveOverride={isActiveOverride} />
}
