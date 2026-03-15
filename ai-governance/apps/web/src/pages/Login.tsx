import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useTheme } from '../contexts/ThemeContext';

const IS_DEV = import.meta.env.DEV;

/* ── SSO provider config ──────────────────────────────────────────────────── */
const SSO_PROVIDERS = [
  {
    id: 'gitlab',
    label: 'Continue with GitLab',
    href: '/auth/gitlab',
    className: 'bg-[#FC6D26] hover:bg-[#e55e18] text-neutral-900 dark:text-white border-transparent',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z" />
      </svg>
    ),
  },
  {
    id: 'github',
    label: 'Continue with GitHub',
    href: '/auth/github',
    className: 'bg-neutral-100 dark:bg-neutral-800 hover:bg-gray-700 text-neutral-900 dark:text-white border-transparent dark:bg-gray-700 dark:hover:bg-gray-600',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
      </svg>
    ),
  },
  {
    id: 'google',
    label: 'Continue with Google',
    href: '/auth/google',
    className: 'bg-white hover:bg-gray-50 text-gray-800 border-gray-200 dark:border-white/10',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
    ),
  },
];

/* ── Theme toggle button ──────────────────────────────────────────────────── */
function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-100 dark:bg-neutral-800 transition-colors"
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}

/* ── Main component ───────────────────────────────────────────────────────── */
const ERROR_MESSAGES: Record<string, string> = {
  oauth: 'Authentication failed. Please try again.',
  provider_disabled: 'This login provider is not configured. Try GitHub or Google.',
};

