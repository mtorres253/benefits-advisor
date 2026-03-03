import { useState } from 'react'

// ─── Shared input component ───────────────────────────────────────────────────
function Field({ label, type = 'text', value, onChange, error, placeholder, required }) {
  return (
    <div className="field">
      <label className="field-label">{label}{required && <span className="req">*</span>}</label>
      <input
        className={`field-input ${error ? 'field-error' : ''}`}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={type === 'password' ? 'current-password' : undefined}
      />
      {error && <p className="field-err-msg">{error}</p>}
    </div>
  )
}

// ─── Register form ────────────────────────────────────────────────────────────
function RegisterForm({ onSuccess, onSwitch }) {
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '', confirmPassword: '',
    zipCode: '', isVeteran: false,
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState('')

  const set = field => val => setForm(f => ({ ...f, [field]: val }))

  const validate = () => {
    const e = {}
    if (!form.firstName.trim())   e.firstName = 'Required'
    if (!form.lastName.trim())    e.lastName  = 'Required'
    if (!form.email.trim())       e.email     = 'Required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email'
    if (!form.password)           e.password  = 'Required'
    else if (form.password.length < 8)    e.password = 'At least 8 characters'
    else if (!/[A-Z]/.test(form.password)) e.password = 'Include an uppercase letter'
    else if (!/[0-9]/.test(form.password)) e.password = 'Include a number'
    if (form.confirmPassword !== form.password) e.confirmPassword = 'Passwords do not match'
    return e
  }

  const submit = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setLoading(true); setServerError('')
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName, lastName: form.lastName,
          email: form.email, password: form.password,
          zipCode: form.zipCode, isVeteran: form.isVeteran,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.fields) setErrors(data.fields)
        setServerError(data.error ?? 'Registration failed')
        return
      }
      onSuccess(data)
    } catch {
      setServerError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-form">
      <div className="form-row">
        <Field label="First Name" value={form.firstName} onChange={set('firstName')} error={errors.firstName} required />
        <Field label="Last Name"  value={form.lastName}  onChange={set('lastName')}  error={errors.lastName}  required />
      </div>
      <Field label="Email Address" type="email" value={form.email} onChange={set('email')} error={errors.email} placeholder="you@example.com" required />
      <Field label="Password" type="password" value={form.password} onChange={set('password')} error={errors.password} placeholder="Min 8 chars, 1 uppercase, 1 number" required />
      <Field label="Confirm Password" type="password" value={form.confirmPassword} onChange={set('confirmPassword')} error={errors.confirmPassword} required />
      <Field label="ZIP Code" value={form.zipCode} onChange={set('zipCode')} placeholder="Optional — pre-fills location searches" />

      <div className="veteran-row" onClick={() => setForm(f => ({ ...f, isVeteran: !f.isVeteran }))}>
        <div className={`check-box ${form.isVeteran ? 'checked' : ''}`}>
          {form.isVeteran && <span>✓</span>}
        </div>
        <div>
          <p className="vet-label">🎖️ I am a US military veteran</p>
          <p className="vet-sub">Enables veteran-specific benefits in all searches</p>
        </div>
      </div>

      {serverError && <div className="server-error">{serverError}</div>}

      <button className="auth-btn" onClick={submit} disabled={loading}>
        {loading ? <span className="spinner" /> : 'Create Account'}
      </button>

      <p className="switch-link">
        Already have an account?{' '}
        <button className="link-btn" onClick={onSwitch}>Sign in</button>
      </p>
    </div>
  )
}

