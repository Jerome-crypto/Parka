import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useForgotPassword } from '../../services/queries';
import { MapPin, Mail, AlertCircle, ArrowLeft, CheckCircle, ExternalLink, Copy, Check } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const forgotPasswordMutation = useForgotPassword();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result: any = await forgotPasswordMutation.mutateAsync(email);
      // Dev mode: server returns the reset URL directly when SMTP is unconfigured
      if (result?.devResetUrl) {
        setDevResetUrl(result.devResetUrl);
      }
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to request password reset. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (devResetUrl) {
      await navigator.clipboard.writeText(devResetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
          Reset your password
        </h2>
        <p className="mt-2 text-center text-sm text-gray-500">
          Enter your email address and we'll send you a link to reset your password.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white py-8 px-4 shadow-sm border border-gray-100 rounded-2xl sm:px-10"
        >
          {success ? (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto text-green-500 border border-green-100 mb-3">
                  <CheckCircle size={24} />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Check your inbox</h3>
                {devResetUrl ? (
                  <p className="text-sm text-gray-500 mt-1">
                    SMTP is not configured yet — use the link below to reset your password directly.
                  </p>
                ) : (
                  <p className="text-sm text-gray-500 mt-1">
                    We've sent a password recovery link to{' '}
                    <span className="font-semibold text-gray-700">{email}</span>.
                    Please check your inbox.
                  </p>
                )}
              </div>

              {/* Dev-mode reset link */}
              {devResetUrl && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">🔧 Dev Mode — Reset Link</p>
                  <p className="text-xs text-amber-700 break-all font-mono">{devResetUrl}</p>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy Link</>}
                    </button>
                    <a
                      href={devResetUrl}
                      className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <ExternalLink size={12} /> Open Link
                    </a>
                  </div>
                </div>
              )}

              <button
                onClick={() => navigate('/login')}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-[#0F4C81] hover:bg-[#0F4C81]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0F4C81] transition-all"
              >
                Back to Login
              </button>
            </div>
          ) : (
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
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-[#0F4C81] hover:bg-[#0F4C81]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0F4C81] transition-all disabled:opacity-50"
                >
                  {loading ? 'Sending link...' : 'Send Reset Link'}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
}
