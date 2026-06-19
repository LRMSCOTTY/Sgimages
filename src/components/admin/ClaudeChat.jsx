import { useState, useRef, useEffect, useCallback } from 'react'
import { streamClaude, setAdminConfig } from '../../lib/adminAPI.js'

const SUGGESTIONS = [
  'Show app stats and give me optimization recommendations',
  'What\'s the best open-source model to set as default?',
  'How do I set up Replicate for video generation?',
  'Enable mock mode so I can test without API calls',
  'What new features should I add to ProvidAI?',
  'Explain the video generation pipeline architecture',
]

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function renderMarkdown(text) {
  // Replace action blocks before other processing (will be rendered separately)
  let html = text

  // Fenced code blocks (not action)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    if (lang === 'action') return '' // handled separately
    return `<pre class="chat-code-block"><code class="${lang ? `lang-${lang}` : ''}">${escapeHtml(code.trim())}</code></pre>`
  })

  // Inline code
  html = html.replace(/`([^`\n]+)`/g, '<code class="chat-inline-code">$1</code>')

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')

  // Italic
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')

  // Headings
  html = html.replace(/^### (.*?)$/gm, '<h4 class="chat-h4">$1</h4>')
  html = html.replace(/^## (.*?)$/gm, '<h3 class="chat-h3">$1</h3>')
  html = html.replace(/^# (.*?)$/gm, '<h2 class="chat-h2">$1</h2>')

  // Horizontal rules
  html = html.replace(/^---+$/gm, '<hr class="chat-hr" />')

  // Lists (collect consecutive li items into a ul)
  html = html.replace(/((?:^[•\-*] .+\n?)+)/gm, (block) => {
    const items = block.trim().split('\n').map(line =>
      `<li>${line.replace(/^[•\-*] /, '')}</li>`
    ).join('')
    return `<ul class="chat-list">${items}</ul>`
  })

  // Numbered lists
  html = html.replace(/((?:^\d+\. .+\n?)+)/gm, (block) => {
    const items = block.trim().split('\n').map(line =>
      `<li>${line.replace(/^\d+\. /, '')}</li>`
    ).join('')
    return `<ol class="chat-list">${items}</ol>`
  })

  // Table support (simple)
  html = html.replace(/\|(.+)\|\n\|[-| :]+\|\n((?:\|.+\|\n?)*)/g, (_, header, rows) => {
    const ths = header.split('|').filter(Boolean).map(h => `<th>${h.trim()}</th>`).join('')
    const trs = rows.trim().split('\n').map(row => {
      const tds = row.split('|').filter(Boolean).map(d => `<td>${d.trim()}</td>`).join('')
      return `<tr>${tds}</tr>`
    }).join('')
    return `<div class="chat-table-wrap"><table class="chat-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`
  })

  // Paragraphs: double newline → paragraph break
  html = html.replace(/\n\n+/g, '</p><p class="chat-p">')

  return `<p class="chat-p">${html}</p>`
}

// Parse action blocks out of the full message text
function parseActions(text) {
  const actions = []
  const re = /```action\s*\n([\s\S]*?)\n```/g
  let m
  while ((m = re.exec(text)) !== null) {
    try {
      actions.push(JSON.parse(m[1]))
    } catch {}
  }
  return actions
}

// Strip action blocks from display text
function stripActions(text) {
  return text.replace(/```action\s*\n[\s\S]*?\n```/g, '').trim()
}

function ActionCard({ action, onApply }) {
  const [status, setStatus] = useState('idle') // idle | loading | done | error

  const apply = async () => {
    setStatus('loading')
    try {
      if (action.type === 'set_config') {
        await setAdminConfig(action.key, action.value)
        setStatus('done')
        onApply?.(action)
      }
    } catch (e) {
      setStatus('error')
    }
  }

  const valueStr = JSON.stringify(action.value)

  return (
    <div className="action-card">
      <div className="action-card-icon">⚙️</div>
      <div className="action-card-body">
        <div className="action-card-title">Configuration Change</div>
        <div className="action-card-detail">
          Set <code className="chat-inline-code">{action.key}</code> → <code className="chat-inline-code">{valueStr}</code>
        </div>
      </div>
      <button
        className={`action-apply-btn ${status}`}
        onClick={apply}
        disabled={status === 'loading' || status === 'done'}
      >
        {status === 'idle' && 'Apply'}
        {status === 'loading' && '…'}
        {status === 'done' && '✓ Applied'}
        {status === 'error' && 'Failed'}
      </button>
    </div>
  )
}

