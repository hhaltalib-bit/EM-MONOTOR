import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const checks: Record<string, string> = {}
  let healthy = true

  try {
    const supabase = createServiceClient()
    const { error } = await supabase
      .from('db_registry').select('db_key').limit(1)
    checks.database = error ? 'down' : 'ok'
    if (error) healthy = false
  } catch {
    checks.database = 'down'
    healthy = false
  }

  return NextResponse.json(
    { status: healthy ? 'ok' : 'degraded', checks, timestamp: new Date().toISOString() },
    { status: healthy ? 200 : 503 }
  )
}
