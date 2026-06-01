import { useState, useEffect, type ReactElement } from 'react';
import { useNavigate } from 'react-router';
import {
  Home, Search, Bell, User, MapPin, Clock, Star, Shield, ChevronRight,
  Navigation, Zap, Filter, List, Map, ArrowLeft, Car, Calendar,
  Check, QrCode, Timer, CreditCard, Receipt, Phone, X, Plus,
  ChevronDown, LogOut, Settings, Wallet, History, AlertCircle,
} from 'lucide-react';
import {
  formatUGX, getAvailabilityStatus, type ParkingFacility,
} from '../../data/mockData';
import {
  useFacilities, useVehicles, useReservations, useNotifications,
  useCreateReservation, useCancelReservation, useMarkNotificationRead, useInitiatePayment,
  useCreateVehicle, useSessions, useCheckoutSession
} from '../../services/queries';
import { useAuth } from '../../contexts/AuthContext';
import LeafletMap from '../../components/LeafletMap';

type Tab = 'home' | 'explore' | 'reservations' | 'notifications' | 'profile';
type Screen =
  | 'home' | 'explore' | 'reservations' | 'notifications' | 'profile'
  | 'detail' | 'reserve' | 'confirmed' | 'session' | 'checkout' | 'receipt';

function QRCodeDisplay({ value }: { value: string }) {
  const size = 17;
  const seed = (row: number, col: number) => {
    const h = value.charCodeAt((row * size + col) % value.length);
    const isCorner =
      (row < 5 && col < 5) || (row < 5 && col >= size - 5) || (row >= size - 5 && col < 5);
    if (isCorner) {
      const r = row % (size - 1 < 5 ? size - 1 : 5);
      const c = col % (size - 1 < 5 ? size - 1 : 5);
      if (r === 0 || r === 4 || c === 0 || c === 4) return true;
      if (r >= 1 && r <= 3 && c >= 1 && c <= 3 && r === 2 && c === 2) return true;
      return false;
    }
    return (h * 7 + row * 13 + col * 17) % 3 !== 0;
  };
  const cells = Array.from({ length: size * size }, (_, i) => {
    const row = Math.floor(i / size);
    const col = i % size;
    return seed(row, col);
  });
  return (
    <div className="p-3 bg-white rounded-xl inline-block shadow-sm border border-gray-100">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${size}, 10px)`,
          gap: 1,
        }}
      >
        {cells.map((filled, i) => (
          <div
            key={i}
            style={{
              width: 10,
              height: 10,
              background: filled ? '#0F172A' : '#FFFFFF',
              borderRadius: filled ? 1 : 0,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function CityMapSVG({
  onMarkerClick,
  selectedId,
}: {
  onMarkerClick: (id: string) => void;
  selectedId: string | null;
}) {
  const markers = [
    { id: 'p1', x: 115, y: 88, status: 'available' },
    { id: 'p2', x: 240, y: 48, status: 'limited' },
    { id: 'p3', x: 342, y: 92, status: 'full' },
    { id: 'p4', x: 58, y: 188, status: 'available' },
    { id: 'p5', x: 268, y: 200, status: 'limited' },
    { id: 'p6', x: 340, y: 188, status: 'available' },
  ];
  const color = {
    available: '#16A34A',
    limited: '#F59E0B',
    full: '#DC2626',
  };
  return (
    <svg viewBox="0 0 420 270" className="w-full h-full" style={{ background: '#E8EFF6' }}>
      {/* Grid base */}
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="420" height="270" fill="url(#grid)" />
      {/* City blocks */}
      {[
        [8, 8, 68, 68], [88, 8, 88, 68], [196, 8, 96, 68], [312, 8, 96, 68],
        [8, 106, 68, 74], [88, 106, 88, 74], [196, 106, 96, 74], [312, 106, 96, 74],
        [8, 200, 68, 62], [88, 200, 88, 62], [196, 200, 96, 62], [312, 200, 96, 62],
      ].map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} rx="3" fill="#D0DCEA" opacity="0.8" />
      ))}
      {/* Major roads */}
      <rect x="0" y="88" width="420" height="14" fill="white" opacity="0.85" />
      <rect x="0" y="184" width="420" height="12" fill="white" opacity="0.75" />
      <rect x="178" y="0" width="14" height="270" fill="white" opacity="0.85" />
      <rect x="80" y="0" width="6" height="270" fill="white" opacity="0.6" />
      <rect x="306" y="0" width="6" height="270" fill="white" opacity="0.6" />
      {/* Road labels */}
      <text x="30" y="100" fontSize="6" fill="#94A3B8" fontFamily="Inter, sans-serif">Yusuf Lule Rd</text>
      <text x="183" y="20" fontSize="6" fill="#94A3B8" fontFamily="Inter, sans-serif" transform="rotate(90,183,20)">Pilkington Rd</text>
      {/* User location */}
      <circle cx="185" cy="130" r="10" fill="#0F4C81" opacity="0.15" />
      <circle cx="185" cy="130" r="6" fill="#0F4C81" opacity="0.25" />
      <circle cx="185" cy="130" r="4" fill="#0F4C81" />
      <circle cx="185" cy="130" r="2" fill="white" />
      {/* Parking markers */}
      {markers.map((m) => {
        const c = color[m.status as keyof typeof color];
        const selected = selectedId === m.id;
        return (
          <g key={m.id} onClick={() => onMarkerClick(m.id)} style={{ cursor: 'pointer' }}>
            <circle cx={m.x} cy={m.y} r={selected ? 16 : 13} fill={c} opacity={selected ? 1 : 0.9} />
            {selected && <circle cx={m.x} cy={m.y} r={19} fill={c} opacity={0.2} />}
            <text
              x={m.x}
              y={m.y + 4}
              textAnchor="middle"
              fill="white"
              fontSize="10"
              fontWeight="bold"
              fontFamily="Inter, sans-serif"
              style={{ pointerEvents: 'none' }}
            >
              P
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function DriverApp() {
  const navigate = useNavigate();
  
  // Live queries
  const { data: dbFacilities = [] } = useFacilities();
  const { data: dbVehicles = [] } = useVehicles();
  const { data: dbReservations = [] } = useReservations();
  const { data: dbNotifications = [] } = useNotifications();
  const { data: dbSessions = [], refetch: refetchSessions } = useSessions();
  const { user, logout } = useAuth();

  const createReservationMutation = useCreateReservation();
  const cancelReservationMutation = useCancelReservation();
  const markNotificationReadMutation = useMarkNotificationRead();
  const initiatePaymentMutation = useInitiatePayment();
  const createVehicleMutation = useCreateVehicle();
  const checkoutMutation = useCheckoutSession();

  const handleAddVehicle = async (e: any) => {
    e.preventDefault();
    if (!newVehiclePlate || !newVehicleMake || !newVehicleModel) {
      alert('Please fill out all required fields.');
      return;
    }
    try {
      await createVehicleMutation.mutateAsync({
        plate: newVehiclePlate,
        make: newVehicleMake,
        model: newVehicleModel,
        color: newVehicleColor || 'Unknown',
        year: Number(newVehicleYear) || new Date().getFullYear(),
        type: newVehicleType,
      });
      // Clear form and close modal
      setNewVehiclePlate('');
      setNewVehicleMake('');
      setNewVehicleModel('');
      setNewVehicleColor('');
      setNewVehicleYear(new Date().getFullYear());
      setNewVehicleType('sedan');
      setShowAddVehicleModal(false);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to register vehicle.');
    }
  };
  
  // Mapping compatibility aliases
  const PARKING_FACILITIES = dbFacilities;
  const USER_VEHICLES = dbVehicles;
  const RESERVATIONS = dbReservations;
  const NOTIFICATIONS = dbNotifications;

  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [screen, setScreen] = useState<Screen>('home');
  const [selectedFacility, setSelectedFacility] = useState<ParkingFacility | null>(null);
  const [reserveStep, setReserveStep] = useState(1);
  const [reserveVehicle, setReserveVehicle] = useState('');
  const [reserveDate, setReserveDate] = useState('Mon, 3 Jun 2024');
  const [reserveTime, setReserveTime] = useState('10:30 AM');
  const [reserveDuration, setReserveDuration] = useState(2);
  const [confirmedResId, setConfirmedResId] = useState('');
  const [confirmedResToken, setConfirmedResToken] = useState('');
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const activeSession = dbSessions.find((s: any) => s.status === 'active');
  const [mapSelectedId, setMapSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('list');
  const [exploreFilter, setExploreFilter] = useState('nearest');
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'mtn' | 'airtel' | 'cash'>('mtn');
  const [resTab, setResTab] = useState<'upcoming' | 'active' | 'completed' | 'cancelled'>('active');
  const unreadCount = dbNotifications.filter((n: any) => !n.is_read).length;

  // Add Vehicle Form States
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [newVehiclePlate, setNewVehiclePlate] = useState('');
  const [newVehicleMake, setNewVehicleMake] = useState('');
  const [newVehicleModel, setNewVehicleModel] = useState('');
  const [newVehicleColor, setNewVehicleColor] = useState('');
  const [newVehicleYear, setNewVehicleYear] = useState(new Date().getFullYear());
  const [newVehicleType, setNewVehicleType] = useState<'sedan' | 'suv' | 'truck' | 'motorcycle'>('sedan');

  // Date and Payment states
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [newPaymentProvider, setNewPaymentProvider] = useState<'mtn' | 'airtel'>('mtn');
  const [newPaymentPhone, setNewPaymentPhone] = useState(user?.phone || '');
  const [customPaymentMethods, setCustomPaymentMethods] = useState<any[]>([]);

  // Settings Slide-over Drawer state
  const [activeSettingsDrawer, setActiveSettingsDrawer] = useState<string | null>(null);

  useEffect(() => {
    if (dbVehicles.length > 0 && !reserveVehicle) {
      setReserveVehicle(dbVehicles[0].id);
    }
  }, [dbVehicles, reserveVehicle]);

  useEffect(() => {
    if (!activeSession) {
      setSessionSeconds(0);
      return;
    }
    
    const calculateSeconds = () => {
      const checkinTime = new Date(activeSession.checkin_time).getTime();
      const now = new Date().getTime();
      const diffSeconds = Math.max(0, Math.floor((now - checkinTime) / 1000));
      setSessionSeconds(diffSeconds);
    };

    calculateSeconds();
    const interval = setInterval(calculateSeconds, 1000);
    return () => {
      clearInterval(interval);
    };
  }, [activeSession]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h > 0 ? h + ':' : ''}${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const activeFacility = dbFacilities.find((f: any) => f.id === activeSession?.facility_id);
  const hourlyRate = activeFacility?.pricePerHour ?? 2000;
  const elapsedHours = Math.max(1, Math.ceil(sessionSeconds / 3600));
  const sessionCharges = activeSession ? (elapsedHours * hourlyRate) : 0;

  const push = (s: Screen) => setScreen(s);
  const changeTab = (t: Tab) => {
    setActiveTab(t);
    setScreen(t as Screen);
  };

  const openDetail = (f: ParkingFacility) => {
    setSelectedFacility(f);
    push('detail');
  };

  const navItems: { tab: Tab; icon: typeof Home; label: string }[] = [
    { tab: 'home', icon: Home, label: 'Home' },
    { tab: 'explore', icon: Search, label: 'Explore' },
    { tab: 'reservations', icon: Calendar, label: 'Bookings' },
    { tab: 'notifications', icon: Bell, label: 'Alerts' },
    { tab: 'profile', icon: User, label: 'Profile' },
  ];

  // --- Screen renderers ---
  function renderHome() {
    const nearby = PARKING_FACILITIES.slice(0, 4);
    return (
      <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
        {/* Header */}
        <div className="bg-[#0F4C81] px-5 pt-12 pb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-blue-200 text-sm">Good morning,</p>
              <h1 className="text-white text-xl font-semibold">{user?.name || 'Driver'}</h1>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#F4B400] flex items-center justify-center">
              <span className="text-[#0F172A] font-bold text-sm">
                {user?.name ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase() : 'DR'}
              </span>
            </div>
          </div>
          {/* Location */}
          <div className="flex items-center gap-2 mb-4">
            <MapPin size={14} className="text-blue-200" />
            <span className="text-blue-200 text-sm">Nakasero, Kampala</span>
          </div>
          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search parking near you..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => changeTab('explore')}
              className="w-full bg-white rounded-xl pl-9 pr-4 py-3 text-sm text-gray-700 outline-none placeholder-gray-400"
            />
          </div>
        </div>

        <div className="px-4 py-4 space-y-5">
          {/* Active session widget */}
          {activeSession && (
            <div
              className="bg-[#0F4C81] rounded-2xl p-4 cursor-pointer shadow-lg"
              onClick={() => push('session')}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-blue-200 text-xs font-medium uppercase tracking-wide">Active Session</span>
                <span className="bg-green-400 text-green-900 text-xs font-semibold px-2 py-0.5 rounded-full">Live</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-semibold">{activeSession.facilityName}</p>
                  <p className="text-blue-200 text-sm mt-0.5">
                    {activeSession.spaceNumber ? `Zone B · Space ${activeSession.spaceNumber}` : 'Auto Assigned'} · {activeSession.vehicle_plate}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-[#F4B400] font-bold text-xl mono">{formatTime(sessionSeconds)}</div>
                  <div className="text-blue-200 text-xs mt-0.5">{formatUGX(Math.round(sessionCharges * 1.05))}</div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                <span className="text-blue-200 text-sm">
                  Checked in at {new Date(activeSession.checkin_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <ChevronRight size={16} className="text-blue-200" />
              </div>
            </div>
          )}

          {/* Nearby parking */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-[#0F172A]">Nearby Parking</h2>
              <button
                className="text-[#0F4C81] text-sm font-medium"
                onClick={() => changeTab('explore')}
              >
                View All
              </button>
            </div>
            <div className="space-y-3">
              {nearby.map((f) => {
                const status = getAvailabilityStatus(f);
                return (
                  <div
                    key={f.id}
                    className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => openDetail(f)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-[#0F172A] truncate">{f.name}</p>
                          <span
                            className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{ color: status.color, background: status.bg }}
                          >
                            {status.label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <MapPin size={12} />
                          {f.address}
                        </p>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Navigation size={11} /> {f.distanceKm} km
                          </span>
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock size={11} /> {f.etaMin} min
                          </span>
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Star size={11} className="fill-[#F4B400] text-[#F4B400]" /> {f.rating}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className="font-bold text-[#0F4C81]">{formatUGX(f.pricePerHour)}</p>
                        <p className="text-xs text-gray-400">per hour</p>
                        <p className="text-xs mt-1 font-medium" style={{ color: status.color }}>
                          {f.availableSpaces} left
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick actions */}
          <div>
            <h2 className="font-semibold text-[#0F172A] mb-3">Quick Actions</h2>
            <div className="grid grid-cols-4 gap-3">
              {[
                { icon: QrCode, label: 'My QR', color: '#0F4C81', action: () => push('session') },
                { icon: Receipt, label: 'Receipt', color: '#2E8B57', action: () => push('receipt') },
                { icon: Navigation, label: 'Navigate', color: '#7C3AED', action: () => {} },
                { icon: Phone, label: 'Support', color: '#B45309', action: () => {} },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className="flex flex-col items-center gap-2 p-3 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: item.color + '18' }}
                  >
                    <item.icon size={18} style={{ color: item.color }} />
                  </div>
                  <span className="text-xs text-gray-600 font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderExplore() {
    const filters = [
      { id: 'nearest', label: 'Nearest' },
      { id: 'cheapest', label: 'Cheapest' },
      { id: 'available', label: 'Most Available' },
      { id: 'open', label: 'Open Now' },
      { id: 'covered', label: 'Covered' },
      { id: 'security', label: 'Security' },
    ];
    let facilities = [...PARKING_FACILITIES];
    if (exploreFilter === 'cheapest') facilities.sort((a, b) => a.pricePerHour - b.pricePerHour);
    else if (exploreFilter === 'available') facilities.sort((a, b) => b.availableSpaces - a.availableSpaces);
    else if (exploreFilter === 'covered') facilities = facilities.filter((f) => f.type === 'covered');
    else if (exploreFilter === 'security') facilities = facilities.filter((f) => f.hasSecurity);
    else facilities.sort((a, b) => a.distanceKm - b.distanceKm);

    return (
      <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
        {/* Search bar */}
        <div className="bg-white px-4 pt-12 pb-3 border-b border-gray-100 sticky top-0 z-10 shadow-sm">
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search parking in Kampala..."
              className="w-full bg-[#F8FAFC] rounded-xl pl-9 pr-10 py-2.5 text-sm outline-none border border-gray-100"
            />
            <button className="absolute right-3 top-1/2 -translate-y-1/2">
              <Filter size={16} className="text-gray-400" />
            </button>
          </div>
          {/* View toggle */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'list' ? 'bg-white text-[#0F4C81] shadow-sm' : 'text-gray-500'}`}
              >
                <List size={14} /> List
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'map' ? 'bg-white text-[#0F4C81] shadow-sm' : 'text-gray-500'}`}
              >
                <Map size={14} /> Map
              </button>
            </div>
            <span className="text-sm text-gray-500">{facilities.length} places</span>
          </div>
          {/* Filters */}
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => setExploreFilter(f.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${exploreFilter === f.id ? 'bg-[#0F4C81] text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Map view */}
        {viewMode === 'map' && (
          <div className="relative h-64 bg-gray-200 border-b border-gray-200">
            <LeafletMap
              facilities={dbFacilities.map((f: any) => ({
                id: f.id,
                name: f.name,
                latitude: f.latitude,
                longitude: f.longitude,
                availableSpaces: f.available_spaces,
                totalSpaces: f.total_spaces,
              }))}
              selectedId={mapSelectedId}
              onMarkerClick={(id) => {
                setMapSelectedId(id);
                const f = dbFacilities.find((p: any) => p.id === id);
                if (f) setSelectedFacility(f);
              }}
            />
            {/* Legend */}
            <div className="absolute bottom-3 left-3 flex gap-2" style={{ zIndex: 1000 }}>
              {[{ color: '#16A34A', label: 'Available' }, { color: '#F59E0B', label: 'Limited' }, { color: '#DC2626', label: 'Full' }].map((l) => (
                <div key={l.label} className="flex items-center gap-1 bg-white rounded-full px-2 py-1 shadow-sm">
                  <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                  <span className="text-xs text-gray-600">{l.label}</span>
                </div>
              ))}
            </div>
            {/* Selected facility card */}
            {selectedFacility && mapSelectedId && (
              <div
                className="absolute bottom-3 right-3 left-16 bg-white rounded-xl shadow-lg p-3 cursor-pointer"
                style={{ zIndex: 1000 }}
                onClick={() => push('detail')}
              >
                <p className="font-semibold text-sm text-[#0F172A] truncate">{selectedFacility.name}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-gray-500">{(selectedFacility as any).available_spaces || (selectedFacility as any).availableSpaces} spaces · {formatUGX((selectedFacility as any).price_per_hour || (selectedFacility as any).pricePerHour)}/hr</span>
                  <ChevronRight size={14} className="text-[#0F4C81]" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* List */}
        <div className="px-4 py-3 space-y-3">
          {facilities.map((f) => {
            const status = getAvailabilityStatus(f);
            return (
              <div
                key={f.id}
                className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => openDetail(f)}
              >
                <img
                  src={f.image}
                  alt={f.name}
                  className="w-full h-32 object-cover"
                  style={{ background: '#E2E8F0' }}
                />
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-[#0F172A] truncate">{f.name}</h3>
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{ color: status.color, background: status.bg }}
                        >
                          {status.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
                        <MapPin size={12} /> {f.address}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Navigation size={11} /> {f.distanceKm} km
                        </span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock size={11} /> {f.etaMin} min away
                        </span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Star size={11} className="fill-[#F4B400] text-[#F4B400]" /> {f.rating} ({f.reviewCount})
                        </span>
                      </div>
                    </div>
                    <div className="text-right ml-3 flex-shrink-0">
                      <p className="font-bold text-[#0F4C81]">{formatUGX(f.pricePerHour)}</p>
                      <p className="text-xs text-gray-400">per hour</p>
                    </div>
                  </div>
                  {/* Space bar */}
                  <div className="mt-3 pt-3 border-t border-gray-50">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>{f.availableSpaces} of {f.totalSpaces} spaces free</span>
                      <span style={{ color: status.color }}>{Math.round((f.availableSpaces / f.totalSpaces) * 100)}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(f.availableSpaces / f.totalSpaces) * 100}%`,
                          background: status.color,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderDetail() {
    if (!selectedFacility) return null;
    const f = selectedFacility;
    const status = getAvailabilityStatus(f);
    const reviews = [
      { name: 'David K.', rating: 5, text: 'Very clean and secure. Staff were helpful. Will use again!', date: '2 days ago' },
      { name: 'Mary N.', rating: 4, text: 'Good location, reasonable prices. Parking was easy to find.', date: '1 week ago' },
      { name: 'John O.', rating: 4, text: 'Covered parking is a plus during the rainy season.', date: '2 weeks ago' },
    ];
    return (
      <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
        {/* Header image */}
        <div className="relative">
          <img src={f.image} alt={f.name} className="w-full h-48 object-cover bg-gray-200" />
          <button
            onClick={() => setScreen(activeTab as Screen)}
            className="absolute top-12 left-4 w-9 h-9 bg-white rounded-full shadow-md flex items-center justify-center"
          >
            <ArrowLeft size={18} className="text-gray-700" />
          </button>
        </div>

        <div className="px-4 py-5 space-y-5">
          {/* Title */}
          <div>
            <div className="flex items-start justify-between">
              <h1 className="text-xl font-bold text-[#0F172A] flex-1 pr-3">{f.name}</h1>
              <span
                className="text-sm font-semibold px-3 py-1 rounded-full flex-shrink-0"
                style={{ color: status.color, background: status.bg }}
              >
                {status.label}
              </span>
            </div>
            <p className="text-gray-500 text-sm mt-1 flex items-center gap-1">
              <MapPin size={14} /> {f.address}
            </p>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5">
                <Star size={14} className="fill-[#F4B400] text-[#F4B400]" />
                <span className="font-semibold text-sm">{f.rating}</span>
                <span className="text-gray-400 text-sm">({f.reviewCount} reviews)</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                <Clock size={14} /> {f.hours}
              </div>
            </div>
          </div>

          {/* Availability */}
          <div className="bg-[#F8FAFC] rounded-xl p-4 border border-gray-100">
            <h3 className="font-semibold text-sm mb-3">Availability</h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-2xl font-bold" style={{ color: status.color }}>{f.availableSpaces}</div>
                <div className="text-xs text-gray-500 mt-0.5">Available</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-700">{f.totalSpaces - f.availableSpaces}</div>
                <div className="text-xs text-gray-500 mt-0.5">Occupied</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[#0F4C81]">{f.totalSpaces}</div>
                <div className="text-xs text-gray-500 mt-0.5">Total</div>
              </div>
            </div>
            <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(f.availableSpaces / f.totalSpaces) * 100}%`,
                  background: status.color,
                }}
              />
            </div>
          </div>

          {/* Pricing */}
          <div>
            <h3 className="font-semibold mb-3">Pricing</h3>
            <div className="space-y-2">
              {[
                { period: 'Per Hour', price: f.pricePerHour },
                { period: 'Per Day (max)', price: f.pricePerHour * 8 },
                { period: 'Overnight', price: Math.round(f.pricePerHour * 5.5) },
              ].map((p) => (
                <div key={p.period} className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-600">{p.period}</span>
                  <span className="font-semibold text-[#0F172A]">{formatUGX(p.price)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Amenities */}
          <div>
            <h3 className="font-semibold mb-3">Amenities</h3>
            <div className="flex flex-wrap gap-2">
              {f.amenities.map((a) => (
                <div key={a} className="flex items-center gap-1.5 bg-[#EFF6FF] text-[#0F4C81] text-sm px-3 py-1.5 rounded-full">
                  <Check size={12} />
                  {a}
                </div>
              ))}
            </div>
          </div>

          {/* Security */}
          {f.hasSecurity && (
            <div className="flex items-center gap-3 bg-green-50 rounded-xl p-3 border border-green-100">
              <Shield size={20} className="text-[#2E8B57] flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-800">Security Available</p>
                <p className="text-xs text-green-600">24/7 guard + CCTV monitoring</p>
              </div>
            </div>
          )}

          {/* Reviews */}
          <div>
            <h3 className="font-semibold mb-3">Recent Reviews</h3>
            <div className="space-y-3">
              {reviews.map((r) => (
                <div key={r.name} className="bg-white rounded-xl p-3 border border-gray-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#EFF6FF] flex items-center justify-center">
                        <span className="text-xs font-semibold text-[#0F4C81]">{r.name[0]}</span>
                      </div>
                      <span className="text-sm font-medium">{r.name}</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: r.rating }).map((_, i) => (
                        <Star key={i} size={11} className="fill-[#F4B400] text-[#F4B400]" />
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">{r.text}</p>
                  <p className="text-xs text-gray-400 mt-1">{r.date}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTAs */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-3 flex gap-3 mb-16 md:mb-0">
          <button
            className="flex-1 flex items-center justify-center gap-2 py-3 border border-[#0F4C81] text-[#0F4C81] rounded-xl font-semibold text-sm"
          >
            <Navigation size={16} /> Navigate
          </button>
          <button
            onClick={() => {
              if (f.availableSpaces > 0) {
                setReserveStep(1);
                push('reserve');
              }
            }}
            disabled={f.availableSpaces === 0}
            className="flex-2 flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: '#0F4C81', flex: 2 }}
          >
            {f.availableSpaces === 0 ? 'No Spaces' : 'Reserve Space'}
          </button>
        </div>
      </div>
    );
  }

  function renderReserve() {
    if (!selectedFacility) return null;
    const f = selectedFacility;
    const totalCost = f.pricePerHour * reserveDuration;
    const times = ['8:00 AM', '9:00 AM', '10:00 AM', '10:30 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM'];

    const steps = ['Vehicle', 'Date & Time', 'Duration', 'Review', 'Confirm'];

    return (
      <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4 sticky top-0 z-10">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setScreen('detail')} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center">
              <ArrowLeft size={18} className="text-gray-700" />
            </button>
            <div>
              <h2 className="font-semibold text-[#0F172A]">Reserve Space</h2>
              <p className="text-sm text-gray-500">{f.name}</p>
            </div>
          </div>
          {/* Step indicator */}
          <div className="flex items-center gap-1">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center flex-1">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                    i + 1 < reserveStep
                      ? 'bg-[#2E8B57] text-white'
                      : i + 1 === reserveStep
                      ? 'bg-[#0F4C81] text-white'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {i + 1 < reserveStep ? <Check size={12} /> : i + 1}
                </div>
                {i < steps.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-1 ${i + 1 < reserveStep ? 'bg-[#2E8B57]' : 'bg-gray-100'}`} />
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">Step {reserveStep}: {steps[reserveStep - 1]}</p>
        </div>

        <div className="px-4 py-5">
          {reserveStep === 1 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-[#0F172A]">Select Vehicle</h3>
              {USER_VEHICLES.map((v) => (
                <div
                  key={v.id}
                  onClick={() => setReserveVehicle(v.id)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${reserveVehicle === v.id ? 'border-[#0F4C81] bg-[#EFF6FF]' : 'border-gray-100 bg-white'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${reserveVehicle === v.id ? 'bg-[#0F4C81]' : 'bg-gray-100'}`}>
                      <Car size={20} className={reserveVehicle === v.id ? 'text-white' : 'text-gray-500'} />
                    </div>
                    <div>
                      <p className="font-semibold text-[#0F172A]">{v.plate}</p>
                      <p className="text-sm text-gray-500">{v.year} {v.make} {v.model} · {v.color}</p>
                    </div>
                    {reserveVehicle === v.id && <Check size={18} className="text-[#0F4C81] ml-auto" />}
                  </div>
                </div>
              ))}
              <button
                onClick={() => setShowAddVehicleModal(true)}
                className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors"
              >
                <Plus size={16} /> Add New Vehicle
              </button>
            </div>
          )}

          {reserveStep === 2 && (
            <div className="space-y-5">
              <div>
                <h3 className="font-semibold text-[#0F172A] mb-3">Select Date</h3>
                <div
                  onClick={() => setShowDatePickerModal(true)}
                  className="bg-white border border-gray-100 rounded-xl p-4 text-center cursor-pointer hover:bg-slate-55 transition-colors"
                >
                  <p className="font-semibold text-[#0F4C81] text-lg">{reserveDate}</p>
                  <p className="text-sm text-gray-400 mt-1">Tap to change date</p>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-[#0F172A] mb-3">Select Arrival Time</h3>
                <div className="grid grid-cols-3 gap-2">
                  {times.map((t) => (
                    <button
                      key={t}
                      onClick={() => setReserveTime(t)}
                      className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${reserveTime === t ? 'bg-[#0F4C81] text-white' : 'bg-gray-50 text-gray-700 border border-gray-100'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {reserveStep === 3 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-[#0F172A]">Select Duration</h3>
              {[1, 2, 3, 4, 6, 8].map((h) => (
                <div
                  key={h}
                  onClick={() => setReserveDuration(h)}
                  className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${reserveDuration === h ? 'border-[#0F4C81] bg-[#EFF6FF]' : 'border-gray-100 bg-white'}`}
                >
                  <div>
                    <p className="font-semibold text-[#0F172A]">{h} {h === 1 ? 'Hour' : 'Hours'}</p>
                    <p className="text-sm text-gray-500">Until {reserveTime.replace('AM', '').replace('PM', '')} + {h}h</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#0F4C81]">{formatUGX(f.pricePerHour * h)}</p>
                    {reserveDuration === h && <Check size={16} className="text-[#0F4C81] ml-auto mt-1" />}
                  </div>
                </div>
              ))}
            </div>
          )}

          {reserveStep === 4 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-[#0F172A]">Review Booking</h3>
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="p-4 space-y-3">
                  {[
                    { label: 'Facility', value: f.name },
                    { label: 'Address', value: f.address },
                    { label: 'Vehicle', value: USER_VEHICLES.find(v => v.id === reserveVehicle)?.plate || '' },
                    { label: 'Date', value: reserveDate },
                    { label: 'Arrival', value: reserveTime },
                    { label: 'Duration', value: `${reserveDuration} hour${reserveDuration > 1 ? 's' : ''}` },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-1">
                      <span className="text-sm text-gray-500">{item.label}</span>
                      <span className="text-sm font-medium text-[#0F172A]">{item.value}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                    <span className="font-semibold text-[#0F172A]">Total Amount</span>
                    <span className="font-bold text-[#0F4C81] text-lg">{formatUGX(totalCost)}</span>
                  </div>
                </div>
              </div>
              <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> Payment is collected at checkout. You can cancel up to 30 minutes before arrival.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-3 flex gap-3 mb-16 md:mb-0">
          {reserveStep > 1 && (
            <button
              onClick={() => setReserveStep((s) => s - 1)}
              className="px-5 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium text-sm"
            >
              Back
            </button>
          )}
          <button
            onClick={async () => {
              if (reserveStep < 4) {
                setReserveStep((s) => s + 1);
              } else {
                try {
                  const arrivalDateTime = new Date();
                  const [time, modifier] = reserveTime.split(' ');
                  let [hours, minutes] = time.split(':').map(Number);
                  if (modifier === 'PM' && hours < 12) hours += 12;
                  if (modifier === 'AM' && hours === 12) hours = 0;
                  arrivalDateTime.setHours(hours, minutes, 0, 0);

                  const res = await createReservationMutation.mutateAsync({
                    facilityId: selectedFacility?.id,
                    vehicleId: reserveVehicle,
                    arrivalTime: arrivalDateTime.toISOString(),
                    durationHours: reserveDuration,
                  });

                  setConfirmedResId(res.code);
                  setConfirmedResToken(res.qr_code_token);
                  push('confirmed');
                } catch (err: any) {
                  alert(err.response?.data?.message || 'Failed to create reservation');
                }
              }
            }}
            disabled={createReservationMutation.isPending}
            className="flex-1 py-3 bg-[#0F4C81] text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
          >
            {createReservationMutation.isPending ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : reserveStep === 4 ? (
              'Confirm Reservation'
            ) : (
              'Continue'
            )}
          </button>
        </div>
      </div>
    );
  }

  function renderConfirmed() {
    return (
      <div className="flex-1 overflow-y-auto pb-20 md:pb-0 flex flex-col items-center px-4 pt-16">
        {/* Success icon */}
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <Check size={36} className="text-[#2E8B57]" />
        </div>
        <h2 className="text-xl font-bold text-[#0F172A] text-center mb-1">Reservation Confirmed!</h2>
        <p className="text-gray-500 text-center text-sm mb-6">Your parking space is reserved and ready.</p>

        {/* QR Code */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 w-full max-w-xs text-center">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Show at Entry</p>
          <div className="flex justify-center mb-4">
            <QRCodeDisplay value={confirmedResToken || confirmedResId} />
          </div>
          <p className="font-mono font-bold text-[#0F172A] text-sm">{confirmedResId}</p>
          <p className="text-xs text-gray-400 mt-1">Scan this code at the gate</p>
        </div>

        {/* Summary */}
        <div className="w-full mt-5 space-y-2">
          {[
            { icon: MapPin, label: selectedFacility?.name || '', color: '#0F4C81' },
            { icon: Calendar, label: reserveDate, color: '#7C3AED' },
            { icon: Clock, label: `${reserveTime} · ${reserveDuration}h`, color: '#2E8B57' },
            { icon: Car, label: USER_VEHICLES.find(v => v.id === reserveVehicle)?.plate || '', color: '#B45309' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3 bg-white rounded-xl p-3 border border-gray-100">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: item.color + '18' }}>
                <item.icon size={16} style={{ color: item.color }} />
              </div>
              <span className="text-sm font-medium text-[#0F172A]">{item.label}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-3 w-full pb-4">
          <button
            onClick={() => changeTab('reservations')}
            className="flex-1 py-3 border border-[#0F4C81] text-[#0F4C81] rounded-xl font-medium text-sm"
          >
            View Bookings
          </button>
          <button
            onClick={() => changeTab('home')}
            className="flex-1 py-3 bg-[#0F4C81] text-white rounded-xl font-semibold text-sm"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  function renderSession() {
    if (!activeSession) {
      return (
        <div className="flex-1 overflow-y-auto pb-20 md:pb-0 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <Car size={28} className="text-gray-400" />
          </div>
          <h3 className="font-semibold text-lg text-[#0F172A]">No Active Parking Session</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-xs">
            Once you check in at a facility, your live parking timer and occupancy tracking will appear here.
          </p>
          <button
            onClick={() => changeTab('home')}
            className="mt-6 px-4 py-2 bg-[#0F4C81] text-white text-sm font-semibold rounded-xl"
          >
            Back to Home
          </button>
        </div>
      );
    }

    const duration = Math.floor(sessionSeconds / 3600);
    const minutes = Math.floor((sessionSeconds % 3600) / 60);

    return (
      <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="bg-[#0F4C81] px-5 pt-12 pb-8 text-white">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => changeTab('home')} className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center">
              <ArrowLeft size={18} className="text-white" />
            </button>
            <h2 className="font-semibold">Active Session</h2>
          </div>
          {/* Timer */}
          <div className="text-center">
            <div className="text-6xl font-bold tracking-tight text-[#F4B400] mono mb-2">
              {formatTime(sessionSeconds)}
            </div>
            <p className="text-blue-200 text-sm">Session duration</p>
          </div>
        </div>

        <div className="px-4 py-5 space-y-4">
          {/* Facility info */}
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-[#EFF6FF] rounded-xl flex items-center justify-center">
                <MapPin size={18} className="text-[#0F4C81]" />
              </div>
              <div>
                <p className="font-semibold text-[#0F172A]">{activeSession.facilityName}</p>
                <p className="text-sm text-gray-500">
                  {activeSession.spaceNumber ? `Space ${activeSession.spaceNumber}` : 'Auto Assigned'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center pt-3 border-t border-gray-50">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Check-In</p>
                <p className="text-sm font-semibold text-[#0F172A]">
                  {new Date(activeSession.checkin_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Vehicle</p>
                <p className="text-sm font-semibold text-[#0F172A]">{activeSession.vehicle_plate}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Status</p>
                <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Active</span>
              </div>
            </div>
          </div>

          {/* Charges */}
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-[#0F172A]">Estimated Charges</h3>
              <span className="text-xs text-gray-400">@ UGX {hourlyRate.toLocaleString()}/hr</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Parking fee</span>
                <span className="font-medium">{formatUGX(sessionCharges)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Service charge</span>
                <span className="font-medium">{formatUGX(Math.round(sessionCharges * 0.05))}</span>
              </div>
              <div className="pt-2 border-t border-gray-50 flex justify-between">
                <span className="font-semibold">Estimated Total</span>
                <span className="font-bold text-[#0F4C81]">{formatUGX(Math.round(sessionCharges * 1.05))}</span>
              </div>
            </div>
          </div>

          {/* QR code */}
          <div className="bg-white rounded-xl p-4 border border-gray-100 text-center">
            <p className="text-sm text-gray-500 mb-3">Show for checkout</p>
            <div className="flex justify-center">
              <QRCodeDisplay value={activeSession.id} />
            </div>
            <p className="font-mono text-xs text-gray-400 mt-2">{activeSession.id.substring(0, 8).toUpperCase()}</p>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => push('checkout')}
              className="flex flex-col items-center gap-2 p-3 bg-[#0F4C81] text-white rounded-xl"
            >
              <Timer size={20} />
              <span className="text-xs font-medium">Extend</span>
            </button>
            <button
              onClick={() => push('checkout')}
              className="flex flex-col items-center gap-2 p-3 bg-white border border-gray-100 text-[#0F4C81] rounded-xl"
            >
              <Receipt size={20} />
              <span className="text-xs font-medium text-gray-700">Receipt</span>
            </button>
            <button className="flex flex-col items-center gap-2 p-3 bg-white border border-gray-100 rounded-xl">
              <Phone size={20} className="text-gray-600" />
              <span className="text-xs font-medium text-gray-700">Support</span>
            </button>
          </div>

          <button
            onClick={() => push('checkout')}
            className="w-full py-3.5 bg-[#DC2626] text-white rounded-xl font-semibold flex items-center justify-center gap-2"
          >
            <X size={18} /> End Session & Checkout
          </button>
        </div>
      </div>
    );
  }

  function renderCheckout() {
    if (!activeSession) return null;
    const duration = Math.floor(sessionSeconds / 3600);
    const minutes = Math.floor((sessionSeconds % 3600) / 60);
    const charges = Math.round(sessionCharges * 1.05);

    return (
      <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setScreen('session')} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center">
              <ArrowLeft size={18} className="text-gray-700" />
            </button>
            <h2 className="font-semibold text-[#0F172A]">Checkout</h2>
          </div>
        </div>

        <div className="px-4 py-5 space-y-4">
          {/* Session summary */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h3 className="font-semibold mb-3">Session Summary</h3>
            {[
              { label: 'Facility', value: activeSession.facilityName },
              { label: 'Space', value: activeSession.spaceNumber ? `Space ${activeSession.spaceNumber}` : 'Auto Assigned' },
              { label: 'Vehicle', value: activeSession.vehicle_plate },
              { label: 'Check-in', value: new Date(activeSession.checkin_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
              { label: 'Check-out', value: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
              { label: 'Duration', value: `${duration}h ${minutes}m` },
            ].map((r) => (
              <div key={r.label} className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-sm text-gray-500">{r.label}</span>
                <span className="text-sm font-medium text-[#0F172A]">{r.value}</span>
              </div>
            ))}
            <div className="flex justify-between pt-3">
              <span className="font-semibold">Total</span>
              <span className="font-bold text-[#0F4C81] text-lg">{formatUGX(charges)}</span>
            </div>
          </div>

          {/* Payment method */}
          <div>
            <h3 className="font-semibold mb-3">Payment Method</h3>
            <div className="space-y-2">
              {[
                { id: 'mtn' as const, label: 'MTN Mobile Money', sub: '**** 4567', color: '#F4B400', textColor: '#0F172A' },
                { id: 'airtel' as const, label: 'Airtel Money', sub: '**** 8901', color: '#DC2626', textColor: '#fff' },
                { id: 'cash' as const, label: 'Cash', sub: 'Pay at exit', color: '#2E8B57', textColor: '#fff' },
              ].map((pm) => (
                <div
                  key={pm.id}
                  onClick={() => setPaymentMethod(pm.id)}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === pm.id ? 'border-[#0F4C81]' : 'border-gray-100 bg-white'}`}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: pm.color, color: pm.textColor }}
                  >
                    {pm.id === 'mtn' ? 'MTN' : pm.id === 'airtel' ? 'AIR' : '💵'}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-[#0F172A] text-sm">{pm.label}</p>
                    <p className="text-xs text-gray-500">{pm.sub}</p>
                  </div>
                  {paymentMethod === pm.id && <Check size={18} className="text-[#0F4C81]" />}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={async () => {
              try {
                await checkoutMutation.mutateAsync(activeSession.id);
                refetchSessions();
                push('receipt');
              } catch (err: any) {
                alert(err.response?.data?.message || 'Payment processing failed.');
              }
            }}
            disabled={checkoutMutation.isPending}
            className="w-full py-4 bg-[#0F4C81] text-white rounded-xl font-bold text-base flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <CreditCard size={18} /> {checkoutMutation.isPending ? 'Processing...' : `Pay ${formatUGX(charges)}`}
          </button>
        </div>
      </div>
    );
  }

  function renderReceipt() {
    const charges = Math.round(sessionCharges * 1.05);
    return (
      <div className="flex-1 overflow-y-auto pb-20 md:pb-0 flex flex-col items-center px-4 pt-10">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-3">
          <Check size={28} className="text-[#2E8B57]" />
        </div>
        <h2 className="text-xl font-bold text-[#0F172A] text-center">Payment Successful!</h2>
        <p className="text-gray-500 text-sm text-center mt-1 mb-6">Thank you for using Parka.</p>

        {/* Receipt card */}
        <div className="w-full max-w-xs bg-white rounded-2xl border border-gray-100 shadow-md overflow-hidden">
          <div className="bg-[#0F4C81] px-6 py-4 text-center">
            <div className="w-10 h-10 bg-[#F4B400] rounded-xl flex items-center justify-center mx-auto mb-2">
              <MapPin size={18} className="text-[#0F172A]" />
            </div>
            <p className="text-white font-bold">Parka Receipt</p>
            <p className="text-blue-200 text-xs mt-0.5">{activeSession?.facilityName || 'Garden City Parking'}</p>
          </div>
          <div className="px-5 py-4 space-y-2">
            {[
              { label: 'Amount Paid', value: formatUGX(charges) },
              { label: 'Payment Mode', value: paymentMethod.toUpperCase() },
              { label: 'Vehicle', value: activeSession?.vehicle_plate || 'UAB 456H' },
              { label: 'Space', value: activeSession?.spaceNumber ? `Space ${activeSession.spaceNumber}` : 'Auto' },
              { label: 'Receipt ID', value: `REC-${Math.floor(100000 + Math.random() * 900000)}` },
            ].map((r) => (
              <div key={r.label} className="flex justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                <span className="text-gray-400">{r.label}</span>
                <span className="font-medium text-[#0F172A]">{r.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 mt-6 w-full">
          <button className="flex-1 py-3 border border-[#0F4C81] text-[#0F4C81] rounded-xl font-medium text-sm">
            Share Receipt
          </button>
          <button
            onClick={() => {
              changeTab('home');
            }}
            className="flex-1 py-3 bg-[#0F4C81] text-white rounded-xl font-semibold text-sm"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  function renderReservations() {
    const tabs = ['upcoming', 'active', 'completed', 'cancelled'] as const;
    const filtered = RESERVATIONS.filter((r) => r.status === resTab);
    const statusColor = {
      upcoming: { color: '#7C3AED', bg: '#F5F3FF' },
      active: { color: '#16A34A', bg: '#F0FDF4' },
      completed: { color: '#64748B', bg: '#F8FAFC' },
      cancelled: { color: '#DC2626', bg: '#FEF2F2' },
    };

    return (
      <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-3 sticky top-0 z-10">
          <h2 className="font-bold text-lg text-[#0F172A] mb-3">My Reservations</h2>
          <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setResTab(t)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize flex-shrink-0 transition-colors ${resTab === t ? 'bg-[#0F4C81] text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="px-4 py-4 space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Calendar size={28} className="text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">No {resTab} reservations</p>
            </div>
          ) : (
            filtered.map((r) => {
              const sc = statusColor[r.status];
              return (
                <div key={r.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-[#0F172A]">{r.facilityName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{r.zone} · Space {r.spaceNumber}</p>
                    </div>
                    <span className="text-xs font-semibold px-2 py-1 rounded-full capitalize" style={{ color: sc.color, background: sc.bg }}>
                      {r.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-gray-500 mt-3 pt-3 border-t border-gray-50">
                    <div>
                      <p className="text-gray-400 mb-0.5">Date</p>
                      <p className="font-medium text-[#0F172A]">{r.date}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 mb-0.5">Time</p>
                      <p className="font-medium text-[#0F172A]">{r.arrivalTime}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 mb-0.5">Amount</p>
                      <p className="font-medium text-[#0F4C81]">{formatUGX(r.amount)}</p>
                    </div>
                  </div>
                  {r.status === 'active' && (
                    <button onClick={() => push('session')} className="mt-3 w-full py-2 bg-[#EFF6FF] text-[#0F4C81] rounded-lg text-sm font-medium">
                      View Active Session
                    </button>
                  )}
                  {r.status === 'upcoming' && (
                    <div className="mt-3 flex gap-2">
                      <button 
                        onClick={() => {
                          setSelectedFacility(dbFacilities.find((f: any) => f.id === r.facility_id) || null);
                          setConfirmedResId(r.code);
                          setConfirmedResToken(r.qr_code_token);
                          push('confirmed');
                        }}
                        className="flex-1 py-2 bg-[#EFF6FF] text-[#0F4C81] rounded-lg text-sm font-medium"
                      >
                        View QR
                      </button>
                      <button 
                        onClick={async () => {
                          if (confirm('Are you sure you want to cancel this reservation?')) {
                            try {
                              await cancelReservationMutation.mutateAsync(r.id);
                            } catch (err: any) {
                              alert(err.response?.data?.message || 'Failed to cancel reservation');
                            }
                          }
                        }}
                        className="flex-1 py-2 border border-red-100 text-red-500 rounded-lg text-sm font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  function renderNotifications() {
    const groups = [
      { label: 'Today', items: NOTIFICATIONS.slice(0, 2) },
      { label: 'Yesterday', items: NOTIFICATIONS.slice(2, 4) },
      { label: 'Earlier', items: NOTIFICATIONS.slice(4) },
    ];
    const typeIcon = {
      confirm: { icon: Check, color: '#16A34A', bg: '#F0FDF4' },
      reminder: { icon: Clock, color: '#7C3AED', bg: '#F5F3FF' },
      checkin: { icon: MapPin, color: '#0F4C81', bg: '#EFF6FF' },
      checkout: { icon: Timer, color: '#B45309', bg: '#FFFBEB' },
      payment: { icon: CreditCard, color: '#2E8B57', bg: '#F0FDF4' },
      facility: { icon: AlertCircle, color: '#F59E0B', bg: '#FFFBEB' },
      system: { icon: Zap, color: '#64748B', bg: '#F8FAFC' },
    };

    return (
      <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg text-[#0F172A]">Notifications</h2>
            <button className="text-sm text-[#0F4C81] font-medium">Mark all read</button>
          </div>
        </div>
        <div className="px-4 py-3 space-y-5">
          {groups.map((g) => (
            <div key={g.label}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{g.label}</p>
              <div className="space-y-2">
                {g.items.map((n) => {
                  const tc = typeIcon[n.type] || typeIcon.system;
                  const IconComp = tc.icon;
                  return (
                    <div key={n.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${!n.read ? 'bg-[#EFF6FF] border-blue-100' : 'bg-white border-gray-100'}`}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: tc.bg }}>
                        <IconComp size={16} style={{ color: tc.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-sm font-medium ${!n.read ? 'text-[#0F172A]' : 'text-gray-700'}`}>{n.title}</p>
                          {!n.read && <div className="w-2 h-2 rounded-full bg-[#0F4C81] flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.body}</p>
                        <p className="text-xs text-gray-400 mt-1">{n.time}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderProfile() {
    const initials = user?.name ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase() : 'DR';
    return (
      <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
        {/* Header */}
        <div className="bg-[#0F4C81] px-5 pt-12 pb-8 text-center">
          <div className="w-20 h-20 rounded-full bg-[#F4B400] flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl font-bold text-[#0F172A]">{initials}</span>
          </div>
          <h2 className="text-white font-bold text-xl">{user?.name || 'Driver'}</h2>
          <p className="text-blue-200 text-sm mt-1">{user?.phone || ''}</p>
          <p className="text-blue-200 text-sm">{user?.email || ''}</p>
          <div className="flex justify-center gap-6 mt-4">
            <div className="text-center">
              <p className="text-[#F4B400] font-bold text-xl">{dbReservations.length}</p>
              <p className="text-blue-200 text-xs">Sessions</p>
            </div>
            <div className="text-center">
              <p className="text-[#F4B400] font-bold text-xl">4.9</p>
              <p className="text-blue-200 text-xs">Rating</p>
            </div>
            <div className="text-center">
              <p className="text-[#F4B400] font-bold text-xl">UGX 10K</p>
              <p className="text-blue-200 text-xs">Total Spent</p>
            </div>
          </div>
        </div>

        <div className="px-4 py-5 space-y-5">
          {/* Vehicles */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-[#0F172A]">My Vehicles</h3>
              <button
                onClick={() => setShowAddVehicleModal(true)}
                className="text-sm text-[#0F4C81] font-medium flex items-center gap-1"
              >
                <Plus size={14} /> Add
              </button>
            </div>
            {USER_VEHICLES.map((v) => (
              <div key={v.id} className="flex items-center gap-3 bg-white rounded-xl p-3 border border-gray-100 mb-2">
                <div className="w-10 h-10 bg-[#EFF6FF] rounded-xl flex items-center justify-center">
                  <Car size={18} className="text-[#0F4C81]" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[#0F172A] text-sm">{v.plate}</p>
                  <p className="text-xs text-gray-500">{v.year} {v.make} {v.model} · {v.color}</p>
                </div>
                <ChevronRight size={16} className="text-gray-400" />
              </div>
            ))}
          </div>

          {/* Payment methods */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-[#0F172A]">Payment Methods</h3>
              <button
                onClick={() => setShowAddPaymentModal(true)}
                className="text-sm text-[#0F4C81] font-medium"
              >
                + Add
              </button>
            </div>
            {[
              { label: 'MTN Mobile Money', sub: user?.phone || '+256 701 234 567', color: '#F4B400', tc: '#0F172A', badge: 'Default' },
              { label: 'Airtel Money', sub: '', color: '#DC2626', tc: '#fff', badge: null },
              ...customPaymentMethods.map((pm) => ({
                label: pm.provider === 'mtn' ? 'MTN Mobile Money' : 'Airtel Money',
                sub: pm.phone,
                color: pm.provider === 'mtn' ? '#F4B400' : '#DC2626',
                tc: pm.provider === 'mtn' ? '#0F172A' : '#fff',
                badge: null
              }))
            ].map((pm) => (
              <div key={pm.label + pm.sub} className="flex items-center gap-3 bg-white rounded-xl p-3 border border-gray-100 mb-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold font-mono" style={{ background: pm.color, color: pm.tc }}>
                  {pm.label.split(' ')[0].slice(0, 3).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm text-[#0F172A]">{pm.label}</p>
                    {pm.badge && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">{pm.badge}</span>}
                  </div>
                  <p className="text-xs text-gray-500">{pm.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Settings links */}
          <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
            {[
              { icon: User, label: 'Personal Information' },
              { icon: Shield, label: 'Security & Privacy' },
              { icon: Bell, label: 'Notification Settings' },
              { icon: History, label: 'Parking History' },
              { icon: Wallet, label: 'Billing & Payments' },
              { icon: Settings, label: 'App Settings' },
            ].map((item) => (
              <div
                key={item.label}
                onClick={() => setActiveSettingsDrawer(item.label)}
                className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <item.icon size={18} className="text-gray-500" />
                <span className="flex-1 text-sm font-medium text-[#0F172A]">{item.label}</span>
                <ChevronRight size={16} className="text-gray-300" />
              </div>
            ))}
          </div>

          {/* Sign out */}
          <button
            onClick={async () => {
              await logout();
              navigate('/');
            }}
            className="w-full flex items-center justify-center gap-2 py-3 border border-red-100 text-red-500 rounded-xl font-medium text-sm"
          >
            <LogOut size={16} /> Sign Out
          </button>

          <p className="text-center text-xs text-gray-400 pb-2">Parka v1.0.0 · Kampala, Uganda</p>
        </div>
      </div>
    );
  }

  // --- Sidebar (desktop) & bottom nav (mobile) ---
  const contentMap: Record<Screen, ReactElement> = {
    home: renderHome(),
    explore: renderExplore(),
    detail: renderDetail() || <div />,
    reserve: renderReserve() || <div />,
    confirmed: renderConfirmed(),
    session: renderSession(),
    checkout: renderCheckout(),
    receipt: renderReceipt(),
    reservations: renderReservations(),
    notifications: renderNotifications(),
    profile: renderProfile(),
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-[#0A3660] flex-shrink-0">
        <div className="px-5 pt-8 pb-6 border-b border-white/10">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 bg-[#F4B400] rounded-lg flex items-center justify-center">
              <MapPin size={16} className="text-[#0F172A]" />
            </div>
            <span className="text-white font-bold text-lg tracking-tight">Parka</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#F4B400] flex items-center justify-center">
              <span className="font-bold text-sm text-[#0F172A]">
                {user?.name ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase() : 'DR'}
              </span>
            </div>
            <div>
              <p className="text-white text-sm font-medium">{user?.name || 'Driver'}</p>
              <p className="text-blue-300 text-xs">Driver</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.tab;
            return (
              <button
                key={item.tab}
                onClick={() => changeTab(item.tab)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-[#F4B400] text-[#0F172A]' : 'text-blue-200 hover:bg-white/10 hover:text-white'}`}
              >
                <Icon size={18} />
                {item.label}
                {item.tab === 'notifications' && unreadCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="px-3 pb-6 border-t border-white/10 pt-4">
          <button
            onClick={() => navigate('/')}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-blue-300 hover:text-white transition-colors rounded-xl hover:bg-white/10"
          >
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {contentMap[screen]}

        {/* Bottom nav (mobile) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50">
          <div className="flex items-center justify-around px-2 py-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.tab && ['home', 'explore', 'reservations', 'notifications', 'profile'].includes(screen);
              return (
                <button
                  key={item.tab}
                  onClick={() => changeTab(item.tab)}
                  className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl relative transition-colors ${isActive ? 'text-[#0F4C81]' : 'text-gray-400'}`}
                >
                  <Icon size={22} />
                  <span className="text-xs font-medium">{item.label}</span>
                  {item.tab === 'notifications' && unreadCount > 0 && (
                    <span className="absolute top-0 right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center leading-none">
                      {unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </main>

      {/* Add Vehicle Modal */}
      {showAddVehicleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 animate-fade-in relative">
            <button
              onClick={() => setShowAddVehicleModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"
            >
              <X size={16} />
            </button>
            <h3 className="font-bold text-lg text-[#0F172A] mb-4">Register New Vehicle</h3>
            <form onSubmit={handleAddVehicle} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Plate Number *</label>
                <input
                  type="text"
                  placeholder="e.g. UAB 456H"
                  required
                  value={newVehiclePlate}
                  onChange={(e) => setNewVehiclePlate(e.target.value.toUpperCase())}
                  className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-slate-50 focus:ring-1 focus:ring-[#0F4C81] outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Make *</label>
                  <input
                    type="text"
                    placeholder="e.g. Toyota"
                    required
                    value={newVehicleMake}
                    onChange={(e) => setNewVehicleMake(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-slate-50 focus:ring-1 focus:ring-[#0F4C81] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Model *</label>
                  <input
                    type="text"
                    placeholder="e.g. Land Cruiser"
                    required
                    value={newVehicleModel}
                    onChange={(e) => setNewVehicleModel(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-slate-50 focus:ring-1 focus:ring-[#0F4C81] outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Color</label>
                  <input
                    type="text"
                    placeholder="e.g. White"
                    value={newVehicleColor}
                    onChange={(e) => setNewVehicleColor(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-slate-50 focus:ring-1 focus:ring-[#0F4C81] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Year</label>
                  <input
                    type="number"
                    placeholder="e.g. 2020"
                    value={newVehicleYear}
                    onChange={(e) => setNewVehicleYear(Number(e.target.value))}
                    className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-slate-50 focus:ring-1 focus:ring-[#0F4C81] outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Vehicle Type</label>
                <select
                  value={newVehicleType}
                  onChange={(e: any) => setNewVehicleType(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-slate-50 focus:ring-1 focus:ring-[#0F4C81] outline-none text-gray-700"
                >
                  <option value="sedan">Sedan</option>
                  <option value="suv">SUV</option>
                  <option value="truck">Truck</option>
                  <option value="motorcycle">Motorcycle</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={createVehicleMutation.isPending}
                className="w-full mt-4 py-3 bg-[#0F4C81] text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2 hover:bg-[#0A3660] transition-colors"
              >
                {createVehicleMutation.isPending ? 'Registering...' : 'Register Vehicle'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Date Picker Modal */}
      {showDatePickerModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 relative">
            <button
              onClick={() => setShowDatePickerModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"
            >
              <X size={16} />
            </button>
            <h3 className="font-bold text-lg text-[#0F172A] mb-4">Select Reservation Date</h3>
            <div className="grid grid-cols-1 gap-2.5">
              {[0, 1, 2, 3, 4, 5, 6].map((offset) => {
                const d = new Date();
                d.setDate(d.getDate() + offset);
                const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
                return (
                  <button
                    key={offset}
                    onClick={() => {
                      setReserveDate(dayLabel);
                      setShowDatePickerModal(false);
                    }}
                    className={`p-3 rounded-xl border text-sm font-semibold text-left transition-colors flex items-center justify-between ${
                      reserveDate === dayLabel
                        ? 'border-[#0F4C81] bg-[#EFF6FF] text-[#0F4C81]'
                        : 'border-gray-100 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span>{dayLabel}</span>
                    {reserveDate === dayLabel && <Check size={16} />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Add Payment Modal */}
      {showAddPaymentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 relative">
            <button
              onClick={() => setShowAddPaymentModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"
            >
              <X size={16} />
            </button>
            <h3 className="font-bold text-lg text-[#0F172A] mb-4">Add Payment Method</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newPaymentPhone) return;
                setCustomPaymentMethods((prev) => [
                  ...prev,
                  { provider: newPaymentProvider, phone: newPaymentPhone }
                ]);
                setNewPaymentPhone('');
                setShowAddPaymentModal(false);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Mobile Money Provider</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewPaymentProvider('mtn')}
                    className={`flex-1 py-2.5 rounded-xl border text-sm font-bold text-center ${newPaymentProvider === 'mtn' ? 'border-[#F4B400] bg-amber-50 text-amber-800 font-mono' : 'border-gray-100 text-gray-500'}`}
                  >
                    MTN MoMo
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewPaymentProvider('airtel')}
                    className={`flex-1 py-2.5 rounded-xl border text-sm font-bold text-center ${newPaymentProvider === 'airtel' ? 'border-red-500 bg-red-50 text-red-800 font-mono' : 'border-gray-100 text-gray-500'}`}
                  >
                    Airtel Money
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="+256 701 234 567"
                  required
                  value={newPaymentPhone}
                  onChange={(e) => setNewPaymentPhone(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-slate-50 focus:ring-1 focus:ring-[#0F4C81] outline-none"
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-[#0F4C81] text-white font-semibold text-sm rounded-xl hover:bg-[#0A3660] transition-colors"
              >
                Add Method
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Settings Slide-over Drawer */}
      {activeSettingsDrawer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex justify-end">
          <div className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl p-6 relative overflow-y-auto">
            <button
              onClick={() => setActiveSettingsDrawer(null)}
              className="absolute top-6 left-6 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="mt-10 flex-1">
              {activeSettingsDrawer === 'Personal Information' && (
                <div className="space-y-6">
                  <h3 className="font-bold text-xl text-[#0F172A]">Personal Information</h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase">Driver Name</p>
                      <p className="text-sm font-semibold text-gray-700 mt-1">{user?.name || 'Driver'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase">Email Address</p>
                      <p className="text-sm font-semibold text-gray-700 mt-1">{user?.email || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase">Phone Number</p>
                      <p className="text-sm font-semibold text-gray-700 mt-1">{user?.phone || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase">Account Balance</p>
                      <p className="text-sm font-bold text-[#2E8B57] mt-1">UGX 25,000</p>
                    </div>
                  </div>
                </div>
              )}
              {activeSettingsDrawer === 'Security & Privacy' && (
                <div className="space-y-6">
                  <h3 className="font-bold text-xl text-[#0F172A]">Security & Privacy</h3>
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 border border-green-100 rounded-xl flex items-center gap-3">
                      <Shield className="text-[#2E8B57] flex-shrink-0" size={20} />
                      <div>
                        <p className="text-sm font-semibold text-green-800">Two-Factor Authentication</p>
                        <p className="text-xs text-green-600">Active (via Mobile Number)</p>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                      <p className="text-sm font-semibold text-gray-700">Account Status</p>
                      <p className="text-xs text-gray-500 mt-0.5">Verified Driver Profile</p>
                    </div>
                  </div>
                </div>
              )}
              {activeSettingsDrawer === 'Parking History' && (
                <div className="space-y-6">
                  <h3 className="font-bold text-xl text-[#0F172A]">Parking History</h3>
                  <div className="space-y-3">
                    {RESERVATIONS.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-8">No past reservations found.</p>
                    ) : (
                      RESERVATIONS.map((r: any) => (
                        <div key={r.id} className="p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
                          <div className="flex justify-between items-start mb-1.5">
                            <h4 className="font-semibold text-sm text-[#0F172A]">{r.facilityName}</h4>
                            <span className="text-xs font-bold text-[#0F4C81]">{formatUGX(r.amount)}</span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {r.date} · {r.arrivalTime} · {r.vehiclePlate}
                          </p>
                          <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-gray-50">
                            <span className="text-xs text-gray-400 font-mono">Code: {r.code}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold capitalize ${
                              r.status === 'completed' ? 'bg-green-50 text-green-700' :
                              r.status === 'active' ? 'bg-blue-50 text-blue-700' :
                              r.status === 'upcoming' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                            }`}>{r.status}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
              {activeSettingsDrawer === 'Billing & Payments' && (
                <div className="space-y-6">
                  <h3 className="font-bold text-xl text-[#0F172A]">Billing & Payments</h3>
                  <div className="space-y-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <p className="text-xs text-gray-400 font-semibold uppercase">Pending Invoices</p>
                      <p className="text-xl font-bold text-[#0F172A] mt-1">UGX 0</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <p className="text-xs text-gray-400 font-semibold uppercase">Default Wallet</p>
                      <p className="text-sm font-semibold text-gray-700 mt-1">MTN Mobile Money ({user?.phone || '+256 701 234 567'})</p>
                    </div>
                  </div>
                </div>
              )}
              {['Notification Settings', 'App Settings'].includes(activeSettingsDrawer) && (
                <div className="space-y-6">
                  <h3 className="font-bold text-xl text-[#0F172A]">{activeSettingsDrawer}</h3>
                  <div className="space-y-4">
                    {[
                      { label: 'Push Notifications', desc: 'Alert me about reservation starts' },
                      { label: 'Email Invoices', desc: 'Send receipts to my email' },
                      { label: 'Location Tracking', desc: 'Recommend nearby parking dynamically' }
                    ].map((opt) => (
                      <div key={opt.label} className="flex items-center justify-between p-3 border border-gray-50 rounded-xl hover:bg-slate-50/50">
                        <div>
                          <p className="text-sm font-semibold text-[#0F172A]">{opt.label}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                        </div>
                        <div className="w-9 h-5 bg-green-500 rounded-full flex items-center p-0.5 cursor-pointer">
                          <div className="w-4 h-4 bg-white rounded-full shadow-sm transform translate-x-4" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
