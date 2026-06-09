import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { MapPin, Lock, Mail, AlertCircle, Star, Clock, Car, Shield, Building2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Auto-redirect if already logged in (resolves back button routing)
  useEffect(() => {
    const accessToken = localStorage.getItem('accessToken');
    if (accessToken) {
      try {
        const payload = JSON.parse(atob(accessToken.split('.')[1]));
        const userRole = payload.role;
        if (userRole === 'DRIVER') navigate('/driver', { replace: true });
        else if (userRole === 'ATTENDANT') navigate('/attendant', { replace: true });
        else if (userRole === 'OPERATOR') navigate('/operator', { replace: true });
        else if (userRole === 'ADMIN') navigate('/admin', { replace: true });
      } catch (e) {
        // Invalid token, do nothing
      }
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login({ email, password });
      
      const accessToken = localStorage.getItem('accessToken');
      if (accessToken) {
        const payload = JSON.parse(atob(accessToken.split('.')[1]));
        const userRole = payload.role;

        // Use replace: true so physical back buttons do not trigger login page loop
        if (userRole === 'DRIVER') navigate('/driver', { replace: true });
        else if (userRole === 'ATTENDANT') navigate('/attendant', { replace: true });
        else if (userRole === 'OPERATOR') navigate('/operator', { replace: true });
        else if (userRole === 'ADMIN') navigate('/admin', { replace: true });
        else navigate('/', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Invalid email or password.');
      } else if (typeof err === 'object' && err !== null && 'response' in err) {
        const responseErr = err as { response: { data?: { message?: string } } };
        setError(responseErr.response?.data?.message || 'Invalid email or password.');
      } else {
        setError('Invalid email or password.');
      }
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    { label: 'Facilities', value: '18+', icon: Building2 },
    { label: 'Drivers', value: '2.8K', icon: Car },
    { label: 'Free Spaces', value: '340+', icon: MapPin },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col lg:flex-row">
      
      {/* Left Column: Brand Hero Section (Hidden on small mobile viewports, or shown as premium banner) */}
      <div className="lg:w-5/12 bg-gradient-to-br from-[#0F4C81] to-[#1E3A8A] text-white px-8 py-12 lg:py-20 flex flex-col justify-between relative overflow-hidden flex-shrink-0">
        
        {/* Background glow vectors */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full border-4 border-white" />
          <div className="absolute top-48 -left-20 w-80 h-80 rounded-full border-2 border-white" />
          <div className="absolute bottom-8 right-8 w-40 h-40 rounded-full border border-white" />
        </div>

        {/* Brand Header */}
        <div className="relative">
          <div className="flex items-center gap-2 mb-8 justify-center lg:justify-start">
            <div className="w-10 h-10 bg-[#F4B400] rounded-xl flex items-center justify-center shadow-lg">
              <MapPin size={20} className="text-[#0F172A]" />
            </div>
            <span className="text-2xl font-bold tracking-tight">Parka</span>
          </div>

          <h1 className="text-3xl lg:text-5xl font-extrabold leading-tight mb-4 text-center lg:text-left">
            Find. Reserve.<br />Park.
          </h1>
          
          <p className="text-blue-100 text-sm lg:text-base leading-relaxed text-center lg:text-left max-w-md mx-auto lg:mx-0">
            Real-time parking for Kampala CBD. No more circling round crowded roads. Book a slot and verify in seconds.
          </p>

          {/* Badges */}
          <div className="flex flex-wrap gap-2 mt-6 justify-center lg:justify-start">
            <div className="flex items-center gap-1 bg-white/10 px-3 py-1 rounded-full text-xs border border-white/10 font-medium">
              <Star size={12} className="fill-[#F4B400] text-[#F4B400]" />
              <span>4.8 Rating</span>
            </div>
            <div className="flex items-center gap-1 bg-white/10 px-3 py-1 rounded-full text-xs border border-white/10 font-medium">
              <Clock size={12} className="text-green-300" />
              <span>Live Availability</span>
            </div>
            <div className="flex items-center gap-1 bg-white/10 px-3 py-1 rounded-full text-xs border border-white/10 font-medium">
              <MapPin size={12} className="text-yellow-300" />
              <span>Kampala</span>
            </div>
          </div>
        </div>

        {/* Stats Grid Widget */}
        <div className="relative mt-12 lg:mt-0">
          <div className="grid grid-cols-3 gap-3">
            {stats.map((s, i) => (
              <div 
                key={s.label} 
                className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex flex-col items-center text-center hover:bg-white/15 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center mb-2">
                  <s.icon size={16} className="text-[#F4B400]" />
                </div>
                <div className="text-lg lg:text-xl font-black text-[#F4B400]">{s.value}</div>
                <div className="text-[10px] text-blue-200 uppercase tracking-wider font-semibold mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column: Centered Login Form Card */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white py-10 px-6 lg:px-10 shadow-xl border border-gray-100 rounded-3xl"
          >
            <div className="mb-8">
              <h2 className="text-2xl lg:text-3xl font-extrabold text-[#0F172A] tracking-tight">
                Welcome Back
              </h2>
              <p className="mt-1.5 text-sm text-gray-500">
                Sign in to manage bookings, track live sessions, and verify transactions.
              </p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-2.5 text-sm text-red-800 animate-pulse">
                  <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <span className="font-medium">{error}</span>
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700">
                  Email Address
                </label>
                <div className="mt-1 relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none block w-full pl-11 pr-4 py-3 border border-gray-200 rounded-2xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0F4C81] focus:border-transparent sm:text-sm text-gray-700 bg-gray-50/50 hover:bg-gray-50 transition-colors"
                    placeholder="name@email.com"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center">
                  <label htmlFor="password" className="block text-sm font-semibold text-gray-700">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => navigate('/forgot-password')}
                    className="text-xs font-bold text-[#0F4C81] hover:text-[#0F4C81]/80 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="mt-1 relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full pl-11 pr-4 py-3 border border-gray-200 rounded-2xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0F4C81] focus:border-transparent sm:text-sm text-gray-700 bg-gray-50/50 hover:bg-gray-50 transition-colors"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-2xl shadow-lg text-sm font-bold text-white bg-[#0F4C81] hover:bg-[#0F4C81]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0F4C81] transition-all disabled:opacity-50 active:scale-[0.98]"
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </div>
            </form>

            <div className="mt-8 pt-6 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500">
                Don't have an account?{' '}
                <button
                  onClick={() => navigate('/register')}
                  className="font-bold text-[#0F4C81] hover:text-[#0F4C81]/80 transition-colors"
                >
                  Create a new account
                </button>
              </p>
            </div>
          </motion.div>
        </div>
      </div>

    </div>
  );
}
