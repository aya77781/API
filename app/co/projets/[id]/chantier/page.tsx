import { Construction } from 'lucide-react'

interface PageProps {
  params: { id: string }
}

export default function ChantierPage(_props: PageProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-card p-10 text-center">
      <Construction className="w-10 h-10 text-gray-200 mx-auto mb-4" />
      <h2 className="text-sm font-semibold text-gray-700">Phase Chantier</h2>
      <p className="text-xs text-gray-400 mt-2 max-w-sm mx-auto">Comptes rendus, planning Gantt, réserves, prorata</p>
    </div>
  )
}
