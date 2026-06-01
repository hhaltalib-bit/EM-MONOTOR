import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/utils/rateLimit'
import { requireAuth } from '@/lib/auth/requireAuth'
import { writeAudit } from '@/lib/utils/auditLog'

export async function GET(_req: NextRequest) {
  const auth = await requireAuth(true)
  if (!auth.ok) return auth.response

  const svc = createServiceClient()
  const { data: authData, error } = await svc.auth.admin.listUsers({ perPage: 200 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profiles } = await (svc.from('user_profiles') as any).select('*')
  const profileMap = new Map(((profiles ?? []) as Record<string, unknown>[]).map(p => [p.user_id as string, p]))

  const users = authData.users.map(u => ({
    id: u.id,
    email: u.email ?? '',
    created_at: u.created_at,
    role: (profileMap.get(u.id) as Record<string, unknown> | undefined)?.role ?? 'DBA',
    display_name: (profileMap.get(u.id) as Record<string, unknown> | undefined)?.display_name ?? u.email?.split('@')[0] ?? '',
  }))

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
