'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useThresholds } from '@/contexts/ThresholdContext'

interface UserEntry {
  id: string
  email: string
  created_at: string
  role: string
  display_name: string
  failed_attempts: number
  locked_until: string | null
}

interface AddFormState {
  open: boolean
  email: string
  password: string
  role: string
  loading: boolean
  error: string
}

interface PwdFormState {
  userId: string
  password: string
  loading: boolean
  error: string
}

function PanelHeader({ title, color = 'var(--bl)' }: { title: string; color?: string }) {
  return (
    <div style={{ fontSize: '9px', color: 'var(--tx2)', textTransform: 'uppercase', letterSpacing: '0.7px', fontFamily: 'monospace', marginBottom: '16px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ width: '3px', height: '14px', background: color, display: 'inline-block', borderRadius: '2px' }} />
      {title}
    </div>
  )
}

function Panel({ children, accent = 'var(--bl)' }: { children: React.ReactNode; accent?: string }) {
  return (
    <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--bdv)', borderTop: `1px solid ${accent}`, borderRadius: '8px', padding: '16px', marginBottom: '12px', animation: 'popIn 0.3s ease-out both' }}>
      {children}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: '10px', color: 'var(--tx3)', fontFamily: 'monospace',
  textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px', display: 'block',
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg4)', border: '0.5px solid var(--bdv)', borderRadius: '6px',
  padding: '7px 10px', color: 'var(--txv)', fontSize: '12px', fontFamily: 'monospace',
  outline: 'none', width: '100%', boxSizing: 'border-box',
}

const btnStyle: React.CSSProperties = {
  background: 'var(--bg4)', border: '0.5px solid var(--bdv)', borderRadius: '5px',
  padding: '5px 10px', cursor: 'pointer', color: 'var(--tx2)', fontSize: '11px',
  display: 'flex', alignItems: 'center', gap: '4px',
}

export default function SettingsPage() {
  useEffect(() => { document.title = 'EM Monitor — Settings' }, [])

  const { warnThreshold, critThreshold, setWarnThreshold, setCritThreshold } = useThresholds()

  const [alertEmail, setAlertEmail] = useState('')
  const [reportTime, setReportTime] = useState('01:30')
  const [alertDelay, setAlertDelay] = useState('30')
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [settingsSaveError, setSettingsSaveError] = useState(false)

  // User management
  const [users, setUsers] = useState<UserEntry[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [usersForbidden, setUsersForbidden] = useState(false)
  const [usersError, setUsersError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null)
  const [unlockLoading, setUnlockLoading] = useState<string | null>(null)
  const [addForm, setAddForm] = useState<AddFormState>({ open: false, email: '', password: '', role: 'DBA', loading: false, error: '' })
  const [pwdForm, setPwdForm] = useState<PwdFormState | null>(null)
  const [userMsg, setUserMsg] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    loadUsers()
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id)
    })
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => {
        if (d.alert_email !== undefined) setAlertEmail(d.alert_email)
        if (d.expected_report_time !== undefined) setReportTime(d.expected_report_time)
        if (d.missing_alert_delay !== undefined) setAlertDelay(String(d.missing_alert_delay))
        if (d.warn_threshold !== undefined) setWarnThreshold(Number(d.warn_threshold))
        if (d.crit_threshold !== undefined) setCritThreshold(Number(d.crit_threshold))
      })
      .catch(() => {})
  }, [])

  function showMsg(text: string, ok: boolean) {
    setUserMsg({ text, ok })
    setTimeout(() => setUserMsg(null), 3000)
  }

  async function loadUsers() {
    setUsersLoading(true)
    setUsersForbidden(false)
    setUsersError(null)
    try {
      const res = await fetch('/api/admin/users')
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if (res.status === 403) {
          // Expected for non-Admin users — hide the section gracefully, no error.
          setUsersForbidden(true)
          return
        }
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      const { users: list, currentUserId: cid } = await res.json()
      setUsers(list ?? [])
      if (cid) setCurrentUserId(cid)
    } catch (err) {
      console.error('[settings-loadUsers] failed to load users:', err)
      setUsersError('Unable to load users — you may not have admin access')
    } finally {
      setUsersLoading(false)
    }
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault()
    setAddForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: addForm.email, password: addForm.password, role: addForm.role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create user')
      setAddForm({ open: false, email: '', password: '', role: 'DBA', loading: false, error: '' })
      showMsg(`User ${addForm.email} created`, true)
      loadUsers()
    } catch (err) {
      setAddForm(f => ({ ...f, loading: false, error: (err as Error).message }))
    }
  }

  async function handleDeleteUser(userId: string, email: string) {
    if (!window.confirm(`Delete user ${email}? This cannot be undone.`)) return
    setDeleteLoading(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to delete user')
      showMsg(`User ${email} deleted`, true)
      loadUsers()
    } catch (err) {
      showMsg((err as Error).message, false)
    } finally {
      setDeleteLoading(null)
    }
  }

  async function handleUnlockUser(userId: string) {
    setUnlockLoading(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unlock' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to unlock account')
      showMsg('Account unlocked', true)
      loadUsers()
    } catch (err) {
      showMsg((err as Error).message, false)
    } finally {
      setUnlockLoading(null)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (!pwdForm) return
    setPwdForm(f => f ? { ...f, loading: true, error: '' } : null)
    try {
      const res = await fetch(`/api/admin/users/${pwdForm.userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwdForm.password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to update password')
      setPwdForm(null)
      showMsg('Password updated', true)
    } catch (err) {
      setPwdForm(f => f ? { ...f, loading: false, error: (err as Error).message } : null)
    }
  }

  const handleSaveSettings = async () => {
    setSettingsSaveError(false)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert_email: alertEmail,
          expected_report_time: reportTime,
          missing_alert_delay: Number(alertDelay),
          warn_threshold: warnThreshold,
          crit_threshold: critThreshold,
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 2000)
    } catch (err) {
      console.error('[settings-save] failed to save settings:', err)
      setSettingsSaveError(true)
      setTimeout(() => setSettingsSaveError(false), 3000)
    }
  }

  return (
    <div style={{ padding: '12px 16px', maxWidth: '680px' }}>

      {/* Alert Thresholds */}
      <Panel accent="var(--wa)">
        <PanelHeader title="Alert Thresholds" color="var(--wa)" />

        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Warning Threshold</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              type="range" min={50} max={Math.min(critThreshold - 1, 99)}
              value={warnThreshold}
              onChange={e => setWarnThreshold(Number(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--wa)' }}
            />
            <span style={{ fontSize: '16px', fontWeight: 500, color: 'var(--wa)', fontFamily: 'monospace', minWidth: '44px', textAlign: 'right' }}>
              {warnThreshold}%
            </span>
          </div>
          <div style={{ fontSize: '10px', color: 'var(--tx3)', fontFamily: 'monospace', marginTop: '4px' }}>
            Tablespaces at or above this % will show as warning · changes apply instantly across all views
          </div>
        </div>

        <div>
          <label style={labelStyle}>Critical Threshold</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              type="range" min={Math.max(warnThreshold + 1, 51)} max={99}
              value={critThreshold}
              onChange={e => setCritThreshold(Number(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--cr)' }}
            />
            <span style={{ fontSize: '16px', fontWeight: 500, color: 'var(--cr)', fontFamily: 'monospace', minWidth: '44px', textAlign: 'right' }}>
              {critThreshold}%
            </span>
          </div>
          <div style={{ fontSize: '10px', color: 'var(--tx3)', fontFamily: 'monospace', marginTop: '4px' }}>
            Tablespaces at or above this % will show as critical · changes apply instantly across all views
          </div>
        </div>
      </Panel>

      {/* Email & Report */}
      <Panel accent="var(--bl)">
        <PanelHeader title="Email & Report" color="var(--bl)" />

        <div style={{ marginBottom: '13px' }}>
          <label style={labelStyle}>Alert Recipient Email</label>
          <input className="inp-f" type="email" value={alertEmail} onChange={e => setAlertEmail(e.target.value)} placeholder="alerts@example.com" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={labelStyle}>Expected Report Time</label>
            <input className="inp-f" type="time" value={reportTime} onChange={e => setReportTime(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Missing Report Alert Delay (min)</label>
            <input className="inp-f" type="number" min={5} max={120} value={alertDelay} onChange={e => setAlertDelay(e.target.value)} />
          </div>
        </div>

        <button
          onClick={handleSaveSettings}
          style={{ background: settingsSaveError ? 'var(--crb)' : settingsSaved ? 'var(--hlb)' : 'var(--Gv)', color: settingsSaveError ? 'var(--cr)' : settingsSaved ? 'var(--hl)' : '#080c14', border: settingsSaveError ? '0.5px solid var(--cr)' : settingsSaved ? '0.5px solid var(--hl)' : 'none', borderRadius: '6px', padding: '8px 20px', cursor: 'pointer', fontSize: '12px', fontWeight: 500, transition: 'all 0.2s' }}
        >
          {settingsSaveError ? '✕ Save failed' : settingsSaved ? '✓ Saved' : 'Save Settings'}
        </button>
      </Panel>

      {/* Team Members */}
      <Panel accent="var(--Gv)">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <PanelHeader title="Team Members" color="var(--Gv)" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            {userMsg && (
              <span style={{
                fontSize: '11px', padding: '3px 10px', borderRadius: '5px', fontFamily: 'monospace',
                background: userMsg.ok ? 'var(--hlb)' : 'var(--crb)',
                color: userMsg.ok ? 'var(--hl)' : 'var(--cr)',
                border: `0.5px solid ${userMsg.ok ? 'var(--hl)' : 'var(--cr)'}`,
              }}>
                {userMsg.text}
              </span>
            )}
            {!usersForbidden && !usersError && (
              <button
                onClick={() => setAddForm(f => ({ ...f, open: !f.open, error: '' }))}
                style={{ background: 'var(--Gv)', color: '#080c14', border: 'none', borderRadius: '6px', padding: '5px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <i className="ti ti-plus" style={{ fontSize: '12px' }} />
                Add
              </button>
            )}
          </div>
        </div>

        {usersForbidden ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--tx3)', fontFamily: 'monospace', fontSize: '11px' }}>
            You don&apos;t have admin access to manage team members.
          </div>
        ) : usersError ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--cr)', fontFamily: 'monospace', fontSize: '11px' }}>
            {usersError}
          </div>
        ) : (
        <>
        {/* Add user form */}
        {addForm.open && (
          <form onSubmit={handleAddUser} style={{ background: 'var(--bg4)', border: '0.5px solid var(--bdv)', borderRadius: '7px', padding: '14px', marginBottom: '14px' }}>
            <div style={{ fontSize: '10px', color: 'var(--Gv)', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px' }}>New User</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <label style={labelStyle}>Email</label>
                <input style={inputStyle} type="email" required placeholder="user@example.com" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Password</label>
                <input style={inputStyle} type="password" required minLength={12} placeholder="Min 12 characters" value={addForm.password} onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Role</label>
              <select style={{ ...inputStyle, width: 'auto', minWidth: '120px' }} value={addForm.role} onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))}>
                <option value="DBA">DBA</option>
                <option value="NOC">NOC</option>
              </select>
            </div>
            {addForm.error && <div style={{ fontSize: '11px', color: 'var(--cr)', fontFamily: 'monospace', marginBottom: '10px' }}>{addForm.error}</div>}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" disabled={addForm.loading} style={{ background: 'var(--Gv)', color: '#080c14', border: 'none', borderRadius: '5px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 500, opacity: addForm.loading ? 0.6 : 1 }}>
                {addForm.loading ? 'Creating…' : 'Create User'}
              </button>
              <button type="button" onClick={() => setAddForm(f => ({ ...f, open: false, error: '' }))} style={btnStyle}>Cancel</button>
            </div>
          </form>
        )}

        {/* User list */}
        {usersLoading ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--tx3)', fontFamily: 'monospace', fontSize: '11px' }}>Loading users…</div>
        ) : users.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--tx3)', fontFamily: 'monospace', fontSize: '11px' }}>No users found</div>
        ) : (
          users.map((member, i) => {
            const isSelf = member.id === currentUserId
            const isChangingPwd = pwdForm?.userId === member.id
            const isLocked = !!member.locked_until && new Date(member.locked_until) > new Date()

            return (
              <div key={member.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: i < users.length - 1 || isChangingPwd ? '0.5px solid var(--bdv)' : undefined }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--Gd)', border: '0.5px solid var(--Gv)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--Gv)', fontSize: '10px', fontFamily: 'monospace', fontWeight: 500, flexShrink: 0 }}>
                    {member.display_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', color: 'var(--txv)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {member.display_name} {isSelf && <span style={{ fontSize: '10px', color: 'var(--Gv)', fontFamily: 'monospace' }}>(you)</span>}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--tx3)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.email}</div>
                    {isLocked && member.locked_until && (
                      <div style={{ fontSize: '10px', color: 'var(--cr)', fontFamily: 'monospace', marginTop: '2px' }}>
                        🔒 Locked until {new Date(member.locked_until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                    {!isLocked && member.failed_attempts > 0 && (
                      <div style={{ fontSize: '10px', color: '#f59e0b', fontFamily: 'monospace', marginTop: '2px' }}>
                        {member.failed_attempts}/5 attempts
                      </div>
                    )}
                  </div>
                  <span className="tg" style={{ background: member.role === 'Admin' ? 'var(--Gd)' : 'var(--bg4)', color: member.role === 'Admin' ? 'var(--Gv)' : 'var(--tx2)', flexShrink: 0 }}>
                    {member.role}
                  </span>
                  <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                    {isLocked && !isSelf && (
                      <button
                        onClick={() => handleUnlockUser(member.id)}
                        disabled={unlockLoading === member.id}
                        style={{ ...btnStyle, color: 'var(--cr)', borderColor: 'var(--cr)', opacity: unlockLoading === member.id ? 0.5 : 1 }}
                        title="Unlock account"
                      >
                        <i className="ti ti-lock-open" style={{ fontSize: '12px' }} />
                      </button>
                    )}
                    <button
                      onClick={() => setPwdForm(isChangingPwd ? null : { userId: member.id, password: '', loading: false, error: '' })}
                      style={{ ...btnStyle, color: isChangingPwd ? 'var(--Gv)' : 'var(--tx2)' }}
                      title="Change password"
                    >
                      <i className="ti ti-key" style={{ fontSize: '12px' }} />
                    </button>
                    {!isSelf && (
                      <button
                        onClick={() => handleDeleteUser(member.id, member.email)}
                        disabled={deleteLoading === member.id}
                        style={{ ...btnStyle, color: 'var(--cr)', opacity: deleteLoading === member.id ? 0.5 : 1 }}
                        title="Delete user"
                      >
                        <i className="ti ti-trash" style={{ fontSize: '12px' }} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline password change form */}
                {isChangingPwd && (
                  <form onSubmit={handleChangePassword} style={{ background: 'var(--bg4)', borderRadius: '6px', padding: '12px', margin: '8px 0', display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '180px' }}>
                      <label style={labelStyle}>New password for {member.email}</label>
                      <input
                        style={inputStyle}
                        type="password"
                        required
                        minLength={12}
                        placeholder="Min 12 characters"
                        value={pwdForm.password}
                        onChange={e => setPwdForm(f => f ? { ...f, password: e.target.value, error: '' } : null)}
                        autoFocus
                      />
                    </div>
                    {pwdForm.error && <div style={{ width: '100%', fontSize: '11px', color: 'var(--cr)', fontFamily: 'monospace' }}>{pwdForm.error}</div>}
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button type="submit" disabled={pwdForm.loading} style={{ background: 'var(--Gv)', color: '#080c14', border: 'none', borderRadius: '5px', padding: '6px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: 500, opacity: pwdForm.loading ? 0.6 : 1 }}>
                        {pwdForm.loading ? 'Saving…' : 'Update'}
                      </button>
                      <button type="button" onClick={() => setPwdForm(null)} style={btnStyle}>Cancel</button>
                    </div>
                  </form>
                )}
              </div>
            )
          })
        )}

        <div style={{ marginTop: '12px', fontSize: '10px', color: 'var(--tx3)', fontFamily: 'monospace' }}>
          Run <code style={{ background: 'var(--bg4)', padding: '1px 4px', borderRadius: '3px' }}>migrations/create_user_profiles.sql</code> in Supabase SQL editor to enable roles.
        </div>
        </>
        )}
      </Panel>
    </div>
  )
}
