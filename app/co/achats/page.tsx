import { Suspense } from 'react'
import { TopBar } from '@/components/co/TopBar'
import { AchatsFlow } from '@/components/co/achats/AchatsFlow'

export default function AchatsPage() {
  return (
    <div>
      <TopBar
        title="Achats"
        subtitle="Consultation des sous-traitants et attribution des lots"
      />
      <div className="p-4 sm:p-6">
        <Suspense fallback={<div className="h-32 bg-gray-100 rounded-xl animate-pulse" />}>
          <AchatsFlow />
        </Suspense>
      </div>
    </div>
  )
}
