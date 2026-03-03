/**
 * api/auth/register.js
 * POST /api/auth/register
 *
 * Creates a new user account.
 * - Validates input
 * - Checks for duplicate email
 * - Hashes password with bcrypt (cost 12)
 * - Encrypts all PII fields with AES-256-GCM before storage
 * - Returns a signed JWT on success
 *
 * Body: { firstName, lastName, email, password, zipCode?, phone?, isVeteran? }
 */

import { randomUUID } from 'crypto'
import { hashPassword, signToken, encryptProfile } from '../../lib/auth.js'
import { getUserByEmail, createUser } from '../../lib/db.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { firstName, lastName, email, password, zipCode, phone, isVeteran } = req.body ?? {}

  // ── Validation ──────────────────────────────────────────────────────────────
  const errors = {}
  if (!firstName?.trim())              errors.firstName = 'First name is required'
  if (!lastName?.trim())               errors.lastName  = 'Last name is required'
  if (!email?.trim())                  errors.email     = 'Email is required'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Invalid email address'
  if (!password)                       errors.password  = 'Password is required'
  else if (password.length < 8)        errors.password  = 'Password must be at least 8 characters'
  else if (!/[A-Z]/.test(password))    errors.password  = 'Password must include an uppercase letter'
  else if (!/[0-9]/.test(password))    errors.password  = 'Password must include a number'

  if (Object.keys(errors).length) {
    return res.status(422).json({ error: 'Validation failed', fields: errors })
  }

  try {
    // ── Duplicate check ────────────────────────────────────────────────────────
    const existing = await getUserByEmail(email.trim().toLowerCase())
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' })
    }

    // ── Hash password ──────────────────────────────────────────────────────────
    const passwordHash = await hashPassword(password)

    // ── Build & encrypt user record ────────────────────────────────────────────
    const id = randomUUID()
    const now = new Date().toISOString()

    const rawProfile = {
      id,
      firstName:  firstName.trim(),
      lastName:   lastName.trim(),
      email:      email.trim().toLowerCase(),
      zipCode:    zipCode?.trim() ?? null,
      phone:      phone?.trim() ?? null,
    }

    // encryptProfile() encrypts PII fields; non-PII fields are stored plaintext
    const encryptedProfile = encryptProfile(rawProfile)

    const user = {
      ...encryptedProfile,
      // emailIndex is the plaintext lookup key (NOT the encrypted email value)
      emailIndex:   email.trim().toLowerCase(),
      passwordHash,            // bcrypt hash — safe to store
      isVeteran:    !!isVeteran,
      createdAt:    now,
      updatedAt:    now,
    }

    await createUser(user)

    // ── Issue JWT ──────────────────────────────────────────────────────────────
    const token = signToken({ sub: id, email: email.trim().toLowerCase() })

    return res.status(201).json({
      token,
      user: {
        id,
        firstName:  firstName.trim(),
        lastName:   lastName.trim(),
        email:      email.trim().toLowerCase(),
        zipCode:    zipCode?.trim() ?? null,
        isVeteran:  !!isVeteran,
      },
    })
  } catch (err) {
    console.error('[register]', err)
    return res.status(500).json({ error: 'Registration failed. Please try again.' })
  }
}
