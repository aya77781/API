import { STSidebar } from '@/components/st/Sidebar'

export default function STLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <STSidebar />
      <div className="pl-64 flex flex-col min-h-screen">
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
