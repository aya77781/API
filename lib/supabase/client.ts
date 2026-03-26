import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

type SupabaseClient = ReturnType<typeof createBrowserClient<Database>>

// Store on globalThis so the instance survives HMR module reloads in dev
declare global {
  // eslint-disable-next-line no-var
  var __supabase_instance: SupabaseClient | undefined
}

export function createClient(): SupabaseClient {
  if (!globalThis.__supabase_instance) {
    globalThis.__supabase_instance = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return globalThis.__supabase_instance
}
