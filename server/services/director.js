import Anthropic from '@anthropic-ai/sdk'

let client = null
function getClient() {
  if (!client && process.env.ANTHROPIC_API_KEY) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return client
}

const SHOT_TEMPLATES = {
  person: [
    { shot: 'Establishing Wide', cameraRig: 'dolly-push-in', durationHint: 5 },
    { shot: 'Medium Shot', cameraRig: 'steadicam-walk', durationHint: 5 },
    { shot: 'Close-Up', cameraRig: 'static', durationHint: 3 },
    { shot: 'Reaction / Detail', cameraRig: 'rack-focus', durationHint: 3 }
  ],
  landscape: [
    { shot: 'Aerial Establishing', cameraRig: 'drone-establishing', durationHint: 10 },
    { shot: 'Horizontal Pan', cameraRig: 'orbital', durationHint: 5 },
    { shot: 'Ground Level Detail', cameraRig: 'dolly-push-in', durationHint: 5 },
    { shot: 'Sky Tilt Reveal', cameraRig: 'tilt-reveal', durationHint: 5 }
  ],
  product: [
    { shot: 'Hero Reveal', cameraRig: 'dolly-push-in', durationHint: 5 },
    { shot: 'Orbital Showcase', cameraRig: 'orbital', durationHint: 5 },
    { shot: 'Detail Macro', cameraRig: 'rack-focus', durationHint: 3 },
    { shot: 'Lifestyle Context', cameraRig: 'steadicam-walk', durationHint: 5 }
  ],
  action: [
    { shot: 'Wide Master', cameraRig: 'drone-establishing', durationHint: 5 },
    { shot: 'Dynamic Follow', cameraRig: 'handheld-doc', durationHint: 5 },
    { shot: 'Whip Pan Transition', cameraRig: 'whip-pan', durationHint: 3 },
    { shot: 'Impact Close-Up', cameraRig: 'static', durationHint: 3 },
    { shot: 'Slow Motion Detail', cameraRig: 'dolly-push-in', durationHint: 5 }
  ]
}

const SYSTEM_PROMPT = `You are a master cinematographer and film director with 30 years of experience.
Given a scene description, generate a professional shot sequence following the 5-shot system and film grammar principles.

Return a JSON array of shot objects with this exact schema:
[
  {
    "shot": "Shot type name",
    "prompt": "Detailed cinematic video generation prompt for this specific shot",
    "cameraRig": "one of: drone-establishing|steadicam-walk|handheld-doc|dolly-push-in|hitchcock-zoom|whip-pan|rack-focus|orbital|tilt-reveal|static",
    "duration": 3|5|10,
    "model": "one of: runway-gen3-turbo|luma-dream-machine|kling-v2|wan2.1",
    "notes": "Brief cinematographic rationale"
  }
]

Rules:
- Start with an establishing shot to orient the viewer
- Build from wide to close (or close to wide for mystery)
- Each prompt must be highly descriptive, cinematic, and specific
- Choose models: Runway for cinematic quality, Kling for human subjects, Luma for landscapes
- Return 3-6 shots maximum
- Return ONLY valid JSON, no markdown`

export async function analyzeScene(sceneDescription, imageDescription) {
  const ai = getClient()

  if (ai) {
    return analyzeWithClaude(ai, sceneDescription, imageDescription)
  }

  // Fallback: rule-based shot plan
  return buildRuleBasedPlan(sceneDescription)
}

async function analyzeWithClaude(ai, sceneDescription, imageDescription) {
  const userContent = imageDescription
    ? `Scene: ${sceneDescription}\nImage analysis: ${imageDescription}`
    : `Scene: ${sceneDescription}`

  const msg = await ai.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }]
  })

  const text = msg.content[0].text.trim()
  const parsed = JSON.parse(text)
  return Array.isArray(parsed) ? parsed : parsed.shots || parsed
}

function buildRuleBasedPlan(description) {
  const lower = description.toLowerCase()
  let template = 'landscape'

  if (/person|people|man|woman|character|actor|subject/.test(lower)) template = 'person'
  else if (/product|object|item|thing/.test(lower)) template = 'product'
  else if (/action|run|jump|fight|chase|sport/.test(lower)) template = 'action'

  const shots = SHOT_TEMPLATES[template]
  return shots.map((s, i) => ({
    shot: s.shot,
    prompt: buildMockPrompt(description, s.shot),
    cameraRig: s.cameraRig,
    duration: s.durationHint,
    model: 'runway-gen3-turbo',
    notes: `Shot ${i + 1} of ${shots.length}: ${s.shot}`
  }))
}

function buildMockPrompt(scene, shotType) {
  const suffixes = {
    'Establishing Wide': 'cinematic establishing shot, wide angle, natural lighting, 4K',
    'Medium Shot': 'medium shot, natural depth of field, professional cinematography',
    'Close-Up': 'extreme close up, shallow depth of field, bokeh background',
    'Aerial Establishing': 'aerial drone shot, golden hour lighting, sweeping vista',
    'Hero Reveal': 'product hero shot, dramatic lighting, studio quality',
    'Dynamic Follow': 'action shot, dynamic movement, kinetic energy',
    default: 'cinematic, professional filmmaking, high quality'
  }
  const suffix = suffixes[shotType] || suffixes.default
  return `${scene}, ${suffix}`
}
