import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/requireAuth'

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

export interface BackupHistoryRow {
  report_date: string
  healthy_count: number | null
  delayed_count: number | null
  failed_count: number | null
  ignored_count: number | null
  databases_count: number | null
  status: string
}

export interface BackupSummaryData {
  latestDate: string | null
  prevDate: string | null
  nextDate: string | null
  healthy: BackupStatusRow[]
  delayed: BackupStatusRow[]
  failed: BackupStatusRow[]
  ignored: BackupStatusRow[]
  reportInfo: BackupReportInfo | null
  history: BackupHistoryRow[]
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(false)
  if (!auth.ok) return auth.response

  try {
    const supabase = createServiceClient()
    const dateParam = req.nextUrl.searchParams.get('date')

    // SEC-M: validate date format before use
    if (dateParam && !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }

    let reportDate: string
    if (dateParam) {
      reportDate = dateParam
    } else {
      const { data: latestRow } = await supabase
        .from('backup_status')
        .select('report_date')
        .order('report_date', { ascending: false })
        .limit(1)
        .single()

      if (!latestRow?.report_date) {
        return NextResponse.json({
          latestDate: null,
          prevDate: null,
          nextDate: null,
          healthy: [],
          delayed: [],
          failed: [],
          ignored: [],
          reportInfo: null,
          history: [],
        } satisfies BackupSummaryData)
      }
      reportDate = latestRow.report_date as string
    }

    const [{ data: statuses }, { data: logRow }, { data: prevRow }, { data: nextRow }, { data: historyRows }] = await Promise.all([
      supabase.from('backup_status').select('*').eq('report_date', reportDate),
      supabase
        .from('backup_report_log')
        .select('received_at, databases_count')
        .eq('report_date', reportDate)
        .eq('status', 'success')
        .order('received_at', { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from('backup_status')
        .select('report_date')
        .lt('report_date', reportDate)
        .order('report_date', { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from('backup_status')
        .select('report_date')
        .gt('report_date', reportDate)
        .order('report_date', { ascending: true })
        .limit(1)
        .single(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from('backup_report_log') as any)
        .select('report_date, healthy_count, delayed_count, failed_count, ignored_count, databases_count, status')
        .order('report_date', { ascending: false })
        .limit(30),
    ])

    const rows = (statuses as BackupStatusRow[]) || []

    return NextResponse.json({
      latestDate: reportDate,
      prevDate: (prevRow as { report_date: string } | null)?.report_date ?? null,
      nextDate: (nextRow as { report_date: string } | null)?.report_date ?? null,
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
      history: (historyRows ?? []) as BackupHistoryRow[],
    } satisfies BackupSummaryData)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
