// Required SQL (run in Supabase SQL editor before deploying):
// CREATE TABLE IF NOT EXISTS system_settings (
//   id int PRIMARY KEY DEFAULT 1,
//   alert_email text,
//   expected_report_time text DEFAULT '01:30',
//   missing_alert_delay int DEFAULT 30
// );
// INSERT INTO system_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/requireAuth'

export async function GET() {
  const auth = await requireAuth(false)
  if (!auth.ok) return auth.response

  const svc = createServiceClient()
  const { data } = await svc.from('system_settings').select('*').limit(1).single()

  return NextResponse.json({
    alert_email: data?.alert_email ?? '',
    expected_report_time: data?.expected_report_time ?? '01:30',
    missing_alert_delay: data?.missing_alert_delay ?? 30,
    warn_threshold: data?.warn_threshold ?? 80,
    crit_threshold: data?.crit_threshold ?? 90,
  })
}

const ALLOWED_KEYS = [
  'alert_email', 'expected_report_time',
  'missing_alert_delay', 'rapid_growth_threshold_gb',
  'warn_threshold', 'crit_threshold',
]

export async function POST(req: NextRequest) {
  const auth = await requireAuth(false)
  if (!auth.ok) return auth.response

  const body = await req.json() as Record<string, unknown>

  for (const key of Object.keys(body)) {
    if (!ALLOWED_KEYS.includes(key)) {
      return NextResponse.json({ error: `Unknown field: ${key}` }, { status: 400 })
    }
  }

  if (body.alert_email !== undefined) {
    if (typeof body.alert_email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.alert_email)) {
      return NextResponse.json({ error: 'alert_email must be a valid email address' }, { status: 400 })
    }
  }

  if (body.missing_alert_delay !== undefined) {
    const v = Number(body.missing_alert_delay)
    if (!Number.isFinite(v) || v < 0 || v > 1440) {
      return NextResponse.json({ error: 'missing_alert_delay must be a number between 0 and 1440' }, { status: 400 })
    }
  }

  if (body.rapid_growth_threshold_gb !== undefined) {
    const v = Number(body.rapid_growth_threshold_gb)
    if (!Number.isFinite(v) || v < 1 || v > 10000) {
      return NextResponse.json({ error: 'rapid_growth_threshold_gb must be a number between 1 and 10000' }, { status: 400 })
    }
  }

  if (body.expected_report_time !== undefined) {
    if (typeof body.expected_report_time !== 'string' || !/^\d{2}:\d{2}$/.test(body.expected_report_time)) {
      return NextResponse.json({ error: 'expected_report_time must match HH:MM format' }, { status: 400 })
    }
  }

  if (body.warn_threshold !== undefined) {
    const v = Number(body.warn_threshold)
    if (!Number.isFinite(v) || v < 50 || v > 99) {
      return NextResponse.json({ error: 'warn_threshold must be a number between 50 and 99' }, { status: 400 })
    }
  }

  if (body.crit_threshold !== undefined) {
    const v = Number(body.crit_threshold)
    if (!Number.isFinite(v) || v < 50 || v > 99) {
      return NextResponse.json({ error: 'crit_threshold must be a number between 50 and 99' }, { status: 400 })
    }
  }

  const svc = createServiceClient()
  const { error } = await svc.from('system_settings').upsert({ id: 1, ...body })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
