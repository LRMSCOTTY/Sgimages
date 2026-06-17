import { OP_META, OP_TYPES } from '../lib/recipe.js'

// The non-destructive edit stack: every edit is a live, reorderable layer that
// can be toggled or removed at any time without re-doing the work above it.
export default function EditStack({ ops, selectedOpId, onSelect, onToggle, onRemove, onMove }) {
  if (!ops.length) {
    return (
      <div className="editstack empty">
        <span className="editstack-title">Edit stack</span>
        <p className="editstack-hint">Edits you make appear here as non-destructive layers.</p>
      </div>
    )
  }

  return (
    <div className="editstack">
      <span className="editstack-title">Edit stack · {ops.length}</span>
      <ul className="editstack-list">
        {ops.map((op, i) => {
          const meta = OP_META[op.type] || { label: op.type, icon: '•' }
          return (
            <li
              key={op.id}
              className={`editstack-item ${op.enabled ? '' : 'disabled'} ${
                op.id === selectedOpId ? 'selected' : ''
              }`}
            >
              <button
                className="es-toggle"
                title={op.enabled ? 'Hide layer' : 'Show layer'}
                onClick={() => onToggle(op.id)}
              >
                {op.enabled ? '👁' : '🚫'}
              </button>
              <button className="es-main" onClick={() => onSelect(op.id)}>
                <span className="es-icon">{meta.icon}</span>
                <span className="es-label">{meta.label}</span>
                <span className="es-detail">{describe(op)}</span>
              </button>
              <div className="es-actions">
                <button title="Move up" disabled={i === 0} onClick={() => onMove(i, -1)}>↑</button>
                <button title="Move down" disabled={i === ops.length - 1} onClick={() => onMove(i, 1)}>↓</button>
                <button title="Delete layer" onClick={() => onRemove(op.id)}>✕</button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function describe(op) {
  switch (op.type) {
    case OP_TYPES.rotate:
      return `${op.params.degrees > 0 ? '+' : ''}${op.params.degrees}°`
    case OP_TYPES.flip:
      return op.params.axis === 'h' ? 'horizontal' : 'vertical'
    case OP_TYPES.removeBackground:
      return `tolerance ${op.params.tolerance}`
    case OP_TYPES.generative:
      return `"${truncate(op.params.prompt, 22)}"`
    case OP_TYPES.adjust:
      return adjustSummary(op.params)
    default:
      return ''
  }
}

function adjustSummary(p) {
  const parts = []
  if (p.brightness !== 100) parts.push(`bri ${p.brightness}`)
  if (p.contrast !== 100) parts.push(`con ${p.contrast}`)
  if (p.saturate !== 100) parts.push(`sat ${p.saturate}`)
  if (p.hue !== 0) parts.push(`hue ${p.hue}`)
  if (p.grayscale) parts.push(`gray ${p.grayscale}`)
  if (p.sepia) parts.push(`sepia ${p.sepia}`)
  if (p.blur) parts.push(`blur ${p.blur}`)
  if (p.invert) parts.push(`inv ${p.invert}`)
  return parts.slice(0, 3).join(' · ') || 'no change'
}

function truncate(s, n) {
  return s && s.length > n ? s.slice(0, n - 1) + '…' : s || ''
}
