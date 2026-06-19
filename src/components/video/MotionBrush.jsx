import { useRef, useState, useEffect, useCallback } from 'react'

const DIRECTIONS = [
  { id: 'up', label: '↑', angle: 270 },
  { id: 'up-right', label: '↗', angle: 315 },
  { id: 'right', label: '→', angle: 0 },
  { id: 'down-right', label: '↘', angle: 45 },
  { id: 'down', label: '↓', angle: 90 },
  { id: 'down-left', label: '↙', angle: 135 },
  { id: 'left', label: '←', angle: 180 },
  { id: 'up-left', label: '↖', angle: 225 }
]

const DIR_COLORS = {
  'up': 'rgba(99,102,241,0.45)',
  'up-right': 'rgba(139,92,246,0.45)',
  'right': 'rgba(236,72,153,0.45)',
  'down-right': 'rgba(239,68,68,0.45)',
  'down': 'rgba(245,158,11,0.45)',
  'down-left': 'rgba(34,197,94,0.45)',
  'left': 'rgba(20,184,166,0.45)',
  'up-left': 'rgba(59,130,246,0.45)'
}

const DIR_LABELS = {
  'up': 'upward', 'up-right': 'up-right', 'right': 'rightward',
  'down-right': 'down-right', 'down': 'downward', 'down-left': 'down-left',
  'left': 'leftward', 'up-left': 'up-left'
}

function regionsToPrompt(regions) {
  if (!regions.length) return ''
  return regions.map(r => `the ${r.regionLabel || 'area'} moves ${DIR_LABELS[r.direction] || r.direction}`).join(', ')
}

export default function MotionBrush({ sourceImage, value = [], onChange }) {
  const canvasRef = useRef(null)
  const [direction, setDirection] = useState('right')
  const [brushSize, setBrushSize] = useState('M')
  const [painting, setPainting] = useState(false)
  const [startPos, setStartPos] = useState(null)
  const [regions, setRegions] = useState(value || [])

  const BRUSH_SIZES = { S: 40, M: 80, L: 140 }

  useEffect(() => {
    redraw(regions)
  }, [regions, sourceImage])

  const redraw = useCallback((rects) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (sourceImage) {
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        drawRegions(ctx, rects)
      }
      img.src = sourceImage
    } else {
      ctx.fillStyle = '#1a1a2e'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      drawRegions(ctx, rects)
    }
  }, [sourceImage])

  const drawRegions = (ctx, rects) => {
    rects.forEach(r => {
      ctx.fillStyle = DIR_COLORS[r.direction] || 'rgba(255,255,255,0.3)'
      ctx.fillRect(r.x, r.y, r.w, r.h)
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'
      ctx.lineWidth = 1.5
      ctx.strokeRect(r.x, r.y, r.w, r.h)

      // Draw arrow
      const cx = r.x + r.w / 2
      const cy = r.y + r.h / 2
      const dir = DIRECTIONS.find(d => d.id === r.direction)
      if (dir) {
        const rad = (dir.angle * Math.PI) / 180
        const len = Math.min(r.w, r.h) * 0.3
        ctx.beginPath()
        ctx.strokeStyle = 'white'
        ctx.lineWidth = 2
        ctx.moveTo(cx - Math.cos(rad) * len, cy - Math.sin(rad) * len)
        ctx.lineTo(cx + Math.cos(rad) * len, cy + Math.sin(rad) * len)
        ctx.stroke()
      }
    })
  }

  const getPos = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    }
  }

  const onMouseDown = (e) => {
    setPainting(true)
    setStartPos(getPos(e))
  }

  const onMouseUp = (e) => {
    if (!painting || !startPos) return
    setPainting(false)
    const end = getPos(e)
    const x = Math.min(startPos.x, end.x)
    const y = Math.min(startPos.y, end.y)
    const w = Math.abs(end.x - startPos.x)
    const h = Math.abs(end.y - startPos.y)
    if (w < 10 || h < 10) {
      // Click = circle brush
      const bs = BRUSH_SIZES[brushSize]
      const newRegion = {
        x: startPos.x - bs / 2, y: startPos.y - bs / 2, w: bs, h: bs,
        direction, regionLabel: getRegionLabel(startPos, canvasRef.current)
      }
      const next = [...regions, newRegion]
      setRegions(next)
      onChange?.(next)
    } else {
      const newRegion = { x, y, w, h, direction, regionLabel: getRegionLabel({ x: x + w/2, y: y + h/2 }, canvasRef.current) }
      const next = [...regions, newRegion]
      setRegions(next)
      onChange?.(next)
    }
    setStartPos(null)
  }

  const getRegionLabel = (pos, canvas) => {
    const xPct = pos.x / canvas.width
    const yPct = pos.y / canvas.height
    const xLabel = xPct < 0.33 ? 'left' : xPct > 0.66 ? 'right' : 'center'
    const yLabel = yPct < 0.33 ? 'upper' : yPct > 0.66 ? 'lower' : 'middle'
    return `${yLabel}-${xLabel}`
  }

  const clearAll = () => {
    setRegions([])
    onChange?.([])
  }

  const promptStr = regionsToPrompt(regions)

  return (
    <div className="motion-brush-wrap">
      <div className="mb-toolbar">
        <div className="mb-section">
          <span className="mb-label">Brush</span>
          {['S', 'M', 'L'].map(s => (
            <button key={s} className={`mb-size-btn ${brushSize === s ? 'active' : ''}`} onClick={() => setBrushSize(s)}>{s}</button>
          ))}
        </div>
        <div className="mb-section">
          <span className="mb-label">Direction</span>
          <div className="mb-direction-grid">
            {DIRECTIONS.map(d => (
              <button
                key={d.id}
                className={`mb-dir-btn ${direction === d.id ? 'active' : ''}`}
                onClick={() => setDirection(d.id)}
                style={{ background: direction === d.id ? DIR_COLORS[d.id] : undefined }}
                title={d.id}
              >{d.label}</button>
            ))}
          </div>
        </div>
        <button className="ghost-btn" onClick={clearAll} disabled={!regions.length}>Clear</button>
      </div>

      <div className="mb-canvas-wrap">
        <canvas
          ref={canvasRef}
          width={640}
          height={360}
          className="mb-canvas"
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          style={{ cursor: 'crosshair' }}
        />
      </div>

      {promptStr && (
        <div className="mb-prompt-preview">
          <span className="field-label">Motion prompt:</span>
          <span className="mb-prompt-text">{promptStr}</span>
        </div>
      )}

      {!regions.length && (
        <p className="hint-text">Click or drag on the canvas to paint motion regions. Each color = a direction.</p>
      )}
    </div>
  )
}
