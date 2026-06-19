/**
 * Netlify Function: claude
 * Handles POST /api/admin/claude — Claude AI streaming chat for the admin dashboard.
 * Uses ReadableStream SSE so the existing client-side SSE parser works unchanged.
 */

import * as jose from 'jose'
import Anthropic from '@anthropic-ai/sdk'
import { findUserById, isDbAvailable, initDb, getStats, getConfig } from '../../server/db/client.js'

let dbReady = false
async function ensureDb() {
  if (dbReady || !isDbAvailable()) return
  await initDb().catch(() => {})
  dbReady = true
}

function jwtSecret() {
  return new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-change-in-production-please')
}

function isAdminEmail(email) {
  const adminEmail = process.env.ADMIN_EMAIL
  if (adminEmail) return email === adminEmail
  return process.env.NODE_ENV !== 'production'
}

async function getAuthUser(req) {
  if (!isDbAvailable()) {
    return { id: 'anonymous', email: 'dev@local', name: 'Developer', plan: 'free', is_admin: true }
  }
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  try {
    const { payload } = await jose.jwtVerify(auth.slice(7), jwtSecret())
    const user = await findUserById(payload.userId)
    if (!user) return null
    return { ...user, is_admin: isAdminEmail(user.email) }
  } catch { return null }
}

function buildSystemPrompt(stats, config) {
  return `You are Claude, an AI assistant embedded inside the **ProvidAI admin dashboard**.

ProvidAI is a professional AI video creator platform that lets users generate, arrange, and export complete films using open-source and commercial AI video models.

## Tech Stack
- **Frontend**: React 18 + Vite 5, Zustand (persist), CSS variables dark theme, PWA installable
- **Backend**: Netlify Functions (serverless), PostgreSQL (Neon/Supabase), JWT auth via jose
- **AI Providers**: LTX-Video, HunyuanVideo, Mochi-1 (via Replicate); Runway Gen-3, Luma Dream Machine, Kling AI
- **Deployment**: Netlify (netlify.toml), also supports Railway (railway.toml)

## Key Features
- Video generation: text-to-video, image-to-video, keyframe interpolation, video extend
- Effects Library: 16 cinematic effects
- Region Motion Brush: 8-direction per-region object motion
- Movie Builder: three-act structure
- AI Director: Claude-powered shot planning
- Sound Design Panel, Reference Panel, Model Battle Arena
- PWA: installable on iPhone and Android

## Applying Config Changes
Output action blocks to apply config changes:
\`\`\`action
{"type":"set_config","key":"KEY","value":VALUE}
\`\`\`

**Available config keys:** defaultModel, mockMode, maintenanceMode, maxClipsPerUser, maxDurationSeconds, generationRateLimit, welcomeMessage, enableBattleArena, enableMovieBuilder

## Current Stats
\`\`\`json
${JSON.stringify(stats, null, 2)}
\`\`\`

## Current Config
\`\`\`json
${JSON.stringify(Object.keys(config).length ? config : { note: 'No config set yet — using defaults' }, null, 2)}
\`\`\`

Be concise and direct. Use bullet points. When suggesting config changes, explain why before the action block.`
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...CORS } })
  }

  await ensureDb()

  const user = await getAuthUser(req)
  if (!user) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } })
  }
  if (!user.is_admin) {
    return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured. Add it in the Netlify environment variables.' }), { status: 503, headers: { 'Content-Type': 'application/json', ...CORS } })
  }

  const { messages } = await req.json()
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: 'messages array required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } })
  }

  const [stats, config] = await Promise.all([
    getStats().catch(() => ({})),
    getConfig().catch(() => ({}))
  ])

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }
      try {
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
        const response = anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 8096,
          system: buildSystemPrompt(stats, config),
          messages: messages.map(m => ({ role: m.role, content: m.content }))
        })

        for await (const event of response) {
          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            send({ text: event.delta.text })
          }
        }
        send({ done: true })
      } catch (e) {
        send({ error: e.message || 'Claude request failed' })
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      ...CORS
    }
  })
}

export const config = { path: '/api/admin/claude' }
