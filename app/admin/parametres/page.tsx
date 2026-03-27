'use client'

import { Settings } from 'lucide-react'

export default function AdminParametresPage() {
  return (
    <div>
      <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Paramètres</h1>
          <p className="text-xs text-gray-400">Configuration de la plateforme</p>
        </div>
      </header>

      <div className="p-6">
        <div className="bg-white border border-gray-200 rounded-xl p-14 flex flex-col items-center text-center">
          <Settings className="w-10 h-10 text-gray-200 mb-3" />
          <p className="text-sm font-medium text-gray-600">Paramètres à venir</p>
          <p className="text-xs text-gray-400 mt-1">Cette section sera disponible prochainement.</p>
        </div>
      </div>
    </div>
  )
}
