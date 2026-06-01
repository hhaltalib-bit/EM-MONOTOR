import { cache } from 'react'
import { createServiceClient } from '@/lib/supabase/server'

export const getThresholds = cache(async (): Promise<{ warn: number; crit: number }> => {
  try {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('system_settings')
      .select('warn_threshold, crit_threshold')
      .limit(1)
      .single()
    return {
      warn: Number(data?.warn_threshold) || 80,
      crit: Number(data?.crit_threshold) || 90,
    }
  } catch {
    return { warn: 80, crit: 90 }
  }
})
