import { createServiceClient } from '@/lib/supabase/server'

export async function writeAudit(entry: {
  actorId?: string
  actorEmail?: string
  action: string
  target?: string
  ip?: string
}) {
  try {
    const svc = createServiceClient()
    await svc.from('audit_log').insert({
      actor_id:    entry.actorId    ?? null,
      actor_email: entry.actorEmail ?? null,
      action:      entry.action,
      target:      entry.target     ?? null,
      ip_address:  entry.ip         ?? null,
    })
  } catch (err) {
    console.error('[audit-log] failed:', err)
  }
}
