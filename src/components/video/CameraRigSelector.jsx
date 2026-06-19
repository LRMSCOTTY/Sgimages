export const CAMERA_RIGS = [
  { id: 'static', name: 'Static', icon: '📷', promptAppend: 'static camera, locked off, no camera movement' },
  { id: 'dolly-push-in', name: 'Dolly In', icon: '🎬', promptAppend: 'slow cinematic dolly push-in, shallow depth of field increasing' },
  { id: 'drone-establishing', name: 'Drone', icon: '🚁', promptAppend: 'aerial drone establishing shot, slowly descending, bird\'s eye perspective' },
  { id: 'steadicam-walk', name: 'Steadicam', icon: '🎥', promptAppend: 'smooth steadicam tracking shot, fluid movement following subject' },
  { id: 'handheld-doc', name: 'Handheld', icon: '📹', promptAppend: 'handheld documentary style, natural camera movement, organic shake' },
  { id: 'orbital', name: 'Orbital', icon: '🔄', promptAppend: '360 degree orbital rotation around subject, circular camera motion' },
  { id: 'hitchcock-zoom', name: 'Vertigo', icon: '🌀', promptAppend: 'simultaneous dolly back zoom in, Hitchcock vertigo effect, dramatic perspective warp' },
  { id: 'whip-pan', name: 'Whip Pan', icon: '⚡', promptAppend: 'dynamic whip pan transition, fast horizontal motion blur' },
  { id: 'rack-focus', name: 'Rack Focus', icon: '🔭', promptAppend: 'cinematic rack focus pull from foreground to background, bokeh transition' },
  { id: 'tilt-reveal', name: 'Tilt Up', icon: '⬆️', promptAppend: 'slow dramatic upward tilt reveal from ground level to sky' }
]

export default function CameraRigSelector({ value, onChange, compact = false }) {
  return (
    <div className={`rig-grid ${compact ? 'compact' : ''}`}>
      {CAMERA_RIGS.map(rig => (
        <button
          key={rig.id}
          className={`rig-btn ${value?.id === rig.id ? 'active' : ''}`}
          onClick={() => onChange(value?.id === rig.id ? null : rig)}
          title={rig.promptAppend}
        >
          <span className="rig-icon">{rig.icon}</span>
          <span className="rig-name">{rig.name}</span>
        </button>
      ))}
    </div>
  )
}
