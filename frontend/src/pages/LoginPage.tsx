import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { AuthUser } from '../contexts/AuthContext'

/* ─── SSO provider buttons ─── */
const providers: {
  id: AuthUser['provider']
  label: string
  bg: string
  hover: string
  textColor: string
  icon: React.ReactNode
}[] = [
  {
    id: 'gitlab',
    label: 'Continue with GitLab',
    bg: 'bg-[#FC6D26]',
    hover: 'hover:bg-[#e55e18]',
    textColor: 'text-white',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z"/>
      </svg>
    ),
  },
  {
    id: 'github',
    label: 'Continue with GitHub',
    bg: 'bg-gray-800',
    hover: 'hover:bg-gray-700',
    textColor: 'text-white',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
      </svg>
    ),
  },
  {
    id: 'google',
    label: 'Continue with Google',
    bg: 'bg-white',
    hover: 'hover:bg-gray-50',
    textColor: 'text-gray-800',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
    ),
  },
]

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/dashboard'

  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')

  function handleSSOLogin(provider: AuthUser['provider']) {
    // Production: redirect to OAuth flow. For now: mock callback.
    login({
      name: provider === 'gitlab' ? 'GitLab User'
          : provider === 'github' ? 'GitHub User'
          : 'Google User',
      email: `user@${provider}.com`,
      provider,
    })
    navigate(from, { replace: true })
  }

  function handleDevLogin() {
    login({ name: 'Dev User', email: 'dev@localhost', provider: 'dev' })
    navigate(from, { replace: true })
  }

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    login({ name: name || email.split('@')[0], email, provider: 'email' })
    navigate(from, { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Left — branding panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-gray-900 border-r border-white/10 p-12">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">DP</span>
          </div>
          <span className="text-white font-semibold text-lg">DataPilot</span>
        </Link>

        <div>
          <blockquote className="text-2xl font-medium text-white leading-relaxed mb-6">
            "DataPilot found 7 dead models costing us $4,200/month on Snowflake.
            Paid for itself in the first audit."
          </blockquote>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm">
              RV
            </div>
            <div>
              <p className="text-white font-medium text-sm">Rishi V.</p>
              <p className="text-gray-500 text-sm">Senior Data Engineer</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {['dbt', 'Snowflake', 'GitLab', 'Azure'].map(t => (
            <span key={t} className="text-gray-600 text-sm">{t}</span>
          ))}
        </div>
      </div>

      {/* Right — auth form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <Link to="/" className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">DP</span>
            </div>
            <span className="text-white font-semibold text-lg">DataPilot</span>
          </Link>

          <h1 className="text-2xl font-bold text-white mb-1">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="text-gray-400 text-sm mb-8">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              {mode === 'signin' ? 'Sign up free' : 'Sign in'}
            </button>
          </p>

          {/* SSO buttons */}
          <div className="space-y-3 mb-6">
            {providers.map(p => (
              <button
                key={p.id}
                onClick={() => handleSSOLogin(p.id)}
                className={`w-full flex items-center justify-center gap-3 ${p.bg} ${p.hover} border border-white/10 py-3 rounded-xl transition-colors font-medium text-sm ${p.textColor}`}
              >
                {p.icon}
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-gray-600 text-xs">or continue with email</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Email form */}
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Full name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full bg-gray-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            )}
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="w-full bg-gray-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm text-gray-400">Password</label>
                {mode === 'signin' && (
                  <button type="button" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-gray-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-semibold transition-colors"
            >
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          {/* Dev login shortcut */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <button
              onClick={handleDevLogin}
              className="w-full flex items-center justify-center gap-2 text-gray-600 hover:text-gray-400 text-xs transition-colors py-2"
            >
              <span className="font-mono bg-gray-900 border border-white/10 px-2 py-0.5 rounded text-gray-500">DEV</span>
              Quick dev login — skip auth
            </button>
          </div>

          <p className="text-center text-gray-600 text-xs mt-4">
            By continuing you agree to our{' '}
            <Link to="/terms" className="text-gray-500 hover:text-gray-300 transition-colors">Terms</Link>
            {' '}and{' '}
            <Link to="/privacy" className="text-gray-500 hover:text-gray-300 transition-colors">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  )
}
