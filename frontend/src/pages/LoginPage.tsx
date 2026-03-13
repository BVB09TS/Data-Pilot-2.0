import { useState } from 'react'
import { Link } from 'react-router-dom'

export function LoginPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Auth wiring goes here (Phase 0.3)
    window.location.href = '/dashboard'
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

          <h1 className="text-2xl font-bold text-white mb-2">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="text-gray-400 text-sm mb-8">
            {mode === 'signin'
              ? "Don't have an account? "
              : 'Already have an account? '}
            <button
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              {mode === 'signin' ? 'Sign up free' : 'Sign in'}
            </button>
          </p>

          {/* GitLab SSO */}
          <button className="w-full flex items-center justify-center gap-3 bg-gray-800 hover:bg-gray-700 border border-white/10 text-white py-3 rounded-xl transition-colors mb-6 font-medium">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z"/>
            </svg>
            Continue with GitLab
          </button>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-gray-600 text-xs">or continue with email</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-semibold transition-colors mt-2"
            >
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-gray-600 text-xs mt-8">
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
