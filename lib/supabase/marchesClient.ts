import { createBrowserClient } from '@supabase/ssr'

// Client pour la base secondaire "marches publics"
const MARCHES_URL = 'https://qxxrwxoiqvcfblfassms.supabase.co'
const MARCHES_KEY = 'sb_publishable_OtdupARY86jIzNpv56ic3g_8XsLPoaY'

type MarchesClient = ReturnType<typeof createBrowserClient>

declare global {
  // eslint-disable-next-line no-var
  var __marches_supabase_instance: MarchesClient | undefined
}

export function createMarchesClient(): MarchesClient {
  if (!globalThis.__marches_supabase_instance) {
    globalThis.__marches_supabase_instance = createBrowserClient(MARCHES_URL, MARCHES_KEY)
  }
  return globalThis.__marches_supabase_instance
}
