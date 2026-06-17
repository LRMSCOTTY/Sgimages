import { useState } from 'react'
import { generateImage } from '../lib/mockAI.js'

const SUGGESTIONS = [
  'a serene mountain lake at dawn',
  'neon cyberpunk city in the rain',
  'abstract geometric pastel composition',
  'cosmic nebula in deep space'
]

const SIZES = [
  { label: 'Square · 768²', w: 768, h: 768 },
  { label: 'Landscape · 1024×640', w: 1024, h: 640 },
  { label: 'Portrait · 640×1024', w: 640, h: 1024 }
]

export default function GeneratePanel({ runTask, busy }) {
  const [prompt, setPrompt] = useState('')
  const [size, setSize] = useState(SIZES[0])

  function generate() {
    const p = prompt.trim()
    if (!p) return
    runTask('Generating image…', () =>
      generateImage(p, { width: size.w, height: size.h })
    )
  }

  return (
    <div className="panel-inner">
      <header className="panel-head">
        <h2>Generate</h2>
        <p>Describe an image and the mock engine will compose one.</p>
      </header>

      <label className="field-label">Prompt</label>
      <textarea
        className="prompt-input"
        rows={4}
        placeholder="e.g. a serene mountain lake at dawn"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />

      <div className="chips">
        {SUGGESTIONS.map((s) => (
          <button key={s} className="chip" onClick={() => setPrompt(s)}>
            {s}
          </button>
        ))}
      </div>

      <label className="field-label">Size</label>
      <div className="size-options">
        {SIZES.map((s) => (
          <button
            key={s.label}
            className={`size-btn ${size.label === s.label ? 'active' : ''}`}
            onClick={() => setSize(s)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <button
        className="primary-btn full"
        onClick={generate}
        disabled={busy || !prompt.trim()}
      >
        ✨ Generate image
      </button>
    </div>
  )
}
