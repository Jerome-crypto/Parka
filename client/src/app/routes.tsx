import { createBrowserRouter } from 'react-router';
import DriverApp from './pages/driver/DriverApp';
import AttendantApp from './pages/attendant/AttendantApp';
import OperatorApp from './pages/operator/OperatorApp';
import AdminApp from './pages/admin/AdminApp';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';

export const router = createBrowserRouter([
  { path: '/', Component: Login },
  { path: '/login', Component: Login },
  { path: '/register', Component: Register },
  { path: '/forgot-password', Component: ForgotPassword },
  { path: '/reset-password', Component: ResetPassword },
  { path: '/driver/*', Component: DriverApp },
  { path: '/attendant/*', Component: AttendantApp },
  { path: '/operator/*', Component: OperatorApp },
  { path: '/admin/*', Component: AdminApp },
]);
