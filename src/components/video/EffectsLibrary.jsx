const EFFECT_CATEGORIES = [
  {
    name: 'Physics',
    effects: [
      { id: 'shatter', label: 'Shatter', icon: '💥' },
      { id: 'melt', label: 'Melt', icon: '🌊' },
      { id: 'inflate', label: 'Inflate', icon: '🎈' },
      { id: 'deflate', label: 'Deflate', icon: '💨' }
    ]
  },
  {
    name: 'Atmosphere',
    effects: [
      { id: 'rain', label: 'Rain Storm', icon: '🌧' },
      { id: 'snow', label: 'Snow Fall', icon: '❄️' },
      { id: 'fog', label: 'Dense Fog', icon: '🌫' },
      { id: 'wildfire-smoke', label: 'Wildfire Smoke', icon: '🔥' }
    ]
  },
  {
    name: 'Cinematic',
    effects: [
      { id: 'lens-flare', label: 'Lens Flare', icon: '✨' },
      { id: 'bokeh-pull', label: 'Bokeh Pull', icon: '📷' },
      { id: 'light-leak', label: 'Light Leak', icon: '🌅' },
      { id: 'dolly-zoom', label: 'Dolly Zoom', icon: '🎥' }
    ]
  },
  {
    name: 'Temporal',
    effects: [
      { id: 'hyperlapse', label: 'Hyperlapse', icon: '⏩' },
      { id: 'reverse', label: 'Reverse', icon: '⏪' },
      { id: 'slow-mo', label: 'Slow-Mo', icon: '🐢' },
      { id: 'strobe', label: 'Strobe', icon: '⚡' }
    ]
  }
]

export default function EffectsLibrary({ value = [], onChange }) {
  const toggle = (id) => {
    if (value.includes(id)) {
      onChange(value.filter(v => v !== id))
    } else {
      onChange([...value, id])
    }
  }

  return (
    <div className="effects-library">
      <div className="panel-head">
        <h2>Effects Library <span className="badge">NEW</span></h2>
        <p>Inject cinematic effects into your generation prompt. Multi-select to stack.</p>
      </div>

      {value.length > 0 && (
        <div className="active-effects-row">
          {value.map(id => (
            <span key={id} className="effect-tag" onClick={() => toggle(id)}>
              {id} ×
            </span>
          ))}
        </div>
      )}

      {EFFECT_CATEGORIES.map(cat => (
        <div key={cat.name} className="effect-category">
          <div className="effect-category-name">{cat.name}</div>
          <div className="effects-grid">
            {cat.effects.map(fx => (
              <button
                key={fx.id}
                className={`effect-btn ${value.includes(fx.id) ? 'active' : ''}`}
                onClick={() => toggle(fx.id)}
                title={fx.label}
              >
                <span className="effect-icon">{fx.icon}</span>
                <span className="effect-label">{fx.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}

      {value.length > 0 && (
        <button className="ghost-btn" onClick={() => onChange([])} style={{ marginTop: 8 }}>
          Clear All Effects
        </button>
      )}
    </div>
  )
}
