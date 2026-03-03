/**
 * lib/auth.js
 * Shared authentication and encryption utilities used by all /api/* functions.
 *
 * Security model:
 *  - Passwords  : bcrypt (cost factor 12) — one-way hash, never stored in plaintext
 *  - PII fields : AES-256-GCM symmetric encryption using ENCRYPTION_KEY env var
 *                 Each field gets a unique random IV; the IV is stored alongside
 *                 the ciphertext so decryption doesn't need extra state.
 *  - Sessions   : HS256 JWT signed with JWT_SECRET, 7-day expiry
 *
 * Environment variables required:
 *   JWT_SECRET       — random 32+ char string  (e.g. openssl rand -hex 32)
 *   ENCRYPTION_KEY   — exactly 64 hex chars     (32 bytes → AES-256)
 *                      generate: openssl rand -hex 32
 */

import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

// ─── Constants ────────────────────────────────────────────────────────────────
const BCRYPT_ROUNDS = 12          // ~250ms on modern hardware — good balance
const JWT_EXPIRY   = '7d'
const AES_ALGO     = 'aes-256-gcm'
const IV_BYTES     = 12           // 96-bit IV recommended for GCM
const TAG_BYTES    = 16           // GCM auth tag length

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getEncryptionKey() {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Generate with: openssl rand -hex 32')
  }
  return Buffer.from(hex, 'hex')
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters.')
  }
  return secret
}

// ─── Password hashing ─────────────────────────────────────────────────────────
export async function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, BCRYPT_ROUNDS)
}

export async function verifyPassword(plaintext, hash) {
  return bcrypt.compare(plaintext, hash)
}

// ─── AES-256-GCM field encryption ─────────────────────────────────────────────
/**
 * Encrypts a string field.
 * Returns a single base64 string encoding: iv (12B) + authTag (16B) + ciphertext
 * This self-contained format means each field can be decrypted independently.
 */
export function encryptField(plaintext) {
  if (plaintext === null || plaintext === undefined) return null
  const key  = getEncryptionKey()
  const iv   = randomBytes(IV_BYTES)
  const cipher = createCipheriv(AES_ALGO, key, iv)
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()])
  const tag  = cipher.getAuthTag()
  // Pack: [iv | tag | ciphertext] → base64
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

/**
 * Decrypts a field encrypted by encryptField().
 */
export function decryptField(encoded) {
  if (!encoded) return null
  const key  = getEncryptionKey()
  const buf  = Buffer.from(encoded, 'base64')
  const iv   = buf.subarray(0, IV_BYTES)
  const tag  = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
  const data = buf.subarray(IV_BYTES + TAG_BYTES)
  const decipher = createDecipheriv(AES_ALGO, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(data) + decipher.final('utf8')
}

// ─── JWT ──────────────────────────────────────────────────────────────────────
/**
 * Creates a signed JWT containing the user's id and email.
 * Sensitive profile fields are NOT included in the token.
 */
export function signToken(payload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRY, algorithm: 'HS256' })
}

/**
 * Verifies and decodes a JWT. Throws if invalid or expired.
 */
export function verifyToken(token) {
  return jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] })
}

/**
 * Extracts and verifies the Bearer token from an Authorization header.
 * Returns the decoded payload or null if missing/invalid.
 */
export function authFromHeader(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null
  try {
    return verifyToken(authHeader.slice(7))
  } catch {
    return null
  }
}

// ─── User profile encryption ──────────────────────────────────────────────────
/**
 * PII fields that are encrypted at rest.
 * Non-PII fields (isVeteran boolean, createdAt timestamp) are stored plaintext
 * since they carry no identifying information on their own.
 */
const PII_FIELDS = ['firstName', 'lastName', 'email', 'zipCode', 'phone']

/**
 * Encrypts all PII fields in a user profile object.
 * Safe to call before writing to the database.
 */
export function encryptProfile(profile) {
  const out = { ...profile }
  for (const field of PII_FIELDS) {
    if (out[field] !== undefined) out[field] = encryptField(out[field])
  }
  return out
}

/**
 * Decrypts all PII fields in a stored user profile object.
 * Safe to call after reading from the database.
 */
export function decryptProfile(stored) {
  if (!stored) return null
  const out = { ...stored }
  for (const field of PII_FIELDS) {
    if (out[field] !== undefined) out[field] = decryptField(out[field])
  }
  return out
}
