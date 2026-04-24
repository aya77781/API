'use client'

import { useState, useEffect } from 'react'
import {
  LayoutDashboard, BookOpen, Receipt, Wallet, BadgeEuro, TrendingUp,
  CreditCard, Scale, Users, ListTodo, FileText, MessageSquare, Settings,
} from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { useChatBadge } from '@/hooks/useChatBadge'
import { createClient } from '@/lib/supabase/client'
import { RoleSidebar } from '@/components/shared/RoleSidebar'

export function ComptaSidebar() {
  const { user } = useUser()
  const { unreadCount: chatBadge } = useChatBadge(user?.id ?? null)
  const [stBadge, setStBadge] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    async function fetchBadge() {
      const { count } = await supabase
        .from('depenses')
        .select('id', { count: 'exact', head: true })
        .eq('statut', 'attente_validation_co')
      setStBadge(count ?? 0)
    }
    fetchBadge()
    const interval = setInterval(fetchBadge, 60000)
    return () => clearInterval(interval)
  }, [])

  const navLinks = [
    { label: 'Tableau de bord', href: '/compta/dashboard',     icon: LayoutDashboard },
    { label: 'Comptabilite',    href: '/compta/comptabilite',  icon: BookOpen },
    { label: 'Depenses',        href: '/compta/depenses',      icon: Receipt },
    { label: 'Revenus',         href: '/compta/revenus',       icon: Wallet },
    { label: 'Salaires',        href: '/compta/salaires',      icon: BadgeEuro },
    { label: 'Tresorerie',      href: '/compta/tresorerie',    icon: TrendingUp },
    { label: 'Reglements',      href: '/compta/reglements',    icon: CreditCard },
    { label: 'Arbitrage',       href: '/compta/arbitrage',     icon: Scale },
    { label: 'Gestion ST',      href: '/compta/gestion-st',    icon: Users,           badge: stBadge },
    { label: 'Notes de frais',  href: '/compta/notes-frais',   icon: Receipt },
    { label: 'Todo List',       href: '/compta/todo',          icon: ListTodo },
    { label: 'Documents',       href: '/compta/documents',     icon: FileText },
    { label: 'Messages',        href: '/compta/chat',          icon: MessageSquare,   badge: chatBadge },
    { label: 'Parametres',      href: '/compta/parametres',    icon: Settings },
  ]
  return <RoleSidebar navLinks={navLinks} roleLabel="Comptable" />
}
