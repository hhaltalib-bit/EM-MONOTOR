import { cache } from 'react'
import { createServiceClient } from '@/lib/supabase/server'
import { DEFAULT_WARN_THRESHOLD, DEFAULT_CRIT_THRESHOLD } from '@/lib/constants'

export const getThresholds = cache(async (): Promise<{ warn: number; crit: number }> => {
  try {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('system_settings')
      .select('warn_threshold, crit_threshold')
      .limit(1)
      .single()
    return {
      warn: Number(data?.warn_threshold) || DEFAULT_WARN_THRESHOLD,
      crit: Number(data?.crit_threshold) || DEFAULT_CRIT_THRESHOLD,
    }
  } catch {
    return { warn: DEFAULT_WARN_THRESHOLD, crit: DEFAULT_CRIT_THRESHOLD }
  }
})
