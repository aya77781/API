import { EconomisteSidebar } from '@/components/economiste/Sidebar'

export default function EconomisteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <EconomisteSidebar />
      <div className="lg:pl-64 flex flex-col min-h-screen">
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
