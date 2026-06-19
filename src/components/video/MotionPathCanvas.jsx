import { useRef, useState, useEffect, useCallback } from 'react'
import { sampleBezierPath, pathToDirectionString } from '../../lib/motionPathUtils.js'

export default function MotionPathCanvas({ sourceImage, value, onChange, width = 854, height = 480 }) {
  const canvasRef = useRef(null)
  const [points, setPoints] = useState(value?.points || [])
  const [pathType, setPathType] = useState(value?.type || 'camera')
  const [isDrawing, setIsDrawing] = useState(false)
  const [preview, setPreview] = useState('')

  const PATH_COLORS = { camera: '#7c5cff', subject: '#ff6b35', zoom: '#23d5ab' }
  const color = PATH_COLORS[pathType]

  useEffect(() => {
    drawCanvas()
    if (points.length > 1) {
      const samples = sampleBezierPath(points)
      const dir = pathToDirectionString(samples, width, height)
      setPreview(dir)
      onChange({ type: pathType, points, directionString: dir })
    }
  }, [points, pathType])

  function drawCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw path
    if (points.length >= 2) {
      ctx.beginPath()
      ctx.moveTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1]
        const cur = points[i]
        const cpx = (prev.x + cur.x) / 2
        const cpy = (prev.y + cur.y) / 2
        ctx.quadraticCurveTo(prev.x, prev.y, cpx, cpy)
      }
      ctx.strokeStyle = color
      ctx.lineWidth = 3
      ctx.setLineDash([])
      ctx.stroke()

      // Animated arrow at path midpoint
      const mid = points[Math.floor(points.length / 2)]
      const next = points[Math.min(Math.floor(points.length / 2) + 1, points.length - 1)]
      const angle = Math.atan2(next.y - mid.y, next.x - mid.x)
      drawArrow(ctx, mid.x, mid.y, angle, color)
    }

    // Draw control points
    points.forEach((p, i) => {
      ctx.beginPath()
      ctx.arc(p.x, p.y, i === 0 || i === points.length - 1 ? 8 : 5, 0, Math.PI * 2)
      ctx.fillStyle = i === 0 ? '#23d5ab' : i === points.length - 1 ? '#ff6b35' : color
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.stroke()
    })
  }

  function drawArrow(ctx, x, y, angle, color) {
    const size = 16
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(angle)
    ctx.beginPath()
    ctx.moveTo(size, 0)
    ctx.lineTo(-size/2, size/2)
    ctx.lineTo(-size/2, -size/2)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
    ctx.restore()
  }

  function getPos(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    const scaleX = canvasRef.current.width / rect.width
    const scaleY = canvasRef.current.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    }
  }

  const handleClick = useCallback((e) => {
    const pos = getPos(e)
    setPoints(prev => [...prev, pos])
  }, [])

  const clearPath = () => {
    setPoints([])
    setPreview('')
    onChange(null)
    const canvas = canvasRef.current
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
  }

  return (
    <div className="motion-path-panel">
      <div className="panel-head">
        <h2>Motion Path Painter <span className="badge">UNIQUE</span></h2>
        <p>Click to draw a path on your image. The AI will follow this motion.</p>
      </div>
      <div className="mp-toolbar">
        {Object.entries({ camera: '🎥 Camera', subject: '🟠 Subject', zoom: '🔵 Zoom' }).map(([k, label]) => (
          <button
            key={k}
            className={`chip ${pathType === k ? 'active' : ''}`}
            onClick={() => setPathType(k)}
            style={pathType === k ? { borderColor: PATH_COLORS[k], color: PATH_COLORS[k] } : {}}
          >
            {label}
          </button>
        ))}
        <button className="ghost-btn" onClick={clearPath}>Clear</button>
      </div>
      <div className="mp-canvas-wrap">
        {sourceImage && (
          <img src={sourceImage} alt="Source" className="mp-source-bg" />
        )}
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="mp-canvas"
          onClick={handleClick}
          style={{ cursor: 'crosshair' }}
        />
      </div>
      {preview && (
        <div className="mp-preview">
          <span style={{ color: PATH_COLORS[pathType] }}>●</span>
          &nbsp;<strong>{pathType === 'camera' ? 'Camera' : pathType === 'subject' ? 'Subject' : 'Zoom'}</strong>: {preview}
        </div>
      )}
      {points.length > 0 && (
        <p className="hint-text">{points.length} control points · Click to add more · Clear to restart</p>
      )}
    </div>
  )
}
