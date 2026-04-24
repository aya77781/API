'use client'

import dynamic from 'next/dynamic'

// Charge le dashboard cote client uniquement -- evite tout hydration mismatch
const DashboardClient = dynamic(() => import('./DashboardClient'), {
  ssr: false,
  loading: () => (
    <div>
      <div className="h-14 sm:h-16 bg-white border-b border-gray-200" />
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    </div>
  ),
})

export default function CommercialDashboardPage() {
  return <DashboardClient />
}
