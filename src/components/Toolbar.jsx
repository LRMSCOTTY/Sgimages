export default function Toolbar({
  canUndo,
  canRedo,
  canExport,
  onUndo,
  onRedo,
  onDownload,
  onClear
}) {
  return (
    <header className="toolbar">
      <div className="toolbar-group">
        <button className="ghost-btn" onClick={onUndo} disabled={!canUndo} title="Undo">
          ↶ Undo
        </button>
        <button className="ghost-btn" onClick={onRedo} disabled={!canRedo} title="Redo">
          ↷ Redo
        </button>
      </div>
      <div className="toolbar-group">
        <button className="ghost-btn" onClick={onClear} disabled={!canExport} title="Start over">
          Clear
        </button>
        <button className="primary-btn" onClick={onDownload} disabled={!canExport} title="Download PNG">
          ⬇ Download
        </button>
      </div>
    </header>
  )
}
