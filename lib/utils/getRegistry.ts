import { cache } from 'react'
import { createServiceClient } from '@/lib/supabase/server'
import { DbRegistry } from '@/types'

/**
 * Cached, request-scoped fetch of all active db_registry rows.
 * Every analytics route reads the DB list here instead of hardcoding it,
 * so new databases are picked up automatically.
 */
export const getCachedRegistry = cache(async (): Promise<DbRegistry[]> => {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('db_registry')
      .select('*')
      .eq('is_active', true)
      .order('db_name')
    if (error) throw new Error(error.message)
    return (data ?? []) as DbRegistry[]
  } catch (err) {
    console.error('[getCachedRegistry] failed to fetch db_registry:', err)
    return []
  }
})
