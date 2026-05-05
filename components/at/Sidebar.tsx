'use client'

import {
  LayoutDashboard, FolderOpen, UserCheck, CreditCard, Landmark,
  FolderCheck, Receipt, ListTodo, FileText, MessageSquare, Settings,
} from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { useDocumentsBadge } from '@/hooks/useDocumentsBadge'
import { useChatBadge } from '@/hooks/useChatBadge'
import { RoleSidebar } from '@/components/shared/RoleSidebar'
import { Abbr } from '@/components/shared/Abbr'

export function ATSidebar() {
  const { user } = useUser()
  const { unreadCount: docsBadge } = useDocumentsBadge(user?.id ?? null)
  const { unreadCount: chatBadge } = useChatBadge(user?.id ?? null)

  const navLinks = [
    { label: 'Tableau de bord', href: '/at/dashboard',        icon: LayoutDashboard },
    { label: 'Projets',         href: '/at/projets',          icon: FolderOpen },
    { label: <>Onboarding <Abbr k="ST" /></>, href: '/at/onboarding-st',    icon: UserCheck },
    { label: 'Admin Financiere',              href: '/at/admin-financiere', icon: CreditCard },
    { label: 'Compte prorata',                href: '/at/compte-prorata',   icon: Landmark },
    { label: <>Cloture <Abbr k="DOE" /></>,   href: '/at/cloture-doe',      icon: FolderCheck },
    { label: 'Notes de frais',  href: '/at/notes-frais',      icon: Receipt },
    { label: 'Todo List',       href: '/at/todo',             icon: ListTodo },
    { label: 'Documents',       href: '/at/documents',        icon: FileText,      badge: docsBadge },
    { label: 'Messages',        href: '/at/chat',             icon: MessageSquare, badge: chatBadge },
    { label: 'Parametres',      href: '/at/parametres',       icon: Settings },
  ]
  return <RoleSidebar navLinks={navLinks} roleLabel="Assistant Travaux" />
}
