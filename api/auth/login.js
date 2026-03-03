/**
 * api/auth/login.js
 * POST /api/auth/login
 *
 * Authenticates an existing user.
 * - Looks up user by email
 * - Verifies password against bcrypt hash (constant-time comparison)
 * - Decrypts PII fields for the response
 * - Returns a signed JWT and decrypted profile on success
 *
 * Body: { email, password }
 */

import { verifyPassword, signToken, decryptProfile } from '../../lib/auth.js'
import { getUserByEmail } from '../../lib/db.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email, password } = req.body ?? {}

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  try {
    // ── Lookup ─────────────────────────────────────────────────────────────────
    const stored = await getUserByEmail(email.trim().toLowerCase())

    // Always run bcrypt even when user not found to prevent timing-based
    // user enumeration attacks (bcrypt.compare has consistent timing)
    const dummyHash = '$2a$12$invalidhashpaddingtomaintainconsistenttimingXXXXXXXXXXXXX'
    const passwordOk = await verifyPassword(password, stored?.passwordHash ?? dummyHash)

    if (!stored || !passwordOk) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    // ── Decrypt profile ────────────────────────────────────────────────────────
    const profile = decryptProfile(stored)

    // ── Issue JWT ──────────────────────────────────────────────────────────────
    const token = signToken({ sub: stored.id, email: profile.email })

    return res.status(200).json({
      token,
      user: {
        id:        stored.id,
        firstName: profile.firstName,
        lastName:  profile.lastName,
        email:     profile.email,
        zipCode:   profile.zipCode,
        isVeteran: stored.isVeteran,
      },
    })
  } catch (err) {
    console.error('[login]', err)
    return res.status(500).json({ error: 'Login failed. Please try again.' })
  }
}
