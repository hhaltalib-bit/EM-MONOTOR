import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export type AuthResult =
  | { ok: true; user: { id: string; email?: string }; role: string | null }
  | { ok: false; response: NextResponse }

export async function requireAuth(adminOnly = false): Promise<AuthResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  let role: string | null = null
  if (adminOnly) {
    const svc = createServiceClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (svc.from('user_profiles') as any)
      .select('role').eq('user_id', user.id).single()
    role = profile?.role ?? null
    if (role !== 'Admin') {
      return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
    }
  }
  return { ok: true, user, role }
}
