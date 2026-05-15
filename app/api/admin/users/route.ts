import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  return NextResponse.json({ users, currentUserId: user.id })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { email, password, role, display_name } = await req.json() as {
    email: string; password: string; role?: string; display_name?: string
  }
  if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 })

  const svc = createServiceClient()
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

  return NextResponse.json({ user: { id: newUser.id, email, role: role ?? 'DBA', display_name: display_name ?? email.split('@')[0] } })
}
