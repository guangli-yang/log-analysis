import React from 'react'
import './ThinkingOverlay.css'

export interface SearchProgressData {
  stage: 'ctags' | 'processing' | 'warning' | 'error'
  title: string
  subtitle: string
  current?: number
  total?: number
  foundCount?: number
}

interface ThinkingOverlayProps {
  show: boolean
  title?: string
  subtitle?: string
  /** 提供进度数据时，显示进度条模式；否则显示转圈动画 */
  progress?: SearchProgressData | null
  /** error 状态下点击关闭的回调 */
  onDismiss?: () => void
}

/**
 * 全局加载提示遮罩：
 * - 无 progress：经典转圈动画（思考中）
 * - 有 progress：进度条 + 阶段指示 + 百分比 + 统计
 */
const ThinkingOverlay: React.FC<ThinkingOverlayProps> = ({
  show,
  title = '正在处理，请稍候…',
  subtitle,
  progress,
  onDismiss
}) => {
  if (!show) return null

  const isProgressMode = !!progress
  const isWarning = progress?.stage === 'warning'
  const isError = progress?.stage === 'error'
  const ctagsDone = isProgressMode && progress!.stage !== 'ctags'
  const pct = progress && progress.total && progress.total > 0
    ? Math.min(100, Math.round((progress.current || 0) / progress.total * 100))
    : 0

  return (
    <div className="thinking-overlay" role="alert" aria-busy={!isError}>
      <div className={`thinking-box${isProgressMode ? ' thinking-box-progress' : ''}${isWarning ? ' thinking-box-warning' : ''}${isError ? ' thinking-box-error' : ''}`}>
        {isError ? (
          <>
            {/* 错误状态 */}
            <div className="progress-error-icon">⚠</div>
            <div className="thinking-title thinking-title-error">{progress!.title}</div>
            <div className="thinking-subtitle thinking-subtitle-error">{progress!.subtitle}</div>
            {onDismiss && (
              <button className="progress-dismiss-btn" onClick={onDismiss}>
                关闭
              </button>
            )}
          </>
        ) : isProgressMode ? (
          <>
            {/* 阶段指示器 */}
            <div className="progress-stages">
              <span className={`progress-stage-dot${isWarning ? ' warn' : ' done'}`}>①</span>
              <span className="progress-stage-line" />
              <span className={`progress-stage-dot${ctagsDone ? ' done' : ' active'}`}>②</span>
              <span className="progress-stage-line" />
              <span className={`progress-stage-dot${progress!.stage === 'processing' ? ' active' : ''}`}>③</span>
            </div>
            <div className="progress-stages-label">
              <span>ctags 索引</span>
              <span>文件枚举</span>
              <span>日志匹配</span>
            </div>

            {isWarning ? (
              <>
                <div className="thinking-title thinking-title-warning">⚠ {progress!.title}</div>
                <div className="thinking-subtitle thinking-subtitle-warning">{progress!.subtitle}</div>
              </>
            ) : (
              <>
                <div className="thinking-title">{progress!.title}</div>
                <div className="thinking-subtitle">{progress!.subtitle}</div>
              </>
            )}

            {/* 进度条 */}
            <div className="thinking-progress-track">
              <div
                className={`thinking-progress-fill${progress!.stage === 'ctags' || isWarning ? ' indeterminate' : ''}`}
                style={progress!.stage === 'processing' ? { width: `${pct}%` } : undefined}
              />
            </div>

            {/* 百分比 + 统计 */}
            {progress!.stage === 'processing' ? (
              <>
                <div className="thinking-progress-pct">{pct}%</div>
                <div className="thinking-progress-detail">
                  已处理 {progress!.current} / {progress!.total} 文件
                  {progress!.foundCount !== undefined && `  ·  找到 ${progress!.foundCount} 个匹配`}
                </div>
              </>
            ) : (
              <div className="thinking-progress-pct thinking-progress-pending">—</div>
            )}
          </>
        ) : (
          <>
            <div className="thinking-spinner">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
            </div>
            <div className="thinking-title">{title}</div>
            {subtitle && <div className="thinking-subtitle">{subtitle}</div>}
          </>
        )}
      </div>
    </div>
  )
}

export default ThinkingOverlay
