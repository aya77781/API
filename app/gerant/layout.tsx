import { GerantSidebar } from '@/components/gerant/Sidebar'

export default function GerantLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <GerantSidebar />
      <div className="pl-64 flex flex-col min-h-screen">
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
