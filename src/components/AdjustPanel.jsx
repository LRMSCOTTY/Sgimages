import { useEffect, useState } from 'react'
import UploadButton from './UploadButton.jsx'
import { defaultAdjustments as defaults } from '../lib/adjustments.js'

const SLIDERS = [
  { key: 'brightness', label: 'Brightness', min: 0, max: 200, suffix: '%' },
  { key: 'contrast', label: 'Contrast', min: 0, max: 200, suffix: '%' },
  { key: 'saturate', label: 'Saturation', min: 0, max: 200, suffix: '%' },
  { key: 'hue', label: 'Hue', min: 0, max: 360, suffix: '°' },
  { key: 'grayscale', label: 'Grayscale', min: 0, max: 100, suffix: '%' },
  { key: 'sepia', label: 'Sepia', min: 0, max: 100, suffix: '%' },
  { key: 'blur', label: 'Blur', min: 0, max: 20, suffix: 'px' },
  { key: 'invert', label: 'Invert', min: 0, max: 100, suffix: '%' }
]

export default function AdjustPanel({ editor }) {
  const { doc, selectedOpId } = editor
  // If an existing adjust layer is selected, edit it in place; else start fresh.
  const editing = doc?.ops.find((o) => o.id === selectedOpId && o.type === 'adjust')
  const [adj, setAdj] = useState(editing ? editing.params : defaults)

  // Sync local sliders when the selected layer / image changes.
  useEffect(() => {
    setAdj(editing ? editing.params : defaults)
    editor.clearDraft()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOpId, doc?.source])

  // Clear any live draft when leaving the panel.
  useEffect(() => () => editor.clearDraft(), []) // eslint-disable-line react-hooks/exhaustive-deps

  function update(key, value) {
    const next = { ...adj, [key]: Number(value) }
    setAdj(next)
    editor.setAdjustDraft(next, editing?.id) // live preview through real pipeline
  }

  function apply() {
    editor.commitAdjust(adj, editing?.id)
  }

  function reset() {
    setAdj(defaults)
    editor.clearDraft()
  }

  if (!editor.hasImage) {
    return (
      <div className="panel-inner">
        <header className="panel-head">
          <h2>Adjust</h2>
          <p>Upload an image to tune filters and transforms — non-destructively.</p>
        </header>
        <UploadButton onImage={editor.upload} label="⬆ Upload an image" />
      </div>
    )
  }

  return (
    <div className="panel-inner">
      <header className="panel-head">
        <h2>Adjust</h2>
        <p>
          {editing ? 'Editing an existing adjustment layer.' : 'Drag to preview, then apply to add an adjustment layer.'}
        </p>
      </header>

      <div className="sliders">
        {SLIDERS.map((s) => (
          <div key={s.key} className="slider-row">
            <div className="slider-top">
              <span>{s.label}</span>
              <span className="slider-val">
                {adj[s.key]}
                {s.suffix}
              </span>
            </div>
            <input
              type="range"
              min={s.min}
              max={s.max}
              value={adj[s.key]}
              onChange={(e) => update(s.key, e.target.value)}
            />
          </div>
        ))}
      </div>

      <div className="transform-row">
        <button className="secondary-btn" disabled={editor.busy} onClick={() => editor.addRotate(-90)}>↺ Rotate L</button>
        <button className="secondary-btn" disabled={editor.busy} onClick={() => editor.addRotate(90)}>↻ Rotate R</button>
        <button className="secondary-btn" disabled={editor.busy} onClick={() => editor.addFlip('h')}>⇋ Flip H</button>
        <button className="secondary-btn" disabled={editor.busy} onClick={() => editor.addFlip('v')}>⇅ Flip V</button>
      </div>

      <div className="panel-actions">
        <button className="secondary-btn" onClick={reset} disabled={editor.busy}>
          Reset
        </button>
        <button className="primary-btn" onClick={apply} disabled={editor.busy}>
          {editing ? 'Update layer' : 'Apply adjustment'}
        </button>
      </div>

      <UploadButton onImage={editor.upload} label="Replace image" disabled={editor.busy} />
    </div>
  )
}
