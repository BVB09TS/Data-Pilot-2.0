import { Link } from 'react-router-dom'
import { PublicNavbar } from '../components/public/PublicNavbar'
import { PublicFooter } from '../components/public/PublicFooter'

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    desc: 'Perfect for solo engineers and small teams getting started.',
    cta: 'Get started free',
    ctaLink: '/login',
    highlight: false,
    features: [
      '1 dbt project',
      'Unlimited audits',
      'All 8 AI audit agents',
      'Lineage explorer',
      'JSON / CSV / HTML export',
      'Community support',
    ],
    missing: [
      'GitLab MR review bot',
      'Best practices engine',
      'Snowflake deep scan',
      'Power BI impact analysis',
      'SSO / RBAC',
    ],
  },
  {
    name: 'Team',
    price: '$149',
    period: 'per month',
    desc: 'For data teams who want automation and governance at scale.',
    cta: 'Start 14-day trial',
    ctaLink: '/login',
    highlight: true,
    badge: 'Most popular',
    features: [
      'Up to 10 dbt projects',
      'Unlimited audits',
      'All 8 AI audit agents',
      'Lineage explorer',
      'All export formats + SARIF',
      'GitLab MR review bot',
      'Best practices engine (YAML rules)',
      'Snowflake cost analysis',
      'Slack / email notifications',
      'Priority support',
    ],
    missing: [
      'Power BI impact analysis',
      'Azure Service Bus listener',
      'Custom SSO / SAML',
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: 'contact us',
    desc: 'For large data platforms with complex governance requirements.',
    cta: 'Talk to us',
    ctaLink: 'mailto:hello@voro.dev',
    highlight: false,
    features: [
      'Unlimited projects',
      'Unlimited audits',
      'All Team features',
      'Power BI impact analysis',
      'Azure Service Bus listener',
      'Data Contracts validation',
      'Data Galaxy catalog sync',
      'Multi-tenant workspaces',
      'RBAC + Custom SSO / SAML',
      'On-premise deployment option',
      'SLA + dedicated support',
    ],
    missing: [],
  },
]

const faqs = [
  {
    q: 'What counts as a "project"?',
    a: 'One dbt project = one dbt_project.yml. A mono-repo with multiple projects counts as multiple projects.',
  },
  {
    q: 'Do I need an LLM API key?',
    a: 'The Free tier uses a shared Groq key (Llama 3.3 70B). Team and Enterprise can bring their own keys for Anthropic, OpenAI, or Groq.',
  },
  {
    q: 'Is VORO open source?',
    a: 'The core audit engine is open source (MIT). The web dashboard and enterprise integrations are proprietary.',
  },
  {
    q: 'Can I self-host?',
    a: 'Yes — Team and Enterprise plans can be deployed on your own infrastructure via Docker or Kubernetes. We provide Helm charts and manifests.',
  },
  {
    q: 'What dbt adapters are supported?',
    a: 'All major adapters: dbt-duckdb, dbt-snowflake, dbt-bigquery, dbt-redshift, dbt-spark, dbt-databricks.',
  },
]

export function PricingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <PublicNavbar />

      {/* Hero */}
      <section className="pt-32 pb-16 px-6 text-center">
        <h1 className="text-5xl font-bold mb-4">Simple, transparent pricing</h1>
        <p className="text-xl text-gray-400 max-w-xl mx-auto">
          Start free. Scale when your team does. No hidden fees.
        </p>
      </section>

      {/* Plans */}
      <section className="pb-24 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6 items-start">
          {plans.map(plan => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-8 flex flex-col gap-6 ${
                plan.highlight
                  ? 'bg-white/5 border-white/20 ring-1 ring-white/10'
                  : 'bg-gray-900/60 border-white/10'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white text-black text-xs font-semibold px-4 py-1 rounded-full">
                  {plan.badge}
                </div>
              )}

              <div>
                <p className="text-gray-400 text-sm font-medium mb-1">{plan.name}</p>
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  <span className="text-gray-500 text-sm pb-1">/ {plan.period}</span>
                </div>
                <p className="text-gray-400 text-sm">{plan.desc}</p>
              </div>

              <Link
                to={plan.ctaLink}
                className={`block text-center py-3 rounded-xl font-semibold text-sm transition-colors ${
                  plan.highlight
                    ? 'bg-white hover:bg-neutral-100 text-black'
                    : 'bg-white/10 hover:bg-white/15 text-white'
                }`}
              >
                {plan.cta}
              </Link>

              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">Includes</p>
                <ul className="space-y-2">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="text-green-400 mt-0.5 shrink-0">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                {plan.missing.length > 0 && (
                  <>
                    <div className="my-4 border-t border-white/5" />
                    <ul className="space-y-2">
                      {plan.missing.map(f => (
                        <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                          <span className="mt-0.5 shrink-0">✗</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-6 bg-gray-900/30 border-t border-white/10">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Frequently asked questions</h2>
          <div className="space-y-6">
            {faqs.map(faq => (
              <div key={faq.q} className="bg-gray-900 border border-white/10 rounded-xl p-6">
                <h3 className="text-white font-semibold mb-2">{faq.q}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
