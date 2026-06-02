import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { MapPin, Lock, Mail, AlertCircle, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  
  const roleParam = searchParams.get('role') || 'driver';
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login({ email, password });
      
      // Auto-route based on role from localstorage/cookies or fetch
      const accessToken = localStorage.getItem('accessToken');
      if (accessToken) {
        // Decode JWT client-side quickly to check role
        const payload = JSON.parse(atob(accessToken.split('.')[1]));
        const userRole = payload.role;

        if (userRole === 'DRIVER') navigate('/driver');
        else if (userRole === 'ATTENDANT') navigate('/attendant');
        else if (userRole === 'OPERATOR') navigate('/operator');
        else if (userRole === 'ADMIN') navigate('/admin');
        else navigate('/');
      } else {
        navigate('/');
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

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <div className="w-10 h-10 bg-[#F4B400] rounded-xl flex items-center justify-center">
            <MapPin size={20} className="text-[#0F172A]" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-[#0F172A]">Parka</span>
        </div>
        <h2 className="text-center text-3xl font-extrabold text-[#0F172A] tracking-tight">
          Sign in to your account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-500">
          Or{' '}
          <button
            onClick={() => navigate('/register')}
            className="font-medium text-[#0F4C81] hover:text-[#0F4C81]/80 transition-colors"
          >
            create a new account
          </button>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white py-8 px-4 shadow-sm border border-gray-100 rounded-2xl sm:px-10"
        >
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2 text-sm text-red-800">
                <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700">
                Email address
              </label>
              <div className="mt-1 relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#0F4C81] focus:border-[#0F4C81] sm:text-sm text-gray-700 bg-gray-50/50"
                  placeholder="name@email.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700">
                Password
              </label>
              <div className="mt-1 relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#0F4C81] focus:border-[#0F4C81] sm:text-sm text-gray-700 bg-gray-50/50"
                  placeholder="••••••••"
                />
              </div>
              <div className="flex items-center justify-end mt-2">
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="text-xs font-semibold text-[#0F4C81] hover:text-[#0F4C81]/80 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-[#0F4C81] hover:bg-[#0F4C81]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0F4C81] transition-all disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
