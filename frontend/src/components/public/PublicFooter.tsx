import { Link } from 'react-router-dom'

export function PublicFooter() {
  return (
    <footer className="bg-gray-950 border-t border-white/10 py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">DP</span>
              </div>
              <span className="text-white font-semibold">DataPilot</span>
            </div>
            <p className="text-gray-500 text-sm leading-relaxed">
              AI-powered dbt auditor for modern data teams. Find problems before they find you.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-white text-sm font-medium mb-4">Product</h4>
            <ul className="space-y-3">
              {[
                { to: '/docs', label: 'Documentation' },
                { to: '/pricing', label: 'Pricing' },
                { to: '/changelog', label: 'Changelog' },
                { to: '/dashboard', label: 'Dashboard' },
              ].map(l => (
                <li key={l.to}>
                  <Link to={l.to} className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Community */}
          <div>
            <h4 className="text-white text-sm font-medium mb-4">Community</h4>
            <ul className="space-y-3">
              {[
                { href: 'https://github.com', label: 'GitHub' },
                { href: '#', label: 'Discord' },
                { href: '#', label: 'dbt Slack' },
                { to: '/community', label: 'Contributors' },
              ].map((l, i) => (
                <li key={i}>
                  {'href' in l
                    ? <a href={l.href} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">{l.label}</a>
                    : <Link to={l.to!} className="text-gray-500 hover:text-gray-300 text-sm transition-colors">{l.label}</Link>
                  }
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-white text-sm font-medium mb-4">Legal</h4>
            <ul className="space-y-3">
              {[
                { to: '/privacy', label: 'Privacy Policy' },
                { to: '/terms', label: 'Terms of Service' },
              ].map(l => (
                <li key={l.to}>
                  <Link to={l.to} className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gray-600 text-sm">© 2026 DataPilot. All rights reserved.</p>
          <p className="text-gray-600 text-sm">Built for data teams who care about quality.</p>
        </div>
      </div>
    </footer>
  )
}
