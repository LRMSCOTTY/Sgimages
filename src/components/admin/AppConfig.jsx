import { useEffect, useState } from 'react'
import { getAdminConfig, setAdminConfig, deleteAdminConfig } from '../../lib/adminAPI.js'

const CONFIG_SCHEMA = [
  {
    key: 'defaultModel',
    label: 'Default AI Model',
    type: 'select',
    options: [
      { value: 'ltx-video', label: 'LTX-Video (Fast, open-source)' },
      { value: 'hunyuanvideo', label: 'HunyuanVideo (Best quality, open-source)' },
      { value: 'mochi-1', label: 'Mochi-1 (Best motion, open-source)' },
      { value: 'wan2.1', label: 'Wan 2.1 (Image-to-video, open-source)' },
      { value: 'runway', label: 'Runway Gen-3 (Commercial)' },
      { value: 'luma', label: 'Luma Dream Machine (Commercial)' },
      { value: 'kling', label: 'Kling AI (Commercial)' },
    ],
    default: 'ltx-video',
    desc: 'The model pre-selected when users open a new clip'
  },
  {
    key: 'mockMode',
    label: 'Mock Mode',
    type: 'boolean',
    default: false,
    desc: 'Force mock video generation for all users (useful for demos when no API keys are set)'
  },
  {
    key: 'maintenanceMode',
    label: 'Maintenance Mode',
    type: 'boolean',
    default: false,
    desc: 'Show a maintenance banner to all users'
  },
  {
    key: 'maxClipsPerUser',
    label: 'Max Clips Per User',
    type: 'number',
    default: 50,
    desc: 'Maximum number of clips a single user can create'
  },
  {
    key: 'maxDurationSeconds',
    label: 'Max Video Duration (seconds)',
    type: 'number',
    default: 10,
    desc: 'Maximum video duration users can request per clip'
  },
  {
    key: 'generationRateLimit',
    label: 'Generation Rate Limit (per minute)',
    type: 'number',
    default: 10,
    desc: 'Maximum video generations per user per minute'
  },
  {
    key: 'welcomeMessage',
    label: 'Welcome Message',
    type: 'text',
    default: '',
    desc: 'Optional message shown to users after signing in (leave blank to disable)'
  },
  {
    key: 'enableBattleArena',
    label: 'Enable Model Battle Arena',
    type: 'boolean',
    default: true,
    desc: 'Show the side-by-side model comparison feature'
  },
  {
    key: 'enableMovieBuilder',
    label: 'Enable Movie Builder',
    type: 'boolean',
    default: true,
    desc: 'Show the three-act movie assembly feature'
  },
]

function ConfigRow({ schema, value, onChange }) {
  const [local, setLocal] = useState(value ?? schema.default)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const isDirty = JSON.stringify(local) !== JSON.stringify(value ?? schema.default)

  const save = async () => {
    setSaving(true)
    try {
      await setAdminConfig(schema.key, local)
      onChange(schema.key, local)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  const reset = async () => {
    await deleteAdminConfig(schema.key).catch(() => {})
    setLocal(schema.default)
    onChange(schema.key, undefined)
  }

  return (
    <div className="config-row">
      <div className="config-row-header">
        <label className="config-label">{schema.label}</label>
        {value !== undefined && (
          <button className="config-reset" onClick={reset} title="Reset to default">reset</button>
        )}
      </div>
      <div className="config-desc">{schema.desc}</div>
      <div className="config-row-controls">
        {schema.type === 'boolean' && (
          <button
            className={`config-toggle ${local ? 'on' : 'off'}`}
            onClick={() => setLocal(v => !v)}
          >
            <span className="config-toggle-knob" />
            <span className="config-toggle-label">{local ? 'ON' : 'OFF'}</span>
          </button>
        )}
        {schema.type === 'select' && (
          <select
            className="config-select"
            value={local ?? ''}
            onChange={e => setLocal(e.target.value)}
          >
            {schema.options.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}
        {schema.type === 'number' && (
          <input
            className="config-number"
            type="number"
            value={local ?? ''}
            onChange={e => setLocal(Number(e.target.value))}
            min={0}
          />
        )}
        {schema.type === 'text' && (
          <input
            className="config-text"
            type="text"
            value={local ?? ''}
            onChange={e => setLocal(e.target.value)}
            placeholder={`Default: ${schema.default || '(none)'}`}
          />
        )}
        <button
          className={`config-save-btn ${saved ? 'saved' : ''}`}
          onClick={save}
          disabled={saving || (!isDirty && value !== undefined) || saved}
        >
          {saving ? '…' : saved ? '✓ Saved' : 'Save'}
        </button>
      </div>
    </div>
  )
}

export default function AppConfig({ refreshTrigger }) {
  const [config, setConfig] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      setConfig(await getAdminConfig())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [refreshTrigger])

  const handleChange = (key, value) => {
    setConfig(prev => value === undefined ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== key)) : { ...prev, [key]: value })
  }

  if (loading) return <div className="admin-loading"><div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} /></div>
  if (error) return <div className="admin-error">Failed to load config: {error}</div>

  return (
    <div className="admin-config">
      <div className="admin-section-header">
        <h3>App Configuration</h3>
        <button className="admin-refresh-btn" onClick={load}>↻ Refresh</button>
      </div>
      <p className="admin-config-note">
        Changes take effect immediately. Claude AI can also apply these for you — switch to the Claude tab and ask.
      </p>
      <div className="config-rows">
        {CONFIG_SCHEMA.map(schema => (
          <ConfigRow
            key={schema.key}
            schema={schema}
            value={config[schema.key]}
            onChange={handleChange}
          />
        ))}
      </div>
    </div>
  )
}
