import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  ScanLine, LayoutDashboard, Car, LogOut, Check, X,
  Clock, User, MapPin, AlertCircle, Camera,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  useSessions,
  useCheckoutSession,
  useValidateQR,
  useCheckInDriver,
  useReservations,
  useFacilityAvailability,
} from '../../services/queries';
import { Html5Qrcode } from 'html5-qrcode';

type Screen = 'dashboard' | 'scanner' | 'sessions';

export default function AttendantApp() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const scannerRef = useRef<Html5Qrcode | null>(null);
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
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'success' | 'failure'>('idle');
  const [scanResult, setScanResult] = useState<{
    plate: string;
    driver: string;
    space: string;
    reservation: string;
    id: string;
  } | null>(null);
  const [scanError, setScanError] = useState<string>('');

  // Fetch queries
  const { data: sessions, refetch: refetchSessions } = useSessions();
  const { data: reservations, refetch: refetchReservations } = useReservations();
  const { data: availability, refetch: refetchAvailability } = useFacilityAvailability(user?.facilityId || '');

  // Mutations
  const validateMutation = useValidateQR();
  const checkinMutation = useCheckInDriver();
  const checkoutMutation = useCheckoutSession();

  const isToday = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    return d.getDate() === today.getDate() &&
           d.getMonth() === today.getMonth() &&
           d.getFullYear() === today.getFullYear();
  };

  const getDurationLabel = (checkinTime: string) => {
    const diffMs = new Date().getTime() - new Date(checkinTime).getTime();
    const diffMins = Math.max(1, Math.floor(diffMs / 60000));
    if (diffMins < 60) {
      return `${diffMins}m`;
    }
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
  };

  // Process a successfully scanned token string
  const handleQRCodeScanned = (token: string) => {
    setScanState('scanning');
    setScanError('');

    validateMutation.mutate(token, {
      onSuccess: (resData: any) => {
        setScanResult({
          plate: resData.vehiclePlate,
          driver: resData.driverName,
          space: resData.spaceNumber || 'Auto',
          reservation: resData.code,
          id: resData.id,
        });
        setScanState('success');

        // Automatically trigger check-in
        checkinMutation.mutate(resData.id, {
          onSuccess: () => {
            setTimeout(() => {
              setScanState('idle');
              setScanResult(null);
              refetchSessions();
              refetchAvailability();
              refetchReservations();
              setScreen('sessions');
            }, 1000);
          },
          onError: (err: any) => {
            setScanError(err?.response?.data?.message || 'Check-in failed');
            setScanState('failure');
          },
        });
      },
      onError: (err: any) => {
        setScanError(err?.response?.data?.message || 'Invalid or expired QR code.');
        setScanState('failure');
      },
    });
  };

  // Camera scanner instance lifecycle hook
  useEffect(() => {
    let isMounted = true;
    const shouldStartScanner = screen === 'scanner' && scanState === 'idle';

    if (shouldStartScanner) {
      const timer = setTimeout(async () => {
        try {
          const element = document.getElementById("reader");
          if (!element || !isMounted) return;

          // Cleanup any existing instance on the DOM
          if (scannerRef.current) {
            try {
              if (scannerRef.current.isScanning) {
                await scannerRef.current.stop();
              }
            } catch (stopErr) {
              console.warn("Stopping existing scanner failed:", stopErr);
            }
            scannerRef.current = null;
          }

          if (!isMounted) return;

          const html5QrCode = new Html5Qrcode("reader");
          scannerRef.current = html5QrCode;

          await html5QrCode.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: (width, height) => {
                const size = Math.min(width, height) * 0.7;
                return { width: size, height: size };
              },
              aspectRatio: 1.0,
            },
            async (decodedText) => {
              if (html5QrCode.isScanning) {
                try {
                  await html5QrCode.stop();
                } catch (stopErr) {
                  console.error("Error stopping scanner on scan:", stopErr);
                }
              }
              if (isMounted) {
                handleQRCodeScanned(decodedText);
              }
            },
            () => {
              // Fail silently on scan loops (quiet mode)
            }
          );
        } catch (e: any) {
          console.error("Scanner setup error:", e);
          if (isMounted) {
            setScanError("Camera access denied or busy: " + (e.message || e));
            setScanState('failure');
          }
        }
      }, 500);

      return () => {
        isMounted = false;
        clearTimeout(timer);
        const currentScanner = scannerRef.current;
        if (currentScanner) {
          if (currentScanner.isScanning) {
            currentScanner.stop().catch(err => console.error("Scanner stop cleanup failure:", err));
          }
        }
      };
    } else {
      // Ensure running scanner is stopped when not on active scanning tab/state
      const currentScanner = scannerRef.current;
      if (currentScanner && currentScanner.isScanning) {
        currentScanner.stop().catch(err => console.error("Scanner stop inactive cleanup failure:", err));
      }
    }
  }, [screen, scanState]);



  function handleConfirmCheckIn() {
    if (!scanResult) return;
    checkinMutation.mutate(scanResult.id, {
      onSuccess: () => {
        setScanState('idle');
        setScanResult(null);
        refetchSessions();
        refetchAvailability();
        refetchReservations();
        setScreen('sessions');
      },
      onError: (err: any) => {
        alert(err?.response?.data?.message || 'Check-in failed');
      },
    });
  }

  function handleCheckout(sessionId: string) {
    if (confirm('Are you sure you want to check out this vehicle?')) {
      checkoutMutation.mutate(sessionId, {
        onSuccess: () => {
          refetchSessions();
          refetchAvailability();
          refetchReservations();
          alert('Vehicle checked out successfully!');
        },
        onError: (err: any) => {
          alert(err?.response?.data?.message || 'Checkout failed');
        },
      });
    }
  }

  function resetScan() {
    setScanState('idle');
    setScanResult(null);
    setScanError('');
    // Clean up scanner ref so it can be re-created
    scannerRef.current = null;
  }

  const navItems = [
    { id: 'dashboard' as Screen, icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'scanner' as Screen, icon: ScanLine, label: 'Scanner' },
    { id: 'sessions' as Screen, icon: Car, label: 'Sessions' },
  ];

  function renderDashboard() {
    const arrivalsToday = sessions?.filter((s: any) => s.checkin_time && isToday(s.checkin_time))?.length || 0;
    const checkoutsToday = sessions?.filter((s: any) => s.checkout_time && isToday(s.checkout_time))?.length || 0;

    const occupied = availability?.occupiedSpaces ?? sessions?.filter((s: any) => s.status === 'active')?.length ?? 0;
    const totalSpaces = availability?.totalSpaces ?? 120;
    const available = availability?.availableSpaces ?? Math.max(0, totalSpaces - occupied);

    const todaySessions = sessions?.filter((s: any) => {
      const cTime = s.checkin_time ? new Date(s.checkin_time) : null;
      const oTime = s.checkout_time ? new Date(s.checkout_time) : null;
      const matchCheckin = cTime && cTime.getDate() === new Date().getDate();
      const matchCheckout = oTime && oTime.getDate() === new Date().getDate();
      return matchCheckin || matchCheckout;
    }).slice(0, 10) || [];

    return (
      <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="bg-[#2E8B57] px-5 pt-12 pb-6 text-white flex justify-between items-start">
          <div>
            <p className="text-green-200 text-sm mb-1">Welcome back,</p>
            <h1 className="text-xl font-bold">{user?.name || 'Attendant'}</h1>
            <p className="text-green-200 text-sm mt-1 flex items-center gap-1.5">
              <MapPin size={13} /> {user?.facilityName || 'Garden City Parking'} · Shift: {user?.shiftInfo || '7:00 AM – 3:00 PM'}
            </p>
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

        <div className="px-4 py-5 space-y-5">
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Arrivals Today', value: String(arrivalsToday), icon: Car, color: '#0F4C81', bg: '#EFF6FF' },
              { label: 'Checkouts Today', value: String(checkoutsToday), icon: Check, color: '#2E8B57', bg: '#F0FDF4' },
              { label: 'Occupied Spaces', value: String(occupied), icon: MapPin, color: '#7C3AED', bg: '#F5F3FF' },
              { label: 'Available Spaces', value: String(available), icon: LayoutDashboard, color: '#F59E0B', bg: '#FFFBEB' },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: kpi.bg }}>
                    <kpi.icon size={16} style={{ color: kpi.color }} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-[#0F172A]">{kpi.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{kpi.label}</p>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div>
            <h3 className="font-semibold text-[#0F172A] mb-3">Quick Actions</h3>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setScreen('scanner')}
                className="flex flex-col items-center gap-2 p-4 bg-[#2E8B57] text-white rounded-xl"
              >
                <ScanLine size={22} />
                <span className="text-xs font-medium">Scan QR</span>
              </button>
              <button
                onClick={() => setScreen('scanner')}
                className="flex flex-col items-center gap-2 p-4 bg-white border border-gray-100 rounded-xl"
              >
                <Car size={22} className="text-[#0F4C81]" />
                <span className="text-xs font-medium text-gray-700">Check-In</span>
              </button>
              <button
                onClick={() => setScreen('sessions')}
                className="flex flex-col items-center gap-2 p-4 bg-white border border-gray-100 rounded-xl"
              >
                <Clock size={22} className="text-gray-600" />
                <span className="text-xs font-medium text-gray-700">Checkout</span>
              </button>
            </div>
          </div>

          {/* Recent arrivals */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-[#0F172A]">Today's Arrivals</h3>
              <span className="text-xs text-gray-400">{todaySessions.length} total</span>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
              {todaySessions.length === 0 ? (
                <p className="text-sm text-gray-400 p-4 text-center">No arrivals or checkouts today.</p>
              ) : (
                todaySessions.map((s: any) => {
                  const checkinTimeFormatted = s.checkin_time
                    ? new Date(s.checkin_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '';
                  return (
                    <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                      <div className={`w-2 h-2 rounded-full ${s.status === 'active' ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span className="text-xs text-gray-400 w-16">{checkinTimeFormatted}</span>
                      <span className="font-medium text-sm text-[#0F172A] flex-1 font-mono">{s.vehicle_plate}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {s.status === 'active' ? 'In' : 'Out'}
                      </span>
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

  function renderScanner() {
    return (
      <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4 flex justify-between items-center">
          <div>
            <h2 className="font-bold text-lg text-[#0F172A]">QR Scanner</h2>
            <p className="text-sm text-gray-500 mt-0.5">Scan driver's reservation QR code</p>
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
            <LogOut size={18} />
          </button>
        </div>

        <div className="px-4 py-6 space-y-5">
          {/* Scanner status banner */}
          {scanState === 'idle' && (
            <div className="bg-green-50 border border-green-100 rounded-xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 bg-[#2E8B57] rounded-lg flex items-center justify-center flex-shrink-0">
                <Camera size={16} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-green-800">Camera Active</p>
                <p className="text-xs text-green-600">Point at a QR code to scan automatically</p>
              </div>
            </div>
          )}

          {/* Scanner viewport */}
          <div className="relative rounded-2xl overflow-hidden aspect-square max-w-xs mx-auto">
            {/* Camera feed container - always mounted when idle so html5-qrcode can render */}
            {scanState === 'idle' && (
              <>
                <div
                  id="reader"
                  style={{ width: '100%', height: '100%' }}
                />
                {/* Corner bracket overlays on top of camera feed */}
                {[['top-3 left-3'], ['top-3 right-3'], ['bottom-3 left-3'], ['bottom-3 right-3']].map(([pos], i) => (
                  <div key={i} className={`absolute ${pos} w-10 h-10 z-30 pointer-events-none`}>
                    <div className={`absolute w-7 h-1 bg-[#2E8B57] rounded-full ${i % 2 === 0 ? 'left-0' : 'right-0'} ${i < 2 ? 'top-0' : 'bottom-0'}`} />
                    <div className={`absolute h-7 w-1 bg-[#2E8B57] rounded-full ${i % 2 === 0 ? 'left-0' : 'right-0'} ${i < 2 ? 'top-0' : 'bottom-0'}`} />
                  </div>
                ))}
              </>
            )}

            {/* Non-idle states: show results on dark background */}
            {scanState !== 'idle' && (
              <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                {scanState === 'scanning' && (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 border-4 border-t-[#2E8B57] border-white/20 rounded-full animate-spin" />
                    <p className="text-white/80 text-sm">Verifying QR Code...</p>
                  </div>
                )}

                {scanState === 'success' && (
                  <div className="text-center px-6">
                    <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-4">
                      <Check size={36} className="text-white" />
                    </div>
                    <p className="text-white font-bold text-lg">Verified!</p>
                    <p className="text-green-300 text-sm mt-1">Valid reservation</p>
                  </div>
                )}

                {scanState === 'failure' && (
                  <div className="text-center px-6">
                    <div className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center mx-auto mb-4">
                      <X size={36} className="text-white" />
                    </div>
                    <p className="text-white font-bold text-lg">Invalid!</p>
                    <p className="text-red-300 text-sm mt-1">Scan failed</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Result card */}
          {scanState === 'success' && scanResult && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Check size={18} className="text-[#2E8B57]" />
                <p className="font-semibold text-green-800">Driver Verified</p>
              </div>
              <div className="space-y-1.5">
                {[
                  { label: 'Plate', value: scanResult.plate },
                  { label: 'Driver', value: scanResult.driver },
                  { label: 'Space', value: scanResult.space },
                  { label: 'Reservation', value: scanResult.reservation },
                ].map((r) => (
                  <div key={r.label} className="flex justify-between text-sm">
                    <span className="text-green-700">{r.label}</span>
                    <span className="font-semibold text-green-900 font-mono">{r.value}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={handleConfirmCheckIn}
                disabled={checkinMutation.isPending}
                className="mt-4 w-full py-2.5 bg-[#2E8B57] text-white rounded-xl font-semibold text-sm disabled:opacity-60 transition-opacity"
              >
                {checkinMutation.isPending ? 'Confirming...' : 'Confirm Check-In'}
              </button>
            </div>
          )}

          {scanState === 'failure' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2">
                <AlertCircle size={18} className="text-[#DC2626]" />
                <p className="font-semibold text-red-800">Scan Verification Failed</p>
              </div>
              <p className="text-sm text-red-600 mt-1">{scanError || 'This QR token was invalid or expired. Check reservations queue.'}</p>
            </div>
          )}

          {/* Controls */}
          {scanState !== 'idle' && (
            <div className="flex gap-3">
              <button
                onClick={resetScan}
                className="flex-1 py-3 bg-[#2E8B57] text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
              >
                <Camera size={16} />
                Scan Again
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderSessions() {
    const activeSessions = sessions?.filter((s: any) => s.status === 'active') || [];

    return (
      <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4 flex justify-between items-center">
          <div>
            <h2 className="font-bold text-lg text-[#0F172A]">Active Vehicles</h2>
            <p className="text-sm text-gray-500 mt-0.5">{activeSessions.length} vehicles currently parked</p>
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
            <LogOut size={18} />
          </button>
        </div>

        <div className="px-4 py-4 space-y-3">
          {activeSessions.length === 0 ? (
            <p className="text-sm text-gray-400 p-4 text-center">No active vehicles parked.</p>
          ) : (
            activeSessions.map((v: any) => {
              const checkinTimeFormatted = v.checkin_time
                ? new Date(v.checkin_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '';

              return (
                <div key={v.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#EFF6FF] rounded-xl flex items-center justify-center">
                        <Car size={18} className="text-[#0F4C81]" />
                      </div>
                      <div>
                        <p className="font-bold text-[#0F172A] font-mono">{v.vehicle_plate}</p>
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <User size={12} /> {v.driverName || 'Driver'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Active</span>
                      <p className="text-xs text-gray-400 mt-1">{v.checkin_time ? getDurationLabel(v.checkin_time) : ''}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-3 border-t border-gray-50">
                    <div>
                      <span className="text-gray-400">Space</span>
                      <p className="font-semibold text-[#0F172A] mt-0.5">{v.spaceNumber || 'Auto Assigned'}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Check-In</span>
                      <p className="font-semibold text-[#0F172A] mt-0.5">{checkinTimeFormatted}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => handleCheckout(v.id)}
                      disabled={checkoutMutation.isPending}
                      className="flex-1 py-2 bg-[#FEF2F2] text-[#DC2626] rounded-lg text-sm font-medium hover:bg-red-100 disabled:opacity-50 transition-colors"
                    >
                      {checkoutMutation.isPending ? 'Processing...' : 'Checkout'}
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

  const screenMap: Record<Screen, JSX.Element> = {
    dashboard: renderDashboard(),
    scanner: renderScanner(),
    sessions: renderSessions(),
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-[#1A6040] flex-shrink-0">
        <div className="px-5 pt-8 pb-6 border-b border-white/10">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 bg-[#F4B400] rounded-lg flex items-center justify-center">
              <ScanLine size={16} className="text-[#0F172A]" />
            </div>
            <span className="text-white font-bold text-lg">Parka</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-200 flex items-center justify-center">
              <span className="font-bold text-sm text-green-800">
                {user?.name ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase() : 'AT'}
              </span>
            </div>
            <div>
              <p className="text-white text-sm font-medium">{user?.name || 'Attendant'}</p>
              <p className="text-green-300 text-xs">Parking Attendant</p>
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
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-[#F4B400] text-[#0F172A]' : 'text-green-100 hover:bg-white/10 hover:text-white'}`}
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
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-green-300 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {screenMap[screen]}

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50">
          <div className="flex items-center justify-around px-2 py-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = screen === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setScreen(item.id)}
                  className={`flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl transition-colors ${isActive ? 'text-[#2E8B57]' : 'text-gray-400'}`}
                >
                  <Icon size={22} />
                  <span className="text-xs font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </main>
    </div>
  );
}
