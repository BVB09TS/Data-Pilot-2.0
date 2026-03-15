import { PublicNavbar } from '../components/public/PublicNavbar'
import { PublicFooter } from '../components/public/PublicFooter'

const sections = [
  {
    title: '1. Acceptance of Terms',
    content: `By accessing or using VORO ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service. These terms apply to all users, including free tier users, paid subscribers, and enterprise customers.`,
  },
  {
    title: '2. Description of Service',
    content: `VORO is an AI-powered dbt project auditing tool. The Service parses dbt projects, constructs lineage graphs, and uses AI agents to identify data quality issues, dead models, broken references, and other problems. The Service is provided "as is" and may be updated or modified at any time.`,
  },
  {
    title: '3. Accounts',
    content: `You must create an account to access most features. You are responsible for maintaining the confidentiality of your credentials and for all activity that occurs under your account. Notify us immediately at security@voro.dev if you suspect unauthorised access.

You must be at least 18 years old to create an account. Accounts may not be shared between individuals.`,
  },
  {
    title: '4. Acceptable Use',
    content: `You agree not to:

• Use the Service for any unlawful purpose.
• Upload data you do not have the right to share.
• Attempt to reverse engineer, decompile, or circumvent security measures.
• Use the Service to train competing AI models without written permission.
• Abuse the free tier with automated scraping or bulk requests.
• Resell or sublicense the Service without authorisation.`,
  },
  {
    title: '5. Intellectual Property',
    content: `The VORO core audit engine is open source under the MIT licence. The web dashboard, enterprise integrations, and associated documentation are proprietary and owned by VORO.

Your dbt project files and data remain your property. You grant VORO a limited licence to process your data solely to provide the Service.`,
  },
  {
    title: '6. Payment and Refunds',
    content: `Paid plans are billed monthly or annually. All fees are in USD and non-refundable except where required by law. If you cancel, your plan remains active until the end of the billing period. Enterprise contracts are governed by a separate order form.`,
  },
  {
    title: '7. Limitation of Liability',
    content: `VORO is not responsible for decisions made based on audit findings. The Service provides recommendations and analysis, but final responsibility for data platform decisions lies with you.

To the maximum extent permitted by law, VORO's total liability for any claim related to the Service is limited to the amount you paid us in the 12 months preceding the claim.`,
  },
  {
    title: '8. Warranty Disclaimer',
    content: `The Service is provided "as is" without warranties of any kind, express or implied. We do not warrant that the Service will be uninterrupted, error-free, or that AI-generated findings will be 100% accurate.`,
  },
  {
    title: '9. Termination',
    content: `We may suspend or terminate your account if you violate these terms. You may cancel your account at any time from the settings page. Upon termination, your data will be deleted within 30 days unless retention is required by law.`,
  },
  {
    title: '10. Governing Law',
    content: `These terms are governed by the laws of the jurisdiction in which VORO is incorporated. Any disputes shall be resolved by binding arbitration, except where prohibited by law.`,
  },
  {
    title: '11. Changes to Terms',
    content: `We may update these terms at any time. We will provide at least 30 days' notice for material changes via email or in-product notice. Continued use after changes constitutes acceptance.`,
  },
  {
    title: '12. Contact',
    content: `Questions about these terms: legal@voro.dev`,
  },
]

export function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <PublicNavbar />

      <div className="max-w-3xl mx-auto px-6 pt-32 pb-24">
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-3">Terms of Service</h1>
          <p className="text-gray-400">Last updated: March 13, 2026</p>
        </div>

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
