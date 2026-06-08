import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/utils/rateLimit'
import { requireAuth } from '@/lib/auth/requireAuth'
import { writeAudit } from '@/lib/utils/auditLog'
import { USER_LIST_LIMIT } from '@/lib/constants'

export async function GET(_req: NextRequest) {
  const auth = await requireAuth(true)
  if (!auth.ok) return auth.response

  const svc = createServiceClient()
  const { data: authData, error } = await svc.auth.admin.listUsers({ perPage: USER_LIST_LIMIT })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profiles } = await (svc.from('user_profiles') as any).select('user_id, role, display_name, failed_attempts, locked_until')
  const profileMap = new Map(((profiles ?? []) as Record<string, unknown>[]).map(p => [p.user_id as string, p]))

  const users = authData.users.map(u => {
    const p = profileMap.get(u.id) as Record<string, unknown> | undefined
    return {
      id: u.id,
      email: u.email ?? '',
      created_at: u.created_at,
      role: p?.role ?? 'DBA',
      display_name: p?.display_name ?? u.email?.split('@')[0] ?? '',
      failed_attempts: (p?.failed_attempts as number) ?? 0,
      locked_until: (p?.locked_until as string | null) ?? null,
    }
  })

  return NextResponse.json({ users, currentUserId: auth.user.id })
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const { allowed } = rateLimit(`admin-${ip}`, 10, 60000)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const auth = await requireAuth(true)
  if (!auth.ok) return auth.response

  const svc = createServiceClient()
  const { email, password, role, display_name } = await req.json() as {
    email: string; password: string; role?: string; display_name?: string
  }
  if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
  const { data: { user: newUser }, error } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!newUser) return NextResponse.json({ error: 'User creation failed' }, { status: 500 })

  // Upsert profile — silently ignore if user_profiles table doesn't exist
  await (svc.from('user_profiles') as any).upsert({  // eslint-disable-line @typescript-eslint/no-explicit-any
    user_id: newUser.id,
    email,
    role: role ?? 'DBA',
    display_name: display_name ?? email.split('@')[0],
  })

  await writeAudit({ actorId: auth.user.id, actorEmail: auth.user.email, action: 'user.create', target: email, ip })

  return NextResponse.json({ user: { id: newUser.id, email, role: role ?? 'DBA', display_name: display_name ?? email.split('@')[0] } })
}
