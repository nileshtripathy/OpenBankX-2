import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import DashboardPage from '@/pages/DashboardPage';
import BankPage from '@/pages/BankPage';
import SwapPage from '@/pages/SwapPage';
import TransactionsPage from '@/pages/TransactionsPage';
import AiAssistantPage from '@/pages/AiAssistantPage';
import ComingSoonPage from '@/pages/ComingSoonPage';
import NotFoundPage from '@/pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/bank" element={<BankPage />} />
          <Route path="/swap" element={<SwapPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/assistant" element={<AiAssistantPage />} />
          <Route path="/profile" element={<ComingSoonPage title="Profile" />} />
          <Route path="/admin" element={<ComingSoonPage title="Admin Panel" />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
