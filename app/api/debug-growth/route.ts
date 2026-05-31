import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const dbKey = searchParams.get('db') || 'dwh'
  const date  = searchParams.get('date') ||
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Baghdad' }).format(new Date())

  const supabase = createServiceClient()

  const { data: reg } = await supabase
    .from('db_registry')
    .select('*')
    .eq('db_key', dbKey)
    .single()

  if (!reg) return Response.json({ error: 'db not found' })

  const tableName = reg.table_name
  const usedField = reg.schema_type === 'dwh' ? 'gb_used' : 'used_ts_size'

  const { data: prevDateRow, error: prevErr } = await supabase
    .from(tableName)
    .select('report_date')
    .lt('report_date', date)
    .order('report_date', { ascending: false })
    .limit(1)
    .single()

  const { data: todayData } = await supabase
    .from(tableName)
    .select(`tablespace_name, ${usedField}`)
    .eq('report_date', date)

  const { data: prevData } = await supabase
    .from(tableName)
    .select(`tablespace_name, ${usedField}`)
    .eq('report_date', prevDateRow?.report_date ?? 'none')

  return Response.json({
    db: dbKey,
    table: tableName,
    currentDate: date,
    prevDate: prevDateRow?.report_date ?? null,
    prevDateError: prevErr?.message ?? null,
    todayRowCount: todayData?.length ?? 0,
    prevRowCount: prevData?.length ?? 0,
    sampleGrowth: todayData?.slice(0, 3).map(t => {
      const prev = prevData?.find(p => p.tablespace_name === t.tablespace_name)
      return {
        name: t.tablespace_name,
        today: t[usedField],
        prev: prev?.[usedField] ?? null,
        growth: prev ? (t[usedField] as number) - (prev[usedField] as number) : null,
      }
    }),
  })
}
