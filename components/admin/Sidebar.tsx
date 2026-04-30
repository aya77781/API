'use client'

import {
  LayoutDashboard, Users, FolderOpen, Receipt, ListTodo,
  MessageSquare, MessagesSquare, FileText, Library, Bell, Settings, History, Archive,
} from 'lucide-react'
import { RoleSidebar } from '@/components/shared/RoleSidebar'

export function AdminSidebar() {
  const navLinks = [
    { label: 'Tableau de bord',   href: '/admin/dashboard',    icon: LayoutDashboard },
    { label: 'Utilisateurs',      href: '/admin/users',        icon: Users },
    { label: 'Projets',           href: '/admin/projets',      icon: FolderOpen },
    { label: 'Historique',        href: '/admin/historique',   icon: Archive },
    { label: 'Notes de frais',    href: '/admin/notes-frais',  icon: Receipt },
    { label: 'Todo List',         href: '/admin/todo',         icon: ListTodo },
    { label: 'Chat',              href: '/admin/chat',         icon: MessageSquare },
    { label: 'Groupes de chat',   href: '/admin/groupes',      icon: MessagesSquare },
    { label: 'Documents',         href: '/admin/documents',    icon: FileText },
    { label: 'Bibliotheque',      href: '/admin/bibliotheque', icon: Library },
    { label: 'Alertes',           href: '/admin/alertes',      icon: Bell },
    { label: 'API historique',    href: '/admin/api-historique', icon: History },
    { label: 'Parametres',        href: '/admin/parametres',   icon: Settings },
  ]
  return <RoleSidebar navLinks={navLinks} roleLabel="Admin" />
}
