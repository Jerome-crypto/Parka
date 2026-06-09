import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { MapPin, Lock, Mail, AlertCircle, ArrowLeft, User, Phone, Building2, Tag } from 'lucide-react';
import { motion } from 'framer-motion';

type Role = 'DRIVER' | 'OPERATOR' | 'ATTENDANT';

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { register } = useAuth();
  
  const roleParam = (searchParams.get('role')?.toUpperCase() as Role) || 'DRIVER';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<Role>(roleParam);
  
  // Operator fields
  const [companyName, setCompanyName] = useState('');
  const [businessLicense, setBusinessLicense] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const payload: Record<string, string | number> = {
        name,
        email,
        phone,
        password,
        role,
      };

      if (role === 'OPERATOR') {
        payload.companyName = companyName;
        payload.businessLicense = businessLicense;
      }

      await register(payload);

      // Auto-route based on registration role
      if (role === 'DRIVER') navigate('/driver', { replace: true });
      else if (role === 'ATTENDANT') navigate('/attendant', { replace: true });
      else if (role === 'OPERATOR') navigate('/operator', { replace: true });
      else navigate('/', { replace: true });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Registration failed.');
      } else if (typeof err === 'object' && err !== null && 'response' in err) {
        const responseErr = err as { response: { data?: { message?: string } } };
        setError(responseErr.response?.data?.message || 'Registration failed.');
      } else {
        setError('Registration failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <button 
          onClick={() => navigate('/login')}
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm mb-6 font-medium transition-colors"
        >
          <ArrowLeft size={16} /> Back to login
        </button>
        <div className="flex items-center gap-2 mb-6 justify-center">
          <div className="w-10 h-10 bg-[#F4B400] rounded-xl flex items-center justify-center">
            <MapPin size={20} className="text-[#0F172A]" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-[#0F172A]">Parka</span>
        </div>
        <h2 className="text-center text-3xl font-extrabold text-[#0F172A] tracking-tight">
          Create your account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <button
            onClick={() => navigate('/login')}
            className="font-medium text-[#0F4C81] hover:text-[#0F4C81]/80 transition-colors"
          >
            sign in here
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
              <label htmlFor="name" className="block text-sm font-semibold text-gray-700">
                Full name
              </label>
              <div className="mt-1 relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#0F4C81] focus:border-[#0F4C81] sm:text-sm text-gray-700 bg-gray-50/50"
                  placeholder="Aisha Nakato"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700">
                Email address
              </label>
              <div className="mt-1 relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#0F4C81] focus:border-[#0F4C81] sm:text-sm text-gray-700 bg-gray-50/50"
                  placeholder="name@email.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-semibold text-gray-700">
                Phone number
              </label>
              <div className="mt-1 relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  id="phone"
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#0F4C81] focus:border-[#0F4C81] sm:text-sm text-gray-700 bg-gray-50/50"
                  placeholder="+256 701 234 567"
                />
              </div>
            </div>

            {role === 'OPERATOR' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-6"
              >
                <div>
                  <label htmlFor="companyName" className="block text-sm font-semibold text-gray-700">
                    Company name
                  </label>
                  <div className="mt-1 relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      id="companyName"
                      type="text"
                      required={role === 'OPERATOR'}
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#0F4C81] focus:border-[#0F4C81] sm:text-sm text-gray-700 bg-gray-50/50"
                      placeholder="Pearl Parking Solutions"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="businessLicense" className="block text-sm font-semibold text-gray-700">
                    Business license
                  </label>
                  <div className="mt-1 relative">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      id="businessLicense"
                      type="text"
                      required={role === 'OPERATOR'}
                      value={businessLicense}
                      onChange={(e) => setBusinessLicense(e.target.value)}
                      className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#0F4C81] focus:border-[#0F4C81] sm:text-sm text-gray-700 bg-gray-50/50"
                      placeholder="BL-XXXX-YY"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700">
                Password
              </label>
              <div className="mt-1 relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#0F4C81] focus:border-[#0F4C81] sm:text-sm text-gray-700 bg-gray-50/50"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700">
                Confirm password
              </label>
              <div className="mt-1 relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#0F4C81] focus:border-[#0F4C81] sm:text-sm text-gray-700 bg-gray-50/50"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-[#0F4C81] hover:bg-[#0F4C81]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0F4C81] transition-all disabled:opacity-50"
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
