import React, { useEffect, useRef, useState } from 'react'
import { useTheme } from '../../contexts/ThemeContext'
import type { Tab } from '../../types'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'lineage',  label: 'Lineage'  },
  { id: 'findings', label: 'Findings' },
  { id: 'models',   label: 'Models'   },
]

interface HeaderProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
  onMenuToggle: () => void
}

export function Header({ activeTab, onTabChange, onMenuToggle }: HeaderProps) {
  const { theme, toggleTheme } = useTheme()
  const [searchFocused, setSearchFocused] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
        setSearchFocused(true)
      }
      if (e.key === 'Escape') {
        searchRef.current?.blur()
        setSearchFocused(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <header className="
      fixed top-0 left-0 right-0 z-50 h-14
      flex items-center gap-4 px-4
      bg-white/80 dark:bg-slate-900/80
      backdrop-blur-md
      border-b border-slate-200 dark:border-slate-800
    ">
      {/* ── Left: menu toggle + logo ── */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onMenuToggle}
          aria-label="Toggle sidebar"
          className="p-1.5 rounded-md text-slate-500 hover:text-slate-900
            hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100
            dark:hover:bg-slate-800 transition-colors"
        >
          <MenuIcon />
        </button>

        <div className="flex items-center gap-2">
          {/* Logo mark */}
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700
            flex items-center justify-center shrink-0 shadow-sm">
            <span className="text-white font-bold text-sm select-none">D</span>
          </div>
          <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm tracking-tight">
            DataPilot
          </span>
          <span className="text-slate-300 dark:text-slate-700 select-none">|</span>
          <span className="text-xs text-slate-400 dark:text-slate-500">ShopMesh</span>
        </div>
      </div>

      {/* ── Center: nav tabs ── */}
      <nav className="flex items-center gap-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              px-3 py-1.5 rounded-md text-sm font-medium transition-colors
              ${activeTab === tab.id
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* ── Spacer ── */}
      <div className="flex-1" />

      {/* ── Right: search + controls ── */}
      <div className="flex items-center gap-2 shrink-0">

        {/* Search */}
        <div
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all cursor-text
            ${searchFocused
              ? 'w-56 border-blue-400 dark:border-blue-600 bg-white dark:bg-slate-800'
              : 'w-40 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600'
            }
          `}
          onClick={() => { searchRef.current?.focus(); setSearchFocused(true) }}
        >
          <SearchIcon className="text-slate-400 dark:text-slate-500 shrink-0" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search models..."
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="flex-1 min-w-0 bg-transparent text-sm text-slate-700 dark:text-slate-300
              placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none"
          />
          {!searchFocused && (
            <kbd className="text-xs text-slate-400 dark:text-slate-600 font-mono
              bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded shrink-0">
              ⌘K
            </kbd>
          )}
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          className="p-1.5 rounded-md text-slate-500 hover:text-slate-900
            hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100
            dark:hover:bg-slate-800 transition-colors"
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>

        {/* Live status badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full
          bg-green-50 dark:bg-green-950/50
          border border-green-200 dark:border-green-900">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-medium text-green-700 dark:text-green-400">Live</span>
        </div>
      </div>
    </header>
  )
}

/* ─── SVG Icon helpers ─── */

function MenuIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6"  x2="21" y2="6"  />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={className}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41
               M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}
