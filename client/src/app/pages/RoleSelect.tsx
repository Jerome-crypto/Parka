import { useNavigate } from 'react-router';
import { Car, ScanLine, Building2, Shield, MapPin, Star, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

const roles = [
  {
    id: 'driver',
    label: 'Driver',
    description: 'Find, reserve & manage parking spaces',
    icon: Car,
    color: '#0F4C81',
    bg: '#EFF6FF',
    path: '/driver',
  },
  {
    id: 'attendant',
    label: 'Attendant',
    description: 'Scan QR codes & manage arrivals',
    icon: ScanLine,
    color: '#2E8B57',
    bg: '#F0FDF4',
    path: '/attendant',
  },
  {
    id: 'operator',
    label: 'Operator',
    description: 'Manage facilities, pricing & reports',
    icon: Building2,
    color: '#7C3AED',
    bg: '#F5F3FF',
    path: '/operator',
  },
  {
    id: 'admin',
    label: 'Administrator',
    description: 'System-wide oversight & user management',
    icon: Shield,
    color: '#B45309',
    bg: '#FFFBEB',
    path: '/admin',
  },
];

const stats = [
  { label: 'Parking Facilities', value: '18+' },
  { label: 'Active Users', value: '2.8K' },
  { label: 'Spaces Available', value: '340' },
];

export default function RoleSelect() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Hero Header */}
      <div className="bg-[#0F4C81] text-white px-6 pt-16 pb-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-8 right-8 w-48 h-48 rounded-full border-2 border-white" />
          <div className="absolute top-16 right-16 w-32 h-32 rounded-full border border-white" />
          <div className="absolute -bottom-8 -left-8 w-64 h-64 rounded-full border-2 border-white" />
        </div>
        <div className="relative">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-[#F4B400] rounded-xl flex items-center justify-center">
              <MapPin size={20} className="text-[#0F172A]" />
            </div>
            <span className="text-2xl font-bold tracking-tight">Parka</span>
          </div>
          <h1 className="text-4xl font-bold leading-tight mb-2">
            Find. Reserve.<br />Park.
          </h1>
          <p className="text-blue-200 mt-3 text-base leading-relaxed">
            Real-time parking for Kampala.<br />
            No more circling. No more stress.
          </p>

          {/* Stats */}
          <div className="flex gap-6 mt-8">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="text-2xl font-bold text-[#F4B400]">{s.value}</div>
                <div className="text-xs text-blue-200 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Trust signals */}
      <div className="flex items-center gap-4 px-6 py-3 bg-white border-b border-gray-100">
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <Star size={14} className="fill-[#F4B400] text-[#F4B400]" />
          <span className="font-medium text-gray-700">4.8</span>
          <span>rating</span>
        </div>
        <span className="text-gray-300">·</span>
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <Clock size={14} className="text-[#2E8B57]" />
          <span>Real-time availability</span>
        </div>
        <span className="text-gray-300">·</span>
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <MapPin size={14} className="text-[#0F4C81]" />
          <span>Kampala</span>
        </div>
      </div>

      {/* Role Cards */}
      <div className="flex-1 px-6 py-8">
        <p className="text-sm font-medium text-gray-500 mb-4 uppercase tracking-wider">
          Sign in as
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {roles.map((role, i) => {
            const Icon = role.icon;
            return (
              <motion.button
                key={role.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07, duration: 0.3 }}
                onClick={() => navigate(`/login?role=${role.id}`)}
                className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all text-left group"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: role.bg }}
                >
                  <Icon size={22} style={{ color: role.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[#0F172A] group-hover:text-[#0F4C81] transition-colors">
                    {role.label}
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5 leading-snug">
                    {role.description}
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-300 group-hover:text-[#0F4C81] transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </motion.button>
            );
          })}
        </div>

        <p className="text-center text-sm text-gray-400 mt-8">
          Demo: tap any role to explore the interface
        </p>
      </div>
    </div>
  );
}
