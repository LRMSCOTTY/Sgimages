import { useState } from 'react'

const SUGGESTIONS = [
  'a serene mountain lake at dawn',
  'neon cyberpunk city in the rain',
  'abstract geometric pastel composition',
  'cosmic nebula in deep space'
]

const SIZES = [
  { label: 'Square · 768²', width: 768, height: 768 },
  { label: 'Landscape · 1024×640', width: 1024, height: 640 },
  { label: 'Portrait · 640×1024', width: 640, height: 1024 }
]

export default function GeneratePanel({ editor }) {
  const [prompt, setPrompt] = useState('')
  const [size, setSize] = useState(SIZES[0])

  function generate() {
    const p = prompt.trim()
    if (!p) return
    editor.generate(p, { width: size.width, height: size.height })
  }

  return (
    <div className="panel-inner">
      <header className="panel-head">
        <h2>Generate</h2>
        <p>Describe an image and the engine will compose one. It becomes a fresh, editable document.</p>
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

      <button className="primary-btn full" onClick={generate} disabled={editor.busy || !prompt.trim()}>
        ✨ Generate image
      </button>
    </div>
  )
}
