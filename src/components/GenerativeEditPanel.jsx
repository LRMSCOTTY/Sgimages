import { useState } from 'react'
import UploadButton from './UploadButton.jsx'

const SUGGESTIONS = [
  'make it a golden-hour sunset',
  'turn it into a dreamy watercolor',
  'cinematic teal-and-orange grade',
  'vaporwave neon glow'
]

export default function GenerativeEditPanel({ editor }) {
  const [prompt, setPrompt] = useState('')

  function run() {
    const p = prompt.trim()
    if (!p) return
    editor.addGenerative(p)
  }

  if (!editor.hasImage) {
    return (
      <div className="panel-inner">
        <header className="panel-head">
          <h2>Reimagine</h2>
          <p>Upload or generate an image, then guide an edit with a prompt.</p>
        </header>
        <UploadButton onImage={editor.upload} label="⬆ Upload an image" />
      </div>
    )
  }

  return (
    <div className="panel-inner">
      <header className="panel-head">
        <h2>Reimagine</h2>
        <p>Describe how the image should change. Added as a non-destructive layer.</p>
      </header>

      <label className="field-label">Edit prompt</label>
      <textarea
        className="prompt-input"
        rows={3}
        placeholder="e.g. make it a golden-hour sunset"
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

      <button className="primary-btn full" onClick={run} disabled={editor.busy || !prompt.trim()}>
        🪄 Apply generative edit
      </button>

      <UploadButton onImage={editor.upload} label="Replace image" disabled={editor.busy} />
    </div>
  )
}
