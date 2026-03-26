import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

// Singleton — one instance per browser tab to avoid Web Locks conflicts
let instance: ReturnType<typeof createBrowserClient<Database>> | null = null

export function createClient() {
  if (!instance) {
    instance = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return instance
}
