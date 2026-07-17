import React from 'react'
import './ThinkingOverlay.css'

interface ThinkingOverlayProps {
  show: boolean
  title?: string
  subtitle?: string
}

/**
 * 全局“思考中”加载提示：在后台处理（代码检索 / 深度合并 / 快速匹配等）期间
 * 以半透明遮罩 + 动画指示器明确告知用户系统正在工作，避免误判为卡死。
 */
const ThinkingOverlay: React.FC<ThinkingOverlayProps> = ({
  show,
  title = '正在处理，请稍候…',
  subtitle
}) => {
  if (!show) return null
  return (
    <div className="thinking-overlay" role="alert" aria-busy="true">
      <div className="thinking-box">
        <div className="thinking-spinner">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div className="thinking-title">{title}</div>
        {subtitle && <div className="thinking-subtitle">{subtitle}</div>}
      </div>
    </div>
  )
}

export default ThinkingOverlay
