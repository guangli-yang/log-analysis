import React, { useState, useRef, useEffect, useCallback } from 'react'
import { AIConfig, ChatMessage } from '../types'
import './AIDialog.css'

interface AIDialogProps {
  isOpen: boolean
  onClose: () => void
  aiConfig: AIConfig
  onSaveConfig: (config: AIConfig) => void
  contextContent?: string
  recentLines?: string[]
}

type ContextMode = 'none' | 'selection' | 'all' | 'recent'

const CONTEXT_LINE_OPTIONS = [100, 200, 500, 1000]

const AIDialog: React.FC<AIDialogProps> = ({
  isOpen,
  onClose,
  aiConfig,
  onSaveConfig,
  contextContent,
  recentLines
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '您好！我是日志分析助手。可以帮您：\n• 解释日志中的错误含义\n• 分析错误原因和解决方案\n• 总结日志关键信息',
      timestamp: Date.now()
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [contextMode, setContextMode] = useState<ContextMode>('none')
  const [contextLines, setContextLines] = useState(aiConfig.contextLines || 100)
  const [configForm, setConfigForm] = useState<AIConfig>(aiConfig)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [testError, setTestError] = useState('')

  // 当 aiConfig prop 变化时（如加载完成后），同步更新 configForm
  useEffect(() => {
    setConfigForm(aiConfig)
  }, [aiConfig])
  const [isFocused, setIsFocused] = useState(true)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (isOpen) {
      setIsFocused(true)
      setPosition({ x: window.innerWidth / 2 - 300, y: window.innerHeight / 2 - 300 })
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
        }
      }, 0)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleFocusIn = (e: FocusEvent) => {
      if (dialogRef.current?.contains(e.target as Node)) {
        setIsFocused(true)
      }
    }

    const handleFocusOut = (e: FocusEvent) => {
      if (!e.relatedTarget || !dialogRef.current?.contains(e.relatedTarget as Node)) {
        setIsFocused(false)
      }
    }

    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('focusout', handleFocusOut)

    return () => {
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('focusout', handleFocusOut)
    }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return
      
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        document.body.focus()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (headerRef.current?.contains(e.target as Node)) {
      e.preventDefault()
      setIsDragging(true)
      dragOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y
      }
    }
  }, [position])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault()
      setPosition({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  const handleDialogClick = useCallback(() => {
    if (!isFocused && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isFocused])

  const buildSystemPrompt = useCallback(() => {
    let context = ''
    if (contextMode === 'selection' && contextContent) {
      context = `\n\n【用户选中的日志内容】\n${contextContent}`
    } else if (contextMode === 'all' && recentLines) {
      context = `\n\n【完整日志内容】\n${recentLines.join('\n')}`
    } else if (contextMode === 'recent' && recentLines) {
      const lines = recentLines.slice(-contextLines)
      context = `\n\n【最近 ${lines.length} 行日志】\n${lines.join('\n')}`
    }
    return `你是一个专业的日志分析助手。用户会提供日志内容，你需要：
1. 解释日志中错误信息的含义
2. 分析可能的问题原因
3. 提供排查建议
4. 如果看到系统错误或异常，提供解决方案${context}`
  }, [contextMode, contextContent, recentLines, contextLines])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    const systemPrompt = buildSystemPrompt()
    const allMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage.content }
    ]

    try {
      const result = await window.electronAPI.aiChat({
        apiUrl: aiConfig.apiUrl,
        apiKey: aiConfig.apiKey,
        modelName: aiConfig.modelName,
        messages: allMessages
      })

      if (result.success && result.content) {
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: result.content,
          timestamp: Date.now()
        }
        setMessages(prev => [...prev, assistantMessage])
      } else {
        const errorMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `❌ 请求失败: ${result.error || '未知错误'}`,
          timestamp: Date.now()
        }
        setMessages(prev => [...prev, errorMessage])
      }
    } catch (err) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ 请求失败: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleTestConnection = async () => {
    setTestStatus('testing')
    setTestError('')
    try {
      const result = await window.electronAPI.aiTestConnection({
        apiUrl: configForm.apiUrl,
        apiKey: configForm.apiKey,
        modelName: configForm.modelName
      })
      if (result.success) {
        setTestStatus('success')
      } else {
        setTestStatus('error')
        setTestError(result.error || '连接失败')
      }
    } catch (err) {
      setTestStatus('error')
      setTestError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleSaveConfig = () => {
    onSaveConfig(configForm)
    setShowConfig(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!isOpen) return null

  return (
    <div
      className={`ai-dialog ${isDragging ? 'dragging' : ''}`}
      ref={dialogRef}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        opacity: isFocused ? 1 : 0.85,
        position: 'fixed'
      }}
      onClick={handleDialogClick}
      onMouseDown={handleMouseDown}
    >
      <div className="ai-dialog-header" ref={headerRef}>
        <h3>🤖 AI 智能助手</h3>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

        {showConfig ? (
          <div className="ai-config-panel">
            <h4>AI 配置</h4>
            <div className="config-form">
              <div className="form-group">
                <label>API 地址</label>
                <input
                  type="text"
                  value={configForm.apiUrl}
                  onChange={e => setConfigForm(prev => ({ ...prev, apiUrl: e.target.value }))}
                  placeholder="https://api.openai.com/v1"
                />
              </div>
              <div className="form-group">
                <label>API Key</label>
                <input
                  type="password"
                  value={configForm.apiKey}
                  onChange={e => setConfigForm(prev => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="sk-..."
                />
              </div>
              <div className="form-group">
                <label>模型名称</label>
                <input
                  type="text"
                  value={configForm.modelName}
                  onChange={e => setConfigForm(prev => ({ ...prev, modelName: e.target.value }))}
                  placeholder="gpt-3.5-turbo"
                />
              </div>
              <div className="form-group">
                <label>最近日志行数</label>
                <select
                  value={configForm.contextLines}
                  onChange={e => setConfigForm(prev => ({ ...prev, contextLines: Number(e.target.value) }))}
                >
                  {CONTEXT_LINE_OPTIONS.map(n => (
                    <option key={n} value={n}>{n} 行</option>
                  ))}
                </select>
              </div>
              <div className="config-actions">
                <button
                  className="test-btn"
                  onClick={handleTestConnection}
                  disabled={testStatus === 'testing' || !configForm.apiUrl || !configForm.apiKey}
                >
                  {testStatus === 'testing' ? '测试中...' : '测试连接'}
                </button>
                {testStatus === 'success' && <span className="test-success">✓ 连接成功</span>}
                {testStatus === 'error' && <span className="test-error">{testError}</span>}
              </div>
              <div className="config-buttons">
                <button className="cancel-btn" onClick={() => setShowConfig(false)}>取消</button>
                <button className="save-btn" onClick={handleSaveConfig}>保存</button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="ai-messages">
              {messages.map(msg => (
                <div key={msg.id} className={`message ${msg.role}`}>
                  <div className="message-avatar">
                    {msg.role === 'user' ? '👤' : '🤖'}
                  </div>
                  <div className="message-content">
                    {msg.content.split('\n').map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="message assistant">
                  <div className="message-avatar">🤖</div>
                  <div className="message-content loading">
                    <span>思考中...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="ai-context-selector">
              <span className="context-label">📎 附带上下文:</span>
              <select
                value={contextMode}
                onChange={e => setContextMode(e.target.value as ContextMode)}
              >
                <option value="none">无</option>
                <option value="selection">选中内容</option>
                <option value="all">全部日志</option>
                <option value="recent">最近日志</option>
              </select>
              {contextMode === 'recent' && (
                <select
                  value={contextLines}
                  onChange={e => setContextLines(Number(e.target.value))}
                >
                  {CONTEXT_LINE_OPTIONS.map(n => (
                    <option key={n} value={n}>{n} 行</option>
                  ))}
                </select>
              )}
            </div>

            <div className="ai-input-area">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入问题..."
                rows={2}
                disabled={isLoading}
              />
              <div className="input-actions">
                <button
                  className="config-btn"
                  onClick={() => setShowConfig(true)}
                  title="AI 配置"
                >
                  ⚙️
                </button>
                <button
                  className="send-btn"
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                >
                  {isLoading ? '...' : '发送'}
                </button>
              </div>
            </div>
          </>
        )}
    </div>
  )
}

export default AIDialog