import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/utils/rateLimit'
import { requireAuth } from '@/lib/auth/requireAuth'
import { writeAudit } from '@/lib/utils/auditLog'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const { allowed } = rateLimit(`admin-${ip}`, 10, 60000)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const auth = await requireAuth(true)
  if (!auth.ok) return auth.response

  const svc = createServiceClient()
  const { id } = await params
  if (id === auth.user.id) return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
  const { error } = await svc.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAudit({ actorId: auth.user.id, actorEmail: auth.user.email, action: 'user.delete', target: id, ip })

  return NextResponse.json({ success: true })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(true)
  if (!auth.ok) return auth.response

  const svc = createServiceClient()
  const { id } = await params
  const { password } = await req.json() as { password: string }
  if (!password || password.length < 12) return NextResponse.json({ error: 'Password must be at least 12 characters' }, { status: 400 })
  const { error } = await svc.auth.admin.updateUserById(id, { password })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // SEC-H-03: invalidate all existing sessions for this user
  try {
    await svc.auth.admin.signOut(id, 'global')
  } catch (err) {
    console.error('[admin-patch] session invalidation failed:', err)
  }

  const ip = req.headers.get('x-forwarded-for') ?? undefined
  await writeAudit({ actorId: auth.user.id, actorEmail: auth.user.email, action: 'user.password_change', target: id, ip })

  return NextResponse.json({ success: true })
}
