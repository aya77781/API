import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

type SupabaseClient = ReturnType<typeof createBrowserClient<Database>>

// Store on globalThis so the instance survives HMR module reloads in dev
declare global {
  // eslint-disable-next-line no-var
  var __supabase_instance: SupabaseClient | undefined
  // eslint-disable-next-line no-var
  var __supabase_lock_tail: Promise<unknown> | undefined
}

// In-memory serializer for auth ops.
// Replaces the default Web Locks API (which throws "Lock broken by … steal" in
// Next.js dev under HMR) and the built-in processLock (which has a timeout that
// fires when a single slow request blocks the queue). No timeout here — ops
// just wait their turn, forever if needed.
async function memoryLock<R>(
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>,
): Promise<R> {
  const previous = globalThis.__supabase_lock_tail ?? Promise.resolve()
  const next = previous.catch(() => {}).then(fn)
  globalThis.__supabase_lock_tail = next.catch(() => {})
  return next
}

export function createClient(): SupabaseClient {
  if (!globalThis.__supabase_instance) {
    globalThis.__supabase_instance = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { lock: memoryLock } },
    )
  }
  return globalThis.__supabase_instance
}
