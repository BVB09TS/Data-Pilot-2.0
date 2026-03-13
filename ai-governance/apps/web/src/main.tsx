import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import './index.css';

import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Public pages
import { LandingPage }  from './pages/LandingPage';
import { DocsPage }     from './pages/DocsPage';
import { CommunityPage } from './pages/CommunityPage';
import { PricingPage }  from './pages/PricingPage';
import { PrivacyPage }  from './pages/PrivacyPage';
import { TermsPage }    from './pages/TermsPage';
import { ChangelogPage } from './pages/ChangelogPage';

// Auth
import Login from './pages/Login';

// App pages (protected)
import Dashboard   from './pages/Dashboard';
import Connections from './pages/Connections';
import Nodes       from './pages/Nodes';
import Lineage     from './pages/Lineage';
import Runs        from './pages/Runs';
import Policies    from './pages/Policies';
import AuditLog    from './pages/AuditLog';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
      <AuthProvider>
        <Routes>
          {/* ── Public pages (no auth required) ── */}
          <Route path="/"          element={<LandingPage />} />
          <Route path="/docs"      element={<DocsPage />} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/pricing"   element={<PricingPage />} />
          <Route path="/privacy"   element={<PrivacyPage />} />
          <Route path="/terms"     element={<TermsPage />} />
          <Route path="/changelog" element={<ChangelogPage />} />
          <Route path="/login"     element={<Login />} />

          {/* ── Protected app (requires auth) ── */}
          <Route element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route path="/dashboard"  element={<Dashboard />} />
            <Route path="/connections" element={<Connections />} />
            <Route path="/nodes"       element={<Nodes />} />
            <Route path="/lineage"     element={<Lineage />} />
            <Route path="/runs"        element={<Runs />} />
            <Route path="/policies"    element={<Policies />} />
            <Route path="/audit"       element={<AuditLog />} />
          </Route>

          {/* ── Fallback ── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
