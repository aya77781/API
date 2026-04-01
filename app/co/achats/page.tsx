import { TopBar } from '@/components/co/TopBar'
import { AchatsFlow } from '@/components/co/achats/AchatsFlow'

export default function AchatsPage() {
  return (
    <div>
      <TopBar
        title="Achats"
        subtitle="Consultation des sous-traitants et attribution des lots"
      />
      <div className="p-6">
        <AchatsFlow />
      </div>
    </div>
  )
}
