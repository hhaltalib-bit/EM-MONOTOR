export interface SchemaFieldMap {
  pct: string
  used: string
  size: string
  max: string
  aut: string | null
  hasAut: boolean
}

export function fields(schemaType: string): SchemaFieldMap {
  if (schemaType === 'dwh') {
    return { pct: 'percent_used', used: 'gb_used', size: 'gb_total', max: 'gb_total', aut: null, hasAut: false }
  }
  return { pct: 'max_ts_pct_used', used: 'used_ts_size', size: 'curr_ts_size', max: 'max_ts_size', aut: 'aut', hasAut: true }
}
