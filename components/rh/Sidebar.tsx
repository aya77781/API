'use client'

import {
  LayoutDashboard, FolderOpen, UserPlus, UserCheck, Users, Briefcase,
  CreditCard, Receipt, ListTodo, FileText, MessageSquare, Settings,
} from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { useDocumentsBadge } from '@/hooks/useDocumentsBadge'
import { useChatBadge } from '@/hooks/useChatBadge'
import { RoleSidebar } from '@/components/shared/RoleSidebar'

export function RHSidebar() {
  const { user } = useUser()
  const { unreadCount: docsBadge } = useDocumentsBadge(user?.id ?? null)
  const { unreadCount: chatBadge } = useChatBadge(user?.id ?? null)

  const navLinks = [
    { label: 'Tableau de bord', href: '/rh/dashboard',     icon: LayoutDashboard },
    { label: 'Projets',         href: '/rh/projets',       icon: FolderOpen },
    { label: 'Recrutement',     href: '/rh/recrutement',   icon: UserPlus },
    { label: 'Onboarding',      href: '/rh/onboarding',    icon: UserCheck },
    { label: 'Vie Sociale',     href: '/rh/vie-sociale',   icon: Users },
    { label: 'Transverse',      href: '/rh/transverse',    icon: Briefcase },
    { label: 'Paie',            href: '/rh/paie',          icon: CreditCard },
    { label: 'Notes de frais',  href: '/rh/notes-frais',   icon: Receipt },
    { label: 'Todo List',       href: '/rh/todo',          icon: ListTodo },
    { label: 'Documents',       href: '/rh/documents',     icon: FileText,      badge: docsBadge },
    { label: 'Messages',        href: '/rh/chat',          icon: MessageSquare, badge: chatBadge },
    { label: 'Parametres',      href: '/rh/parametres',    icon: Settings },
  ]
  return <RoleSidebar navLinks={navLinks} roleLabel="RH" />
}
