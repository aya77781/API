import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function adminCreateUser(payload: {
  email: string
  password: string
  email_confirm?: boolean
  user_metadata?: Record<string, unknown>
}) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({
      email: payload.email,
      password: payload.password,
      email_confirm: payload.email_confirm ?? true,
      user_metadata: payload.user_metadata ?? {},
    }),
  })
  const data = await res.json()
  if (!res.ok) return { data: null, error: data }
  return { data: { user: data }, error: null }
}

export async function adminDeleteUser(userId: string) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
  })
  if (!res.ok) {
    const data = await res.json()
    return { error: data }
  }
  return { error: null }
}

export async function adminUpdateUser(userId: string, payload: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) return { error: data }
  return { data, error: null }
}
