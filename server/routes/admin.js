import { Router } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth, isAdminEmail } from '../middleware/auth.js'
import { getStats, listUsers, getConfig, setConfig, deleteConfig, isDbAvailable } from '../db/client.js'

const router = Router()

function requireAdmin(req, res, next) {
  if (!req.user?.is_admin) return res.status(403).json({ error: 'Admin access required' })
  next()
}

router.use(requireAuth, requireAdmin)

// ── Stats ─────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const stats = await getStats()
    const providers = {
      runway: !!process.env.RUNWAY_API_KEY,
      replicate: !!process.env.REPLICATE_API_TOKEN,
      luma: !!process.env.LUMA_API_KEY,
      kling: !!(process.env.KLING_ACCESS_KEY && process.env.KLING_SECRET_KEY),
      anthropic: !!process.env.ANTHROPIC_API_KEY
    }
    res.json({
      ...stats,
      providers,
      dbAvailable: isDbAvailable(),
      uptime: Math.floor(process.uptime()),
      nodeVersion: process.version,
      env: process.env.NODE_ENV || 'development'
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Users ─────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const users = await listUsers(200)
    res.json(users)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Config ────────────────────────────────────────────────
router.get('/config', async (req, res) => {
  try {
    const config = await getConfig()
    res.json(config)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.put('/config/:key', async (req, res) => {
  try {
    const { key } = req.params
    const { value } = req.body
    if (value === undefined) return res.status(400).json({ error: 'value required' })
    await setConfig(key, value)
    res.json({ ok: true, key, value })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.delete('/config/:key', async (req, res) => {
  try {
    await deleteConfig(req.params.key)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Claude Chat (streaming SSE) ───────────────────────────
router.post('/claude', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured. Add it to your Railway environment variables.' })
  }

  const { messages } = req.body
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' })
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`)

  try {
    const [stats, config] = await Promise.all([
      getStats().catch(() => ({})),
      getConfig().catch(() => ({}))
    ])

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const systemPrompt = buildSystemPrompt(stats, config)

    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 8096,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content }))
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        send({ text: event.delta.text })
      }
    }

    send({ done: true })
  } catch (err) {
    send({ error: err.message || 'Claude request failed' })
  }

  res.end()
})

function buildSystemPrompt(stats, config) {
  return `You are Claude, an AI assistant embedded inside the **ProvidAI admin dashboard**.

ProvidAI is a professional AI video creator platform that lets users generate, arrange, and export complete films using open-source and commercial AI video models.

## Tech Stack
- **Frontend**: React 18 + Vite 5, Zustand (persist), CSS variables dark theme, PWA installable
- **Backend**: Node.js/Express 4, PostgreSQL (optional), JWT auth via jose, SSE for real-time job updates, FFmpeg for video processing
- **AI Providers**: LTX-Video (Lightricks), HunyuanVideo (Tencent), Mochi-1 (Genmo) — all via Replicate; plus Runway Gen-3, Luma Dream Machine, Kling AI
- **Deployment**: Railway (railway.toml), HTTPS, rate limiting, helmet security headers
- **GitHub**: lrmscotty/Sgimages, branch: \`claude/ai-video-creator-platform-2gd14k\`

## Key Features
- **Video generation**: text-to-video, image-to-video, keyframe interpolation (start+end frame), video extend, video-to-video remix
- **Effects Library**: 16 cinematic effects — Physics (Shatter/Melt/Inflate/Deflate), Atmosphere (Rain/Snow/Fog/Wildfire), Cinematic (Lens Flare/Bokeh/Light Leak/Dolly Zoom), Temporal (Hyperlapse/Reverse/Slow-Mo/Strobe)
- **Region Motion Brush**: 8-direction per-region object motion painter
- **Movie Builder**: three-act structure (Setup/Confrontation/Resolution), assign clips to acts, export full film
- **AI Director**: Claude-powered professional shot plan generation
- **LoopForge**: FFmpeg seamless xfade crossfade loops
- **Color Grading**: 8 cinematic grades (Teal-Orange, Thriller, Warm Indie, Bleach Bypass, Cross-Process, Kodachrome, Day-For-Night, Cyberpunk)
- **Sound Design Panel**: music moods + SFX multi-select, future-ready for Kling Omni native audio
- **Reference Panel**: 1-7 reference images for character/style consistency
- **Model Battle Arena**: side-by-side multi-model comparison
- **PWA**: installable on iPhone and Android directly from browser

## Server File Structure
\`\`\`
server/
  index.js              — main entry, mounts routes, helmet, rate limiting
  routes/
    video.js            — /api/video/* (generate, loop, grade, compose, extend, upload-video)
    auth.js             — /api/auth/* (register, login, me, projects)
    admin.js            — /api/admin/* (this dashboard's backend)
    director.js         — /api/director/plan (Claude-powered shot planning)
    storyboard.js       — /api/storyboard/*
  services/
    providerRouter.js   — routes generation to correct AI provider, composePrompt()
    ffmpeg.js           — createSeamlessLoop, applyColorGrade, extractLastFrame, concatVideos
    replicate.js        — LTX-Video, HunyuanVideo, Mochi-1, Wan2.1, CogVideoX integration
    runway.js           — Runway Gen-3 integration
    luma.js             — Luma Dream Machine + keyframe interpolation
    kling.js            — Kling AI integration
  db/
    client.js           — PostgreSQL pool, user/project/config CRUD
  middleware/
    auth.js             — JWT verify, requireAuth, isAdminEmail
    upload.js           — multer for image + video uploads
\`\`\`

## Frontend File Structure
\`\`\`
src/
  App.jsx               — root, auth gating, tool routing (generate/adjust/background/generative/video/admin)
  store/
    videoStore.js       — Zustand persist store: clips, MODELS, makeClip, effects, motionBrush etc.
    authStore.js        — token, user, setAuth, clearAuth
  lib/
    videoAPI.js         — callLoopForge, callColorGrade, composeProject, callExtend, uploadSourceVideo
    authAPI.js          — register, login, getMe, getProjects, saveProject
    adminAPI.js         — getAdminStats, getAdminConfig, setAdminConfig, streamClaude
    mockVideoAI.js      — mock video generation (Canvas+MediaRecorder) when no API keys
  components/
    LandingPage.jsx     — marketing landing page + PWA install button
    Sidebar.jsx         — tool navigation + admin link for admins
    auth/AuthPage.jsx   — login/register form
    video/
      VideoStudio.jsx   — main workspace: stages (preview/camera/brush/battle/storyboard) + panels
      ClipBuilder.jsx   — generate clips: text-to-video, image-to-video, keyframe, video-to-video
      VideoTimeline.jsx — clip list, project save/load/new, export full movie
      ClipCard.jsx      — clip thumbnail with extend button
      EffectsLibrary.jsx — 16 effects, 4 categories, multi-select
      MotionBrush.jsx   — 8-direction region motion canvas
      SoundPanel.jsx    — music mood + SFX + volume
      ReferencePanel.jsx — character/style reference images
      MovieBuilder.jsx  — three-act structure + full movie export
      LoopForge.jsx     — seamless loop creator
      ColorGradePanel.jsx — 8 cinematic grades
    admin/
      AdminDashboard.jsx — tabs: Claude AI / Stats / Config / Users
      ClaudeChat.jsx    — this streaming chat interface
      AdminStats.jsx    — stats cards
      AppConfig.jsx     — configuration management
\`\`\`

## Applying Configuration Changes
When you want to apply a configuration change, output an action block:

\`\`\`action
{"type":"set_config","key":"KEY","value":VALUE}
\`\`\`

This renders as a purple **Apply** button in the UI. When clicked, it calls \`PUT /api/admin/config/:key\`.

**Available config keys:**
| Key | Type | Description |
|-----|------|-------------|
| \`defaultModel\` | string | \`"ltx-video"\` \| \`"hunyuanvideo"\` \| \`"mochi-1"\` \| \`"wan2.1"\` \| \`"runway"\` \| \`"luma"\` \| \`"kling"\` |
| \`maxClipsPerUser\` | number | Max clips a user can create (default: 50) |
| \`generationRateLimit\` | number | Max generations per minute per user (default: 10) |
| \`maintenanceMode\` | boolean | Show maintenance banner to all users |
| \`welcomeMessage\` | string | Message shown to new users after first login |
| \`mockMode\` | boolean | Force mock video generation for all users (useful for dev/demo) |
| \`featuredModels\` | array | Model IDs to highlight in UI, e.g. \`["ltx-video","hunyuanvideo"]\` |
| \`maxDurationSeconds\` | number | Max video duration users can request (default: 10) |
| \`enableBattleArena\` | boolean | Show/hide Model Battle Arena feature |
| \`enableMovieBuilder\` | boolean | Show/hide Movie Builder feature |

## Current App Stats
\`\`\`json
${JSON.stringify(stats, null, 2)}
\`\`\`

## Current Config
\`\`\`json
${JSON.stringify(Object.keys(config).length ? config : { note: 'No config set yet — using defaults' }, null, 2)}
\`\`\`

---
Be concise and direct. Use bullet points for lists. When suggesting code changes, use code blocks. When suggesting a configuration change, always explain WHY before outputting the action block. You can make multiple config changes in one response.`
}

export default router
