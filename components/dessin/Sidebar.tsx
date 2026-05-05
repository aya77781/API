'use client'

import {
  LayoutDashboard, FolderOpen, Library, Rocket,
  Hammer, Receipt, ListTodo, FileText, MessageSquare, Settings,
} from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { useDocumentsBadge } from '@/hooks/useDocumentsBadge'
import { useChatBadge } from '@/hooks/useChatBadge'
import { RoleSidebar } from '@/components/shared/RoleSidebar'

export function DessinSidebar() {
  const { user } = useUser()
  const { unreadCount: docsBadge } = useDocumentsBadge(user?.id ?? null)
  const { unreadCount: chatBadge } = useChatBadge(user?.id ?? null)

  const navLinks = [
    { label: 'Tableau de bord', href: '/dessin/dashboard',    icon: LayoutDashboard },
    { label: 'Projets',         href: '/dessin/projets',      icon: FolderOpen },
    { label: 'Bibliotheque',    href: '/dessin/bibliotheque', icon: Library },
    { label: 'Lancement',       href: '/dessin/lancement',    icon: Rocket },
    { label: 'Chantier',        href: '/dessin/chantier',     icon: Hammer },
    { label: 'Notes de frais',  href: '/dessin/notes-frais',  icon: Receipt },
    { label: 'Todo List',       href: '/dessin/todo',         icon: ListTodo },
    { label: 'Documents',       href: '/dessin/documents',    icon: FileText,      badge: docsBadge },
    { label: 'Messages',        href: '/dessin/chat',         icon: MessageSquare, badge: chatBadge },
    { label: 'Parametres',      href: '/dessin/parametres',   icon: Settings },
  ]
  return <RoleSidebar navLinks={navLinks} roleLabel="Dessinatrice" />
}
