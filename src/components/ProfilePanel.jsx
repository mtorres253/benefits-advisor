import { useState } from 'react'

export default function ProfilePanel({ user, onUpdate, onLogout, onClose }) {
  const [form, setForm] = useState({
    firstName: user.firstName ?? '',
    lastName:  user.lastName  ?? '',
    zipCode:   user.zipCode   ?? '',
    phone:     user.phone     ?? '',
    isVeteran: user.isVeteran ?? false,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [error, setError]   = useState('')

  const set = field => val => setForm(f => ({ ...f, [field]: val }))

  const save = async () => {
    setSaving(true); setError(''); setSaved(false)
    try {
      const token = localStorage.getItem('sba_token')
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Save failed'); return }
      localStorage.setItem('sba_user', JSON.stringify(data))
      onUpdate(data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('sba_token')
    localStorage.removeItem('sba_user')
    onLogout()
    onClose()
  }

  return (
    <div className="panel-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="panel">
        <div className="panel-header">
          <div>
            <h3>Your Profile</h3>
            <p>{user.email}</p>
          </div>
          <button className="panel-close" onClick={onClose}>✕</button>
        </div>

        <div className="panel-body">
          <div className="panel-section">
            <h4>Personal Information</h4>
            <p className="section-sub">All fields are encrypted at rest with AES-256-GCM</p>

            <div className="pf-row">
              <div className="pf-field">
                <label>First Name</label>
                <input className="pf-input" value={form.firstName} onChange={e => set('firstName')(e.target.value)} />
              </div>
              <div className="pf-field">
                <label>Last Name</label>
                <input className="pf-input" value={form.lastName} onChange={e => set('lastName')(e.target.value)} />
              </div>
            </div>

            <div className="pf-field">
              <label>Home ZIP Code</label>
              <input className="pf-input" value={form.zipCode} onChange={e => set('zipCode')(e.target.value)} placeholder="Pre-fills your location in searches" />
            </div>

            <div className="pf-field">
              <label>Phone (optional)</label>
              <input className="pf-input" value={form.phone} onChange={e => set('phone')(e.target.value)} placeholder="For your reference only" />
            </div>
          </div>

          <div className="panel-section">
            <h4>Veteran Status</h4>
            <div
              className={`vet-toggle-row ${form.isVeteran ? 'active' : ''}`}
              onClick={() => setForm(f => ({ ...f, isVeteran: !f.isVeteran }))}
            >
              <div className="vt-left">
                <span className="vt-icon">{form.isVeteran ? '🎖️' : '🪖'}</span>
                <div>
                  <p className="vt-label">{form.isVeteran ? 'Veteran benefits enabled' : 'I am a US military veteran'}</p>
                  <p className="vt-sub">{form.isVeteran ? 'VA programs included in all searches' : 'Toggle to include veteran-specific benefits'}</p>
                </div>
              </div>
              <div className={`vt-switch ${form.isVeteran ? 'on' : ''}`}>
                <div className="vt-knob" />
              </div>
            </div>
          </div>

          {error && <div className="pf-error">{error}</div>}

          <button className="save-btn" onClick={save} disabled={saving}>
            {saving ? <span className="spinner-sm" /> : saved ? '✓ Saved!' : 'Save Changes'}
          </button>

          <div className="panel-section danger-zone">
            <h4>Account</h4>
            <button className="logout-btn" onClick={logout}>Sign Out</button>
          </div>
        </div>
      </div>

      <style>{`
        .panel-backdrop {
          position: fixed; inset: 0; background: rgba(0,0,0,0.4);
          z-index: 999; animation: fadeIn 0.2s ease;
        }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }

        .panel {
          position: absolute; top: 0; right: 0; bottom: 0;
          width: 360px; max-width: 100vw;
          background: #faf7f2; display: flex; flex-direction: column;
          box-shadow: -8px 0 40px rgba(0,0,0,0.15);
          animation: slideIn 0.25s ease;
        }
        @keyframes slideIn { from{transform:translateX(100%)} to{transform:translateX(0)} }

        .panel-header {
          background: #2d5a3d; color: white; padding: 20px 20px 18px;
          display: flex; align-items: flex-start; justify-content: space-between;
          border-bottom: 3px solid #c8a96e; flex-shrink: 0;
        }
        .panel-header h3 { font-family: 'Playfair Display', serif; font-size: 18px; margin-bottom: 3px; }
        .panel-header p  { font-size: 12px; opacity: 0.75; }
        .panel-close {
          background: none; border: none; color: white; font-size: 18px;
          cursor: pointer; padding: 2px 6px; opacity: 0.7; margin-top: -2px;
        }
        .panel-close:hover { opacity: 1; }

        .panel-body { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 20px; }

        .panel-section h4 {
          font-family: 'Playfair Display', serif; font-size: 15px;
          color: #2d5a3d; margin-bottom: 4px;
        }
        .section-sub { font-size: 11px; color: #9a8a70; margin-bottom: 12px; }

        .pf-row { display: flex; gap: 10px; }
        .pf-row .pf-field { flex: 1; }
        .pf-field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 10px; }
        .pf-field label { font-size: 12.5px; font-weight: 500; color: #4a3a20; }
        .pf-input {
          padding: 9px 12px; border: 1.5px solid #d4c9b0; border-radius: 8px;
          font-family: 'Source Sans 3', sans-serif; font-size: 13.5px;
          color: #2a2010; outline: none; background: white; transition: border-color 0.2s;
        }
        .pf-input:focus { border-color: #2d5a3d; }

        .vet-toggle-row {
          display: flex; align-items: center; gap: 12px;
          background: white; border: 1.5px solid #d4c9b0; border-radius: 10px;
          padding: 12px; cursor: pointer; transition: all 0.2s;
        }
        .vet-toggle-row.active { border-color: #9b6030; background: #fdf3e3; }
        .vt-left { display: flex; align-items: center; gap: 10px; flex: 1; }
        .vt-icon { font-size: 22px; }
        .vt-label { font-size: 13px; font-weight: 500; color: #3a2a10; }
        .vet-toggle-row.active .vt-label { color: #9b6030; }
        .vt-sub { font-size: 11px; color: #9a8a70; margin-top: 2px; }
        .vt-switch {
          width: 40px; height: 22px; border-radius: 11px; background: #d4c9b0;
          position: relative; transition: background 0.25s; flex-shrink: 0;
        }
        .vt-switch.on { background: #9b6030; }
        .vt-knob {
          width: 16px; height: 16px; border-radius: 50%; background: white;
          position: absolute; top: 3px; left: 3px;
          transition: transform 0.25s; box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        .vt-switch.on .vt-knob { transform: translateX(18px); }

        .pf-error {
          background: #fdf0f0; border: 1px solid #e8b8b8; border-radius: 8px;
          padding: 10px 13px; font-size: 13px; color: #c0392b;
        }

        .save-btn {
          background: #2d5a3d; color: white; border: none; border-radius: 9px;
          padding: 12px; font-family: 'Source Sans 3', sans-serif;
          font-size: 14px; font-weight: 500; cursor: pointer;
          transition: all 0.2s; display: flex; align-items: center; justify-content: center;
        }
        .save-btn:hover:not(:disabled) { background: #1e3d29; }
        .save-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .spinner-sm {
          width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.4);
          border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .danger-zone { margin-top: 8px; padding-top: 16px; border-top: 1px solid #e8e0d0; }
        .logout-btn {
          background: none; border: 1.5px solid #d4c9b0; border-radius: 8px;
          padding: 9px 16px; font-family: 'Source Sans 3', sans-serif;
          font-size: 13.5px; color: #7a6a50; cursor: pointer; transition: all 0.2s;
        }
        .logout-btn:hover { border-color: #c0392b; color: #c0392b; }
      `}</style>
    </div>
  )
}
