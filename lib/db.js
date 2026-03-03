/**
 * lib/db.js
 * Thin database abstraction layer.
 *
 * Production  → Vercel KV (Redis-compatible, zero-config on Vercel)
 * Local dev   → In-memory Map (data resets on server restart, fine for dev)
 *
 * To switch to a different store (Postgres, MongoDB, PlanetScale, etc.),
 * only this file needs to change — all API routes use this interface.
 *
 * User records are keyed two ways:
 *   user:{id}            → full encrypted user object
 *   email_index:{email}  → user id  (allows login-by-email lookup)
 *
 * Note: email in the index key is stored as lowercase plaintext intentionally —
 * it's a lookup key, not PII storage. The actual email value inside the user
 * record IS encrypted via encryptProfile() before being written here.
 */

// ─── In-memory store (local dev fallback) ────────────────────────────────────
const memStore = new Map()

async function memGet(key) {
  return memStore.get(key) ?? null
}
async function memSet(key, value) {
  memStore.set(key, value)
}
async function memDel(key) {
  memStore.delete(key)
}

// ─── Vercel KV (production) ───────────────────────────────────────────────────
let kv = null
async function getKV() {
  if (kv) return kv
  try {
    // Dynamically import so local dev without @vercel/kv installed doesn't crash
    const mod = await import('@vercel/kv')
    kv = mod.kv
    return kv
  } catch {
    return null
  }
}

// ─── Unified interface ────────────────────────────────────────────────────────
const IS_VERCEL = !!process.env.VERCEL

async function dbGet(key) {
  if (IS_VERCEL) {
    const store = await getKV()
    return store ? store.get(key) : null
  }
  return memGet(key)
}

async function dbSet(key, value) {
  if (IS_VERCEL) {
    const store = await getKV()
    if (store) await store.set(key, value)
    return
  }
  return memSet(key, value)
}

async function dbDel(key) {
  if (IS_VERCEL) {
    const store = await getKV()
    if (store) await store.del(key)
    return
  }
  return memDel(key)
}

// ─── User CRUD ────────────────────────────────────────────────────────────────
export async function getUserById(id) {
  return dbGet(`user:${id}`)
}

export async function getUserByEmail(email) {
  const id = await dbGet(`email_index:${email.toLowerCase()}`)
  if (!id) return null
  return dbGet(`user:${id}`)
}

export async function createUser(user) {
  // user must already have: id, passwordHash, and encrypted PII fields
  await dbSet(`user:${user.id}`, user)
  await dbSet(`email_index:${user.emailIndex}`, user.id)
  return user
}

export async function updateUser(id, updates) {
  const existing = await getUserById(id)
  if (!existing) throw new Error('User not found')
  const merged = { ...existing, ...updates, updatedAt: new Date().toISOString() }
  await dbSet(`user:${id}`, merged)
  return merged
}

export async function deleteUser(id, email) {
  await dbDel(`user:${id}`)
  await dbDel(`email_index:${email.toLowerCase()}`)
}
