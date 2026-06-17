import { useEffect, useRef } from 'react'

// Displays the rendered drawable (ImageBitmap or canvas) on a real <canvas>.
// Every pixel shown here came through the deterministic render pipeline, so the
// preview is always exactly what export will produce.
export default function CanvasStage({ render, busy, busyLabel, error, empty }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !render) return
    canvas.width = render.width
    canvas.height = render.height
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(render.drawable, 0, 0)
  }, [render])

  return (
    <section className="stage">
      <div className="stage-inner">
        {empty ? (
          <div className="stage-empty">
            <div className="stage-empty-icon">🖼️</div>
            <h2>Nothing here yet</h2>
            <p>Generate an image from a prompt, or upload one to start editing.</p>
          </div>
        ) : (
          <canvas ref={canvasRef} className="stage-image" />
        )}

        {busy && (
          <div className="stage-overlay">
            <div className="spinner" />
            <span>{busyLabel || 'Rendering…'}</span>
          </div>
        )}
      </div>

      {error && <div className="stage-error">⚠ {error}</div>}
    </section>
  )
}
