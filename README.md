# 🌿 Senior Benefits Advisor

An autonomous AI agent that finds federal, state, and local benefit programs for seniors (60+) — including veteran benefits — within a 10-mile radius of any US location.

---

## 🚀 Deploy to Vercel in 5 Minutes

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
gh repo create senior-benefits-advisor --public --push
# or manually create a repo on github.com and push
```

### 2. Import on Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repo
3. Framework will auto-detect as **Vite**
4. Click **Environment Variables** and add:
   ```
   ANTHROPIC_API_KEY = sk-ant-your-key-here
   ```
5. Click **Deploy**

That's it. Vercel automatically serves `/api/chat.js` as a serverless function. Your API key stays on the server — never exposed to the browser.

---

## 💻 Local Development

### Prerequisites
- Node.js 18+
- An Anthropic API key from [console.anthropic.com](https://console.anthropic.com)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Create your local env file
cp .env.local.example .env.local
# Then edit .env.local and add your real ANTHROPIC_API_KEY

# 3. Start the API proxy server (Terminal 1)
node dev-server.js

# 4. Start the Vite dev server (Terminal 2)
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

> The Vite dev server proxies `/api` requests to the local Express server on port 3001, which adds your API key and forwards to Anthropic. This mirrors exactly how it works in production on Vercel.

---

## 🗂 Project Structure

```
senior-benefits-app/
├── api/
│   └── chat.js          # Vercel serverless function — API proxy
├── public/
│   └── favicon.svg
├── src/
│   ├── main.jsx         # React entry point
│   └── App.jsx          # Main application component
├── .env.local.example   # Copy to .env.local, add your key
├── .gitignore           # Excludes .env.local, node_modules, dist
├── dev-server.js        # Local Express proxy for development
├── index.html           # HTML entry point
├── package.json
├── vercel.json          # Vercel routing config
└── vite.config.js       # Vite config with dev proxy
```

---

## 🏗 Architecture

```
Browser (React)
    │
    │  POST /api/chat  (no API key in browser)
    ▼
Vercel Serverless Function  ← ANTHROPIC_API_KEY lives here
(api/chat.js)
    │
    │  POST https://api.anthropic.com/v1/messages
    ▼
Anthropic API
```

---

## ✨ Features

- **10-mile radius search** — finds programs in the city + surrounding towns
- **Veteran mode** — toggle to include VA healthcare, pension, Aid & Attendance, VSOs, and more
- **All 50 states** — federal, state, and local programs
- **Category filters** — Healthcare, Housing, Food, Prescriptions, Utilities, Transportation, Veterans, Financial Aid
- **Multi-turn chat** — ask follow-up questions about eligibility, how to apply, etc.

---

## 🔑 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ Yes | Your Anthropic API key. Get one at [console.anthropic.com](https://console.anthropic.com) |

Set this in:
- **Local dev**: `.env.local` file
- **Vercel**: Project Settings → Environment Variables

---

## 🛠 Other Deployment Options

### Netlify

1. Push to GitHub
2. Connect on [netlify.com](https://netlify.com)
3. Set build command: `npm run build`, publish dir: `dist`
4. Rename `api/chat.js` → `netlify/functions/chat.js` and update the fetch URL in `App.jsx` to `/.netlify/functions/chat`
5. Add `ANTHROPIC_API_KEY` in Site Settings → Environment Variables

### Render / Railway

1. Create a new Web Service
2. Add a simple Express server that serves the built Vite app and handles `/api/chat`
3. Set `ANTHROPIC_API_KEY` as an environment variable

---

## 📝 Disclaimer

This tool is for informational purposes only. Users should verify current eligibility requirements and program details directly with administering agencies. Not affiliated with any government entity.