function Message({ msg, onApply }) {
  const isUser = msg.role === 'user'

  if (isUser) {
    return (
      <div className="chat-msg user">
        <div className="chat-bubble user">{msg.content}</div>
      </div>
    )
  }

  const actions = parseActions(msg.content)
  const displayText = stripActions(msg.content)

  return (
    <div className="chat-msg assistant">
      <div className="chat-avatar">◆</div>
      <div className="chat-bubble assistant">
        {msg.streaming ? (
          <span className="chat-streaming">{displayText}<span className="chat-cursor" /></span>
        ) : (
          <div dangerouslySetInnerHTML={{ __html: renderMarkdown(displayText) }} />
        )}
        {!msg.streaming && actions.map((action, i) => (
          <ActionCard key={i} action={action} onApply={onApply} />
        ))}
        {msg.error && (
          <div className="chat-error-msg">⚠ {msg.error}</div>
        )}
      </div>
    </div>
  )
}

export default function ClaudeChat({ onConfigChange }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const bottomRef = useRef(null)
  const abortRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = useCallback(async (text) => {
    const content = (text || input).trim()
    if (!content || busy) return
    setInput('')

    const userMsg = { role: 'user', content }
    const assistantMsg = { role: 'assistant', content: '', streaming: true }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setBusy(true)

    const apiMessages = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))

    let accumulated = ''

    const abort = streamClaude(apiMessages, {
      onText: (chunk) => {
        accumulated += chunk
        setMessages(prev => {
          const next = [...prev]
          next[next.length - 1] = { ...next[next.length - 1], content: accumulated }
          return next
        })
      },
      onDone: () => {
        setMessages(prev => {
          const next = [...prev]
          next[next.length - 1] = { ...next[next.length - 1], streaming: false }
          return next
        })
        setBusy(false)
        abortRef.current = null
      },
      onError: (err) => {
        setMessages(prev => {
          const next = [...prev]
          next[next.length - 1] = { ...next[next.length - 1], streaming: false, error: err }
          return next
        })
        setBusy(false)
        abortRef.current = null
      }
    })

    abortRef.current = abort
  }, [input, busy, messages])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const clearChat = () => {
    abortRef.current?.()
    setMessages([])
    setBusy(false)
    setInput('')
    inputRef.current?.focus()
  }

  const empty = messages.length === 0

  return (
    <div className="claude-chat">
      {/* Header */}
      <div className="claude-chat-header">
        <div className="claude-chat-title">
          <span className="claude-logo">◆</span>
          Claude AI Assistant
        </div>
        <div className="claude-chat-meta">Sonnet 4.6 · ProvidAI Admin</div>
        {messages.length > 0 && (
          <button className="chat-clear-btn" onClick={clearChat}>New chat</button>
        )}
      </div>

      {/* Messages */}
      <div className="claude-chat-messages">
        {empty && (
          <div className="chat-empty">
            <div className="chat-empty-logo">◆</div>
            <h3 className="chat-empty-title">How can I help with ProvidAI?</h3>
            <p className="chat-empty-sub">I have full context of the codebase, current stats, and can apply configuration changes directly.</p>
            <div className="chat-suggestions">
              {SUGGESTIONS.map((s, i) => (
                <button key={i} className="chat-suggestion" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <Message key={i} msg={msg} onApply={(action) => onConfigChange?.(action)} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="claude-chat-input-wrap">
        <textarea
          ref={inputRef}
          className="claude-chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Claude anything about ProvidAI…"
          rows={1}
          disabled={busy}
        />
        <button
          className={`claude-send-btn ${busy ? 'busy' : ''}`}
          onClick={() => send()}
          disabled={!input.trim() || busy}
          title="Send (Enter)"
        >
          {busy ? <span className="send-spinner" /> : '↑'}
        </button>
      </div>
      <div className="claude-chat-hint">Enter to send · Shift+Enter for newline</div>
    </div>
  )
}
