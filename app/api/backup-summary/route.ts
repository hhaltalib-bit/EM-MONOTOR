import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export interface BackupStatusRow {
  id: string
  report_date: string
  db_key: string
  db_name: string
  backup_type: string | null
  start_time: string | null
  end_time: string | null
  status: string | null
  time_taken: string | null
  output_gb: number | null
  output_device: string | null
  age_days: number
  classification: 'healthy' | 'delayed' | 'failed' | 'ignored'
  created_at: string
}

export interface BackupReportInfo {
  date: string
  receivedAt: string | null
  count: number
  source: string
}

export interface BackupSummaryData {
  latestDate: string | null
  healthy: BackupStatusRow[]
  delayed: BackupStatusRow[]
  failed: BackupStatusRow[]
  ignored: BackupStatusRow[]
  reportInfo: BackupReportInfo | null
}

export async function GET() {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const supabase = createServiceClient()

    const { data: latestRow } = await supabase
      .from('backup_status')
      .select('report_date')
      .order('report_date', { ascending: false })
      .limit(1)
      .single()

    if (!latestRow?.report_date) {
      return NextResponse.json({
        latestDate: null,
        healthy: [],
        delayed: [],
        failed: [],
        ignored: [],
        reportInfo: null,
      } satisfies BackupSummaryData)
    }

    const reportDate = latestRow.report_date as string

    const [{ data: statuses }, { data: logRow }] = await Promise.all([
      supabase.from('backup_status').select('*').eq('report_date', reportDate),
      supabase
        .from('backup_report_log')
        .select('received_at, databases_count')
        .eq('report_date', reportDate)
        .eq('status', 'success')
        .order('received_at', { ascending: false })
        .limit(1)
        .single(),
    ])

    const rows = (statuses as BackupStatusRow[]) || []

    return NextResponse.json({
      latestDate: reportDate,
      healthy: rows.filter(r => r.classification === 'healthy'),
      delayed: rows.filter(r => r.classification === 'delayed'),
      failed:  rows.filter(r => r.classification === 'failed'),
      ignored: rows.filter(r => r.classification === 'ignored'),
      reportInfo: {
        date: reportDate,
        receivedAt: logRow ? (logRow as { received_at: string }).received_at : null,
        count: rows.length,
        source: 'gmail',
      },
    } satisfies BackupSummaryData)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
