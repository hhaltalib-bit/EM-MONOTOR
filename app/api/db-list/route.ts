import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { DbRegistry } from '@/types'
import { requireAuth } from '@/lib/auth/requireAuth'

export async function GET(_request: NextRequest) {
  const auth = await requireAuth(false)
  if (!auth.ok) return auth.response

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('db_registry')
    .select('*')
    .eq('is_active', true)
    .order('db_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ databases: (data ?? []) as DbRegistry[] })
}
