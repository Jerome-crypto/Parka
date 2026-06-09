import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  LayoutDashboard, Users, Building2, Shield, Activity, LogOut,
  Car, DollarSign, Check, X, AlertCircle,
  MoreVertical, Search, Plus,
} from 'lucide-react';
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../services/apiClient';
import {
  useAdminUsers,
  useToggleUserStatus,
  useAdminFacilities,
  useApproveFacility,
  useSystemMetrics,
  useAuditLogs,
  useSessions,
} from '../../services/queries';

type Screen = 'dashboard' | 'users' | 'facilities' | 'system';
type UserTab = 'drivers' | 'operators' | 'attendants';

const formatUGX = (n: any) => {
  if (n === undefined || n === null) return 'UGX 0';
  const parsed = Number(n);
  if (isNaN(parsed)) return 'UGX 0';
  return `UGX ${parsed.toLocaleString()}`;
};

const activityData = [
  { time: '06:00', sessions: 12 },
  { time: '07:00', sessions: 28 },
  { time: '08:00', sessions: 65 },
  { time: '09:00', sessions: 92 },
  { time: '10:00', sessions: 105 },
  { time: '11:00', sessions: 118 },
  { time: '12:00', sessions: 134 },
  { time: '13:00', sessions: 156 },
];

export default function AdminApp() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [screen, setScreenState] = useState<Screen>(() => {
    return (searchParams.get('screen') as Screen) || 'dashboard';
  });

  useEffect(() => {
    const paramScreen = (searchParams.get('screen') as Screen) || 'dashboard';
    if (paramScreen !== screen) {
      setScreenState(paramScreen);
    }
  }, [searchParams, screen]);

  const setScreen = (s: Screen) => {
    setSearchParams({ screen: s });
  };
  const [userTab, setUserTab] = useState<UserTab>('drivers');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeUserMenu, setActiveUserMenu] = useState<string | null>(null);

  // User onboarding states
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserRole, setNewUserRole] = useState<'DRIVER' | 'OPERATOR' | 'ATTENDANT'>('OPERATOR');
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserCompanyName, setNewUserCompanyName] = useState('');
  const [newUserBusinessLicense, setNewUserBusinessLicense] = useState('');
  const [newUserFacilityId, setNewUserFacilityId] = useState('');
  const [newUserShiftInfo, setNewUserShiftInfo] = useState('7:00 AM – 3:00 PM');
  const [createUserLoading, setCreateUserLoading] = useState(false);

  const handleCreateUser = async (e: any) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail || !newUserPassword) {
      alert('Please fill out all required fields.');
      return;
    }
    setCreateUserLoading(true);
    try {
      const payload: any = {
        name: newUserName,
        email: newUserEmail,
        phone: newUserPhone || undefined,
        password: newUserPassword,
        role: newUserRole,
      };
      if (newUserRole === 'OPERATOR') {
        payload.companyName = newUserCompanyName || undefined;
        payload.businessLicense = newUserBusinessLicense || undefined;
      } else if (newUserRole === 'ATTENDANT') {
        payload.facilityId = newUserFacilityId || undefined;
        payload.shiftInfo = newUserShiftInfo || undefined;
      }

      await apiClient.post('/auth/register', payload);

      alert('User created successfully!');
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPhone('');
      setNewUserPassword('');
      setNewUserCompanyName('');
      setNewUserBusinessLicense('');
      setNewUserFacilityId('');
      setShowAddUserModal(false);
      refetchUsers();
      refetchAudit();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create user.');
    } finally {
      setCreateUserLoading(false);
    }
  };

  const navItems: { id: Screen; icon: typeof LayoutDashboard; label: string }[] = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'users', icon: Users, label: 'Users' },
    { id: 'facilities', icon: Building2, label: 'Facilities' },
    { id: 'system', icon: Activity, label: 'System' },
  ];

  // Fetch queries
  const { data: usersData, isLoading: usersLoading, refetch: refetchUsers } = useAdminUsers();
  const { data: facilitiesData, isLoading: facLoading, refetch: refetchFacilities } = useAdminFacilities();
  const { data: telemetryData, isLoading: telLoading } = useSystemMetrics();
  const { data: auditLogsData, isLoading: auditLoading, refetch: refetchAudit } = useAuditLogs();
  const { data: sessionsData, isLoading: sessionsLoading, refetch: refetchSessions } = useSessions();

  const activeFacilities = facilitiesData?.active || [];

  // Mutations
  const toggleUserStatusMutation = useToggleUserStatus();
  const approveFacilityMutation = useApproveFacility();

  const handleToggleStatus = (userId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    if (confirm(`Are you sure you want to ${nextStatus === 'suspended' ? 'suspend' : 'reinstate'} this user?`)) {
      toggleUserStatusMutation.mutate(
        { id: userId, status: nextStatus },
        {
          onSuccess: () => {
            refetchUsers();
            refetchAudit();
            setActiveUserMenu(null);
          },
          onError: (err: any) => {
            alert(err?.response?.data?.message || 'Failed to update user status.');
          },
        }
      );
    }
  };

  const handleApproveReject = (facilityId: string, decision: 'approved' | 'rejected') => {
    if (confirm(`Are you sure you want to ${decision} this facility?`)) {
      approveFacilityMutation.mutate(
        { id: facilityId, decision },
        {
          onSuccess: () => {
            refetchFacilities();
            refetchAudit();
            refetchSessions();
          },
          onError: (err: any) => {
            alert(err?.response?.data?.message || 'Approval/rejection action failed.');
          },
        }
      );
    }
  };

  const isToday = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    return d.getDate() === today.getDate() &&
           d.getMonth() === today.getMonth() &&
           d.getFullYear() === today.getFullYear();
  };

  function renderDashboard() {
    if (usersLoading || facLoading || telLoading || sessionsLoading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-t-[#B45309] border-gray-200 rounded-full animate-spin" />
        </div>
      );
    }

    const drivers = usersData?.drivers || [];
    const operators = usersData?.operators || [];
    const attendants = usersData?.attendants || [];
    const totalUsers = drivers.length + operators.length + attendants.length;

    const pendingFacilities = facilitiesData?.pending || [];

    const activeSessionsCount = (sessionsData || []).filter((s: any) => s.status === 'active').length;

    const todayRevenue = (sessionsData || [])
      .filter((s: any) => s.status === 'completed' && s.checkout_time && isToday(s.checkout_time))
      .reduce((sum: number, s: any) => sum + Number(s.amount_charged), 0) || 0;

    const kpis = [
      { label: 'Total Users', value: totalUsers.toLocaleString(), change: `+${drivers.filter((d: any) => isToday(d.joined)).length} today`, icon: Users, color: '#0F4C81', bg: '#EFF6FF' },
      { label: 'Active Facilities', value: String(activeFacilities.length), change: `${pendingFacilities.length} pending`, icon: Building2, color: '#2E8B57', bg: '#F0FDF4' },
      { label: 'Active Sessions', value: String(activeSessionsCount), change: 'Right now', icon: Car, color: '#7C3AED', bg: '#F5F3FF' },
      { label: "Today's Revenue", value: formatUGX(todayRevenue), change: 'Settled cash', icon: DollarSign, color: '#B45309', bg: '#FFFBEB' },
    ];

    return (
      <div className="flex-1 overflow-y-auto">
        <div className="bg-[#B45309] px-6 pt-8 pb-6 text-white">
          <div className="flex items-center justify-between mb-1">
            <div>
              <p className="text-amber-200 text-sm">System Administrator</p>
              <h1 className="text-xl font-bold">{user?.name || 'Admin'}</h1>
            </div>
            <div className="w-12 h-12 rounded-full bg-[#F4B400] flex items-center justify-center">
              <span className="font-bold text-[#0F172A]">
                {user?.name ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase() : 'AD'}
              </span>
            </div>
          </div>
          <p className="text-amber-200 text-sm mt-2">
            {new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} · System Operational
          </p>
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: kpi.bg }}>
                    <kpi.icon size={16} style={{ color: kpi.color }} />
                  </div>
                </div>
                <p className="font-bold text-[#0F172A] text-lg md:text-xl">{kpi.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{kpi.label}</p>
                <p className="text-[11px] font-medium mt-1" style={{ color: kpi.color }}>{kpi.change}</p>
              </div>
            ))}
          </div>

          {/* Live activity */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[#0F172A]">Live Session Activity</h3>
              <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Live
              </span>
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="sessions" stroke="#B45309" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Pending approvals */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-[#0F172A]">Pending Approvals</h3>
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                {pendingFacilities.length} pending
              </span>
            </div>
            <div className="space-y-3">
              {pendingFacilities.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No pending facility approvals.</p>
              ) : (
                pendingFacilities.slice(0, 3).map((f: any) => (
                  <div key={f.id} className="border border-gray-100 rounded-xl p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-sm text-[#0F172A]">{f.name}</p>
                        <p className="text-xs text-gray-500">{f.address} · {f.total_spaces} spaces</p>
                        <p className="text-xs text-gray-400 mt-0.5">{f.operator || 'Operator'} · Submitted {new Date(f.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveReject(f.id, 'rejected')}
                        disabled={approveFacilityMutation.isPending}
                        className="flex-1 py-1.5 border border-red-100 text-red-500 rounded-lg text-sm font-medium flex items-center justify-center gap-1 hover:bg-red-50 disabled:opacity-55"
                      >
                        <X size={14} /> Reject
                      </button>
                      <button
                        onClick={() => handleApproveReject(f.id, 'approved')}
                        disabled={approveFacilityMutation.isPending}
                        className="flex-1 py-1.5 bg-[#2E8B57] text-white rounded-lg text-sm font-medium flex items-center justify-center gap-1 hover:bg-green-700 disabled:opacity-55"
                      >
                        <Check size={14} /> Approve
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderUsers() {
    const tabs: UserTab[] = ['drivers', 'operators', 'attendants'];
    const drivers = usersData?.drivers || [];
    const operators = usersData?.operators || [];
    const attendants = usersData?.attendants || [];

    const activeList = userTab === 'drivers'
      ? drivers
      : userTab === 'operators'
        ? operators
        : attendants;

    const filteredUsers = activeList.filter((u: any) => {
      const match = u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (u.phone && u.phone.includes(searchQuery)) ||
                    (u.company && u.company.toLowerCase().includes(searchQuery.toLowerCase()));
      return match;
    });

    return (
      <div className="flex-1 overflow-y-auto">
        <div className="bg-white border-b border-gray-100 px-5 pt-8 pb-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg text-[#0F172A]">User Management</h2>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 border border-gray-100 rounded-xl px-2.5 py-1.5 w-36 md:w-56 bg-slate-50">
                <Search size={14} className="text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="text-xs bg-transparent border-0 outline-none w-full text-[#0F172A]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button
                onClick={() => {
                  setNewUserRole(userTab === 'drivers' ? 'DRIVER' : userTab === 'operators' ? 'OPERATOR' : 'ATTENDANT');
                  setShowAddUserModal(true);
                }}
                className="bg-[#B45309] text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 hover:opacity-90 transition-opacity"
              >
                <Plus size={14} /> Add User
              </button>
            </div>
          </div>
          <div className="flex gap-1">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => {
                  setUserTab(t);
                  setSearchQuery('');
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${userTab === t ? 'bg-[#B45309] text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          {filteredUsers.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No users found.</p>
          ) : (
            filteredUsers.map((u: any) => (
              <div key={u.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm relative">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                      <span className="font-bold text-sm text-amber-700">{u.name.split(' ').map((n: string) => n[0]).join('')}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-[#0F172A]">{u.name}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                      {userTab === 'drivers' && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {u.sessions || 0} sessions · Joined {new Date(u.joined).toLocaleDateString()}
                        </p>
                      )}
                      {userTab === 'operators' && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Company: {u.company || 'N/A'} · {u.facilities || 0} facilities
                        </p>
                      )}
                      {userTab === 'attendants' && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Facility: {u.facility || 'None Assigned'} · Shift: {u.shift || 'N/A'}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize ${u.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {u.status}
                    </span>
                    <button
                      onClick={() => setActiveUserMenu(activeUserMenu === u.id ? null : u.id)}
                      className="text-gray-400 hover:text-gray-600 mt-1"
                    >
                      <MoreVertical size={16} />
                    </button>
                  </div>
                </div>

                {activeUserMenu === u.id && (
                  <div className="absolute right-4 top-12 bg-white border border-gray-100 rounded-lg shadow-lg z-20 w-32 py-1 text-xs">
                    <button
                      onClick={() => handleToggleStatus(u.id, u.status)}
                      className="w-full text-left px-3 py-2 text-[#0F172A] hover:bg-slate-50 font-medium"
                    >
                      {u.status === 'active' ? '🔧 Suspend User' : '✓ Reinstate User'}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  function renderFacilities() {
    if (facLoading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-t-[#B45309] border-gray-200 rounded-full animate-spin" />
        </div>
      );
    }

    const pending = facilitiesData?.pending || [];
    const active = facilitiesData?.active || [];

    return (
      <div className="flex-1 overflow-y-auto">
        <div className="bg-white border-b border-gray-100 px-5 pt-8 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-lg text-[#0F172A]">Facility Approval</h2>
              <p className="text-sm text-gray-500 mt-0.5">Review and approve submissions</p>
            </div>
            <span className="text-xs bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-semibold">
              {pending.length} pending
            </span>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Pending Review</p>
            {pending.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No pending approvals.</p>
            ) : (
              pending.map((f: any) => (
                <div key={f.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm mb-3">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-[#0F172A]">{f.name}</p>
                      <p className="text-sm text-gray-500 mt-0.5">{f.address}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><Car size={11} /> {f.total_spaces} spaces</span>
                        <span className="flex items-center gap-1"><Users size={11} /> {f.operator || 'Operator'}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">Submitted: {new Date(f.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleApproveReject(f.id, 'rejected')}
                      disabled={approveFacilityMutation.isPending}
                      className="flex-1 py-2 bg-[#FEF2F2] text-[#DC2626] rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
                    >
                      <X size={14} /> Reject
                    </button>
                    <button
                      onClick={() => handleApproveReject(f.id, 'approved')}
                      disabled={approveFacilityMutation.isPending}
                      className="flex-1 py-2 bg-[#2E8B57] text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:bg-green-700 transition-colors"
                    >
                      <Check size={14} /> Approve
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Active Facilities</p>
            <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
              {active.length === 0 ? (
                <p className="text-sm text-gray-400 p-4 text-center">No active facilities found.</p>
              ) : (
                active.map((f: any) => (
                  <div key={f.id} className="flex items-center px-4 py-3 gap-3">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                      <Building2 size={14} className="text-green-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#0F172A] truncate">{f.name}</p>
                      <p className="text-xs text-gray-400">{f.operator || 'Operator'} · {f.total_spaces} spaces · {formatUGX(f.price_per_hour)}/hr</p>
                    </div>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      Active
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderSystem() {
    if (telLoading || auditLoading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-t-[#B45309] border-gray-200 rounded-full animate-spin" />
        </div>
      );
    }

    const systemMetricsList = telemetryData?.systemMetrics || [];
    const stats = telemetryData?.stats || { uptime: '100%', avgLatency: '30ms', errorRate: '0%' };
    const logs = auditLogsData || [];

    const statsCards = [
      { label: 'Uptime', value: stats.uptime, color: '#16A34A' },
      { label: 'Avg Latency', value: stats.avgLatency, color: '#0F4C81' },
      { label: 'Error Rate', value: stats.errorRate, color: '#F59E0B' },
    ];

    return (
      <div className="flex-1 overflow-y-auto">
        <div className="bg-white border-b border-gray-100 px-5 pt-8 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-lg text-[#0F172A]">System Monitoring</h2>
              <p className="text-sm text-gray-500 mt-0.5">Real-time health & performance</p>
            </div>
            <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium bg-green-50 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Operational
            </span>
          </div>
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* System overview */}
          <div className="grid grid-cols-3 gap-3">
            {statsCards.map((s) => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-3 text-center shadow-sm">
                <p className="font-bold text-base md:text-lg" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Service health */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-[#0F172A]">Service Status</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {systemMetricsList.map((m: any) => (
                <div key={m.label} className="flex items-center px-4 py-3 gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${m.status === 'operational' ? 'bg-green-500' : 'bg-amber-500'}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#0F172A]">{m.label}</p>
                    <p className="text-xs text-gray-400">Latency: {m.latency}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${m.status === 'operational' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {m.status === 'operational' ? 'Operational' : 'Degraded'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Error log */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-[#0F172A]">Security & Activity Audit Logs</h3>
              <span className="text-xs text-gray-400">Recent logs</span>
            </div>
            <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-sm text-gray-400 p-4 text-center">No logs recorded yet.</p>
              ) : (
                logs.map((log: any) => {
                  const logTimeFormatted = log.created_at
                    ? new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '';
                  return (
                    <div key={log.id} className="flex items-start px-4 py-3 gap-3">
                      <span className="text-[10px] font-mono font-bold mt-0.5 w-12 flex-shrink-0 text-blue-600">AUDIT</span>
                      <div className="flex-1 leading-snug">
                        <p className="text-xs text-gray-600">
                          <strong className="text-gray-800">{log.userName || 'System'}</strong>: {log.action}
                        </p>
                        {log.details && Object.keys(log.details).length > 0 && (
                          <span className="text-[10px] text-gray-400 block font-mono mt-0.5">
                            {JSON.stringify(log.details)}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0 font-mono">{logTimeFormatted}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const screenMap: Record<Screen, JSX.Element> = {
    dashboard: renderDashboard(),
    users: renderUsers(),
    facilities: renderFacilities(),
    system: renderSystem(),
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-[#78350F] flex-shrink-0">
        <div className="px-5 pt-8 pb-6 border-b border-white/10">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 bg-[#F4B400] rounded-lg flex items-center justify-center">
              <Shield size={16} className="text-[#0F172A]" />
            </div>
            <span className="text-white font-bold text-lg">Parka Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#F4B400] flex items-center justify-center">
              <span className="font-bold text-sm text-[#0F172A]">
                {user?.name ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase() : 'AD'}
              </span>
            </div>
            <div>
              <p className="text-white text-sm font-medium">{user?.name || 'Admin'}</p>
              <p className="text-amber-300 text-xs">Super Administrator</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = screen === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setScreen(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-[#F4B400] text-[#0F172A]' : 'text-amber-100 hover:bg-white/10 hover:text-white'}`}
              >
                <Icon size={18} /> {item.label}
              </button>
            );
          })}
        </nav>
        <div className="px-3 pb-6 border-t border-white/10 pt-4 space-y-1">
          <button
            onClick={async () => {
              await logout();
              navigate('/');
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-amber-300 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {screenMap[screen]}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50">
          <div className="flex items-center justify-around px-2 py-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = screen === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setScreen(item.id)}
                  className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors ${isActive ? 'text-[#B45309]' : 'text-gray-400'}`}
                >
                  <Icon size={20} />
                  <span className="text-xs font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 relative text-left">
            <button
              onClick={() => setShowAddUserModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"
            >
              <X size={16} />
            </button>
            <h3 className="font-bold text-lg text-[#0F172A] mb-4">Register New User</h3>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">User Role *</label>
                <select
                  value={newUserRole}
                  onChange={(e: any) => setNewUserRole(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-slate-50 focus:ring-1 focus:ring-[#B45309] outline-none text-gray-700"
                >
                  <option value="DRIVER">Driver</option>
                  <option value="OPERATOR">Operator</option>
                  <option value="ATTENDANT">Attendant</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-slate-50 focus:ring-1 focus:ring-[#B45309] outline-none text-[#0F172A]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. john@example.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-slate-50 focus:ring-1 focus:ring-[#B45309] outline-none text-[#0F172A]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="e.g. +256701234567"
                  value={newUserPhone}
                  onChange={(e) => setNewUserPhone(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-slate-50 focus:ring-1 focus:ring-[#B45309] outline-none text-[#0F172A]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Password *</label>
                <input
                  type="password"
                  required
                  placeholder="Minimum 6 characters"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-slate-50 focus:ring-1 focus:ring-[#B45309] outline-none text-[#0F172A]"
                />
              </div>

              {newUserRole === 'OPERATOR' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Company Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Kampala Parking Ltd"
                      value={newUserCompanyName}
                      onChange={(e) => setNewUserCompanyName(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-slate-50 focus:ring-1 focus:ring-[#B45309] outline-none text-[#0F172A]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Business License</label>
                    <input
                      type="text"
                      placeholder="e.g. LIC-98765"
                      value={newUserBusinessLicense}
                      onChange={(e) => setNewUserBusinessLicense(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-slate-50 focus:ring-1 focus:ring-[#B45309] outline-none text-[#0F172A]"
                    />
                  </div>
                </>
              )}

              {newUserRole === 'ATTENDANT' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Assign Facility</label>
                    <select
                      value={newUserFacilityId}
                      onChange={(e) => setNewUserFacilityId(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-slate-50 focus:ring-1 focus:ring-[#B45309] outline-none text-gray-700"
                    >
                      <option value="">-- Select Facility --</option>
                      {activeFacilities.map((f: any) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Shift Info</label>
                    <input
                      type="text"
                      placeholder="e.g. 7:00 AM – 3:00 PM"
                      value={newUserShiftInfo}
                      onChange={(e) => setNewUserShiftInfo(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-slate-50 focus:ring-1 focus:ring-[#B45309] outline-none text-[#0F172A]"
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={createUserLoading}
                className="w-full mt-4 py-3 bg-[#B45309] text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2 hover:bg-amber-800 transition-colors"
              >
                {createUserLoading ? 'Creating User...' : 'Create User'}
              </button>
            </form>
          </div>
        </div>
      )}
      </main>
    </div>
  );
}
