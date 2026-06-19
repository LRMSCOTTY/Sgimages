import pg from 'pg'
import { v4 as uuidv4 } from 'uuid'

const { Pool } = pg

let pool = null

export function getDb() {
  if (!pool && process.env.DATABASE_URL) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL ? { rejectUnauthorized: false } : false })
  }
  return pool
}

export function isDbAvailable() {
  return !!(process.env.DATABASE_URL)
}

export async function initDb() {
  const db = getDb()
  if (!db) return

  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT,
      plan TEXT DEFAULT 'free',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      data JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `)

  console.log('  Database initialized')
}

export async function createUser({ email, password, name }) {
  const db = getDb()
  const id = uuidv4()
  const res = await db.query(
    `INSERT INTO users (id, email, password, name) VALUES ($1, $2, $3, $4) RETURNING id, email, name, plan, created_at`,
    [id, email.toLowerCase().trim(), password, name || null]
  )
  return res.rows[0]
}

export async function findUserByEmail(email) {
  const db = getDb()
  const res = await db.query(`SELECT * FROM users WHERE email = $1`, [email.toLowerCase().trim()])
  return res.rows[0] || null
}

export async function findUserById(id) {
  const db = getDb()
  const res = await db.query(`SELECT id, email, name, plan, created_at FROM users WHERE id = $1`, [id])
  return res.rows[0] || null
}

export async function getUserProjects(userId) {
  const db = getDb()
  const res = await db.query(
    `SELECT id, name, created_at, updated_at FROM projects WHERE user_id = $1 ORDER BY updated_at DESC`,
    [userId]
  )
  return res.rows
}

export async function getProject(id, userId) {
  const db = getDb()
  const res = await db.query(`SELECT * FROM projects WHERE id = $1 AND user_id = $2`, [id, userId])
  return res.rows[0] || null
}

export async function saveProject({ id, userId, name, data }) {
  const db = getDb()
  const projId = id || uuidv4()
  const res = await db.query(`
    INSERT INTO projects (id, user_id, name, data)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, data = EXCLUDED.data, updated_at = NOW()
    RETURNING id, name, created_at, updated_at
  `, [projId, userId, name, JSON.stringify(data)])
  return res.rows[0]
}

export async function deleteProject(id, userId) {
  const db = getDb()
  const res = await db.query(`DELETE FROM projects WHERE id = $1 AND user_id = $2`, [id, userId])
  return res.rowCount > 0
}

// ── Admin helpers ─────────────────────────────────────────
export async function getStats() {
  const db = getDb()
  if (!db) return { users: 0, projects: 0, recentUsers: [] }
  const [uRow, pRow, recent] = await Promise.all([
    db.query(`SELECT COUNT(*) AS count FROM users`),
    db.query(`SELECT COUNT(*) AS count FROM projects`),
    db.query(`SELECT id, email, name, created_at FROM users ORDER BY created_at DESC LIMIT 5`)
  ])
  return {
    users: parseInt(uRow.rows[0].count),
    projects: parseInt(pRow.rows[0].count),
    recentUsers: recent.rows
  }
}

export async function listUsers(limit = 100) {
  const db = getDb()
  if (!db) return []
  const res = await db.query(
    `SELECT id, email, name, plan, created_at FROM users ORDER BY created_at DESC LIMIT $1`,
    [limit]
  )
  return res.rows
}

export async function getConfig() {
  const db = getDb()
  if (!db) return {}
  const res = await db.query(`SELECT key, value FROM app_config`)
  return Object.fromEntries(res.rows.map(r => [r.key, r.value]))
}

export async function setConfig(key, value) {
  const db = getDb()
  if (!db) return
  await db.query(
    `INSERT INTO app_config (key, value, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, JSON.stringify(value)]
  )
}

export async function deleteConfig(key) {
  const db = getDb()
  if (!db) return
  await db.query(`DELETE FROM app_config WHERE key = $1`, [key])
}
