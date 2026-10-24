'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Sun,
  Moon,
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  KeyRound,
  ArrowRight,
} from 'lucide-react';
import { User } from '../../types';
import { loginUser } from '../../services/api';

interface LoginViewProps {
  onLoginSuccess: (user: User, token: string) => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
}

export default function LoginView({
  onLoginSuccess,
  isDarkMode,
  toggleTheme,
}: LoginViewProps) {
  // Form input states
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [capsLockActive, setCapsLockActive] = useState<boolean>(false);

  // Validation & Error states
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Initialize remembered email on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedEmail = localStorage.getItem('kide_crm_remembered_email');
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      } else {
        // Pre-fill with admin for convenience
        setEmail('admin@kide.com');
        setPassword('password123');
      }
    }
  }, []);

  // Validation functions
  const validateEmail = (val: string): boolean => {
    const trimmed = val.trim();
    if (!trimmed) {
      setEmailError('Email address or Employee ID is required.');
      return false;
    }
    // Check if it's an email address or valid employee ID
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    const isEmpId = /^EMP-[0-9A-Za-z]+$/i.test(trimmed) || trimmed.toLowerCase() === 'admin';
    if (!isEmail && !isEmpId) {
      setEmailError('Please enter a valid email address (e.g., admin@kide.com) or Employee ID.');
      return false;
    }
    setEmailError(null);
    return true;
  };

  const validatePassword = (val: string): boolean => {
    if (!val) {
      setPasswordError('Password is required.');
      return false;
    }
    if (val.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      return false;
    }
    setPasswordError(null);
    return true;
  };

  // Quick fill admin credentials for testing
  const handleQuickFillAdmin = () => {
    setEmail('admin@kide.com');
    setPassword('password123');
    setEmailError(null);
    setPasswordError(null);
    setAuthError(null);
  };

  // Detect Caps Lock
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.getModifierState('CapsLock')) {
      setCapsLockActive(true);
    } else {
      setCapsLockActive(false);
    }
  };

  // Submit Handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);

    if (!isEmailValid || !isPasswordValid) {
      return;
    }

    setIsProcessing(true);

    try {
      const res = await loginUser(email.trim(), password);

      if (res && res.success && res.user && res.token) {
        // Check Role Authorization (admin, manager, or employee)
        if (res.user.role && res.user.role !== 'admin' && res.user.role !== 'manager' && (res.user.role as string) !== 'employee') {
          setAuthError('Access Denied: Your account role does not have authorization to access this CRM portal.');
          setIsProcessing(false);
          return;
        }

        // Handle remember me
        if (typeof window !== 'undefined') {
          if (rememberMe) {
            localStorage.setItem('kide_crm_remembered_email', email.trim());
          } else {
            localStorage.removeItem('kide_crm_remembered_email');
          }
          // Store token
          localStorage.setItem('auth_token', res.token);
        }

        setAuthSuccess(`Welcome back, ${res.user.name || 'Admin'}! Token authorized.`);
        
        // Brief timeout for smooth UX transition
        setTimeout(() => {
          onLoginSuccess(res.user!, res.token!);
        }, 400);
      } else {
        setAuthError(res?.message || 'Invalid email or password. Please verify credentials.');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setAuthError('Connection failed: Unable to connect to authentication server. Please check MongoDB/Backend.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden selection:bg-[#09929e] selection:text-white">
      {/* Background Decorative Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-gradient-to-tr from-[#09929e]/15 to-emerald-500/10 rounded-full blur-[110px] pointer-events-none" />

      {/* Top Right Theme Toggle */}
      <div className="absolute top-5 right-5 z-20">
        <button
          onClick={toggleTheme}
          type="button"
          aria-label="Toggle theme"
          className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition shadow-lg cursor-pointer backdrop-blur-md"
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-cyan-400" />}
        </button>
      </div>

      {/* Login Card Container */}
      <div className="w-full max-w-[450px] bg-[#0e1626]/90 border border-slate-800/90 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-xl relative z-10 transition-all duration-200">
        {/* Top Header & Logo */}
        <div className="flex flex-col items-center mb-7">
          <div className="relative w-36 h-14 mb-3 flex items-center justify-center">
            <Image
              src="/images/logo.png"
              alt="KIDE CRM"
              fill
              priority
              className="object-contain drop-shadow-[0_2px_12px_rgba(9,146,158,0.3)]"
            />
          </div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-white tracking-tight">Admin Portal Sign In</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-cyan-950/70 border border-cyan-700/60 text-cyan-300">
              JWT HS256
            </span>
          </div>
          <p className="text-xs text-slate-400 text-center">
            Kerala Institute Field CRM • Secure Role-Based Access
          </p>
        </div>

        {/* Auth Error Banner */}
        {authError && (
          <div className="mb-5 p-3.5 bg-red-950/70 border border-red-800/90 rounded-xl text-red-300 text-xs flex items-start gap-2.5 shadow-lg animate-in fade-in slide-in-from-top-1">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block text-red-200">Authentication Failed</span>
              <span className="text-red-300/90 text-[11px] leading-relaxed">{authError}</span>
            </div>
          </div>
        )}

        {/* Auth Success Banner */}
        {authSuccess && (
          <div className="mb-5 p-3.5 bg-emerald-950/70 border border-emerald-800/90 rounded-xl text-emerald-300 text-xs flex items-center gap-2.5 shadow-lg animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="font-medium text-emerald-200">{authSuccess}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4" noValidate>
          {/* Email / Employee ID Field */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label
                htmlFor="login-email"
                className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5"
              >
                <Mail className="w-3.5 h-3.5 text-cyan-400" />
                Email / Employee ID <span className="text-red-400">*</span>
              </label>
            </div>
            <div className="relative">
              <input
                id="login-email"
                type="text"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) validateEmail(e.target.value);
                }}
                onBlur={() => validateEmail(email)}
                placeholder="admin@kide.com"
                className={`w-full px-3.5 py-2.5 pl-3.5 bg-[#090e1a] border ${
                  emailError
                    ? 'border-red-500 focus:ring-red-500/50'
                    : 'border-slate-700/80 focus:border-[#09929e] focus:ring-[#09929e]/30'
                } rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition`}
              />
            </div>
            {emailError && (
              <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1 animate-in fade-in">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{emailError}</span>
              </p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label
                htmlFor="login-password"
                className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5 text-cyan-400" />
                Password <span className="text-red-400">*</span>
              </label>
              {capsLockActive && (
                <span className="text-[10px] font-medium text-amber-400 flex items-center gap-1">
                  CapsLock ON
                </span>
              )}
            </div>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError) validatePassword(e.target.value);
                }}
                onBlur={() => validatePassword(password)}
                onKeyDown={handleKeyDown}
                placeholder="••••••••••••"
                className={`w-full px-3.5 py-2.5 pr-10 bg-[#090e1a] border ${
                  passwordError
                    ? 'border-red-500 focus:ring-red-500/50'
                    : 'border-slate-700/80 focus:border-[#09929e] focus:ring-[#09929e]/30'
                } rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {passwordError && (
              <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1 animate-in fade-in">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{passwordError}</span>
              </p>
            )}
          </div>

          {/* Remember Me & Quick Test Fill */}
          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-300">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded bg-[#090e1a] border-slate-700 text-[#09929e] focus:ring-[#09929e] cursor-pointer"
              />
              <span>Remember me</span>
            </label>
            <button
              type="button"
              onClick={handleQuickFillAdmin}
              className="text-[#09929e] hover:text-cyan-300 font-medium text-xs flex items-center gap-1 cursor-pointer transition hover:underline"
              title="Click to fill default admin credentials"
            >
              <Sparkles className="w-3 h-3" />
              <span>Fill Admin Credentials</span>
            </button>
          </div>

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={isProcessing}
            className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-[#09929e] to-[#087884] hover:from-[#0aa2b0] hover:to-[#098895] active:scale-[0.99] text-white font-medium text-sm rounded-xl shadow-lg shadow-cyan-950/40 transition duration-150 flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Authorizing JWT Session...</span>
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                <span>Sign in with Authorization</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </>
            )}
          </button>
        </form>

        {/* Footer Security Badges */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-col gap-2.5 text-center text-xs text-slate-400">
          <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>End-to-End Encrypted Token Authentication</span>
          </div>
          <div className="bg-[#090e1a]/80 border border-slate-800 rounded-lg p-2.5 text-[11px] text-slate-400 text-left">
            <div className="font-semibold text-slate-300 mb-1 flex items-center justify-between">
              <span>Default Credentials:</span>
              <span className="text-[10px] text-emerald-400 font-mono">Role: Admin</span>
            </div>
            <div className="font-mono text-[11px] text-slate-400 space-y-0.5">
              <div>Email: <span className="text-cyan-300">admin@kide.com</span></div>
              <div>Password: <span className="text-cyan-300">password123</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
