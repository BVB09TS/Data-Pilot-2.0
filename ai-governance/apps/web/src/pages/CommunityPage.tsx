import { PublicNavbar } from '../components/public/PublicNavbar'
import { PublicFooter } from '../components/public/PublicFooter'

const channels = [
  {
    icon: (
      <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
      </svg>
    ),
    name: 'GitHub',
    desc: 'Source code, issues, and pull requests. Star us and contribute.',
    action: 'View on GitHub',
    href: 'https://github.com',
    color: 'text-white',
    bg: 'bg-white/10 hover:bg-white/15 border border-white/10',
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.08.11 18.102.129 18.115a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
      </svg>
    ),
    name: 'Discord',
    desc: 'Real-time chat with the VORO community and core team.',
    action: 'Join Discord',
    href: '#',
    color: 'text-white',
    bg: 'bg-white/10 hover:bg-white/15 border border-white/10',
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
        <path d="M.297 12c0 6.456 5.247 11.703 11.703 11.703S23.703 18.456 23.703 12 18.456.297 12 .297.297 5.544.297 12zm15.853-1.297c.218.057.428.16.592.307l.748.748v.001l.036.043a.84.84 0 0 1-.036 1.152l-.748.748a.84.84 0 0 1-1.184 0l-.56-.56-1.624 1.624.56.56a.84.84 0 0 1 0 1.184l-.748.748a.84.84 0 0 1-1.152.036l-.043-.036-.748-.748a.84.84 0 0 1-.307-.592 5.04 5.04 0 0 1 1.477-3.87 5.04 5.04 0 0 1 3.737-1.345z"/>
      </svg>
    ),
    name: 'dbt Slack',
    desc: 'Find us in the #voro channel on the official dbt community Slack.',
    action: 'Join dbt Slack',
    href: '#',
    color: 'text-white',
    bg: 'bg-white/10 hover:bg-white/15 border border-white/10',
  },
]

const contributors = [
  { initials: 'RV', name: 'Rishi V.', role: 'Core maintainer' },
  { initials: 'AM', name: 'Amira M.', role: 'Data engineering' },
  { initials: 'JP', name: 'Jonas P.', role: 'Frontend' },
  { initials: 'SC', name: 'Sara C.', role: 'Integrations' },
  { initials: 'TK', name: 'Tom K.', role: 'ML & agents' },
  { initials: '+', name: 'You?', role: 'Open for contributions' },
]

const ways = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    title: 'Report bugs',
    desc: 'Open an issue on GitHub with a reproduction case.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    title: 'Suggest features',
    desc: 'Start a GitHub Discussion with your idea and use case.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: 'Improve docs',
    desc: 'Fix typos, add examples, or write new guides.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
      </svg>
    ),
    title: 'Build integrations',
    desc: 'Add support for new tools by subclassing BaseIntegration.',
  },
]

export function CommunityPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <PublicNavbar />

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-5xl font-bold mb-6">Built by data engineers,<br />for data engineers.</h1>
          <p className="text-xl text-gray-400 leading-relaxed">
            VORO is open source and community-driven. Join the conversation, contribute code,
            or just share what you've built.
          </p>
        </div>
      </section>

      {/* Channels */}
      <section className="py-12 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
          {channels.map(c => (
            <div key={c.name} className="bg-gray-900 border border-white/10 rounded-2xl p-8 flex flex-col gap-4">
              <div className={`${c.color}`}>{c.icon}</div>
              <div>
                <h3 className="text-white font-semibold text-lg mb-1">{c.name}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{c.desc}</p>
              </div>
              <a
                href={c.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`mt-auto inline-flex items-center justify-center gap-2 ${c.bg} text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors`}
              >
                {c.action}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Contributors */}
      <section className="py-20 px-6 bg-gray-900/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Core contributors</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {contributors.map(c => (
              <div key={c.name} className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center text-white font-bold text-lg mx-auto mb-3">
                  {c.initials}
                </div>
                <p className="text-white text-sm font-medium">{c.name}</p>
                <p className="text-gray-500 text-xs">{c.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ways to contribute */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Ways to contribute</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {ways.map(w => (
              <div key={w.title} className="bg-gray-900 border border-white/10 rounded-xl p-6">
                <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center mb-4 text-white/60">
                  {w.icon}
                </div>
                <h3 className="text-white font-semibold mb-2">{w.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{w.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
