import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { ThresholdProvider } from '@/contexts/ThresholdContext'
import { DatabaseSummary, DbRegistry } from '@/types'
import { getSeverity } from '@/lib/utils/severity'
import { sortDatabases } from '@/lib/utils/sort'
import { getLatestReportDate } from '@/lib/utils/getLatestReportDate'
import { safeFrom } from '@/lib/db/safeTable'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Returns the most recent report_date from backup_status
const getLatestBackupDate = cache(async (): Promise<string | null> => {
  try {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('backup_status')
      .select('report_date')
      .order('report_date', { ascending: false })
      .limit(1)
      .single()
    return data?.report_date ?? null
  } catch {
    return null
  }
})

// All 20 DB queries run in parallel, service client bypasses RLS
const getSummaries = cache(async (): Promise<DatabaseSummary[]> => {
    try {
      const supabase = createServiceClient()

      const reportDate = await getLatestReportDate()
      if (!reportDate) return []

      const { data: registries } = await supabase
        .from('db_registry')
        .select('*')
        .eq('is_active', true)

      if (!registries?.length) return []

      return Promise.all(
        (registries as DbRegistry[]).map(async (reg) => {
          const empty: DatabaseSummary = {
            key: reg.db_key, name: reg.db_name, table_name: reg.table_name,
            schema_type: reg.schema_type, worst_pct: 0, severity: 'healthy',
            critical_count: 0, warning_count: 0, healthy_count: 0, total_tablespaces: 0,
          }
          try {
            const pctField = reg.schema_type === 'standard' ? 'max_ts_pct_used' : 'percent_used'
            const { data } = await safeFrom(supabase, reg.table_name)
              .select(pctField)
              .eq('report_date', reportDate)

            if (!data?.length) return empty

            const pcts = (data as Record<string, number>[]).map(r => r[pctField])
            const worst = Math.max(...pcts)

            return {
              key: reg.db_key, name: reg.db_name, table_name: reg.table_name,
              schema_type: reg.schema_type, worst_pct: worst, severity: getSeverity(worst),
              critical_count: pcts.filter(p => p >= 90).length,
              warning_count: pcts.filter(p => p >= 80 && p < 90).length,
              healthy_count: pcts.filter(p => p < 80).length,
              total_tablespaces: pcts.length,
            }
          } catch {
            return empty
          }
        })
      )
    } catch {
      return []
    }
})

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [rawDatabases, tablespaceDate, backupDate] = await Promise.all([
    getSummaries(),
    getLatestReportDate(),
    getLatestBackupDate(),
  ])
  const databases = sortDatabases(rawDatabases)

  const userInitials = user.email
    ? user.email.slice(0, 2).toUpperCase()
    : 'HH'

  const notificationCount = databases.reduce(
    (sum, db) => sum + db.critical_count,
    0
  )

  return (
    <ThresholdProvider>
      <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)', color: 'var(--txv)' }}>
        <Sidebar databases={databases} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Topbar
            userInitials={userInitials}
            notificationCount={notificationCount}
            reportTime={tablespaceDate}
            backupReportTime={backupDate}
          />
          <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }} className="page-content">
            {children}
          </div>
        </div>
      </div>
    </ThresholdProvider>
  )
}
