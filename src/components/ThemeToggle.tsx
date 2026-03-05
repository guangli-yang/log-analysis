import React from 'react'
import { Theme } from '../types'
import './ThemeToggle.css'

interface ThemeToggleProps {
  theme: Theme
  onThemeChange: (theme: Theme) => void
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, onThemeChange }) => {
  return (
    <div className="theme-toggle">
      <button
        className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
        onClick={() => onThemeChange('dark')}
        title="深色主题"
      >
        🌙 深色
      </button>
      <button
        className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
        onClick={() => onThemeChange('light')}
        title="浅色主题"
      >
        ☀️ 浅色
      </button>
    </div>
  )
}

export default ThemeToggle
