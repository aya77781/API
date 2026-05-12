'use client'

import {
  LayoutDashboard, FolderOpen, FileText, MessageSquare, ListTodo,
  Receipt, Settings, Calendar, Rocket, Hammer,
} from 'lucide-react'
import { RoleSidebar } from '@/components/shared/RoleSidebar'

export function Sidebar() {
  const navLinks = [
    { label: 'Tableau de bord', href: '/co/dashboard',    icon: LayoutDashboard },
    { label: 'Projets',         href: '/co/projets',      icon: FolderOpen },
    { label: 'Lancement',       href: '/co/lancement',    icon: Rocket },
    { label: 'Chantier',        href: '/co/chantier',     icon: Hammer },
    { label: 'Planning',        href: '/co/planning',     icon: Calendar },
    { label: 'Notes de frais',  href: '/co/notes-frais',  icon: Receipt },
    { label: 'Todo List',       href: '/co/todo',         icon: ListTodo },
    { label: 'Documents',       href: '/co/documents',    icon: FileText },
    { label: 'Messages',        href: '/co/chat',         icon: MessageSquare },
    { label: 'Parametres',      href: '/co/parametres',   icon: Settings },
  ]
  return <RoleSidebar navLinks={navLinks} roleLabel="Charge d'Operations" />
}
