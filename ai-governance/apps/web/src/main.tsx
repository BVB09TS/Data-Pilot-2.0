import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import './index.css';

import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Connections from './pages/Connections';
import Nodes from './pages/Nodes';
import Lineage from './pages/Lineage';
import Runs from './pages/Runs';
import Policies from './pages/Policies';
import AuditLog from './pages/AuditLog';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="connections" element={<Connections />} />
            <Route path="nodes"       element={<Nodes />} />
            <Route path="lineage"     element={<Lineage />} />
            <Route path="runs"        element={<Runs />} />
            <Route path="policies"    element={<Policies />} />
            <Route path="audit"       element={<AuditLog />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
