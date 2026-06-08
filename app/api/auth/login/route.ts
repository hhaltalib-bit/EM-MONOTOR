import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, createClient } from '@/lib/supabase/server'

const MAX_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15

export async function POST(req: NextRequest) {
  let email: string
  let password: string
  try {
    const body = await req.json() as { email?: string; password?: string }
    email = body.email ?? ''
    password = body.password ?? ''
  } catch {
    return NextResponse.json({ error: 'invalid_credentials', attemptsLeft: MAX_ATTEMPTS }, { status: 401 })
  }

  if (!email || !password) {
    return NextResponse.json({ error: 'invalid_credentials', attemptsLeft: MAX_ATTEMPTS }, { status: 401 })
  }

  const svc = createServiceClient()

  // Step 1: Find user profile by email
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (svc.from('user_profiles') as any)
    .select('user_id, failed_attempts, locked_until')
    .eq('email', email)
    .single()

  // Step 2: Check if account is locked
  const now = new Date()
  if (profile?.locked_until && new Date(profile.locked_until) > now) {
    const minutesLeft = Math.ceil(
      (new Date(profile.locked_until).getTime() - now.getTime()) / 60000
    )
    return NextResponse.json({ error: 'account_locked', minutesLeft }, { status: 423 })
  }

  // If lockout has expired, reset failed_attempts
  if (profile?.locked_until && new Date(profile.locked_until) <= now) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('user_profiles') as any)
      .update({ failed_attempts: 0, locked_until: null })
      .eq('user_id', profile.user_id)
    profile.failed_attempts = 0
    profile.locked_until = null
  }

  // Step 3: Attempt Supabase login (SSR client sets session cookies on the response)
  const authClient = await createClient()
  const { error: authError } = await authClient.auth.signInWithPassword({ email, password })

  if (authError) {
    // Step 4a: Login failed — increment attempts, possibly lock
    const newAttempts = (profile?.failed_attempts ?? 0) + 1

    if (profile?.user_id) {
      if (newAttempts >= MAX_ATTEMPTS) {
        const lockedUntil = new Date(now.getTime() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (svc.from('user_profiles') as any)
          .update({ failed_attempts: newAttempts, locked_until: lockedUntil, last_failed_at: now.toISOString() })
          .eq('user_id', profile.user_id)
        return NextResponse.json({ error: 'account_locked', minutesLeft: LOCKOUT_MINUTES }, { status: 423 })
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('user_profiles') as any)
        .update({ failed_attempts: newAttempts, last_failed_at: now.toISOString() })
        .eq('user_id', profile.user_id)
    }

    return NextResponse.json(
      { error: 'invalid_credentials', attemptsLeft: MAX_ATTEMPTS - newAttempts },
      { status: 401 }
    )
  }

  // Step 4b: Login succeeded — reset lockout state
  if (profile?.user_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('user_profiles') as any)
      .update({ failed_attempts: 0, locked_until: null })
      .eq('user_id', profile.user_id)
  }

  return NextResponse.json({ success: true })
}
