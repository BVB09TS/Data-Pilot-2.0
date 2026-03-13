import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { Shell } from './components/layout/Shell'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { DocsPage } from './pages/DocsPage'
import { CommunityPage } from './pages/CommunityPage'
import { PricingPage } from './pages/PricingPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { TermsPage } from './pages/TermsPage'
import { ChangelogPage } from './pages/ChangelogPage'

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          {/* Public marketing pages */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/changelog" element={<ChangelogPage />} />

          {/* App dashboard */}
          <Route path="/dashboard" element={<Shell />} />
          <Route path="/dashboard/*" element={<Shell />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
