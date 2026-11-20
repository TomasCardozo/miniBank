import { Route, Routes } from 'react-router';
import AdminRoute from './auth/AdminRoute';
import ProtectedRoute from './auth/ProtectedRoute';
import PublicOnlyRoute from './auth/PublicOnlyRoute';
import SessionRedirect from './auth/SessionRedirect';
import Layout from './components/layout/Layout';
import PublicAuthLayout from './components/layout/PublicAuthLayout';
import AccountDetailPage from './pages/AccountDetailPage';
import AccountLimitsPage from './pages/AccountLimitsPage';
import AccountMovementsPage from './pages/AccountMovementsPage';
import AccountsPage from './pages/AccountsPage';
import AdminAccountActionsPage from './pages/AdminAccountActionsPage';
import AdminAuditLogsPage from './pages/AdminAuditLogsPage';
import AdminHomePage from './pages/AdminHomePage';
import AdminTransfersPage from './pages/AdminTransfersPage';
import AdminUserDetailPage from './pages/AdminUserDetailPage';
import AdminUsersPage from './pages/AdminUsersPage';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import MePage from './pages/MePage';
import NewTransferPage from './pages/NewTransferPage';
import RegisterPage from './pages/RegisterPage';
import SystemPage from './pages/SystemPage';
import TransferDetailPage from './pages/TransferDetailPage';
import TransfersPage from './pages/TransfersPage';
import TypographyPreviewPage from './pages/TypographyPreviewPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<SessionRedirect />} />

      <Route element={<PublicOnlyRoute />}>
        <Route element={<PublicAuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>
      </Route>

      <Route element={<Layout />}>
        <Route path="/system" element={<SystemPage />} />
        <Route path="/typography-preview" element={<TypographyPreviewPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/me" element={<MePage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/accounts/:id" element={<AccountDetailPage />} />
          <Route path="/accounts/:accountId/movements" element={<AccountMovementsPage />} />
          <Route path="/accounts/:accountId/limits" element={<AccountLimitsPage />} />
          <Route path="/transfers" element={<TransfersPage />} />
          <Route path="/transfers/new" element={<NewTransferPage />} />
          <Route path="/transfers/:id" element={<TransferDetailPage />} />
        </Route>

        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminHomePage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/users/:id" element={<AdminUserDetailPage />} />
          <Route path="/admin/accounts/actions" element={<AdminAccountActionsPage />} />
          <Route path="/admin/transfers" element={<AdminTransfersPage />} />
          <Route path="/admin/audit-logs" element={<AdminAuditLogsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<SessionRedirect />} />
    </Routes>
  );
}