// ─── Login form ───────────────────────────────────────────────────────────────
function LoginForm({ onSuccess, onSwitch }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState('')

  const submit = async () => {
    const e = {}
    if (!email.trim())  e.email    = 'Required'
    if (!password)      e.password = 'Required'
    if (Object.keys(e).length) { setErrors(e); return }
    setLoading(true); setServerError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setServerError(data.error ?? 'Login failed'); return }
      onSuccess(data)
    } catch {
      setServerError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleKey = e => { if (e.key === 'Enter') submit() }

  return (
    <div className="auth-form">
      <Field label="Email Address" type="email" value={email} onChange={setEmail} error={errors.email} placeholder="you@example.com" required />
      <Field label="Password" type="password" value={password} onChange={setPassword} error={errors.password} onKeyDown={handleKey} required />

      {serverError && <div className="server-error">{serverError}</div>}

      <button className="auth-btn" onClick={submit} disabled={loading}>
        {loading ? <span className="spinner" /> : 'Sign In'}
      </button>

      <p className="switch-link">
        No account yet?{' '}
        <button className="link-btn" onClick={onSwitch}>Create one</button>
      </p>
    </div>
  )
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────
export default function AuthModal({ onClose, onAuth }) {
  const [mode, setMode] = useState('login') // 'login' | 'register'

  const handleSuccess = ({ token, user }) => {
    localStorage.setItem('sba_token', token)
    localStorage.setItem('sba_user', JSON.stringify(user))
    onAuth(user)
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <button className="modal-close" onClick={onClose}>✕</button>

        <div className="modal-header">
          <div className="modal-icon">🌿</div>
          <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
          <p>{mode === 'login'
            ? 'Sign in to access your saved profile and veteran status'
            : 'Save your preferences so every search is personalised'}</p>
        </div>

        <div className="mode-tabs">
          <button className={`tab ${mode === 'login' ? 'active' : ''}`} onClick={() => setMode('login')}>Sign In</button>
          <button className={`tab ${mode === 'register' ? 'active' : ''}`} onClick={() => setMode('register')}>Register</button>
        </div>

        {mode === 'login'
          ? <LoginForm    onSuccess={handleSuccess} onSwitch={() => setMode('register')} />
          : <RegisterForm onSuccess={handleSuccess} onSwitch={() => setMode('login')} />}

        <p className="privacy-note">
          🔒 Your personal information is encrypted at rest using AES-256-GCM. Passwords are hashed with bcrypt and never stored in plaintext.
        </p>
      </div>

      <style>{`
        .modal-backdrop {
          position: fixed; inset: 0; background: rgba(0,0,0,0.5);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; padding: 16px; animation: fadeIn 0.2s ease;
        }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }

        .modal {
          background: #faf7f2; border-radius: 20px; width: 100%;
          max-width: 480px; max-height: 90vh; overflow-y: auto;
          padding: 32px; position: relative;
          box-shadow: 0 20px 60px rgba(0,0,0,0.25);
          animation: slideUp 0.25s ease;
        }
        @keyframes slideUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }

        .modal-close {
          position: absolute; top: 16px; right: 16px;
          background: none; border: none; font-size: 18px;
          color: #9a8a70; cursor: pointer; padding: 4px 8px;
          border-radius: 6px; transition: background 0.15s;
        }
        .modal-close:hover { background: #f0ebe0; }

        .modal-header { text-align: center; margin-bottom: 24px; }
        .modal-icon { font-size: 36px; margin-bottom: 10px; }
        .modal-header h2 {
          font-family: 'Playfair Display', serif; font-size: 22px;
          color: #2d5a3d; margin-bottom: 6px;
        }
        .modal-header p { font-size: 13.5px; color: #7a6a50; line-height: 1.5; }

        .mode-tabs {
          display: flex; background: #f0ebe0; border-radius: 10px;
          padding: 3px; margin-bottom: 24px;
        }
        .tab {
          flex: 1; padding: 8px; border: none; background: none;
          border-radius: 8px; font-family: 'Source Sans 3', sans-serif;
          font-size: 14px; font-weight: 500; color: #7a6a50;
          cursor: pointer; transition: all 0.2s;
        }
        .tab.active { background: white; color: #2d5a3d; box-shadow: 0 1px 4px rgba(0,0,0,0.1); }

        .auth-form { display: flex; flex-direction: column; gap: 14px; }

        .form-row { display: flex; gap: 12px; }
        .form-row .field { flex: 1; }

        .field { display: flex; flex-direction: column; gap: 5px; }
        .field-label { font-size: 13px; font-weight: 500; color: #4a3a20; }
        .req { color: #c0392b; margin-left: 2px; }
        .field-input {
          padding: 10px 13px; border: 1.5px solid #d4c9b0; border-radius: 9px;
          font-family: 'Source Sans 3', sans-serif; font-size: 14px; color: #2a2010;
          outline: none; background: white; transition: border-color 0.2s;
        }
        .field-input:focus { border-color: #2d5a3d; }
        .field-input.field-error { border-color: #c0392b; }
        .field-err-msg { font-size: 11.5px; color: #c0392b; margin-top: 2px; }

        .veteran-row {
          display: flex; align-items: flex-start; gap: 12px;
          background: #f5f0e8; border: 1.5px solid #d4c9b0; border-radius: 10px;
          padding: 12px; cursor: pointer; transition: border-color 0.2s;
        }
        .veteran-row:hover { border-color: #9b6030; }
        .check-box {
          width: 22px; height: 22px; border: 2px solid #d4c9b0; border-radius: 5px;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; flex-shrink: 0; transition: all 0.2s; margin-top: 1px;
          background: white;
        }
        .check-box.checked { background: #9b6030; border-color: #9b6030; color: white; }
        .vet-label { font-size: 13.5px; font-weight: 500; color: #4a3a20; }
        .vet-sub { font-size: 11.5px; color: #9a8a70; margin-top: 2px; }

        .server-error {
          background: #fdf0f0; border: 1px solid #e8b8b8; border-radius: 8px;
          padding: 10px 13px; font-size: 13px; color: #c0392b;
        }

        .auth-btn {
          background: #2d5a3d; color: white; border: none; border-radius: 10px;
          padding: 13px; font-family: 'Source Sans 3', sans-serif;
          font-size: 15px; font-weight: 500; cursor: pointer;
          transition: all 0.2s; margin-top: 4px; display: flex;
          align-items: center; justify-content: center;
        }
        .auth-btn:hover:not(:disabled) { background: #1e3d29; }
        .auth-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .spinner {
          width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.4);
          border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .switch-link { text-align: center; font-size: 13.5px; color: #7a6a50; }
        .link-btn { background: none; border: none; color: #2d5a3d; font-weight: 600; cursor: pointer; padding: 0; font-size: inherit; }
        .link-btn:hover { text-decoration: underline; }

        .privacy-note {
          margin-top: 16px; padding: 10px 13px; background: #e8f4ec;
          border-radius: 8px; font-size: 11.5px; color: #3a6a4a; line-height: 1.5;
        }
      `}</style>
    </div>
  )
}
