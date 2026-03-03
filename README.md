# 🌿 Senior Benefits Advisor

Autonomous AI agent for finding senior (60+) and veteran benefit programs within 10 miles of any US location. Includes full user auth with encrypted profile storage.

---

## 🚀 Deploy to Vercel

### 1. Push to GitHub
```bash
git init && git add . && git commit -m "init"
gh repo create senior-benefits-advisor --public --push
```

### 2. Import on Vercel
1. Go to [vercel.com/new](https://vercel.com/new) → import your repo
2. Add a **KV Store**: Vercel Dashboard → Storage → Create → KV → connect to project
3. Add **Environment Variables** in Project Settings:

| Variable | How to generate |
|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | `openssl rand -hex 32` (must be 64 hex chars) |

KV variables (`KV_REST_API_URL`, `KV_REST_API_TOKEN`) are auto-added when you connect the store.

4. Click **Deploy** ✓

---

## 💻 Local Development

### Prerequisites
- Node.js 18+

### Setup
```bash
npm install
cp .env.local.example .env.local
# Edit .env.local — add ANTHROPIC_API_KEY, JWT_SECRET, ENCRYPTION_KEY

# Terminal 1: API server
node dev-server.js

# Terminal 2: Vite frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

> Local dev uses an **in-memory store** — data resets on server restart. This is fine for development. Production uses Vercel KV (Redis).

---

## 🗂 Project Structure

```
senior-benefits-app/
├── api/
│   ├── chat.js              # Anthropic proxy (prompt caching, auth-aware)
│   └── auth/
│       ├── register.js      # POST /api/auth/register
│       ├── login.js         # POST /api/auth/login
│       └── profile.js       # GET/PATCH /api/auth/profile
├── lib/
│   ├── auth.js              # bcrypt, AES-256-GCM, JWT utilities
│   └── db.js                # DB abstraction (Vercel KV or in-memory)
├── src/
│   ├── main.jsx
│   ├── App.jsx              # Main app with auth state
│   └── components/
│       ├── AuthModal.jsx    # Login + registration modal
│       └── ProfilePanel.jsx # Slide-out profile editor
├── .env.local.example
├── dev-server.js
├── vercel.json
└── vite.config.js
```

---

## 🔐 Security Architecture

### Password storage
- Passwords are hashed with **bcrypt** (cost factor 12, ~250ms)
- Plaintext passwords are never stored or logged
- Login uses constant-time comparison to prevent timing attacks

### PII field encryption
- Sensitive fields (`firstName`, `lastName`, `email`, `zipCode`, `phone`) are encrypted with **AES-256-GCM** before being written to the database
- Each field gets a unique random 96-bit IV; the IV + auth tag + ciphertext are packed into a single base64 value
- The `ENCRYPTION_KEY` (32 bytes) lives only in server environment variables — never in the frontend bundle

### Sessions
- **HS256 JWT** signed with `JWT_SECRET`, 7-day expiry
- Token is stored in `localStorage` on the client
- All protected API routes verify the token server-side before processing

### What is and isn't encrypted

| Field | Storage |
|---|---|
| firstName, lastName, email, zipCode, phone | AES-256-GCM encrypted |
| password | bcrypt hashed (one-way) |
| isVeteran | Plaintext (not PII on its own) |
| createdAt, updatedAt | Plaintext |

---

## 🛠 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | Anthropic API key |
| `JWT_SECRET` | ✅ | 32+ char random string for JWT signing |
| `ENCRYPTION_KEY` | ✅ | 64 hex chars (32 bytes) for AES-256 |
| `KV_REST_API_URL` | Prod only | Auto-set by Vercel KV |
| `KV_REST_API_TOKEN` | Prod only | Auto-set by Vercel KV |

---

## 📝 Disclaimer

For informational purposes only. Not affiliated with any government entity. Verify program details with administering agencies.
