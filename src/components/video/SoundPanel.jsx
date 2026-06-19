const MOODS = [
  { id: 'cinematic-epic', label: 'Cinematic Epic', icon: '🎼' },
  { id: 'lo-fi-chill', label: 'Lo-fi Chill', icon: '🎹' },
  { id: 'electronic-pulse', label: 'Electronic Pulse', icon: '🎛' },
  { id: 'nature-ambient', label: 'Nature Ambient', icon: '🌿' },
  { id: 'tension-thriller', label: 'Tension / Thriller', icon: '😰' },
  { id: 'uplifting', label: 'Uplifting', icon: '🌟' }
]

const SFX_OPTIONS = ['Ambient', 'Wind', 'Rain', 'Ocean', 'Traffic', 'Crowd']

export default function SoundPanel({ value, onChange }) {
  const sd = value || { mode: 'silence', mood: null, sfx: [], volume: 80 }

  const update = (patch) => onChange({ ...sd, ...patch })

  const toggleSfx = (sfx) => {
    const current = sd.sfx || []
    update({ sfx: current.includes(sfx) ? current.filter(s => s !== sfx) : [...current, sfx] })
  }

  const previewTone = () => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(440, ctx.currentTime)
    gain.gain.setValueAtTime((sd.volume || 80) / 100 * 0.1, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5)
    osc.start()
    osc.stop(ctx.currentTime + 1.5)
  }

  return (
    <div className="sound-panel panel-inner">
      <div className="panel-head">
        <h2>Sound Design <span className="badge">NEW</span></h2>
        <p>Select audio mood — guides generation and future native audio via Kling Omni.</p>
      </div>

      {/* Mode */}
      <label className="field-label">Audio Mode</label>
      <div className="chips">
        {['silence', 'music', 'sfx'].map(m => (
          <button
            key={m}
            className={`chip ${sd.mode === m ? 'active' : ''}`}
            onClick={() => update({ mode: m })}
          >
            {m === 'silence' ? '🔇 Silence' : m === 'music' ? '🎵 Music' : '🎚 SFX'}
          </button>
        ))}
      </div>

      {/* Music mood */}
      {sd.mode === 'music' && (
        <>
          <label className="field-label">Music Mood</label>
          <div className="mood-grid">
            {MOODS.map(m => (
              <button
                key={m.id}
                className={`mood-btn ${sd.mood === m.id ? 'active' : ''}`}
                onClick={() => update({ mood: sd.mood === m.id ? null : m.id })}
              >
                <span>{m.icon}</span>
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* SFX */}
      {sd.mode === 'sfx' && (
        <>
          <label className="field-label">Sound Effects</label>
          <div className="chips">
            {SFX_OPTIONS.map(sfx => (
              <button
                key={sfx}
                className={`chip ${(sd.sfx || []).includes(sfx) ? 'active' : ''}`}
                onClick={() => toggleSfx(sfx)}
              >
                {sfx}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Volume */}
      {sd.mode !== 'silence' && (
        <>
          <label className="field-label">Volume: {sd.volume}%</label>
          <input
            type="range" min={0} max={100} value={sd.volume || 80}
            onChange={e => update({ volume: +e.target.value })}
          />
          <button className="ghost-btn" onClick={previewTone} style={{ marginTop: 8 }}>
            🔊 Preview Tone
          </button>
        </>
      )}

      <div className="hint-text" style={{ marginTop: 12 }}>
        ✦ Audio selection guides the AI prompt now. Native audio generation will be available via Kling Omni API when released.
      </div>
    </div>
  )
}
