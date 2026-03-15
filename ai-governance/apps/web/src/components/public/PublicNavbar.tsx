import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

export function PublicNavbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  const links = [
    { to: '/docs', label: 'Docs' },
    { to: '/changelog', label: 'Changelog' },
    { to: '/community', label: 'Community' },
  ]

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/90 backdrop-blur border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
            <span className="text-black font-bold text-sm">V</span>
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">VORO</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {links.map(l => (
            <Link
              key={l.to}
              to={l.to}
              className={`text-sm transition-colors ${
                location.pathname === l.to
                  ? 'text-white font-medium'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link to="/login" className="text-sm text-gray-400 hover:text-white transition-colors">
            Sign in
          </Link>
          <Link
            to="/login"
            className="text-sm bg-white hover:bg-neutral-100 text-black px-4 py-2 rounded-lg transition-colors font-medium"
          >
            Get started free
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-gray-400 hover:text-white"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {menuOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            }
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-gray-950 border-t border-white/10 px-6 py-4 flex flex-col gap-4">
          {links.map(l => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setMenuOpen(false)}
              className="text-gray-400 hover:text-white text-sm transition-colors"
            >
              {l.label}
            </Link>
          ))}
          <Link to="/login" onClick={() => setMenuOpen(false)} className="text-sm bg-white text-black px-4 py-2 rounded-lg text-center font-medium">
            Get started free
          </Link>
        </div>
      )}
    </nav>
  )
}
