import { createBrowserRouter } from 'react-router';
import RoleSelect from './pages/RoleSelect';
import DriverApp from './pages/driver/DriverApp';
import AttendantApp from './pages/attendant/AttendantApp';
import OperatorApp from './pages/operator/OperatorApp';
import AdminApp from './pages/admin/AdminApp';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

export const router = createBrowserRouter([
  { path: '/', Component: RoleSelect },
  { path: '/login', Component: Login },
  { path: '/register', Component: Register },
  { path: '/driver/*', Component: DriverApp },
  { path: '/attendant/*', Component: AttendantApp },
  { path: '/operator/*', Component: OperatorApp },
  { path: '/admin/*', Component: AdminApp },
]);