export default function Login() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const oauthError = searchParams.get('error') ? (ERROR_MESSAGES[searchParams.get('error')!] ?? 'An error occurred.') : null;

  async function devLogin() {
    setLoading(true);
    await api.post('/auth/dev-login').catch(() => {});
    localStorage.setItem('voro_dev_user', JSON.stringify({
      id: 'dev',
      name: 'Dev User',
      email: 'dev@localhost',
      avatar_url: null,
    }));
    window.location.href = '/dashboard';
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setLoading(true);
    try {
      const endpoint = mode === 'signup' ? '/auth/register' : '/auth/login';
      const body = mode === 'signup' ? { email, password, name } : { email, password };
      await api.post(endpoint, body);
      window.location.href = '/dashboard';
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setFormError(msg ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-white dark:bg-gray-950 transition-colors duration-200">

      {/* ── Left branding panel (desktop only) ─────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] bg-neutral-950 border-r border-neutral-800 p-12 relative overflow-hidden">
        {/* Logo */}
        <Link to="/" className="relative flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3L8 13L13 3" stroke="#0a0a0a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-white font-bold text-sm tracking-tight">VORO</span>
        </Link>

        {/* Testimonial */}
        <div className="relative">
          <div className="text-5xl text-neutral-700 font-serif leading-none mb-4">"</div>
          <blockquote className="text-xl font-medium text-white leading-relaxed mb-6">
            VORO found 7 dead models costing us $4,200/month on Snowflake. Paid for itself in the first audit.
          </blockquote>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center font-bold text-sm text-neutral-900">
              RV
            </div>
            <div>
              <p className="text-white font-medium text-sm">Rishi V.</p>
              <p className="text-neutral-500 text-sm">Senior Data Engineer, Acme Corp</p>
            </div>
          </div>
        </div>

        {/* Integrations */}
        <div className="relative flex items-center gap-6">
          {['dbt', 'Snowflake', 'GitLab', 'Azure', 'GitHub'].map(t => (
            <span key={t} className="text-neutral-600 text-xs font-medium tracking-wide">{t}</span>
          ))}
        </div>
      </div>

      {/* ── Right form panel ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4">
          {/* Mobile logo */}
          <Link to="/" className="flex items-center gap-2 lg:hidden">
            <div className="w-7 h-7 rounded-lg bg-neutral-900 dark:bg-white flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M3 3L8 13L13 3" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="dark:stroke-neutral-900"/>
              </svg>
            </div>
            <span className="text-neutral-900 dark:text-white font-bold text-sm">VORO</span>
          </Link>
          <div className="hidden lg:block" />
          <ThemeToggle />
        </div>

        {/* Form */}
        <div className="flex-1 flex items-center justify-center px-6 pb-12">
          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {mode === 'signin' ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="text-neutral-500 dark:text-neutral-500 dark:text-neutral-500 dark:text-neutral-400 text-sm mb-8">
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <button
                onClick={() => setMode(m => m === 'signin' ? 'signup' : 'signin')}
                className="text-neutral-900 dark:text-white dark:text-neutral-700 dark:text-neutral-300 hover:text-neutral-600 dark:hover:text-neutral-300 underline underline-offset-2 font-medium transition-colors"
              >
                {mode === 'signin' ? 'Sign up free' : 'Sign in'}
              </button>
            </p>

            {/* OAuth error banner */}
            {oauthError && (
              <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
                {oauthError}
              </div>
            )}

            {/* SSO buttons */}
            <div className="space-y-3 mb-6">
              {SSO_PROVIDERS.map(p => (
                <a
                  key={p.id}
                  href={p.href}
                  className={`w-full flex items-center justify-center gap-3 border py-3 px-4 rounded-xl font-medium text-sm transition-colors ${p.className}`}
                >
                  {p.icon}
                  {p.label}
                </a>
              ))}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 h-px bg-gray-200 dark:bg-white/10" />
              <span className="text-neutral-500 dark:text-neutral-400 dark:text-gray-600 text-xs">or continue with email</span>
              <div className="flex-1 h-px bg-gray-200 dark:bg-white/10" />
            </div>

            {/* Email form */}
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-500 dark:text-neutral-400 mb-1.5">
                    Full name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full bg-gray-50 dark:bg-white dark:bg-neutral-900 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white text-sm placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white focus:border-transparent transition-colors"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-500 dark:text-neutral-400 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="w-full bg-gray-50 dark:bg-white dark:bg-neutral-900 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white text-sm placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white focus:border-transparent transition-colors"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-500 dark:text-neutral-400">
                    Password
                  </label>
                  {mode === 'signin' && (
                    <button type="button" className="text-xs text-neutral-900 dark:text-white dark:text-neutral-700 dark:text-neutral-300 hover:text-neutral-600 dark:hover:text-neutral-300 underline underline-offset-2 transition-colors">
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
                  className="w-full bg-gray-50 dark:bg-white dark:bg-neutral-900 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white text-sm placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white focus:border-transparent transition-colors"
                />
              </div>

              {formError && (
                <p className="text-red-600 dark:text-red-400 text-sm">{formError}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-neutral-900 dark:bg-white hover:bg-neutral-700 dark:hover:bg-neutral-100 disabled:opacity-60 text-white dark:text-neutral-900 py-3 rounded-xl font-semibold text-sm transition-colors"
              >
                {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            </form>

            {/* Dev login (dev only) */}
            {IS_DEV && (
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-white/10">
                <button
                  onClick={devLogin}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 text-neutral-500 dark:text-neutral-400 hover:text-gray-600 dark:hover:text-neutral-600 dark:text-neutral-300 text-xs transition-colors py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900"
                >
                  <span className="font-mono bg-gray-100 dark:bg-white dark:bg-neutral-900 border border-gray-200 dark:border-white/10 px-2 py-0.5 rounded text-neutral-500 dark:text-neutral-500 dark:text-neutral-500 dark:text-neutral-500">
                    DEV
                  </span>
                  {loading ? 'Signing in…' : 'Quick dev login — skip OAuth'}
                </button>
              </div>
            )}

            <p className="text-center text-neutral-500 dark:text-neutral-400 dark:text-gray-600 text-xs mt-6">
              By continuing you agree to our{' '}
              <Link to="/terms" className="text-neutral-500 dark:text-neutral-500 dark:text-neutral-500 dark:text-neutral-500 hover:text-gray-700 dark:hover:text-neutral-600 dark:text-neutral-300 transition-colors underline underline-offset-2">
                Terms
              </Link>
              {' '}and{' '}
              <Link to="/privacy" className="text-neutral-500 dark:text-neutral-500 dark:text-neutral-500 dark:text-neutral-500 hover:text-gray-700 dark:hover:text-neutral-600 dark:text-neutral-300 transition-colors underline underline-offset-2">
                Privacy Policy
              </Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
