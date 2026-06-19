import { useState } from 'react'
import AuthPage from './auth/AuthPage.jsx'

const FEATURES = [
  { icon: '🎞', title: 'Movie Builder', desc: 'Three-act structure, organize clips into scenes, export a complete film with a single click.' },
  { icon: '✨', title: '16 Cinematic Effects', desc: 'Shatter, melt, slow-mo, dolly zoom, rain, wildfire — inject physics & atmosphere into your generation prompt.' },
  { icon: '🖌', title: 'Region Motion Brush', desc: 'Paint directional motion onto specific areas of your source image. Up, right, zoom — region by region.' },
  { icon: '⟷', title: 'Keyframe Interpolation', desc: 'Upload a start and end frame. AI generates the cinematic journey between them.' },
  { icon: '🔊', title: 'Sound Design', desc: 'Select music mood and SFX — guides generation prompts today, native audio generation coming via Kling Omni.' },
  { icon: '⚔️', title: 'Model Battle Arena', desc: 'Send the same prompt to multiple AI models simultaneously. Side-by-side comparison, pick the winner.' },
  { icon: '🔁', title: 'Loop Forge', desc: 'FFmpeg seamless crossfade turns any clip into an infinite loop — perfect for backgrounds and social media.' },
  { icon: '🎭', title: 'AI Director', desc: 'Describe a scene, Claude AI generates a professional shot plan: establishing wide → medium → close-up → detail.' },
  { icon: '📱', title: 'Works on Any Device', desc: 'Install ProvidAI on your phone directly from the browser — no App Store required. Full PWA support.' }
]

const MODELS = [
  { name: 'LTX-Video', badge: 'FASTEST', desc: 'Lightricks — comparable to Runway, open-source', color: '#6366f1' },
  { name: 'HunyuanVideo', badge: 'BEST QUALITY', desc: 'Tencent — comparable to Luma Ray2, open-source', color: '#8b5cf6' },
  { name: 'Mochi-1', badge: 'BEST MOTION', desc: 'Genmo — exceptional motion quality, open-source', color: '#ec4899' },
  { name: 'Wan 2.1', badge: 'IMAGE→VIDEO', desc: 'WaveSpeed — fast image-to-video, open-source', color: '#f59e0b' },
  { name: 'Runway Gen-3', badge: 'COMMERCIAL', desc: 'Runway — industry standard text & image to video', color: '#10b981' },
  { name: 'Luma Dream', badge: 'COMMERCIAL', desc: 'Luma AI — cinematic keyframe interpolation', color: '#3b82f6' }
]

export default function LandingPage() {
  const [showAuth, setShowAuth] = useState(false)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [installed, setInstalled] = useState(false)

  useState(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => setInstalled(true))
    return () => window.removeEventListener('beforeinstallprompt', handler)
  })

  const handleInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setInstallPrompt(null)
  }

  if (showAuth) return <AuthPage onBack={() => setShowAuth(false)} />

  return (
    <div className="landing">
      {/* Nav */}
      <nav className="landing-nav">
        <div className="landing-nav-logo">🎬 ProvidAI</div>
        <button className="ghost-btn" onClick={() => setShowAuth(true)}>Sign In</button>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-hero-badge">Open-Source AI · No Expensive Licenses Required</div>
        <h1 className="landing-hero-title">
          Make Professional<br />AI Videos & Movies
        </h1>
        <p className="landing-hero-sub">
          Powered by LTX-Video, HunyuanVideo, Mochi-1, Runway, Luma, and Kling.<br />
          From single clips to complete three-act films — free to start. Install on any device.
        </p>
        <div className="landing-hero-btns">
          <button className="primary-btn landing-cta" onClick={() => setShowAuth(true)}>
            Start Creating Free →
          </button>
          {installPrompt && !installed && (
            <button className="install-btn" onClick={handleInstall}>
              📲 Add to Home Screen
            </button>
          )}
          {installed && (
            <span className="install-done">✓ ProvidAI installed on your device</span>
          )}
          <span className="landing-hero-note">No credit card • Free forever plan • Installs on your phone</span>
        </div>

        {/* Mock studio preview */}
        <div className="landing-preview">
          <div className="landing-preview-bar">
            <span className="lp-dot red" /><span className="lp-dot yellow" /><span className="lp-dot green" />
            <span className="lp-title">ProvidAI — AI Video Creator</span>
          </div>
          <div className="landing-preview-body">
            <div className="lp-sidebar">
              {['🎬 Clip', '🎭 Director', '✨ FX', '🔊 Sound', '🎞 Movie'].map(t => (
                <div key={t} className="lp-sidebar-item">{t}</div>
              ))}
            </div>
            <div className="lp-center">
              <div className="lp-stage">
                <div className="lp-stage-label">▶ Preview</div>
                <div className="lp-video-mock">
                  <div className="lp-video-glow" />
                  <span style={{ fontSize: 32 }}>🎬</span>
                </div>
              </div>
              <div className="lp-timeline-mock">
                {['5s', '10s', '5s', '8s', '5s'].map((d, i) => (
                  <div key={i} className={`lp-clip ${i === 1 ? 'active' : ''}`}>{d}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Open-source models */}
      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-section-label">OPEN-SOURCE MODELS</div>
          <h2 className="landing-section-title">Same Quality as Runway & Luma — Open Source</h2>
          <p className="landing-section-desc">
            All models run on <strong>Replicate</strong> with a single API key (~$0.03–0.10 per video).
            No per-seat commercial licenses.
          </p>
          <div className="model-cards">
            {MODELS.map(m => (
              <div key={m.name} className="model-card" style={{ borderColor: m.color + '40' }}>
                <div className="model-card-badge" style={{ background: m.color + '20', color: m.color }}>{m.badge}</div>
                <div className="model-card-name">{m.name}</div>
                <div className="model-card-desc">{m.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="landing-section landing-features-sec">
        <div className="landing-section-inner">
          <div className="landing-section-label">FEATURES</div>
          <h2 className="landing-section-title">Everything a Professional Needs</h2>
          <div className="features-grid">
            {FEATURES.map(f => (
              <div key={f.title} className="feature-card">
                <span className="feature-icon">{f.icon}</span>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="landing-cta-section">
        <h2>Ready to make your first video?</h2>
        <p>Sign up free. Install ProvidAI on your phone — no App Store needed.</p>
        <button className="primary-btn landing-cta" onClick={() => setShowAuth(true)}>
          Get Started Free →
        </button>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <span>🎬 ProvidAI</span>
        <span>AI Video Creator Platform</span>
      </footer>
    </div>
  )
}
