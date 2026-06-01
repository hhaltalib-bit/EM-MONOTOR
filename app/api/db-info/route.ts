import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { DbRegistry } from '@/types'
import { requireAuth } from '@/lib/auth/requireAuth'
import { safeFrom } from '@/lib/db/safeTable'

export async function GET(request: NextRequest) {
  const auth = await requireAuth(false)
  if (!auth.ok) return auth.response

  const dbKey = request.nextUrl.searchParams.get('db_key')
  if (!dbKey) return NextResponse.json({ error: 'Missing db_key' }, { status: 400 })

  const svc = createServiceClient()

  const { data: reg, error } = await svc
    .from('db_registry')
    .select('*')
    .eq('db_key', dbKey)
    .single()

  if (error || !reg) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const regTyped = reg as unknown as DbRegistry

  const { data: latest } = await safeFrom(svc, regTyped.table_name)
    .select('report_date')
    .order('report_date', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({
    registry: regTyped,
    latestDate: latest?.report_date ?? null,
  })
}
