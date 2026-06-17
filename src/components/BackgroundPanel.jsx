import { useState } from 'react'
import UploadButton from './UploadButton.jsx'

export default function BackgroundPanel({ editor }) {
  const [tolerance, setTolerance] = useState(40)

  if (!editor.hasImage) {
    return (
      <div className="panel-inner">
        <header className="panel-head">
          <h2>Background</h2>
          <p>Upload a photo to cut out its background.</p>
        </header>
        <UploadButton onImage={editor.upload} label="⬆ Upload an image" />
      </div>
    )
  }

  return (
    <div className="panel-inner">
      <header className="panel-head">
        <h2>Background</h2>
        <p>
          Samples the corner colors and removes matching pixels with a feathered edge. Added as a
          layer you can toggle off anytime.
        </p>
      </header>

      <div className="slider-row">
        <div className="slider-top">
          <span>Tolerance</span>
          <span className="slider-val">{tolerance}</span>
        </div>
        <input
          type="range"
          min={10}
          max={120}
          value={tolerance}
          onChange={(e) => setTolerance(Number(e.target.value))}
        />
        <p className="hint-text">Higher tolerance removes a wider range of background colors.</p>
      </div>

      <button
        className="primary-btn full"
        onClick={() => editor.addRemoveBackground(tolerance)}
        disabled={editor.busy}
      >
        ✂️ Remove background
      </button>

      <UploadButton onImage={editor.upload} label="Replace image" disabled={editor.busy} />
    </div>
  )
}
