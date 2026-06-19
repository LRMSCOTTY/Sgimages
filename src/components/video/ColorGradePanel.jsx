import { useState } from 'react'

const LUTS = [
  { id: 'teal-orange', name: 'Teal & Orange', desc: 'Hollywood blockbuster', preview: 'linear-gradient(135deg, #0b6b80, #d4641a)' },
  { id: 'desaturated-thriller', name: 'Thriller', desc: 'Desaturated cold tones', preview: 'linear-gradient(135deg, #2a2f35, #8aa0b0)' },
  { id: 'warm-indie', name: 'Warm Indie', desc: 'Golden nostalgic film', preview: 'linear-gradient(135deg, #8b5e3c, #f0c87a)' },
  { id: 'bleach-bypass', name: 'Bleach Bypass', desc: 'High contrast desaturated', preview: 'linear-gradient(135deg, #1a1a1a, #b8b8b8)' },
  { id: 'cross-process', name: 'Cross Process', desc: 'Shifted hues, vivid', preview: 'linear-gradient(135deg, #1a4a8a, #8aae1a)' },
  { id: 'kodachrome', name: 'Kodachrome', desc: 'Classic film warmth', preview: 'linear-gradient(135deg, #c43c1a, #e8c46a)' },
  { id: 'day-for-night', name: 'Day For Night', desc: 'Night scene simulation', preview: 'linear-gradient(135deg, #0a0820, #1a2540)' },
  { id: 'cyberpunk', name: 'Cyberpunk', desc: 'Neon city vibes', preview: 'linear-gradient(135deg, #7c5cff, #ff3c7a)' }
]

export default function ColorGradePanel({ value, onChange }) {
  return (
    <div className="color-grade-panel">
      <div className="panel-head">
        <h2>Color Grade</h2>
        <p>Apply cinematic LUT presets to your generated video.</p>
      </div>
      <div className="lut-grid">
        {LUTS.map(lut => (
          <button
            key={lut.id}
            className={`lut-btn ${value === lut.id ? 'active' : ''}`}
            onClick={() => onChange(value === lut.id ? null : lut.id)}
          >
            <div className="lut-preview" style={{ background: lut.preview }} />
            <div className="lut-info">
              <span className="lut-name">{lut.name}</span>
              <span className="lut-desc">{lut.desc}</span>
            </div>
          </button>
        ))}
      </div>
      {value && (
        <div className="lut-note">
          <span>✓ Grade will be applied server-side via FFmpeg after generation.</span>
          <button className="ghost-btn" onClick={() => onChange(null)}>Remove Grade</button>
        </div>
      )}
    </div>
  )
}
