/**
 * api/auth/profile.js
 * GET  /api/auth/profile  — fetch current user's decrypted profile
 * PATCH /api/auth/profile — update profile fields (re-encrypts PII on write)
 *
 * Requires: Authorization: Bearer <token>
 */

import { authFromHeader, encryptProfile, decryptProfile } from '../../lib/auth.js'
import { getUserById, updateUser } from '../../lib/db.js'

export default async function handler(req, res) {
  // ── Auth guard ─────────────────────────────────────────────────────────────
  const decoded = authFromHeader(req.headers.authorization)
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' })

  // ── GET — return decrypted profile ─────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const stored = await getUserById(decoded.sub)
      if (!stored) return res.status(404).json({ error: 'User not found' })

      const profile = decryptProfile(stored)
      return res.status(200).json({
        id:        stored.id,
        firstName: profile.firstName,
        lastName:  profile.lastName,
        email:     profile.email,
        zipCode:   profile.zipCode,
        phone:     profile.phone,
        isVeteran: stored.isVeteran,
        createdAt: stored.createdAt,
        updatedAt: stored.updatedAt,
      })
    } catch (err) {
      console.error('[profile GET]', err)
      return res.status(500).json({ error: 'Failed to load profile' })
    }
  }

  // ── PATCH — update allowed fields ──────────────────────────────────────────
  if (req.method === 'PATCH') {
    try {
      const { firstName, lastName, zipCode, phone, isVeteran } = req.body ?? {}

      // Build only the fields that were actually sent
      const updates = {}
      const piiUpdates = {}

      if (firstName !== undefined) piiUpdates.firstName = firstName.trim()
      if (lastName  !== undefined) piiUpdates.lastName  = lastName.trim()
      if (zipCode   !== undefined) piiUpdates.zipCode   = zipCode?.trim() ?? null
      if (phone     !== undefined) piiUpdates.phone     = phone?.trim() ?? null
      if (isVeteran !== undefined) updates.isVeteran    = !!isVeteran

      // Re-encrypt any PII fields that changed
      if (Object.keys(piiUpdates).length) {
        const encrypted = encryptProfile(piiUpdates)
        Object.assign(updates, encrypted)
      }

      const stored = await updateUser(decoded.sub, updates)
      const profile = decryptProfile(stored)

      return res.status(200).json({
        id:        stored.id,
        firstName: profile.firstName,
        lastName:  profile.lastName,
        email:     profile.email,
        zipCode:   profile.zipCode,
        phone:     profile.phone,
        isVeteran: stored.isVeteran,
        updatedAt: stored.updatedAt,
      })
    } catch (err) {
      console.error('[profile PATCH]', err)
      return res.status(500).json({ error: 'Failed to update profile' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
