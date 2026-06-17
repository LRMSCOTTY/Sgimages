export default function CanvasStage({ image, busy, busyLabel, error }) {
  return (
    <section className="stage">
      <div className="stage-inner">
        {image ? (
          <img className="stage-image" src={image} alt="Working canvas" />
        ) : (
          <div className="stage-empty">
            <div className="stage-empty-icon">🖼️</div>
            <h2>Nothing here yet</h2>
            <p>Generate an image from a prompt, or upload one to start editing.</p>
          </div>
        )}

        {busy && (
          <div className="stage-overlay">
            <div className="spinner" />
            <span>{busyLabel || 'Working…'}</span>
          </div>
        )}
      </div>

      {error && <div className="stage-error">⚠ {error}</div>}
    </section>
  )
}
