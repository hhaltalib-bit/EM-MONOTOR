'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTheme } from '@/components/shared/ThemeProvider'
import { TabBar, TabKey } from '@/components/analytics/TabBar'
import { OverviewTab } from '@/components/analytics/tabs/OverviewTab'
import { DeepDiveTab } from '@/components/analytics/tabs/DeepDiveTab'
import { CompareTab } from '@/components/analytics/tabs/CompareTab'
import { ForecastTab } from '@/components/analytics/tabs/ForecastTab'
import { CapacityTab } from '@/components/analytics/tabs/CapacityTab'
import { WatchlistTab } from '@/components/analytics/tabs/WatchlistTab'
import { AnomaliesTab } from '@/components/analytics/tabs/AnomaliesTab'

export default function AnalyticsPage() {
  useEffect(() => { document.title = 'EM Monitor — Analytics' }, [])

  const { theme } = useTheme()
  const dark = theme === 'dark'

  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [pendingDeepDive, setPendingDeepDive] = useState<{ db: string; ts: string } | null>(null)

  const openInDeepDive = useCallback((db: string, ts: string) => {
    setPendingDeepDive({ db, ts })
    setActiveTab('deepdive')
  }, [])

  return (
    <div style={{ padding: '16px 20px' }} className="page-content">
      <TabBar active={activeTab} onChange={setActiveTab} />

      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'deepdive' && (
        <DeepDiveTab dark={dark} pending={pendingDeepDive} onConsumed={() => setPendingDeepDive(null)} />
      )}
      {activeTab === 'compare' && <CompareTab dark={dark} />}
      {activeTab === 'forecast' && <ForecastTab />}
      {activeTab === 'capacity' && <CapacityTab dark={dark} />}
      {activeTab === 'watchlist' && <WatchlistTab onOpenDeepDive={openInDeepDive} />}
      {activeTab === 'anomalies' && <AnomaliesTab />}
    </div>
  )
}
