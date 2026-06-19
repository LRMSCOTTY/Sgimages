import * as jose from 'jose'
import { findUserById, isDbAvailable } from '../db/client.js'

export function isAdminEmail(email) {
  const adminEmail = process.env.ADMIN_EMAIL
  if (adminEmail) return email === adminEmail
  // Dev mode: anonymous user is always admin for testing
  return process.env.NODE_ENV !== 'production'
}

const JWT_EXPIRES = '30d'

function getSecret() {
  const secret = process.env.JWT_SECRET || 'dev-secret-change-in-production-please'
  return new TextEncoder().encode(secret)
}

export async function signToken(payload) {
  return jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES)
    .sign(getSecret())
}

export async function verifyToken(token) {
  const { payload } = await jose.jwtVerify(token, getSecret())
  return payload
}

export async function requireAuth(req, res, next) {
  if (!isDbAvailable()) {
    req.user = { id: 'anonymous', email: 'dev@local', name: 'Developer', plan: 'free', is_admin: true }
    return next()
  }

  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  const token = header.slice(7)
  try {
    const payload = await verifyToken(token)
    const user = await findUserById(payload.userId)
    if (!user) return res.status(401).json({ error: 'User not found' })
    req.user = { ...user, is_admin: isAdminEmail(user.email) }
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export async function optionalAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return next()
  try {
    const token = header.slice(7)
    const payload = await verifyToken(token)
    const user = await findUserById(payload.userId)
    if (user) req.user = user
  } catch {}
  next()
}
