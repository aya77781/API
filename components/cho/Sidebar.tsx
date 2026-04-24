'use client'

import {
  LayoutDashboard, FolderOpen, Heart, Calendar, Home,
  FileText, Receipt, ListTodo, MessageSquare, Settings,
} from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { useDocumentsBadge } from '@/hooks/useDocumentsBadge'
import { useChatBadge } from '@/hooks/useChatBadge'
import { RoleSidebar } from '@/components/shared/RoleSidebar'

export function CHOSidebar() {
  const { user } = useUser()
  const { unreadCount: docsBadge } = useDocumentsBadge(user?.id ?? null)
  const { unreadCount: chatBadge } = useChatBadge(user?.id ?? null)

  const navLinks = [
    { label: 'Tableau de bord', href: '/cho/dashboard',     icon: LayoutDashboard },
    { label: 'Projets',         href: '/cho/projets',       icon: FolderOpen },
    { label: 'Climat Social',   href: '/cho/climat-social', icon: Heart },
    { label: 'Evenementiel',    href: '/cho/evenementiel',  icon: Calendar },
    { label: 'Cadre de Vie',    href: '/cho/cadre-vie',     icon: Home },
    { label: 'Processus',       href: '/cho/processus',     icon: FileText },
    { label: 'Notes de frais',  href: '/cho/notes-frais',   icon: Receipt },
    { label: 'Todo List',       href: '/cho/todo',          icon: ListTodo },
    { label: 'Documents',       href: '/cho/documents',     icon: FileText,      badge: docsBadge },
    { label: 'Messages',        href: '/cho/chat',          icon: MessageSquare, badge: chatBadge },
    { label: 'Parametres',      href: '/cho/parametres',    icon: Settings },
  ]
  return <RoleSidebar navLinks={navLinks} roleLabel="CHO" />
}
