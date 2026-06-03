import React, { useState } from 'react'
import './RoleSelectionScreen.css'

export type UserRole = 'developer' | 'tester' | null

interface RoleSelectionScreenProps {
  onSelectRole: (role: 'developer' | 'tester') => void
}

const RoleSelectionScreen: React.FC<RoleSelectionScreenProps> = ({ onSelectRole }) => {
  const [hoveredRole, setHoveredRole] = useState<'developer' | 'tester' | null>(null)

  const handleSkip = () => {
    localStorage.removeItem('userRole')
    window.location.reload()
  }

  return (
    <div className="role-selection-screen">
      <div className="role-selection-content">
        <div className="role-selection-header">
          <div className="app-logo">📋</div>
          <h1 className="app-title">Log Analyzer</h1>
          <p className="app-subtitle">日志分析工具</p>
        </div>

        <div className="role-selection-prompt">
          <h2>请选择您的角色</h2>
          <p>我们将为您推荐最适合的功能和布局</p>
        </div>

        <div className="role-cards">
          <div
            className={`role-card ${hoveredRole === 'tester' ? 'hovered' : ''}`}
            onMouseEnter={() => setHoveredRole('tester')}
            onMouseLeave={() => setHoveredRole(null)}
            onClick={() => onSelectRole('tester')}
          >
            <div className="role-icon">👨‍💻</div>
            <h3 className="role-name">测试</h3>
            <div className="role-features">
              <span className="feature-tag">快速分析</span>
            </div>
            <div className="role-desc">
              适合需要根据日志和问题表现，快速定位问题模块归属的测试人员。
            </div>
            <button className="role-select-btn">选择测试</button>
          </div>

          <div
            className={`role-card ${hoveredRole === 'developer' ? 'hovered' : ''}`}
            onMouseEnter={() => setHoveredRole('developer')}
            onMouseLeave={() => setHoveredRole(null)}
            onClick={() => onSelectRole('developer')}
          >
            <div className="role-icon">🧪</div>
            <h3 className="role-name">研发</h3>
            <div className="role-features">
              <span className="feature-tag">代码日志检索</span>
              <span className="feature-tag">快速分析</span>
              <span className="feature-tag">Coredump 分析</span>
            </div>
            <div className="role-desc">
              适合需要进行代码调试、堆栈分析的开发人员
            </div>
            <button className="role-select-btn">选择研发</button>
          </div>
        </div>

        <div className="role-selection-footer">
          <p>您之后可以在设置中更改角色</p>
          <button className="skip-btn" onClick={handleSkip}>重新选择角色</button>
        </div>
      </div>
    </div>
  )
}

export default RoleSelectionScreen