import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  LayoutDashboard, Building2, Tag, Calendar, BarChart2, LogOut,
  TrendingUp, Car, DollarSign, Edit, Plus, Check, X, Trash2,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

import { useAuth } from '../../contexts/AuthContext';
import {
  useOperatorDashboard,
  useOperatorFacilities,
  useOperatorReports,
  useReservations,
  useCreateFacility,
  useUpdateFacility,
} from '../../services/queries';

type Screen = 'dashboard' | 'facilities' | 'pricing' | 'reservations' | 'reports';

const formatUGX = (n: any) => {
  if (n === undefined || n === null) return 'UGX 0';
  const parsed = Number(n);
  if (isNaN(parsed)) return 'UGX 0';
  return `UGX ${parsed.toLocaleString()}`;
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning,';
  if (hour < 17) return 'Good afternoon,';
  return 'Good evening,';
}

export default function OperatorApp() {
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

  const [showAddFacilityModal, setShowAddFacilityModal] = useState(false);
  const [showAddSpecialRateModal, setShowAddSpecialRateModal] = useState(false);

  // Form states for adding facility
  const [facName, setFacName] = useState('');
  const [facAddress, setFacAddress] = useState('');
  const [facLat, setFacLat] = useState('0.3150');
  const [facLng, setFacLng] = useState('32.5820');
  const [facSpaces, setFacSpaces] = useState(50);
  const [facRate, setFacRate] = useState(2000);
  const [facType, setFacType] = useState<'covered' | 'open' | 'multi-story'>('covered');
  const [facHours, setFacHours] = useState('24/7');
  const [facAmenities, setFacAmenities] = useState<string[]>(['Covered', '24/7 Security']);
  const [facImageUrl, setFacImageUrl] = useState('');

  // Special Rate form states
  const [rateName, setRateName] = useState('');
  const [rateSchedule, setRateSchedule] = useState('');
  const [rateDiscount, setRateDiscount] = useState('-10%');
  const [customRates, setCustomRates] = useState<any[]>([
    { id: '1', name: 'Weekend Rate', schedule: 'Fri 6PM – Mon 6AM', discount: '-15%', status: 'Active' },
    { id: '2', name: 'Monthly Pass', schedule: 'All facilities', discount: '-30%', status: 'Active' },
    { id: '3', name: 'Early Bird', schedule: 'Before 8AM', discount: '-20%', status: 'Inactive' },
  ]);

  // Mutations
  const createFacilityMutation = useCreateFacility();
  const updateFacilityMutation = useUpdateFacility();

  const [showEditFacilityModal, setShowEditFacilityModal] = useState(false);
  const [selectedEditFacility, setSelectedEditFacility] = useState<any>(null);

  const handleEditFacility = async (e: any) => {
    e.preventDefault();
    if (!selectedEditFacility) return;
    if (!facName || !facAddress) {
      alert('Please fill out all required fields.');
      return;
    }
    try {
      await updateFacilityMutation.mutateAsync({
        id: selectedEditFacility.id,
        data: {
          name: facName,
          address: facAddress,
          latitude: Number(facLat),
          longitude: Number(facLng),
          totalSpaces: Number(facSpaces),
          pricePerHour: Number(facRate),
          type: facType,
          hours: facHours,
          hasSecurity: facAmenities.includes('24/7 Security'),
          imageUrl: facImageUrl || 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800&h=400&fit=crop&auto=format',
          amenities: facAmenities,
        },
      });
      alert('Facility updated successfully!');
      setShowEditFacilityModal(false);
      setSelectedEditFacility(null);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update facility.');
    }
  };

  const handleAddFacility = async (e: any) => {
    e.preventDefault();
    if (!facName || !facAddress) {
      alert('Please fill out all required fields.');
      return;
    }
    try {
      await createFacilityMutation.mutateAsync({
        name: facName,
        address: facAddress,
        latitude: Number(facLat),
        longitude: Number(facLng),
        totalSpaces: Number(facSpaces),
        pricePerHour: Number(facRate),
        type: facType,
        hours: facHours,
        hasSecurity: facAmenities.includes('24/7 Security'),
        imageUrl: facImageUrl || 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800&h=400&fit=crop&auto=format',
        amenities: facAmenities,
      });

      // Reset & close
      setFacName('');
      setFacAddress('');
      setFacSpaces(50);
      setFacRate(2000);
      setFacImageUrl('');
      setShowAddFacilityModal(false);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to register facility.');
    }
  };

  // CSV Report Exporter
  const handleExportReports = () => {
    const reportsList = reportsData || [];
    const monthlyData = reportsList.map((r: any) => ({
      month: r.month.trim(),
      revenue: Number(r.revenue),
      sessions: Number(r.sessions),
    })) || [];

    if (monthlyData.length === 0) {
      alert('No performance data available to export.');
      return;
    }

    // Build CSV content
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Month,Revenue (UGX),Total Sessions\n';
    monthlyData.forEach((row: any) => {
      csvContent += `${row.month},${row.revenue},${row.sessions}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'Parka_Revenue_Report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Fetch operator data
  const { data: dashboardData, isLoading: dashLoading } = useOperatorDashboard();
  const { data: facilitiesData, isLoading: facLoading } = useOperatorFacilities();
  const { data: reportsData, isLoading: repLoading } = useOperatorReports();
  const { data: reservationsData, isLoading: resLoading } = useReservations();

  const navItems: { id: Screen; icon: typeof LayoutDashboard; label: string }[] = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'facilities', icon: Building2, label: 'Facilities' },
    { id: 'pricing', icon: Tag, label: 'Pricing' },
    { id: 'reservations', icon: Calendar, label: 'Reservations' },
    { id: 'reports', icon: BarChart2, label: 'Reports' },
  ];

  function renderDashboard() {
    if (dashLoading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-t-[#7C3AED] border-gray-200 rounded-full animate-spin" />
        </div>
      );
    }

    const metrics = dashboardData?.metrics || { revenueToday: 0, occupancyRate: 0, activeSessions: 0, reservationsCount: 0 };
    const chartRevenue = dashboardData?.revenueData?.map((r: any) => ({
      day: r.day.trim(),
      revenue: Number(r.revenue),
    })) || [];

    const occupancyList = dashboardData?.occupancyData || [];
    const paymentList = dashboardData?.paymentData || [{ name: 'Cash', value: 100, color: '#64748B' }];

    const kpis = [
      { label: 'Today Revenue', value: formatUGX(metrics.revenueToday), change: 'Today', icon: DollarSign, color: '#7C3AED', bg: '#F5F3FF' },
      { label: 'Occupancy Rate', value: `${metrics.occupancyRate}%`, change: 'Live', icon: TrendingUp, color: '#0F4C81', bg: '#EFF6FF' },
      { label: 'Active Sessions', value: String(metrics.activeSessions), change: 'Active', icon: Car, color: '#2E8B57', bg: '#F0FDF4' },
      { label: 'Reservations', value: String(metrics.reservationsCount), change: 'Today', icon: Calendar, color: '#F59E0B', bg: '#FFFBEB' },
    ];

    return (
      <div className="flex-1 overflow-y-auto">
        <div className="bg-[#7C3AED] px-6 pt-8 pb-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-purple-200 text-sm">{getGreeting()}</p>
              <h1 className="text-xl font-bold">{user?.name || 'Operator'}</h1>
              <p className="text-purple-200 text-sm mt-1">
                {facilitiesData?.length || 0} Managed Parking Facilities
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#F4B400] flex items-center justify-center">
                <span className="font-bold text-[#0F172A]">
                  {user?.name ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase() : 'OP'}
                </span>
              </div>
              <button
                onClick={async () => {
                  if (confirm('Are you sure you want to sign out?')) {
                    await logout();
                    navigate('/');
                  }
                }}
                className="md:hidden p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                title="Sign Out"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: kpi.bg }}>
                    <kpi.icon size={16} style={{ color: kpi.color }} />
                  </div>
                  <span className="text-xs text-gray-500 font-semibold bg-gray-50 px-1.5 py-0.5 rounded-full">{kpi.change}</span>
                </div>
                <p className="font-bold text-[#0F172A] text-base md:text-lg">{kpi.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{kpi.label}</p>
              </div>
            ))}
          </div>

          {/* Revenue chart */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[#0F172A]">Revenue – This Week</h3>
              <span className="text-xs text-gray-400">UGX</span>
            </div>
            {chartRevenue.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No revenue recorded this week.</p>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={chartRevenue}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickFormatter={(v) => `${v / 1000}K`} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v: number) => [formatUGX(v), 'Revenue']}
                    contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#7C3AED" strokeWidth={2} fill="url(#revGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Occupancy by facility */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <h3 className="font-semibold text-[#0F172A] mb-4">Occupancy by Facility</h3>
            {occupancyList.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No facility occupancy data available.</p>
            ) : (
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={occupancyList} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94A3B8' }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip formatter={(v: number) => [`${v}%`, 'Occupancy']} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="occupancy" radius={4}>
                    {occupancyList.map((entry: any, i: number) => (
                      <Cell key={i} fill={entry.occupancy > 80 ? '#DC2626' : entry.occupancy > 60 ? '#F59E0B' : '#2E8B57'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Payment breakdown */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <h3 className="font-semibold text-[#0F172A] mb-4">Payment Methods</h3>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={120} height={120}>
                <PieChart>
                  <Pie data={paymentList} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" strokeWidth={0}>
                    {paymentList.map((entry: any, i: number) => (
                      <Cell key={i} fill={entry.color || '#64748B'} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {paymentList.map((p: any) => (
                  <div key={p.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color || '#64748B' }} />
                      <span className="text-xs text-gray-600">{p.name}</span>
                    </div>
                    <span className="text-xs font-semibold text-[#0F172A]">{p.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderFacilities() {
    if (facLoading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-t-[#7C3AED] border-gray-200 rounded-full animate-spin" />
        </div>
      );
    }

    const facilities = facilitiesData || [];

    return (
      <div className="flex-1 overflow-y-auto">
        <div className="bg-white border-b border-gray-100 px-5 pt-8 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-lg text-[#0F172A]">Facilities</h2>
              <p className="text-sm text-gray-500 mt-0.5">{facilities.length} managed facilities</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddFacilityModal(true)}
                className="bg-[#7C3AED] text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 hover:opacity-90 transition-opacity"
              >
                <Plus size={14} /> Add Facility
              </button>
              <button
                onClick={async () => {
                  if (confirm('Are you sure you want to sign out?')) {
                    await logout();
                    navigate('/');
                  }
                }}
                className="md:hidden p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors"
                title="Sign Out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="px-5 py-5 space-y-4">
          {facilities.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No managed facilities found.</p>
          ) : (
            facilities.map((f: any) => {
              const pct = f.spaces > 0 ? Math.round((f.occupied / f.spaces) * 100) : 0;
              const statusColor = pct > 85 ? '#DC2626' : pct > 60 ? '#F59E0B' : '#16A34A';
              return (
                <div key={f.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                        <Building2 size={18} className="text-[#7C3AED]" />
                      </div>
                      <div>
                        <p className="font-semibold text-[#0F172A]">{f.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{f.spaces} total spaces</p>
                      </div>
                    </div>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium capitalize">
                      {f.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center py-3 border-y border-gray-50 mb-3">
                    <div>
                      <p className="text-xs text-gray-400">Occupied</p>
                      <p className="font-bold text-[#0F172A] mt-0.5">{f.occupied}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Rate/hr</p>
                      <p className="font-bold text-[#7C3AED] mt-0.5">UGX {f.rate.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Revenue</p>
                      <p className="font-bold text-[#2E8B57] mt-0.5 text-xs">{f.revenue || 'UGX 0'}</p>
                    </div>
                  </div>
                  {/* Occupancy bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Occupancy</span>
                      <span style={{ color: statusColor }}>{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: statusColor }} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedEditFacility(f);
                        setFacName(f.name);
                        setFacAddress(f.address);
                        setFacLat(String(f.latitude || f.lat || '0.3150'));
                        setFacLng(String(f.longitude || f.lng || '32.5820'));
                        setFacSpaces(Number(f.totalSpaces || f.spaces || 50));
                        setFacRate(Number(f.pricePerHour || f.rate || 2000));
                        setFacType(f.type || 'covered');
                        setFacHours(f.hours || '24/7');
                        setFacAmenities(f.amenities || ['Covered', '24/7 Security']);
                        setFacImageUrl(f.imageUrl || f.image || '');
                        setShowEditFacilityModal(true);
                      }}
                      className="flex-1 py-2 flex items-center justify-center gap-1.5 border border-gray-100 text-gray-700 rounded-lg text-sm hover:bg-slate-50 transition-colors"
                    >
                      <Edit size={14} /> Edit
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  function renderPricing() {
    const facilities = facilitiesData || [];

    return (
      <div className="flex-1 overflow-y-auto">
        <div className="bg-white border-b border-gray-100 px-5 pt-8 pb-4 flex justify-between items-center">
          <div>
            <h2 className="font-bold text-lg text-[#0F172A]">Pricing Management</h2>
            <p className="text-sm text-gray-500 mt-0.5">Configure rates across facilities</p>
          </div>
          <button
            onClick={async () => {
              if (confirm('Are you sure you want to sign out?')) {
                await logout();
                navigate('/');
              }
            }}
            className="md:hidden p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors"
            title="Sign Out"
          >
            <LogOut size={16} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {facilities.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No facilities available to price.</p>
          ) : (
            facilities.map((f: any) => (
              <div key={f.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <p className="font-semibold text-[#0F172A]">{f.name}</p>
                  <button
                    onClick={() => {
                      setSelectedEditFacility(f);
                      setFacName(f.name);
                      setFacAddress(f.address);
                      setFacLat(String(f.latitude || f.lat || '0.3150'));
                      setFacLng(String(f.longitude || f.lng || '32.5820'));
                      setFacSpaces(Number(f.totalSpaces || f.spaces || 50));
                      setFacRate(Number(f.pricePerHour || f.rate || 2000));
                      setFacType(f.type || 'covered');
                      setFacHours(f.hours || '24/7');
                      setFacAmenities(f.amenities || ['Covered', '24/7 Security']);
                      setFacImageUrl(f.imageUrl || f.image || '');
                      setShowEditFacilityModal(true);
                    }}
                    className="text-[#7C3AED] text-sm font-medium flex items-center gap-1 hover:opacity-80 transition-opacity"
                  >
                    <Edit size={14} /> Edit
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Hourly', value: f.rate },
                    { label: 'Daily Max', value: f.rate * 8 },
                    { label: 'Overnight', value: f.rate * 5 },
                  ].map((rate) => (
                    <div key={rate.label} className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">{rate.label}</p>
                      <p className="font-bold text-[#0F172A] text-xs md:text-sm">{formatUGX(rate.value)}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-50">
                  <div className="flex items-center gap-2">
                    <Check size={14} className="text-green-500" />
                    <span className="text-xs text-gray-500">Rates effective immediately</span>
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Special rates */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-[#0F172A]">Special Rates</h3>
              <button
                onClick={() => setShowAddSpecialRateModal(true)}
                className="text-sm text-[#7C3AED] font-medium flex items-center gap-1"
              >
                <Plus size={14} /> Add
              </button>
            </div>
            {customRates.map((sr) => (
              <div key={sr.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-[#0F172A]">{sr.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{sr.schedule}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-[#2E8B57]">{sr.discount}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sr.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {sr.status}
                  </span>
                  <button
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete the special rate "${sr.name}"?`)) {
                        setCustomRates((prev) => prev.filter((r) => r.id !== sr.id));
                      }
                    }}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    title="Delete rate"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderReservations() {
    if (resLoading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-t-[#7C3AED] border-gray-200 rounded-full animate-spin" />
        </div>
      );
    }

    const reservations = reservationsData || [];
    const statusColors = {
      upcoming: { color: '#7C3AED', bg: '#F5F3FF' },
      active: { color: '#16A34A', bg: '#F0FDF4' },
      completed: { color: '#2563EB', bg: '#EFF6FF' },
      cancelled: { color: '#DC2626', bg: '#FEF2FE' },
      expired: { color: '#D97706', bg: '#FFFBEB' },
    };

    return (
      <div className="flex-1 overflow-y-auto">
        <div className="bg-white border-b border-gray-100 px-5 pt-8 pb-4 flex justify-between items-center">
          <div>
            <h2 className="font-bold text-lg text-[#0F172A]">Reservations</h2>
            <p className="text-sm text-gray-500 mt-0.5">Booking overview</p>
          </div>
          <button
            onClick={async () => {
              if (confirm('Are you sure you want to sign out?')) {
                await logout();
                navigate('/');
              }
            }}
            className="md:hidden p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors"
            title="Sign Out"
          >
            <LogOut size={16} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {reservations.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No reservations found.</p>
          ) : (
            reservations.map((r: any) => {
              const sc = statusColors[r.status as keyof typeof statusColors] || { color: '#64748B', bg: '#F1F5F9' };
              const arrivalTimeFormatted = r.arrival_time
                ? new Date(r.arrival_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '';
              const arrivalDateFormatted = r.arrival_time
                ? new Date(r.arrival_time).toLocaleDateString([], { month: 'short', day: 'numeric' })
                : '';

              return (
                <div key={r.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-[#0F172A] text-sm">{r.driverName || 'Driver'}</p>
                      <span className="text-xs font-mono text-gray-400">{r.code}</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {r.facilityName} · {arrivalDateFormatted} at {arrivalTimeFormatted} · {r.duration_hours}h · {r.vehiclePlate}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize" style={{ color: sc.color, background: sc.bg }}>
                      {r.status}
                    </span>
                    <span className="text-sm font-bold text-[#7C3AED]">{formatUGX(r.amount)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  function renderReports() {
    if (repLoading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-t-[#7C3AED] border-gray-200 rounded-full animate-spin" />
        </div>
      );
    }

    const reportsList = reportsData || [];
    const monthlyData = reportsList.map((r: any) => ({
      month: r.month.trim(),
      revenue: Number(r.revenue),
      sessions: Number(r.sessions),
    })) || [];

    const totalRev = monthlyData.reduce((acc: number, val: any) => acc + val.revenue, 0);
    const totalSess = monthlyData.reduce((acc: number, val: any) => acc + val.sessions, 0);
    const avgDailyRev = monthlyData.length > 0 ? Math.round(totalRev / (monthlyData.length * 30)) : 0;

    const summaryCards = [
      { label: 'Total Revenue', value: formatUGX(totalRev), sub: 'Report period' },
      { label: 'Total Sessions', value: String(totalSess), sub: 'Completed sessions' },
      { label: 'Avg Daily Rev', value: formatUGX(avgDailyRev), sub: 'Estimated average' },
    ];

    const facilities = facilitiesData || [];

    return (
      <div className="flex-1 overflow-y-auto">
        <div className="bg-white border-b border-gray-100 px-5 pt-8 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-lg text-[#0F172A]">Reports</h2>
              <p className="text-sm text-gray-500 mt-0.5">Performance analytics</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportReports}
                className="flex items-center gap-1.5 border border-gray-200 text-gray-700 px-3 py-2 rounded-xl text-sm hover:bg-slate-50 transition-colors"
              >
                Export
              </button>
              <button
                onClick={async () => {
                  if (confirm('Are you sure you want to sign out?')) {
                    await logout();
                    navigate('/');
                  }
                }}
                className="md:hidden p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors"
                title="Sign Out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            {summaryCards.map((s) => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-3 text-center shadow-sm">
                <p className="font-bold text-[#7C3AED] text-sm md:text-base">{s.value}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Monthly revenue */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <h3 className="font-semibold text-[#0F172A] mb-4">Monthly Revenue (UGX)</h3>
            {monthlyData.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No historical revenue reports found.</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => [formatUGX(v), 'Revenue']} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="revenue" fill="#7C3AED" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Sessions trend */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <h3 className="font-semibold text-[#0F172A] mb-4">Parking Sessions Trend</h3>
            {monthlyData.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No completed sessions trend found.</p>
            ) : (
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="sessGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2E8B57" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#2E8B57" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="sessions" stroke="#2E8B57" strokeWidth={2} fill="url(#sessGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Utilization table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-[#0F172A]">Facility Utilization</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {facilities.length === 0 ? (
                <p className="text-sm text-gray-400 p-4 text-center">No utilization statistics available.</p>
              ) : (
                facilities.map((f: any) => {
                  const uPct = f.spaces > 0 ? Math.round((f.occupied / f.spaces) * 100) : 0;
                  return (
                    <div key={f.id} className="flex items-center justify-between px-4 py-3">
                      <p className="text-sm font-medium text-[#0F172A] flex-1 truncate pr-4">{f.name}</p>
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${uPct}%`, background: '#7C3AED' }}
                          />
                        </div>
                        <span className="text-sm font-bold text-[#7C3AED] w-10 text-right">
                          {uPct}%
                        </span>
                      </div>
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
    facilities: renderFacilities(),
    pricing: renderPricing(),
    reservations: renderReservations(),
    reports: renderReports(),
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-[#4C1D95] flex-shrink-0">
        <div className="px-5 pt-8 pb-6 border-b border-white/10">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 bg-[#F4B400] rounded-lg flex items-center justify-center">
              <Building2 size={16} className="text-[#0F172A]" />
            </div>
            <span className="text-white font-bold text-lg">Parka</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#F4B400] flex items-center justify-center">
              <span className="font-bold text-sm text-[#0F172A]">
                {user?.name ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase() : 'OP'}
              </span>
            </div>
            <div>
              <p className="text-white text-sm font-medium">{user?.name || 'Operator'}</p>
              <p className="text-purple-300 text-xs">Facility Operator</p>
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
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-[#F4B400] text-[#0F172A]' : 'text-purple-200 hover:bg-white/10 hover:text-white'}`}
              >
                <Icon size={18} /> {item.label}
              </button>
            );
          })}
        </nav>
        <div className="px-3 pb-6 border-t border-white/10 pt-4">
          <button
            onClick={async () => {
              await logout();
              navigate('/');
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-purple-300 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {screenMap[screen]}
        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50">
          <div className="flex items-center justify-around px-1 py-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = screen === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setScreen(item.id)}
                  className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl transition-colors ${isActive ? 'text-[#7C3AED]' : 'text-gray-400'}`}
                >
                  <Icon size={20} />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </main>

      {/* Add Facility Modal */}
      {showAddFacilityModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 relative animate-fade-in text-left">
            <button
              onClick={() => setShowAddFacilityModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"
            >
              <X size={16} />
            </button>
            <h3 className="font-bold text-lg text-[#0F172A] mb-4">Register New Facility</h3>
            <form onSubmit={handleAddFacility} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Facility Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Acacia Mall Annex"
                  required
                  value={facName}
                  onChange={(e) => setFacName(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-slate-50 focus:ring-1 focus:ring-[#7C3AED] outline-none text-[#0F172A]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Address *</label>
                <input
                  type="text"
                  placeholder="e.g. Cooper Rd, Kampala"
                  required
                  value={facAddress}
                  onChange={(e) => setFacAddress(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-slate-50 focus:ring-1 focus:ring-[#7C3AED] outline-none text-[#0F172A]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Latitude</label>
                  <input
                    type="text"
                    required
                    value={facLat}
                    onChange={(e) => setFacLat(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-slate-50 focus:ring-1 focus:ring-[#7C3AED] outline-none text-[#0F172A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Longitude</label>
                  <input
                    type="text"
                    required
                    value={facLng}
                    onChange={(e) => setFacLng(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-slate-50 focus:ring-1 focus:ring-[#7C3AED] outline-none text-[#0F172A]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Total Spaces</label>
                  <input
                    type="number"
                    required
                    value={facSpaces}
                    onChange={(e) => setFacSpaces(Number(e.target.value))}
                    className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-slate-50 focus:ring-1 focus:ring-[#7C3AED] outline-none text-[#0F172A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Price Per Hour (UGX)</label>
                  <input
                    type="number"
                    required
                    value={facRate}
                    onChange={(e) => setFacRate(Number(e.target.value))}
                    className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-slate-50 focus:ring-1 focus:ring-[#7C3AED] outline-none text-[#0F172A]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Facility Type</label>
                  <select
                    value={facType}
                    onChange={(e: any) => setFacType(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-slate-50 focus:ring-1 focus:ring-[#7C3AED] outline-none text-gray-700"
                  >
                    <option value="covered">Covered</option>
                    <option value="open">Open</option>
                    <option value="multi-story">Multi-story</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Hours</label>
                  <input
                    type="text"
                    required
                    value={facHours}
                    onChange={(e) => setFacHours(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-slate-50 focus:ring-1 focus:ring-[#7C3AED] outline-none text-[#0F172A]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Image URL</label>
                <input
                  type="text"
                  placeholder="Leave blank for default"
                  value={facImageUrl}
                  onChange={(e) => setFacImageUrl(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-slate-50 focus:ring-1 focus:ring-[#7C3AED] outline-none text-[#0F172A]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Amenities</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {['Covered', '24/7 Security', 'CCTV', 'Disabled Access', 'EV Charging'].map((amenity) => {
                    const active = facAmenities.includes(amenity);
                    return (
                      <button
                        type="button"
                        key={amenity}
                        onClick={() => {
                          setFacAmenities((prev) =>
                            active ? prev.filter((a) => a !== amenity) : [...prev, amenity]
                          );
                        }}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                          active ? 'bg-purple-100 text-[#7C3AED] border-purple-200' : 'bg-white border-gray-150 text-gray-500'
                        }`}
                      >
                        {amenity}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button
                type="submit"
                disabled={createFacilityMutation.isPending}
                className="w-full mt-4 py-3 bg-[#7C3AED] text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2 hover:bg-purple-700 transition-colors"
              >
                {createFacilityMutation.isPending ? 'Submitting...' : 'Submit for Admin Approval'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Special Rate Modal */}
      {showAddSpecialRateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 relative animate-fade-in text-left">
            <button
              onClick={() => setShowAddSpecialRateModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"
            >
              <X size={16} />
            </button>
            <h3 className="font-bold text-lg text-[#0F172A] mb-4">Add Special Rate</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!rateName || !rateSchedule) return;
                setCustomRates((prev) => [
                  ...prev,
                  { id: Date.now().toString(), name: rateName, schedule: rateSchedule, discount: rateDiscount, status: 'Active' }
                ]);
                setRateName('');
                setRateSchedule('');
                setRateDiscount('-10%');
                setShowAddSpecialRateModal(false);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Rate Name</label>
                <input
                  type="text"
                  placeholder="e.g. Night Owl Special"
                  required
                  value={rateName}
                  onChange={(e) => setRateName(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-slate-50 focus:ring-1 focus:ring-[#7C3AED] outline-none text-[#0F172A]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Schedule / Validity</label>
                <input
                  type="text"
                  placeholder="e.g. Everyday 10PM - 5AM"
                  required
                  value={rateSchedule}
                  onChange={(e) => setRateSchedule(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-slate-50 focus:ring-1 focus:ring-[#7C3AED] outline-none text-[#0F172A]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Discount Percentage</label>
                <select
                  value={rateDiscount}
                  onChange={(e) => setRateDiscount(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-slate-50 focus:ring-1 focus:ring-[#7C3AED] outline-none text-gray-700"
                >
                  <option value="-5%">5% Discount</option>
                  <option value="-10%">10% Discount</option>
                  <option value="-15%">15% Discount</option>
                  <option value="-20%">20% Discount</option>
                  <option value="-30%">30% Discount</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-[#7C3AED] text-white font-semibold text-sm rounded-xl hover:bg-purple-700 transition-colors"
              >
                Create Rate
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Facility Modal */}
      {showEditFacilityModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 relative animate-fade-in text-left">
            <button
              onClick={() => {
                setShowEditFacilityModal(false);
                setSelectedEditFacility(null);
              }}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"
            >
              <X size={16} />
            </button>
            <h3 className="font-bold text-lg text-[#0F172A] mb-4">Edit Facility Details</h3>
            <form onSubmit={handleEditFacility} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Facility Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Acacia Mall Annex"
                  required
                  value={facName}
                  onChange={(e) => setFacName(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-slate-50 focus:ring-1 focus:ring-[#7C3AED] outline-none text-[#0F172A]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Address *</label>
                <input
                  type="text"
                  placeholder="e.g. Cooper Rd, Kampala"
                  required
                  value={facAddress}
                  onChange={(e) => setFacAddress(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-slate-50 focus:ring-1 focus:ring-[#7C3AED] outline-none text-[#0F172A]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Latitude</label>
                  <input
                    type="text"
                    required
                    value={facLat}
                    onChange={(e) => setFacLat(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-slate-50 focus:ring-1 focus:ring-[#7C3AED] outline-none text-[#0F172A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Longitude</label>
                  <input
                    type="text"
                    required
                    value={facLng}
                    onChange={(e) => setFacLng(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-slate-50 focus:ring-1 focus:ring-[#7C3AED] outline-none text-[#0F172A]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Total Spaces</label>
                  <input
                    type="number"
                    required
                    value={facSpaces}
                    onChange={(e) => setFacSpaces(Number(e.target.value))}
                    className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-slate-50 focus:ring-1 focus:ring-[#7C3AED] outline-none text-[#0F172A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Price Per Hour (UGX)</label>
                  <input
                    type="number"
                    required
                    value={facRate}
                    onChange={(e) => setFacRate(Number(e.target.value))}
                    className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-slate-50 focus:ring-1 focus:ring-[#7C3AED] outline-none text-[#0F172A]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Facility Type</label>
                  <select
                    value={facType}
                    onChange={(e: any) => setFacType(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-slate-50 focus:ring-1 focus:ring-[#7C3AED] outline-none text-gray-700"
                  >
                    <option value="covered">Covered</option>
                    <option value="open">Open</option>
                    <option value="multi-story">Multi-story</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Hours</label>
                  <input
                    type="text"
                    required
                    value={facHours}
                    onChange={(e) => setFacHours(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-slate-50 focus:ring-1 focus:ring-[#7C3AED] outline-none text-[#0F172A]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Image URL</label>
                <input
                  type="text"
                  placeholder="Leave blank for default"
                  value={facImageUrl}
                  onChange={(e) => setFacImageUrl(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-slate-50 focus:ring-1 focus:ring-[#7C3AED] outline-none text-[#0F172A]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Amenities</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {['Covered', '24/7 Security', 'CCTV', 'Disabled Access', 'EV Charging'].map((amenity) => {
                    const active = facAmenities.includes(amenity);
                    return (
                      <button
                        type="button"
                        key={amenity}
                        onClick={() => {
                          setFacAmenities((prev) =>
                            active ? prev.filter((a) => a !== amenity) : [...prev, amenity]
                          );
                        }}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                          active ? 'bg-purple-100 text-[#7C3AED] border-purple-200' : 'bg-white border-gray-150 text-gray-500'
                        }`}
                      >
                        {amenity}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button
                type="submit"
                disabled={updateFacilityMutation.isPending}
                className="w-full mt-4 py-3 bg-[#7C3AED] text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2 hover:bg-purple-700 transition-colors"
              >
                {updateFacilityMutation.isPending ? 'Updating...' : 'Save Updates'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
