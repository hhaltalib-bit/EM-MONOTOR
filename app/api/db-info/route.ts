import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { DbRegistry } from '@/types'

export async function GET(request: NextRequest) {
  // Require authenticated session
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: latest } = await (svc.from(regTyped.table_name) as any)
    .select('report_date')
    .order('report_date', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({
    registry: regTyped,
    latestDate: latest?.report_date ?? null,
  })
}
