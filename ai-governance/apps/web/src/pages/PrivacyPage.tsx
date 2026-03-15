import { PublicNavbar } from '../components/public/PublicNavbar'
import { PublicFooter } from '../components/public/PublicFooter'

const sections = [
  {
    title: '1. Information We Collect',
    content: `We collect information you provide directly to us, such as when you create an account, connect a dbt project, or contact support. This includes:

• Account information: email address, name, and password (hashed).
• Project metadata: dbt model names, lineage structure, finding counts. We do not store your raw SQL or business data.
• Usage data: audit run history, feature usage, and performance metrics to improve the product.
• API keys: LLM provider keys you enter are encrypted at rest and never logged.`,
  },
  {
    title: '2. How We Use Your Information',
    content: `We use the information we collect to:

• Provide, operate, and improve VORO.
• Send you audit results, alerts, and product updates.
• Respond to your support requests.
• Monitor the security and reliability of our service.
• Comply with legal obligations.

We do not sell your personal data to third parties.`,
  },
  {
    title: '3. Data Sharing',
    content: `We share your information only in the following circumstances:

• Service providers: We use infrastructure providers (cloud hosting, analytics) who process data on our behalf under strict data processing agreements.
• LLM providers: When you trigger an audit, anonymised model metadata (names, types, lineage relationships) may be sent to your configured LLM provider (Groq, Anthropic, or OpenAI) to generate findings. Raw SQL and column values are never sent.
• Legal requirements: We may disclose data if required by law or to protect the rights, property, or safety of VORO, our users, or the public.`,
  },
  {
    title: '4. Data Retention',
    content: `We retain your account data for as long as your account is active. Audit reports and findings are retained for 90 days by default, configurable per plan. You may request deletion of your account and all associated data at any time by contacting privacy@voro.dev.`,
  },
  {
    title: '5. Security',
    content: `We implement industry-standard security measures including TLS encryption in transit, AES-256 encryption at rest for sensitive fields, and regular security audits. No method of transmission or storage is 100% secure, but we take reasonable precautions to protect your information.`,
  },
  {
    title: '6. Your Rights',
    content: `Depending on your jurisdiction, you may have the right to:

• Access the personal data we hold about you.
• Correct inaccurate data.
• Request deletion of your data.
• Object to or restrict certain processing.
• Data portability.

To exercise these rights, contact privacy@voro.dev.`,
  },
  {
    title: '7. Cookies',
    content: `We use essential cookies for authentication and session management. We do not use advertising or tracking cookies. You can configure your browser to block cookies, but this may affect your ability to use the service.`,
  },
  {
    title: '8. Changes to This Policy',
    content: `We may update this policy from time to time. We will notify you of significant changes via email or a prominent notice in the product. Your continued use of VORO after changes constitutes acceptance of the updated policy.`,
  },
  {
    title: '9. Contact',
    content: `If you have questions about this privacy policy, contact us at privacy@voro.dev.`,
  },
]

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <PublicNavbar />

      <div className="max-w-3xl mx-auto px-6 pt-32 pb-24">
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-3">Privacy Policy</h1>
          <p className="text-gray-400">Last updated: March 13, 2026</p>
        </div>

        <p className="text-gray-300 mb-10 leading-relaxed">
          VORO ("we", "us", or "our") is committed to protecting your privacy.
          This policy explains how we collect, use, and share information when you use our service.
        </p>

        <div className="space-y-10">
          {sections.map(sec => (
            <div key={sec.title} className="border-t border-white/10 pt-8">
              <h2 className="text-xl font-semibold text-white mb-4">{sec.title}</h2>
              <div className="text-gray-400 text-sm leading-relaxed whitespace-pre-line">{sec.content}</div>
            </div>
          ))}
        </div>
      </div>

      <PublicFooter />
    </div>
  )
}
