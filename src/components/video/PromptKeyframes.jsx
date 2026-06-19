import { useState } from 'react'

const POSITIONS = [0, 25, 50, 75, 100]

export default function PromptKeyframes({ keyframes = [], onChange, duration = 5 }) {
  const [expanded, setExpanded] = useState(false)

  const getKF = (t) => keyframes.find(k => k.t === t) || null

  const setKF = (t, prompt) => {
    const filtered = keyframes.filter(k => k.t !== t)
    if (prompt) onChange([...filtered, { t, prompt }].sort((a, b) => a.t - b.t))
    else onChange(filtered)
  }

  if (!expanded) {
    return (
      <button className="secondary-btn full" onClick={() => setExpanded(true)}>
        ⏱ Prompt Keyframes {keyframes.length > 0 ? `(${keyframes.length} set)` : ''}
      </button>
    )
  }

  return (
    <div className="keyframes-editor">
      <div className="keyframes-header">
        <span>Prompt Keyframes <span className="badge">UNIQUE</span></span>
        <button className="ghost-btn" onClick={() => setExpanded(false)}>✕</button>
      </div>
      <p className="hint-text">Set different prompts at each time point. AI will evolve the scene smoothly.</p>
      <div className="keyframe-rail">
        <div className="kf-track">
          {POSITIONS.map(t => (
            <div key={t} className="kf-mark" style={{ left: `${t}%` }}>
              <div className={`kf-dot ${getKF(t) ? 'active' : ''}`} />
              <span className="kf-label">{t}%</span>
            </div>
          ))}
        </div>
      </div>
      <div className="keyframe-inputs">
        {POSITIONS.map(t => (
          <div key={t} className="kf-row">
            <span className="kf-t-badge">{t}%</span>
            <input
              type="text"
              className="prompt-input"
              style={{ minHeight: 'auto', padding: '7px 10px', fontSize: 12 }}
              placeholder={t === 0 ? 'Opening scene...' : t === 100 ? 'Final scene...' : `Scene at ${t}%...`}
              value={getKF(t)?.prompt || ''}
              onChange={e => setKF(t, e.target.value)}
            />
          </div>
        ))}
      </div>
      <button className="secondary-btn full" onClick={() => { onChange([]); setExpanded(false) }}>
        Clear All Keyframes
      </button>
    </div>
  )
}
