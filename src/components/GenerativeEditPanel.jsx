import { useState } from 'react'
import UploadButton from './UploadButton.jsx'
import { generativeEdit } from '../lib/mockAI.js'

const SUGGESTIONS = [
  'make it a golden-hour sunset',
  'turn it into a dreamy watercolor',
  'cinematic teal-and-orange grade',
  'vaporwave neon glow'
]

export default function GenerativeEditPanel({ image, runTask, busy, setImage }) {
  const [prompt, setPrompt] = useState('')

  function run() {
    const p = prompt.trim()
    if (!p || !image) return
    runTask('Reimagining image…', () => generativeEdit(image, p))
  }

  if (!image) {
    return (
      <div className="panel-inner">
        <header className="panel-head">
          <h2>Reimagine</h2>
          <p>Upload or generate an image, then guide an edit with a prompt.</p>
        </header>
        <UploadButton onImage={setImage} label="⬆ Upload an image" />
      </div>
    )
  }

  return (
    <div className="panel-inner">
      <header className="panel-head">
        <h2>Reimagine</h2>
        <p>Describe how the image should change.</p>
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

      <button className="primary-btn full" onClick={run} disabled={busy || !prompt.trim()}>
        🪄 Apply generative edit
      </button>

      <UploadButton onImage={setImage} label="Replace image" disabled={busy} />
    </div>
  )
}
