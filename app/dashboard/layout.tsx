import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { ThresholdProvider } from '@/contexts/ThresholdContext'
import { DatabaseSummary, DbRegistry } from '@/types'
import { getSeverity } from '@/lib/utils/severity'
import { sortDatabases } from '@/lib/utils/sort'

// Returns the most recent report_date that has data in raid_ts
async function getLatestReportDate(): Promise<string> {
  try {
    const supabase = createServiceClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from('raid_ts') as any)
      .select('report_date')
      .order('report_date', { ascending: false })
      .limit(1)
      .single()
    return data?.report_date ?? new Date().toISOString().split('T')[0]
  } catch {
    return new Date().toISOString().split('T')[0]
  }
}

// Cached for 60 s — all 20 DB queries run in parallel, service client bypasses RLS
const getCachedSummaries = unstable_cache(
  async (): Promise<DatabaseSummary[]> => {
    try {
      const supabase = createServiceClient()

      const reportDate = await getLatestReportDate()

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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data } = await (supabase.from(reg.table_name) as any)
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
  },
  ['db-summaries'],
  { revalidate: 60 }
)

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

  const [rawDatabases, reportDate] = await Promise.all([
    getCachedSummaries(),
    getLatestReportDate(),
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
            reportTime={reportDate}
          />
          <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }} className="page-content">
            {children}
          </div>
        </div>
      </div>
    </ThresholdProvider>
  )
}
