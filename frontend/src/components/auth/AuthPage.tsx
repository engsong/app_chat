import React, { useState } from 'react';
import {
  ShieldCheck,
  User,
  Phone,
  Lock,
  Building2,
  Eye,
  EyeOff,
  ArrowRight,
  Check,
  AlertCircle
} from 'lucide-react';
import { User as UserType } from '../../types/index.js';

interface AuthPageProps {
  onLoginSuccess: (user: UserType) => void;
  demoUsers?: UserType[];
}

export const AuthPage: React.FC<AuthPageProps> = ({ onLoginSuccess }) => {
  const [isLoginTab, setIsLoginTab] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Login form states (clean initial inputs, no sample credentials)
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form states
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regIsBusiness, setRegIsBusiness] = useState(false);
  const [regBusinessName, setRegBusinessName] = useState('');
  const [regBusinessCategory, setRegBusinessCategory] = useState('Computers & Electronics');
  const [regBusinessDescription, setRegBusinessDescription] = useState('');
  const [regAvatar, setRegAvatar] = useState('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150');

  const avatarOptions = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=150',
    'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=150',
  ];

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: loginPhone.trim(),
          password: loginPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to log in.');
      }

      onLoginSuccess(data.user);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error connecting to authentication service.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (regPassword !== regConfirmPassword) {
      setErrorMsg('Passwords do not match. Please verify.');
      return;
    }

    if (regPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName.trim(),
          phone: regPhone.trim(),
          password: regPassword,
          avatar: regAvatar,
          isBusiness: regIsBusiness,
          businessName: regIsBusiness ? (regBusinessName.trim() || regName.trim()) : undefined,
          businessCategory: regIsBusiness ? regBusinessCategory : undefined,
          businessDescription: regIsBusiness ? regBusinessDescription.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed.');
      }

      onLoginSuccess(data.user);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error creating account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#111b21] flex flex-col justify-between text-white font-sans overflow-y-auto">
      {/* Top IChat Banner */}
      <div className="h-44 md:h-56 bg-gradient-to-r from-[#008069] to-[#00a884] flex items-center justify-center p-6 shadow-md relative">
        <div className="flex items-center gap-4 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-xl p-2 overflow-hidden">
            <img src="/logo.png" alt="IChat" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
                IChat
              </h1>
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <p className="text-xs md:text-sm text-white/85 font-medium">
              Ultra-Fast Real-Time Messaging & WebRTC Calling
            </p>
          </div>
        </div>
      </div>

      {/* Main Card Container */}
      <div className="flex-1 flex items-start justify-center px-4 -mt-16 md:-mt-24 pb-12 z-10">
        <div className="bg-[#202c33] border border-[#2a3942] rounded-3xl w-full max-w-md shadow-2xl p-6 sm:p-8 animate-scale-up">
          {/* Tab Selector */}
          <div className="flex bg-[#111b21] p-1.5 rounded-2xl border border-[#2a3942] mb-6">
            <button
              onClick={() => {
                setIsLoginTab(true);
                setErrorMsg('');
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                isLoginTab
                  ? 'bg-[#00a884] text-white shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setIsLoginTab(false);
                setErrorMsg('');
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                !isLoginTab
                  ? 'bg-[#00a884] text-white shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Error Alert Banner */}
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-xs text-red-200 flex items-center gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Login Form */}
          {isLoginTab ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="Enter phone number (e.g. 02054245616)"
                    value={loginPhone}
                    onChange={(e) => setLoginPhone(e.target.value)}
                    className="w-full bg-[#111b21] border border-[#2a3942] focus:border-[#00a884] rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter password..."
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full bg-[#111b21] border border-[#2a3942] focus:border-[#00a884] rounded-xl py-2.5 pl-10 pr-10 text-sm text-white placeholder-gray-500 focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#00a884] hover:bg-[#008f6f] text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-transform active:scale-[0.98] shadow-lg shadow-[#00a884]/20 disabled:opacity-50 mt-4"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Sign In to IChat <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* 2. Register Form (Create New Account) */
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alex Johnson"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full bg-[#111b21] border border-[#2a3942] focus:border-[#00a884] rounded-xl py-2 pl-10 pr-3 text-xs text-white placeholder-gray-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 02054245616"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    className="w-full bg-[#111b21] border border-[#2a3942] focus:border-[#00a884] rounded-xl py-2 pl-10 pr-3 text-xs text-white placeholder-gray-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Min 6 chars"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full bg-[#111b21] border border-[#2a3942] focus:border-[#00a884] rounded-xl py-2 px-3 text-xs text-white placeholder-gray-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Confirm
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Confirm"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    className="w-full bg-[#111b21] border border-[#2a3942] focus:border-[#00a884] rounded-xl py-2 px-3 text-xs text-white placeholder-gray-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Avatar Selector */}
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Select Profile Photo
                </label>
                <div className="flex items-center gap-2">
                  {avatarOptions.map((av, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setRegAvatar(av)}
                      className={`relative rounded-full p-0.5 border-2 transition-all ${
                        regAvatar === av ? 'border-[#00a884] scale-105' : 'border-transparent opacity-60'
                      }`}
                    >
                      <img src={av} alt="" className="w-8 h-8 rounded-full object-cover" />
                      {regAvatar === av && (
                        <div className="absolute -bottom-1 -right-1 bg-[#00a884] rounded-full p-0.5 text-white">
                          <Check className="w-2.5 h-2.5" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Business Account Toggle */}
              <div className="p-3 bg-[#111b21] rounded-xl border border-[#2a3942] space-y-2">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#00a884]" />
                    <span className="text-xs font-semibold text-white">
                      Create as Business Account
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={regIsBusiness}
                    onChange={(e) => setRegIsBusiness(e.target.checked)}
                    className="w-4 h-4 accent-[#00a884] rounded cursor-pointer"
                  />
                </label>

                {regIsBusiness && (
                  <div className="pt-2 space-y-2 border-t border-[#2a3942] animate-fade-in">
                    <input
                      type="text"
                      placeholder="Business Name (e.g. Acme Tech Solutions)"
                      value={regBusinessName}
                      onChange={(e) => setRegBusinessName(e.target.value)}
                      className="w-full bg-[#202c33] border border-[#2a3942] rounded-lg py-1.5 px-3 text-xs text-white placeholder-gray-500 focus:outline-none"
                    />

                    <select
                      value={regBusinessCategory}
                      onChange={(e) => setRegBusinessCategory(e.target.value)}
                      className="w-full bg-[#202c33] border border-[#2a3942] rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none"
                    >
                      <option value="Computers & Electronics">Computers & Electronics</option>
                      <option value="Retail & Shopping">Retail & Shopping</option>
                      <option value="Food & Beverage">Food & Beverage</option>
                      <option value="Professional Services">Professional Services</option>
                      <option value="Health & Beauty">Health & Beauty</option>
                    </select>

                    <textarea
                      rows={2}
                      placeholder="Business description & services..."
                      value={regBusinessDescription}
                      onChange={(e) => setRegBusinessDescription(e.target.value)}
                      className="w-full bg-[#202c33] border border-[#2a3942] rounded-lg py-1.5 px-3 text-xs text-white placeholder-gray-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-[#00a884] hover:bg-[#008f6f] text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-transform active:scale-[0.98] shadow-lg shadow-[#00a884]/20 disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Create IChat Account <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="py-4 text-center text-xs text-gray-500 border-t border-[#2a3942]/40">
        IChat • Ultra-Fast Real-Time Communication
      </div>
    </div>
  );
};
