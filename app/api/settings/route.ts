// Required SQL (run in Supabase SQL editor before deploying):
// CREATE TABLE IF NOT EXISTS system_settings (
//   id int PRIMARY KEY DEFAULT 1,
//   alert_email text,
//   expected_report_time text DEFAULT '01:30',
//   missing_alert_delay int DEFAULT 30
// );
// INSERT INTO system_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data } = await svc.from('system_settings').select('*').limit(1).single()

  return NextResponse.json({
    alert_email: data?.alert_email ?? '',
    expected_report_time: data?.expected_report_time ?? '01:30',
    missing_alert_delay: data?.missing_alert_delay ?? 30,
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    alert_email?: string
    expected_report_time?: string
    missing_alert_delay?: number
  }

  const svc = createServiceClient()
  const { error } = await svc.from('system_settings').upsert({ id: 1, ...body })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
