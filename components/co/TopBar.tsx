'use client'

import { useState } from 'react'
import { Bell, Search } from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { useNotifications } from '@/hooks/useNotifications'
import { NotificationPanel } from '@/components/shared/NotificationPanel'

interface TopBarProps {
  title?: string
  subtitle?: string
}

export function TopBar({ title, subtitle }: TopBarProps) {
  const { user } = useUser()
  const { unreadCount } = useNotifications(user?.id ?? null)
  const [panelOpen, setPanelOpen] = useState(false)

  return (
    <>
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
        <div>
          {title && <h1 className="text-base font-semibold text-gray-900">{title}</h1>}
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <Search className="w-4 h-4" />
          </button>
          <button
            onClick={() => setPanelOpen(true)}
            className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-0.5">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <NotificationPanel
        userId={user?.id ?? null}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
      />
    </>
  )
}
