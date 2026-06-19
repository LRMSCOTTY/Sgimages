const SHOT_GRAMMAR = [
  {
    id: 'action-chase',
    name: 'Action Chase',
    icon: '🏃',
    shots: [
      { shot: 'Aerial Overview', cameraRig: 'drone-establishing', duration: 5, promptSuffix: 'aerial chase sequence overview, dynamic action' },
      { shot: 'Follow POV', cameraRig: 'handheld-doc', duration: 5, promptSuffix: 'first person chase POV, intense handheld camera' },
      { shot: 'Whip Transition', cameraRig: 'whip-pan', duration: 3, promptSuffix: 'whip pan between locations, speed blur' },
      { shot: 'Impact Freeze', cameraRig: 'static', duration: 3, promptSuffix: 'dramatic freeze frame, intense close up' }
    ]
  },
  {
    id: 'product-reveal',
    name: 'Product Reveal',
    icon: '📦',
    shots: [
      { shot: 'Teaser Close-Up', cameraRig: 'rack-focus', duration: 3, promptSuffix: 'mysterious close up reveal, focus pull' },
      { shot: 'Hero Reveal', cameraRig: 'dolly-push-in', duration: 5, promptSuffix: 'dramatic product hero reveal, cinematic lighting' },
      { shot: 'Orbital Showcase', cameraRig: 'orbital', duration: 5, promptSuffix: '360 degree product showcase, studio lighting' },
      { shot: 'Detail Macro', cameraRig: 'static', duration: 3, promptSuffix: 'extreme macro detail, texture and quality' }
    ]
  },
  {
    id: 'nature-epic',
    name: 'Nature Epic',
    icon: '🌄',
    shots: [
      { shot: 'Sunrise Aerial', cameraRig: 'drone-establishing', duration: 10, promptSuffix: 'epic aerial sunrise, golden hour magic hour' },
      { shot: 'Ground Reveal', cameraRig: 'tilt-reveal', duration: 5, promptSuffix: 'ground level tilt reveal, dramatic landscape' },
      { shot: 'Time Flow', cameraRig: 'orbital', duration: 5, promptSuffix: 'time-lapse sky movement, clouds racing overhead' },
      { shot: 'Intimate Detail', cameraRig: 'dolly-push-in', duration: 5, promptSuffix: 'intimate nature detail, macro beauty' }
    ]
  },
  {
    id: 'interview-setup',
    name: 'Interview',
    icon: '🎙️',
    shots: [
      { shot: 'Location Establish', cameraRig: 'steadicam-walk', duration: 5, promptSuffix: 'location establishing shot, documentary style' },
      { shot: 'Subject Reveal', cameraRig: 'dolly-push-in', duration: 5, promptSuffix: 'subject reveal medium shot, natural lighting' },
      { shot: 'Close-Up Emotion', cameraRig: 'static', duration: 5, promptSuffix: 'emotional close-up, eye level, shallow focus' },
      { shot: 'Cutaway Detail', cameraRig: 'rack-focus', duration: 3, promptSuffix: 'contextual cutaway, detail shot' }
    ]
  },
  {
    id: 'cinematic-intro',
    name: 'Cinematic Intro',
    icon: '🎭',
    shots: [
      { shot: 'Black & Title', cameraRig: 'static', duration: 3, promptSuffix: 'dark cinematic opening, minimal, atmospheric' },
      { shot: 'Grand Establish', cameraRig: 'drone-establishing', duration: 10, promptSuffix: 'sweeping epic establishing shot, score-worthy moment' },
      { shot: 'Hitchcock Reveal', cameraRig: 'hitchcock-zoom', duration: 5, promptSuffix: 'vertigo zoom reveal, psychological tension' },
      { shot: 'Hero Moment', cameraRig: 'dolly-push-in', duration: 5, promptSuffix: 'protagonist hero introduction, iconic framing' }
    ]
  }
]

export default function ShotGrammarLib({ basePrompt, onApply }) {
  return (
    <div className="shot-grammar-lib">
      <div className="panel-head">
        <h2>Shot Grammar Library</h2>
        <p>Apply professional cinematography templates to your scene.</p>
      </div>
      <div className="grammar-grid">
        {SHOT_GRAMMAR.map(template => (
          <div key={template.id} className="grammar-card">
            <div className="grammar-header">
              <span className="grammar-icon">{template.icon}</span>
              <div>
                <div className="grammar-name">{template.name}</div>
                <div className="grammar-shots">{template.shots.length} shots</div>
              </div>
            </div>
            <div className="grammar-shot-list">
              {template.shots.map((s, i) => (
                <div key={i} className="grammar-shot-item">
                  <span className="grammar-shot-name">{s.shot}</span>
                  <span className="grammar-shot-dur">{s.duration}s</span>
                </div>
              ))}
            </div>
            <button
              className="primary-btn full"
              onClick={() => onApply(template.shots.map(s => ({
                ...s,
                prompt: `${basePrompt}, ${s.promptSuffix}`
              })))}
            >
              Apply to Timeline
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export { SHOT_GRAMMAR }
