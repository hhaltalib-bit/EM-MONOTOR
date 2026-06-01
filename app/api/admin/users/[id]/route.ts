import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/utils/rateLimit'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const { allowed } = rateLimit(`admin-${ip}`, 10, 60000)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: callerProfile } = await (svc.from('user_profiles') as any).select('role').eq('user_id', user.id).single()
  if (callerProfile?.role !== 'Admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  if (id === user.id) return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
  const { error } = await svc.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: callerProfile } = await (svc.from('user_profiles') as any).select('role').eq('user_id', user.id).single()
  if (callerProfile?.role !== 'Admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { password } = await req.json() as { password: string }
  if (!password || password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
  const { error } = await svc.auth.admin.updateUserById(id, { password })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
